#!/bin/bash
# =============================================================================
# approve-waitlist-user.sh — Approve a waitlisted user and advance to happy flow
#
# Usage:
#   ./scripts/approve-waitlist-user.sh <phone_number>
#   ./scripts/approve-waitlist-user.sh 8390772035
#   ./scripts/approve-waitlist-user.sh +918390772035
#
# What it does (with checks at each step):
#   1. Finds user by phone number (tries multiple formats)
#   2. Checks extraction status — must be "completed"
#   3. Marks extraction as user_verified (if not already)
#   4. Sets waitlist admin_review → approved, contract_status → confirmed
#   5. Sets user_status → approved, role → tenant, is_role_locked → true
#   6. Creates tenancy from extraction data (if none exists)
#   7. Links extraction → tenancy
#
# Prerequisites:
#   - Supabase CLI installed (for API key retrieval)
#   - curl, python3, jq (optional, python3 used for JSON parsing)
# =============================================================================

set -euo pipefail

# --- Config ---
PROJECT_REF="zqlowjveyqiagnbmfwsb"
BASE="https://${PROJECT_REF}.supabase.co"

# --- Get secret key (new opaque format, replaces legacy service_role JWT) ---
SRK=$(npx supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null | grep secret | awk '{print $NF}')
if [ -z "$SRK" ]; then
  echo "ERROR: Could not retrieve secret key. Are you logged into Supabase CLI?"
  exit 1
fi

# --- Helpers ---
api_get() {
  curl -s "$BASE/rest/v1/$1" -H "apikey: $SRK" -H "Authorization: Bearer $SRK"
}

api_patch() {
  local endpoint="$1"
  local data="$2"
  curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/rest/v1/$endpoint" \
    -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
    -H "Content-Type: application/json" \
    -d "$data"
}

api_post() {
  local endpoint="$1"
  local data="$2"
  curl -s -X POST "$BASE/rest/v1/$endpoint" \
    -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$data"
}

pj() {
  python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if isinstance(d, list) and len(d) > 0:
        print(json.dumps(d[0], indent=2))
    elif isinstance(d, dict):
        print(json.dumps(d, indent=2))
    else:
        print(json.dumps(d))
except Exception as e:
    print(f'JSON parse error: {e}', file=sys.stderr)
    sys.exit(1)
"
}

pj_field() {
  local field="$1"
  python3 -c "
import json, sys
d = json.load(sys.stdin)
if isinstance(d, list) and len(d) > 0:
    print(d[0].get('$field', ''))
elif isinstance(d, dict):
    print(d.get('$field', ''))
"
}

