// routes/history.js
// -----------------------------------------------------------------------
// Lets a logged-in user view their past tailored resumes.
// Good example of a simple filtered MongoDB query using an indexed field.
// -----------------------------------------------------------------------

const express = require("express");
const { protect } = require("../middleware/auth");
const Generation = require("../models/Generation");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const generations = await Generation.find({ user: req.user._id })
      .sort({ createdAt: -1 }) // most recent first
      .select("jobDescription tailoredResume createdAt"); // omit originalResume to keep payload small

    res.json(generations);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
