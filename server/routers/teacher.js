import express from "express";
import db from "../db.js";

const router = express.Router();

// Middleware: Require login & attach schoolid
async function requireLogin(req, res, next) {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Not logged in" });
    }
    try {
        const user = await db.oneOrNone(
            "SELECT userid, schoolid FROM users WHERE userid = $1",
            [req.session.userID]
        );
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }
        req.user = user; // { userid, schoolid }
        next();
    } catch (err) {
        console.error("Error fetching user info:", err);
        res.status(500).json({ error: "Server error" });
    }
}

// ---------------------------
// Get classes for this teacher
// ---------------------------
router.get("/classes", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const schoolId = req.user.schoolid;

    try {
        const classes = await db.any(
            `
      SELECT 
        c.classid,
        c.classname,
        STRING_AGG(DISTINCT COALESCE(uc.role, ''), ', ') ||
          CASE WHEN c.classteacher = $1 THEN
            CASE 
              WHEN STRING_AGG(DISTINCT COALESCE(uc.role, ''), ', ') IS NULL 
                OR STRING_AGG(DISTINCT COALESCE(uc.role, ''), ', ') = '' 
              THEN 'Class Teacher'
              ELSE ', Class Teacher' 
            END
          ELSE '' 
        END AS roles_for_user
      FROM classes c
      LEFT JOIN userclasses uc 
        ON c.classid = uc.classid 
       AND uc.userid = $1
     
      JOIN users cu ON cu.userid = c.classteacher
      WHERE (c.classteacher = $1 OR uc.userid = $1)
        AND cu.schoolid = $2
      GROUP BY c.classid, c.classname, c.classteacher
      ORDER BY c.classname
      `,
            [userId, schoolId]
        );

        res.json(classes);
    } catch (err) {
        console.error("Error fetching teacher classes:", err);
        res.status(500).json({ error: "Failed to fetch teacher classes" });
    }
});


// ---------------------------
// Get students in a class
// ---------------------------
// Get students in a specific class - school filtered
// Get students in a specific class
router.get("/classes/:classId/students", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const schoolId = req.user.schoolid; // get schoolId from middleware
    const { classId } = req.params;

    try {
        // Check if user is Class Teacher OR Subject Teacher for this class within the same school
        const teacherRows = await db.any(
            `
      SELECT uc.role
      FROM classes c
      LEFT JOIN userclasses uc ON c.classid = uc.classid
      JOIN users u ON c.classteacher = u.userid
      WHERE c.classid = $1
        AND u.schoolid = $3
        AND (
          c.classteacher = $2
          OR (
            uc.userid = $2
            AND LOWER(uc.role) LIKE '%teacher%'
          )
        )
      `,
            [classId, userId, schoolId]
        );

        if (teacherRows.length === 0) {
            return res.status(403).json({ error: "Not authorized for this class" });
        }

        // Fetch students in the class
        const students = await db.any(
            `
      SELECT ch.childid, ch.fname, ch.lname, ch.dateofbirth,
             p.userid AS parentid, p.fname AS parentfname, p.lname AS parentlname
      FROM childclasses cc
      JOIN children ch ON cc.childid = ch.childid
      LEFT JOIN users p ON ch.parentid = p.userid
      WHERE cc.classid = $1
      ORDER BY ch.lname, ch.fname
      `,
            [classId]
        );

        res.json(students);
    } catch (err) {
        console.error("Error fetching students:", err);
        res.status(500).json({ error: "Failed to fetch students" });
    }
});



