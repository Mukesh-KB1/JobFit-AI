// server.js
// -----------------------------------------------------------------------
// The entry point of our backend. This file:
// 1. Loads environment variables
// 2. Connects to MongoDB
// 3. Sets up middleware (CORS, JSON parsing, rate limiting)
// 4. Wires up all our route files
// 5. Starts the server listening for requests
// -----------------------------------------------------------------------

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const generateRoutes = require("./routes/generate");
const historyRoutes = require("./routes/history");
const stripeCheckoutRoutes = require("./routes/stripeCheckout");
const stripeWebhookRoutes = require("./routes/stripeWebhook");

const app = express();

// Connect to MongoDB before accepting any requests
connectDB();

// -----------------------------------------------------------------------
// CORS: allows our React frontend (on a different port/domain) to call
// this API. In production, lock this down to your actual frontend URL.
// -----------------------------------------------------------------------
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// -----------------------------------------------------------------------
// IMPORTANT ORDER: the Stripe webhook route needs the RAW (unparsed) body
// to verify Stripe's signature, so it MUST be mounted BEFORE
// app.use(express.json()) runs globally below. If express.json() ran
// first, it would consume and parse the body, and the raw bytes Stripe
// needs for signature verification would already be gone.
// -----------------------------------------------------------------------
app.use("/api/stripe/webhook", stripeWebhookRoutes);

// Now apply JSON body parsing for every other route
app.use(express.json({ limit: "2mb" })); // allow slightly bigger payloads for pasted resumes

// -----------------------------------------------------------------------
// Global rate limiter: a basic defense against abuse/DDoS on top of our
// per-user usage limits. This limits by IP address regardless of login
// status - e.g. someone hammering the signup/login endpoints.
// -----------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: { message: "Too many requests, please try again later." },
});
app.use(globalLimiter);

// -----------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/stripe", stripeCheckoutRoutes); // handles /create-checkout-session (webhook already mounted above, before JSON parsing)

// Simple health check route - useful for confirming the server is alive
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// -----------------------------------------------------------------------
// Global error handler - catches any error thrown in route handlers that
// wasn't already caught, so the server never crashes silently.
// -----------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
