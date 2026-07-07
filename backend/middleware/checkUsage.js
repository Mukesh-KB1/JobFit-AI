// middleware/checkUsage.js
// -----------------------------------------------------------------------
// Enforces the free-tier limit: 3 generations per day for "free" plan
// users, unlimited for "pro" plan users.
//
// IMPORTANT interview point: this check happens on the SERVER, not just
// hidden in the UI. A user could bypass a disabled button in React using
// browser dev tools, but they can't bypass a check that runs in our
// Express route before the AI API is even called.
// -----------------------------------------------------------------------

const FREE_DAILY_LIMIT = 3;

const checkUsage = async (req, res, next) => {
  const user = req.user; // set by the `protect` middleware that runs before this

  // Pro users have no limit - skip straight through
  if (user.plan === "pro") {
    return next();
  }

  const now = new Date();
  const lastReset = new Date(user.usageResetDate);

  // Check if it's a new day since the last reset (simple daily reset logic)
  const isNewDay =
    now.getFullYear() !== lastReset.getFullYear() ||
    now.getMonth() !== lastReset.getMonth() ||
    now.getDate() !== lastReset.getDate();

  if (isNewDay) {
    // Reset the counter for a new day
    user.usageCount = 0;
    user.usageResetDate = now;
    await user.save();
  }

  if (user.usageCount >= FREE_DAILY_LIMIT) {
    return res.status(429).json({
      message: `Free plan limit reached (${FREE_DAILY_LIMIT}/day). Upgrade to Pro for unlimited generations.`,
      limitReached: true,
    });
  }

  next();
};

module.exports = { checkUsage, FREE_DAILY_LIMIT };
