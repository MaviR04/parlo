// routes/events.js
import express from "express";
import db from "../db.js";

const router = express.Router();

// POST /events → save new event
router.post("/", async (req, res) => {
  try {
    const {  event_name, classification, event_data } = req.body;
    const parentId = req.session.userID
    if ( !event_name || !classification) {
      return res.status(400).json({ error: " event_name, and classification are required" });
    }

    await db.none(
      `INSERT INTO user_events (user_id, event_name, classification, event_data)
       VALUES ($1, $2, $3, $4)`,
      [parentId, event_name, classification, event_data ? event_data : null]
    );

    res.json({ success: true, message: "Event recorded" });
  } catch (err) {
    console.error("Error saving event:", err);
    res.status(500).json({ error: "Failed to save event" });
  }
});

// GET /events/:userId → fetch events for a user
router.get("user/:userId", async (req, res) => {
  try {
    const rows = await db.any(
      `SELECT * FROM user_events WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.params.userID]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// (Optional) GET /events/:userId/:classification → filter by classification

router.get("/designation", async (req, res) => {
  try {
    const parentId = req.session.userID; // from session 

    if (!parentId) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const result = await db.oneOrNone(
      `SELECT designation
       FROM parents
       WHERE parentid = $1`,
      [parentId]
    );

    if (!result) {
      return res.status(404).json({ error: "Parent not found" });
    }

    res.json({ designation: result.designation });
  } catch (err) {
    console.error("Error fetching designation:", err);
    res.status(500).json({ error: "Failed to fetch designation" });
  }
});

router.get("/user/designation/:id", async (req, res) => {
  try {
    const parentId = req.params.id; // from session 

    if (!parentId) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const result = await db.oneOrNone(
      `SELECT designation
       FROM parents
       WHERE parentid = $1`,
      [parentId]
    );

    if (!result) {
      return res.status(404).json({ error: "Parent not found" });
    }

    res.json({ designation: result.designation });
  } catch (err) {
    console.error("Error fetching designation:", err);
    res.status(500).json({ error: "Failed to fetch designation" });
  }
});


router.get('/teachers/parents', async (req, res) => {
  const teacherId = Number(req.session.userID);
  const SQL = `
  WITH teacher_classes AS (
    SELECT c.classid
    FROM classes c
    WHERE c.classteacher = $1
    UNION
    SELECT uc.classid
    FROM userclasses uc
    WHERE uc.userid = $1 AND uc.role = 'Teacher'
  ),
  parent_ids AS (
    SELECT DISTINCT ch.parentid
    FROM childclasses cc
    JOIN children ch ON ch.childid = cc.childid
    WHERE cc.classid IN (SELECT classid FROM teacher_classes)
      AND ch.parentid IS NOT NULL
  )
  SELECT
    u.userid AS parentid,
    u.fname,
    u.lname,
    p.designation
  FROM parent_ids pid
  JOIN users u ON u.userid = pid.parentid
  LEFT JOIN parents p ON p.parentid = pid.parentid
  WHERE u.role = 'Parent'
  ORDER BY u.lname, u.fname;
  `;
  if (!Number.isInteger(teacherId)) {
    return res.status(400).json({ error: 'teacherId must be an integer' });
    }

  try {
    const  result = await db.any(SQL, [teacherId]);
    // Always return an array; empty if no parents found
    res.json(result);
  } catch (err) {
    console.error('Error fetching parents for teacher:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/teachers/parent-events', async (req, res) => {
  const teacherId = req.session.userID;
  if (!Number.isInteger(teacherId)) {
    return res.status(400).json({ error: 'teacherId must be an integer' });
  }

  // Optional filters: ?classification=...&event_name=...&since=2025-09-01&until=2025-09-30&limit=100&offset=0
  const { classification, event_name, since, until } = req.query;

  // Pagination defaults
  const limit  = Math.min(parseInt(req.query.limit, 100) || 100, 500);
  const offset = Math.max(parseInt(req.query.offset, 0) || 0, 0);

  const where = [];
  const params = [teacherId];

  // Build dynamic WHERE clause safely
  if (classification) {
    params.push(classification);
    where.push(`ue.classification = $${params.length}`);
  }
  if (event_name) {
    params.push(event_name);
    where.push(`ue.event_name = $${params.length}`);
  }
  if (since) {
    params.push(new Date(since)); // ISO date or timestamp string
    where.push(`ue.created_at >= $${params.length}`);
  }
  if (until) {
    params.push(new Date(until));
    where.push(`ue.created_at < $${params.length}`);
  }

  const sql = `
    WITH teacher_classes AS (
      SELECT c.classid
      FROM classes c
      WHERE c.classteacher = $1
      UNION
      SELECT uc.classid
      FROM userclasses uc
      WHERE uc.userid = $1 AND uc.role = 'Teacher'
    ),
    parent_ids AS (
      SELECT DISTINCT ch.parentid
      FROM childclasses cc
      JOIN children ch ON ch.childid = cc.childid
      WHERE cc.classid IN (SELECT classid FROM teacher_classes)
        AND ch.parentid IS NOT NULL
    )
    SELECT
      ue.id,
      ue.user_id       AS parentid,
      pu.fname         AS parent_fname,
      pu.lname         AS parent_lname,
      ue.event_name,
      ue.classification,
      ue.event_data,
      ue.created_at
    FROM user_events ue
    JOIN parent_ids pid ON pid.parentid = ue.user_id
    JOIN users pu       ON pu.userid = ue.user_id AND pu.role = 'Parent'
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ue.created_at DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  try {
    const rows  = await db.any(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching parent events for teacher:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



export default router;
