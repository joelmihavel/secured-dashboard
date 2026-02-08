# Autonomous Parity Fixer

Fully autonomous AI-based system for achieving pixel-perfect parity between Figma designs and React Native implementation.

## Quick Start (Universal Converter)

The fastest way to convert any Figma screen to pixel-perfect React Native:

```bash
# 1. Process a single screen
npm run pipeline:single -- 243-2762

# 2. Get the implementation guide
cat data/combined/243-2762/implementation-guide.md

# 3. Call Figma MCP for semantic structure (in Claude Code)
mcp__figma__get_design_context({fileKey: "HZaVuwWn6B6jOjrmxZ7Kzv", nodeId: "243:2762"})

# 4. Implement using both data sources
```

### What You Get

| File | Purpose |
|------|---------|
| `style-map.json` | Pre-computed React Native styles for every Figma node |
| `constants.json` | Organized FIGMA constants (colors, typography, spacing) |
| `implementation-guide.md` | Step-by-step implementation instructions |
| `{screenId}.tsx` | Component template with exact Figma values |

---

## The Combined Approach

This system uses a **two-source approach** for pixel-perfect conversion:

### 1. Local Extraction (Exact Values)
From `figma-parity/data/screens/{screenId}/extracted-values.json`
- Precise numerical values (dimensions, colors, typography)
- Pre-computed `rnStyles` for React Native
- All geometry and layout properties

### 2. Figma MCP (Semantic Structure)
From `mcp__figma__get_design_context`
- Parent-child hierarchy
- Multi-span text structure
- Component relationships

**Result**: Pixel-perfect React Native code with correct values AND proper structure.

---

## Commands

```bash
# Universal Converter
npm run convert <screenId>      # Convert single screen
npm run convert:batch           # Convert all available screens
npm run convert:list            # List available screens

# Full Pipeline
npm run pipeline:single -- <screenId>  # Full pipeline for one screen
npm run pipeline:batch                  # Process all screens

# Legacy Commands
npm start                       # Run legacy orchestrator
npm run extract                 # Run AI-enhanced extraction
npm run feedback               # Run Gemini feedback analysis
```

---

## Overview

This system processes 100+ Figma designs sequentially, running:
- **Universal Converter**: Combined extraction + Figma MCP approach
- **Extraction**: Figma API + AI-enhanced data extraction
- **Analysis**: Gemini-based parity feedback
- **Verification**: Screenshot comparison

**Available screens**: 103
**Figma File**: HZaVuwWn6B6jOjrmxZ7Kzv

---

## IMPORTANT: Claude Code is the Orchestrator

This system is designed to be **orchestrated by Claude Code** (not run as a standalone CLI). The TypeScript scripts handle extraction and analysis, but **Claude Code spawns sub-agents** to apply fixes to the React Native app.

### What Scripts Handle (Automated)

| Script | Command | Output |
|--------|---------|--------|
| **Extraction** | `npx ts-node scripts/extract-figma-ai-enhanced.ts <nodeIdApi> <name>` | `data/ai-enhanced/{id}/enhanced-extraction.json` |
| **Analysis** | `npx ts-node scripts/gemini-pixel-feedback.ts <figmaId>` | `analysis/pixel-feedback/{id}.json` |

### What Claude Code Does (Orchestration)

1. **Runs extraction script** via Bash for each design
2. **Runs analysis script** via Bash
3. **Spawns sub-agents** (via Task tool) for 3 review rounds:
   - **Structural**: Component hierarchy, positioning, View nesting
   - **Style Tokens**: Colors, typography, design token usage
   - **Layout Accuracy**: Dimensions, spacing, flex properties
4. **Spawns sub-agents** for 3 feedback rounds:
   - **Critical Fixes**: Severity=critical issues
   - **Major Fixes**: Severity=major issues
   - **Minor Polish**: Remaining cleanup
5. **Tracks state** - updates JSON files in `state/` directory
6. **Verifies** - re-runs analysis, checks parity score ≥95

### Sub-agent Prompts

Sub-agent prompts are defined in `config/subagent-prompts.json`. Each sub-agent receives:
- Path to extraction JSON
- Path to analysis JSON
- Path to RN app directory (`../rn-app/`)
- Focus area for the round
- Golden rule: **ONLY use Figma extracted data, no imagination**

### How to Use with Claude Code

```
User: "Process the next pending design"
Claude:
  1. Reads state/batch-progress.json to find next pending
  2. Runs extraction script
  3. Runs analysis script
  4. Spawns Task agents for review rounds
  5. Spawns Task agents for feedback rounds
  6. Updates state files
  7. Reports completion
```

**To resume processing:**
```
User: "Resume parity fixing from where we left off"
```

**To process a specific design:**
```
User: "Process design 1-29914 (auth / sign up --filled)"
```

---

## Key Features

