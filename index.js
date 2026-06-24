const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB!");

    const db = client.db(process.env.DB_NAME);

    // ─── Import route initializers ─────────────────────────────────────────
    const initAuthRoutes = require("./routes/auth");
    const initPropertyRoutes = require("./routes/properties");
    const initBookingRoutes = require("./routes/bookings");
    const initFavoriteRoutes = require("./routes/favorites");
    const initReviewRoutes = require("./routes/reviews");
    const initPaymentRoutes = require("./routes/payments");
    const initTransactionRoutes = require("./routes/transactions");
    const initUserRoutes = require("./routes/users");

    // ─── Register routes ───────────────────────────────────────────────────
    app.use("/api/auth", initAuthRoutes(db));
    app.use("/api/properties", initPropertyRoutes(db));
    app.use("/api/bookings", initBookingRoutes(db));
    app.use("/api/favorites", initFavoriteRoutes(db));
    app.use("/api/reviews", initReviewRoutes(db));
    app.use("/api/payments", initPaymentRoutes(db));
    app.use("/api/transactions", initTransactionRoutes(db));
    app.use("/api/users", initUserRoutes(db));
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

run();

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "Rentora API is running 🚀" });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
