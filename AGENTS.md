# AGENTS.md — Flent Secured Project Conventions

## How to Use This File
You are working on Flent Secured, a rent payment fintech app (React Native/Expo + Supabase).
Read this ENTIRE file before starting any work. It contains accumulated knowledge from all previous iterations.

## Working Directory
- App code: `rn-app/` (this directory)
- BuildBot tools: `../buildbot/` (sibling to rn-app)
- AutoBot system: `autobot/` (inside rn-app)
- Run app: `npx expo start`

## Project Conventions
- Font: PlusJakartaSans (Regular=400, Medium=500, SemiBold=600, Bold=700)
- NEVER use RN fontWeight prop with custom fonts — use fontFamily directly
- Background: #131313 (colors.black[700])
- Cards: #202020 (colors.black[500])
- Card borders/dividers: #4D4D4D (colors.black[400])
- Brand accent: #FF9A6D (colors.brand[500])
- Labels: #878787 (colors.neutral[600]) / #A9A9A9 (colors.neutral[500])
- Values: #CBCBCB (colors.neutral[300]) / #DDDDDD (colors.neutral[200])
- All screens use Screen wrapper from @/src/components
- Use FIGMA_COLORS const at top of each screen file for blueprint color values

## Shared Components (ALWAYS reuse — NEVER rebuild)
Import from `@/src/components`:
- **Screen** — wraps every screen, handles safe area + background. `padded` prop controls horizontal padding.
- **Text** — typography with `inherit` prop for nested styling
- **PrimaryButton** — brand-colored button with loading state
- **TextButton** — text-only button
- **TextInput** — universal input with hint text support (`onHintPress`)
- **PhoneInput** — phone number input with country code
- **OTPInput** — OTP digit boxes
- **DottedPattern** — background pattern, MUST pass correct `backgroundShape` key
- **DocumentUploadCard** — file upload card
- **FileUploadZone** — drag/drop file zone
- **Logo** — app logo component
- **ConsentToggle** — auth consent checkbox
- **CarouselDots** — carousel page indicators
- **ErrorBoundary** — error boundary wrapper

## Quality Gates (ALL must pass before committing)
1. `npx tsc --noEmit` — zero TypeScript errors
2. `npx eslint {changed-file}` — zero lint errors
3. App renders without crash
4. For verify stories: BuildBot 12-step pipeline passes

> No unit-test suite exists. E2E coverage is via Maestro — see `docs/testing/index.md`.

## Figma Data is ABSOLUTE TRUTH
- ONLY use Figma REST API data as source of truth for ALL UI values
- NEVER make UI changes based on AI visual analysis/guesswork
- Blueprint values from extract-screen-blueprint.ts are authoritative
- Design tokens: buildbot/config/design-tokens.json

## Key Gotchas
- fontWeight → fontFamily mapping (no RN fontWeight prop for custom fonts)
- absoluteBoundingBox uses ABSOLUTE canvas coordinates — subtract root bbox.y
- fill.visible=false → element should NOT render
- lineHeightPx from Figma → lineHeight in RN (direct mapping)
- FILL sizing → flex: 1 (not width: '100%')
- Node opacity × fill opacity = final opacity
- DottedPattern screens have inherent 8-12% pixel diff — use 18% threshold
- Screen component adds its own padding — don't double-pad
- Card-with-dividers vs menu-stack are different patterns

## AutoBot Compound Knowledge
For detailed BuildBot patterns, fix recipes, and screen-building knowledge, see:
`autobot/AGENTS.md`

## BuildBot Commands
- Extract: `cd ../buildbot && npx ts-node scripts/extract-screen-blueprint.ts {figmaId}`
- Verify: `cd ../buildbot && npx ts-node scripts/verify-screen.ts {figmaId} --route "{route}"`
- Coverage: `cd ../buildbot && npx ts-node scripts/check-coverage.ts {figmaId}`

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Secured-v2** (11654 symbols, 17881 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Secured-v2/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Secured-v2/clusters` | All functional areas |
| `gitnexus://repo/Secured-v2/processes` | All execution flows |
| `gitnexus://repo/Secured-v2/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
