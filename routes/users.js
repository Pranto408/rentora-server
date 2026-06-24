const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyToken, verifyRole } = require("../middleware/verifyToken");

function initUserRoutes(db) {
  const router = express.Router();
  const users = db.collection("user"); // BetterAuth collection name

  // ─── GET /api/users ───────────────────────────────────────────────────────
  // Admin gets all users with pagination
  router.get("/", verifyToken, verifyRole("admin"), async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await users.countDocuments();

      const result = await users
        .find({}, { projection: { password: 0 } }) // never return password
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      res.json({
        users: result,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users." });
    }
  });

  // ─── PATCH /api/users/:id/role ────────────────────────────────────────────
  // Admin changes a user's role
  router.patch(
    "/:id/role",
    verifyToken,
    verifyRole("admin"),
    async (req, res) => {
      try {
        const { role } = req.body;

        if (!["tenant", "owner", "admin"].includes(role)) {
          return res
            .status(400)
            .json({ error: "Role must be tenant, owner, or admin." });
        }

        // Prevent admin from changing their own role
        if (req.params.id === req.user.id) {
          return res
            .status(400)
            .json({ error: "You cannot change your own role." });
        }

        const result = await users.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { role, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "User not found." });
        }

        res.json({ message: `User role updated to ${role}.` });
      } catch (err) {
        res.status(500).json({ error: "Failed to update user role." });
      }
    },
  );

  return router;
}

module.exports = initUserRoutes;
