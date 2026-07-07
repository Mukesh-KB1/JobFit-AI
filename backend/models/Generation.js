// models/Generation.js
// -----------------------------------------------------------------------
// Every time a user generates a tailored resume, we save a record of it
// here. This powers the "History" page on the frontend, and is a good
// example of a one-to-many relationship in MongoDB (one User has many
// Generations) using a reference (ObjectId) instead of embedding.
// -----------------------------------------------------------------------

const mongoose = require("mongoose");

const generationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // this tells Mongoose it points to a document in the "User" collection
      required: true,
      index: true, // speeds up queries like "find all generations for this user"
    },
    jobDescription: {
      type: String,
      required: true,
    },
    originalResume: {
      type: String,
      required: true,
    },
    tailoredResume: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Generation", generationSchema);
