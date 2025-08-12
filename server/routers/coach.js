import express from "express";
import db from "../db.js";

const router = express.Router();

// 🔐 Middleware: Require login
function requireLogin(req, res, next) {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Not logged in" });
    }
    next();
}

router.get("/activities", requireLogin, async (req, res) => {
    const coachID = req.session.userID;
    console.log("👉 Coach session ID:", coachID);

    const q = `
    SELECT a.* 
    FROM activities a
    JOIN activity_assignments aa ON a.activityID = aa.activityID
    WHERE aa.coachID = $1
  `;
    try {
        const result = await db.any(q, [coachID]); // ✅ use .any here
        console.log("✅ Activities fetched:", result);
        res.json(result);
    } catch (err) {
        console.error("❌ Error:", err);
        res.status(500).json({ error: "Failed to fetch activities" });
    }
});



// ✅ GET /coach/activities/:id/students (Requires login)
router.get("/activities/:id/students", requireLogin, async (req, res) => {
    const activityID = req.params.id;

    const q = `
        SELECT c.childid, c.fname, c.lname
        FROM activity_enrollments ae
        JOIN children c ON ae.childid = c.childid
        WHERE ae.activityid = $1
    `;

    try {
        const result = await db.any(q, [activityID]);
        console.log("📘 Students for activity", activityID, "→", result);
        res.json(result);
    } catch (err) {
        console.error("❌ Error fetching students for activity", activityID, ":", err);
        res.status(500).json({ error: "Failed to fetch students" });
    }
});


router.get("/activities/:id/logs", requireLogin, async (req, res) => {
    const coachID = req.session.userID;
    const activityID = req.params.id;

    const currentDate = new Date();
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
    const week_start = new Date(currentDate.setDate(diff)).toISOString().slice(0, 10);

    try {
        const students = await db.any(`
      SELECT c.childID, c.fname, c.lname, l.comment, l.rating
      FROM activity_enrollments ae
      JOIN children c ON ae.childID = c.childID
      LEFT JOIN activity_logs l 
        ON l.childID = c.childID AND l.activityID = ae.activityID AND l.week_start = $2
      WHERE ae.activityID = $1
    `, [activityID, week_start]);

        res.json({ week_start, students });
    } catch (err) {
        console.error("Error fetching logs:", err);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

// Get term ID based on selected week
router.get("/term-id", requireLogin, async (req, res) => {
    const { week_start } = req.query;
    try {
        const term = await db.oneOrNone(
            `SELECT termid, start_date FROM terms 
       WHERE $1 BETWEEN start_date AND end_date`,
            [week_start]
        );

        if (!term) return res.status(400).json({ error: "Term not found" });

        const startYear = new Date(term.start_date).getFullYear();
        const month = new Date(term.start_date).getMonth();
        const schoolYear = month >= 7 ? `${startYear}-${startYear + 1}` : `${startYear - 1}-${startYear}`;

        res.json({ termid: term.termid, schoolYear });
    } catch (err) {
        console.error("Error fetching term ID:", err);
        res.status(500).json({ error: "Failed to get term ID" });
    }
});

// Save or update activity log
router.post("/activity-log", requireLogin, async (req, res) => {
  const coachID = req.session.userID;
  const { activityID, childID, comment, rating, week_start, termid, type, tagIDs = [] } = req.body;

  try {
    // Re-derive everything server-side for trust
    const term = await db.oneOrNone(
      "SELECT termid, start_date FROM terms WHERE termid = $1",
      [termid]
    );
    if (!term) return res.status(400).json({ error: "Invalid term ID" });

    const start = new Date(term.start_date);
    const y = start.getFullYear();
    const m = start.getMonth(); // 0=Jan
    const schoolYear = (m >= 7) ? `${y}-${y + 1}` : `${y - 1}-${y}`;

    // single upsert writes termid + schoolYear either way
    const upsert = await db.one(
      `
      INSERT INTO activity_logs
        (activityID, childID, coachID, date, week_start, schoolYear, termid, type, comment, rating)
      VALUES
        ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)
      ON CONFLICT (activityID, childID, week_start)
      DO UPDATE SET
        comment = EXCLUDED.comment,
        rating  = EXCLUDED.rating,
        date    = NOW(),
        type    = EXCLUDED.type,
        termid  = EXCLUDED.termid,
        schoolYear = EXCLUDED.schoolYear
      RETURNING id
      `,
      [activityID, childID, coachID, week_start, schoolYear, term.termid, type || "Session", comment, rating]
    );

    const logID = upsert.id;

    // refresh tags
    await db.none(`DELETE FROM activity_log_tags WHERE logID = $1`, [logID]);
    for (const tagID of (tagIDs || [])) {
      await db.none(`INSERT INTO activity_log_tags (logID, tagID) VALUES ($1, $2)`, [logID, tagID]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving log:", err);
    res.status(500).json({ error: "Failed to save log with tags" });
  }
});


router.get("/activity-tags", requireLogin, async (req, res) => {
    try {
        const tags = await db.any("SELECT * FROM activity_tags ORDER BY name ASC");
        res.json(tags);
    } catch (err) {
        console.error("Error fetching activity tags:", err);
        res.status(500).json({ error: "Failed to fetch tags" });
    }
});

router.get("/activity-logs/:activityid", requireLogin, async (req, res) => {
    const { activityid } = req.params;
    const { week_start } = req.query;
    const coachID = req.session.userID;

    const logs = await db.any(`
        SELECT al.*, c.fname, c.lname,
               ARRAY_REMOVE(ARRAY_AGG(alt.tagid), NULL) as tags
        FROM activity_logs al
        JOIN children c ON al.childid = c.childid
        LEFT JOIN activity_log_tags alt ON al.id = alt.logid
        WHERE al.activityid = $1 AND al.week_start = $2 AND al.coachid = $3
        GROUP BY al.id, c.childid
    `, [activityid, week_start, coachID]);

    res.json(logs);
});

router.get("/activity/:activityID/student/:childID/history", requireLogin, async (req, res) => {
    const { activityID, childID } = req.params;

    try {
        const logs = await db.any(
            `SELECT week_start, rating, comment, type
       FROM activity_logs
       WHERE activityID = $1 AND childID = $2
       ORDER BY week_start`,
            [activityID, childID]
        );
        res.json(logs);
    } catch (err) {
        console.error("Failed to fetch student history:", err);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

// GET all logs for an activity with student info + tagids + actual date
router.get("/activity/:activityid/logs", requireLogin, async (req, res) => {
    const { activityid } = req.params;
    try {
        const logs = await db.any(
            `
      SELECT 
        al.id,
        al.childid,
        c.fname, c.lname,
        al.date,                -- <— actual log date (VERY IMPORTANT)
        al.week_start,
        (al.week_start + INTERVAL '6 days')::date AS week_end, -- optional
        al.rating,
        al.comment,
        al.type,
        ARRAY(
          SELECT tagid FROM activity_log_tags alt WHERE alt.logid = al.id
        ) AS tagids
      FROM activity_logs al
      JOIN children c ON al.childid = c.childid
      WHERE al.activityid = $1
      ORDER BY al.week_start ASC, al.date ASC, al.id ASC
      `,
            [activityid]
        );
        res.json(logs);
    } catch (err) {
        console.error("Failed to fetch activity logs:", err);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

export default router;
