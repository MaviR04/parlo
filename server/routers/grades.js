import express from "express";
import db from "../db.js";

const router = express.Router();

// Middleware: Require login
function requireLogin(req, res, next) {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Not logged in" });
    }
    next();
}


/**
 * GET /api/grades/classes-with-roles
 * Returns only classes where teacher is subject teacher
 */
/**
 * GET /api/grades/classes-with-roles
 * Returns only classes where teacher is subject teacher (excludes Class Teacher role)
 */
router.get("/classes-with-roles", requireLogin, async (req, res) => {
    const userId = req.session.userID;

    try {
        const classesWithRoles = await db.any(
            `
            SELECT 
                c.classid, 
                c.classname, 
                uc.role
            FROM classes c
            INNER JOIN userclasses uc 
                ON c.classid = uc.classid 
                AND uc.userid = $1
            WHERE LOWER(uc.role) LIKE '%teacher%'
              AND LOWER(uc.role) NOT LIKE '%class teacher%'
            ORDER BY c.classname
            `,
            [userId]
        );

        res.json(classesWithRoles);
    } catch (err) {
        console.error("Error fetching subject teacher classes:", err);
        res.status(500).json({ error: "Failed to fetch subject teacher classes" });
    }
});

router.get("/assessment-timeline/:classid", async (req, res) => {
    const { classid } = req.params;

    try {
        const query = `
            SELECT 
                g.assessment_name,
                g.assessment_label,
                g.date_entered::date AS date,
                t.name AS term_name,
                ROUND(AVG(g.score * 100.0 / NULLIF(g.max_score, 0)), 1) AS average,
                COUNT(*) AS student_count,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'name', CONCAT(c.fname, ' ', c.lname),
                        'score', g.score,
                        'max_score', g.max_score
                    )
                    ORDER BY c.fname
                ) AS student_grades
            FROM grades g
            LEFT JOIN terms t ON g.termid = t.termid
            LEFT JOIN children c ON g.childid = c.childid
            WHERE g.classid = $1
            GROUP BY g.assessment_name, g.assessment_label, g.date_entered, t.name
            ORDER BY date ASC;
        `;

        const rows = await db.any(query, [classid]);
        res.json(rows);
    } catch (err) {
        console.error("❌ Error in assessment-timeline route:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});



/**
 * GET /api/grades/:classId/:termId
 * Get all grades for a class + term
 */
router.get("/:classId/:termId", requireLogin, async (req, res) => {
    const { classId, termId } = req.params;
    const teacherId = req.session.userID;

    try {
        // Make sure teacher is assigned as subject teacher for this class
        const authorized = await db.oneOrNone(
            `
            SELECT 1
            FROM userclasses
            WHERE classid = $1
              AND userid = $2
              AND LOWER(role) LIKE '%teacher%'
            `,
            [classId, teacherId]
        );
        if (!authorized) {
            return res.status(403).json({ error: "Not authorized" });
        }

        const grades = await db.any(
            `SELECT * FROM grades 
             WHERE classid = $1 AND termid = $2`,
            [classId, termId]
        );

        res.json(grades);
    } catch (err) {
        console.error("Error fetching grades:", err);
        res.status(500).json({ error: "Failed to fetch grades" });
    }
});




/**
 * GET /api/grades/subjects-for-class?classid=123
 * Returns distinct subjects from grades table for a given class
 */
router.get("/subjects-for-class", requireLogin, async (req, res) => {
    const { classid } = req.query;
    const userId = req.session.userID;

    if (!classid) {
        return res.status(400).json({ error: "classid query param is required" });
    }

    try {
        // Optional: verify user has teacher role for the class before returning subjects
        const allowed = await db.oneOrNone(
            `
      SELECT 1
      FROM userclasses
      WHERE classid = $1
        AND userid = $2
        AND LOWER(role) LIKE '%teacher%'
      `,
            [classid, userId]
        );
        if (!allowed) {
            return res.status(403).json({ error: "Not authorized for this class" });
        }

        const subjects = await db.any(
            `
      SELECT DISTINCT subject
      FROM grades
      WHERE classid = $1
      ORDER BY subject
      `,
            [classid]
        );

        res.json(subjects.map((s) => s.subject));
    } catch (err) {
        console.error("Error fetching subjects for class:", err);
        res.status(500).json({ error: "Failed to fetch subjects" });
    }
});



/**
 * GET /api/grades/students-for-class?classid=123
 * Returns all students for a given class
 */
router.get("/students-for-class", requireLogin, async (req, res) => {
    const { classid } = req.query;
    const userId = req.session.userID;

    if (!classid) {
        return res.status(400).json({ error: "classid is required" });
    }

    try {
        // Verify teacher is assigned to this class
        const allowed = await db.oneOrNone(
            `
            SELECT 1
            FROM userclasses
            WHERE classid = $1
              AND userid = $2
              AND LOWER(role) LIKE '%teacher%'
            `,
            [classid, userId]
        );

        if (!allowed) {
            return res.status(403).json({ error: "Not authorized for this class" });
        }

        const students = await db.any(
            `
            SELECT childid, fname, lname
            FROM children
            WHERE classid = $1
            ORDER BY lname, fname
            `,
            [classid]
        );

        res.json(students);
    } catch (err) {
        console.error("Error fetching students for class:", err);
        res.status(500).json({ error: "Failed to fetch students" });
    }
});


/**
 * GET /api/grades?classid=xx&subject=yyy
 * Returns grades filtered by class and subject
 */
router.get("/", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { classid, subject, termid } = req.query;

    if (!classid || !subject) {
        return res.status(400).json({ error: "classid and subject query params are required" });
    }

    try {
        const allowed = await db.oneOrNone(
            `
      SELECT 1
      FROM userclasses
      WHERE classid = $1
        AND userid = $2
        AND LOWER(role) LIKE '%teacher%'
      `,
            [classid, userId]
        );

        if (!allowed) {
            return res.status(403).json({ error: "Not authorized for this class" });
        }

        let query = `
      SELECT 
          g.*, 
          c.fname, 
          c.lname, 
          t.name AS term_name, 
          t.start_date, 
          t.end_date
      FROM grades g
      JOIN children c ON g.childid = c.childid
      LEFT JOIN terms t ON g.termid = t.termid
      WHERE g.classid = $1
        AND LOWER(g.subject) = LOWER($2)
    `;

        const params = [classid, subject];

        if (termid) {
            query += ` AND g.termid = $3`;
            params.push(termid);
        }

        query += ` ORDER BY c.lname, c.fname, g.assessment_name`;

        const grades = await db.any(query, params);

        res.json(grades);
    } catch (err) {
        console.error("Error fetching grades:", err);
        res.status(500).json({ error: "Failed to fetch grades" });
    }
});


// GET /api/grades/by-assessment?classid=..&subject=..&termid=..&assessment_name=..
router.get("/by-assessment", requireLogin, async (req, res) => {
  const userId = req.session.userID;
  const { classid, subject, termid, assessment_name } = req.query;

  if (!classid || !subject || !termid || !assessment_name) {
    return res.status(400).json({ error: "classid, subject, termid, assessment_name required" });
  }

  try {
    // auth: must be a (subject) teacher of this class
    const allowed = await db.oneOrNone(`
      SELECT 1 FROM userclasses
      WHERE classid = $1 AND userid = $2 AND LOWER(role) LIKE '%teacher%'
    `, [classid, userId]);

    if (!allowed) return res.status(403).json({ error: "Not authorized" });

    const rows = await db.any(`
      SELECT g.*, c.fname, c.lname
      FROM grades g
      JOIN children c ON c.childid = g.childid
      WHERE g.classid = $1
        AND LOWER(g.subject) = LOWER($2)
        AND g.termid = $3
        AND g.assessment_name = $4
      ORDER BY c.lname, c.fname
    `, [classid, subject, termid, assessment_name]);

    res.json(rows);
  } catch (err) {
    console.error("Error fetching by-assessment:", err);
    res.status(500).json({ error: "Failed to fetch assessment grades" });
  }
});


/**
 * POST /api/grades
 * Save or update a grade
 */
router.post("/", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const {
        childid,
        classid,
        subject,
        termid,
        assessment_name,
        score,
        max_score,
        comment
    } = req.body;

    if (!childid || !classid || !subject || !termid || !assessment_name) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // Verify subject teacher role for this class
        const allowed = await db.oneOrNone(
            `
            SELECT 1
            FROM userclasses
            WHERE classid = $1
              AND userid = $2
              AND LOWER(role) LIKE '%teacher%'
            `,
            [classid, userId]
        );

        if (!allowed) {
            return res.status(403).json({ error: "Not authorized for this class" });
        }

        // 🏷️ Generate label like "Monthly Test - Aug"
        const monthLabel = new Date().toLocaleString('en-US', { month: 'short' });
        const assessment_label = `${assessment_name} - ${monthLabel}`;

        await db.none(
            `
            INSERT INTO grades (
                childid, classid, subject, termid, assessment_name, assessment_label, score, max_score, comment, entered_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (childid, classid, subject, termid, assessment_label)
            DO UPDATE SET
                score = EXCLUDED.score,
                max_score = EXCLUDED.max_score,
                comment = EXCLUDED.comment,
                entered_by = EXCLUDED.entered_by,
                date_entered = NOW()
            `,
            [childid, classid, subject, termid, assessment_name, assessment_label, score, max_score, comment, userId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Error saving grade:", err);
        res.status(500).json({ error: "Failed to save grade" });
    }
});


// GET /api/grades/assessments-for-class
router.get("/assessments-for-class", requireLogin, async (req, res) => {
    const { classid, subject } = req.query;
    const userId = req.session.userID;

    if (!classid || !subject) {
        return res.status(400).json({ error: "classid and subject required" });
    }

    try {
        // Verify teacher is assigned to class
        const allowed = await db.oneOrNone(`
            SELECT 1 FROM userclasses
            WHERE classid = $1 AND userid = $2
              AND LOWER(role) LIKE '%teacher%'
        `, [classid, userId]);

        if (!allowed) {
            return res.status(403).json({ error: "Not authorized" });
        }

        const assessments = await db.any(`
            SELECT DISTINCT assessment_name
            FROM grades
            WHERE classid = $1 AND LOWER(subject) = LOWER($2)
            ORDER BY assessment_name
        `, [classid, subject]);

        res.json(assessments.map(a => a.assessment_name));
    } catch (err) {
        console.error("Error fetching assessments:", err);
        res.status(500).json({ error: "Failed to fetch assessments" });
    }
});




/**
 * POST /api/grades/batch
 * Save or update multiple grades in one request
 */
router.post("/batch", requireLogin, async (req, res) => {
    const userId = req.session.userID;
    const { grades } = req.body;

    if (!Array.isArray(grades) || grades.length === 0) {
        return res.status(400).json({ error: "Grades array is required" });
    }

    try {
        await db.tx(async (t) => {
            for (const g of grades) {
                const {
                    childid,
                    classid,
                    subject,
                    termid,
                    assessment_name,
                    score,
                    max_score,
                    comment
                } = g;

                // Verify subject teacher role for this class
                const allowed = await t.oneOrNone(
                    `
                    SELECT 1
                    FROM userclasses
                    WHERE classid = $1
                      AND userid = $2
                      AND LOWER(role) LIKE '%teacher%'
                    `,
                    [classid, userId]
                );
                if (!allowed) {
                    throw new Error(`Not authorized for class ${classid}`);
                }

                // 🏷️ Generate label like "Monthly Test - Aug"
                const monthLabel = new Date().toLocaleString('en-US', { month: 'short' });
                const assessment_label = `${assessment_name} - ${monthLabel}`;

                await t.none(
                    `
  INSERT INTO grades (
      childid, classid, subject, termid, assessment_name, assessment_label, score, max_score, comment, entered_by
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  ON CONFLICT (childid, classid, subject, termid, assessment_name)
  DO UPDATE SET
      assessment_label = EXCLUDED.assessment_label,
      score = EXCLUDED.score,
      max_score = EXCLUDED.max_score,
      comment = EXCLUDED.comment,
      entered_by = EXCLUDED.entered_by,
      date_entered = NOW()
  `,
                    [
                        childid,
                        classid,
                        subject,
                        termid,
                        assessment_name,
                        assessment_label || null,
                        score,
                        max_score,
                        comment,
                        userId
                    ]
                );

            }
        });

        res.json({ success: true, message: "Grades saved successfully" });
    } catch (err) {
        console.error("Error saving batch grades:", err);
        res.status(500).json({ error: err.message || "Failed to save grades" });
    }
});



// GET /api/grades/past-assessments?classid=xx&subject=yy
// GET /api/grades/past-assessments?classid=xx&subject=yy
router.get("/past-assessments", requireLogin, async (req, res) => {
    const { classid, subject } = req.query;
    const userId = req.session.userID;

    if (!classid || !subject) {
        return res.status(400).json({ error: "classid and subject required" });
    }

    try {
        const allowed = await db.oneOrNone(`
            SELECT 1 FROM userclasses
            WHERE classid = $1 AND userid = $2
              AND LOWER(role) LIKE '%teacher%'
        `, [classid, userId]);

        if (!allowed) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Get current and previous termid
        const currentTerm = await db.oneOrNone(`
            SELECT termid, start_date FROM terms
            WHERE CURRENT_DATE BETWEEN start_date AND end_date
            ORDER BY start_date DESC
            LIMIT 1
        `);

        if (!currentTerm) return res.json([]); // no current term found

        const previousTerm = await db.oneOrNone(`
            SELECT termid FROM terms
            WHERE start_date < $1
            ORDER BY start_date DESC
            LIMIT 1
        `, [currentTerm.start_date]);

        const validTermIds = previousTerm
            ? [currentTerm.termid, previousTerm.termid]
            : [currentTerm.termid];

        const past = await db.any(`
            SELECT 
                g.assessment_name, 
                MAX(g.date_entered) as last_date, 
                t.name AS term_name, 
                g.termid -- ✅ include termid so frontend knows it
            FROM grades g
            JOIN terms t ON g.termid = t.termid
            WHERE g.classid = $1
              AND LOWER(g.subject) = LOWER($2)
              AND g.termid = ANY($3)
            GROUP BY g.assessment_name, t.name, g.termid
            ORDER BY last_date DESC
        `, [classid, subject, validTermIds]);

        res.json(past);
    } catch (err) {
        console.error("Error fetching past assessments:", err);
        res.status(500).json({ error: "Failed to fetch past assessments" });
    }
});




export default router;
