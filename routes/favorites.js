const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyToken, verifyRole } = require("../middleware/verifyToken");

function initFavoriteRoutes(db) {
  const router = express.Router();
  const favorites = db.collection("favorites");
  const properties = db.collection("properties");

  // ─── POST /api/favorites ──────────────────────────────────────────────────
  // Tenant adds a property to favorites
  router.post("/", verifyToken, verifyRole("tenant"), async (req, res) => {
    try {
      const { propertyId } = req.body;
      if (!propertyId)
        return res.status(400).json({ error: "propertyId is required." });

      const property = await properties.findOne({
        _id: new ObjectId(propertyId),
      });
      if (!property)
        return res.status(404).json({ error: "Property not found." });

      // Prevent duplicate favorites
      const existing = await favorites.findOne({
        propertyId: new ObjectId(propertyId),
        "tenant.id": req.user.id,
      });

      if (existing) {
        return res.status(409).json({ error: "Already in favorites." });
      }

      const newFavorite = {
        propertyId: new ObjectId(propertyId),
        propertyTitle: property.title,
        propertyLocation: property.location,
        propertyImage: property.images?.[0] ?? "",
        propertyRent: property.rent,
        tenant: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
        },
        createdAt: new Date(),
      };

      const result = await favorites.insertOne(newFavorite);
      res.status(201).json({ insertedId: result.insertedId, ...newFavorite });
    } catch (err) {
      res.status(500).json({ error: "Failed to add favorite." });
    }
  });

  // ─── GET /api/favorites/my ────────────────────────────────────────────────
  // Tenant gets their favorites list
  router.get("/my", verifyToken, verifyRole("tenant"), async (req, res) => {
    try {
      const result = await favorites
        .find({ "tenant.id": req.user.id })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch favorites." });
    }
  });

  // ─── DELETE /api/favorites/:id ────────────────────────────────────────────
  // Tenant removes a favorite
  router.delete("/:id", verifyToken, verifyRole("tenant"), async (req, res) => {
    try {
      const favorite = await favorites.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!favorite)
        return res.status(404).json({ error: "Favorite not found." });

      if (favorite.tenant.id !== req.user.id) {
        return res.status(403).json({ error: "Forbidden: Not your favorite." });
      }

      await favorites.deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ message: "Removed from favorites." });
    } catch (err) {
      res.status(500).json({ error: "Failed to remove favorite." });
    }
  });

  return router;
}

module.exports = initFavoriteRoutes;
