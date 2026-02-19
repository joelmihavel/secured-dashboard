# Always use --reduce-ram-usage with ODiff

## Problem
Without this flag, `odiff-bin` produces truncated PNG files when comparing large images (e.g., 1179x4476px profile screen). The PNG header is valid but image data is incomplete, causing downstream consumers (Claude API, image viewers) to fail with "Could not process image" errors. The truncation is silent — ODiff reports a valid diff percentage but the output file is corrupt.

## Solution
Always include `--reduce-ram-usage` and `--parsable-stdout` in every ODiff invocation. Additionally, resize both images proportionally so the longest side is ≤2000px before comparison. This prevents memory pressure during the diff computation. Verify diff output with `magick identify` if needed.

## Source
buildbot/learnings/buildbot-learnings.md
