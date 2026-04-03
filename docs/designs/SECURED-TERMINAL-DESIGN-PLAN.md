# Secured Terminal — Admin Panel Design Plan (v2 — Post-Audit)

## Context

The current admin workflow uses a Google Sheet ("Flent Secured — Admin Dashboard") with 8 tabs and 147+ columns across database views (`v_user_funnel` 58 cols, `v_payment_detail` 23 cols, `v_risk_detail` 32 cols, `v_m360_detail` ~34 cols). This is being replaced with a user-centric "Bloomberg Terminal" style dark-mode admin panel called **Secured Terminal**, designed in Paper using the latest shadcn/ui components.

**Why**: The Google Sheet is tab-fragmented. The team needs a holistic user-centric view where clicking a user shows everything about them at once. The team is growing (5+), so the panel needs structured navigation, RBAC, audit logging, and manual override capabilities.

**Key requirements**:
- Holistic user profiles (not broken-down sheet tabs) — NO tabs in user detail, everything inline
- Detailed analysis & summary views with charts/visualizations
- Dev/Main database environment switcher with safety rails
- Full CRUD (approve/reject/batch/override/bypass)
- RBAC with email+password auth (Super Admin, Admin, Viewer)
- Comprehensive audit logging for all actions
- Manual verification overrides & bypasses with audit trail
- Dark mode matching the Flent Secured app
- Bloomberg Terminal density — data-rich, professional

---

## Design System Tokens

### Colors (verified against `rn-app/src/theme/colors.ts`)

