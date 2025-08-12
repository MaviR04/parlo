import express from "express";
import db from "../db.js";

const router = express.Router();

function requireLogin(req, res, next) {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Not logged in" });
    }
    next();
}



router.get("/overview/:childId/:termId", requireLogin, async (req, res) => {
    const { childId, termId } = req.params;

    try {
        // Insights
        const recentTags = await db.any(`
      SELECT t.name, t.category, t.color
      FROM activity_logs l
      JOIN activity_log_tags lt ON l.id = lt.logID
      JOIN activity_tags t ON lt.tagID = t.tagID
      WHERE l.childID = $1 AND l.termid = $2
      ORDER BY l.date DESC
      LIMIT 5
    `, [childId, termId]);

        const insights = recentTags.map(tag => ({
            type: tag.category === "Encouragement" ? "alert" : "success",
            message: tag.category === "Encouragement"
                ? `Needs Support: ${tag.name}`
                : `Achievement: ${tag.name}`
        }));

        // Category breakdown
        const category_breakdown = await db.any(`
      SELECT a.category, COUNT(*)::int AS count
      FROM activity_enrollments e
      JOIN activities a ON e.activityID = a.activityID
      WHERE e.childID = $1 AND e.status = 'Active'
      GROUP BY a.category
    `, [childId]);

        // Recent logs
        const recent_logs = await db.any(`
      SELECT l.id, l.date, a.name AS activity_name, l.type, l.comment,
             COALESCE(
               json_agg(
                 json_build_object('name', t.name, 'color', t.color)
               ) FILTER (WHERE t.tagID IS NOT NULL), '[]'
             ) AS tags
      FROM activity_logs l
      JOIN activities a ON l.activityID = a.activityID
      LEFT JOIN activity_log_tags lt ON l.id = lt.logID
      LEFT JOIN activity_tags t ON lt.tagID = t.tagID
      WHERE l.childID = $1 AND l.termid = $2
      GROUP BY l.id, a.name
      ORDER BY l.date DESC
      LIMIT 10
    `, [childId, termId]);

        res.json({ insights, category_breakdown, recent_logs });

    } catch (err) {
        console.error("Error fetching activity overview:", err);
        res.status(500).json({ error: "Failed to fetch activity overview" });
    }
});


router.get("/progress/:childId/:termId", requireLogin, async (req, res) => {
    const { childId, termId } = req.params;

    try {
        // 1️⃣ Current term averages
        const current = await db.any(`
      SELECT a.activityID,
             a.name AS activity_name,
             ROUND(AVG(l.rating)::numeric, 1) AS avg_rating,
             COUNT(*) AS sessions
      FROM activity_logs l
      JOIN activities a ON l.activityID = a.activityID
      WHERE l.childID = $1
        AND l.termid = $2
        AND l.rating IS NOT NULL
      GROUP BY a.activityID, a.name
    `, [childId, termId]);

        // 2️⃣ Previous term averages (for trend)
        const prevTerm = await db.oneOrNone(`
      SELECT termid
      FROM terms
      WHERE start_date < (SELECT start_date FROM terms WHERE termid = $1)
      ORDER BY start_date DESC
      LIMIT 1
    `, [termId]);

        let previous = [];
        if (prevTerm) {
            previous = await db.any(`
        SELECT a.name AS activity_name,
               ROUND(AVG(l.rating)::numeric, 1) AS avg_rating
        FROM activity_logs l
        JOIN activities a ON l.activityID = a.activityID
        WHERE l.childID = $1
          AND l.termid = $2
          AND l.rating IS NOT NULL
        GROUP BY a.name
      `, [childId, prevTerm.termid]);
        }

        const prevMap = {};
        previous.forEach(p => {
            prevMap[p.activity_name] = p.avg_rating;
        });

        // 3️⃣ Weekly ratings for sparklines
        const weeklyData = await db.any(`
  SELECT a.activityID,
         DATE_TRUNC('week', l.date) AS week_start,
         ROUND(AVG(l.rating)::numeric, 1) AS week_avg
  FROM activity_logs l
  JOIN activities a ON l.activityID = a.activityID
  WHERE l.childID = $1
    AND l.termid = $2
    AND l.rating IS NOT NULL
  GROUP BY a.activityID, DATE_TRUNC('week', l.date)
  ORDER BY a.activityID, week_start
`, [childId, termId]);


        // Group weekly data by activityID
        const weeklyMap = {};
        weeklyData.forEach(row => {
            if (!weeklyMap[row.activityid]) weeklyMap[row.activityid] = [];
            weeklyMap[row.activityid].push({
                week_start: row.week_start,
                week_avg: row.week_avg
            });
        });

        // 4️⃣ Final merge
        const progress = current.map(c => ({
            activity_name: c.activity_name,
            avg_rating: c.avg_rating,
            sessions: c.sessions,
            trend: prevMap[c.activity_name] != null
                ? c.avg_rating > prevMap[c.activity_name]
                    ? "up"
                    : c.avg_rating < prevMap[c.activity_name]
                        ? "down"
                        : "same"
                : "new",
            weekly: weeklyMap[c.activityid] || []
        }));

        res.json(progress);

    } catch (err) {
        console.error("Error fetching activity progress:", err);
        res.status(500).json({ error: "Failed to fetch progress" });
    }
});