# --- Validate input ---
if [ $# -lt 1 ]; then
  echo "Usage: $0 <phone_number>"
  echo "Example: $0 8390772035"
  exit 1
fi

PHONE_INPUT="$1"
# Strip leading + if present
PHONE_CLEAN="${PHONE_INPUT#+}"

echo "============================================"
echo "  Approve Waitlist User: $PHONE_INPUT"
echo "============================================"
echo ""

# =============================================================================
# STEP 1: Find user by phone
# =============================================================================
echo "[1/7] Finding user by phone..."

# Search by phone suffix using LIKE to handle all formats (+91, 91, raw)
# Strip leading +91 or 91 to get bare 10-digit number
PHONE_BARE="${PHONE_CLEAN#+91}"
PHONE_BARE="${PHONE_BARE#91}"

USER_JSON=$(api_get "users?phone=like.%25${PHONE_BARE}&select=id,phone,full_name,user_status,role,is_role_locked")

USER_COUNT=$(echo "$USER_JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
if [ "$USER_COUNT" -eq 0 ]; then
  echo "  ERROR: No user found for phone $PHONE_INPUT (searched suffix: $PHONE_BARE)"
  exit 1
fi

if [ "$USER_COUNT" -gt 1 ]; then
  echo "  ERROR: Multiple users found matching phone suffix $PHONE_BARE:"
  echo "$USER_JSON" | python3 -c "import json,sys; [print(f'    {u[\"id\"]} — {u[\"phone\"]} — {u.get(\"full_name\",\"?\")}') for u in json.load(sys.stdin)]"
  exit 1
fi

USER_ID=$(echo "$USER_JSON" | pj_field "id")
USER_NAME=$(echo "$USER_JSON" | pj_field "full_name")
USER_STATUS=$(echo "$USER_JSON" | pj_field "user_status")

echo "  Found: $USER_NAME (ID: $USER_ID)"
echo "  Current user_status: $USER_STATUS"
echo ""

# =============================================================================
# STEP 2: Check extraction status
# =============================================================================
echo "[2/7] Checking extraction status..."

EXT_JSON=$(api_get "extracted_rental_info?user_id=eq.${USER_ID}&extraction_status=eq.completed&order=created_at.desc&limit=1&select=id,extraction_status,user_verified,monthly_rent_paise,property_address,property_city,property_state,property_pincode,lease_start_date,lease_end_date,landlord_name,landlord_names,landlord_phone,landlord_email,rent_due_day,maintenance_paise,tenancy_id")

EXT_COUNT=$(echo "$EXT_JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
if [ "$EXT_COUNT" -eq 0 ]; then
  echo "  ERROR: No completed extraction found for this user."
  echo "  The user must upload + process a document before approval."
  exit 1
fi

EXT_ID=$(echo "$EXT_JSON" | pj_field "id")
EXT_VERIFIED=$(echo "$EXT_JSON" | pj_field "user_verified")
EXT_RENT=$(echo "$EXT_JSON" | pj_field "monthly_rent_paise")
EXT_ADDRESS=$(echo "$EXT_JSON" | pj_field "property_address")
EXT_CITY=$(echo "$EXT_JSON" | pj_field "property_city")
EXT_STATE=$(echo "$EXT_JSON" | pj_field "property_state")
EXT_PINCODE=$(echo "$EXT_JSON" | pj_field "property_pincode")
EXT_LEASE_START=$(echo "$EXT_JSON" | pj_field "lease_start_date")
EXT_LEASE_END=$(echo "$EXT_JSON" | pj_field "lease_end_date")
EXT_RENT_DUE=$(echo "$EXT_JSON" | pj_field "rent_due_day")
EXT_MAINTENANCE=$(echo "$EXT_JSON" | pj_field "maintenance_paise")
EXISTING_TENANCY=$(echo "$EXT_JSON" | pj_field "tenancy_id")

# Get landlord name from landlord_names array if landlord_name is empty
LANDLORD_NAME=$(echo "$EXT_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)[0]
name = d.get('landlord_name') or ''
if not name and d.get('landlord_names'):
    names = d['landlord_names']
    if isinstance(names, list) and len(names) > 0:
        name = names[0]
print(name or 'Unknown Landlord')
")
LANDLORD_PHONE=$(echo "$EXT_JSON" | pj_field "landlord_phone")
LANDLORD_EMAIL=$(echo "$EXT_JSON" | pj_field "landlord_email")

RENT_RUPEES=$((EXT_RENT / 100))
echo "  Extraction: $EXT_ID"
echo "  Property: $EXT_ADDRESS, $EXT_CITY"
echo "  Rent: ₹$RENT_RUPEES/mo | Due day: $EXT_RENT_DUE"
echo "  Landlord: $LANDLORD_NAME"
echo "  Lease: $EXT_LEASE_START → $EXT_LEASE_END"
echo "  Verified: $EXT_VERIFIED"
echo ""

# =============================================================================
# STEP 3: Mark extraction as user_verified
# =============================================================================
echo "[3/7] Marking extraction as user_verified..."

if [ "$EXT_VERIFIED" = "True" ] || [ "$EXT_VERIFIED" = "true" ]; then
  echo "  Already verified. Skipping."
else
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  status=$(api_patch "extracted_rental_info?id=eq.${EXT_ID}" "{\"user_verified\":true,\"verified_at\":\"$NOW\"}")
  if [ "$status" = "204" ]; then
    echo "  Done (HTTP $status)"
  else
    echo "  WARNING: Unexpected HTTP $status"
  fi
fi
echo ""

# =============================================================================
# STEP 4: Approve waitlist entry
# =============================================================================
echo "[4/7] Approving waitlist entry..."

WL_JSON=$(api_get "waitlist_entries?user_id=eq.${USER_ID}&select=id,admin_review,contract_status")
WL_COUNT=$(echo "$WL_JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")

if [ "$WL_COUNT" -eq 0 ]; then
  echo "  WARNING: No waitlist entry found. Creating via join_waitlist RPC..."
  curl -s -X POST "$BASE/rest/v1/rpc/join_waitlist" \
    -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
    -H "Content-Type: application/json" \
    -d "{\"p_user_id\":\"$USER_ID\"}" > /dev/null
  echo "  Created. Proceeding with approval..."
fi

status=$(api_patch "waitlist_entries?user_id=eq.${USER_ID}" '{"admin_review":"approved","contract_status":"confirmed"}')
echo "  admin_review → approved, contract_status → confirmed (HTTP $status)"
echo ""

# =============================================================================
# STEP 5: Update user status + lock role
# =============================================================================
echo "[5/7] Updating user status and locking role..."

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
status=$(api_patch "users?id=eq.${USER_ID}" "{\"user_status\":\"approved\",\"status_updated_at\":\"$NOW\",\"role\":\"tenant\",\"is_role_locked\":true,\"role_locked_at\":\"$NOW\"}")
echo "  user_status → approved, role → tenant, locked (HTTP $status)"
echo ""

# =============================================================================
# STEP 6: Create tenancy (if none exists)
# =============================================================================
echo "[6/7] Creating tenancy..."

# Check if tenancy already exists
TENANCY_JSON=$(api_get "tenancies?user_id=eq.${USER_ID}&select=id,status,monthly_rent_paise")
TENANCY_COUNT=$(echo "$TENANCY_JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")

if [ "$TENANCY_COUNT" -gt 0 ]; then
  TENANCY_ID=$(echo "$TENANCY_JSON" | pj_field "id")
  echo "  Tenancy already exists: $TENANCY_ID. Skipping creation."
else
  # Build tenancy JSON — handle null/empty fields
  TENANCY_DATA=$(python3 -c "
import json
data = {
    'user_id': '$USER_ID',
    'extracted_rental_info_id': '$EXT_ID',
    'status': 'pending_verification',
    'property_address': '$EXT_ADDRESS',
    'property_city': '$EXT_CITY' or None,
    'property_state': '$EXT_STATE' if '$EXT_STATE' and '$EXT_STATE' != 'None' else None,
    'property_pincode': '$EXT_PINCODE' if '$EXT_PINCODE' and '$EXT_PINCODE' != 'None' else None,
    'monthly_rent_paise': $EXT_RENT,
    'maintenance_paise': ${EXT_MAINTENANCE:-0},
    'rent_due_day': ${EXT_RENT_DUE:-1},
    'cashback_cutoff_day': ${EXT_RENT_DUE:-1},
    'lease_start_date': '$EXT_LEASE_START',
    'lease_end_date': '$EXT_LEASE_END',
    'landlord_name': '$LANDLORD_NAME',
    'landlord_phone': '$LANDLORD_PHONE' if '$LANDLORD_PHONE' and '$LANDLORD_PHONE' != 'None' else None,
    'landlord_email': '$LANDLORD_EMAIL' if '$LANDLORD_EMAIL' and '$LANDLORD_EMAIL' != 'None' else None,
}
# Remove None values (PostgREST handles defaults)
data = {k: v for k, v in data.items() if v is not None}
print(json.dumps(data))
")

  RESULT=$(api_post "tenancies" "$TENANCY_DATA")
  TENANCY_ID=$(echo "$RESULT" | pj_field "id")

  if [ -n "$TENANCY_ID" ] && [ "$TENANCY_ID" != "" ]; then
    echo "  Created tenancy: $TENANCY_ID"
  else
    echo "  ERROR: Tenancy creation failed:"
    echo "$RESULT"
    exit 1
  fi
fi
echo ""

# =============================================================================
# STEP 7: Link extraction → tenancy
# =============================================================================
echo "[7/7] Linking extraction to tenancy..."

if [ -n "$EXISTING_TENANCY" ] && [ "$EXISTING_TENANCY" != "None" ] && [ "$EXISTING_TENANCY" != "" ]; then
  echo "  Already linked to tenancy $EXISTING_TENANCY. Skipping."
else
  status=$(api_patch "extracted_rental_info?id=eq.${EXT_ID}" "{\"tenancy_id\":\"$TENANCY_ID\"}")
  echo "  Linked extraction → tenancy (HTTP $status)"
fi
echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo "============================================"
echo "  DONE — $USER_NAME is approved!"
echo "============================================"
echo ""
echo "  User ID:     $USER_ID"
echo "  Extraction:  $EXT_ID"
echo "  Tenancy:     $TENANCY_ID"
echo "  Status:      approved → pending_verification"
echo "  Rent:        ₹$RENT_RUPEES/mo"
echo "  Next step:   User can now proceed to setup (bank, utility, landlord invite)"
echo ""
