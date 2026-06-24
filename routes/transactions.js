const express = require("express");
const { verifyToken, verifyRole } = require("../middleware/verifyToken");

function initTransactionRoutes(db) {
  const router = express.Router();
  const transactions = db.collection("transactions");

  // ─── GET /api/transactions/admin ─────────────────────────────────────────
  // Admin sees all transactions
  router.get("/admin", verifyToken, verifyRole("admin"), async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await transactions.countDocuments();

      const result = await transactions
        .find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      res.json({
        transactions: result,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch transactions." });
    }
  });

  // ─── GET /api/transactions/owner ─────────────────────────────────────────
  // Owner sees their own earnings + monthly breakdown for chart
  router.get("/owner", verifyToken, verifyRole("owner"), async (req, res) => {
    try {
      const result = await transactions
        .find({ "owner.id": req.user.id, status: "successful" })
        .sort({ createdAt: -1 })
        .toArray();

      // Build monthly earnings for the last 12 months (for recharts)
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const now = new Date();
      const monthly = [];

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = months[d.getMonth()];
        const earnings = result
          .filter((t) => {
            const td = new Date(t.createdAt);
            return (
              td.getFullYear() === d.getFullYear() &&
              td.getMonth() === d.getMonth()
            );
          })
          .reduce((sum, t) => sum + t.amount, 0);
        monthly.push({ month: label, earnings });
      }

      const totalEarnings = result.reduce((sum, t) => sum + t.amount, 0);

      res.json({ transactions: result, totalEarnings, monthly });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch owner transactions." });
    }
  });

  return router;
}

module.exports = initTransactionRoutes;
