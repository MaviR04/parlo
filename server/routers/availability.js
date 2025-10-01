// server/routes/availability.js
import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

function requireTeacherOrCoach(req, res, next) {
  if (!["Teacher", "Coach"].includes(req.user?.userRole)) {
    return res.status(403).json({ error: "Teachers or Coaches only" });
  }
  next();
}

// GET /availability/me
router.get("/me", requireAuth, requireTeacherOrCoach, async (req, res) => {
  try {
    const teacherId = req.user.userid;
    const rows = await db.any(
      `
      SELECT weekday,
             to_char(start_time, 'HH24:MI') AS start_time,
             to_char(end_time,   'HH24:MI') AS end_time
      FROM teacher_availability_slots
      WHERE teacher_id = $1
      ORDER BY weekday, start_time
      `,
      [teacherId]
    );
    res.json({ slots: rows });
  } catch (e) {
    console.error("GET /availability/me error", e);
    res.status(500).json({ error: "Failed to load availability" });
  }
});

// POST /availability/replace
router.post("/replace", requireAuth, requireTeacherOrCoach, async (req, res) => {
  try {
    const teacherId = req.user.userid;
    const { slots } = req.body || {};

    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: "slots must be an array" });
    }

    for (const s of slots) {
      const bad =
        typeof s.weekday !== "number" ||
        s.weekday < 0 ||
        s.weekday > 6 ||
        !/^\d{2}:\d{2}$/.test(s.start) ||
        !/^\d{2}:\d{2}$/.test(s.end) ||
        s.start >= s.end;
      if (bad) {
        return res.status(400).json({ error: "Invalid slot format" });
      }
    }

    await db.tx(async (tx) => {
      await tx.none(
        "DELETE FROM teacher_availability_slots WHERE teacher_id = $1",
        [teacherId]
      );

      for (const s of slots) {
        await tx.none(
          `INSERT INTO teacher_availability_slots
             (teacher_id, weekday, start_time, end_time)
           VALUES ($1, $2, $3::time, $4::time)`,
          [teacherId, s.weekday, s.start, s.end]
        );
      }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /availability/replace error:", e);
    res.status(500).json({ error: e.message || "Failed to save availability" });
  }
});

// GET /availability/for/:teacherId
router.get("/for/:teacherId", async (req, res) => {
  try {
    const teacherId = Number(req.params.teacherId);
    if (!Number.isInteger(teacherId)) {
      return res.status(400).json({ error: "Invalid teacher id" });
    }
    const rows = await db.any(
      `
      SELECT weekday,
             to_char(start_time, 'HH24:MI') AS start_time,
             to_char(end_time,   'HH24:MI') AS end_time
      FROM teacher_availability_slots
      WHERE teacher_id = $1
      ORDER BY weekday, start_time
      `,
      [teacherId]
    );
    res.json({ slots: rows });
  } catch (e) {
    console.error("GET /availability/for/:teacherId error", e);
    res.status(500).json({ error: "Failed to load availability" });
  }
});

// GET /availability/my-meetings
router.get("/my-meetings", requireAuth, requireTeacherOrCoach, async (req, res) => {
  try {
    const teacherId = req.user.userid;
    const rows = await db.any(
      `
      SELECT m.meeting_id,
            m.title,
            m.description,
             m.weekday,
             to_char(m.start_time, 'HH24:MI') AS start_time,
             to_char(m.end_time, 'HH24:MI')   AS end_time,
             m.status,
             u.fname || ' ' || u.lname AS parent_name
      FROM meetings m
      JOIN users u ON m.parent_id = u.userid
      WHERE m.teacher_id = $1
      ORDER BY m.weekday, m.start_time
      `,
      [teacherId]
    );
    res.json({ meetings: rows });
  } catch (e) {
    console.error("GET /availability/my-meetings error", e);
    res.status(500).json({ error: "Failed to load meetings" });
  }
});


// Fetch cancelled meetings for the logged-in teacher/coach
router.get("/my-cancellations", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userID;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    console.log("Fetching cancellations for userID:", userId);

    const cancellations = await db.any(
      `SELECT c.cancellation_id, c.reason, c.cancelled_by, u.fname, u.lname
       FROM cancellations c
       JOIN users u ON c.cancelled_by = u.userid
       WHERE c.other_party = $1
       ORDER BY c.cancelled_at DESC`,
      [userId]
    );

    res.json({ cancellations });
  } catch (err) {
    console.error("GET /my-cancellations error:", err);
    res.status(500).json({ message: "Failed to fetch cancelled meetings" });
  }
});

// Fetch cancelled meetings for the logged-in parent
router.get("/my-cancellations-parent", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userID;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    console.log("Fetching parent cancellations for userID:", userId);
    
    const cancellations = await db.any(
      `SELECT *
       FROM cancellations c
       JOIN users u ON c.cancelled_by = u.userid
       WHERE c.other_party = $1
       ORDER BY c.cancelled_at DESC`,
      [userId]
    );

    res.json({ cancellations });
  } catch (err) {
    console.error("GET /my-cancellations-parent error:", err);
    res.status(500).json({ message: "Failed to fetch cancelled meetings for parent" });
  }
});

// Delete a cancellation record (dismiss)
router.delete("/cancellations/:id", requireAuth, async (req, res) => {
  try {
    const cancellationId = Number(req.params.id);
    if (!Number.isInteger(cancellationId)) {
      return res.status(400).json({ message: "Invalid cancellation ID" });
    }

    await db.none("DELETE FROM cancellations WHERE cancellation_id = $1", [cancellationId]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /cancellations/:id error:", err);
    res.status(500).json({ message: "Failed to delete cancellation" });
  }
});

export default router;