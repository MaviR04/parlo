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
 * GET /mine - list meetings for logged-in parent
 */
router.get("/mine", requireLogin, async (req, res) => {
  try {
    const parentId = req.session.userID;
    console.log("Fetching meetings for parent ID:", parentId);

    const rows = await db.any(
      `SELECT m.*, 
              u.fname AS teacher_fname, 
              u.lname AS teacher_lname, 
              u.email AS teacher_email
       FROM meetings m
       JOIN users u ON m.teacher_id = u.userid
       WHERE m.parent_id = $1
       ORDER BY m.created_at DESC`,
      [parentId]
    );

    return res.json({ meetings: rows });
  } catch (err) {
    console.error("GET /api/meetings/mine error:", err);
    return res.status(500).json({ message: "Error fetching meetings" });
  }
});

/**
 * DELETE (for parents)/:id - cancel meeting & restore slot
 */
router.delete("/:id", requireLogin, async (req, res) => {
  try {
    const meetingId = Number(req.params.id);
    if (!Number.isInteger(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    const parentId = req.session.userID;

    const result = await db.tx(async (t) => {
      const meeting = await t.oneOrNone(
        `SELECT * FROM meetings WHERE meeting_id = $1 AND parent_id = $2`,
        [meetingId, parentId]
      );
      if (!meeting) throw new Error("Meeting not found");

      // ---- Check if within 6 hours ----
      const now = new Date();

      // Convert weekday + start_time into the next real datetime
      const meetingDate = new Date();
      meetingDate.setHours(
        parseInt(meeting.start_time.split(":")[0], 10),
        parseInt(meeting.start_time.split(":")[1], 10),
        0,
        0
      );

      // Adjust to the correct weekday
      const todayWeekday = meetingDate.getDay(); // 0 = Sunday
      const targetWeekday = meeting.weekday;
      let diff = targetWeekday - todayWeekday;
      if (diff < 0 || (diff === 0 && meetingDate < now)) {
        diff += 7; // push to next week if already passed today
      }
      meetingDate.setDate(meetingDate.getDate() + diff);

      const diffHours = (meetingDate - now) / (1000 * 60 * 60);

      if (diffHours < 6) {
        throw new Error("Cannot cancel within 6 hours of meeting start time");
      }

      // ---- Proceed with deletion ----
      await t.result(`DELETE FROM meetings WHERE meeting_id = $1`, [meetingId]);

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
    if (err.message.includes("Cannot cancel within 6 hours")) {
      return res.status(403).json({ message: err.message });
    }
    console.error("DELETE /api/meetings/:id error:", err);
    return res.status(500).json({ message: "Error canceling meeting" });
  }
});


/**
 * DELETE (for teachers/coaches)/:id - cancel meeting & restore slot
 */
router.delete("/teacher/:id", requireLogin, async (req, res) => {
  try {
    const meetingId = Number(req.params.id);
    if (!Number.isInteger(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    const userId = req.session.userID;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ message: "Cancellation reason is required" });

    const result = await db.tx(async (t) => {
      // Only use teacher_id (coaches are stored there too)
      const meeting = await t.oneOrNone(
        `SELECT * FROM meetings WHERE meeting_id = $1 AND teacher_id = $2`,
        [meetingId, userId]
      );
      if (!meeting) throw new Error("Meeting not found");

      // Insert into cancellations table using your columns
      await t.none(
        `INSERT INTO cancellations
          (cancelled_by, other_party, title, description, weekday, start_time, end_time, cancelled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          userId,
          meeting.parent_id,
          meeting.title,
          meeting.description,
          meeting.weekday,
          meeting.start_time,
          meeting.end_time,
        ]
      );

      // Delete the meeting
      await t.none(`DELETE FROM meetings WHERE meeting_id = $1`, [meetingId]);

      // Restore the slot
      await t.none(
        `INSERT INTO teacher_availability_slots
          (teacher_id, weekday, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [meeting.teacher_id, meeting.weekday, meeting.start_time, meeting.end_time]
      );

      return meeting;
    });

    return res.json({ success: true, restored: result });
  } catch (err) {
    console.error("DELETE /api/meetings/teacher/:id error:", err);
    return res.status(500).json({ message: err.message || "Error canceling meeting" });
  }
});




export default router;
