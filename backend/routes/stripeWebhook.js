// routes/stripeWebhook.js
// -----------------------------------------------------------------------
// WHY THIS IS A SEPARATE FILE FROM stripeCheckout.js:
// Stripe requires the EXACT RAW bytes of the request body to verify that
// a webhook really came from Stripe (it signs the raw payload and we
// re-compute that signature ourselves to compare). If Express's
// express.json() middleware runs first, it parses the body into a JS
// object and the original raw bytes are gone - signature verification
// would fail. So this route must be mounted in server.js BEFORE
// app.use(express.json()) runs globally, using express.raw() instead.
// -----------------------------------------------------------------------

const express = require("express");
const Stripe = require("stripe");
const User = require("../models/User");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// POST /api/stripe/webhook
// express.raw() here gives us the untouched request body as a Buffer.
router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    // This throws if the signature doesn't match - i.e. the request
    // wasn't actually sent by Stripe (or the body was tampered with).
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // We only need to react to a completed checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata.userId;

    await User.findByIdAndUpdate(userId, {
      plan: "pro",
      stripeCustomerId: session.customer,
    });

    console.log(`User ${userId} upgraded to Pro plan`);
  }

  // Respond quickly with 200 - if Stripe doesn't get this, it will retry
  res.json({ received: true });
});

module.exports = router;
