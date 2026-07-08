# JobFit AI — MERN + Gemini API + Stripe

A full-stack app where a logged-in user pastes their resume + a job description, and gets back
an AI-tailored version of their resume, streamed in real time. Free users get 3 generations/day;
Stripe unlocks unlimited "Pro" access.

**Live demo:** []

---

## 1. Project structure

```
resume-tailor-ai/
├── backend/
│   ├── config/db.js              → MongoDB connection
│   ├── models/User.js            → User schema (auth, plan, usage)
│   ├── models/Generation.js      → Stores each tailored-resume result
│   ├── middleware/auth.js        → Verifies JWT, protects routes
│   ├── middleware/checkUsage.js  → Enforces free-tier daily limit
│   ├── utils/geminiClient.js     → Calls Gemini API, handles streaming
│   ├── routes/auth.js            → Signup / Login
│   ├── routes/generate.js        → The core AI route (streams response)
│   ├── routes/history.js         → Fetch past generations
│   ├── routes/stripeCheckout.js  → Creates Stripe Checkout session + verifies payment on redirect
│   ├── routes/stripeWebhook.js   → Confirms payment via webhook, upgrades user
│   ├── server.js                 → Wires everything together
│   └── .env.example               → Copy to .env and fill in
│
└── frontend/
    └── src/
        ├── context/AuthContext.jsx  → Global logged-in-user state
        ├── api/client.js            → Axios instance, auto-attaches JWT
        ├── pages/Login.jsx
        ├── pages/Signup.jsx
        ├── pages/Dashboard.jsx      → Main form + streaming output, side-by-side layout
        ├── pages/History.jsx
        └── App.jsx                 → Routes + navbar
```

---

## 2. Prerequisites

