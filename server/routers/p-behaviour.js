import express from "express";
import db from "../db.js";

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session?.userID) return res.status(401).json({ error: "Not logged in" });
  next();
}

/** Parent owns this child */
async function assertParentOwnsChild(parentUserID, childId) {
  const row = await db.oneOrNone(
    `SELECT 1 FROM children WHERE childid = $1 AND parentid = $2`,
    [childId, parentUserID]
  );
  return !!row;
}

/** Teacher is linked to ANY class the child is in (class teacher or subject teacher) */
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
    ) AS ok
    `,
    [childId, teacherUserID]
  );
  return !!r.ok;
}

/** Gate: allow parents (their child) and teachers (linked to the child) */
async function assertViewer(req, childId) {
  const userID = req.session.userID;
  const role = (req.session.userRole || "").toString().trim().toLowerCase();

  if (role === "parent") {
    const owns = await assertParentOwnsChild(userID, childId);
    return owns ? { allowed: true, who: role } : { allowed: false, who: role, reason: "not your child" };
  }
  if (role === "teacher") {
    const teaches = await assertTeacherOfChild(userID, childId);
    return teaches ? { allowed: true, who: role } : { allowed: false, who: role, reason: "not linked to this student" };
  }
  return { allowed: false, who: role || "unknown", reason: "role not permitted" };
}

/**
 * GET /p-behaviour/:childId/:termId/series?source=all|class|subject&subject=<text>
 * Returns one row per week with averaged scores over the selected source,
 * plus an `entries` array listing the individual teacher ratings + notes.
 */
router.get("/:childId/:termId/series", requireLogin, async (req, res) => {
  const { childId, termId } = req.params;
  const source = (req.query.source || "all").toLowerCase(); // all | class | subject
  const subject = (req.query.subject || "").trim();         // optional subject "Math", "English", etc.

  try {
    const gate = await assertViewer(req, childId);
    if (!gate.allowed) return res.status(403).json({ error: `Forbidden: ${gate.reason}` });

    const params = [childId, termId, source, subject ? `%${subject}%` : null];

    const rows = await db.any(
      `
      WITH e AS (
        SELECT
          to_char(b.week_start_date, 'YYYY-MM-DD')               AS week_ymd,
          b.focus_engagement::float                              AS focus,
          b.respect_kindness::float                              AS respect,
          b.self_management::float                               AS self,
          b.weekly_note                                          AS weekly_note,
          b.recorded_by,
          (u.fname || ' ' || u.lname)                            AS teacher_name,
          /* derive subject/role for THIS child’s class */
          COALESCE(
            (
              SELECT uc.role
              FROM userclasses uc
              JOIN childclasses cc ON cc.classid = uc.classid
              WHERE cc.childid = b.child_id AND uc.userid = b.recorded_by
              ORDER BY CASE WHEN uc.role ILIKE '%Class Teacher%' THEN 0 ELSE 1 END, uc.role
              LIMIT 1
            ),
            /* fallback */
            CASE WHEN EXISTS (
              SELECT 1
              FROM childclasses cc
              JOIN classes cls ON cls.classid = cc.classid
              WHERE cc.childid = b.child_id AND cls.classteacher = b.recorded_by
            )
            THEN 'Class Teacher' ELSE 'Subject Teacher' END
          )                                                     AS subject_name,
          /* quick flag for source filtering */
          EXISTS (
            SELECT 1
            FROM childclasses cc
            JOIN classes cls ON cls.classid = cc.classid
            WHERE cc.childid = b.child_id AND cls.classteacher = b.recorded_by
          )                                                     AS is_class_teacher
        FROM behaviour b
        JOIN users u ON u.userid = b.recorded_by
        WHERE b.child_id = $1 AND b.term_id = $2
      ),
      filtered AS (
        SELECT *
        FROM e
        WHERE
          CASE
            WHEN $3 = 'class'   THEN is_class_teacher
            WHEN $3 = 'subject' THEN NOT is_class_teacher
            ELSE TRUE
          END
          AND ($4::text IS NULL OR subject_name ILIKE $4)
      ),
      agg AS (
        SELECT
          week_ymd,
          ROUND(AVG(focus)::numeric,   2)::float AS focus,
          ROUND(AVG(respect)::numeric, 2)::float AS respect,
          ROUND(AVG(self)::numeric,    2)::float AS self,
          COUNT(*)                                AS raters,
          json_agg(
            json_build_object(
              'teacher_id',   recorded_by,
              'teacher_name', teacher_name,
              'subject_name', subject_name,
              'focus',        focus,
              'respect',      respect,
              'self',         self,
              'weekly_note',  weekly_note
            )
            ORDER BY teacher_name
          ) AS entries
        FROM filtered
        GROUP BY week_ymd
        ORDER BY week_ymd ASC
      )
      SELECT
        week_ymd,
        focus,
        respect,
        self,
        ROUND(((focus + respect + self)/3.0)::numeric, 2)::float AS overall,
        raters,
        entries
      FROM agg
      ORDER BY week_ymd ASC
      `
      ,
      params
    );

    // Also compute simple topline stats here for convenience
    const week_count = rows.length;
    const focus_avg = week_count ? +(rows.reduce((s, r) => s + (r.focus ?? 0), 0) / week_count).toFixed(2) : 0;
    const respect_avg = week_count ? +(rows.reduce((s, r) => s + (r.respect ?? 0), 0) / week_count).toFixed(2) : 0;
    const self_avg = week_count ? +(rows.reduce((s, r) => s + (r.self ?? 0), 0) / week_count).toFixed(2) : 0;
    const overall_avg = week_count ? +(rows.reduce((s, r) => s + (r.overall ?? 0), 0) / week_count).toFixed(2) : 0;

    res.json({
      week_count,
      overall_avg,
      focus_avg,
      respect_avg,
      self_avg,
      weekly_scores: rows
    });
  } catch (err) {
    console.error("p-behaviour series error:", err);
    res.status(500).json({ error: "Failed to load behaviour series" });
  }
});

/**
 * GET /p-behaviour/:childId/:termId/summary?source=all|class|subject&subject=<text>
 * Term-level averages and simple trend (first 3 vs last 3 weeks) for the selected source.
 */
router.get("/:childId/:termId/summary", requireLogin, async (req, res) => {
  const { childId, termId } = req.params;
  const source = (req.query.source || "all").toLowerCase();
  const subject = (req.query.subject || "").trim();

  try {
    const gate = await assertViewer(req, childId);
    if (!gate.allowed) return res.status(403).json({ error: `Forbidden: ${gate.reason}` });

    const params = [childId, termId, source, subject ? `%${subject}%` : null];

    const summary = await db.oneOrNone(
      `
      WITH e AS (
        SELECT
          to_char(b.week_start_date, 'YYYY-MM-DD') AS wk,
          b.focus_engagement::numeric              AS f,
          b.respect_kindness::numeric              AS r,
          b.self_management::numeric               AS m,
          EXISTS (
            SELECT 1
            FROM childclasses cc
            JOIN classes cls ON cls.classid = cc.classid
            WHERE cc.childid = b.child_id AND cls.classteacher = b.recorded_by
          ) AS is_class_teacher,
          COALESCE(
            (
              SELECT uc.role
              FROM userclasses uc
              JOIN childclasses cc ON cc.classid = uc.classid
              WHERE cc.childid = b.child_id AND uc.userid = b.recorded_by
              ORDER BY CASE WHEN uc.role ILIKE '%Class Teacher%' THEN 0 ELSE 1 END, uc.role
              LIMIT 1
            ),
            'Subject Teacher'
          ) AS subject_name
        FROM behaviour b
        WHERE b.child_id = $1 AND b.term_id = $2
      ),
      f AS (
        SELECT *
        FROM e
        WHERE
          CASE
            WHEN $3 = 'class'   THEN is_class_teacher
            WHEN $3 = 'subject' THEN NOT is_class_teacher
            ELSE TRUE
          END
          AND ($4::text IS NULL OR subject_name ILIKE $4)
      ),
      weekly AS (
        SELECT
          wk,
          AVG(f) AS f,
          AVG(r) AS r,
          AVG(m) AS m,
          (AVG(f) + AVG(r) + AVG(m))/3.0 AS overall
        FROM f
        GROUP BY wk
        ORDER BY wk ASC
      ),
      first3 AS (SELECT * FROM weekly ORDER BY wk ASC  LIMIT 3),
      last3  AS (SELECT * FROM weekly ORDER BY wk DESC LIMIT 3)
      SELECT
        (SELECT COUNT(*)         FROM weekly)                   AS week_count,
        ROUND((SELECT AVG(overall) FROM weekly)::numeric, 2)    AS overall_avg,
        ROUND((SELECT AVG(f)       FROM weekly)::numeric, 2)    AS focus_avg,
        ROUND((SELECT AVG(r)       FROM weekly)::numeric, 2)    AS respect_avg,
        ROUND((SELECT AVG(m)       FROM weekly)::numeric, 2)    AS self_avg,

        ROUND((SELECT AVG(overall) FROM first3)::numeric, 2)    AS first3_overall,
        ROUND((SELECT AVG(overall) FROM last3 )::numeric, 2)    AS last3_overall,
        ROUND((SELECT AVG(f)       FROM first3)::numeric, 2)    AS first3_focus,
        ROUND((SELECT AVG(f)       FROM last3 )::numeric, 2)    AS last3_focus,
        ROUND((SELECT AVG(r)       FROM first3)::numeric, 2)    AS first3_respect,
        ROUND((SELECT AVG(r)       FROM last3 )::numeric, 2)    AS last3_respect,
        ROUND((SELECT AVG(m)       FROM first3)::numeric, 2)    AS first3_self,
        ROUND((SELECT AVG(m)       FROM last3 )::numeric, 2)    AS last3_self,

        (SELECT MIN(wk) FROM weekly) AS start_week,
        (SELECT MAX(wk) FROM weekly) AS end_week
      `,
      params
    );

    res.json(summary || {});
  } catch (e) {
    console.error("p-behaviour summary error:", e);
    res.status(500).json({ error: "Failed to load behaviour summary" });
  }
});

export default router;
