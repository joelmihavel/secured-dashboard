/**
 * Flent Secured v2 - Auth Middleware (Cloud Run)
 *
 * Validates the X-Extraction-Secret header against the configured secret.
 * This protects the extraction endpoints from unauthorized access.
 */

import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

/**
 * Middleware that validates the X-Extraction-Secret header.
 * Returns 401 if the header is missing or does not match EXTRACTION_SECRET.
 */
export function validateExtractionSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // config.extractionSecret is enforced at boot — if missing, the process
  // would have exited before reaching this middleware. So this is non-null.
  const expectedSecret = config.extractionSecret;

  const providedSecret = req.headers["x-extraction-secret"] as
    | string
    | undefined;

  if (!providedSecret) {
    res.status(401).json({
      error: "Missing X-Extraction-Secret header",
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (
    providedSecret.length !== expectedSecret.length ||
    !timingSafeEqual(providedSecret, expectedSecret)
  ) {
    res.status(401).json({
      error: "Invalid extraction secret",
    });
    return;
  }

  next();
}

/**
 * Constant-time string comparison.
 * Prevents timing attacks on secret validation.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
