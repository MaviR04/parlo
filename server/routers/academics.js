import express from "express";
import db from "../db.js";

const router = express.Router();

function requireLogin(req, res, next) {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Not logged in" });
    }
    next();
}

// 1) OVERVIEW TAB
router.get("/overview/:childId/:termId", requireLogin, async (req, res) => {
  const { childId, termId } = req.params;

  try {
    // Subject averages for this child vs class (this term)
    const subjects = await db.any(
      `
      SELECT g.subject,
             ROUND(AVG(g.score / g.max_score * 100), 1) AS child_avg,
             ROUND(AVG(cg.score / cg.max_score * 100), 1) AS class_avg
      FROM grades g
      JOIN childclasses cc ON cc.childid = g.childid AND cc.classid = g.classid
      JOIN classes cl ON cl.classid = g.classid
      JOIN grades cg ON cg.classid = g.classid AND cg.termid = g.termid AND cg.subject = g.subject
      WHERE g.childid = $1
        AND g.termid  = $2
      GROUP BY g.subject
      ORDER BY g.subject
      `,
      [childId, termId]
    );

    // Recent assessments -> include comment + alias max_score as "max"
    const recent_assessments = await db.any(
      `
      SELECT date_entered AS date,
             subject,
             assessment_name AS name,
             assessment_label,
             comment,                 -- include comment
             score,
             max_score AS max,        -- alias for frontend
             ROUND(score / max_score * 100, 1) AS pct
      FROM grades
      WHERE childid = $1
        AND termid  = $2
      ORDER BY date_entered DESC
      LIMIT 8
      `,
      [childId, termId]
    );

    // Build insight banners
    const insights = [];

    // Warn any subject below 50%
    const lowSubjects = subjects.filter((s) => parseFloat(s.child_avg) < 50);
    lowSubjects.forEach((s) =>
      insights.push({ type: "warning", message: `${s.subject} below 50%` })
    );

    // Previous term → "Most improved"
    const prevTerm = await db.oneOrNone(
      `
      SELECT termid
      FROM terms
      WHERE start_date < (SELECT start_date FROM terms WHERE termid = $1)
      ORDER BY start_date DESC
      LIMIT 1
      `,
      [termId]
    );

    if (prevTerm) {
      const prevData = await db.any(
        `
        SELECT subject,
               ROUND(AVG(score / max_score * 100), 1) AS avg_pct
        FROM grades
        WHERE childid = $1
          AND termid  = $2
        GROUP BY subject
        `,
        [childId, prevTerm.termid]
      );

      const improvements = [];
      subjects.forEach((curr) => {
        const prev = prevData.find((p) => p.subject === curr.subject);
        if (prev) {
          const diff =
            parseFloat(curr.child_avg) - parseFloat(prev.avg_pct);
          if (diff > 0) improvements.push({ subject: curr.subject, diff });
        }
      });

      if (improvements.length > 0) {
        const mostImproved = improvements.sort((a, b) => b.diff - a.diff)[0];
        insights.push({
          type: "success",
          message: `Most improved: ${mostImproved.subject}`,
        });
      }
    }

    // Best subject (highest avg)
    if (subjects.length > 0) {
      const best = [...subjects].sort(
        (a, b) => parseFloat(b.child_avg) - parseFloat(a.child_avg)
      )[0];
      insights.push({ type: "info", message: `Best subject: ${best.subject}` });
    }

    // ✅ Worst subject (lowest avg)
    if (subjects.length > 0) {
      const worst = [...subjects].sort(
        (a, b) => parseFloat(a.child_avg) - parseFloat(b.child_avg)
      )[0];
      insights.push({ type: "alert", message: `Needs support: ${worst.subject}` });
    }

    res.json({ subjects, recent_assessments, insights });
  } catch (err) {
    console.error("Error fetching overview:", err);
    res.status(500).json({ error: "Failed to load academic overview" });
  }
});


/**
 * 2. SUBJECT DRILL-DOWN TAB
 */
