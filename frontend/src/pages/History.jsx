// pages/History.jsx
// -----------------------------------------------------------------------
// Shows the logged-in user's past generations, most recent first.
// Uses useEffect to fetch data once when the component mounts.
// -----------------------------------------------------------------------

import { useState, useEffect } from "react";
import client from "../api/client.js";

export default function History() {
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await client.get("/history");
        setGenerations(res.data);
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []); // empty dependency array = run once on mount

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <div className="card">
        <h2>Your Past Generations</h2>
        {generations.length === 0 && <p>No generations yet - go create one!</p>}

        {generations.map((gen) => (
          <div className="history-item" key={gen._id}>
            <strong>{new Date(gen.createdAt).toLocaleString()}</strong>
            <p style={{ color: "#6b7280", fontSize: 13 }}>
              {gen.jobDescription.slice(0, 100)}
              {gen.jobDescription.length > 100 ? "..." : ""}
            </p>
            <button
              className="secondary"
              onClick={() => setExpandedId(expandedId === gen._id ? null : gen._id)}
            >
              {expandedId === gen._id ? "Hide" : "View tailored resume"}
            </button>
            {expandedId === gen._id && (
              <div className="output-box" style={{ marginTop: 10 }}>
                {gen.tailoredResume}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
