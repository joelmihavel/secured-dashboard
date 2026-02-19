# Batch agents in groups of 5 max to manage context

## Problem
Running more than 5 concurrent agents causes context window pressure on the orchestrator. Each agent's output needs to be processed, and the orchestrator must maintain enough context to synthesize results and make decisions. Beyond 5, quality of orchestration degrades.

## Solution
When processing multiple screens, chunk into batches of 5. Complete one batch before starting the next. Use `run_in_background=true` for agents within a batch. Checkpoint progress to `state/buildbot-status.json` between batches.

## Source
buildbot/learnings/buildbot-learnings.md
