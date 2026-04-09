/**
 * Flent Secured v2 - Error Handler Middleware (Cloud Run)
 *
 * Express error handler with structured logging.
 * Includes extraction_id in all log entries when available.
 */

import type { Request, Response, NextFunction } from "express";

interface StructuredError {
  error: string;
  message: string;
  extraction_id?: string;
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Express error handler middleware.
 * Must be registered last (after all routes).
 *
 * Logs errors with structured context and returns a clean JSON response.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Extract extraction_id from request body or params for log context
  const extractionId =
    (req.body as Record<string, any>)?.extraction_id ??
    (req.params as Record<string, any>)?.extraction_id ??
    undefined;

  const statusCode = (err as any).statusCode ?? 500;
  const isServerError = statusCode >= 500;

  // Structured log entry
  const logEntry = {
    severity: isServerError ? "ERROR" : "WARNING",
    message: err.message,
    extraction_id: extractionId,
    path: req.path,
    method: req.method,
    status_code: statusCode,
    stack: isServerError ? err.stack : undefined,
    timestamp: new Date().toISOString(),
  };

  if (isServerError) {
    console.error(JSON.stringify(logEntry));
  } else {
    console.warn(JSON.stringify(logEntry));
  }

  const response: StructuredError = {
    error: isServerError ? "Internal server error" : err.message,
    message: err.message,
    extraction_id: extractionId,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  res.status(statusCode).json(response);
}
