// routes/meetings.js
import express from "express";
import db from "../db.js";


function requireLogin(req, res, next) {
  if (!req.session.userID) return res.status(401).json({ error: "Not logged in" });
  next();
}

const router = express.Router();

router.post("/", requireLogin, async (req, res) => {
  try {
    // Note: The frontend is sending `weekday, start_time, end_time` directly in the payload,
    // so `requestedSlot` is not needed. The frontend code you provided already does this.
    const { title, description, teacherId, weekday, start_time, end_time, parentId } = req.body;

    if (!weekday || !start_time || !end_time) {
      return res.status(400).json({ message: "Meeting slot details are missing" });
    }

    const parent_id_from_session = req.session.userID;

    // A security check to ensure the parentId in the payload matches the session user ID
    if (parentId !== parent_id_from_session) {
        return res.status(403).json({ message: "Unauthorized action" });
    }

    const result = await db.query(
      `INSERT INTO meetings 
       (title, description, parent_id, teacher_id, weekday, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description || null, parentId, teacherId, weekday, start_time, end_time]
    );

    res.status(201).json({ meeting: result.rows[0], success: true });
  } catch (err) {
    console.error("Error booking meeting:", err.message);
    res.status(500).json({ message: "Error booking meeting" });
  }
});

// NEW: GET route to fetch meetings by parentId
router.get("/parent/:parentId", requireLogin, async (req, res) => {
    try {
        const { parentId } = req.params;
        const parent_id_from_session = req.session.userID;

        // Security check: ensure the requested parentId matches the session ID
        if (parentId !== parent_id_from_session) {
            return res.status(403).json({ message: "Unauthorized access" });
        }

        const result = await db.query(
            `SELECT m.*, u.fname, u.lname
             FROM meetings m
             JOIN users u ON m.teacher_id = u.userid
             WHERE m.parent_id = $1
             ORDER BY m.weekday, m.start_time`,
            [parentId]
        );

        // Map the results to include a full teacher name
        const meetingsWithTeacherNames = result.rows.map(meeting => ({
            ...meeting,
            teacher_name: [meeting.fname, meeting.lname].filter(Boolean).join(" ")
        }));

        res.status(200).json({ meetings: meetingsWithTeacherNames, success: true });
    } catch (err) {
        console.error("Error fetching meetings:", err.message);
        res.status(500).json({ message: "Error fetching meetings" });
    }
});

export default router;