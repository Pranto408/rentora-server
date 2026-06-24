const express = require("express");
const jwt = require("jsonwebtoken");

function initAuthRoutes(db) {
  const router = express.Router();
  const users = db.collection("user"); // BetterAuth's collection

  // ─── POST /api/auth/token ─────────────────────────────────────────────────
  // Frontend calls this after BetterAuth login to get a JWT for the Express API.
  // Body: { email }  (BetterAuth session already verified on client side)
  router.post("/token", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required." });
      }

      const user = await users.findOne({ email });

      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      const token = jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role ?? "tenant",
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      res.json({ token });
    } catch (err) {
      console.error("[auth/token]", err);
      res.status(500).json({ error: "Failed to generate token." });
    }
  });

  return router;
}

module.exports = initAuthRoutes;
