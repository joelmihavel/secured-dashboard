# Parity Plan v2 - Figma Data Only Approach

## Working Directory
**ALWAYS**: `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/rn-app/`
**NEVER**: `/Users/atrishabh/FlentApp/`

## Approach
Use pre-computed Figma data from `autonomous-parity-fixer/data/combined/{screenId}/style-map.json` as the ONLY source of truth. NO AI visual guesswork.

## Target Screens (16 from auto-heal-parity.sh)

### Group 1: Main Stack
| Screen | Figma ID | Route | Combined Data |
|--------|----------|-------|---------------|
| home | 243-2762 | /(main) | style-map.json |
| select-method | 41-8901 | /(payment)/select-method | style-map.json |
| processing | 41-9460 | /(payment)/processing | style-map.json |
| success | 41-9388 | /(payment)/success | style-map.json |
| failed | 41-9511 | /(payment)/failed | style-map.json |
| profile | 41-8760 | /(profile) | style-map.json |
| transactions | 243-5870 | /(transactions) | style-map.json |
| add-upi | 41-8369 | /(payment)/add-upi | style-map.json |
| add-card | 41-8529 | /(payment)/add-card | style-map.json |
| add-netbanking | 41-9224 | /(payment)/add-netbanking | style-map.json |

### Group 2: Auth Screens
| Screen | Figma ID | Route | Combined Data |
|--------|----------|-------|---------------|
| splash | 1-28055 | /(auth)/splash | style-map.json |
| carousel | 1-28985 | /(auth)/carousel | style-map.json |
| sign-up | 1-29108 | /(auth)/sign-up | style-map.json |
| otp | 1-31175 | /(auth)/otp | style-map.json |

### Group 3: Sibling Stacks
| Screen | Figma ID | Route | Combined Data |
|--------|----------|-------|---------------|
| setup | 41-10712 | /(setup) | style-map.json |
| waitlist | 41-11206 | /(waitlist) | style-map.json |

## Agent Task Template

For each screen, the agent must:

1. **Read style-map.json**: `autonomous-parity-fixer/data/combined/{figmaId}/style-map.json`
2. **Read constants.json**: `autonomous-parity-fixer/data/combined/{figmaId}/constants.json`
3. **Read RN source**: `rn-app/app/{route}.tsx` or `rn-app/app/{route}/index.tsx`
4. **Compare** every style property from style-map against the RN StyleSheet
5. **Apply diffs** using ONLY the Figma values from style-map/constants
6. **Report** what was changed and what was left as-is (with reason)

## Golden Rules
- ONLY use values from `style-map.json` and `constants.json`
- NEVER guess or imagine values
- If a Figma value doesn't exist in the data, skip it (don't add)
- Use design tokens from the app's theme when available
- Work ONLY in rn-app/ directory

## Verification
After all fixes, sync to FlentApp and run:
```bash
rsync -av "rn-app/app/" "FlentApp/app/" && rsync -av "rn-app/src/" "FlentApp/src/"
./scripts/auto-heal-parity.sh --compare-only
```

## Design Token Mapping
From `autonomous-parity-fixer/config/design-tokens.json`:
- Colors: `_colorByHex` reverse map
- Typography: `_typographyByStyle` reverse map (fontSize:lineHeight:weight → token)
- Spacing: `_spacingByValue` reverse map
- Radius: `_radiusByValue` reverse map
