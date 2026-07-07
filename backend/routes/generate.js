// routes/generate.js
// -----------------------------------------------------------------------
// The core AI feature. This route:
// 1. Requires login (protect middleware)
// 2. Checks the user hasn't hit their free-tier daily limit (checkUsage)
// 3. Streams the AI response back to the browser using Server-Sent Events
// 4. Saves the finished result to MongoDB for the history page
//
// WHY SERVER-SENT EVENTS (SSE)?
// SSE is a simple one-way streaming protocol built into HTTP - the server
// keeps the connection open and pushes small text chunks as they become
// available. It's simpler than WebSockets when you only need server->client
// streaming (no need for the client to send messages back on the same
// connection), which is exactly our use case here.
// -----------------------------------------------------------------------

const express = require("express");
const { protect } = require("../middleware/auth");
const { checkUsage } = require("../middleware/checkUsage");
const { streamTailoredResume } = require("../utils/geminiClient");
const Generation = require("../models/Generation");
const User = require("../models/User");

const router = express.Router();

router.post("/", protect, checkUsage, async (req, res) => {
  const { resume, jobDescription } = req.body;

  if (!resume || !jobDescription) {
    return res.status(400).json({ message: "Resume and job description are required" });
  }

  // ---- Set up the response as an SSE stream ----
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // send headers immediately, before we have any body content

  try {
    // Each chunk of text the model generates gets sent to the browser
    // immediately via this callback, formatted as an SSE "data:" event.
    const onChunk = (chunk) => {
      // SSE format requires each message to start with "data: " and end
      // with two newlines. We JSON-encode the chunk so special characters
      // (quotes, newlines inside the text) don't break the format.
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    };

    const fullResult = await streamTailoredResume({
      resume,
      jobDescription,
      onChunk,
    });

    // Tell the frontend the stream is finished
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    // ---- Save to history AFTER the response is sent ----
    // We don't want the user to wait for this DB write before seeing
    // their result, so it happens after res.end().
    await Generation.create({
      user: req.user._id,
      jobDescription,
      originalResume: resume,
      tailoredResume: fullResult,
    });

    // Increment usage count for free-tier users
    if (req.user.plan === "free") {
      await User.findByIdAndUpdate(req.user._id, { $inc: { usageCount: 1 } });
    }
  } catch (error) {
    console.error("Generation error:", error.message);
    // If something fails mid-stream, send an error event so the frontend
    // can show a message instead of hanging forever.
    res.write(`data: ${JSON.stringify({ error: "Generation failed. Please try again." })}\n\n`);
    res.end();
  }
});

module.exports = router;
