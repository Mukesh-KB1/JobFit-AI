// config/db.js
// -----------------------------------------------------------------------
// This file handles connecting our backend to MongoDB using Mongoose.
// Mongoose is an ODM (Object Data Modeling) library - it lets us define
// schemas/models for our MongoDB collections instead of writing raw
// MongoDB queries everywhere.
// -----------------------------------------------------------------------

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // mongoose.connect returns a promise - we await it so the server
    // doesn't start accepting requests before the DB is ready.
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Exit the process with failure if DB connection fails.
    // There's no point running an API server that can't reach its database.
    process.exit(1);
  }
};

module.exports = connectDB;
