const express = require("express");
const { ObjectId } = require("mongodb");
const { verifyToken, verifyRole } = require("../middleware/verifyToken");
const Stripe = require("stripe");

function initPaymentRoutes(db) {
  const router = express.Router();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const transactions = db.collection("transactions");
  const properties = db.collection("properties");

  // ─── POST /api/payments/create-intent ────────────────────────────────────
  // Called when tenant clicks "Book Property" and confirms booking modal.
  // Returns a Stripe clientSecret for the frontend to complete payment.
  router.post(
    "/create-intent",
    verifyToken,
    verifyRole("tenant"),
    async (req, res) => {
      try {
        const { propertyId, amount } = req.body;

        if (!propertyId || !amount) {
          return res
            .status(400)
            .json({ error: "propertyId and amount are required." });
        }

        const property = await properties.findOne({
          _id: new ObjectId(propertyId),
        });
        if (!property)
          return res.status(404).json({ error: "Property not found." });

        // Stripe amount is in the smallest currency unit (paisa for BDT)
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(parseFloat(amount) * 100), // convert to paisa
          currency: "bdt",
          metadata: {
            propertyId: propertyId.toString(),
            tenantId: req.user.id,
            tenantEmail: req.user.email,
          },
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (err) {
        console.error("[payments/create-intent]", err);
        res.status(500).json({ error: "Failed to create payment intent." });
      }
    },
  );

  // ─── POST /api/payments/confirm ───────────────────────────────────────────
  // Called after Stripe payment succeeds on the frontend.
  // Saves the transaction record to MongoDB.
  router.post(
    "/confirm",
    verifyToken,
    verifyRole("tenant"),
    async (req, res) => {
      try {
        const {
          propertyId,
          transactionId, // Stripe paymentIntent ID
          amount,
        } = req.body;

        if (!propertyId || !transactionId || !amount) {
          return res
            .status(400)
            .json({
              error: "propertyId, transactionId, and amount are required.",
            });
        }

        const property = await properties.findOne({
          _id: new ObjectId(propertyId),
        });
        if (!property)
          return res.status(404).json({ error: "Property not found." });

        // Prevent duplicate transaction records
        const existing = await transactions.findOne({ transactionId });
        if (existing) {
          return res
            .status(409)
            .json({ error: "Transaction already recorded." });
        }

        const newTransaction = {
          transactionId,
          propertyId: new ObjectId(propertyId),
          propertyTitle: property.title,
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
          amount: parseFloat(amount),
          currency: "BDT",
          status: "successful",
          createdAt: new Date(),
        };

        await transactions.insertOne(newTransaction);
        res.status(201).json({ success: true, transaction: newTransaction });
      } catch (err) {
        console.error("[payments/confirm]", err);
        res.status(500).json({ error: "Failed to save transaction." });
      }
    },
  );

  return router;
}

module.exports = initPaymentRoutes;
