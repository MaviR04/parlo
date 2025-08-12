import express from "express";
import db from "../db.js";
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

const router = express.Router();

// Middleware: Require login
function requireLogin(req, res, next) {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Not logged in" });
    }
    next();
}

// Get classes where this user is Class Teacher
// teacher.js
router.get("/classes", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    try {
        const classes = await db.any(
            `
      SELECT
        c.classid,
        c.classname,
        STRING_AGG(DISTINCT COALESCE(uc.role, ''), ', ') ||
          CASE WHEN c.classteacher = $1 THEN
            CASE WHEN STRING_AGG(DISTINCT COALESCE(uc.role, ''), ', ') IS NULL THEN 'Class Teacher'
                 ELSE ', Class Teacher' END
          ELSE '' END AS roles_for_user
      FROM classes c
      LEFT JOIN userclasses uc ON c.classid = uc.classid AND uc.userid = $1
      WHERE c.classteacher = $1 OR uc.userid = $1
      GROUP BY c.classid, c.classname, c.classteacher
      ORDER BY c.classname
      `,
            [userId]
        );
        res.json(classes);
    } catch (err) {
        console.error("Error fetching teacher classes:", err);
        res.status(500).json({ error: "Failed to fetch teacher classes" });
    }
});


// Get students in a specific class
router.get("/classes/:classId/students", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { classId } = req.params;

    console.log(`Fetching students for classId: ${classId} by userId: ${userId}`);

    try {
        // Check if user is Class Teacher OR Subject Teacher for this class
        const teacherRows = await db.any(
            `
      SELECT role
      FROM classes c
      LEFT JOIN userclasses uc ON c.classid = uc.classid
      WHERE c.classid = $1
        AND (
          c.classteacher = $2
          OR (
            uc.userid = $2
            AND LOWER(uc.role) LIKE '%teacher%'
          )
        )
      `,
            [classId, userId]
        );

        if (teacherRows.length === 0) {
            return res.status(403).json({ error: "Not authorized for this class" });
        }

        // Fetch students
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

// Teacher roles endpoint
router.get("/roles", requireLogin, async (req, res) => {
    const userId = req.session.userID;

    try {
        const roles = await db.any(
            `SELECT DISTINCT LOWER(role) AS role
       FROM userclasses
       WHERE userid = $1`,
            [userId]
        );

        const roleNames = roles.map(r => r.role);

        const isClassTeacher = roleNames.some(role => role === "class teacher");
        const isSubjectTeacher = roleNames.some(role => role.includes("teacher") && role !== "class teacher");

        res.json({ isClassTeacher, isSubjectTeacher });
    } catch (err) {
        console.error("Error fetching teacher roles:", err);
        res.status(500).json({ error: "Failed to fetch teacher roles" });
    }
});



router.get("/api/teacher/profile", requireLogin, async (req, res) => {
    const userId = req.session.userID;

    try {
        // Get class teacher classname if any (only one class teacher per your info)
        const classTeacher = await db.oneOrNone(
            "SELECT classname FROM classes WHERE classteacher = $1 LIMIT 1",
            [userId]
        );

        // Check if user is subject teacher (any role with 'teacher' in it, excluding class teacher role)
        const subjectTeacherRoles = await db.any(
            "SELECT role FROM userclasses WHERE userid = $1 AND LOWER(role) LIKE '%teacher%'",
            [userId]
        );

        const isClassTeacher = !!classTeacher;
        const isSubjectTeacher =
            subjectTeacherRoles.filter((r) => r.role.toLowerCase() !== "class teacher").length > 0;

        res.json({
            isClassTeacher,
            isSubjectTeacher,
            classname: classTeacher ? classTeacher.classname : null,
        });
    } catch (err) {
        console.error("Error fetching teacher profile:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/profile", requireLogin, async (req, res) => {
    const userId = req.session.userID;

    try {
        // ✅ Get classid AND classname if user is class teacher
        const classTeacherRow = await db.oneOrNone(
            `SELECT classname, classid 
             FROM classes 
             WHERE classteacher = $1 
             LIMIT 1`,
            [userId]
        );

        // ✅ Get roles from userclasses
        const ucRoles = await db.any(
            `SELECT LOWER(role) AS role 
             FROM userclasses 
             WHERE userid = $1`,
            [userId]
        );

        const roleNames = ucRoles.map(r => r.role);

        const isClassTeacher = !!classTeacherRow;
        const isSubjectTeacher = roleNames.some(
            r => r.includes("teacher") && r.trim() !== "class teacher"
        );

        res.json({
            isClassTeacher,
            isSubjectTeacher,
            classname: classTeacherRow ? classTeacherRow.classname : null,
            classid: classTeacherRow ? classTeacherRow.classid : null  // ✅ include classid here
        });

    } catch (err) {
        console.error("Error fetching teacher profile:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



// Get full student profile
router.get("/student/:childId", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { childId } = req.params;

    try {
        const student = await db.oneOrNone(
            `
      SELECT ch.childid, ch.fname, ch.lname, ch.dateofbirth,
             p.userid AS parentid, p.fname AS parentfname, p.lname AS parentlname,
             c.classname
      FROM children ch
      LEFT JOIN users p ON ch.parentid = p.userid
      JOIN childclasses cc ON cc.childid = ch.childid
      JOIN classes c ON cc.classid = c.classid
      LEFT JOIN userclasses uc ON uc.classid = c.classid
      WHERE ch.childid = $1
        AND (
          c.classteacher = $2
          OR (uc.userid = $2 AND LOWER(uc.role) LIKE '%teacher%')
        )
      LIMIT 1
      `,
            [childId, userId]
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



// GET only classes where user is class teacher (exclude subject teacher only classes)
router.get("/classes/class-teacher-only", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    try {
        const classes = await db.any(
            `
      SELECT c.classid, c.classname
      FROM classes c
      WHERE c.classteacher = $1
      ORDER BY c.classname
      `,
            [userId]
        );
        res.json(classes);
    } catch (err) {
        console.error("Error fetching class teacher classes:", err);
        res.status(500).json({ error: "Failed to fetch class teacher classes" });
    }
});

/**
 * POST - Record attendance for a student
 */
router.post("/classes/:classId/attendance", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { classId } = req.params;
    const { childId, date, status } = req.body;

    try {
        const today = new Date();
        const selectedDate = new Date(date);

        // Normalize times to 00:00:00 for comparison
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);

        const diffMs = selectedDate.getTime() - today.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Prevent marking for future days
        if (diffDays > 0) {
            return res.status(400).json({
                error: `You cannot record attendance for a future date (${selectedDate.toDateString()}). Please select today or a past date.`,
            });
        }

        // Prevent marking for more than 7 days in the past
        if (diffDays < -6) {
            return res.status(400).json({
                error: `You can only edit attendance for the past 7 days. ${selectedDate.toDateString()} is too far in the past.`,
            });
        }

        // Confirm teacher is the class teacher
        const isClassTeacher = await db.oneOrNone(
            `SELECT 1 FROM classes WHERE classid = $1 AND classteacher = $2`,
            [classId, userId]
        );

        if (!isClassTeacher) {
            return res.status(403).json({
                error: "Only the class teacher can mark attendance for this class.",
            });
        }

        // ❗ New: Check if selected date falls in a break or holiday
        const isBlockedDay = await db.oneOrNone(
            `
      SELECT 1
FROM (
  SELECT start_date, end_date FROM school_breaks
  UNION ALL
  SELECT date AS start_date, date AS end_date FROM school_holidays
) b
WHERE $1::date BETWEEN b.start_date AND b.end_date
      `,
            [selectedDate]
        );

        if (isBlockedDay) {
            return res.status(400).json({
                error: `You cannot mark attendance on ${selectedDate.toDateString()} because it is a school holiday or break.`,
            });
        }

        // Insert or update attendance
        await db.none(
            `INSERT INTO attendance (childid, classid, date, status, recorded_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (childid, date)
       DO UPDATE SET 
          status = EXCLUDED.status,
          recorded_by = EXCLUDED.recorded_by`,
            [childId, classId, date, status, userId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Error saving attendance:", err);
        res.status(500).json({ error: "Failed to save attendance." });
    }
});

// GET /school-breaks - return all breaks + holidays
router.get("/school-breaks", requireLogin, async (req, res) => {
    try {
        const breaks = await db.any(`
      SELECT name, start_date, end_date FROM school_breaks
UNION ALL
SELECT name, date AS start_date, date AS end_date FROM school_holidays
ORDER BY start_date
    `);
        res.json(breaks);
    } catch (err) {
        console.error("Failed to fetch breaks/holidays", err);
        res.status(500).json({ error: "Failed to fetch breaks/holidays" });
    }
});

/**
 * GET - Attendance for a class
 */
router.get("/classes/:classId/attendance", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { classId } = req.params;

    try {
        // Verify teacher is the class teacher
        const isClassTeacher = await db.oneOrNone(
            `SELECT 1 FROM classes WHERE classid = $1 AND classteacher = $2`,
            [classId, userId]
        );

        if (!isClassTeacher) {
            return res
                .status(403)
                .json({ error: "Only the class teacher can view attendance" });
        }

        const attendance = await db.any(
            `SELECT * FROM attendance
       WHERE classid = $1
       ORDER BY date DESC`,
            [classId]
        );

        res.json(attendance);
    } catch (err) {
        console.error("Error fetching attendance:", err);
        res.status(500).json({ error: "Failed to fetch attendance" });
    }
});

// GET - Attendance summary for a student (for profile pie chart) 
router.get("/attendance/student/:childId", requireLogin, async (req, res) => {
    const { childId } = req.params;
    const { start_date, end_date } = req.query;

    try {
        let query = `
  SELECT status, COUNT(*) AS count
  FROM attendance
  WHERE childid = $1
`;
        const params = [childId];

        if (start_date && end_date) {
            query += ` AND date >= $2 AND date <= $3`;
            params.push(start_date, end_date); // Will be $2 and $3 correctly
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

// GET - Attendance trends + stats for a student
router.get("/attendance/student/:childId/trends", requireLogin, async (req, res) => {
    const { childId } = req.params;
    const { start_date, end_date } = req.query;
    let { groupBy } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ error: "Missing start_date or end_date" });
    }

    // Calculate difference in months
    const start = new Date(start_date);
    const end = new Date(end_date);
    const diffMonths =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth()) +
        1;

    // Only decide default if user didn't manually select
    if (!groupBy) {
        if (diffMonths >= 12) {
            groupBy = "month"; // year view
        } else {
            groupBy = "week"; // term or shorter
        }
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
                TO_CHAR(
                    p.period,
                    CASE 
                        WHEN $1 = 'month' THEN 'Mon YYYY'
                        ELSE '"Week of" DD Mon YYYY'
                    END
                ) AS display_label,
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
                FROM attendance
                WHERE childid = $2 AND date BETWEEN $3 AND $4
                GROUP BY period
            ) a ON p.period = a.period
            ORDER BY p.period
            `,
            [groupField, childId, start_date, end_date]
        );

        // Format data
        const trends = rows.map(row => ({
            period: row.period.toISOString().split("T")[0],
            displayLabel: row.display_label,
            present: Math.round(row.present),
            absent: Math.round(row.absent),
            late: Math.round(row.late),
            "half-day": Math.round(row.half_day),
        }));

        // Calculate stats
        const totalDays = trends.reduce((sum, row) => sum + row.present + row.absent + row.late + row["half-day"], 0);
        const presentDays = trends.reduce((sum, row) => sum + row.present, 0);
        const absentDays = trends.reduce((sum, row) => sum + row.absent, 0);
        const lateDays = trends.reduce((sum, row) => sum + row.late, 0);
        const halfDays = trends.reduce((sum, row) => sum + row["half-day"], 0);

        const attendancePercent = totalDays > 0
            ? ((presentDays + halfDays * 0.5) / totalDays) * 100
            : 0;

        const stats = {
            totalDays,
            present: presentDays,
            absent: absentDays,
            late: lateDays,
            halfDay: halfDays,
            attendancePercent: attendancePercent.toFixed(1),
        };

        res.json({ trends, stats, groupBy });
    } catch (err) {
        console.error("Error fetching attendance trends + stats:", err);
        res.status(500).json({ error: "Failed to fetch attendance trends" });
    }
});

// GET /teacher/attendance/by-date?date=YYYY-MM-DD
router.get("/attendance/by-date", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: "Missing date" });
    }

    try {
        // Get class ID where user is class teacher
        const classData = await db.oneOrNone(
            `SELECT classid FROM classes WHERE classteacher = $1`,
            [userId]
        );

        if (!classData) {
            return res.status(403).json({ error: "You are not a class teacher." });
        }

        const records = await db.any(
            `
      SELECT childid, status
      FROM attendance
      WHERE classid = $1 AND date = $2
      `,
            [classData.classid, date]
        );

        res.json(records);
    } catch (err) {
        console.error("Error fetching attendance by date:", err);
        res.status(500).json({ error: "Failed to fetch attendance by date." });
    }
});






/*router.get("/dashboard/student-year-overview/:childid", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { childid } = req.params;
    const { schoolYear, classid } = req.query;

    if (!schoolYear || !classid) {
        return res.status(400).json({ error: "schoolYear and classid are required" });
    }

    try {
        // ✅ Verify access
        const allowed = await db.oneOrNone(`
            SELECT 1 
            FROM classes 
            WHERE classid = $1 AND classteacher = $2
        `, [classid, userId]);

        if (!allowed) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // ✅ Find Term 1's start_date for this year
        const startYear = schoolYear.split("-")[0]; // e.g., "2024"
        const term1 = await db.oneOrNone(`
            SELECT start_date 
            FROM terms 
            WHERE name = 'Term 1' 
              AND EXTRACT(YEAR FROM start_date) = $1
            ORDER BY start_date LIMIT 1
        `, [startYear]);

        // ✅ Find Term 3's end_date for this year
        const term3 = await db.oneOrNone(`
            SELECT end_date 
            FROM terms 
            WHERE name = 'Term 3' 
              AND EXTRACT(YEAR FROM end_date) = $1
            ORDER BY end_date DESC LIMIT 1
        `, [parseInt(startYear) + 1]);

        if (!term1 || !term3) {
            return res.json({ termNames: [], subjects: [], student: { childid, name: "" } });
        }

        const startDate = new Date(term1.start_date);
        const endDate = new Date(term3.end_date);
        // console.log("Fetching year overview for:", { childid, schoolYear });
        // ✅ Get all termids for this school year
        const terms = await db.any(`
            SELECT termid, name 
            FROM terms 
            WHERE start_date >= $1 AND end_date <= $2 
            ORDER BY start_date
        `, [startDate, endDate]);

        const termMap = {};
        terms.forEach(t => {
            termMap[t.termid] = t.name;
        });
        const termIds = terms.map(t => t.termid);

        // ✅ Fetch grades for student for these terms
        const grades = await db.any(`
            SELECT subject, score, max_score, termid
            FROM grades 
            WHERE childid = $1 AND termid = ANY($2)
        `, [childid, termIds]);

        if (grades.length === 0) {
            return res.json({ termNames: terms.map(t => t.name), subjects: [], student: { childid, name: "" } });
        }

        // ✅ Group and calculate subject averages per term
        const subjectMap = {}; // { subject: { termid: [percent, ...] } }

        grades.forEach(g => {
            const percent = (parseFloat(g.score) / parseFloat(g.max_score)) * 100;
            if (!subjectMap[g.subject]) {
                subjectMap[g.subject] = {};
            }
            if (!subjectMap[g.subject][g.termid]) {
                subjectMap[g.subject][g.termid] = [];
            }
            subjectMap[g.subject][g.termid].push(percent);
        });

        const subjectResults = Object.entries(subjectMap).map(([subject, termData]) => {
            const averages = terms.map(t => {
                const percents = termData[t.termid] || [];
                if (percents.length === 0) return null;
                const avg = percents.reduce((a, b) => a + b, 0) / percents.length;
                return parseFloat(avg.toFixed(1));
            });
            return { subject, averages };
        });

        // ✅ Get student name
        const studentRow = await db.oneOrNone(`
            SELECT fname, lname FROM children WHERE childid = $1
        `, [childid]);
        const studentName = studentRow ? `${studentRow.fname} ${studentRow.lname}` : "";

        res.json({
            termNames: terms.map(t => t.name),
            subjects: subjectResults,
            student: { childid, name: studentName }
        });

    } catch (err) {
        console.error("Error fetching student year overview:", err);
        res.status(500).json({ error: "Failed to fetch student year overview" });
    }
});
*/


router.get("/dashboard/student-year-overview/:childid", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { childid } = req.params;
    const { schoolYear, classid } = req.query;

    console.log("📥 Request received for childid:", childid, "classid:", classid, "schoolYear:", schoolYear);
    console.log("👤 Checking access for user:", userId);

    if (!schoolYear || !classid) {
        return res.status(400).json({ error: "schoolYear and classid are required" });
    }

    try {
        // ✅ Check if teacher is allowed to view this class
        const allowed = await db.oneOrNone(`
      SELECT 1 FROM userclasses WHERE userid = $1 AND classid = $2
    `, [userId, classid]);

        if (!allowed) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // ✅ Confirm the student belongs to that class (via childclasses)
        const studentRes = await db.oneOrNone(`
      SELECT c.fname, c.lname
      FROM children c
      JOIN childclasses cc ON cc.childid = c.childid
      WHERE cc.classid = $1 AND cc.childid = $2
    `, [classid, childid]);

        if (!studentRes) {
            console.log("❌ Student not found in that class");
            return res.status(404).json({ error: "Student not found in class" });
        }

        const studentName = `${studentRes.fname} ${studentRes.lname}`;

        // ✅ Get Term 1 start date and Term 3 end date for the given school year
        const startYear = schoolYear.split("-")[0];
        const term1 = await db.oneOrNone(`
      SELECT start_date FROM terms
      WHERE name = 'Term 1' AND EXTRACT(YEAR FROM start_date) = $1
      ORDER BY start_date LIMIT 1
    `, [startYear]);

        const term3 = await db.oneOrNone(`
      SELECT end_date FROM terms
      WHERE name = 'Term 3' AND EXTRACT(YEAR FROM end_date) = $1
      ORDER BY end_date DESC LIMIT 1
    `, [parseInt(startYear) + 1]);

        if (!term1 || !term3) {
            return res.json({ termNames: [], subjects: [], student: { childid, name: studentName } });
        }

        const startDate = new Date(term1.start_date);
        const endDate = new Date(term3.end_date);

        // ✅ Get terms for the year
        const terms = await db.any(`
      SELECT termid, name 
      FROM terms 
      WHERE start_date >= $1 AND end_date <= $2 
      ORDER BY start_date
    `, [startDate, endDate]);

        const termMap = {};
        terms.forEach(t => termMap[t.termid] = t.name);
        const termIds = terms.map(t => t.termid);

        // ✅ Get grades
        const grades = await db.any(`
      SELECT subject, termid, score, max_score, assessment_label, assessment_name, date_entered, comment
      FROM grades
      WHERE childid = $1 AND termid = ANY($2)
    `, [childid, termIds]);

        if (grades.length === 0) {
            return res.json({ termNames: terms.map(t => t.name), subjects: [], assessments: [], student: { childid, name: studentName } });
        }

        // ✅ Group subject averages
        const subjectMap = {};
        grades.forEach(g => {
            const percent = (parseFloat(g.score) / parseFloat(g.max_score)) * 100;
            if (!subjectMap[g.subject]) subjectMap[g.subject] = {};
            if (!subjectMap[g.subject][g.termid]) subjectMap[g.subject][g.termid] = [];
            subjectMap[g.subject][g.termid].push(percent);
        });

        const subjectResults = Object.entries(subjectMap).map(([subject, termData]) => {
            const averages = terms.map(t => {
                const scores = termData[t.termid] || [];
                if (scores.length === 0) return null;
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                return parseFloat(avg.toFixed(1));
            });
            return { subject, averages };
        });

        // ✅ Return full data
        const assessments = grades.map(g => ({
            ...g,
            term_name: termMap[g.termid] || "Unknown"
        }));

        res.json({
            termNames: terms.map(t => t.name),
            subjects: subjectResults,
            assessments,
            student: { childid, name: studentName }
        });

    } catch (err) {
        console.error("❌ Error in year overview route:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/dashboard/student-trend/:childid", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { childid } = req.params;
    const { classid, startDate, endDate, subject } = req.query;

    if (!childid || !classid || !startDate || !endDate || !subject) {
        return res.status(400).json({ error: "Missing required params" });
    }

    try {
        // 1. Check if teacher is allowed for the class
        const allowed = await db.oneOrNone(
            `SELECT 1 FROM userclasses WHERE userid = $1 AND classid = $2`,
            [userId, classid]
        );
        if (!allowed) {
            return res.status(403).json({ error: "Not authorized for this class" });
        }

        // 2. Check if child is part of that class
        const childClass = await db.oneOrNone(
            `SELECT 1 FROM childclasses WHERE childid = $1 AND classid = $2`,
            [childid, classid]
        );
        if (!childClass) {
            return res.status(404).json({ error: "Student not found in class" });
        }

        // 3. Get child name
        const student = await db.oneOrNone(
            `SELECT fname, lname FROM children WHERE childid = $1`,
            [childid]
        );

        // 4. Get grades for the subject in the date range
        const grades = await db.any(
            `SELECT subject, score, max_score, assessment_name, assessment_label, date_entered
   FROM grades
   WHERE childid = $1
     AND classid = $2
     AND subject = $3
     AND date_entered >= $4::timestamptz
     AND date_entered < ($5::date + INTERVAL '1 day')
   ORDER BY date_entered ASC`,
            [childid, classid, subject, startDate, endDate]
        );

        res.json({
            student: {
                childid,
                name: `${student.fname} ${student.lname}`
            },
            assessments: grades
        });
    } catch (err) {
        console.error("❌ Error in student-trend route:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /teacher/classes
 * Returns all classes where user is class teacher or subject teacher
 */
router.get("/classes", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    try {
        const classes = await db.any(
            `
            SELECT
                c.classid,
                c.classname,
                STRING_AGG(DISTINCT COALESCE(uc.role, ''), ', ') ||
                CASE WHEN c.classteacher = $1 THEN
                    CASE WHEN STRING_AGG(DISTINCT COALESCE(uc.role, ''), ', ') IS NULL THEN 'Class Teacher'
                         ELSE ', Class Teacher' END
                ELSE '' END AS roles_for_user
            FROM classes c
            LEFT JOIN userclasses uc ON c.classid = uc.classid AND uc.userid = $1
            WHERE c.classteacher = $1 OR uc.userid = $1
            GROUP BY c.classid, c.classname, c.classteacher
            ORDER BY c.classname
            `,
            [userId]
        );
        res.json(classes);
    } catch (err) {
        console.error("Error fetching teacher classes:", err);
        res.status(500).json({ error: "Failed to fetch teacher classes" });
    }
});

/**
 * GET /teacher/roles
 * Returns simple flags for whether user is class teacher or subject teacher
 */
router.get("/roles", requireLogin, async (req, res) => {
    const userId = req.session.userID;

    try {
        const roles = await db.any(
            `SELECT DISTINCT LOWER(role) AS role
             FROM userclasses
             WHERE userid = $1`,
            [userId]
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


// router.get("/dashboard/class-summary", requireLogin, async (req, res) => {

//     const userId = req.session.userID;
//     const { classid, termid } = req.query;

//     if (!classid || !termid) {
//         return res.status(400).json({ error: "classid and termid are required" });
//     }

//     try {
//         // ✅ Check if user is class teacher for this class
//         const isClassTeacher = await db.oneOrNone(
//             `
//             SELECT 1 FROM userclasses
//             WHERE classid = $1 AND userid = $2 AND LOWER(role) LIKE '%class teacher%'
//             `,
//             [classid, userId]
//         );

//         if (!isClassTeacher) {
//             return res.status(403).json({ error: "Not authorized" });
//         }

//         // ✅ Get all grades for this class + term
//         const grades = await db.any(
//             `
//             SELECT g.*, c.fname, c.lname
//             FROM grades g
//             JOIN children c ON g.childid = c.childid
//             WHERE g.classid = $1 AND g.termid = $2
//             `,
//             [classid, termid]
//         );

//         // ✅ Calculate subject-wise averages
//         const subjectMap = {}; // { subject: { totalScore, totalMax, count } }
//         const studentMap = {}; // { childid: { name, total%, subjectCount, below50Count } }

//         grades.forEach(g => {
//             const percent = (parseFloat(g.score) / parseFloat(g.max_score)) * 100;

//             // Subject average calc
//             if (!subjectMap[g.subject]) {
//                 subjectMap[g.subject] = { total: 0, count: 0 };
//             }
//             subjectMap[g.subject].total += percent;
//             subjectMap[g.subject].count += 1;

//             // Student performance calc
//             if (!studentMap[g.childid]) {
//                 studentMap[g.childid] = {
//                     name: `${g.fname} ${g.lname}`,
//                     totalPercent: 0,
//                     subjectCount: 0,
//                     below50Count: 0
//                 };
//             }
//             studentMap[g.childid].totalPercent += percent;
//             studentMap[g.childid].subjectCount += 1;
//             if (percent < 50) {
//                 studentMap[g.childid].below50Count += 1;
//             }
//         });

//         // Format subject averages
//         const subjectAverages = Object.entries(subjectMap).map(([subject, data]) => ({
//             subject,
//             average: (data.total / data.count).toFixed(1)
//         }));

//         // Format student performance
//         const studentPerformances = Object.entries(studentMap).map(([childid, s]) => ({
//             childid,
//             name: s.name,
//             average: (s.totalPercent / s.subjectCount).toFixed(1),
//             below50Count: s.below50Count
//         }));

//         // Top 5 students
//         const topPerformers = [...studentPerformances]
//             .sort((a, b) => b.average - a.average)
//             .slice(0, 5);

//         // Underperformers: students with 2+ subjects < 50%
//         const underperformers = studentPerformances.filter(s => s.below50Count >= 2);

//         res.json({
//             subjectAverages,
//             topPerformers,
//             underperformers
//         });

//     } catch (err) {
//         console.error("Error in class summary:", err);
//         res.status(500).json({ error: "Failed to fetch class summary" });
//     }
// });



router.get("/dashboard/class-summary", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { classid, termid } = req.query;

    if (!classid || !termid) {
        return res.status(400).json({ error: "classid and termid are required" });
    }

    try {
        // ✅ authorize
        const isClassTeacher = await db.oneOrNone(
            `
      SELECT 1 FROM userclasses
      WHERE classid = $1 AND userid = $2 AND LOWER(role) LIKE '%class teacher%'
      `,
            [classid, userId]
        );
        if (!isClassTeacher) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // ✅ pull all grades for class + term
        const grades = await db.any(
            `
      SELECT g.childid, g.subject, g.score, g.max_score, c.fname, c.lname
      FROM grades g
      JOIN children c ON g.childid = c.childid
      WHERE g.classid = $1 AND g.termid = $2
      `,
            [classid, termid]
        );

        // -------- build class subject averages (as before) --------
        const subjectMap = new Map(); // subject -> { totalPct, count }
        // -------- build per-student, per-subject aggregates --------
        const perStudent = new Map(); // childid -> { name, subjects: Map(subject -> {totalPct, count}) }

        for (const g of grades) {
            const pct = (Number(g.score) / Number(g.max_score)) * 100;

            // class subject averages
            if (!subjectMap.has(g.subject)) subjectMap.set(g.subject, { total: 0, count: 0 });
            const sAgg = subjectMap.get(g.subject);
            sAgg.total += pct;
            sAgg.count += 1;

            // per-student, per-subject
            if (!perStudent.has(g.childid)) {
                perStudent.set(g.childid, {
                    name: `${g.fname} ${g.lname}`,
                    subjects: new Map(),
                });
            }
            const stu = perStudent.get(g.childid);
            if (!stu.subjects.has(g.subject)) stu.subjects.set(g.subject, { total: 0, count: 0 });
            const subjAgg = stu.subjects.get(g.subject);
            subjAgg.total += pct;
            subjAgg.count += 1;
        }

        // ✅ format subject averages (class-level)
        const subjectAverages = Array.from(subjectMap.entries()).map(([subject, agg]) => ({
            subject,
            average: (agg.total / agg.count).toFixed(1),
        }));

        // ✅ compute per-student overall = mean of subject averages (distinct subjects)
        const studentPerformances = Array.from(perStudent.entries()).map(([childid, s]) => {
            const subjectAveragesForStudent = Array.from(s.subjects.values()).map(
                (agg) => agg.total / Math.max(1, agg.count)
            );

            if (subjectAveragesForStudent.length === 0) {
                return null; // no grades for this student in this term
            }

            const overall =
                subjectAveragesForStudent.reduce((a, b) => a + b, 0) / subjectAveragesForStudent.length;

            const below50Subjects = subjectAveragesForStudent.filter((v) => v < 50).length;

            return {
                childid: Number(childid),
                name: s.name,
                average: overall.toFixed(1),
                below50Subjects, // 👈 distinct subjects (NOT tests)
            };
        }).filter(Boolean);

        // ✅ thresholds
        const TOP_THRESHOLD = 50;

        // Top performers: overall >= 50
        const topPerformers = studentPerformances
            .filter((s) => parseFloat(s.average) >= TOP_THRESHOLD)
            .sort((a, b) => parseFloat(b.average) - parseFloat(a.average))
            .slice(0, 5);

        // Underperformers: overall < 50
        const underperformers = studentPerformances
            .filter((s) => parseFloat(s.average) < TOP_THRESHOLD)
            // keep property name the frontend expects + the new distinct count
            .map((s) => ({
                ...s,
                below50Count: s.below50Subjects, // backward-compatible field name
            }));

        res.json({
            subjectAverages,
            topPerformers,
            underperformers,
        });
    } catch (err) {
        console.error("Error in class summary:", err);
        res.status(500).json({ error: "Failed to fetch class summary" });
    }
});







// GET /dashboard/student-reports?classid=3&termid=6
router.get("/dashboard/student-reports", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { classid, termid } = req.query;

    if (!classid || !termid) {
        return res.status(400).json({ error: "classid and termid are required" });
    }

    try {
        const isClassTeacher = await db.oneOrNone(
            `SELECT 1 FROM classes WHERE classid = $1 AND classteacher = $2`,
            [classid, userId]
        );
        if (!isClassTeacher) {
            return res.status(403).json({ error: "Not authorized" });
        }

        const students = await db.any(
            `SELECT ch.childid, ch.fname, ch.lname
             FROM children ch
             JOIN childclasses cc ON cc.childid = ch.childid
             WHERE cc.classid = $1
             ORDER BY ch.lname, ch.fname`,
            [classid]
        );

        const grades = await db.any(
            `SELECT g.*, ch.fname, ch.lname
             FROM grades g
             JOIN children ch ON g.childid = ch.childid
             WHERE g.classid = $1 AND g.termid = $2
             ORDER BY ch.lname, ch.fname, g.subject`,
            [classid, termid]
        );

        const studentMap = {};
        students.forEach(s => {
            studentMap[s.childid] = {
                childid: s.childid,
                name: `${s.fname} ${s.lname}`,
                grades: []
            };
        });

        grades.forEach(g => {
            if (studentMap[g.childid]) {
                studentMap[g.childid].grades.push({
                    subject: g.subject,
                    assessment_name: g.assessment_name,
                    score: parseFloat(g.score),
                    max_score: parseFloat(g.max_score),
                    comment: g.comment || ""
                });
            }
        });

        res.json(Object.values(studentMap));
    } catch (err) {
        console.error("Error fetching student reports:", err);
        res.status(500).json({ error: "Failed to fetch student reports" });
    }
});



router.get("/dashboard/student-report/:childid", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { childid } = req.params;
    const { termid } = req.query;

    if (!termid) {
        return res.status(400).json({ error: "termid is required" });
    }

    try {
        // Check class teacher access to this student
        const authorized = await db.oneOrNone(
            `
            SELECT c.classid, c.classname, ch.fname, ch.lname
            FROM children ch
            JOIN childclasses cc ON cc.childid = ch.childid
            JOIN classes c ON cc.classid = c.classid
            WHERE ch.childid = $1 AND c.classteacher = $2
            LIMIT 1
            `,
            [childid, userId]
        );

        if (!authorized) {
            return res.status(403).json({ error: "Not authorized to view this student" });
        }

        // Fetch all grades for this student + term
        const grades = await db.any(
            `
            SELECT subject, assessment_name, score, max_score, comment
            FROM grades
            WHERE childid = $1 AND termid = $2
            ORDER BY subject, assessment_name
            `,
            [childid, termid]
        );

        // Group grades by subject
        const gradesBySubject = {};
        const averages = {};
        let totalScore = 0, totalMax = 0;

        grades.forEach(g => {
            if (!gradesBySubject[g.subject]) {
                gradesBySubject[g.subject] = [];
            }
            gradesBySubject[g.subject].push({
                assessment_name: g.assessment_name,
                score: parseFloat(g.score),
                max_score: parseFloat(g.max_score),
                comment: g.comment || ""
            });

            totalScore += parseFloat(g.score);
            totalMax += parseFloat(g.max_score);
        });

        // Subject-wise averages
        for (const subject in gradesBySubject) {
            const subjectGrades = gradesBySubject[subject];
            const sTotal = subjectGrades.reduce((sum, g) => sum + g.score, 0);
            const sMax = subjectGrades.reduce((sum, g) => sum + g.max_score, 0);
            averages[subject] = sMax > 0 ? parseFloat((sTotal / sMax) * 100).toFixed(1) : 0;
        }

        averages.totalAverage = totalMax > 0 ? parseFloat((totalScore / totalMax) * 100).toFixed(1) : 0;

        res.json({
            student: {
                childid,
                name: `${authorized.fname} ${authorized.lname}`,
                classname: authorized.classname
            },
            gradesBySubject,
            averages
        });
    } catch (err) {
        console.error("Error fetching student report:", err);
        res.status(500).json({ error: "Failed to fetch student report" });
    }
});










router.get("/dashboard/student-report-pdf/:childid", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { childid } = req.params;
    const { termid } = req.query;

    if (!termid) return res.status(400).json({ error: "termid is required" });

    try {
        const studentInfo = await db.oneOrNone(`
            SELECT c.classid, c.classname, ch.fname, ch.lname
            FROM children ch
            JOIN childclasses cc ON cc.childid = ch.childid
            JOIN classes c ON cc.classid = c.classid
            WHERE ch.childid = $1 AND c.classteacher = $2
            LIMIT 1
        `, [childid, userId]);

        if (!studentInfo) return res.status(403).json({ error: "Not authorized" });

        const term = await db.oneOrNone(`SELECT name FROM terms WHERE termid = $1`, [termid]);

        const grades = await db.any(`
            SELECT subject, assessment_name, score, max_score, comment
            FROM grades
            WHERE childid = $1 AND termid = $2
            ORDER BY subject, assessment_name
        `, [childid, termid]);

        const subjectMap = {};
        grades.forEach(g => {
            if (!subjectMap[g.subject]) subjectMap[g.subject] = [];
            subjectMap[g.subject].push(g);
        });

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${studentInfo.fname}_${studentInfo.lname}_Report.pdf"`);
            res.send(pdfData);
        });

        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const colWidths = [160, 160, pageWidth - 320]; // 3 columns

        const drawTableHeader = (headers, y) => {
            doc.rect(50, y, pageWidth, 20).fill('#93c5fd');
            doc.fillColor('black').font('Helvetica-Bold').fontSize(12);
            let x = 50;
            headers.forEach((h, i) => {
                doc.text(h, x + 5, y + 5, { width: colWidths[i], align: 'center' });
                x += colWidths[i];
            });
            return y + 20;
        };

        const drawTableRow = (rowData, y) => {
            doc.font('Helvetica').fontSize(11);
            let x = 50;
            rowData.forEach((text, i) => {
                doc.rect(x, y, colWidths[i], 20).stroke(); // Cell border
                doc.text(text, x + 5, y + 5, { width: colWidths[i] - 10, align: 'center' });
                x += colWidths[i];
            });
            return y + 20;
        };

        // Title
        doc.fontSize(18).font('Helvetica-Bold').fillColor('black')
            .text(`${studentInfo.fname} ${studentInfo.lname} – ${studentInfo.classname} (${term?.name})`);
        doc.moveDown(1);

        let y = doc.y;

        for (const [subject, rows] of Object.entries(subjectMap)) {
            // Subject heading
            doc.fontSize(14).font('Helvetica-Bold').fillColor('black').text(subject, 50, y);
            y += 25;

            // Table header
            y = drawTableHeader(["Assessment", "Score", "Comment"], y);

            // Table rows
            for (const g of rows) {
                const percent = (parseFloat(g.score) / parseFloat(g.max_score)) * 100;
                const color = percent < 50 ? 'red' : 'green';
                const scoreText = `${g.score} / ${g.max_score} (${percent.toFixed(1)}%)`;

                // Check for page overflow
                if (y > doc.page.height - 80) {
                    doc.addPage();
                    y = 50;
                }

                doc.fillColor('black');
                y = drawTableRow(
                    [
                        g.assessment_name,
                        { text: scoreText, color },
                        g.comment || "-"
                    ].map(cell => (typeof cell === "string" ? cell : "")),
                    y
                );

                // Draw colored text manually after drawing score cell
                const scoreX = 50 + colWidths[0];
                doc.fillColor(color).text(scoreText, scoreX + 5, y - 15, {
                    width: colWidths[1] - 10,
                    align: 'center'
                });
            }

            y += 20;
        }

        doc.end();

    } catch (err) {
        console.error("PDF generation error:", err);
        res.status(500).json({ error: "Failed to generate PDF" });
    }
});


router.get("/classes/my-classes", requireLogin, async (req, res) => {
    const userId = req.session.userID;

    // get role
    const roleInfo = await db.one("SELECT role FROM users WHERE userid=$1", [userId]);

    let classes;
    if (roleInfo.role === "class teacher") {
        classes = await db.any(
            "SELECT classid, classname FROM classes WHERE classteacher=$1",
            [userId]
        );
    } else {
        classes = await db.any(
            `SELECT c.classid, c.classname
       FROM classes c
       JOIN userclasses uc ON uc.classid = c.classid
       WHERE uc.userid = $1`,
            [userId]
        );
    }
    res.json(classes);
});


export default router;