Install these on your machine before starting:
- **Node.js** (v18 or later) — [nodejs.org](https://nodejs.org)
- **VS Code** (or any editor)
- A **MongoDB Atlas** account (free tier) — [mongodb.com/atlas](https://www.mongodb.com/atlas)
- A **Google Gemini API key** (free tier) — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- A **Stripe account** (test mode) — [dashboard.stripe.com](https://dashboard.stripe.com)

---

## 3. Setup — Backend

Open a terminal in VS Code (`` Ctrl+` ``) and run:

```bash
cd backend
npm install
```

This reads `package.json` and downloads every dependency (express, mongoose, stripe, etc.) into
a `node_modules` folder.

### Configure environment variables

```bash
cp .env.example .env
```

Open the new `.env` file and fill in each value:

| Variable | Where to get it |
|---|---|
| `MONGO_URI` | MongoDB Atlas → Database → Connect → "Drivers" → copy connection string. Replace `<password>` with your DB user's password. Double check there's no stray quote character around `w=majority` in the string — see "Common issues" below. |
| `JWT_SECRET` | Any long random string you make up (e.g. run `openssl rand -hex 32` in terminal) |
| `GEMINI_API_KEY` | aistudio.google.com/apikey → "Create API key" → free, no credit card needed |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API Keys → "Secret key" (use test mode) |
| `STRIPE_PRICE_ID` | dashboard.stripe.com → Product catalog → create a product (e.g. "Pro Plan", $9/month) → copy its Price ID |
| `STRIPE_WEBHOOK_SECRET` | See "Testing Stripe locally" section below |
| `CLIENT_URL` | Leave as `http://localhost:5173` for local dev |

### Run the backend

```bash
npm run dev
```

You should see:
```
MongoDB connected: ...
Server running on port 5000
```

Test it's alive by visiting `http://localhost:5000/api/health` in your browser — you should see
`{"status":"ok"}`.

---

## 4. Setup — Frontend

Open a **second terminal** (keep the backend running in the first one):

```bash
cd frontend
npm install
npm run dev
```

Vite will print a local URL, typically `http://localhost:5173`. Open that in your browser.

---

## 5. Testing Stripe locally (webhooks)

Stripe webhooks need a public URL to send events to — your `localhost` isn't reachable from the
internet, so Stripe provides a CLI tool that forwards events to your local machine.

1. Install the Stripe CLI: [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
2. Log in: `stripe login`
3. Forward webhooks to your local backend:
   ```bash
   stripe listen --forward-to localhost:5000/api/stripe/webhook
   ```
4. This command prints a webhook signing secret like `whsec_...` — copy it into your `.env` as
   `STRIPE_WEBHOOK_SECRET`, then restart your backend (`npm run dev`).
5. Now when you click "Upgrade to Pro" in the app and complete a test payment (use Stripe's test
   card `4242 4242 4242 4242`, any future expiry, any CVC), the CLI window will show the webhook
   event arriving, and your backend will upgrade the user's plan in MongoDB.

If the CLI isn't running (or the webhook is slow to arrive), the app has a fallback: when the
browser redirects back to `/dashboard` after checkout, it calls `GET /api/stripe/verify-session`,
which asks Stripe directly whether the payment succeeded and upgrades the user immediately if so.
See section 7 for why both paths exist.

---

## 6. How to use the app

1. Go to `http://localhost:5173` → redirects to `/login`
2. Click "Sign up", create an account
3. On the Dashboard, paste a job description and your resume text on the left
4. Click "Generate Tailored Resume" — watch the text stream into the panel on the right
5. Click the **Copy** button above the result to copy it to your clipboard
6. Check the "History" tab to see it saved
7. Try generating 3 times as a free user — the 4th attempt should show the upgrade prompt
8. Click "Upgrade to Pro" to test the Stripe flow (with the CLI running, per step 5 above)

---

## 7. Architecture concepts to explain in an interview

**Authentication (JWT)**
- On login, the server signs a token containing the user's ID (`jsonwebtoken`), sent to the client.
- The client stores it in `localStorage` and attaches it to every request via an Axios interceptor
  (see `api/client.js`).
- The `protect` middleware (`middleware/auth.js`) verifies this token on every protected route
  BEFORE the route handler runs — invalid/expired tokens are rejected early, and it re-fetches the
  user fresh from MongoDB on every request, so plan/usage changes are always up to date.

**Password security**
- Passwords are never stored in plain text. `models/User.js` uses a Mongoose "pre-save hook" to
  hash the password with `bcrypt` automatically before saving.

**Why streaming (Server-Sent Events)?**
- Instead of waiting 5-10 seconds for the full AI response, the backend forwards each small chunk
  of text from Gemini's streaming API to the browser immediately (`routes/generate.js`).
- SSE was chosen over WebSockets because we only need one-way (server → client) streaming — SSE
  is simpler to implement and works over plain HTTP.
- The frontend can't use the browser's built-in `EventSource` API here because it only supports
  GET requests with no custom headers/body — and we need to POST the resume + auth token. Instead,
  `Dashboard.jsx` reads the raw streamed response manually using `fetch()` and a `ReadableStream`
  reader.

**Rate limiting (business logic, not just security)**
- `middleware/checkUsage.js` enforces the free-tier limit **server-side**, resetting by calendar
  date rather than a rolling 24-hour window. This matters because a user could disable a button in
  the browser's dev tools — but they can't bypass a check that runs in Express before the (costly)
  Gemini API call is even made.

**Stripe payments — webhook AND redirect verification**
- After checkout, Stripe redirects the browser to a "success" URL — but that redirect alone only
  proves the browser was told to come back, not that payment actually succeeded or that our
  database was updated.
- The **webhook** (`routes/stripeWebhook.js`) is the authoritative source of truth: a
  server-to-server event Stripe sends when payment is *actually confirmed*, signed so we can verify
  it's genuinely from Stripe. This is why that route is mounted in `server.js` before the global
  `express.json()` middleware runs — JSON parsing would destroy the raw bytes needed for signature
  verification.
- As a fallback, `routes/stripeCheckout.js` also exposes `GET /verify-session`, called by the
  frontend right after redirect. It checks payment status directly against Stripe's API and
  upgrades the user immediately if the webhook hasn't landed yet (common in local dev if
  `stripe listen` isn't running). This is a defense-in-depth pattern Stripe itself recommends —
  the webhook remains authoritative for events that happen off-browser (renewals, cancellations),
  while the verify-session call closes the gap right after checkout.

**Database design**
- `User` and `Generation` are separate collections linked by a MongoDB `ObjectId` reference
  (`Generation.user` points to a `User._id`) — a one-to-many relationship, common in relational
  thinking applied to MongoDB.

---

## 8. Deployment

This app is split across two hosts because of how the backend is built:

- **Frontend → [Vercel](https://vercel.com)** — a static Vite build, exactly what Vercel is built for.
- **Backend → [Render](https://render.com)** — runs the Express server as a normal long-lived
  process (not a serverless function), which is what the SSE streaming and Stripe webhook raw-body
  verification both need.

**Backend (Render):**
1. New Web Service → connect this repo → Root Directory: `backend`
2. Build Command: `npm install` · Start Command: `npm start`
3. Add all the same environment variables listed in section 3
4. Deploy — note the URL Render gives you (e.g. `https://jobfit-ai-backend.onrender.com`)

**Frontend (Vercel):**
1. Add New Project → connect this repo → Root Directory: `frontend`
2. Framework Preset: Vite · Build Command: `npm run build` · Output Directory: `dist`
3. Add environment variable: `VITE_API_URL=https://jobfit-ai-backend.onrender.com/api`
4. Deploy — note the URL Vercel gives you (e.g. `https://jobfit-ai.vercel.app`)

**Wire them together:**
1. On Render, set `CLIENT_URL` to your Vercel URL, then redeploy
2. In the Stripe Dashboard → Developers → Webhooks → Add endpoint, use
   `https://jobfit-ai-backend.onrender.com/api/stripe/webhook`, select
   `checkout.session.completed`, copy the signing secret into `STRIPE_WEBHOOK_SECRET` on Render,
   redeploy

Render's free tier spins down after 15 minutes idle and takes 30-60s to wake back up on the next
request — fine for a portfolio demo, worth knowing about if you're sharing the link live.

---

## 9. Common issues

- **"MongoDB connection error"** → check your `MONGO_URI`, and that your IP is whitelisted in
  Atlas (Network Access → Add IP Address → Allow from anywhere, for local dev).
- **`MongoWriteConcernError: No write concern mode named 'majority"'`** → there's a stray quote
  character inside your `MONGO_URI`. Make sure it reads `...&w=majority` with no quotes around
  `majority`.
- **CORS errors in browser console** → make sure `CLIENT_URL` in `.env` exactly matches the URL
  your frontend runs on.
- **Stripe webhook signature errors** → make sure you copied the `whsec_...` secret printed by
  `stripe listen` (local dev) or from the Dashboard's webhook endpoint settings (production) —
  they're different secrets.
- **Streaming shows nothing** → open the Network tab in dev tools, check the `/generate` request
  — if it returns a normal error JSON instead of a stream, check your Gemini API key.
- **Copy button does nothing** → `navigator.clipboard` requires `localhost` or HTTPS; it won't
  work over plain `http://` on a production domain.

---

## 10. Known limitations / possible next features

- `plan: "pro"` is a one-way flag — there's no handling yet for `customer.subscription.deleted` or
  `invoice.payment_failed` webhook events, so a cancelled subscription doesn't currently downgrade
  the user back to `"free"`. Worth adding for anything beyond a demo.
- PDF upload/parsing for the resume instead of copy-pasting text
- Export the tailored resume as a downloadable Word/PDF file
- Multiple resume "versions" saved per job application
- Admin dashboard showing usage analytics across all users