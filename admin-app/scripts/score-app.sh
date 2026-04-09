#!/bin/bash
# Mechanical app quality scorer for Secured Terminal admin panel
# Outputs a single number (higher = better)
# Max theoretical: ~200

APP="/Users/atrishabh/Documents/Dev/Secured v2-react-native project/admin-app"
score=0

# 1. Build passes (30 pts)
cd "$APP" && npx next build 2>&1 | grep -q "Compiled successfully" && score=$((score + 30))

# 2. Page count (max 30 pts — 2pts per page, max 15 pages)
pages=$(find "$APP/src/app" -name "page.tsx" 2>/dev/null | wc -l | tr -d ' ')
page_pts=$((pages > 15 ? 30 : pages * 2))
score=$((score + page_pts))

# 3. Component count (max 30 pts — 1pt per component, max 30)
components=$(find "$APP/src/components" -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
comp_pts=$((components > 30 ? 30 : components))
score=$((score + comp_pts))

# 4. Feature completeness (max 40 pts)
features=0
# Auth flow
grep -rq "signInWithPassword" "$APP/src" 2>/dev/null && features=$((features + 4))
# Supabase data fetching
grep -rq "fetchView" "$APP/src" 2>/dev/null && features=$((features + 4))
# Risk radar chart
[ -f "$APP/src/components/users/risk-radar-chart.tsx" ] && features=$((features + 4))
# Approval preflight
[ -f "$APP/src/components/users/approval-preflight.tsx" ] && features=$((features + 4))
# Risk factor breakdown
[ -f "$APP/src/components/users/risk-factor-breakdown.tsx" ] && features=$((features + 4))
# Sidebar navigation
grep -rq "Sidebar" "$APP/src/components/shell" 2>/dev/null && features=$((features + 4))
# KPI cards
grep -rq "KPICard\|kpi" "$APP/src" 2>/dev/null && features=$((features + 4))
# Batch approve
grep -rq "Batch approve\|batch.*approve" "$APP/src" 2>/dev/null && features=$((features + 4))
# User detail with all sections
grep -rq "UserDetail\|user-detail" "$APP/src" 2>/dev/null && features=$((features + 4))
# Environment switcher
grep -rq "switchEnvironment\|getCurrentEnvironment" "$APP/src" 2>/dev/null && features=$((features + 4))
score=$((score + features))

# 5. UI polish (max 30 pts)
polish=0
# Loading states (Skeleton)
grep -rq "Skeleton" "$APP/src/app" 2>/dev/null && polish=$((polish + 5))
# Error handling
grep -rq "catch\|error" "$APP/src/app" 2>/dev/null && polish=$((polish + 5))
# Responsive/mobile considerations
grep -rq "overflow-auto\|overflow-hidden\|flex-wrap\|truncate" "$APP/src" 2>/dev/null && polish=$((polish + 5))
# shadcn Badge usage
grep -rq "Badge" "$APP/src/components" 2>/dev/null && polish=$((polish + 5))
# Proper formatting (currency, dates)
grep -rq "formatCurrency\|formatDate" "$APP/src" 2>/dev/null && polish=$((polish + 5))
# Dark theme tokens
grep -rq "bg-background\|bg-card\|text-foreground\|text-muted" "$APP/src" 2>/dev/null && polish=$((polish + 5))
score=$((score + polish))

# 6. No production DB references in client code (critical — 0 or -50)
if grep -rq "uowjtrzmszuaiokqxgir" "$APP/src" 2>/dev/null; then
  score=$((score - 50))
fi

echo "$score"
