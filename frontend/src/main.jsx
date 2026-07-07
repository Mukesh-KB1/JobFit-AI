// main.jsx
// -----------------------------------------------------------------------
// The actual entry point Vite loads first. It mounts our <App /> into
// the #root div from index.html, wrapped in BrowserRouter (for page
// navigation) and our AuthProvider (so any component can access the
// logged-in user).
// -----------------------------------------------------------------------

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
