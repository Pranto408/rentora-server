const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyToken, verifyRole } = require("../middleware/verifyToken");

function initReviewRoutes(db) {
  const router = express.Router();
  const reviews = db.collection("reviews");

  // ─── POST /api/reviews ────────────────────────────────────────────────────
  // Logged-in tenant submits a review for a property
  router.post("/", verifyToken, verifyRole("tenant"), async (req, res) => {
    try {
      const { propertyId, rating, comment } = req.body;

      if (!propertyId || !rating || !comment) {
        return res
          .status(400)
          .json({ error: "propertyId, rating, and comment are required." });
      }

      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ error: "Rating must be between 1 and 5." });
      }

      // One review per tenant per property
      const existing = await reviews.findOne({
        propertyId: new ObjectId(propertyId),
        "tenant.id": req.user.id,
      });

      if (existing) {
        return res
          .status(409)
          .json({ error: "You have already reviewed this property." });
      }

      const newReview = {
        propertyId: new ObjectId(propertyId),
        tenant: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
        },
        rating: parseInt(rating),
        comment,
        createdAt: new Date(),
      };

      const result = await reviews.insertOne(newReview);
      res.status(201).json({ insertedId: result.insertedId, ...newReview });
    } catch (err) {
      res.status(500).json({ error: "Failed to submit review." });
    }
  });

  // ─── GET /api/reviews/:propertyId ────────────────────────────────────────
  // Get all reviews for a specific property (public)
  router.get("/:propertyId", async (req, res) => {
    try {
      const result = await reviews
        .find({ propertyId: new ObjectId(req.params.propertyId) })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch reviews." });
    }
  });

  // ─── GET /api/reviews ─────────────────────────────────────────────────────
  // Get all reviews (for homepage customer reviews section — public)
  router.get("/", async (req, res) => {
    try {
      const { limit = 4 } = req.query;
      const result = await reviews
        .find({})
        .sort({ rating: -1, createdAt: -1 })
        .limit(parseInt(limit))
        .toArray();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch reviews." });
    }
  });

  return router;
}

module.exports = initReviewRoutes;