// ---------------------------
// Teacher roles
// ---------------------------
// Teacher roles endpoint - school specific
router.get("/roles", requireLogin, async (req, res) => {
    const userId = req.user.userid;
    const schoolId = req.user.schoolid;

    try {
        const roles = await db.any(
            `
            SELECT DISTINCT LOWER(uc.role) AS role
            FROM userclasses uc
            JOIN classes c ON uc.classid = c.classid
            JOIN users u ON c.classteacher = u.userid
            WHERE uc.userid = $1
              AND u.schoolid = $2
            UNION
            SELECT 'class teacher'
            WHERE EXISTS (
                SELECT 1
                FROM classes c
                JOIN users u ON c.classteacher = u.userid
                WHERE c.classteacher = $1
                  AND u.schoolid = $2
            )
            `,
            [userId, schoolId]
        );

        const roleNames = roles.map(r => r.role);
        const isClassTeacher = roleNames.some(role => role.includes("class teacher"));
        const isSubjectTeacher = roleNames.some(
            role => role.includes("teacher") && !role.includes("class teacher")
        );

        res.json({ isClassTeacher, isSubjectTeacher });
    } catch (err) {
        console.error("Error fetching teacher roles:", err);
        res.status(500).json({ error: "Failed to fetch teacher roles" });
    }
});


// ---------------------------
// Student profile
// ---------------------------
router.get("/student/:childId", requireLogin, async (req, res) => {
    const userId = req.user.userid;
    const schoolId = req.user.schoolid;
    const { childId } = req.params;

    try {
        const student = await db.oneOrNone(
            `
            SELECT ch.childid, ch.fname, ch.lname, ch.dateofbirth,
                   p.userid AS parentid, p.fname AS parentfname, p.lname AS parentlname
            FROM children ch
            JOIN users p ON ch.parentid = p.userid
            JOIN childclasses cc ON cc.childid = ch.childid
            JOIN classes c ON cc.classid = c.classid
            LEFT JOIN userclasses uc ON uc.classid = c.classid
            JOIN users t ON t.userid = c.classteacher
            WHERE ch.childid = $1
              AND p.schoolid = $3
              AND (
                c.classteacher = $2
                OR (uc.userid = $2 AND LOWER(uc.role) LIKE '%teacher%')
              )
            LIMIT 1
            `,
            [childId, userId, schoolId]
        );

        if (!student) {
            return res.status(403).json({ error: "Not authorized or student not found" });
        }

        res.json(student);
    } catch (err) {
        console.error("Error fetching student profile:", err);
        res.status(500).json({ error: "Failed to fetch student profile" });
    }
});

// ---------------------------
// Class-teacher-only classes
// ---------------------------
router.get("/classes/class-teacher-only", requireLogin, async (req, res) => {
    const userId = req.user.userid;
    const schoolId = req.user.schoolid;

    try {
        const classes = await db.any(
            `
            SELECT c.classid, c.classname
            FROM classes c
            JOIN users t ON t.userid = c.classteacher
            WHERE c.classteacher = $1
              AND t.schoolid = $2
            ORDER BY c.classname
            `,
            [userId, schoolId]
        );
        res.json(classes);
    } catch (err) {
        console.error("Error fetching class teacher classes:", err);
        res.status(500).json({ error: "Failed to fetch class teacher classes" });
    }
});

