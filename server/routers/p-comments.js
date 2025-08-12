// /routes/p-comments.js
import express from "express";
import db from "../db.js";

const router = express.Router();

function requireLogin(req, res, next) {
    if (!req.session?.userID) return res.status(401).json({ error: "Not logged in" });
    next();
}

/** Parent check: this parent owns the child */
async function assertParentOwnsChild(parentUserID, childId) {
    const row = await db.oneOrNone(
        `SELECT 1 FROM children WHERE childid = $1 AND parentid = $2`,
        [childId, parentUserID]
    );
    return !!row;
}

/** Teacher check: teacher is linked to ANY class the child is in */
async function assertTeacherOfChild(teacherUserID, childId) {
    const r = await db.one(
        `
    SELECT (
      EXISTS (
        SELECT 1
        FROM childclasses cc
        JOIN classes c ON c.classid = cc.classid
        WHERE cc.childid = $1 AND c.classteacher = $2
      )
      OR EXISTS (
        SELECT 1
        FROM childclasses cc
        JOIN userclasses uc ON uc.classid = cc.classid
        WHERE cc.childid = $1 AND uc.userid = $2
      )
         OR EXISTS (
            SELECT 1
            FROM activity_enrollments ae
            JOIN activity_assignments aa ON aa.activityid = ae.activityid
            WHERE ae.childid = $1 AND aa.coachid = $2
          )
        
    ) AS ok
    `,
        [childId, teacherUserID]
    );
    return !!r.ok;
}

/** Helper for UI: who is viewing */
router.get("/viewer-role", requireLogin, (req, res) => {
    let role = (req.session?.userRole || "").toString().trim().toLowerCase() || null;
    if (role === "coach") role = "teacher";
    res.json({ role, userID: req.session?.userID || null });
});

/** Dynamic label chips */
router.get("/labels", requireLogin, async (_req, res) => {
    try {
        const rows = await db.any(
            `SELECT label_id, name, color
       FROM comment_labels
       ORDER BY name`
        );
        res.json(rows);
    } catch (err) {
        console.error("labels error:", err);
        res.status(500).json({ error: "Failed to load labels" });
    }
});

/**
 * GET /p-comments/:childId/:termId
 * Parents: only visible_to_parent = TRUE
 * Teachers: all non-deleted comments for their student(s)
 * Query params (optional): q, labelId, role, preset('week'|'month'|'term')
 */
router.get("/:childId/:termId", requireLogin, async (req, res) => {
    try {
        const { childId, termId } = req.params;
        const { q, labelId, role, preset } = req.query;

        const userID = req.session.userID;
        const userRole = (req.session.userRole || "").toString().trim().toLowerCase();

        if (!userID) return res.status(401).json({ error: "Not logged in" });

        let parentView = false;

        if (userRole === "parent") {
            const owns = await assertParentOwnsChild(userID, childId);
            if (!owns) return res.status(403).json({ error: "Forbidden: parent does not own this child" });
            parentView = true;
        } else if (userRole === "teacher" || userRole === "coach") {
            const teaches = await assertTeacherOfChild(userID, childId);
            if (!teaches) return res.status(403).json({ error: "Forbidden: not linked to this student" });
            parentView = false
        } else {
            return res.status(403).json({ error: "Forbidden: role must be parent or teacher" });
        }

        const visibleFilter = parentView ? "gc.visible_to_parent = TRUE" : "TRUE";

        const rows = await db.any(
            `
      SELECT
        gc.id,
        gc.created_at,
        gc.title,
        gc.body,
        gc.author_role,
        gc.visible_to_parent,
        gc.subject_name,
        a.name        AS activity_name,
        clz.classname,
        u.fname       AS author_fname,
        u.lname       AS author_lname,
        lbl.label_id,
        lbl.name      AS label_name,
        lbl.color     AS label_color
      FROM general_comments gc
      LEFT JOIN comment_labels lbl ON gc.label_id = lbl.label_id
      LEFT JOIN activities     a   ON gc.activityid = a.activityid
      LEFT JOIN classes        clz ON gc.classid    = clz.classid
      LEFT JOIN users          u   ON gc.author_userid = u.userid
      WHERE
        gc.childid = $1
        AND gc.termid = $2
        AND ${visibleFilter}
        AND gc.deleted_at IS NULL
        AND ($3::text IS NULL OR gc.author_role = $3)
        AND ($4::int  IS NULL OR gc.label_id = $4)
        AND (
              $5::text IS NULL OR $5 = 'term'
              OR gc.created_at >= CASE
                    WHEN $5 = 'week'  THEN date_trunc('week',  now())::timestamp
                    WHEN $5 = 'month' THEN date_trunc('month', now())::timestamp
                    ELSE now()
                 END
            )
        AND ($6::text IS NULL OR (gc.title ILIKE '%'||$6||'%' OR gc.body ILIKE '%'||$6||'%'))
      ORDER BY gc.created_at DESC
      `,
            [
                childId,
                termId,
                role || null,
                labelId ? Number(labelId) : null,
                preset || null,
                q || null,
            ]
        );

        res.json(rows);
    } catch (err) {
        console.error("p-comments list error:", err);
        res.status(500).json({ error: "Failed to load comments" });
    }
});

export default router;