- **File-based progress tracking** - All state persisted to JSON files (survives context loss)
- **Automatic checkpoint recovery** - Resume from any point after crashes or interruptions
- **Sequential processing** - One design at a time for stability
- **Golden Rule** - Only uses Figma extracted data, no AI imagination

## Quick Start

### 1. Install Dependencies

```bash
cd autonomous-parity-fixer
npm install
```

### 2. Verify Environment

The `.env` file should contain:
```
FIGMA_TOKEN=your_figma_token
GEMINI_API_KEY=your_gemini_key
```

### 3. Run the Orchestrator

```bash
# Process all pending designs
npm start

# Resume from checkpoint
npx ts-node scripts/orchestrator.ts --resume

# Process a specific design
npx ts-node scripts/orchestrator.ts --design=41-11206
```

### 4. Test Individual Scripts

```bash
# Test extraction on a single design
npm run test:extract

# Test feedback analysis
npm run test:feedback
```

## Directory Structure

```
autonomous-parity-fixer/
├── .env                    # API tokens (DO NOT COMMIT)
├── config/
│   ├── figma.json          # Figma API configuration
│   ├── design-tokens.json  # Design token mappings
│   ├── screen-routes.json  # Route configuration
│   ├── screens-to-process.json
│   └── orchestrator-config.json
├── scripts/
│   ├── universal-converter.ts    # NEW: Universal screen converter
│   ├── full-pipeline.ts          # NEW: Full orchestration pipeline
│   ├── combined-figma-converter.ts # Combined approach converter
│   ├── orchestrator.ts           # Legacy orchestrator
│   ├── state-manager.ts          # State machine logic
│   ├── checkpoint-manager.ts
│   ├── extract-figma-ai-enhanced.ts  # Core: Figma extraction
│   └── gemini-pixel-feedback.ts      # Core: Parity analysis
├── data/
│   ├── combined/           # Universal converter output
│   │   └── {screenId}/
│   │       ├── style-map.json        # All styles mapped
│   │       ├── constants.json        # FIGMA constants
│   │       ├── extraction.json       # Full extraction
│   │       └── implementation-guide.md
│   └── ai-enhanced/        # AI-enhanced extractions
├── output/
│   ├── components/         # Generated component templates
│   └── screenshots/        # Verification screenshots
├── reports/                # Pipeline reports
├── state/                  # Progress tracking
├── processing/             # Per-design working directories
├── analysis/               # Feedback output
└── logs/                   # Processing logs
```

## Output Files

After running the pipeline on a screen, you get:

```
data/combined/{screenId}/
├── style-map.json           # 100-300+ style entries
│   └── [{nodeId, nodeName, rnStyleName, rnStyles, textContent}]
├── constants.json           # Organized constants
│   └── {screen, colors, typography, spacing}
├── extraction.json          # Full extraction data
├── conversion-prompt.md     # Original prompt
└── implementation-guide.md  # Step-by-step guide

output/components/{screenId}.tsx  # Generated component

reports/{screenId}-report.json    # Pipeline report
```

## State Machine

Each design progresses through:

```
PENDING → EXTRACTING → EXTRACTED → ANALYZING → ANALYZED
                                                    ↓
         REVIEW_1 → IMPLEMENT_1 → REVIEW_2 → IMPLEMENT_2 → REVIEW_3 → IMPLEMENT_3
                                                    ↓
         FEEDBACK_1 → FIX_1 → FEEDBACK_2 → FIX_2 → FEEDBACK_3 → FIX_3
                                                    ↓
                                              VERIFYING → COMPLETED
```

## Progress Tracking

Check progress at any time:

```bash
# View batch progress
cat state/batch-progress.json

# View current design
cat state/current-design.json

# View completed designs
cat state/completed.json

# View logs
tail -f logs/orchestrator.log
```

## Error Recovery

| Scenario | Recovery |
|----------|----------|
| Process killed | Run with `--resume` flag |
| API rate limit | Automatic exponential backoff |
| Script failure | Retry up to 3 times, then mark failed |
| Context loss | Checkpoint recovery |

## Configuration

Edit `config/orchestrator-config.json`:

```json
{
  "processing": {
    "maxRetries": 3,
    "timeoutMs": 300000,
    "delayBetweenDesignsMs": 2000
  },
  "verification": {
    "minParityScore": 95,
    "passThreshold": 90
  }
}
```

## Output

After processing, find:
- `output/summary-report.md` - Overall results
- `processing/{designId}/` - Per-design data
- `state/completed.json` - Successfully processed designs
- `state/failed.json` - Failed designs with errors

## Troubleshooting

### "FIGMA_TOKEN not found"
Ensure `.env` file exists with valid token.

### "No route found for design"
Design ID not in `screen-routes.json`. Add mapping.

### "Extraction failed"
Check Figma API rate limits. Wait and retry.

### "Analysis timeout"
Increase `timeoutMs` in orchestrator config.

## License

Internal use only.
