/**
 * Flent Secured v2 - Extraction Service (Cloud Run)
 *
 * Express app that runs agreement extraction and onboarding finalization.
 *
 * Routes:
 *   POST /extract    - Trigger extraction pipeline for a single extraction
 *   POST /reprocess  - Reprocess failed extractions (specific IDs or all failed)
 *   GET  /health     - Health check endpoint
 *
 * Auth: X-Extraction-Secret header on POST routes
 * Port: process.env.PORT || 8080 (Cloud Run standard)
 */

import express from "express";
import { validateExtractionSecret } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { extractRouter } from "./routes/extract.js";
import { reprocessRouter } from "./routes/reprocess.js";

const app = express();
const PORT = parseInt(process.env.PORT ?? "8080", 10);

// ==============================================
// MIDDLEWARE
// ==============================================

// Parse JSON request bodies (up to 10MB for large extraction payloads)
app.use(express.json({ limit: "10mb" }));

// Request logging (structured for Cloud Logging)
app.use((req, _res, next) => {
  if (req.path !== "/health") {
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: `${req.method} ${req.path}`,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
      })
    );
  }
  next();
});

// ==============================================
// ROUTES
// ==============================================

// Health check (no auth required)
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "extraction-service",
    timestamp: new Date().toISOString(),
  });
});

// Protected routes (require X-Extraction-Secret)
app.use("/extract", validateExtractionSecret, extractRouter);
app.use("/reprocess", validateExtractionSecret, reprocessRouter);

// ==============================================
// ERROR HANDLING
// ==============================================

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler (must be last)
app.use(errorHandler);

// ==============================================
// START SERVER
// ==============================================

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      severity: "INFO",
      message: `Extraction service listening on port ${PORT}`,
      port: PORT,
      node_env: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
    })
  );
});

export default app;