// Get weekly progress for a specific activity
router.get("/progress/:childId/:termId/weekly", requireLogin, async (req, res) => {
    const { childId, termId } = req.params;
    const { activity } = req.query; // activity name

    if (!activity) {
        return res.status(400).json({ error: "Missing activity name" });
    }

    try {
        const weekly = await db.any(`
      SELECT DATE_TRUNC('week', l.date)::date AS week_start,
             ROUND(AVG(l.rating)::numeric, 1) AS week_avg
      FROM activity_logs l
      JOIN activities a ON l.activityID = a.activityID
      WHERE l.childID = $1
        AND l.termid = $2
        AND a.name = $3
        AND l.rating IS NOT NULL
      GROUP BY DATE_TRUNC('week', l.date)
      ORDER BY week_start
    `, [childId, termId, activity]);

        res.json(weekly);
    } catch (err) {
        console.error("Error fetching weekly activity progress:", err);
        res.status(500).json({ error: "Failed to fetch weekly progress" });
    }
});



// GET /activities/badges/:childId/:termId
router.get("/badges/:childId/:termId", requireLogin, async (req, res) => {
    const { childId, termId } = req.params;

    try {
        const badges = await db.any(`
      SELECT a.name AS activity_name,
             t.name AS badge_name,
             t.color,
             COUNT(*) AS count
      FROM activity_logs l
      JOIN activities a ON l.activityID = a.activityID
      JOIN activity_log_tags lt ON l.id = lt.logID
      JOIN activity_tags t ON lt.tagID = t.tagID
      WHERE l.childID = $1
        AND l.termid = $2
      GROUP BY a.name, t.name, t.color
      ORDER BY a.name, badge_name
    `, [childId, termId]);

        // Group by activity
        const grouped = {};
        badges.forEach(row => {
            if (!grouped[row.activity_name]) grouped[row.activity_name] = [];
            grouped[row.activity_name].push({
                name: row.badge_name,
                color: row.color,
                count: Number(row.count)
            });
        });

        res.json(grouped);

    } catch (err) {
        console.error("Error fetching badges:", err);
        res.status(500).json({ error: "Failed to fetch badges" });
    }
});


// GET /activities/logs/:childId/:termId
router.get("/logs/:childId/:termId", requireLogin, async (req, res) => {
  const { childId, termId } = req.params;

  try {
    const logs = await db.any(
      `
      SELECT 
        l.date,
        a.name AS activity_name,
        l.type,
        COALESCE(
          json_agg(json_build_object('name', t.name, 'color', t.color, 'category', t.category))
            FILTER (WHERE t.name IS NOT NULL),
          '[]'::json
        ) AS tags,
        l.comment
      FROM activity_logs l
      JOIN activities a ON l.activityID = a.activityID
      LEFT JOIN activity_log_tags lt ON l.id = lt.logID
      LEFT JOIN activity_tags t ON lt.tagID = t.tagID
      WHERE l.childID = $1 AND l.termid = $2
      GROUP BY l.id, a.name, l.type
      ORDER BY l.date DESC
      `,
      [childId, termId]
    );

    res.json(logs);
  } catch (err) {
    console.error("Error fetching logs:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// Get all activities
router.get("/", requireLogin, async (req, res) => {
    try {
        const activities = await db.any("SELECT * FROM activities ORDER BY activityid DESC");
        res.json(activities);
    } catch (err) {
        console.error("Error fetching activities:", err);
        res.status(500).json({ error: "Failed to fetch activities" });
    }
});

// Add activity
router.post("/", requireLogin, async (req, res) => {
    const { name, category, ageGroup, description, isActive } = req.body;
    try {
        const inserted = await db.one(
            `INSERT INTO activities (name, category, ageGroup, description, isActive, schoolid)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [name, category, ageGroup, description, isActive ?? true, req.user.schoolid]
        );
        res.json(inserted);
    } catch (err) {
        console.error("Error adding activity:", err);
        res.status(500).json({ error: "Failed to add activity" });
    }
});

// Delete activity
router.delete("/:id", requireLogin, async (req, res) => {
    try {
        await db.none("DELETE FROM activities WHERE activityid = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting activity:", err);
        res.status(500).json({ error: "Failed to delete activity" });
    }
});


export default router;
