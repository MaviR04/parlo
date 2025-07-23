import express from "express"
import session from "express-session";
import pgp from "pg-promise";
import db from "../db.js"


const router = express.Router();


router.get('/conversations', async (req, res) => {
  
  console.log(req.session.userID)
  const userId = req.session.userID

  const query = `
    SELECT 
      c.ConversationID,
      u.UserID AS OtherUserID,
      u.Fname AS OtherFname,
      u.Lname AS OtherLname,
      u.Role AS OtherRole
    FROM Conversations c
    JOIN Users u 
      ON u.UserID = CASE 
                      WHEN c.Recipient1 = $1 THEN c.Recipient2
                      WHEN c.Recipient2 = $1 THEN c.Recipient1
                    END
    WHERE c.Recipient1 = $1 OR c.Recipient2 = $1
    ORDER BY c.ConversationID DESC;
  `;

  try {
    const conversations = await db.any(query, [userId]);
    res.json(conversations);
    console.log(conversations)
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router