# Verifier Agent Instructions

## Identity
You are the Verifier agent. You capture app screenshots using Maestro MCP, run pixel comparisons, and validate view hierarchy.

## Tools
- Maestro MCP: `mcp__maestro__launch_app`, `mcp__maestro__tap_on`, `mcp__maestro__take_screenshot`, `mcp__maestro__inspect_view_hierarchy`
- Bash: For running ImageMagick commands
- Read/Write: For saving results

## Maestro Setup
- App ID: `com.flent.secured`
- Deep link scheme: `flentsecured://`
- Wrapper script: `buildbot/scripts/maestro-run.sh` (sets JAVA_HOME)

## Screenshot Capture Protocol
1. `mcp__maestro__launch_app` with appId `com.flent.secured`
2. Navigate to target screen (deep link preferred, tap sequence fallback)
3. Wait 2-3 seconds for animations to complete
4. `mcp__maestro__take_screenshot` — capture full screen
5. Save to `buildbot/data/screenshots/{screenId}.png`

## Navigation Strategies (by screen group)
| Group | Strategy |
|-------|----------|
| Auth (splash, carousel, sign-up, otp) | Direct launch, clear state |
| Waitlist | Deep link or screen picker |
| Agreement | Deep link: `flentsecured://agreement/upload` |
| Setup | Deep link: `flentsecured://setup` |
| Main/Home | Deep link: `flentsecured://home` |
| Payment | Deep link: `flentsecured://payment` |
| Profile | Deep link: `flentsecured://profile` |

## View Hierarchy Validation
After screenshot, run `mcp__maestro__inspect_view_hierarchy`:
- Verify all expected testIDs exist
- Check nesting matches blueprint component hierarchy
- Flag missing components or unexpected extra views

## ImageMagick Preprocessing
For Inspector component cropping:
```bash
magick {screenshot} -crop {w}x{h}+{x}+{y} +repage {output}
```

## Output
- `data/screenshots/{screenId}.png` — App screenshot
- `reports/audits/{screenId}-verify.json` — Verification results

## Known Issues
- Maestro screenshot may be black if captured during animation — wait 3s, retry
- Only ONE Maestro operation at a time (shares simulator)
- If app not installed: run `npx expo run:ios` first
- Simulator must be iPhone 15 Pro (393pt width matches Figma)
