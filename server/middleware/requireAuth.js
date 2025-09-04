// server/middleware/requireAuth.js
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userID) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  // normalize onto req.user for downstream code if needed
  req.user = {
    userid: req.session.userID,
    userRole: req.session.userRole,
    name: req.session.name,
    schoolID: req.session.schoolID,
  };
  next();
}
