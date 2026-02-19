# Validate PNG integrity at every image I/O boundary

## Problem
Corrupt, empty, or non-PNG files (e.g., Figma API returning JSON error as .png) cause silent cascading failures. ODiff produces truncated output, Claude API enters a "death loop" on corrupt images, and Gemini API returns 400 errors with no useful context. These failures are hard to diagnose because the files pass `fs.existsSync()` checks.

## Solution
Use the `validateImageFile()` function at every boundary: (1) after downloading from Figma API — check buffer has PNG magic bytes before writing to disk; (2) before passing to ODiff — reject 0-byte or non-PNG files; (3) after resize/crop — confirm output is valid; (4) before base64-encoding for API calls — block corrupt images from reaching Gemini/Claude. The function checks: file exists, size > 0, size >= 67 bytes (minimum PNG), and first 8 bytes match PNG signature `89 50 4E 47 0D 0A 1A 0A`. Also detects JSON masquerading as PNG (first byte `0x7b`).

## Source
buildbot/learnings/buildbot-learnings.md
