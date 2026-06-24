const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { verifyToken, verifyRole } = require("../middleware/verifyToken");

// db is injected from index.js via router closure
// Call initPropertyRoutes(db) and use the returned router
function initPropertyRoutes(db) {
  const properties = db.collection("properties");

  // ─── GET /api/properties/featured ────────────────────────────────────────
  // 6 approved properties for homepage. No auth required.
  router.get("/featured", async (req, res) => {
    try {
      const result = await properties
        .find({ status: "approved" })
        .limit(6)
        .toArray();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch featured properties." });
    }
  });

  // ─── GET /api/properties ─────────────────────────────────────────────────
  // All approved properties with search, filter, sort, pagination.
  // No auth required (public route).
  router.get("/", async (req, res) => {
    try {
      const {
        location, // search by location string
        type, // filter by property type
        sort, // "price_asc" | "price_desc"
        page = 1,
        limit = 9,
      } = req.query;

      const filter = { status: "approved" };

      if (location) {
        filter.location = { $regex: location, $options: "i" };
      }

      if (type) {
        filter.type = { $regex: type, $options: "i" };
      }

      const sortOption =
        sort === "price_asc"
          ? { rent: 1 }
          : sort === "price_desc"
            ? { rent: -1 }
            : { createdAt: -1 }; // default: newest first

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await properties.countDocuments(filter);

      const result = await properties
        .find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      res.json({
        properties: result,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch properties." });
    }
  });

  // ─── GET /api/properties/:id ──────────────────────────────────────────────
  // Single property detail. No auth required.
  router.get("/:id", async (req, res) => {
    try {
      const property = await properties.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!property)
        return res.status(404).json({ error: "Property not found." });
      res.json(property);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch property." });
    }
  });

  // ─── POST /api/properties ─────────────────────────────────────────────────
  // Owner adds a new property. Status defaults to "pending".
  router.post("/", verifyToken, verifyRole("owner"), async (req, res) => {
    try {
      const {
        title,
        description,
        location,
        type,
        rent,
        rentType,
        bedrooms,
        bathrooms,
        size,
        amenities,
        images,
        extraFeatures,
      } = req.body;

      if (!title || !location || !rent) {
        return res
          .status(400)
          .json({ error: "Title, location, and rent are required." });
      }

      const newProperty = {
        title,
        description: description || "",
        location,
        type: type || "Apartment",
        rent: parseFloat(rent),
        rentType: rentType || "Monthly",
        bedrooms: parseInt(bedrooms) || 0,
        bathrooms: parseInt(bathrooms) || 0,
        size: size || "",
        amenities: amenities || [],
        images: images || [],
        extraFeatures: extraFeatures || [],
        status: "pending",
        rejectionFeedback: null,
        owner: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await properties.insertOne(newProperty);
      res.status(201).json({ insertedId: result.insertedId, ...newProperty });
    } catch (err) {
      res.status(500).json({ error: "Failed to create property." });
    }
  });

  // ─── PUT /api/properties/:id ──────────────────────────────────────────────
  // Owner updates their own property.
  router.put(
    "/:id",
    verifyToken,
    verifyRole("owner", "admin"),
    async (req, res) => {
      try {
        const property = await properties.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!property)
          return res.status(404).json({ error: "Property not found." });

        // Owners can only update their own properties
        if (req.user.role === "owner" && property.owner.id !== req.user.id) {
          return res
            .status(403)
            .json({ error: "Forbidden: Not your property." });
        }

        const {
          title,
          description,
          location,
          type,
          rent,
          rentType,
          bedrooms,
          bathrooms,
          size,
          amenities,
          images,
          extraFeatures,
        } = req.body;

        const updateData = {
          ...(title && { title }),
          ...(description && { description }),
          ...(location && { location }),
          ...(type && { type }),
          ...(rent && { rent: parseFloat(rent) }),
          ...(rentType && { rentType }),
          ...(bedrooms && { bedrooms: parseInt(bedrooms) }),
          ...(bathrooms && { bathrooms: parseInt(bathrooms) }),
          ...(size && { size }),
          ...(amenities && { amenities }),
          ...(images && { images }),
          ...(extraFeatures && { extraFeatures }),
          updatedAt: new Date(),
        };

        await properties.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateData },
        );

        res.json({ message: "Property updated successfully." });
      } catch (err) {
        res.status(500).json({ error: "Failed to update property." });
      }
    },
  );

  // ─── DELETE /api/properties/:id ───────────────────────────────────────────
  // Owner deletes their own property. Admin can delete any.
  router.delete(
    "/:id",
    verifyToken,
    verifyRole("owner", "admin"),
    async (req, res) => {
      try {
        const property = await properties.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!property)
          return res.status(404).json({ error: "Property not found." });

        if (req.user.role === "owner" && property.owner.id !== req.user.id) {
          return res
            .status(403)
            .json({ error: "Forbidden: Not your property." });
        }

        await properties.deleteOne({ _id: new ObjectId(req.params.id) });
        res.json({ message: "Property deleted successfully." });
      } catch (err) {
        res.status(500).json({ error: "Failed to delete property." });
      }
    },
  );

  // ─── PATCH /api/properties/:id/status ────────────────────────────────────
  // Admin approves or rejects a property.
  // If rejected, must include rejectionFeedback.
  router.patch(
    "/:id/status",
    verifyToken,
    verifyRole("admin"),
    async (req, res) => {
      try {
        const { status, rejectionFeedback } = req.body;

        if (!["approved", "rejected"].includes(status)) {
          return res
            .status(400)
            .json({ error: "Status must be 'approved' or 'rejected'." });
        }

        if (status === "rejected" && !rejectionFeedback) {
          return res
            .status(400)
            .json({ error: "Rejection feedback is required." });
        }

        await properties.updateOne(
          { _id: new ObjectId(req.params.id) },
          {
            $set: {
              status,
              rejectionFeedback:
                status === "rejected" ? rejectionFeedback : null,
              updatedAt: new Date(),
            },
          },
        );

        res.json({ message: `Property ${status} successfully.` });
      } catch (err) {
        res.status(500).json({ error: "Failed to update property status." });
      }
    },
  );

  // ─── GET /api/properties/owner/my ────────────────────────────────────────
  // Owner sees only their own properties (all statuses).
  router.get(
    "/owner/my",
    verifyToken,
    verifyRole("owner"),
    async (req, res) => {
      try {
        const result = await properties
          .find({ "owner.id": req.user.id })
          .sort({ createdAt: -1 })
          .toArray();
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch your properties." });
      }
    },
  );

  // ─── GET /api/properties/admin/all ───────────────────────────────────────
  // Admin sees all properties regardless of status.
  router.get(
    "/admin/all",
    verifyToken,
    verifyRole("admin"),
    async (req, res) => {
      try {
        const result = await properties
          .find({})
          .sort({ createdAt: -1 })
          .toArray();
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch all properties." });
      }
    },
  );

  return router;
}

module.exports = initPropertyRoutes;