// ---------------------------
// POST Attendance
// ---------------------------
router.post("/classes/:classId/attendance", requireLogin, async (req, res) => {
    const userId = req.user.userid;
    const schoolId = req.user.schoolid;
    const { classId } = req.params;
    const { childId, date, status } = req.body;

    try {
        const today = new Date();
        const selectedDate = new Date(date);
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((selectedDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
            return res.status(400).json({
                error: `You cannot record attendance for a future date (${selectedDate.toDateString()}).`
            });
        }
        if (diffDays < -6) {
            return res.status(400).json({
                error: `You can only edit attendance for the past 7 days.`
            });
        }

        const isClassTeacher = await db.oneOrNone(
            `
            SELECT 1 FROM classes c
            JOIN users t ON t.userid = c.classteacher
            WHERE c.classid = $1
              AND c.classteacher = $2
              AND t.schoolid = $3
            `,
            [classId, userId, schoolId]
        );

        if (!isClassTeacher) {
            return res.status(403).json({ error: "Only the class teacher can mark attendance." });
        }

        const isBlockedDay = await db.oneOrNone(
            `
            SELECT 1
            FROM (
              SELECT start_date, end_date, schoolid FROM school_breaks
              UNION ALL
              SELECT date AS start_date, date AS end_date, schoolid FROM school_holidays
            ) b
            WHERE $1::date BETWEEN b.start_date AND b.end_date
              AND b.schoolid = $2
            `,
            [selectedDate, schoolId]
        );

        if (isBlockedDay) {
            return res.status(400).json({
                error: `You cannot mark attendance on ${selectedDate.toDateString()} because it is a holiday/break.`
            });
        }

        await db.none(
            `
            INSERT INTO attendance (childid, classid, date, status, recorded_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (childid, date)
            DO UPDATE SET 
                status = EXCLUDED.status,
                recorded_by = EXCLUDED.recorded_by
            `,
            [childId, classId, date, status, userId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Error saving attendance:", err);
        res.status(500).json({ error: "Failed to save attendance." });
    }
});

// ---------------------------
// GET Breaks + Holidays (school-specific)
// ---------------------------
router.get("/school-breaks", requireLogin, async (req, res) => {
    const schoolId = req.user.schoolid;
    try {
        const breaks = await db.any(`
            SELECT name, start_date, end_date
            FROM school_breaks
            WHERE schoolid = $1
            UNION ALL
            SELECT name, date AS start_date, date AS end_date
            FROM school_holidays
            WHERE schoolid = $1
            ORDER BY start_date
        `, [schoolId]);
        res.json(breaks);
    } catch (err) {
        console.error("Failed to fetch breaks/holidays", err);
        res.status(500).json({ error: "Failed to fetch breaks/holidays" });
    }
});

// ---------------------------
// GET Attendance for a class
// ---------------------------
router.get("/classes/:classId/attendance", requireLogin, async (req, res) => {
    const userId = req.user.userid;
    const schoolId = req.user.schoolid;
    const { classId } = req.params;

    try {
        const isClassTeacher = await db.oneOrNone(
            `
            SELECT 1
            FROM classes c
            JOIN users t ON t.userid = c.classteacher
            WHERE c.classid = $1
              AND c.classteacher = $2
              AND t.schoolid = $3
            `,
            [classId, userId, schoolId]
        );

        if (!isClassTeacher) {
            return res.status(403).json({ error: "Only the class teacher can view attendance" });
        }

        const attendance = await db.any(
            `
            SELECT *
            FROM attendance a
            JOIN children ch ON a.childid = ch.childid
            JOIN users p ON ch.parentid = p.userid
            WHERE a.classid = $1
              AND p.schoolid = $2
            ORDER BY date DESC
            `,
            [classId, schoolId]
        );

        res.json(attendance);
    } catch (err) {
        console.error("Error fetching attendance:", err);
        res.status(500).json({ error: "Failed to fetch attendance" });
    }
});

// ---------------------------
// GET Student attendance summary
// ---------------------------
router.get("/attendance/student/:childId", requireLogin, async (req, res) => {
    const { childId } = req.params;
    const { start_date, end_date } = req.query;
    const schoolId = req.user.schoolid;

    try {
        let query = `
            SELECT status, COUNT(*) AS count
            FROM attendance a
            JOIN children ch ON a.childid = ch.childid
            JOIN users p ON ch.parentid = p.userid
            WHERE a.childid = $1
              AND p.schoolid = $2
        `;
        const params = [childId, schoolId];

        if (start_date && end_date) {
            query += ` AND a.date >= $3 AND a.date <= $4`;
            params.push(start_date, end_date);
        }

        query += ` GROUP BY status`;

        const data = await db.any(query, params);

        let summary = { present: 0, absent: 0, late: 0, "half-day": 0, total: 0 };

        data.forEach((row) => {
            const statusKey = row.status?.toLowerCase();
            if (summary.hasOwnProperty(statusKey)) {
                summary[statusKey] = parseInt(row.count);
                summary.total += parseInt(row.count);
            }
        });

        res.json(summary);
    } catch (err) {
        console.error("Error fetching student attendance summary:", err);
        res.status(500).json({ error: "Failed to fetch student attendance summary" });
    }
});

// ---------------------------
// GET Student attendance trends
// ---------------------------
router.get("/attendance/student/:childId/trends", requireLogin, async (req, res) => {
    const { childId } = req.params;
    const { start_date, end_date, groupBy } = req.query;
    const schoolId = req.user.schoolid;

    if (!start_date || !end_date || !groupBy) {
        return res.status(400).json({ error: "Missing start_date, end_date, or groupBy" });
    }

    const groupField = groupBy === "month" ? "month" : "week";

    try {
        const rows = await db.any(
            `
            WITH periods AS (
                SELECT generate_series(
                    DATE_TRUNC($1, $3::date),
                    DATE_TRUNC($1, $4::date),
                    CASE WHEN $1 = 'week' THEN '1 week'::interval ELSE '1 month'::interval END
                ) AS period
            )
            SELECT 
                p.period,
                COALESCE(a.present, 0) AS present,
                COALESCE(a.absent, 0) AS absent,
                COALESCE(a.late, 0) AS late,
                COALESCE(a.half_day, 0) AS half_day
            FROM periods p
            LEFT JOIN (
                SELECT
                    DATE_TRUNC($1, date) AS period,
                    COUNT(*) FILTER (WHERE LOWER(status) = 'present') AS present,
                    COUNT(*) FILTER (WHERE LOWER(status) = 'absent') AS absent,
                    COUNT(*) FILTER (WHERE LOWER(status) = 'late') AS late,
                    COUNT(*) FILTER (WHERE LOWER(status) = 'half-day') AS half_day
                FROM attendance a
                JOIN children ch ON a.childid = ch.childid
                JOIN users p ON ch.parentid = p.userid
                WHERE a.childid = $2
                  AND p.schoolid = $5
                  AND date BETWEEN $3 AND $4
                GROUP BY period
            ) a ON p.period = a.period
            ORDER BY p.period
            `,
            [groupField, childId, start_date, end_date, schoolId]
        );

        const trends = rows.map((row) => ({
            period: row.period.toISOString().split("T")[0],
            present: parseInt(row.present),
            absent: parseInt(row.absent),
            late: parseInt(row.late),
            "half-day": parseInt(row.half_day),
        }));

        const statsRow = await db.one(
            `
            SELECT 
                COUNT(DISTINCT date) AS total_days,
                COUNT(*) FILTER (WHERE LOWER(status) = 'present') AS present,
                COUNT(*) FILTER (WHERE LOWER(status) = 'absent') AS absent,
                COUNT(*) FILTER (WHERE LOWER(status) = 'late') AS late,
                COUNT(*) FILTER (WHERE LOWER(status) = 'half-day') AS half_day
            FROM attendance a
            JOIN children ch ON a.childid = ch.childid
            JOIN users p ON ch.parentid = p.userid
            WHERE a.childid = $1
              AND p.schoolid = $2
              AND date BETWEEN $3 AND $4
            `,
            [childId, schoolId, start_date, end_date]
        );

        const totalDays = parseInt(statsRow.total_days);
        const presentDays = parseInt(statsRow.present);
        const absentDays = parseInt(statsRow.absent);
        const lateDays = parseInt(statsRow.late);
        const halfDays = parseInt(statsRow.half_day);

        const attendancePercent =
            totalDays > 0 ? ((presentDays + halfDays * 0.5) / totalDays) * 100 : 0;

        const stats = {
            totalDays,
            present: presentDays,
            absent: absentDays,
            late: lateDays,
            halfDay: halfDays,
            attendancePercent: attendancePercent.toFixed(1),
        };

        res.json({ trends, stats });
    } catch (err) {
        console.error("Error fetching attendance trends + stats:", err);
        res.status(500).json({ error: "Failed to fetch attendance trends" });
    }
});

export default router;
