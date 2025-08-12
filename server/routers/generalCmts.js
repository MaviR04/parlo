// routers/generalCmts.js
import express from "express";
import db from "../db.js";

const router = express.Router();

/* --------------------- auth --------------------- */
function requireLogin(req, res, next) {
    if (!req.session?.userID) return res.status(401).json({ error: "Not logged in" });
    next();
}

/* --------------------- tiny helpers --------------------- */
const BAD_WORDS = ["idiot", "stupid", "dumb"]; // extend as needed
const clean = (s) => (s || "").trim();
const badLang = (t) => BAD_WORDS.some((w) => String(t || "").toLowerCase().includes(w));

/** Extracts "History" from "History Teacher" */
function subjectFromRole(roleText) {
    if (!roleText) return null;
    const m = String(roleText).match(/^(.+?)\s*Teacher$/i);
    return m ? m[1].trim() : null;
}

/* --------------------- scope checks --------------------- */
async function childInClass(childid, classid) {
    const r = await db.oneOrNone(
        `SELECT 1 FROM childclasses WHERE childid=$1 AND classid=$2 LIMIT 1`,
        [childid, classid]
    );
    return !!r;
}

async function childInActivity(childid, activityid) {
    const r = await db.oneOrNone(
        `SELECT 1 FROM activity_enrollments WHERE childid=$1 AND activityid=$2 AND status='Active' LIMIT 1`,
        [childid, activityid]
    );
    return !!r;
}

async function isClassTeacherOfClass(userID, classid) {
    const r = await db.oneOrNone(
        `SELECT 1 FROM classes WHERE classid=$1 AND classteacher=$2 LIMIT 1`,
        [classid, userID]
    );
    return !!r;
}

async function isSubjectTeacherOfClassAndSubject(userID, classid, subjectName) {
    const rows = await db.any(
        `SELECT role FROM userclasses WHERE userid=$1 AND classid=$2`,
        [userID, classid]
    );
    const want = (subjectName || "").toLowerCase().trim();
    return rows.some(
        (r) => (subjectFromRole(r.role) || "").toLowerCase().trim() === want
    );
}

async function isCoachOfActivity(userID, activityid) {
    const r = await db.oneOrNone(
        `SELECT 1 FROM activity_assignments WHERE coachid=$1 AND activityid=$2 LIMIT 1`,
        [userID, activityid]
    );
    return !!r;
}

/* Build WHERE and params for list with RBAC scope */
async function buildScopeWhere(user, base = []) {
    const where = [...base];
    const params = [];
    const p = (v) => { params.push(v); return `$${params.length}`; };

    // Classes visible (class teacher or subject teacher)
    const classTeacher = await db.any(
        `SELECT classid FROM classes WHERE classteacher=$1`,
        [user.userID]
    );
    const subjectTeacher = await db.any(
        `SELECT DISTINCT classid FROM userclasses WHERE userid=$1`,
        [user.userID]
    );
    const classIds = Array.from(
        new Set([...classTeacher, ...subjectTeacher].map((r) => r.classid))
    );

    // Activities visible (coach)
    const coachActs = await db.any(
        `SELECT activityid FROM activity_assignments WHERE coachid=$1`,
        [user.userID]
    );
    const actIds = coachActs.map((r) => r.activityid);

    const scope = [];
    if (classIds.length) scope.push(`gc.classid = ANY(${p(classIds)})`);
    if (actIds.length) scope.push(`gc.activityid = ANY(${p(actIds)})`);

    if (user.role === "admin") {
        // admin sees all
    } else if (user.role === "parent") {
        where.push(`gc.visible_to_parent = TRUE`);
        // single-guardian mapping; switch to child_parents if you add it
        where.push(`gc.childid IN (SELECT childid FROM children WHERE parentid=${p(user.userID)})`);
    } else {
        if (scope.length) where.push(`(${scope.join(" OR ")})`);
        else where.push(`FALSE`);
    }

    return { where, params, p };
}

