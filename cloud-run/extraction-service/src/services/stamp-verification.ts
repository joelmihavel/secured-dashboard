/**
 * Fire-and-forget trigger to stamp-verification-service.
 *
 * We don't await the response — SHCIL + 2Captcha take 30-60s and we can't
 * hold up the extraction pipeline (user is waiting on the agreement upload).
 * The target service runs on its own Cloud Run instance, processes the
 * request to completion independently, and writes its own stamp_verifications
 * row regardless of whether this process is still listening.
 *
 * Phase 3 will replace this with a Cloud Tasks queue for proper retries,
 * rate-limiting against SHCIL, and backoff on site_error.
 */

import { config } from '../config.js';

export function triggerStampVerification(extractionId: string): void {
  const url = config.stampVerification.url;
  const secret = config.stampVerification.secret;

  if (!url || !secret) {
    console.log(
      `[stamp-verif] Trigger skipped for ${extractionId} — STAMP_VERIFICATION_SERVICE_URL or STAMP_VERIFICATION_SECRET not set`
    );
    return;
  }

  // Intentionally not awaited. The outer Promise resolves once the request
  // is transmitted, which typically takes <1s — well within the lifetime of
  // the extraction-service container after the main pipeline completes.
  fetch(`${url.replace(/\/$/, '')}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Verification-Secret': secret,
    },
    body: JSON.stringify({ extraction_id: extractionId }),
  })
    .then((res) => {
      console.log(
        `[stamp-verif] Triggered for ${extractionId}, status=${res.status}`
      );
    })
    .catch((err) => {
      console.warn(
        `[stamp-verif] Trigger failed for ${extractionId}:`,
        err instanceof Error ? err.message : err
      );
    });
}
