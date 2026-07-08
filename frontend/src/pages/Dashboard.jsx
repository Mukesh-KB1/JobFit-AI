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

import { useState, useEffect } from "react";
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
  const [copied, setCopied] = useState(false);

  const { user, token, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(false);

   // When Stripe redirects back here after checkout, it appends
  // ?upgraded=true&session_id=cs_test_... to the URL. That alone doesn't
  // prove payment succeeded on our end - it's just what the browser was
  // told to do. So we ask our backend to verify the session directly with
  // Stripe (GET /stripe/verify-session), which also upgrades the user
  // immediately if the webhook hasn't landed yet.
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    setVerifying(true);
    client
      .get(`/stripe/verify-session?session_id=${sessionId}`)
      .then((res) => {
        if (res.data.user) {
          updateUser(res.data.user);
        }
      })
      .catch(() => {
        setError("We couldn't confirm your upgrade automatically. If you were charged, refresh this page or contact support.");
      })
      .finally(() => setVerifying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  async function handleCopy() {
  try {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch (err) {
    setError("Couldn't copy to clipboard - please select and copy manually.");
  }
}

  const remaining = user.plan === "free" ? Math.max(0, 3 - (user.usageCount || 0)) : null;

  return (
  <div className="dashboard-grid">
    <div className="banners">
      {verifying && <div className="usage-banner">Confirming your upgrade with Stripe...</div>}

      {!verifying && searchParams.get("session_id") && user.plan === "pro" && (
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
    </div>

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

    <div className="output-panel">
      {output || streaming ? (
        <div className="card">
          <div className="output-header">
            <label>Tailored Resume</label>
            <button
              type="button"
              className={`copy-btn${copied ? " copied" : ""}`}
              onClick={handleCopy}
              disabled={!output}
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="output-box">{output || "Generating..."}</div>
        </div>
      ) : (
        <div className="card output-placeholder">
          Your tailored resume will appear here once you generate it.
        </div>
      )}
    </div>
  </div>
);
}
