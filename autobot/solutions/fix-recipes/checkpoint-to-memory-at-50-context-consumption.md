# Checkpoint to memory at 50% context consumption

## Problem
Large screen builds can consume significant context. If the agent hits context limits before completing, all in-progress work and decisions are lost. Checkpointing at 50% ensures there's always enough remaining context to complete the current task and hand off cleanly.

## Solution
After completing 50% of planned work items, write current status to `state/buildbot-status.json` and update `MEMORY.md`. Include: completed items, remaining items, key decisions made, blockers encountered.

## Source
buildbot/learnings/buildbot-learnings.md