/* --------------------- Bootstrap (scope + labels + rosters) --------------------- */
router.get("/bootstrap", requireLogin, async (req, res) => {
    try {
        const u = { userID: req.session.userID, role: req.session.role };

        const labels = await db.any(
            `SELECT label_id, name, color FROM comment_labels ORDER BY name`
        );

        // class teacher classes
        const ctClasses = await db.any(
            `SELECT classid, classname
         FROM classes
        WHERE classteacher=$1
        ORDER BY classname`,
            [u.userID]
        );

        // subject teacher classes + subjects (exclude classes where user is class teacher)
        const stRows = await db.any(
            `SELECT uc.classid, c.classname, uc.role
         FROM userclasses uc
         JOIN classes c ON c.classid = uc.classid
        WHERE uc.userid=$1
        ORDER BY c.classname`,
            [u.userID]
        );
        const stMap = new Map();
        for (const r of stRows) {
            const subj = subjectFromRole(r.role);
            if (!subj) continue;
            if (!stMap.has(r.classid))
                stMap.set(r.classid, { classid: r.classid, classname: r.classname, subjects: new Set() });
            stMap.get(r.classid).subjects.add(subj);
        }
        const ctIds = new Set(ctClasses.map(c => c.classid));
        const stClasses = Array.from(stMap.values())
            .filter(v => !ctIds.has(v.classid))
            .map(v => ({
                classid: v.classid,
                classname: v.classname,
                subjects: Array.from(v.subjects).sort(),
            }));

        // activities I coach
        const activities = await db.any(
            `SELECT a.activityid, a.name, a.category, a.agegroup
         FROM activity_assignments aa
         JOIN activities a ON a.activityid = aa.activityid
        WHERE aa.coachid=$1
        ORDER BY a.category, a.name`,
            [u.userID]
        );

        // children per class
        const classIds = Array.from(new Set([...ctClasses.map(c => c.classid), ...stClasses.map(c => c.classid)]));
        const childrenByClass = {};
        for (const cid of classIds) {
            childrenByClass[cid] = await db.any(
                `SELECT ch.childid, ch.fname, ch.lname
           FROM childclasses cc
           JOIN children ch ON ch.childid = cc.childid
          WHERE cc.classid=$1
          ORDER BY ch.lname, ch.fname`,
                [cid]
            );
        }

        // children per activity
        const childrenByActivity = {};
        for (const a of activities) {
            childrenByActivity[a.activityid] = await db.any(
                `SELECT ch.childid, ch.fname, ch.lname
           FROM activity_enrollments ae
           JOIN children ch ON ch.childid = ae.childid
          WHERE ae.activityid=$1 AND ae.status='Active'
          ORDER BY ch.lname, ch.fname`,
                [a.activityid]
            );
        }

        res.json({
            user: { userID: u.userID, role: u.role },
            labels,
            scope: {
                classTeacher: ctClasses,
                subjectTeacher: stClasses,
                coach: activities,
                childrenByClass,
                childrenByActivity,
            },
        });
    } catch (err) {
        console.error("bootstrap error", err);
        res.status(500).json({ error: "Failed to load scope" });
    }
});

/* --------------------- Labels --------------------- */
router.get("/labels", requireLogin, async (_req, res) => {
    try {
        const rows = await db.any(
            `SELECT label_id, name, color FROM comment_labels ORDER BY name`
        );
        res.json(rows);
    } catch (err) {
        console.error("labels error", err);
        res.status(500).json({ error: "Failed to load labels" });
    }
});

/* --------------------- List comments --------------------- */
router.get("/", requireLogin, async (req, res) => {
    try {
        const u = { userID: req.session.userID, role: req.session.role };
        const { termid, childid, source, label_id, mine, q, limit = 20, offset = 0 } = req.query;

        const { where, params, p } = await buildScopeWhere(u, [`gc.deleted_at IS NULL`]);
        if (termid) where.push(`gc.termid = ${p(termid)}`);
        if (childid) where.push(`gc.childid = ${p(childid)}`);
        if (source) where.push(`gc.author_role = ${p(source)}`);
        if (label_id) where.push(`gc.label_id = ${p(label_id)}`);
        if (mine === "true") where.push(`gc.author_userid = ${p(u.userID)}`);
        if (q) {
            const like = `%${q}%`;
            where.push(`(gc.title ILIKE ${p(like)} OR gc.body ILIKE ${p(like)})`);
        }

        const sql = `
      SELECT gc.*,
             au.fname AS author_fname, au.lname AS author_lname,
             ch.fname AS child_fname, ch.lname AS child_lname,
             c.classname,
             act.name AS activity_name
      FROM general_comments gc
      JOIN users au       ON au.userid = gc.author_userid
      JOIN children ch    ON ch.childid = gc.childid
      LEFT JOIN classes c ON c.classid  = gc.classid
      LEFT JOIN activities act ON act.activityid = gc.activityid
      WHERE ${where.join(" AND ")}
      ORDER BY gc.created_at DESC
      LIMIT ${p(Number(limit))} OFFSET ${p(Number(offset))}
    `;
        const rows = await db.any(sql, params);
        res.json(rows);
    } catch (err) {
        console.error("list general-comments error", err);
        res.status(500).json({ error: "Failed to fetch comments" });
    }
});

