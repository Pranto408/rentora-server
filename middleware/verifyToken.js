const jwt = require("jsonwebtoken");

/**
 * verifyToken
 * Checks Authorization: Bearer <token> header.
 * Attaches decoded payload to req.user.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, ... }
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid or expired token." });
  }
}

/**
 * verifyRole(...roles)
 * Usage: verifyRole("admin") or verifyRole("owner", "admin")
 * Always use AFTER verifyToken.
 */
function verifyRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: `Forbidden: Requires role ${roles.join(" or ")}.` });
    }
    next();
  };
}

module.exports = { verifyToken, verifyRole };
