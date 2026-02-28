const express = require("express");

const app = express();
app.use(express.json());

const API_CLUB_BASE = "https://prod.apiclub.in/api/v1";
const API_CLUB_KEY = process.env.API_CLUB_KEY;
const PROXY_SECRET = process.env.PROXY_SECRET;

// Auth middleware — validate shared secret
function authenticate(req, res, next) {
  const secret = req.headers["x-proxy-secret"];
  if (!PROXY_SECRET || secret !== PROXY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET /fetch_bill_operator — forward to API Club
app.get("/fetch_bill_operator", authenticate, async (req, res) => {
  try {
    const response = await fetch(`${API_CLUB_BASE}/fetch_bill_operator`, {
      headers: {
        "x-api-key": API_CLUB_KEY,
        "X-Request-Id": req.headers["x-request-id"] || "",
      },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("fetch_bill_operator error:", err.message);
    res.status(502).json({ error: "Upstream request failed" });
  }
});

// POST /fetch_bill — forward to API Club
app.post("/fetch_bill", authenticate, async (req, res) => {
  try {
    const response = await fetch(`${API_CLUB_BASE}/fetch_bill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_CLUB_KEY,
        "X-Request-Id": req.headers["x-request-id"] || "",
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("fetch_bill error:", err.message);
    res.status(502).json({ error: "Upstream request failed" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`api-club-proxy listening on :${PORT}`));