| Token | Value | Source | Usage |
|-------|-------|--------|-------|
| `--bg` | `#131313` | `colors.black[700]` | Page background |
| `--card` | `#202020` | `semanticColors.background.elevated` | Card backgrounds |
| `--secondary-bg` | `#1A1A1A` | `semanticColors.background.secondary` | Sidebar, inputs, nested panels |
| `--accent` | `#FF9A6D` | `colors.brand[500]` | Brand accent, CTAs, active states |
| `--success` | `#06C270` | Admin-specific (diverges from app's `#70BF73`) | Verified, approved, success — chosen for higher contrast on dark bg |
| `--error` | `#E5484D` | Admin-specific (diverges from app's `#FF8080`) | Failed, rejected — chosen for sharper distinction |
| `--warning` | `#FFD580` | `colors.warning.default` | Pending, in-progress |
| `--text-primary` | `#FFFFFF` | — | Headings, primary values |
| `--text-secondary` | `#878787` | `colors.black[200]` | Labels, metadata |
| `--text-tertiary` | `#A9A9A9` | — | Secondary values |
| `--text-value` | `#CBCBCB` | — | Data cell values |
| `--border` | `#4D4D4D` | `colors.black[300]` | Active borders, dividers |
| `--border-subtle` | `#2A2A2A` | Admin-specific token | Card borders, row separators |

> **Note**: `--success` and `--error` intentionally diverge from the consumer app tokens. The admin panel needs higher contrast for status distinction on dense data tables. Document this in the codebase.

### Typography Scale (Bloomberg Terminal density)

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--t-kpi` | 28px | 700 (Bold) | KPI big numbers |
| `--t-heading` | 16px | 600 (SemiBold) | Page titles, section headings |
| `--t-subheading` | 14px | 600 (SemiBold) | Card titles, subsection labels |
| `--t-body` | 13px | 400 (Regular) | Default body text, table cells |
| `--t-body-medium` | 13px | 500 (Medium) | Emphasized table cells (names, amounts) |
| `--t-label` | 11px | 500 (Medium) | Labels, column headers, metadata |
| `--t-overline` | 10px | 600 (SemiBold) | Section overlines, uppercase labels (letter-spacing: 1px) |
| `--t-caption` | 10px | 400 (Regular) | Timestamps, footnotes, coordinates |
| Font | Plus Jakarta Sans | — | All text. Fallback: Inter, system-ui, sans-serif |
| Monospace | JetBrains Mono | — | IDs, hashes, coordinates, PayU txn IDs |

### shadcn/ui Styling Rules
- **Semantic colors only**: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`
- **`gap-*` not `space-*`**: All spacing via flex + gap
- **`size-*` for equal dimensions**: `size-10` not `w-10 h-10`
- **`cn()` for conditional classes**: No manual template ternaries
- **`Badge` variants for status**: Not custom colored spans
- **`FieldGroup` + `Field` for forms**: Not raw div + label
- **Icons use `data-icon`**: No sizing classes on icons inside components
- **`sonner` for toasts**: `toast.success()` / `toast.error()`
- **`AlertDialog` for destructive confirmations**: Approve/reject/bypass use AlertDialog
- **Full Card composition**: Always `CardHeader`/`CardTitle`/`CardContent`/`CardFooter`
- **Chart via Recharts wrapper**: shadcn `Chart` component for all visualizations
- **`Skeleton` for loading**: Every data-dependent section shows Skeleton while loading
- **`Alert` for errors**: API failures show Alert variant="destructive" inline
- **`Empty` for empty states**: No custom empty state markup

---

## shadcn/ui Component Mapping (Latest — ui.shadcn.com)

### Global Shell
| Element | shadcn Component | Notes |
|---------|-----------------|-------|
| Sidebar nav | `Sidebar` | `SidebarMenu` > `SidebarMenuItem` > `SidebarMenuButton`. Collapsible. |
| Search | `Command` inside `Dialog` | Cmd+K — see Command Palette spec below |
| Env toggle | `Select` | `SelectTrigger` (colored dot + label) > `SelectItem` for Dev/Main |
| Avatar menu | `Avatar` + `AvatarFallback` + `DropdownMenu` | Logout, settings, role display |
| KPI strip | 4x `Card` (`CardHeader`/`CardTitle`/`CardContent`) | Flex row |
| Breadcrumb | `Breadcrumb` | Dashboard > Users > Arjun Mehta |
| Loading | `Skeleton` | Per-section skeleton while API loads |
| Errors | `Alert` variant="destructive" | Inline error with retry button |
| Toasts | `sonner` | `toast.success()` / `toast.error()` for action feedback |

### User Detail (all inline, NO tabs)
| Element | Component |
|---------|-----------|
| Header card | `Card` + `Avatar` + `Badge` (status, risk, tenancy) + `Button` group |
| Verification radar | `Chart` (Recharts `RadarChart`) |
| Override controls | `Switch` + `Textarea` + `AlertDialog` (bypass confirm) |
| Credit gauge | `Chart` (Recharts `RadialBarChart`) |
| M360 profile | `Card` + key-value `Table` |
| Agreement | `Card` + `Separator` + `Progress` (confidence) |
| Payment table | `Table` + `Badge` + `ScrollArea` (all payments inline, scrollable) |
| Risk verdicts | `Table` + `Badge` + `Tooltip` (failure reasons) |
| Audit timeline | Custom timeline with `Collapsible` entries |
| Manual review | `Alert` variant + `Button` action |

### Forms & Dialogs
| Element | Component |
|---------|-----------|
| Approve confirm | `AlertDialog` (destructive action pattern) |
| Reject dialog | `Dialog` + `Checkbox` group in `FieldSet`/`FieldLegend` + `Textarea` |
| Override reason | `Textarea` in `Field` + `FieldLabel` (mandatory) |
| Login form | `Card` + `FieldGroup` + `Field` + `Input` + `InputGroup` (password) |
| Invite member | `Dialog` + `FieldGroup` + `Select` (role) |
| Date range | `Popover` + `Calendar` (DatePicker pattern) |

### Data Tables
| Element | Component |
|---------|-----------|
| Users list | `Table` + `Checkbox` + `Badge` + `Pagination` |
| Payments full | `DataTable` pattern (Table + sort + filter headers) |
| Team management | `Table` + `Badge` + `DropdownMenu` (row actions) |
| Activity log | `ScrollArea` + `Card` entries + `Collapsible` |

### Analytics Charts (all via shadcn `Chart` wrapping Recharts)
| Chart | Recharts Type |
|-------|---------------|
| Funnel | `BarChart` (horizontal, decreasing widths) |
| Cohort heatmap | Custom `Table` with colored `Badge` cells |
| Revenue trends | `ComposedChart` (Bar + Line) |
| City breakdown | `BarChart` (horizontal) |
| Risk distribution | `PieChart` |
| Credit histogram | `BarChart` (vertical, binned) |
| Verification coverage | Stacked `BarChart` |
| Override tracking | `BarChart` (grouped: auto vs manual) |
| Verification flow | Horizontal stepped `BarChart` with connected nodes (no Sankey — Paper can't render it) |

### Interaction States (hover, focus, pressed, disabled)

| Element | Hover | Focus | Pressed/Active | Disabled |
|---------|-------|-------|---------------|----------|
| User list row | `bg: #FF9A6D08` (4% accent) + cursor pointer | `outline: 2px solid #FF9A6D40` | `bg: #FF9A6D15` + left border 2px `#FF9A6D` | — |
| Table row (payments) | `bg: #1A1A1A` subtle highlight | `outline: 2px solid #4D4D4D` | — | — |
| Button (primary) | `bg: #FFB08A` (lighter accent) | `ring: 2px #FF9A6D` offset 2px | `bg: #E8845A` (darker) + scale 0.98 | `opacity: 0.4` + `cursor: not-allowed` |
| Button (destructive) | `bg: #E5484D20` fill increase | `ring: 2px #E5484D` | `bg: #E5484D30` | `opacity: 0.4` |
| Switch (override) | Track lightens | `ring: 2px #FF9A6D` | Thumb slides with spring animation | `opacity: 0.3` + Tooltip "View only" |
| Card (KPI) | `border-color: #4D4D4D` (from subtle) | — | — | — |
| Badge | — | — | — | — |
| Sidebar icon | `bg: #FFFFFF10` rounded | — | `bg: #FF9A6D20` + icon `#FF9A6D` | — |
| Search input | `border-color: #FF9A6D` | `ring: 2px #FF9A6D40` | — | — |
| Checkbox | `border-color: #FF9A6D` | `ring: 2px #FF9A6D` | Check animates in (scale spring) | `opacity: 0.3` |
| ToggleGroup item | `bg: #FFFFFF08` | `ring: 2px #4D4D4D` | `bg: #FF9A6D20; border: #FF9A6D; color: #FF9A6D` | `opacity: 0.3` |

**Transition**: All interactive elements use `transition: all 150ms ease` for smooth state changes.

### Status Badge Variants (complete — covers ALL statuses from Status Legend)

| Status | Badge Variant | Color |
|--------|---------------|-------|
| `active` | success | `--success` |
| `approved` | success-light | lighter green |
| `agreement_confirmed` | success-light | lighter green |
| `waitlisted` | warning | `--warning` |
| `signed_up` | secondary | gray |
| `admin_review: approved` | success | green |
| `admin_review: due` | warning | amber |
| `admin_review: rejected` | destructive | red |
| `admin_review: in_progress` | outline | blue |
| `m360: SUCCESS` | success | green |
| `m360: CONSENT_GIVEN` | warning | amber |
| `m360: OTP_SENT` | secondary | gray |
| `m360: FAILED` | destructive | red |
| `tenancy: active` | success | green |
| `tenancy: pending_verification` | warning | amber |
| `tenancy: expired` | destructive | red |
| `tenancy: terminated` | destructive | red |
| `payment: success` | success | green |
| `payment: pending` | warning | amber |
| `payment: failed` | destructive | red |
| `payment: refunded` | secondary | gray |
| `settlement: settled` | success | green |
| `settlement: pending` | warning | amber |
| `risk: LOW` | success outline | green border |
| `risk: MED` | warning outline | amber border |
| `risk: HIGH` | destructive outline | red border |
| `risk: PENDING` | secondary | gray |
| `override: auto` | default | — |
| `override: manual` | accent outline | orange border + "manual" icon |
| `override: bypassed` | warning outline | amber border + "bypassed" icon |
| `rbac: Super Admin` | accent | orange |
| `rbac: Admin` | default | blue |
| `rbac: Viewer` | secondary | gray |

---

## Responsive & Viewport Strategy

The admin panel is **desktop-first** (1440px design width) but must function at smaller viewport sizes for laptop users.

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Desktop XL | ≥1440px | Full layout as designed — sidebar + master-detail |
| Desktop | 1024-1439px | Sidebar collapses to icon-only (64px → 48px), KPI strip condenses to 2 rows |
| Laptop | 768-1023px | Sidebar hidden (hamburger toggle), user list becomes full-width, detail opens as Sheet overlay |
| Tablet | <768px | Not supported — show "Please use a desktop browser" message |

**Key adaptive behaviors:**
- User detail panel: At <1200px, switches from side-by-side to stacked layout (list above, detail below)
- Data tables: Horizontal ScrollArea with frozen first 2 columns (name + status)
- KPI strip: Cards wrap to 2x2 grid at <1200px
- Charts: Resize via Recharts `ResponsiveContainer` — minimum 300px width
- Dialogs: Max-width 90vw, centered

---

## RBAC & Auth System

### Authentication
Email + password login via Supabase Auth. No magic link / no OTP.

### Implementation Strategy
**Hybrid approach**: `admin_users` table as source of truth, with a DB trigger that syncs role into `raw_app_meta_data` JWT claims. Edge functions read role from JWT — no extra DB query.

### New table: `admin_users`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
email TEXT UNIQUE NOT NULL,
name TEXT NOT NULL,
role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'viewer')),
status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
auth_user_id UUID REFERENCES auth.users(id),
last_login_at TIMESTAMPTZ,
created_at TIMESTAMPTZ DEFAULT now(),
deactivated_at TIMESTAMPTZ
```

### Roles (3 tiers) — Detailed Permission Matrix

| Permission | Super Admin | Admin | Viewer |
|-----------|-------------|-------|--------|
| View dashboards | ✅ | ✅ | ✅ |
| View user profiles | ✅ | ✅ | ✅ |
| View decrypted bank details | ✅ (logged) | ✅ (logged, [Reveal] button) | ❌ (masked) |
| View Aadhaar/phone unmasked | ✅ | ❌ (masked) | ❌ (masked) |
| Approve/reject users | ✅ | ✅ | ❌ |
| Batch approve/reject | ✅ | ✅ (max 10) | ❌ |
| Manual override checks | ✅ | ✅ (mandatory justification) | ❌ |
| Bypass checks | ✅ | ❌ | ❌ |
| Revert overrides | ✅ | ❌ | ❌ |
| Switch to Dev env | ✅ | ✅ | ❌ |
| Manage team members | ✅ | ❌ | ❌ |
| Export audit logs | ✅ | ✅ | ❌ |
| Delete user data | ✅ | ❌ | ❌ |
| View activity log | ✅ | ✅ | ✅ |

### Bootstrap
First Super Admin created via seed migration or CLI script (`scripts/create-first-admin.ts`). Cannot use UI.

### Safety Rails
- **Self-demotion prevention**: DB constraint `CHECK (COUNT(*) >= 1)` for active super_admins. The last Super Admin cannot demote/deactivate themselves.
- **Viewer guardrails**: All action buttons render disabled with `Tooltip` → "View only — contact a Super Admin for access"
- **Admin justification**: Override `Switch` requires non-empty `Textarea` before submitting

---

## Audit Log System

### Existing Infrastructure
An `audit_logs` table already exists (`supabase/migrations/20260121000008_create_audit_logs_table.sql`) with `AuditLogger` class in `_shared/audit.ts`.

### Required Migrations (new columns)
```sql
ALTER TABLE audit_logs ADD COLUMN actor_email TEXT;
ALTER TABLE audit_logs ADD COLUMN actor_role TEXT;
ALTER TABLE audit_logs ADD COLUMN environment TEXT CHECK (environment IN ('main', 'dev'));
ALTER TABLE audit_logs ADD COLUMN target_check TEXT; -- for override/bypass actions
```

### Tamper-proofing
```sql
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
```
Only `INSERT` allowed. Append-only.

### Action Types Tracked

| Action Type | Details Logged |
|-------------|---------------|
| `user.approve` | target user, admin note, risk level at time |
| `user.reject` | target user, rejection reasons[], cooldown hours |
| `user.set_in_progress` | target user |
| `user.batch_approve` | user_ids[], count |
| `user.batch_reject` | user_ids[], reasons[], count |
| `check.override` | target user, check_type, previous_value, reason |
| `check.bypass` | target user, check_type, reason |
| `check.revert` | target user, check_type, reason |
| `check.mark_reviewed` | target user, extraction_id |
| `auth.login` | admin email, IP |
| `auth.logout` | admin email |
| `team.invite` | new member email, assigned role |
| `team.role_change` | member email, old_role, new_role |
| `team.deactivate` | member email |
| `data.view_sensitive` | target user, field_type (bank_details/aadhaar/phone) |
| `data.export` | export_type, row_count, filters applied |

---

## Manual Override & Bypass Architecture

### New table: `verification_overrides`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
tenancy_id UUID REFERENCES tenancies(id) NOT NULL,
check_type TEXT NOT NULL CHECK (check_type IN (
  'bank_verified', 'utility_verified', 'landlord_approved',
  'm360_identity', 'agreement_extraction', 'name_matching', 'penny_drop'
)),
override_type TEXT NOT NULL CHECK (override_type IN ('override', 'bypass')),
previous_value BOOLEAN,
reason TEXT NOT NULL,
admin_id UUID REFERENCES admin_users(id) NOT NULL,
admin_email TEXT NOT NULL,
created_at TIMESTAMPTZ DEFAULT now(),
reverted_at TIMESTAMPTZ,
reverted_by UUID REFERENCES admin_users(id),
revert_reason TEXT,
UNIQUE(tenancy_id, check_type) WHERE reverted_at IS NULL -- only one active override per check
```

### Semantics
- **Override**: Changes a check result (failed → passed). The `tenancies.bank_verified` etc. column gets set to `true` and the override record provides the audit trail.
- **Bypass**: Skips a check entirely. The check column stays `false`/`null`, but a bypass record exists that downstream logic treats as equivalent to passed.

### Computed view: `v_effective_verifications`
A view that UNION's actual verification results with active overrides/bypasses, so all verification-checking code reads from one place.

### Reversion Rules
- Super Admin can revert any override/bypass
- Overrides on users with completed payments become **non-revertible** (too many downstream effects)
- Reversion sets `reverted_at`, `reverted_by`, `revert_reason` and does NOT delete the record
- The check reverts to its pre-override state (`previous_value`)

### 3-State Toggle in UI
Each verification check shows one of:
1. **Auto** (default) — system-determined result, no override
2. **Overridden** — admin manually approved, shows orange "manual" badge
3. **Bypassed** — admin skipped check, shows amber "bypassed" badge

Clicking the toggle cycles: Auto → Override (requires reason dialog) → Bypass (Super Admin only, requires reason + AlertDialog)

---

## Backend: New Edge Functions Required (9 total)

| Function | Purpose | Auth |
|----------|---------|------|
| `admin-auth` | Email+password login → returns JWT with `admin_role` claim | Public (login endpoint) |
| `admin-team` | CRUD admin_users (invite, edit role, deactivate) | Super Admin JWT |
| `admin-override` | Override/bypass/revert verification checks | Admin+ JWT (bypass = Super Admin) |
| `admin-audit-logs` | Paginated, filtered audit log queries | Admin+ JWT |
| `admin-audit-export` | CSV/JSON export of audit logs | Admin+ JWT |
| `admin-user-edit` | Edit user data fields | Super Admin JWT |
| `admin-analytics` | Aggregated analytics (materialized views) | Any admin JWT |
| `admin-mark-reviewed` | Clear `needs_manual_review` flag | Admin+ JWT |
| `admin-nudge-retry` | Send push notification to user with payment deep link | Admin+ JWT |

> **Existing functions retained**: `admin-waitlist` (approve/reject/set_in_progress), `admin-fetch-views` (replaced with paginated queries), `admin-payment-data` (add role-based masking)

> **Auth migration**: All admin edge functions switch from shared `ADMIN_API_KEY` to per-user Supabase JWT. The shared key is retained as emergency bypass only (Super Admin, rate-limited).

---

## Dev/Main Environment Switcher

### Architecture
- Frontend holds both Supabase URLs + anon keys
- Toggling creates a new Supabase client instance pointing to the selected environment
- `ADMIN_API_KEY` is DIFFERENT per environment
- JWT tokens are environment-specific (signing key differs)

### Safety Rails
1. **Visual distinction**: Dev gets a persistent orange top border (4px) across the entire page + "DEV" watermark in bottom-right corner — not just a small dot
2. **Action confirmation**: Every destructive action on Main shows an AlertDialog that names "PRODUCTION" in bold red text
3. **No confirmation needed on Dev**: Actions on Dev execute immediately (it's a test environment)
4. **Viewer role cannot switch**: Only Super Admin and Admin can access Dev

### Data
- RBAC is shared (via Supabase Branching — Dev inherits Main's admin_users)
- Audit logs record which environment was targeted

---

## Data Freshness Strategy

| Data Type | Strategy | Frequency |
|-----------|----------|-----------|
| Dashboard KPIs | Materialized views refreshed via `pg_cron` | Every 15 min |
| User list | Paginated REST query to `v_user_funnel` | On-demand (with 30s stale-while-revalidate) |
| User detail | Direct query with joins | On-demand (click to load) |
| Review queue | Supabase Realtime subscription | Real-time (new waitlist entries) |
| Payment status | Supabase Realtime subscription | Real-time (status changes) |
| Analytics | Materialized views | Every 15 min |
| Audit logs | Direct query (append-only, always fresh) | On-demand |

### Performance
- `v_user_funnel` uses 6 joins (3 LATERAL). At >1000 users, paginate (LIMIT 50 + offset).
- Never use monolithic `admin-fetch-views` for the web panel. Each page makes targeted queries.
- Analytics use materialized views to avoid expensive real-time aggregations.

---

## Security Enhancements

1. **Per-user JWT auth** replaces shared admin key. Each admin gets their own Supabase Auth account.
2. **Role-based data masking**: Phone → last 4 digits for Viewer. Aadhaar → masked for Admin/Viewer. Bank details → [Reveal] button for Admin (logged), always visible for Super Admin (logged).
3. **Sensitive data view logging**: Clicking [Reveal] on masked data logs a `data.view_sensitive` audit entry.
4. **Rate limiting**: Admin endpoints rate-limited (100 req/min per user, 10 batch actions/hour).
5. **Session timeout**: 4-hour idle timeout, 24-hour absolute timeout.

---

## Artboards to Build in Paper (15 total)

### Artboard 0: Design System (1440x2400, scrollable) — BUILD FIRST

The design system artboard is the **single source of truth** for all visual decisions. Every other artboard references components defined here. Built as a vertical catalog in Paper.

#### Section A: Color Palette (full-width, 6 rows)

**Row 1 — Backgrounds** (3 swatches, 200x120px each):
| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| Large dark rectangle | `--bg` | `#131313` | Page background |
| Slightly lighter | `--card` | `#202020` | Card surfaces |
| Subtle lift | `--secondary-bg` | `#1A1A1A` | Sidebar, inputs, nested panels |

**Row 2 — Brand & Semantic** (4 swatches):
| Swatch | Token | Hex | Usage |
|--------|-------|-----|-------|
| Orange | `--accent` | `#FF9A6D` | Brand, CTAs, active |
| Green | `--success` | `#06C270` | Verified, approved |
| Red | `--error` | `#E5484D` | Failed, rejected |
| Amber | `--warning` | `#FFD580` | Pending, in-progress |

**Row 3 — Text** (5 swatches on dark bg):
| Swatch | Token | Hex | Sample |
|--------|-------|-----|--------|
| White | `--text-primary` | `#FFFFFF` | "Arjun Mehta" |
| Med gray | `--text-secondary` | `#878787` | "SIGNED UP" |
| Light gray | `--text-tertiary` | `#A9A9A9` | "+91 98765..." |
| Value gray | `--text-value` | `#CBCBCB` | "₹25,000" |
| Emphasis | `--text-emphasis` | `#DDDDDD` | "742" |

**Row 4 — Borders** (2 swatches with visible border lines):
| Line | Token | Hex | Usage |
|------|-------|-----|-------|
| Stronger | `--border` | `#4D4D4D` | Active borders, inputs |
| Subtle | `--border-subtle` | `#2A2A2A` | Card borders, row dividers |

**Row 5 — Status Colors with opacity variants** (used for backgrounds behind badges):
| Color | 100% | 20% (bg fill) | 40% (border) |
|-------|------|---------------|--------------|
| Success | `#06C270` | `#06C27033` | `#06C27066` |
| Error | `#E5484D` | `#E5484D33` | `#E5484D66` |
| Warning | `#FFD580` | `#FFD58033` | `#FFD58066` |
| Accent | `#FF9A6D` | `#FF9A6D33` | `#FF9A6D66` |

**Row 6 — Environment Colors**:
| Env | Dot | Label | Border | Banner bg |
|-----|-----|-------|--------|-----------|
| Main | `#06C270` (8px circle) | "Main" in `#06C270` | none | none |
| Dev | `#FF9A6D` (8px circle, pulsing ring) | "Dev" in `#FF9A6D` | 4px top `#FF9A6D` | `#FF9A6D15` |

#### Section B: Typography Scale (full-width column, each line is a sample)

Each row: token name (left, 11px `#878787`), sample text (center, actual size/weight), specs (right, 10px monospace `#4D4D4D`).

| Token | Sample | Specs |
|-------|--------|-------|
| `--t-kpi` | **₹4,52,300** | Plus Jakarta Sans / 28px / Bold 700 |
| `--t-heading` | **User Verification** | Plus Jakarta Sans / 16px / SemiBold 600 |
| `--t-subheading` | **Agreement & Property** | Plus Jakarta Sans / 14px / SemiBold 600 |
| `--t-body` | Arjun Mehta, Mumbai | Plus Jakarta Sans / 13px / Regular 400 |
| `--t-body-medium` | ₹25,000 | Plus Jakarta Sans / 13px / Medium 500 |
| `--t-label` | TOTAL USERS | Plus Jakarta Sans / 11px / Medium 500 |
| `--t-overline` | VERIFICATION STATUS | Plus Jakarta Sans / 10px / SemiBold 600 / uppercase / 1px tracking |
| `--t-caption` | 05 Mar 2026 14:30 | Plus Jakarta Sans / 10px / Regular 400 |
| `--t-mono` | `cf_abc123` | JetBrains Mono / 12px / Regular 400 |

#### Section C: Spacing Scale (horizontal ruler with labeled stops)

Visual ruler showing spacing tokens as colored bars on a dark background:
`4px` · `8px` · `12px` · `16px` · `24px` · `32px` · `40px` · `48px`

Each bar labeled with its common usage:
- 4px: icon-to-text gap
- 8px: compact padding (badges, small cards)
- 12px: table cell padding, tight gaps
- 16px: card padding, standard gap
- 24px: section gap, large padding
- 32px: between major sections
- 40px: page horizontal padding
- 48px: between artboard regions

#### Section D: Component Library (the main catalog)

**D1 — Buttons** (row of button variants, each shown in default + hover + pressed + disabled states):

| Variant | Default | Hover | Pressed | Disabled |
|---------|---------|-------|---------|----------|
| Primary (accent) | `bg:#FF9A6D color:#131313` | `bg:#FFB08A` | `bg:#E8845A scale:0.98` | `opacity:0.4` |
| Secondary (outline) | `border:#4D4D4D color:#CBCBCB bg:transparent` | `bg:#FFFFFF08` | `bg:#FFFFFF12` | `opacity:0.4` |
| Destructive | `bg:#E5484D20 border:#E5484D color:#E5484D` | `bg:#E5484D30` | `bg:#E5484D40` | `opacity:0.4` |
| Ghost | `bg:transparent color:#878787` | `bg:#FFFFFF08` | `bg:#FFFFFF12` | `opacity:0.3` |
| Success | `bg:#06C270 color:#131313` | `bg:#1AD47F` | `bg:#05A35C` | `opacity:0.4` |
| Link | `color:#FF9A6D underline:none` | `underline` | — | `opacity:0.4` |

Sizes: `sm` (28px height, 12px text), `md` (36px height, 13px text), `lg` (44px height, 14px text).
Button with icon: icon `data-icon="inline-start"` + 8px gap + label.

**D2 — Badges** (grid of all status badge variants):

Row 1 — User status: `active` (green fill), `approved` (light green), `agreement_confirmed` (light green), `waitlisted` (amber), `signed_up` (gray)
Row 2 — Admin review: `approved` (green), `due` (amber), `rejected` (red), `in_progress` (blue outline)
Row 3 — M360: `SUCCESS` (green), `CONSENT_GIVEN` (amber), `OTP_SENT` (gray), `FAILED` (red)
Row 4 — Tenancy: `active` (green), `pending_verification` (amber), `expired` (red), `terminated` (red)
Row 5 — Payment: `success` (green), `pending` (amber), `failed` (red), `refunded` (gray)
Row 6 — Settlement: `settled` (green), `pending` (amber)
Row 7 — Risk: `LOW` (green outline), `MED` (amber outline), `HIGH` (red outline), `PENDING` (gray)
Row 8 — Override: `auto` (default), `manual` (orange outline + ✏️), `bypassed` (amber outline + ⏭️)
Row 9 — RBAC: `Super Admin` (orange), `Admin` (blue), `Viewer` (gray)

Each badge: `padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500;` + variant-specific colors.

**D3 — Cards** (3 card variants side-by-side):

| Variant | Style | Usage |
|---------|-------|-------|
| Standard Card | `bg:#202020 border:1px solid #2A2A2A radius:8px padding:16px` | Most content cards |
| KPI Card | Same + overline title (10px) + big value (28px) + subtitle (10px) | Dashboard KPIs |
| Alert Card | `border-left: 3px solid [color]` + icon + title + description | Warnings, errors, info |

Each card shown with realistic content filled in.

**D4 — Form Controls** (column of input states):

| Control | Default | Focus | Error | Disabled |
|---------|---------|-------|-------|----------|
| Input | `bg:#1A1A1A border:#4D4D4D radius:6px padding:8px 12px color:#FFFFFF` | `border:#FF9A6D ring:2px #FF9A6D40` | `border:#E5484D` | `opacity:0.4` |
| Select | Same as Input + chevron icon right | Same focus ring | Same error border | Same |
| Switch (off) | `bg:#4D4D4D` track, `#878787` thumb | ring | — | `opacity:0.3` |
| Switch (on) | `bg:#FF9A6D` track, `#FFFFFF` thumb | ring | — | `opacity:0.3` |
| Checkbox (unchecked) | `border:#4D4D4D radius:3px 16x16px` | `border:#FF9A6D` | — | `opacity:0.3` |
| Checkbox (checked) | `bg:#FF9A6D border:#FF9A6D` + white checkmark | ring | — | `opacity:0.3` |
| Textarea | Same as Input, height 80px | Same | Same | Same |

**D5 — Table Row** (single row anatomy, exploded view):

A table row dissected to show each element:
```
[16px checkbox] [8px gap] [8px status dot] [12px gap] [Name 13px medium flex:1] [Phone 13px #A9A9A9 100px] [City 11px #878787 80px] [Rent 13px tabular-nums 80px] [Badge 60px] [Actions 120px]
```
Row height: 44px. Bottom border: 1px `#1A1A1A`. Hover: `bg:#FF9A6D08`.
Selected: `bg:#FF9A6D15` + left border 2px `#FF9A6D`.

**D6 — Avatar** (3 sizes):
- Small (32px): initials, used in header/sidebar. `bg:#FF9A6D color:#131313 radius:50% font:14px bold`
- Medium (40px): used in table rows, activity feed.
- Large (48px): used in user detail header. `font:18px bold`
- Fallback: first letter of first name + first letter of last name (e.g., "AM" for Arjun Mehta)

**D7 — Charts** (4 chart type previews):

| Chart | Type | SVG Preview |
|-------|------|-------------|
| Radar (7 spokes) | Verification coverage | Heptagon with filled area |
| Radial gauge | Credit score (742/900) | Circle with stroke-dasharray |
| Bar chart (horizontal) | Funnel stages | 6 decreasing-width bars |
| Bar chart (vertical) | Revenue by month | 6 columns with line overlay |

Each shown at 200x200px with sample data and color scheme applied.

**D8 — Dialogs** (2 dialog shells):

| Dialog | Size | Content preview |
|--------|------|-----------------|
| AlertDialog (confirm) | 420px | Title + description + 2 buttons (Cancel, Confirm) |
| Dialog (form) | 420px | Title + FieldGroup (3 fields) + 2 buttons |

Both shown on `#00000099` overlay background.

**D9 — Sidebar** (vertical strip, 64px wide):

6 icon slots vertically stacked:
- 📊 Dashboard (active: `#FF9A6D` bg pill)
- 👥 Users (inactive: `#878787` icon)
- 💰 Payments
- 📈 Analytics
- 📋 Activity
- ⚙️ Settings

Active state: rounded rectangle bg `#FF9A6D20` behind icon, icon color `#FF9A6D`.
Hover: `bg:#FFFFFF10`.

**D10 — Loading Skeleton** (3 skeleton patterns):
- Text line: `bg:#2A2A2A radius:4px height:12px` with shimmer animation
- Card: `bg:#2A2A2A radius:8px height:120px` with shimmer
- Avatar circle: `bg:#2A2A2A radius:50% 48x48px` with shimmer

**D11 — Toast Notifications** (4 variants stacked):
- Success: green left accent, checkmark icon, "User approved successfully"
- Error: red left accent, X icon, "Failed to load data. Retry?"
- Warning: amber left accent, ⚠️ icon, "Utility check bypassed"
- Info: blue left accent, ℹ️ icon, "Switched to Dev database"

Each toast: `bg:#202020 border:1px solid #2A2A2A radius:8px padding:12px 16px` + 3px left border colored.

**D12 — Environment Indicator** (side-by-side):
- Main: Green dot (8px) + "Main" label `#06C270` + no border
- Dev: Orange dot (8px) with double-ring pulse + "Dev" label `#FF9A6D` + 4px top border `#FF9A6D` + warning banner below

---

### Global Shell (shared across all artboards)
```
┌─────────────────────────────────────────────────────────────┐
│ [DEV: 4px orange top border]                                │
│ HEADER (56px) — Logo, Cmd+K Search, Dev/Main, Avatar+Role   │
├─────────────────────────────────────────────────────────────┤
│ KPI STRIP (72px) — Total Users | Revenue | Conversion | Reviews │
├──────┬──────────────────────────────────────────────────────┤
│ SIDE │ MAIN CONTENT                                         │
│ BAR  │ [Breadcrumb: Dashboard > Users > Arjun Mehta]        │
│ 64px │                                                      │
│      │ [Skeleton/Loading state while data loads]             │
│ 📊   │                                                      │
│ 👥   │ [Alert: "Failed to load data. Retry" on error]       │
│ 💰   │                                                      │
│ 📈   │                                                      │
│ 📋   │                                                      │
│ ⚙️   │                                                      │
└──────┴──────────────────────────────────────────────────────┘
```

**Sidebar** (6 items): Dashboard, Users, Payments, Analytics, Activity Log, Settings (Super Admin only)

### Command Palette (Cmd+K)
Opens a `Command` inside `Dialog` overlay (520px wide, top-centered, max-height 400px).

**CommandInput**: Placeholder "Search users, pages, actions..."

**CommandGroups** (shown based on input):

**Empty state (no input)**:
- `CommandGroup` "Quick Actions": Approve selected user, Reject selected user, Switch environment, Export audit log
- `CommandGroup` "Navigate": Dashboard, Users, Payments, Analytics, Activity Log, Settings

**User search (typing a name/phone)**:
- `CommandGroup` "Users": Matching users shown as `CommandItem` with Avatar + Name + Phone (masked) + Status badge + City
- Click to navigate: opens user detail view
- Max 8 results, fuzzy match on name + phone

**Page search (typing a page name)**:
- `CommandGroup` "Pages": Dashboard, Users, Payments, etc.

**Action search (typing an action)**:
- `CommandGroup` "Actions": "Approve user", "Reject user", "Switch to Dev", "Export audit log", "Invite team member"

Each `CommandItem` shows: icon (left), label, description/badge (right), keyboard shortcut hint (far right, monospace).

### Keyboard Shortcuts (Bloomberg Terminal density)
| Shortcut | Action |
|----------|--------|
| `Cmd+K` / `Ctrl+K` | Open Command palette (search users, navigate pages) |
| `1-6` | Switch sidebar pages (1=Dashboard, 2=Users, 3=Payments, 4=Analytics, 5=Activity, 6=Settings) |
| `↑` / `↓` | Navigate user list rows |
| `Enter` | Open selected user detail |
| `Escape` | Close detail panel / dialog / Command palette |
| `A` | Approve selected user (when detail open, triggers confirm dialog) |
| `R` | Reject selected user (triggers reject dialog) |
| `Shift+A` | Select all visible users (batch mode) |
| `Cmd+E` / `Ctrl+E` | Toggle Dev/Main environment |
| `Cmd+Shift+F` | Focus search / filter input |
| `/` | Focus search (vim-style) |

Shortcuts shown in Tooltip on hover for each action button. Full shortcut reference accessible via `?` key (opens help Sheet).

---

### Artboard 1: Dashboard (1440x900)

**KPI strip** (72px height, 16px gap between cards, always visible):
- Card 1: "TOTAL USERS" (10px overline) / "47" (28px bold white) / "+5 this week" (10px `#06C270`)
- Card 2: "REVENUE" / "₹4,52,300" (28px bold) / "+61% MoM" (10px `#06C270` with ↑ arrow)
- Card 3: "CONVERSION" / "34.2%" (28px bold) / "signup → payment" (10px `#878787`)
- Card 4: "PENDING REVIEWS" / "8" (28px bold `#FFD580`) / "6 due, 2 in progress" (10px `#878787`). Entire card has `border-color: #FFD580` when count > 0

**Content** (main area below KPI, padding: 24px, gap: 24px between sections):

1. **Funnel** (Card, full width, height ~200px):
   - Title: "USER FUNNEL" (10px overline)
   - 6 horizontal bars, decreasing width. Each bar: count left-aligned inside bar (16px bold white), stage label below (11px `#878787`), conversion % between stages (11px `#878787`), drop-off shown as red "−15" label between bars
   - Bars use `#FF9A6D` at 30% opacity fill, `#FF9A6D` border-left 3px for each
   - Chart min-height: 160px

2. **Revenue row** (3 Cards side-by-side, flex: 1 each):
   - "Total Collected": ₹4,52,300 (28px bold), "All time" (10px)
   - "This Month": ₹1,52,300 (28px bold `#06C270`), "Mar 2026" (10px), "+61%" badge
   - "Avg Rent": ₹18,950 (28px bold), "Per tenant/month" (10px)

3. **Review queue** (Card, ~50% width, left):
   - Title: "PENDING REVIEW" (10px overline) + Badge "8" (amber)
   - Compact table (5 rows, 36px row height):
     - Columns: Name (13px medium, 120px), Phone (13px `#A9A9A9`, 100px, masked), City (11px, 80px), Rent ₹ (13px tabular-nums, 80px), Risk (Badge, 60px), Actions (2 small Buttons, 120px)
     - [✓] Button (24px, green icon), [✗] Button (24px, red icon) — compact approve/reject
   - Footer link: "View all →" in `#FF9A6D` 11px

4. **Activity feed** (Card, ~50% width, right, beside review queue):
   - Title: "RECENT ACTIVITY" (10px overline)
   - ScrollArea max-height 240px
   - 10 entries, each 48px: timestamp (10px `#878787` left), actor (11px) + role Badge (tiny), action (13px `#CBCBCB`), target name (`#FF9A6D` link)
   - Separator between entries

---

### Artboard 2: Users — List View (1440x900)

**Left panel (40% = 550px)**:
- Search: Input with search icon, placeholder "Search by name or phone..."
- Filter pills: ToggleGroup filter — All (47) | Active (12) | Waitlisted (28) | Approved (5) | Agreement Confirmed (2) | Signed Up (2)
- Sort: Select — "Signup date" / "Rent amount" / "Status" / "Risk level"
- Table columns: Checkbox | Status dot | Name (13px medium) | Phone (masked, 13px) | City (11px) | Rent ₹ (13px, tabular-nums) | Tenancy status badge | Admin review badge
- Batch bar (hidden until selection): "N selected" + [Approve] [Reject] [Clear]
- Footer: Pagination "1-10 of 47"

**Right panel (60%)**: Empty component — "Select a user to view their profile"

**Sample data** (10 rows with realistic Indian names and data):

| # | Name | Phone | City | Rent (₹) | Status | Tenancy | Admin Review | Risk |
|---|------|-------|------|-----------|--------|---------|-------------|------|
| 1 | Rahul Sharma | +91 98XXX XX210 | Mumbai | 25,000 | active | active | approved | LOW |
| 2 | Priya Patel | +91 87XXX XX543 | Bangalore | 18,000 | active | active | approved | LOW |
| 3 | Arjun Mehta | +91 99XXX XX876 | Mumbai | 32,000 | waitlisted | pending_verification | due | MED |
| 4 | Sneha Iyer | +91 76XXX XX432 | Bangalore | 22,000 | waitlisted | — | due | LOW |
| 5 | Vikram Singh | +91 88XXX XX765 | Mumbai | 45,000 | approved | pending_verification | approved | LOW |
| 6 | Ananya Gupta | +91 91XXX XX098 | Bangalore | 15,000 | agreement_confirmed | — | due | HIGH |
| 7 | Rohan Desai | +91 82XXX XX321 | Mumbai | 28,000 | waitlisted | — | in_progress | MED |
| 8 | Kavita Reddy | +91 95XXX XX654 | Bangalore | 20,000 | active | active | approved | LOW |
| 9 | Amit Joshi | +91 70XXX XX987 | Mumbai | 35,000 | signed_up | — | due | PENDING |
| 10 | Deepika Nair | +91 93XXX XX111 | Bangalore | 16,500 | signed_up | — | due | PENDING |

---

### Artboard 3: Users — Detail View (1440x2200, scrollable) — THE HERO

**Everything inline. NO tabs. One continuous scrollable profile.**

#### User Header Bar (Card, sticky at top of detail panel)
- Avatar (48px, initials), Name (16px SemiBold), Phone (13px secondary), `user_status` badge, `tenancy_status` badge
- Quick metrics in header: **Verification: 5/7** (green text) | **Risk: LOW** (`risk_level` badge) | **Credit: 742** (`m360_credit_score`) | **Rent: ₹25,000** (`monthly_rent_paise` / 100, accent)
- Signed up (`signed_up_at`): 15 Mar 2026 | Last status change: `status_updated_at` (NOT "last active" — that field doesn't exist)
- Action buttons (role-gated): [Approve] [Reject] [Set In Progress] — shown based on current admin_review state
- Viewer sees buttons disabled with Tooltip "View only"

#### Section 1: Verification Graph + Override Controls
**Left (50%): Radar chart** — 7 spokes: Bank, Utility, Landlord, M360, Agreement, Name Match, Penny Drop
- Each spoke: 0 (not started) → 0.5 (pending) → 1.0 (passed). Failed = red fill.
- Center: "5/7" verification score in 28px bold
- Filled area in `#FF9A6D` at 30% opacity

**Right (50%): Override checklist** — 7 rows, each:
| Check | Auto Result | Status | Override |
|-------|-------------|--------|----------|
| Bank Verified | ✅ Passed (12 Mar) | `auto` | Switch (disabled — already passed) |
| Utility Verified | ❌ Not verified | `auto` | Switch → ON requires reason Textarea |
| Landlord Approved | ✅ Approved (14 Mar) | `auto` | Switch (disabled) |
| M360 Identity | ⏳ CONSENT_GIVEN | `pending` | Switch + [Bypass] (Super Admin) |
| Agreement Extraction | ✅ Completed (85%) | `auto` | Switch (disabled) |
| Name Matching | ⚠️ PARTIAL (score: 62) | `auto` | Switch → ON requires reason |
| Penny Drop | ❌ FAILED | `failed` | Switch → ON requires reason |

- Override Switch: `Switch` component. When toggled ON, inline `Textarea` appears ("Reason for manual override *"). Submit with Enter.
- Bypass button: Only visible to Super Admin. `Button` variant="outline" amber. Triggers `AlertDialog`: "Bypass utility check? This user will proceed without utility verification."
- Each overridden/bypassed row shows: orange "manual" or amber "bypassed" badge + admin email + timestamp
- Revert button: `Button` variant="ghost" red, Super Admin only. AlertDialog confirmation.

#### Section 2: Identity & Risk (M360 Data)
**Left column: Credit Score Gauge**
- Circular `RadialBarChart`: 742/900, green zone (700+), amber (500-700), red (<500)
- Below: Risk Level "LOW" badge, Risk Safe "Yes" green dot, Risk Reason text (from `v_m360_detail.risk_reason`)

**Right column: M360 Profile Card** — 2-column key-value:
| Field | Value |
|-------|-------|
| Full Name (`m360_full_name`) | Arjun Mehta |
| Gender (`m360_gender`) | Male |
| DOB (`m360_date_of_birth`) | 15 Jun 1994 |
| Age (`m360_age`) | 31 |
| Occupation (`m360_occupation`) | Salaried |
| Income (`m360_total_income`) | ₹10-15 Lakhs |
| Aadhaar (`m360_aadhaar_masked`) | XXXX XXXX 4321 (masked for Admin/Viewer) |
| Credit Score (`m360_credit_score`) | 742 |
| Mobile Provider (`m360_mobile_provider`) | Jio |
| Connection Type (`m360_connection_type`) | Postpaid |
| Phone Type (`phone_type`) | Smartphone |
| M360 Status (`m360_status`) | SUCCESS (badge) |
| OTP Attempts (`otp_attempts`) | 1 |
| Verified At (`m360_verified_at`) | 10 Mar 2026 14:30 |
| Consent Phone | +91 98765 43210 |
| Consent IP (`consent_ip`) | 103.x.x.x |
| Cashfree Verification ID (`cashfree_verification_id`) | cf_abc123 (monospace) |
| Risk Level (`m360_risk_level`) | LOW |
| Risk Safe (`m360_risk_safe`) | Yes |

> Shows ALL 22 columns from `v_m360_detail` including consent_ip, cashfree_verification_id, cashfree_reference_id, otp_sent_at, otp_attempts, created_at, updated_at

#### Section 3: Agreement & Property
Card with Separator between subsections:

**Extraction**: `extraction_status` badge "completed" (green) | Confidence: 85% (`extraction_confidence`, Progress bar, #FF9A6D fill) | `extraction_id` (monospace) | `agreement_verified`: true | Uploaded at: timestamp

**Property**:
| Field | Value |
|-------|-------|
| Address (`property_address`) | 42 Hill Road, Bandra West |
| City (`property_city`) | Mumbai |
| State (`property_state`) | Maharashtra |
| Pincode (`property_pincode`) | 400050 |
| Google Maps Address (`geocode_formatted_address`) | 42 Hill Road, Bandra... |
| Lat (`latitude`), Lng (`longitude`) | 19.0590, 72.8295 (monospace caption) |

**Financials**:
| Field | Value |
|-------|-------|
| Monthly Rent (`monthly_rent_paise` / 100) | ₹25,000 |
| Maintenance (`maintenance_paise` / 100) | ₹3,000 |
| Rent Due Day (`rent_due_day`) | 5th of month |

> Note: `security_deposit` does NOT exist in the DB views — removed from plan (was hallucinated in v1)

**Landlord**: Name (`landlord_name`): Vijay Kumar | Display Name (`landlord_display_name`): Vijay Kumar | Phone (`landlord_phone`): +91 99876 54321

**Lease**: Start (`lease_start_date`): 01 Jan 2026 → End (`lease_end_date`): 31 Dec 2026

#### Section 4: Payment History (ALL payments inline, scrollable)
**Stats row** — 4 mini Cards:
- Payments Made: 3 (from `successful_payments`)
- Total Paid: ₹78,000 (from `total_paid_paise / 100`)
- CB Earned: ₹780 (from `total_cashback_earned_paise / 100`)
- CB Balance: ₹480 (from `cashback_balance_paise / 100`)
- Last Payment: 05 Mar 2026 (from `last_payment_at`)

**Full payment table** (ScrollArea, max-height 300px, all payments — NOT just 5):
| `payment_month` | `due_date` | `payment_status` | `payment_method` | `rent_amount_paise`/100 | `total_amount_paise`/100 | `cashback_applied_paise`/100 | `cashback_earned_paise` | `pg_fee_paise`/100 | `payu_txn_id` | `payu_mihpayid` | `initiated_at` | `paid_at` | `settlement_status` | `settled_at` |
|-------|----------|--------|--------|-----------|-----------|------------|-----------|--------|----------|---------|-----------|---------|------------|------------|
| Mar 2026 | 05 Mar | success | UPI | 25,000 | 26,000 | 200 | 260 | 300 | abc123 | PAY123 | 05 Mar 09:00 | 05 Mar 09:02 | settled | 07 Mar |

> Shows ALL 23 columns from `v_payment_detail` including `payment_id`, `payu_mihpayid`, `tenancy_rent_paise`

#### Section 5: Risk Analysis & Verification Flow
**Verification Flow** — Horizontal stepped bar (replaces node-edge graph, Paper-compatible):
```
[Agreement] → [Extraction] → [Name Match] → [Bank Drop] → [Utility] → [Landlord] → [M360]
   ✅ done       ✅ done      ⚠️ partial    ❌ failed     ⬜ not started  ✅ done    ⏳ pending
```
Each step: colored box with status icon + Tooltip showing score/timestamp/failure reason.

**Verdict Table**:
| Check | Verdict | Score | Details |
|-------|---------|-------|---------|
| Tenant Name | PARTIAL | 62 | M360: "Arjun Mehta" vs Agreement: "A. Mehta" |
| Penny Drop | FAILED | — | Bank holder: "Vijay K" vs Agreement landlord: "Vijay Kumar" |
| Bank Name Match | — | 45 | Below threshold (70) |
| Utility | NOT_ATTEMPTED | — | No utility bill uploaded |
| Landlord | VERIFIED | — | Landlord approved via link |
| Agreement Status | OK | 85% | Confidence above threshold |
| Manual Review | NO | — | Not flagged |
| Lease End | 31 Dec 2026 | — | Not expired |

> Shows ALL columns from `v_risk_detail`: tenant_match_score, penny_drop_status, bank_holder_name, bank_name_match_score, utility_consumer_name, utility_bill_address, utility_address_score, utility_address_verified, agreement_landlord_name, agreement_tenant_name, agreement_verdict, extraction_confidence, needs_manual_review, landlord_status, landlord_approved, risk_factors (JSONB — expanded inline)

#### Section 6: Waitlist & Admin Info
- WL Position (`waitlist_position`): #28 | Admin Review (`admin_review`): "due" (amber badge) | Risk Level (`risk_level`): "LOW" (green badge)
- `tenancy_id`: uuid shown in monospace | `tenancy_status`: "pending_verification" badge
- Audit Status: READY/BLOCKED (computed: READY if no missing data, else BLOCKED)
- Missing Data: computed list — checks extraction_status, property_address, landlord, rent, lease dates, M360, risk_level. Shown as amber pills or "None" (green).
- Referral code: `referral_code` | KYC Status: `kyc_status` | Role: `role`
- Name Source: `name_source` (how name was obtained)

#### Section 7: Audit History (inline, NOT a tab)
Vertical timeline showing all actions on this user:
- Each entry: colored dot (left border), timestamp (10px), actor email + role Badge, action text (13px), Collapsible details
- Override/bypass entries include: check_type, reason, previous_value
- Filter: Select (action type) — inline at top of section
- Export: Button variant="outline" — "Export user audit trail (CSV)"
- Shows last 20 entries with "Load more" Button at bottom

---

### Artboard 4: Users — Batch Actions (1440x900)
Clone of Artboard 2 with 4 checked rows. Batch action bar visible at bottom. Right panel shows comparison mini-cards for the 4 selected users (name, status, city, rent, risk, verification score).

---

### Artboard 5: Payments (1440x900)
Full `v_payment_detail` table with ALL 23 columns.

**Top stats** (4 Cards in row):
- Total Collected: ₹4,52,300 (green if >0)
- Failed: 3 (red badge if >0)
- Pending Settlements: 2 (amber badge if >0)
- This Month: ₹1,52,300 (+61% MoM green arrow)

**Filters row**:
- ToggleGroup: All (42) | Success (32) | Pending (5) | Failed (3) | Refunded (2)
- DatePicker: "From: 01 Mar" — "To: 29 Mar"
- Input: "Filter by user..."
- Select: Settlement — All | Settled | Pending

**Table columns** (dense, 11px uppercase headers, frozen first 2 cols via sticky):

| Column | DB Field | Width | Align | Format |
|--------|----------|-------|-------|--------|
| Phone | `user_phone` | 110px | left | masked (+91 98XXX) |
| Name | `user_name` | 120px | left | truncate |
| Month | `payment_month` | 70px | left | "Mar 26" |
| Due | `due_date` | 70px | left | "05 Mar" |
| Status | `payment_status` | 80px | center | Badge |
| Method | `payment_method` | 70px | left | "UPI" / "Card" |
| Rent (₹) | `rent_amount_paise`/100 | 80px | right | tabular-nums |
| Total (₹) | `total_amount_paise`/100 | 80px | right | tabular-nums |
| CB Applied | `cashback_applied_paise`/100 | 75px | right | tabular-nums |
| CB Earned | `cashback_earned_paise`/100 | 75px | right | tabular-nums |
| PG Fee | `pg_fee_paise`/100 | 65px | right | tabular-nums |
| PayU Txn | `payu_txn_id` | 90px | left | monospace, truncate |
| PayU ID | `payu_mihpayid` | 85px | left | monospace, truncate |
| Initiated | `initiated_at` | 110px | left | "05 Mar 09:00" |
| Paid At | `paid_at` | 110px | left | "05 Mar 09:02" |
| Settlement | `settlement_status` | 80px | center | Badge |
| Settled At | `settled_at` | 90px | left | "07 Mar" |
| Property | `property_address` | 150px | left | truncate with Tooltip |
| City | `property_city` | 80px | left | |
| Landlord | `landlord_name` | 110px | left | truncate |
| Agr. Rent | `tenancy_rent_paise`/100 | 80px | right | tabular-nums |

Total width: ~1870px → requires horizontal ScrollArea with frozen Phone+Name columns.
Row height: 40px. Alternating rows: `#131313` / `#151515`.
**Pagination**: "1-15 of 42 payments" + [Prev] [Next] + page number Select
**Row click**: on click to expand user detail for that payment's user in a Sheet (side panel)

---

### Artboard 6: Analytics Overview (1440x1200)

1. **Funnel Analysis** — Horizontal BarChart with drop-off %.
   - Data: Signed Up: 47 → Agreement: 32 (68%) → Waitlisted: 28 (88%) → Approved: 18 (64%) → Active: 12 (67%) → Paid: 8 (67%)
   - Drop-offs shown in red: -15, -4, -10, -6, -4
   - Comparison: This week (green bars) vs Last week (gray ghost bars)

2. **Cohort Heatmap** — Table with colored cells.
   | Signup Week | Week 1 | Week 2 | Week 3 | Week 4 |
   |-------------|--------|--------|--------|--------|
   | Mar 17-23 | 12 (100%) | 8 (67%) | 5 (42%) | 3 (25%) |
   | Mar 10-16 | 15 (100%) | 11 (73%) | 7 (47%) | 5 (33%) |
   | Mar 3-9 | 10 (100%) | 6 (60%) | 4 (40%) | 2 (20%) |
   | Feb 24-Mar 2 | 10 (100%) | 7 (70%) | 5 (50%) | 3 (30%) |
   Green (>60%) → Amber (30-60%) → Red (<30%)

3. **Revenue Trends** — ComposedChart.
   - Oct: ₹52K | Nov: ₹78K | Dec: ₹1.1L | Jan: ₹1.4L | Feb: ₹2.8L | Mar: ₹4.5L
   - Payment count line overlay: 2, 3, 4, 5, 8, 12
   - MoM growth: +61% (green badge)
   - Avg transaction: ₹26,500

4. **City Breakdown** — Horizontal BarChart.
   - Mumbai: 28 users, ₹3.2L revenue, avg rent ₹27,500
   - Bangalore: 19 users, ₹1.2L revenue, avg rent ₹19,200

5. **Risk Distribution** — PieChart + cross-tab.
   - LOW: 24 (51%) green | MED: 12 (26%) amber | HIGH: 5 (11%) red | PENDING: 6 (13%) gray
   - Cross-tab: LOW+approved: 18, LOW+due: 6, MED+due: 8, MED+in_progress: 4, HIGH+due: 3, HIGH+rejected: 2

6. **Verification Funnel & Override Analytics** — Stacked BarChart.
   - Bank verified: 78% (auto: 72%, overridden: 6%)
   - Utility verified: 65% (auto: 60%, overridden: 3%, bypassed: 2%)
   - Landlord approved: 52% (auto: 50%, overridden: 2%)
   - M360 complete: 89% (auto only)
   - Bypass rate: 4.3% of all checks

7. **M360 Intelligence** — Charts with sample data.
   - Credit histogram: <500: 2, 500-600: 5, 600-700: 12, 700-800: 18, 800+: 4
   - Income: <5L: 15%, 5-10L: 35%, 10-15L: 30%, 15-25L: 15%, 25L+: 5%
   - Occupation: Salaried 65%, Self-employed 20%, Professional 10%, Other 5%
   - M360 Risk: LOW 60%, MED 25%, HIGH 10%, PENDING 5%

---

### Artboard 7: Analytics Segments (1440x900)

4 segment Cards in a row (clickable, selected = accent border):

| Segment | Filter Logic | Count | Accent |
|---------|-------------|-------|--------|
| High Value | `monthly_rent_paise > 3000000` (>₹30K) | 8 | `#FF9A6D` |
| At Risk | `risk_level = 'HIGH'` | 5 | `#E5484D` |
| Stuck in Setup | `tenancy_status = 'pending_verification' AND created_at < now() - 7 days` | 6 | `#FFD580` |
| Churned | `last_payment_at < now() - 60 days OR (successful_payments = 0 AND signed_up_at < now() - 30 days)` | 3 | `#878787` |

Each card: Segment name (14px SemiBold), Count (28px bold, colored), 1-line description (10px `#878787`), Total rent or issue summary.

**Selected segment: "At Risk" (example)**

Metric Cards (4, flex row):
- Avg Rent: ₹24,600
- Avg Credit Score: 485
- Missing Checks: 3.2 avg
- Admin Review: 3 due, 2 rejected

Filtered Table:
| Name | Phone | City | Risk | Credit | Missing Data | Admin Review | `needs_manual_review` |
|------|-------|------|------|--------|-------------|-------------|----------------------|
| Ananya Gupta | +91 91XXX | Bangalore | HIGH (red) | 420 | Agreement, Utility | due | YES (amber) |
| Rohan Desai | +91 82XXX | Mumbai | HIGH | 510 | M360, Landlord | in_progress | YES |
| Amit Joshi | +91 70XXX | Mumbai | HIGH | 380 | All checks | due | YES |
| ... | | | | | | | |

Click any row → opens user detail in the Users page with that user selected.

---

### Artboard 8: Activity Log (1440x900)

Filters: Select (action type — all categories from audit table), DatePicker (range), Input (actor search)
Feed: Each entry = Card with colored left border + Collapsible details.
Actor: email + role Badge. Target: user name link. Environment: "Main"/"Dev" Badge.
Bottom: "Load more" Button.

**10 sample entries:**

| Time | Actor | Role | Action | Target | Env | Color |
|------|-------|------|--------|--------|-----|-------|
| 2 min ago | rishabh@flent.in | Super Admin | Approved user | Rahul Sharma | Main | green |
| 15 min ago | rishabh@flent.in | Super Admin | Rejected user (Expired lease) | Amit Joshi | Main | red |
| 32 min ago | admin@flent.in | Admin | Overrode bank_verified (Reason: "Manual penny drop confirmed via NEFT") | Arjun Mehta | Main | amber |
| 1 hr ago | rishabh@flent.in | Super Admin | Bypassed utility_verified (Reason: "Govt employee, utility in dept name") | Sneha Iyer | Main | amber |
| 1 hr ago | viewer@flent.in | Viewer | Viewed decrypted bank details | Priya Patel | Main | blue |
| 2 hrs ago | rishabh@flent.in | Super Admin | Batch approved 3 users | [Kavita, Priya, Rahul] | Main | green |
| 3 hrs ago | admin@flent.in | Admin | Set in_progress | Rohan Desai | Main | amber |
| 5 hrs ago | rishabh@flent.in | Super Admin | Changed role: viewer → admin | admin@flent.in | Main | blue |
| Yesterday | rishabh@flent.in | Super Admin | Invited new team member | viewer@flent.in (Viewer) | Main | blue |
| Yesterday | rishabh@flent.in | Super Admin | Reverted override on bank_verified | Vikram Singh | Main | red |

---

### Artboard 9: Action Dialogs (1440x900)

**Approve AlertDialog** (420px):
- Title: "Approve user"
- Body: "This will approve **Arjun Mehta** on **PRODUCTION** and activate their tenancy."
- Summary: Name, Phone, Risk Level, City, Rent — in compact key-value
- Optional note: Textarea placeholder "Add admin note (optional)"
- Buttons: [Cancel] (secondary) | [Confirm Approval] (green, `#06C270` bg)
- Toast on success: `toast.success("Arjun Mehta approved successfully")`
- Toast on error: `toast.error("Failed to approve user. Please try again.")`

**Reject Dialog** (420px):
- Title: "Reject user"
- Body: "This will reject **Arjun Mehta** from the waitlist."
- FieldSet + FieldLegend "Rejection reason *":
  - Checkbox: "Expired lease agreement"
  - Checkbox: "Incomplete/invalid agreement"
  - Checkbox: "Unsupported city"
  - Checkbox: "Suspicious activity / fraud risk"
  - Checkbox: "Other" → shows Textarea
- Cooldown: Input (number, default 24) + "hours until re-application"
- Buttons: [Cancel] | [Confirm Rejection] (destructive, `#E5484D` bg)
- Toast: `toast.success("Arjun Mehta rejected. Re-application in 24 hours.")`

**Override Reason Dialog** (360px):
- Title: "Override: Utility Verified"
- Body: "Manually mark utility verification as passed for Arjun Mehta."
- Textarea (mandatory): "Reason for override *" — min 10 characters
- Buttons: [Cancel] | [Confirm Override] (accent)
- Toast: `toast.success("Utility verified overridden for Arjun Mehta")`

**Bypass AlertDialog** (360px):
- Warning icon (⚠️), title: "Bypass: Utility Verified"
- Body: "**Arjun Mehta** will proceed without utility verification. This cannot be undone by Admins — only Super Admins can revert."
- Textarea (mandatory): "Reason for bypass *"
- Buttons: [Cancel] | [Bypass Check] (amber warning button)
- Toast: `toast.warning("Utility check bypassed for Arjun Mehta")`

**Batch Approve Toast**: `toast.success("4 users approved successfully")`
**Environment switch Toast**: `toast.info("Switched to Dev database")`
**Export Toast**: `toast.success("Audit log exported (42 entries)")`
**Error Toast pattern**: `toast.error("Action failed: [error message]. Retry?")`

---

### Artboard 10: Environment Switcher (1440x400)

**Dev (left half)**: Orange 4px top border, orange "DEV" badge in header, branch URL in monospace, Select dropdown expanded, warning banner (Alert): "Connected to Dev database. Changes do not affect production."
**Main (right half)**: No border, green "Main" label, production URL, clean state.

---

### Artboard 11: Summary Dashboard (1440x900)

A single-screen executive summary. Two-column layout (50/50).

**Left column: User Metrics**

1. **Status breakdown** (4 stat Cards, 2x2 grid):
   - Active: 12 (green accent bar, 26%), Waitlisted: 28 (amber bar, 60%), Approved: 5 (light green bar, 11%), Signed Up: 2 (gray bar, 4%)
   - Each card: count (28px bold), label (11px), percentage bar below (4px height, color-coded)

2. **Verification completion** (Card with 4 Progress bars):
   - Bank: 78% (`#06C270` fill, 78% label right-aligned)
   - Utility: 65% (`#FFD580` fill — below 75% threshold)
   - Landlord: 52% (`#E5484D` fill — below 60% threshold)
   - M360: 89% (`#06C270` fill)
   - Each Progress bar: label left (11px), percentage right (13px bold), bar 8px height

3. **Funnel velocity** (Card):
   - "Avg signup → first payment" → "18 days" (28px bold)
   - Mini sparkline showing 30-day trend (declining = good, green)
   - "vs 24 days last month" (10px `#06C270` with ↓ arrow — faster is better)

**Right column: Payment Metrics**

1. **Total GMV** (Card, full width):
   - "₹4,52,300" (32px bold white)
   - "Gross Merchandise Value — All time" (11px `#878787`)

2. **Success rate gauge** (Card with RadialBarChart):
   - Circular gauge: 87% (`#06C270` fill, `#2A2A2A` track)
   - Center: "87%" (24px bold), "Payment success rate" below (10px)

3. **Settlement rate** (Card):
   - "94%" (24px bold `#06C270`), "Settled on time" (11px)
   - "2 pending" (13px `#FFD580` badge)

4. **Failed needing attention** (Card, red accent):
   - "3" (28px bold `#E5484D`), "Failed payments" (11px)
   - Mini list: 3 entries — user name + amount + date
   - [View all →] link

5. **Top 5 highest-rent** (Card with mini Table):
   - 5 rows: Rank (#), Name, City, Rent (₹), Status badge
   - #1 Vikram Singh, Mumbai, ₹45,000, active
   - #2 Amit Joshi, Mumbai, ₹35,000, signed_up
   - etc.

---

### Artboard 12: Login (1440x900)

Centered Card (400px, `#202020` border `#2A2A2A`) on `#131313` full-page background.

**Layout top-to-bottom:**
1. Logo: ">_ Secured Terminal" in 20px Bold `#FF9A6D` (monospace `>_` prefix)
2. Subtitle: "Admin Panel" in 13px Regular `#878787`
3. Separator (24px gap)
4. FieldGroup:
   - Field: FieldLabel "Email", Input type="email" placeholder="admin@flent.in"
   - Field: FieldLabel "Password", InputGroup with InputGroupInput type="password" + InputGroupAddon (eye icon toggle)
5. [Sign In] Button — full width, accent `#FF9A6D` bg, `#131313` text, 14px SemiBold
   - Loading state: Spinner (16px) replaces text, button disabled
   - Hover: `#FFB08A` bg
   - Pressed: `#E8845A` bg + scale 0.98
6. Error state: Alert variant="destructive" — "Invalid email or password" with red left border
7. Footer: "Flent Secured v2" in 10px `#4D4D4D`, centered

**Session**: JWT stored in localStorage. 4-hour idle timeout, 24-hour absolute. On timeout, redirect to login with toast: "Session expired. Please sign in again."
**Remember**: No "remember me" checkbox — sessions always persist until timeout.

---

### Artboard 13: Team Management (1440x900)

**Header row**: "Team management" (16px SemiBold) + [Invite Member] Button (accent, right-aligned)

**Team table** (5 sample rows):

| Email | Name | Role | Status | Last Login | Joined |
|-------|------|------|--------|------------|--------|
| rishabh@flent.in | Rishabh | Super Admin (orange Badge) | Active (green dot) | 2 min ago | 01 Mar 2026 |
| admin@flent.in | Priya Admin | Admin (blue Badge) | Active | 3 hrs ago | 10 Mar 2026 |
| viewer@flent.in | Amit Viewer | Viewer (gray Badge) | Active | Yesterday | 15 Mar 2026 |
| ops@flent.in | Sneha Ops | Admin (blue Badge) | Deactivated (red dot) | 20 Mar | 05 Mar 2026 |
| new@flent.in | — | Viewer (gray Badge) | Invited (amber dot) | Never | 28 Mar 2026 |

**Row actions** (DropdownMenu, trigger: "..." icon button):
- "Edit role" → opens inline Select (Super Admin / Admin / Viewer)
- "Deactivate" → AlertDialog: "Deactivate ops@flent.in? They will lose access immediately."
- For last Super Admin: DropdownMenu item disabled with Tooltip "Cannot deactivate the last Super Admin"
- For self: "Deactivate" disabled with Tooltip "Cannot deactivate yourself"

**Invite Dialog** (Dialog, 420px):
- Title: "Invite team member"
- FieldGroup:
  - Field: FieldLabel "Email *", Input placeholder="name@flent.in"
  - Field: FieldLabel "Full name *", Input
  - Field: FieldLabel "Temporary password *", InputGroup with InputGroupInput + InputGroupAddon [Generate] Button (secondary, generates 16-char random)
  - Field: FieldLabel "Role *", Select: Super Admin / Admin / Viewer (default: Viewer)
- Buttons: [Cancel] | [Create Account] (accent)
- Toast: `toast.success("Invitation sent to name@flent.in")`
- Note: "The new member will need to change their password on first login." (10px `#878787`)

---

### Artboard 14: Loading & Error States (1440x900)

Side-by-side showcase of the two most critical states.

**Left half: Skeleton Loading State (User Detail)**
- Header: `Skeleton` circle (48px avatar) + `Skeleton` rectangle (160x20px name) + `Skeleton` rectangle (120x16px phone) + 3 `Skeleton` badge rectangles (60x24px each)
- Section 1 (Verification): `Skeleton` circle (200x200px radar chart placeholder) + 7 `Skeleton` row rectangles (full width x 32px each)
- Section 2 (Identity): `Skeleton` circle (120x120px gauge) + 8 `Skeleton` key-value rows (two columns)
- Section 3 (Agreement): `Skeleton` block (full width x 180px)
- Section 4 (Payments): 4 `Skeleton` stat cards (100x60px each) + 5 `Skeleton` table rows
- All skeletons use `background: #2A2A2A` with `animate-pulse` shimmer
- Shimmer direction: left-to-right sweep, `#2A2A2A` → `#3A3A3A` → `#2A2A2A`

**Right half: Error State**
- User header loads successfully (data was cached)
- Section 1 loads successfully
- Section 2: `Alert` variant="destructive" — icon: ⚠️, title: "Failed to load M360 data", description: "Connection timed out. The Supabase endpoint may be unreachable.", action: [Retry] Button
- Section 3+: Normal content below the error (partial rendering — don't block the whole page)
- Toast also shown: `toast.error("M360 data load failed")`

**Key principle**: Errors are **per-section**, never full-page. Each section loads independently. If one fails, others still render. The user header is always loaded first (lightest query).

---

## Build Sequence in Paper

| Phase | Artboards | Agent | Notes |
|-------|-----------|-------|-------|
| 0 | **Design System (#0)** | Agent 1 | **BUILD FIRST** — establishes every token, component, badge, chart, and pattern. All other artboards clone from here. |
| 1 | Login (#12) + Dashboard (#1) | Agent 1 | Login = simple brand page. Dashboard = global shell (header, sidebar, KPI strip) that everything else clones. |
| 2 | Users List (#2) + Detail (#3) | Agent 1 | THE HERO — most complex artboard. Clones components from Design System. |
| 2 (parallel) | Analytics (#6) + Segments (#7) + Summary (#11) | Agent 2 | Charts & analysis. Clones chart patterns from #0. |
| 2 (parallel) | Payments (#5) + Activity (#8) + Team (#13) | Agent 3 | Data tables & feeds. Clones table/badge patterns from #0. |
| 3 | Batch (#4) + Dialogs (#9) + Env (#10) + Loading (#14) | Agent 1 | Derivatives & states. Clones from #2, #3, #0. |

**Priority build order** (if context-constrained, build these 4 and stop):
1. Design System (#0) — the foundation
2. Login (#12) — entry point, simple
3. Dashboard (#1) — global shell template
4. Users Detail (#3) — the Bloomberg Terminal hero

**Paper MCP rules**:
- One visual group per `write_html` call (a header, a card, a table section)
- `display: flex` only (no grid, no inline-block)
- All inline styles — no classes, no external CSS
- `get_screenshot` every 2-3 modifications for review checkpoint (spacing, typography, contrast, alignment, clipping)
- `duplicate_nodes` + `set_text_content` for repeated rows
- For charts: use styled SVG elements (bars, circles, arcs) since Paper supports SVG in HTML
- No `margin` — use `gap` and `padding` exclusively
- No `display: grid` or `display: inline` — flex only
- Images via `<img>` with data URIs or placeholder colored rectangles
- Icons as SVG inline or Unicode glyphs (✅ ❌ ⏳ ⚠️ 🟢 🔴)

### Paper HTML Patterns (reusable across artboards)

**Card pattern:**
```html
<div style="background: #202020; border: 1px solid #2A2A2A; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
  <div style="font-size: 11px; font-weight: 600; color: #878787; text-transform: uppercase; letter-spacing: 1px;">SECTION TITLE</div>
  <div style="font-size: 28px; font-weight: 700; color: #FFFFFF;">Value</div>
  <div style="font-size: 10px; color: #878787;">Subtitle</div>
</div>
```

**Badge pattern:**
```html
<span style="padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; background: #06C27020; color: #06C270; border: 1px solid #06C27040;">active</span>
```

**Table row pattern:**
```html
<div style="display: flex; align-items: center; padding: 8px 16px; gap: 12px; border-bottom: 1px solid #1A1A1A;">
  <div style="width: 16px; height: 16px; border: 1px solid #4D4D4D; border-radius: 3px;"></div>
  <div style="width: 8px; height: 8px; border-radius: 50%; background: #06C270;"></div>
  <div style="flex: 1; font-size: 13px; font-weight: 500; color: #FFFFFF;">Name</div>
  <div style="width: 100px; font-size: 13px; color: #A9A9A9;">+91 98XXX</div>
  <div style="width: 80px; font-size: 11px; color: #878787;">Mumbai</div>
  <div style="width: 80px; font-size: 13px; font-weight: 500; color: #CBCBCB; font-variant-numeric: tabular-nums;">₹25,000</div>
</div>
```

**Radar chart (SVG):**
```html
<svg viewBox="0 0 200 200" width="200" height="200">
  <!-- 7 spoke lines from center -->
  <line x1="100" y1="100" x2="100" y2="20" stroke="#4D4D4D" stroke-width="1"/>
  <!-- ... 6 more spokes at 51.4° intervals -->
  <!-- Filled polygon for verification coverage -->
  <polygon points="100,30 165,60 170,130 100,170 35,130 30,60 80,40" fill="#FF9A6D" fill-opacity="0.3" stroke="#FF9A6D" stroke-width="2"/>
  <!-- Center score -->
  <text x="100" y="105" text-anchor="middle" fill="#FFFFFF" font-size="24" font-weight="700">5/7</text>
</svg>
```

**Credit score gauge (SVG):**
```html
<svg viewBox="0 0 120 120" width="120" height="120">
  <circle cx="60" cy="60" r="50" fill="none" stroke="#2A2A2A" stroke-width="8"/>
  <circle cx="60" cy="60" r="50" fill="none" stroke="#06C270" stroke-width="8"
    stroke-dasharray="259" stroke-dashoffset="70" transform="rotate(-90 60 60)"/>
  <text x="60" y="58" text-anchor="middle" fill="#FFFFFF" font-size="20" font-weight="700">742</text>
  <text x="60" y="74" text-anchor="middle" fill="#878787" font-size="10">/ 900</text>
</svg>
```

---

## Implementation Tech Stack (post-Paper, for actual build)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14+ (App Router) | Static export or Vercel deploy. RSC for data fetching. |
| UI Library | shadcn/ui (latest, radix base) | `npx shadcn@latest init --preset radix-nova` |
| Styling | Tailwind CSS v4 | Dark theme via CSS variables matching design tokens |
| Charts | Recharts (via shadcn Chart) | RadarChart, RadialBarChart, BarChart, PieChart, ComposedChart |
| State | Zustand | Auth state, environment toggle, selected user |
| Data Fetching | TanStack Query v5 | SWR pattern, 30s stale time, per-section independent queries |
| Supabase Client | `@supabase/supabase-js` | Two clients (main + dev), switched via env toggle |
| Auth | Supabase Auth (email+password) | JWT with `admin_role` custom claim |
| Icons | Lucide React | Standard shadcn icon library |
| Fonts | Plus Jakarta Sans (Google Fonts) + JetBrains Mono | Self-hosted via `next/font` |
| Deployment | Vercel | Protected by Vercel Auth or custom middleware |
| Domain | admin.flent.in (proposed) | Internal-only, no public access |

### Project Structure
```
admin/
├── app/
│   ├── layout.tsx          # Root layout: fonts, providers, dark theme
│   ├── login/page.tsx      # Login screen
│   ├── (dashboard)/
│   │   ├── layout.tsx      # Sidebar + Header + KPI strip shell
│   │   ├── page.tsx        # Dashboard
│   │   ├── users/page.tsx  # Users master-detail
│   │   ├── payments/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── activity/page.tsx
│   │   └── settings/page.tsx  # Team management
├── components/
│   ├── ui/                 # shadcn components
│   ├── shell/              # Header, Sidebar, KPIStrip, CommandPalette
│   ├── users/              # UserList, UserDetail, VerificationRadar, OverrideControls
│   ├── payments/           # PaymentsTable, PaymentFilters
│   ├── analytics/          # FunnelChart, CohortHeatmap, RevenueChart, etc.
│   ├── activity/           # ActivityFeed, AuditTimeline
│   └── dialogs/            # ApproveDialog, RejectDialog, OverrideDialog, BypassDialog
├── lib/
│   ├── supabase.ts         # Client initialization (main + dev)
│   ├── auth.ts             # Login, logout, session management
│   ├── api.ts              # Edge function callers with role-based masking
│   └── utils.ts            # formatCurrency, maskPhone, formatDate
├── stores/
│   ├── auth.ts             # Zustand: user, role, token
│   └── environment.ts      # Zustand: main/dev toggle
└── types/
    ├── user.ts             # UserFunnel, RiskDetail, M360Detail types
    ├── payment.ts          # PaymentDetail type
    └── admin.ts            # AdminUser, AuditLog, VerificationOverride types
```

---

## Data Sources (from dev branch — corrected column counts)

| View | Actual Columns | Migration File |
|------|---------------|----------------|
| `v_user_funnel` | **58** | `20260303100001_admin_dashboard_views.sql` |
| `v_payment_detail` | **23** | Same migration |
| `v_risk_detail` | **32** | `20260315100002_create_risk_detail_view.sql` |
| `v_m360_detail` | **~34** | `20260303120001_admin_m360_view.sql` |
| **Total unique columns** | **~147** | All represented in the UI across detail sections |

### Computed Fields (replicated from Python scripts, not DB columns)
- `missing_data`: Computed from checking extraction_status, property_address, landlord, rent, lease dates, M360, risk_level
- `audit_status`: READY if no missing data, else BLOCKED
- `display_phone`: Format raw phone with "+" prefix

---

## Edge Cases & Error Recovery

| Scenario | Handling |
|----------|----------|
| User has no tenancy (signed_up only) | Sections 1, 3, 4, 5 show Empty: "No tenancy data — user hasn't uploaded an agreement yet" |
| User has no M360 data | Section 2 shows Empty: "M360 verification not initiated" with `m360_status` = null |
| User has no payments | Section 4 stats show 0, table shows Empty: "No payments yet" |
| User has no risk data | Section 5 shows Empty: "Risk analysis pending — no verification data available" |
| Extraction failed | Section 3 shows Alert: "Agreement extraction failed" with `extraction_status` badge red |
| Override on user with payments | Revert button disabled with Tooltip: "Cannot revert — user has completed payments" |
| Batch approve with mixed statuses | Only eligible users (waitlisted + agreement_confirmed) get approved. Others show warning: "2 users skipped (already approved)" |
| Dev database empty | Dashboard KPIs show "0" with info banner: "Dev database has no data. Seed test data?" |
| Supabase rate limit hit | Alert: "Too many requests. Please wait 60 seconds." + automatic retry with exponential backoff |
| Session expired mid-action | Dialog: "Your session has expired. Sign in to complete this action." + redirect to login after clicking OK |
| Concurrent admin conflict | If another admin approves a user you're viewing, Realtime subscription updates the status badge + toast: "Arjun Mehta was approved by admin@flent.in" |
| Network disconnected | Persistent banner at top: "You are offline. Changes will not be saved." (OfflineBanner pattern from the consumer app) |
| Last Super Admin tries to demote | Select disabled + Tooltip: "You are the only Super Admin. Promote another admin first." |
| Viewer clicks action button | All buttons render with `disabled` + Tooltip: "View only — contact a Super Admin for access" |
| Very long property address | Truncated with `...` + full text in Tooltip on hover |
| Phone number with/without +91 | Always displayed as `+91 XXXXX XXXXX` — formatting handled by `display_phone()` utility |

---

## Verification Checklist

After all artboards are built:
1. **Screenshot review** (get_screenshot): spacing, typography scale, contrast, alignment, clipping per artboard
2. **Badge coverage**: Every status from Status Legend has a corresponding Badge variant
3. **Column coverage**: All 147 columns appear somewhere in the UI
4. **Hallucination check**: No references to non-existent columns (security_deposit removed, last_active → status_updated_at)
5. **Bloomberg density**: Verify data-rich feel — no section should feel "generic SaaS"
6. **RBAC visual**: Viewer buttons disabled, Admin justification fields, Super Admin full access
7. **Loading states**: Every data section has Skeleton placeholder
8. **Error states**: Every API-dependent view has Alert fallback
9. **Override UX**: 3-state toggle works, reason mandatory, revert available
10. **Environment**: Dev has orange border + warning, Main is clean
