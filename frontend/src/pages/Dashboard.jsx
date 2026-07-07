// pages/Dashboard.jsx
// -----------------------------------------------------------------------
// The main feature page: paste resume + job description, click Generate,
// watch the tailored resume stream in token-by-token.
//
// WHY WE USE fetch() INSTEAD OF THE BROWSER'S EventSource FOR SSE:
// The built-in EventSource API only supports GET requests and can't send
// custom headers (like our Authorization JWT) or a JSON body. Since our
// request needs both a POST body (resume + job description) and an auth
// header, we manually read the streamed response using fetch()'s
// ReadableStream reader instead, parsing out each "data: ..." line
// ourselves. This is a common real-world pattern once auth is involved.
// -----------------------------------------------------------------------

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../api/client.js";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  const { user, token, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const justUpgraded = searchParams.get("upgraded") === "true";

  async function handleGenerate(e) {
    e.preventDefault();
    setError("");
    setOutput("");
    setStreaming(true);

    try {
      // We use raw fetch() here (not our axios client) because axios
      // doesn't give us access to the raw streaming response body.
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resume, jobDescription }),
      });

      if (!response.ok) {
        const errData = await response.json();
        setError(errData.message || "Something went wrong");
        setStreaming(false);
        return;
      }

      // Get a reader for the streamed response body
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by double newlines ("\n\n")
        const parts = buffer.split("\n\n");
        buffer = parts.pop(); // keep the last (possibly incomplete) chunk in the buffer

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const json = JSON.parse(part.replace("data: ", ""));

          if (json.chunk) {
            // Append each new chunk to the output as it streams in
            setOutput((prev) => prev + json.chunk);
          }
          if (json.error) {
            setError(json.error);
          }
          if (json.done) {
            // Stream finished - bump the local usage counter for free users
            if (user.plan === "free") {
              updateUser({ usageCount: (user.usageCount || 0) + 1 });
            }
          }
        }
      }
    } catch (err) {
      setError("Network error - please try again.");
    } finally {
      setStreaming(false);
    }
  }

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const res = await client.post("/stripe/create-checkout-session");
      window.location.href = res.data.url; // redirect to Stripe Checkout
    } catch (err) {
      setError("Could not start checkout - please try again.");
      setUpgrading(false);
    }
  }

  const remaining = user.plan === "free" ? Math.max(0, 3 - (user.usageCount || 0)) : null;

  return (
    <div className="container">
      {justUpgraded && (
        <div className="usage-banner">You're now on the Pro plan. Unlimited generations unlocked.</div>
      )}

      {user.plan === "free" && (
        <div className="usage-banner">
          Free plan: {remaining} of 3 generations left today.{" "}
          <a href="#" onClick={handleUpgrade}>
            {upgrading ? "Redirecting..." : "Upgrade to Pro for unlimited"}
          </a>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <form onSubmit={handleGenerate}>
          <label>Job Description</label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            required
          />

          <label>Your Current Resume</label>
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            placeholder="Paste your resume text here..."
            required
          />

          <button type="submit" disabled={streaming}>
            {streaming ? "Generating..." : "Generate Tailored Resume"}
          </button>
        </form>
      </div>

      {(output || streaming) && (
        <div className="card">
          <label>Tailored Resume</label>
          <div className="output-box">{output || "Generating..."}</div>
        </div>
      )}
    </div>
  );
}
