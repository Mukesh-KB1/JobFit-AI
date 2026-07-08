// routes/stripeCheckout.js
// -----------------------------------------------------------------------
// Handles creating a Stripe Checkout session when a user clicks
// "Upgrade to Pro". This route uses a normal JSON body, unlike the
// webhook route which needs the raw request body (see stripeWebhook.js
// for why they're split into separate files).
// -----------------------------------------------------------------------

const express = require("express");
const Stripe = require("stripe");
const { protect } = require("../middleware/auth");
const User = require("../models/User");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// POST /api/stripe/create-checkout-session
router.post("/create-checkout-session", protect, async (req, res) => {
  try {
    const user = req.user;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription", // recurring monthly plan (use "payment" for a one-time charge)
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // price ID created in the Stripe dashboard
          quantity: 1,
        },
      ],
      // We embed the user's MongoDB ID here so the webhook handler knows
      // exactly which user to upgrade once payment is confirmed.
      metadata: {
        userId: user._id.toString(),
      },
      success_url: `${process.env.CLIENT_URL}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/dashboard?upgraded=false`,
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ message: "Stripe error", error: error.message });
  }
});

// GET /api/stripe/verify-session?session_id=cs_test_...
// Fallback check: confirms directly with Stripe that a payment succeeded,
// in case the webhook is slow or hasn't arrived yet, and upgrades the
// user immediately. Safe to call even if the webhook already did this.
router.get("/verify-session", protect, async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ message: "Missing session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.metadata?.userId !== req.user._id.toString()) {
      return res.status(403).json({ message: "This session does not belong to you" });
    }

    if (session.payment_status !== "paid") {
      return res.json({ upgraded: false, plan: req.user.plan });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { plan: "pro", stripeCustomerId: session.customer },
      { new: true }
    ).select("-password");

    res.json({ upgraded: true, plan: user.plan, user });
  } catch (error) {
    res.status(500).json({ message: "Could not verify session", error: error.message });
  }
});

module.exports = router;
