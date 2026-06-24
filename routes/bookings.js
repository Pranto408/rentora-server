const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyToken, verifyRole } = require("../middleware/verifyToken");

function initBookingRoutes(db) {
  const router = express.Router();
  const bookings = db.collection("bookings");
  const properties = db.collection("properties");

  // ─── POST /api/bookings ───────────────────────────────────────────────────
  // Tenant creates a booking (called after successful Stripe payment)
  router.post("/", verifyToken, verifyRole("tenant"), async (req, res) => {
    try {
      const {
        propertyId,
        moveInDate,
        contactNumber,
        additionalNotes,
        transactionId,
        amountPaid,
      } = req.body;

      if (!propertyId || !moveInDate || !contactNumber || !transactionId) {
        return res
          .status(400)
          .json({
            error:
              "propertyId, moveInDate, contactNumber, and transactionId are required.",
          });
      }

      const property = await properties.findOne({
        _id: new ObjectId(propertyId),
      });
      if (!property)
        return res.status(404).json({ error: "Property not found." });

      const newBooking = {
        propertyId: new ObjectId(propertyId),
        propertyTitle: property.title,
        propertyLocation: property.location,
        propertyImage: property.images?.[0] ?? "",
        tenant: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
        },
        owner: {
          id: property.owner.id,
          name: property.owner.name,
          email: property.owner.email,
        },
        moveInDate,
        contactNumber,
        additionalNotes: additionalNotes ?? "",
        amountPaid: parseFloat(amountPaid),
        transactionId,
        bookingStatus: "pending", // pending | approved | rejected
        paymentStatus: "paid",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await bookings.insertOne(newBooking);
      res.status(201).json({ insertedId: result.insertedId, ...newBooking });
    } catch (err) {
      console.error("[bookings/post]", err);
      res.status(500).json({ error: "Failed to create booking." });
    }
  });

  // ─── GET /api/bookings/my ─────────────────────────────────────────────────
  // Tenant sees their own bookings
  router.get("/my", verifyToken, verifyRole("tenant"), async (req, res) => {
    try {
      const result = await bookings
        .find({ "tenant.id": req.user.id })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch your bookings." });
    }
  });

  // ─── GET /api/bookings/owner ──────────────────────────────────────────────
  // Owner sees all bookings for their properties
  router.get("/owner", verifyToken, verifyRole("owner"), async (req, res) => {
    try {
      const result = await bookings
        .find({ "owner.id": req.user.id })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch booking requests." });
    }
  });

  // ─── GET /api/bookings/admin ──────────────────────────────────────────────
  // Admin sees all bookings
  router.get("/admin", verifyToken, verifyRole("admin"), async (req, res) => {
    try {
      const result = await bookings.find({}).sort({ createdAt: -1 }).toArray();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch all bookings." });
    }
  });

  // ─── PATCH /api/bookings/:id/status ──────────────────────────────────────
  // Owner approves or rejects a booking
  router.patch(
    "/:id/status",
    verifyToken,
    verifyRole("owner"),
    async (req, res) => {
      try {
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status)) {
          return res
            .status(400)
            .json({ error: "Status must be 'approved' or 'rejected'." });
        }

        const booking = await bookings.findOne({
          _id: new ObjectId(req.params.id),
        });
        if (!booking)
          return res.status(404).json({ error: "Booking not found." });

        if (booking.owner.id !== req.user.id) {
          return res
            .status(403)
            .json({ error: "Forbidden: Not your booking." });
        }

        await bookings.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { bookingStatus: status, updatedAt: new Date() } },
        );

        res.json({ message: `Booking ${status} successfully.` });
      } catch (err) {
        res.status(500).json({ error: "Failed to update booking status." });
      }
    },
  );

  return router;
}

module.exports = initBookingRoutes;
