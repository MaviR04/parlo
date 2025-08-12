// /routes/p-behaviour.js
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
 * GET /p-behaviour/:childId/:termId/series
 * Weekly time series for behaviour (1–3 scale per pillar).
 * Returns rows sorted by week_start_date ASC.
 */
router.get("/:childId/:termId/series", requireLogin, async (req, res) => {
  const { childId, termId } = req.params;

  try {
    const rows = await db.any(
      `
      SELECT 
        week_start_date::date AS week,
        focus_engagement::float AS focus,
        respect_kindness::float AS respect,
        self_management::float AS self,
        ROUND(((focus_engagement + respect_kindness + self_management) / 3.0)::numeric, 2)::float AS overall
      FROM behaviour
      WHERE child_id = $1 AND term_id = $2
      ORDER BY week_start_date ASC
      `,
      [childId, termId]
    );

    if (!rows.length) {
      return res.json({
        week_count: 0,
        overall_avg: 0,
        focus_avg: 0,
        respect_avg: 0,
        self_avg: 0,
        weekly_scores: []
      });
    }

    const week_count = rows.length;
    const overall_avg = rows.reduce((sum, w) => sum + w.overall, 0) / week_count;
    const focus_avg = rows.reduce((sum, w) => sum + w.focus, 0) / week_count;
    const respect_avg = rows.reduce((sum, w) => sum + w.respect, 0) / week_count;
    const self_avg = rows.reduce((sum, w) => sum + w.self, 0) / week_count;

    const first_avg = rows[0].overall;
    const last_avg = rows[rows.length - 1].overall;

    res.json({
      week_count,
      overall_avg,
      focus_avg,
      respect_avg,
      self_avg,
      first_avg,
      last_avg,
      weekly_scores: rows
    });
  } catch (err) {
    console.error("p-behaviour series error:", err);
    res.status(500).json({ error: "Failed to load behaviour series" });
  }
});



/**
 * GET /p-behaviour/:childId/:termId/summary
 * Term-level averages and simple trend (first 3 vs last 3 weeks).
 */
router.get("/:childId/:termId/summary", requireLogin, async (req, res) => {
    try {
        const { childId, termId } = req.params;

        const gate = await assertViewer(req, childId);
        if (!gate.allowed) return res.status(403).json({ error: `Forbidden: ${gate.reason}` });

        const summary = await db.oneOrNone(
            `
      WITH s AS (
        SELECT
          week_start_date::date                        AS wk,
          focus_engagement::numeric                    AS f,
          respect_kindness::numeric                    AS r,
          self_management::numeric                     AS m,
          (focus_engagement + respect_kindness + self_management)/3.0 AS overall
        FROM behaviour
        WHERE child_id = $1 AND term_id = $2
        ORDER BY week_start_date ASC
      ),
      first3 AS (SELECT * FROM s ORDER BY wk ASC  LIMIT 3),
      last3  AS (SELECT * FROM s ORDER BY wk DESC LIMIT 3)
      SELECT
        (SELECT COUNT(*)         FROM s)               AS week_count,
        ROUND((SELECT AVG(overall) FROM s)::numeric, 2) AS overall_avg,
        ROUND((SELECT AVG(f)       FROM s)::numeric, 2) AS focus_avg,
        ROUND((SELECT AVG(r)       FROM s)::numeric, 2) AS respect_avg,
        ROUND((SELECT AVG(m)       FROM s)::numeric, 2) AS self_avg,

        ROUND((SELECT AVG(overall) FROM first3)::numeric, 2) AS first3_overall,
        ROUND((SELECT AVG(overall) FROM last3 )::numeric, 2) AS last3_overall,
        ROUND((SELECT AVG(f)       FROM first3)::numeric, 2) AS first3_focus,
        ROUND((SELECT AVG(f)       FROM last3 )::numeric, 2) AS last3_focus,
        ROUND((SELECT AVG(r)       FROM first3)::numeric, 2) AS first3_respect,
        ROUND((SELECT AVG(r)       FROM last3 )::numeric, 2) AS last3_respect,
        ROUND((SELECT AVG(m)       FROM first3)::numeric, 2) AS first3_self,
        ROUND((SELECT AVG(m)       FROM last3 )::numeric, 2) AS last3_self,

        (SELECT MIN(wk) FROM s) AS start_week,
        (SELECT MAX(wk) FROM s) AS end_week
      `,
            [childId, termId]
        );

        res.json(summary || {});
    } catch (e) {
        console.error("p-behaviour summary error:", e);
        res.status(500).json({ error: "Failed to load behaviour summary" });
    }
});

export default router;