/* --------------------- My comments shortcut --------------------- */
router.get("/mine", requireLogin, async (req, res) => {
    try {
        const u = { userID: req.session.userID };
        const { termid, label_id, q, limit = 20, offset = 0 } = req.query;

        const where = [`gc.deleted_at IS NULL`, `gc.author_userid = $1`];
        const params = [u.userID];

        if (termid) { params.push(termid); where.push(`gc.termid = $${params.length}`); }
        if (label_id) { params.push(label_id); where.push(`gc.label_id = $${params.length}`); }
        if (q) {
            params.push(`%${q}%`, `%${q}%`);
            where.push(`(gc.title ILIKE $${params.length - 1} OR gc.body ILIKE $${params.length})`);
        }
        params.push(Number(limit), Number(offset));

        const rows = await db.any(
            `SELECT gc.*,
              au.fname AS author_fname, au.lname AS author_lname,
              ch.fname AS child_fname, ch.lname AS child_lname,
              c.classname,
              act.name AS activity_name
         FROM general_comments gc
         JOIN users au       ON au.userid = gc.author_userid
         JOIN children ch    ON ch.childid = gc.childid
    LEFT JOIN classes c ON c.classid  = gc.classid
    LEFT JOIN activities act ON act.activityid = gc.activityid
        WHERE ${where.join(" AND ")}
        ORDER BY gc.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error("mine general-comments error", err);
        res.status(500).json({ error: "Failed to fetch my comments" });
    }
});

/* --------------------- Create comment --------------------- */
router.post("/", requireLogin, async (req, res) => {
    try {
        const u = { userID: req.session.userID, role: req.session.role };
        const {
            childid, termid, label_id, title, body,
            visible_to_parent = true,
            classid, subject_name, activityid
        } = req.body;

        if (!childid || !termid || !body) {
            return res.status(400).json({ error: "childid, termid, body are required" });
        }
        const text = clean(body);
        if (text.length < 5 || text.length > 2000) {
            return res.status(400).json({ error: "Comment must be 5–2000 characters" });
        }
        if (badLang(text)) {
            return res.status(400).json({ error: "Please rephrase in professional language." });
        }

        // NEW: Only allow posting to the CURRENT term
        const current = await db.oneOrNone(
            `SELECT 1 FROM terms WHERE termid=$1 AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`,
            [termid]
        );
        if (!current) {
            return res.status(400).json({ error: "You can only create comments in the current term." });
        }

        // -------- Optional auto-infer when context omitted --------
        if (!activityid && !classid) {
            const myActs = await db.any(`SELECT activityid FROM activity_assignments WHERE coachid=$1`, [u.userID]);
            if (myActs.length) {
                const rows = await db.any(
                    `SELECT ae.activityid
             FROM activity_enrollments ae
            WHERE ae.childid=$1 AND ae.activityid = ANY($2::int[]) AND ae.status='Active'`,
                    [childid, myActs.map(a => a.activityid)]
                );
                if (rows.length === 1) req.body.activityid = rows[0].activityid;
            }
            if (!req.body.activityid) {
                const myClassIds = await db.any(
                    `SELECT c.classid FROM classes c WHERE c.classteacher=$1
           UNION
           SELECT uc.classid FROM userclasses uc WHERE uc.userid=$1`,
                    [u.userID]
                );
                const ids = myClassIds.map(r => r.classid);
                if (ids.length) {
                    const rows = await db.any(
                        `SELECT cc.classid FROM childclasses cc
              WHERE cc.childid=$1 AND cc.classid = ANY($2::int[])`,
                        [childid, ids]
                    );
                    if (rows.length === 1) {
                        req.body.classid = rows[0].classid;
                        const stRows = await db.any(
                            `SELECT role FROM userclasses WHERE userid=$1 AND classid=$2`,
                            [u.userID, req.body.classid]
                        );
                        const subjects = stRows.map(r => subjectFromRole(r.role)).filter(Boolean);
                        const uniqueSubjects = Array.from(new Set(subjects));
                        const isCT = await isClassTeacherOfClass(u.userID, req.body.classid);
                        if (!isCT && uniqueSubjects.length === 1) {
                            req.body.subject_name = uniqueSubjects[0];
                        }
                    }
                }
            }
        }
        // ----------------------------------------------------------

        let resolvedRole = null;
        let resolvedClassId = req.body.classid || null;
        let resolvedSubject = req.body.subject_name ? clean(req.body.subject_name) : null;
        let resolvedActivityId = req.body.activityid || null;

        // Coach
        if (resolvedActivityId) {
            const okCoach = await isCoachOfActivity(u.userID, resolvedActivityId);
            const okStudent = await childInActivity(childid, resolvedActivityId);
            if (!okCoach || !okStudent) return res.status(403).json({ error: "Not allowed for this activity/student" });
            resolvedRole = "Coach";
        }

        // Subject teacher
        if (!resolvedRole && resolvedClassId && resolvedSubject) {
            const okSubj = await isSubjectTeacherOfClassAndSubject(u.userID, resolvedClassId, resolvedSubject);
            const okStudent = await childInClass(childid, resolvedClassId);
            if (!okSubj || !okStudent) return res.status(403).json({ error: "Not allowed for this class/subject/student" });
            resolvedRole = "SubjectTeacher";
        }

        // Class teacher
        if (!resolvedRole && resolvedClassId && !resolvedSubject) {
            const okClassT = await isClassTeacherOfClass(u.userID, resolvedClassId);
            const okStudent = await childInClass(childid, resolvedClassId);
            if (!okClassT || !okStudent) return res.status(403).json({ error: "Not allowed for this class/student" });
            resolvedRole = "ClassTeacher";
        }

        if (!resolvedRole) {
            return res.status(400).json({ error: "Provide either activityid, or classid (+subject_name for subject teachers) or pick a valid student/context." });
        }

        const row = await db.one(
            `INSERT INTO general_comments
         (childid, termid, author_userid, author_role,
          classid, subject_name, activityid,
          label_id, title, body, visible_to_parent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
            [
                childid, termid, u.userID, resolvedRole,
                resolvedClassId, resolvedSubject, resolvedActivityId,
                label_id || null, clean(title || ""), text, !!visible_to_parent
            ]
        );
        res.status(201).json(row);
    } catch (err) {
        console.error("create general-comment error", err);
        res.status(500).json({ error: "Failed to create comment" });
    }
});

/* --------------------- Update comment --------------------- */
router.patch("/:id", requireLogin, async (req, res) => {
    try {
        const u = { userID: req.session.userID, role: req.session.role };
        const id = Number(req.params.id);
        const { label_id, title, body, visible_to_parent } = req.body;

        const existing = await db.oneOrNone(
            `SELECT * FROM general_comments WHERE id=$1 AND deleted_at IS NULL`,
            [id]
        );
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (existing.author_userid !== u.userID && u.role !== "admin") {
            return res.status(403).json({ error: "Not allowed" });
        }

        let newBody = existing.body;
        if (typeof body === "string") {
            const t = clean(body);
            if (t.length < 5 || t.length > 2000) {
                return res.status(400).json({ error: "Comment must be 5–2000 characters" });
            }
            if (badLang(t)) return res.status(400).json({ error: "Please rephrase in professional language." });
            newBody = t;
        }

        const row = await db.one(
            `UPDATE general_comments
          SET label_id          = COALESCE($2, label_id),
              title             = COALESCE($3, title),
              body              = $4,
              visible_to_parent = COALESCE($5, visible_to_parent),
              updated_at        = NOW()
        WHERE id=$1
        RETURNING *`,
            [id, label_id ?? null, typeof title === "string" ? clean(title) : null, newBody, visible_to_parent]
        );

        res.json(row);
    } catch (err) {
        console.error("update general-comment error", err);
        res.status(500).json({ error: "Failed to update comment" });
    }
});

/* --------------------- Delete comment (soft) --------------------- */
router.delete("/:id", requireLogin, async (req, res) => {
    try {
        const u = { userID: req.session.userID, role: req.session.role };
        const id = Number(req.params.id);

        const existing = await db.oneOrNone(
            `SELECT * FROM general_comments WHERE id=$1 AND deleted_at IS NULL`,
            [id]
        );
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (existing.author_userid !== u.userID && u.role !== "admin") {
            return res.status(403).json({ error: "Not allowed" });
        }

        await db.none(`UPDATE general_comments SET deleted_at = NOW() WHERE id=$1`, [id]);
        res.json({ ok: true });
    } catch (err) {
        console.error("delete general-comment error", err);
        res.status(500).json({ error: "Failed to delete comment" });
    }
});

export default router;