router.get("/subject-drilldown/:childId/:termId", requireLogin, async (req, res) => {
    const { childId, termId } = req.params;
    const { subject } = req.query;

    try {
        // Child's series
        const childSeries = await db.any(
  `
  SELECT date_entered::date AS date,
         assessment_name AS name,
         assessment_label,
         comment,                                  -- include comment
         ROUND((score / NULLIF(max_score,0)) * 100, 2) AS pct,
         score,
         max_score AS max
  FROM grades
  WHERE childid = $1
    AND termid  = $2
    AND subject = $3
  ORDER BY date_entered ASC
  `,
  [childId, termId, subject]
);

        // Class average series
        const classRow = await db.oneOrNone(
            `SELECT classid FROM childclasses WHERE childid=$1 LIMIT 1`,
            [childId]
        );
        if (!classRow) {
            return res.status(404).json({ error: "No class found for this child" });
        }
        const { classid } = classRow;

        const classSeries = await db.any(
            `
      SELECT date_entered::date AS date,
             ROUND(AVG(score / NULLIF(max_score,0)) * 100, 2) AS class_pct
      FROM grades
      WHERE classid = $1 AND termid = $2 AND subject = $3
      GROUP BY date
      ORDER BY date ASC
      `,
            [classid, termId, subject]
        );

        res.json({ childSeries, classSeries });

    } catch (err) {
        console.error("Error fetching subject drilldown:", err);
        res.status(500).json({ error: "Failed to fetch subject drilldown" });
    }
});

/**
 * 3. CLASS POSITION TAB
 */

// GET /academics/class-position/:childId/:termId
router.get("/class-position/:childId/:termId", async (req, res) => {
    const { childId, termId } = req.params;

    try {
        // 1. Find the classid for this child in this term
        const classResult = await db.oneOrNone(
            `SELECT DISTINCT classid 
             FROM grades
             WHERE childid = $1 AND termid = $2`,
            [childId, termId]
        );

        if (!classResult) {
            return res.status(404).json({ error: "No class found for child/term" });
        }

        const classId = classResult.classid;

        // 2. Get all students in this class + term with their averages
        const studentAverages = await db.any(
            `SELECT childid,
                    ROUND(AVG((score / max_score) * 100), 2) AS avg_pct
             FROM grades
             WHERE classid = $1 AND termid = $2
             GROUP BY childid
             ORDER BY avg_pct DESC`,
            [classId, termId]
        );

        // 3. Determine position and distribution
        const distribution = studentAverages.map(s => parseFloat(s.avg_pct));
        const totalStudents = distribution.length;
        const studentIndex = studentAverages.findIndex(s => s.childid == childId);

        res.json({
            distribution,
            position: studentIndex + 1,
            total_students: totalStudents,
            student_avg: distribution[studentIndex],
            class_avg: (
                distribution.reduce((a, b) => a + b, 0) / totalStudents
            ).toFixed(2)
        });

    } catch (err) {
        console.error("Error fetching class position:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * 4. TOPICS TAB
 */
router.get("/topics/:childId/:termId", requireLogin, async (req, res) => {
  const { childId, termId } = req.params;

  try {
    const rows = await db.any(
      `
      SELECT
        subject,
        assessment_label AS topic,
        ROUND(AVG(score / NULLIF(max_score,0) * 100), 1) AS avg_pct,
        COUNT(*) AS attempts,
        MAX(date_entered)::date AS last_date
      FROM grades
      WHERE childid = $1
        AND termid  = $2
        AND assessment_label IS NOT NULL
      GROUP BY subject, topic
      ORDER BY subject, topic
      `,
      [childId, termId]
    );

    const bucket = (pct) => (pct < 60 ? "needs_support" : pct < 75 ? "on_track" : "strong");

    const bySubject = new Map();
    for (const r of rows) {
      const pct = Number(r.avg_pct);
      const s = r.subject;
      if (!bySubject.has(s)) {
        bySubject.set(s, {
          subject: s,
          strong: [],
          on_track: [],
          needs_support: [],
          counts: { strong: 0, on_track: 0, needs_support: 0 },
        });
      }
      const item = {
        topic: r.topic,
        avg_pct: pct,
        attempts: Number(r.attempts),
        last_date: r.last_date,
      };
      const b = bucket(pct);
      bySubject.get(s)[b].push(item);
      bySubject.get(s).counts[b]++;
    }

    // Sort within buckets (parents see best/worst first)
    for (const subj of bySubject.values()) {
      subj.strong.sort((a, b) => b.avg_pct - a.avg_pct);
      subj.on_track.sort((a, b) => b.avg_pct - a.avg_pct);
      subj.needs_support.sort((a, b) => a.avg_pct - b.avg_pct);
    }

    const subjects = Array.from(bySubject.values());
    const overall = subjects.reduce(
      (acc, s) => ({
        strong: acc.strong + s.counts.strong,
        on_track: acc.on_track + s.counts.on_track,
        needs_support: acc.needs_support + s.counts.needs_support,
      }),
      { strong: 0, on_track: 0, needs_support: 0 }
    );

    res.json({ subjects, overall });
  } catch (err) {
    console.error("Error fetching topics:", err);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

export default router;
