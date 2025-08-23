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

// GET /api/grades/assessment-timeline/:classid?subject=English&termid=12&mine=1
router.get("/assessment-timeline/:classid", requireLogin, async (req, res) => {
  const { classid } = req.params;
  const { subject, termid, mine } = req.query;
  const userId = req.session.userID;

  if (!classid || !subject || !termid) {
    return res.status(400).json({ error: "classid, subject, termid are required" });
  }

  try {
    // auth: must be a teacher on this class
    const allowed = await db.oneOrNone(`
      SELECT 1 FROM userclasses
      WHERE classid = $1 AND userid = $2 AND LOWER(role) LIKE '%teacher%'
    `, [classid, userId]);
    if (!allowed) return res.status(403).json({ error: "Not authorized" });

    const rows = await db.any(`
      SELECT 
        g.assessment_name,
        g.assessment_label,
        g.date_entered::date AS date,
        t.name AS term_name,
        g.termid,
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
      JOIN terms t     ON g.termid  = t.termid
      JOIN children c  ON g.childid = c.childid
      WHERE g.classid = $1
        AND LOWER(g.subject) = LOWER($2)
        AND g.termid = $3
        ${String(mine) === "1" ? "AND g.entered_by = $4" : ""}
      GROUP BY g.assessment_name, g.assessment_label, g.date_entered::date, t.name, g.termid
      ORDER BY date ASC
    `, String(mine) === "1" ? [classid, subject, termid, userId] : [classid, subject, termid]);

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

  if (!classid) return res.status(400).json({ error: "classid query param is required" });

  try {
    // Must belong to this class (any role)
    const allowed = await db.oneOrNone(
      `SELECT 1 FROM userclasses WHERE classid = $1 AND userid = $2`,
      [classid, userId]
    );
    if (!allowed) return res.status(403).json({ error: "Not authorized for this class" });

    // Build subjects from the teacher's roles and authored grades
    const rows = await db.any(
      `
      WITH my_roles AS (
        SELECT DISTINCT
          trim(
            regexp_replace(
              regexp_replace(LOWER(role), '(?i)\\b(class|form|homeroom|head|assistant|coach)\\b', '', 'g'),
              '(?i)\\bteacher\\b', '', 'g'
            )
          ) AS role_subject
        FROM userclasses
        WHERE classid = $1 AND userid = $2 AND role IS NOT NULL
      ),
      from_roles AS (
        SELECT DISTINCT g.subject
        FROM grades g
        JOIN my_roles r ON LOWER(g.subject) = r.role_subject AND r.role_subject <> ''
        WHERE g.classid = $1
      ),
      from_authored AS (
        SELECT DISTINCT g.subject
        FROM grades g
        WHERE g.classid = $1 AND g.entered_by = $2
      )
      SELECT subject FROM from_roles
      UNION
      SELECT subject FROM from_authored
      ORDER BY subject;
      `,
      [classid, userId]
    );

    // If nothing matched (e.g., brand-new class), return empty array
    return res.json(rows.map(r => r.subject));
  } catch (err) {
    console.error("Error fetching subjects for class:", err);
    return res.status(500).json({ error: "Failed to fetch subjects" });
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
    // must be a teacher on this class
    const allowed = await db.oneOrNone(
      `SELECT 1
       FROM userclasses
       WHERE classid = $1::int AND userid = $2 AND LOWER(role) LIKE '%teacher%'`,
      [classid, userId]
    );
    if (!allowed) return res.status(403).json({ error: "Not authorized" });

    // Use existing columns (id, not gradeid). Trim + case-insensitive name match.
    const rows = await db.any(
      `
      SELECT
        g.id,
        g.childid, g.classid, g.termid, g.subject,
        g.assessment_name, g.assessment_label,
        g.score, g.max_score, g.comment,
        g.date_entered,
        c.fname, c.lname
      FROM grades g
      JOIN children c ON c.childid = g.childid
      WHERE g.classid = $1::int
        AND LOWER(g.subject) = LOWER($2)
        AND g.termid = $3::int
        AND LOWER(TRIM(g.assessment_name)) = LOWER(TRIM($4))
      ORDER BY c.lname, c.fname
      `,
      [classid, subject, termid, assessment_name]
    );

    return res.json(rows);
  } catch (err) {
    console.error("Error fetching by-assessment:", {
      params: req.query,
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Failed to fetch assessment grades" });
  }
});


/**
 * POST /api/grades
 * Save or update a grade
 */
router.post("/", requireLogin, async (req, res) => {
  const userId = req.session.userID;
  const {
    childid, classid, subject, termid,
    assessment_name, assessment_label, score, max_score, comment
  } = req.body;

  if (!childid || !classid || !subject || !termid || !assessment_name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const allowed = await db.oneOrNone(`
      SELECT 1 FROM userclasses
      WHERE classid = $1 AND userid = $2 AND LOWER(role) LIKE '%teacher%'`,
      [classid, userId]
    );
    if (!allowed) return res.status(403).json({ error: "Not authorized for this class" });

    const monthLabel = new Date().toLocaleString("en-US", { month: "short" });
    const labelToSave = assessment_label?.trim()
      ? assessment_label.trim()
      : `${assessment_name} - ${monthLabel}`;

    await db.none(`
      INSERT INTO grades (
        childid, classid, subject, termid,
        assessment_name, assessment_label,
        score, max_score, comment, entered_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (childid, classid, subject, termid, assessment_name)
      DO UPDATE SET
        score           = EXCLUDED.score,
        max_score       = EXCLUDED.max_score,
        comment         = EXCLUDED.comment,
        assessment_label= COALESCE(EXCLUDED.assessment_label, grades.assessment_label),
        entered_by      = EXCLUDED.entered_by
      -- NOTE: do NOT update date_entered here
    `,
      [childid, classid, subject, termid,
       assessment_name, labelToSave, score, max_score, comment, userId]
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
          gradeid, // <-- when editing existing row
          childid, classid, subject, termid,
          assessment_name, assessment_label,
          score, max_score, comment
        } = g;

        const allowed = await t.oneOrNone(`
          SELECT 1 FROM userclasses
          WHERE classid = $1 AND userid = $2 AND LOWER(role) LIKE '%teacher%'`,
          [classid, userId]
        );
        if (!allowed) throw new Error(`Not authorized for class ${classid}`);

        if (gradeid) {
          // ← Edit existing row IN PLACE (do not change date_entered)
          await t.none(`
            UPDATE grades
               SET score            = $1,
                   max_score        = $2,
                   comment          = $3,
                   assessment_label = COALESCE($4, assessment_label),
                   entered_by       = $5
             WHERE gradeid          = $6`,
            [score, max_score, comment, assessment_label ?? null, userId, gradeid]
          );
        } else {
          // ← Insert (or upsert by *name* within term)
          const monthLabel = new Date().toLocaleString("en-US", { month: "short" });
          const labelToSave = assessment_label?.trim()
            ? assessment_label.trim()
            : `${assessment_name} - ${monthLabel}`;

          await t.none(`
            INSERT INTO grades (
              childid, classid, subject, termid,
              assessment_name, assessment_label,
              score, max_score, comment, entered_by
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (childid, classid, subject, termid, assessment_name)
            DO UPDATE SET
              score            = EXCLUDED.score,
              max_score        = EXCLUDED.max_score,
              comment          = EXCLUDED.comment,
              assessment_label = COALESCE(EXCLUDED.assessment_label, grades.assessment_label),
              entered_by       = EXCLUDED.entered_by
          `,
            [childid, classid, subject, termid,
             assessment_name, labelToSave,
             score, max_score, comment, userId]
          );
        }
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


// GET /api/grades/assessment-stats?classid=..&subject=..&termid=..
router.get("/assessment-stats", requireLogin, async (req, res) => {
  const userId = req.session.userID;
  const { classid, subject, termid } = req.query;

  if (!classid || !subject || !termid) {
    return res.status(400).json({ error: "classid, subject, termid required" });
  }

  try {
    // must be a teacher on this class
    const allowed = await db.oneOrNone(
      `SELECT 1 FROM userclasses
       WHERE classid = $1 AND userid = $2 AND LOWER(role) LIKE '%teacher%'`,
      [classid, userId]
    );
    if (!allowed) return res.status(403).json({ error: "Not authorized" });

    // Count DISTINCT assessment_label occurrences within THIS term + class + subject,
    // and also provide counts per month and a month list (ordered).
    const rows = await db.any(
      `
      WITH raw AS (
        SELECT DISTINCT
          LOWER(TRIM(assessment_name)) AS name_key,
          assessment_label,
          DATE_TRUNC('month', date_entered)::date AS month_date,
          TO_CHAR(date_entered, 'Mon') AS mon
        FROM grades
        WHERE classid = $1
          AND LOWER(subject) = LOWER($2)
          AND termid = $3
      ),
      term_totals AS (
        SELECT name_key, COUNT(*) AS term_count
        FROM raw
        GROUP BY name_key
      ),
      per_month AS (
        SELECT name_key, mon, COUNT(*) AS cnt, MIN(month_date) AS first_date
        FROM raw
        GROUP BY name_key, mon
      ),
      month_map AS (
        SELECT name_key, jsonb_object_agg(mon, cnt) AS per_month
        FROM per_month
        GROUP BY name_key
      ),
      month_list AS (
        SELECT name_key, ARRAY_AGG(mon ORDER BY first_date) AS months_used
        FROM per_month
        GROUP BY name_key
      )
      SELECT
        t.name_key,
        t.term_count::int,
        COALESCE(m.per_month, '{}'::jsonb) AS per_month,
        COALESCE(l.months_used, ARRAY[]::text[]) AS months_used
      FROM term_totals t
      LEFT JOIN month_map m USING (name_key)
      LEFT JOIN month_list l USING (name_key)
      `,
      [classid, subject, termid]
    );

    const byName = {};
    rows.forEach(r => {
      byName[r.name_key] = {
        term_count: Number(r.term_count) || 0,
        per_month: r.per_month || {},
        months_used: r.months_used || []
      };
    });

    res.json({ byName });
  } catch (err) {
    console.error("Error in /assessment-stats:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});



export default router;
