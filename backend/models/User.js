// models/User.js
// -----------------------------------------------------------------------
// Defines the shape of a "User" document in MongoDB.
//
// Key fields to understand for interviews:
// - password: NEVER stored in plain text. We hash it with bcrypt before saving.
// - plan: "free" or "pro" - controls how many generations a user gets per day.
// - usageCount / usageResetDate: used to enforce the free-tier rate limit.
// - stripeCustomerId: links this user to their Stripe customer record so we
//   can look them up when Stripe sends us webhook events.
// -----------------------------------------------------------------------

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // MongoDB will create a unique index on this field
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    plan: {
      type: String,
      enum: ["free", "pro"], // only these two values are allowed
      default: "free",
    },
    usageCount: {
      type: Number,
      default: 0, // how many generations the user has used today
    },
    usageResetDate: {
      type: Date,
      default: Date.now, // when usageCount was last reset (used to reset daily)
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// -----------------------------------------------------------------------
// Mongoose "pre-save hook": this function runs automatically right before
// a User document is saved to the database. We use it to hash the
// password so we NEVER store plain-text passwords.
// -----------------------------------------------------------------------
userSchema.pre("save", async function (next) {
  // Only hash the password if it was actually changed (or is new).
  // This prevents re-hashing an already-hashed password when a user
  // updates some other field like their name.
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10); // generates random "salt" for hashing
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// -----------------------------------------------------------------------
// Instance method: lets us call `user.comparePassword(plainTextPassword)`
// anywhere we have a user document, to check login credentials.
// -----------------------------------------------------------------------
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
