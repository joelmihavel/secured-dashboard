# AutoBot — Compound Engineering Knowledge Base

Persistent knowledge base for all AutoBot agents. Every agent reads this before starting work.
Updated after each completed task with new learnings.

---

## Project Overview

**Flent Secured v2**: Rent payment fintech app for Indian market
- **Stack**: Expo SDK 52 + React Native 0.76.9 + Supabase (project: `zqlowjveyqiagnbmfwsb`)
- **State**: Zustand 5 + React Query 5
- **Styling**: NativeWind 4 (Tailwind for RN)
- **Navigation**: expo-router 4 (file-based, typed routes)
- **Fonts**: PlusJakartaSans (Regular=400, Medium=500, SemiBold=600, Bold=700)
- **App code**: `rn-app/` | **BuildBot tools**: `buildbot/` | **AutoBot**: `autobot/`

---

## UI Conventions

### Theme Colors
- Background: #131313 (`colors.black[700]`)
- Cards: #202020 (`colors.black[500]`)
- Card borders/dividers: #4D4D4D (`colors.black[400]`)
- Brand accent: #FF9A6D (`colors.brand[500]`)
- Labels: #878787 (`colors.neutral[600]`) / #A9A9A9 (`colors.neutral[500]`)
- Values: #CBCBCB (`colors.neutral[300]`) / #DDDDDD (`colors.neutral[200]`)

### Shared Components (ALWAYS reuse — NEVER rebuild)
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

### Figma Interpretation Rules
1. **fontWeight → fontFamily**: NEVER use RN fontWeight prop. Map: 400→PlusJakartaSans-Regular, 500→Medium, 600→SemiBold, 700→Bold
2. **lineHeightPx**: Use Figma `style.lineHeightPx` directly as RN `lineHeight`. Don't derive from fontSize.
3. **fill.visible=false**: Element should NOT render. Check `fills[0].visible !== false`.
4. **Opacity**: `finalOpacity = fill.opacity * node.opacity`. Apply fill via color alpha, node via RN opacity prop.
5. **absoluteBoundingBox**: Subtract root node bbox.y for relative positions. `relativeY = node.bbox.y - root.bbox.y`
6. **Text wrapping**: Use `maxWidth` (not `width`) when Figma has `textAutoResize: HEIGHT`.
7. **Negative y-offset**: Use `position: 'absolute'` for children with negative y in auto-layout frames.
8. **FILL sizing**: Map to `flex: 1` (not `width: '100%'`). FIXED → explicit size. HUG → no explicit size.
9. **Screen padding**: Screen component adds its own padding. Don't double-pad direct children.

### RN Patterns
1. **Card-with-dividers**: Single card (bg #202020, radius 12) + thin 0.25px #4D4D4D dividers, `gap: 8`.
2. **Menu-stack**: Individual cards each with own bg #202020, radius 12, separated by `gap: 4`.
3. **DottedPattern shapes**: `splash`, `carousel1`, `carousel2`, `carousel3`, `agreement`, `default`.
4. **Demo data**: Must exactly match Figma placeholder content (names, amounts, dates).
5. **Charts**: Provide mixed-status demo data (ontime/late/unpaid) to exercise all visual states.

### Pipeline Rules
1. Extract at `depth=999` (unlimited) for full component internals.
2. Use `designHeight * 4` threshold for shouldSkipNode (scrollable screens).
3. DottedPattern screens: 18% odiff threshold (8-12% inherent diff).
4. Always use `--reduce-ram-usage` with ODiff.
5. Resize images to matching dimensions before ODiff comparison.
6. Validate PNG integrity at every image I/O boundary.
7. Max 5 concurrent agents per batch. Checkpoint at 50% context.

---

## Backend Conventions
- Edge functions in Deno (`supabase/functions/`)
- Shared utilities in `_shared/` (validation, errors, crypto, cors, audit, supabase clients)
- External services: PayU (payments), Cashfree (KYC), Twilio (OTP), API Club (utility verification), Gemini (AI analysis)
- All tables have RLS policies
- Audit logging on mutations
- Supabase project ID: `zqlowjveyqiagnbmfwsb`

---

## State Conventions
- Zustand stores use Immer middleware
- React Query: 5min stale, 2 retries, exponential backoff
- Auth via expo-secure-store (encrypted)
- No refetch on window focus (mobile pattern)
- Service layer wraps all Supabase edge function calls

---

## Expo Conventions
- SDK 52, typed routes enabled
- EAS Build profiles: dev (simulator), preview (internal), production (auto-increment)
- Fonts: Plus Jakarta Sans loaded via expo-font
- NativeWind 4 for Tailwind-in-RN styling

---

## Quality Gates (ALL must pass before committing)
1. `npx tsc --noEmit` — zero TypeScript errors
2. `npx eslint {changed-files}` — zero lint errors
3. `npm test -- --passWithNoTests` — existing tests pass
4. App renders without crash
5. For UI screens: BuildBot `verify-screen.ts` pipeline passes
6. For backend: Deno tests pass on branch

---

## Solved Problems Log

*Updated as problems are solved. Each entry: problem → root cause → fix.*

<!-- New entries added above this line -->
