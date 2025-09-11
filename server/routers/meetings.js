// server/routers/meetings.js
import express from "express";
import db from "../db.js";

function requireLogin(req, res, next) {
  if (!req.session?.userID) return res.status(401).json({ error: "Not logged in" });
  next();
}

const router = express.Router();

/**
 * POST / - create a meeting and remove the booked slot
 * (Parents create meetings with teachers/coaches)
 */
router.post("/", requireLogin, async (req, res) => {
  try {
    const {
      requestedSlot,
      weekday: bodyWeekday,
      start_time,
      end_time,
      teacherId: rawTeacherId,
      title,
      description,
    } = req.body;

    const teacherId = Number(rawTeacherId);
    if (!Number.isInteger(teacherId) || teacherId <= 0) {
      return res.status(400).json({ message: "Invalid teacherId" });
    }

    let slotWeekday, slotStart, slotEnd;
    if (requestedSlot) {
      slotWeekday = Number(requestedSlot.weekday);
      slotStart = requestedSlot.start;
      slotEnd = requestedSlot.end;
    } else {
      slotWeekday = Number(bodyWeekday);
      slotStart = start_time;
      slotEnd = end_time;
    }

    if (
      !Number.isInteger(slotWeekday) ||
      slotWeekday < 0 ||
      slotWeekday > 6 ||
      !/^\d{1,2}:\d{2}$/.test(slotStart || "") ||
      !/^\d{1,2}:\d{2}$/.test(slotEnd || "") ||
      slotStart >= slotEnd
    ) {
      return res.status(400).json({ message: "Invalid slot data" });
    }

    const parentId = req.session.userID;

    // transaction
    const result = await db.tx(async (t) => {
      const meeting = await t.one(
        `INSERT INTO meetings
          (title, description, parent_id, teacher_id, weekday, start_time, end_time, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::time, $7::time, 'Scheduled', NOW())
         RETURNING *`,
        [title || null, description || null, parentId, teacherId, slotWeekday, slotStart, slotEnd]
      );

      const del = await t.result(
        `DELETE FROM teacher_availability_slots
         WHERE teacher_id = $1
           AND weekday = $2
           AND start_time = $3::time
           AND end_time = $4::time`,
        [teacherId, slotWeekday, slotStart, slotEnd]
      );

      if (!del || del.rowCount === 0) {
        throw new Error("Selected slot not available");
      }

      return meeting;
    });

    return res.status(201).json({ meeting: result, success: true });
  } catch (err) {
    if (err && err.message === "Selected slot not available") {
      return res.status(400).json({ message: "Selected slot is no longer available" });
    }
    console.error("POST /api/meetings error:", err);
    return res.status(500).json({ message: "Error booking meeting" });
  }
});

/**
 * GET /mine - list meetings for the logged-in user
 * - Parents: meetings they booked
 * - Teachers/Coaches: meetings scheduled with them
 */
router.get("/mine", requireLogin, async (req, res) => {
  try {
    const userId = req.session.userID;
    const role = req.session.role; // assume you store role in session ("parent" | "teacher" | "coach")

    let rows = [];

    if (role === "parent") {
      rows = await db.any(
        `SELECT m.*, 
                u.fname AS teacher_fname, 
                u.lname AS teacher_lname, 
                u.email AS teacher_email
         FROM meetings m
         JOIN users u ON m.teacher_id = u.userid
         WHERE m.parent_id = $1
         ORDER BY m.created_at DESC`,
        [userId]
      );
    } else if (role === "teacher" || role === "coach") {
      rows = await db.any(
        `SELECT m.*, 
                p.fname AS parent_fname, 
                p.lname AS parent_lname, 
                p.email AS parent_email
         FROM meetings m
         JOIN users p ON m.parent_id = p.userid
         WHERE m.teacher_id = $1
         ORDER BY m.created_at DESC`,
        [userId]
      );
    } else {
      return res.status(403).json({ message: "Invalid role" });
    }

    return res.json({ meetings: rows });
  } catch (err) {
    console.error("GET /api/meetings/mine error:", err);
    return res.status(500).json({ message: "Error fetching meetings" });
  }
});

/**
 * DELETE /:id - cancel meeting & restore slot
 * - Parent: can cancel their own meeting
 * - Teacher/Coach: can cancel meetings with them
 */
router.delete("/:id", requireLogin, async (req, res) => {
  try {
    const meetingId = Number(req.params.id);
    if (!Number.isInteger(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    const userId = req.session.userID;
    const role = req.session.role;

    const result = await db.tx(async (t) => {
      let meeting;

      if (role === "parent") {
        meeting = await t.oneOrNone(
          `SELECT * FROM meetings WHERE meeting_id = $1 AND parent_id = $2`,
          [meetingId, userId]
        );
      } else if (role === "teacher" || role === "coach") {
        meeting = await t.oneOrNone(
          `SELECT * FROM meetings WHERE meeting_id = $1 AND teacher_id = $2`,
          [meetingId, userId]
        );
      } else {
        throw new Error("Unauthorized role");
      }

      if (!meeting) throw new Error("Meeting not found");

      await t.result(`DELETE FROM meetings WHERE meeting_id = $1`, [meetingId]);

      // restore slot
      await t.none(
        `INSERT INTO teacher_availability_slots
          (teacher_id, weekday, start_time, end_time)
         VALUES ($1, $2, $3::time, $4::time)`,
        [meeting.teacher_id, meeting.weekday, meeting.start_time, meeting.end_time]
      );

      return meeting;
    });

    return res.json({ success: true, restored: result });
  } catch (err) {
    console.error("DELETE /api/meetings/:id error:", err);
    return res.status(500).json({ message: "Error canceling meeting" });
  }
});

export default router;
