import express from "express";
import db from "../db.js";

const router = express.Router();

function requireLogin(req, res, next) {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Not logged in" });
    }
    next();
}

// routes/academics.js
router.get("/overview/:childId/:termId", requireLogin, async (req, res) => {
    const { childId, termId } = req.params;

    try {
        // 1. Get subject averages for this child + class
        const subjects = await db.any(`
            SELECT g.subject,
                   ROUND(AVG(g.score / g.max_score * 100), 1) AS child_avg,
                   ROUND(AVG(cg.score / cg.max_score * 100), 1) AS class_avg
            FROM grades g
            JOIN childclasses cc ON cc.childid = g.childid AND cc.classid = g.classid
            JOIN classes cl ON cl.classid = g.classid
            JOIN grades cg ON cg.classid = g.classid AND cg.termid = g.termid AND cg.subject = g.subject
            WHERE g.childid = $1
              AND g.termid = $2
            GROUP BY g.subject
            ORDER BY g.subject
        `, [childId, termId]);

        // 2. Get recent assessments
        const recentAssessments = await db.any(`
            SELECT date_entered AS date,
                   subject,
                   assessment_name AS name,
                   assessment_label,
                   score,
                   max_score,
                   ROUND(score / max_score * 100, 1) AS pct
            FROM grades
            WHERE childid = $1
              AND termid = $2
            ORDER BY date_entered DESC
            LIMIT 8
        `, [childId, termId]);

        // 3. Calculate highlights
        let highlights = [];

        // ⚠️ Subjects below 50%
        const lowSubjects = subjects.filter(s => s.child_avg < 50);
        lowSubjects.forEach(s => {
            highlights.push({ type: "warning", message: `${s.subject} below 50%` });
        });

        // ✅ Most improved (compare with previous term)
        const prevTerm = await db.oneOrNone(`
            SELECT termid
            FROM terms
            WHERE start_date < (SELECT start_date FROM terms WHERE termid = $1)
            ORDER BY start_date DESC
            LIMIT 1
        `, [termId]);

        if (prevTerm) {
            const prevData = await db.any(`
                SELECT subject,
                       ROUND(AVG(score / max_score * 100), 1) AS avg_pct
                FROM grades
                WHERE childid = $1
                  AND termid = $2
                GROUP BY subject
            `, [childId, prevTerm.termid]);

            let improvements = [];
            subjects.forEach(curr => {
                const prev = prevData.find(p => p.subject === curr.subject);
                if (prev) {
                    const diff = curr.child_avg - prev.avg_pct;
                    if (diff > 0) {
                        improvements.push({ subject: curr.subject, diff });
                    }
                }
            });
            if (improvements.length > 0) {
                const mostImproved = improvements.sort((a, b) => b.diff - a.diff)[0];
                highlights.push({ type: "success", message: `Most improved: ${mostImproved.subject}` });
            }
        }

        // 🏆 Best subject this term
        if (subjects.length > 0) {
            const best = subjects.sort((a, b) => b.child_avg - a.child_avg)[0];
            highlights.push({ type: "info", message: `Best subject: ${best.subject}` });
        }

        res.json({
            subjects,
            recent_assessments: recentAssessments,
            highlights
        });

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
             ROUND((score / NULLIF(max_score,0)) * 100, 2) AS pct,
             score,
             max_score AS max
      FROM grades
      WHERE childid = $1 AND termid = $2 AND subject = $3
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
        const topics = await db.any(
            `
      SELECT subject,
             assessment_label AS topic,
             ROUND(AVG(score / NULLIF(max_score,0)) * 100, 2) AS avg_pct
      FROM grades
      WHERE childid = $1 AND termid = $2 AND assessment_label IS NOT NULL
      GROUP BY subject, topic
      ORDER BY subject, avg_pct DESC
      `,
            [childId, termId]
        );

        const grouped = {};
        topics.forEach(t => {
            if (!grouped[t.subject]) grouped[t.subject] = [];
            grouped[t.subject].push(t);
        });

        const result = Object.entries(grouped).map(([subject, arr]) => ({
            subject,
            best: arr[0],
            worst: arr[arr.length - 1]
        }));

        res.json(result);

    } catch (err) {
        console.error("Error fetching topics:", err);
        res.status(500).json({ error: "Failed to fetch topics" });
    }
});

export default router;
