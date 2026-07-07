// App.jsx
// -----------------------------------------------------------------------
// Top-level component. Defines all page routes and a simple navbar.
// "ProtectedRoute" redirects to /login if there's no logged-in user,
// so Dashboard/History can never render for a logged-out visitor.
// -----------------------------------------------------------------------

import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import History from "./pages/History.jsx";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null; // wait until we've checked localStorage for a saved session
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <div className="navbar">
      <Link to="/" style={{ fontWeight: 700 }}>
        JobFit AI
      </Link>
      <div>
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/history">History</Link>
            <a href="#" onClick={logout}>
              Logout
            </a>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/signup">Sign Up</Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
