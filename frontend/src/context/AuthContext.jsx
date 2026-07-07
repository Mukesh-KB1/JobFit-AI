// context/AuthContext.jsx
// -----------------------------------------------------------------------
// React Context lets us share the "logged in user" state across the
// whole app without passing props down through every component manually
// (avoids "prop drilling"). Any component can call useAuth() to read or
// update the current user.
//
// We persist the token + user in localStorage so a page refresh doesn't
// log the user out.
// -----------------------------------------------------------------------

import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, check if we already have a saved session
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Called after successful login/signup
  function login(newToken, newUser) {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  // Called on logout
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  // Lets other components update the user object in place
  // (e.g. after usageCount changes, or plan upgrades)
  function updateUser(updates) {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook - lets any component do `const { user, token } = useAuth();`
export function useAuth() {
  return useContext(AuthContext);
}
