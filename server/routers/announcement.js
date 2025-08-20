import express from "express"
import db from "../db.js"


const router = express.Router();

router.post("/", async (req, res) => {
  const { title, description, start, end, classid } = req.body;
  const created_by = req.session.userID;

  if (!title || !classid || !created_by) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const announcement = await db.one(
      `INSERT INTO announcements (title, description, start, "end", classid, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description, start, end, classid, created_by]
    );
    res.status(201).json(announcement);
  } catch (err) {
    console.error("Failed to create announcement:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.get("/my", async (req, res) => {
  const userID = req.session.userID;

  if (!userID) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const announcements = await db.any(
        `SELECT 
          a.announcementid AS id,
          a.title,
          a.description,
          to_char(a."start", 'YYYY-MM-DD HH24:MI') AS start,
          to_char(a."end", 'YYYY-MM-DD HH24:MI')   AS end,
          a.classid,
          c.classname,
          CASE WHEN ar.announcementid IS NOT NULL THEN true ELSE false END AS read
        FROM announcements a
        JOIN classes c ON a.classid = c.classid
        LEFT JOIN announcement_reads ar 
       ON ar.announcementid = a.announcementid 
      AND ar.userid = $1       
      WHERE a.created_by = $1;`,
      [userID]
    );

    res.status(200).json(announcements);
  } catch (err) {
    console.error("Error fetching announcements:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.delete("/:id", async (req, res) => {
  const announcementId = req.params.id;
  const userID = req.session.userID;

  if (!userID) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    //Ensure the announcement belongs to the logged-in user
    const result = await db.result(
      `DELETE FROM announcements 
       WHERE announcementid = $1 AND created_by = $2`,
      [announcementId, userID]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Announcement not found or unauthorized" });
    }

    res.status(200).json({ message: "Announcement deleted successfully" });
  } catch (err) {
    console.error("Error deleting announcement:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/for-parent", async (req, res) => {
  const userID = req.session.userID;

  if (!userID) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const announcements = await db.any(
      `
     SELECT 
  a.announcementid AS id, 
  a.title,
  a.description,
  to_char(a.start, 'YYYY-MM-DD HH24:MI') AS start,
  to_char(a.end,   'YYYY-MM-DD HH24:MI') AS end,
  a.classid,
  c.classname,
  u.userid AS teacher_id,
  u.fname || ' ' || u.lname AS teacher_name,
  uc.role AS teacher_role,
  ch.fname || ' ' || ch.lname AS child_name,
  (ar.announcementid IS NOT NULL) AS read          -- 👈 per-parent read flag
FROM children ch
JOIN childclasses cc ON cc.childid = ch.childid
JOIN classes c       ON c.classid = cc.classid
JOIN announcements a ON a.classid = c.classid
JOIN users u         ON u.userid = a.created_by
JOIN userclasses uc  ON uc.userid = u.userid AND uc.classid = a.classid
LEFT JOIN announcement_reads ar
       ON ar.announcementid = a.announcementid
      AND ar.userid = $1                           -- 👈 parent userid
WHERE ch.parentid = $1
ORDER BY a.start DESC;
          `,
      [userID]
    );

    res.json(announcements);
  } catch (err) {
    console.error("Error fetching announcements for parent:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.post('/read',async (req,res)=>{
  const {announcementID} = req.body;
   const userID = req.session.userID;
    try {
      const read = await db.any(
          ` 
      INSERT INTO announcement_reads (announcementid, userid)
      VALUES ($1, $2)
      ON CONFLICT (announcementid, userid) DO UPDATE
      SET last_viewed_at = NOW(),
          view_count     = announcement_reads.view_count + 1;
      `, [announcementID,userID]
        )
    res.json(read);
  } catch (err) {
    console.error("Error inserting read:", err);
    res.status(500).json({ error: "Failed to insert read" });
  }
})

export default router;