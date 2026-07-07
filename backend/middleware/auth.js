// middleware/auth.js
// -----------------------------------------------------------------------
// Express middleware that protects routes requiring login.
//
// How JWT auth works here (interview talking point):
// 1. On login, the server signs a JWT containing the user's ID and sends
//    it to the client.
// 2. The client stores it (we use localStorage on the frontend) and sends
//    it back on every request in the "Authorization: Bearer <token>" header.
// 3. This middleware verifies that token BEFORE the request reaches the
//    actual route handler. If it's invalid/expired, we reject the request
//    early - the route handler code never even runs.
// -----------------------------------------------------------------------

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;

  // Expect header format: "Bearer eyJhbGciOi..."
  if (authHeader && authHeader.startsWith("Bearer")) {
    try {
      token = authHeader.split(" ")[1];

      // jwt.verify throws an error if the token is invalid, expired, or tampered with
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach the user (minus password) to the request object so every
      // downstream route handler can access `req.user`
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "User not found" });
      }

      next(); // token is valid - let the request continue to the route handler
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token invalid" });
    }
  } else {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }
};

module.exports = { protect };
