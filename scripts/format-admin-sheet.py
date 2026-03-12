#!/usr/bin/env python3
"""
Format the Admin Dashboard Google Sheet:
- Add Status Legend tab with status mappings
- Add M360 tab for Cashfree identity verification data
- Apply conditional formatting (color-coded statuses)
- Better formatting across all tabs
"""
import json
import subprocess
import sys
import os

SHEET_ID = '114HbdCPKcFZvU5iFt8OWSXlKpJ6O8rEQVKInOA5jcIo'
QUOTA_PROJECT = 'mcp-access-481804'
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Auth ──
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

with open(os.path.expanduser('~/.config/gspread/authorized_user.json')) as f:
    auth_data = json.load(f)

creds = Credentials(
    token=None,
    refresh_token=auth_data['refresh_token'],
    client_id=auth_data['client_id'],
    client_secret=auth_data['client_secret'],
    token_uri='https://oauth2.googleapis.com/token',
)
creds.refresh(Request())
TOKEN = creds.token
print(f"Authenticated")

def api(method, url, body=None):
    cmd = ['curl', '-s', '-X', method, url,
           '-H', f'Authorization: Bearer {TOKEN}',
           '-H', f'x-goog-user-project: {QUOTA_PROJECT}',
           '-H', 'Content-Type: application/json']
    if body:
        cmd += ['-d', json.dumps(body)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if not r.stdout.strip():
        print(f"  Empty response from {method} {url}")
        return None
    resp = json.loads(r.stdout)
    if 'error' in resp:
        print(f"  API Error: {json.dumps(resp['error'], indent=2)}")
        return None
    return resp

# ── Supabase key ──
SRK = subprocess.run(
    ['bash', '-c', 'supabase projects api-keys --project-ref zqlowjveyqiagnbmfwsb 2>/dev/null | grep service_role | awk \'{print $NF}\''],
    capture_output=True, text=True, cwd=PROJECT_DIR
).stdout.strip()

# ── Get current sheet info ──
print("\n[1/5] Getting sheet info...")
info = api('GET', f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}?fields=sheets.properties')
existing_tabs = {s['properties']['title']: s['properties']['sheetId'] for s in info['sheets']}
print(f"  Existing tabs: {list(existing_tabs.keys())}")

# ── Step 2: Add new tabs if missing ──
print("\n[2/5] Adding new tabs...")
requests = []
new_tab_ids = {}

if 'M360' not in existing_tabs:
    new_tab_ids['M360'] = 100
    requests.append({"addSheet": {"properties": {"title": "M360", "sheetId": 100, "index": 3}}})

if 'Status Legend' not in existing_tabs:
    new_tab_ids['Status Legend'] = 200
    requests.append({"addSheet": {"properties": {"title": "Status Legend", "sheetId": 200, "index": 5}}})

if requests:
    api('POST', f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate', {"requests": requests})
    existing_tabs.update(new_tab_ids)
    print(f"  Added: {list(new_tab_ids.keys())}")
else:
    print("  All tabs exist")

# ── Step 3: Write Status Legend ──
print("\n[3/5] Writing Status Legend...")
legend_data = [
    ["STATUS LEGEND", "", ""],
    ["", "", ""],
    ["USER STATUS", "Meaning", "Funnel Stage"],
    ["signed_up", "User created account via OTP", "1 - Entry"],
    ["waitlisted", "On waitlist, pending review", "2 - Waitlist"],
    ["approved", "Admin approved, can proceed to setup", "3 - Approved"],
    ["agreement_confirmed", "Uploaded & verified rental agreement", "3 - Approved"],
    ["active", "Fully set up, can make payments", "4 - Active"],
    ["", "", ""],
    ["ADMIN REVIEW", "Meaning", "Action"],
    ["due", "Not yet reviewed by admin", "Review needed"],
    ["approved", "Admin approved user", "No action"],
    ["rejected", "Admin rejected user", "No action"],
    ["", "", ""],
    ["M360 STATUS", "Meaning", "Stage"],
    ["OTP_SENT", "OTP sent to user's phone for consent", "Pending"],
    ["CONSENT_GIVEN", "User gave consent, data fetch initiated", "In Progress"],
    ["SUCCESS", "M360 data received from Cashfree", "Complete"],
    ["FAILED", "Verification failed or timed out", "Failed"],
    ["", "", ""],
    ["TENANCY STATUS", "Meaning", "Stage"],
    ["pending_verification", "Tenancy created, setup steps pending", "Setup"],
    ["active", "All verified, payments enabled", "Active"],
    ["expired", "Lease ended", "Ended"],
    ["terminated", "Manually terminated", "Ended"],
    ["", "", ""],
    ["PAYMENT STATUS", "Meaning", "Stage"],
    ["pending", "Payment initiated, not yet completed", "In Progress"],
    ["success", "Payment completed successfully", "Done"],
    ["failed", "Payment failed at gateway", "Failed"],
    ["refunded", "Payment was refunded", "Reversed"],
    ["", "", ""],
    ["SETTLEMENT STATUS", "Meaning", "Stage"],
    ["pending", "Awaiting settlement from PayU", "Waiting"],
    ["settled", "Funds settled to landlord's bank", "Done"],
    ["", "", ""],
    ["SETUP STEPS", "Field", "When Complete"],
    ["Bank Details", "bank_verified = TRUE", "Landlord's bank account added"],
    ["Address Proof", "utility_verified = TRUE", "Utility bill uploaded"],
    ["Landlord Approval", "landlord_approved = TRUE", "Landlord verified via link"],
    ["", "", ""],
    ["COLOR KEY", "", ""],
    ["Green", "Completed / Approved / Active / Success", ""],
    ["Yellow", "In progress / Pending / Consent given", ""],
    ["Red", "Failed / Rejected / Terminated", ""],
    ["Gray", "Not started / Due", ""],
]

api('PUT',
    f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/Status%20Legend!A1?valueInputOption=RAW',
    {"values": legend_data})

# Format Status Legend
legend_id = existing_tabs.get('Status Legend', 200)
legend_fmt = [
    # Title
    {"repeatCell": {
        "range": {"sheetId": legend_id, "startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": 0, "endColumnIndex": 3},
        "cell": {"userEnteredFormat": {"textFormat": {"bold": True, "fontSize": 14}, "backgroundColor": {"red": 0.1, "green": 0.1, "blue": 0.18}}},
        "fields": "userEnteredFormat"}},
    # Section headers (rows 2,9,14,20,26,32,36,42)
]
for row_idx in [2, 9, 14, 20, 26, 32, 36, 42]:
    legend_fmt.append({"repeatCell": {
        "range": {"sheetId": legend_id, "startRowIndex": row_idx, "endRowIndex": row_idx+1, "startColumnIndex": 0, "endColumnIndex": 3},
        "cell": {"userEnteredFormat": {"textFormat": {"bold": True}, "backgroundColor": {"red": 0.15, "green": 0.15, "blue": 0.22}}},
        "fields": "userEnteredFormat"}})

# Color key rows
legend_fmt.append({"repeatCell": {
    "range": {"sheetId": legend_id, "startRowIndex": 43, "endRowIndex": 44, "startColumnIndex": 0, "endColumnIndex": 1},
    "cell": {"userEnteredFormat": {"backgroundColor": {"red": 0.22, "green": 0.55, "blue": 0.24}}},
    "fields": "userEnteredFormat.backgroundColor"}})
legend_fmt.append({"repeatCell": {
    "range": {"sheetId": legend_id, "startRowIndex": 44, "endRowIndex": 45, "startColumnIndex": 0, "endColumnIndex": 1},
    "cell": {"userEnteredFormat": {"backgroundColor": {"red": 0.85, "green": 0.65, "blue": 0.13}}},
    "fields": "userEnteredFormat.backgroundColor"}})
legend_fmt.append({"repeatCell": {
    "range": {"sheetId": legend_id, "startRowIndex": 45, "endRowIndex": 46, "startColumnIndex": 0, "endColumnIndex": 1},
    "cell": {"userEnteredFormat": {"backgroundColor": {"red": 0.80, "green": 0.26, "blue": 0.21}}},
    "fields": "userEnteredFormat.backgroundColor"}})
legend_fmt.append({"repeatCell": {
    "range": {"sheetId": legend_id, "startRowIndex": 46, "endRowIndex": 47, "startColumnIndex": 0, "endColumnIndex": 1},
    "cell": {"userEnteredFormat": {"backgroundColor": {"red": 0.45, "green": 0.45, "blue": 0.45}}},
    "fields": "userEnteredFormat.backgroundColor"}})

legend_fmt.append({"autoResizeDimensions": {"dimensions": {"sheetId": legend_id, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 3}}})
legend_fmt.append({"updateSheetProperties": {"properties": {"sheetId": legend_id, "gridProperties": {"frozenRowCount": 1}}, "fields": "gridProperties.frozenRowCount"}})

api('POST', f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate', {"requests": legend_fmt})
print("  Status Legend written")

# ── Step 4: Conditional formatting on Users and Payments tabs ──
print("\n[4/5] Applying conditional formatting...")

users_id = existing_tabs.get('Users', 1)
payments_id = existing_tabs.get('Payments', 2)

def color_rule(sheet_id, col_start, col_end, value, r, g, b):
    """Create a conditional format rule for exact text match."""
    return {
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [{"sheetId": sheet_id, "startRowIndex": 1, "startColumnIndex": col_start, "endColumnIndex": col_end}],
                "booleanRule": {
                    "condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": value}]},
                    "format": {"backgroundColor": {"red": r, "green": g, "blue": b}}
                }
            },
            "index": 0
        }
    }

def bool_rule(sheet_id, col_start, col_end, value, r, g, b):
    return {
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [{"sheetId": sheet_id, "startRowIndex": 1, "startColumnIndex": col_start, "endColumnIndex": col_end}],
                "booleanRule": {
                    "condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": value}]},
                    "format": {"backgroundColor": {"red": r, "green": g, "blue": b}}
                }
            },
            "index": 0
        }
    }

# Green
G = (0.22, 0.55, 0.24)
# Yellow/Orange
Y = (0.85, 0.65, 0.13)
# Red
R = (0.80, 0.26, 0.21)
# Gray
GR = (0.45, 0.45, 0.45)
# Light green
LG = (0.56, 0.77, 0.49)

cond_rules = []

# Users tab - Col C (idx 2) = Status
cond_rules.append(color_rule(users_id, 2, 3, "active", *G))
cond_rules.append(color_rule(users_id, 2, 3, "approved", *LG))
cond_rules.append(color_rule(users_id, 2, 3, "agreement_confirmed", *LG))
cond_rules.append(color_rule(users_id, 2, 3, "waitlisted", *Y))
cond_rules.append(color_rule(users_id, 2, 3, "signed_up", *GR))

# Users tab - Col G (idx 6) = Admin Review
cond_rules.append(color_rule(users_id, 6, 7, "approved", *G))
cond_rules.append(color_rule(users_id, 6, 7, "due", *Y))
cond_rules.append(color_rule(users_id, 6, 7, "rejected", *R))

# Users tab - Col J (idx 9) = Extraction
cond_rules.append(color_rule(users_id, 9, 10, "completed", *G))
cond_rules.append(color_rule(users_id, 9, 10, "pending", *Y))
cond_rules.append(color_rule(users_id, 9, 10, "failed", *R))

# Users tab - Col K (idx 10) = Verified
cond_rules.append(color_rule(users_id, 10, 11, "TRUE", *G))
cond_rules.append(color_rule(users_id, 10, 11, "FALSE", *GR))

# Users tab - Col Z (idx 25) = Tenancy Status
cond_rules.append(color_rule(users_id, 25, 26, "active", *G))
cond_rules.append(color_rule(users_id, 25, 26, "pending_verification", *Y))
cond_rules.append(color_rule(users_id, 25, 26, "expired", *R))

# Users tab - Cols AA-AC (idx 26-28) = bank/utility/landlord verified
for col in [26, 27, 28]:
    cond_rules.append(color_rule(users_id, col, col+1, "TRUE", *G))
    cond_rules.append(color_rule(users_id, col, col+1, "FALSE", *GR))

# Users tab - Col AD (idx 29) = M360 Status
cond_rules.append(color_rule(users_id, 29, 30, "SUCCESS", *G))
cond_rules.append(color_rule(users_id, 29, 30, "CONSENT_GIVEN", *Y))
cond_rules.append(color_rule(users_id, 29, 30, "OTP_SENT", *GR))
cond_rules.append(color_rule(users_id, 29, 30, "FAILED", *R))

# Payments tab - Col E (idx 4) = Payment Status
cond_rules.append(color_rule(payments_id, 4, 5, "success", *G))
cond_rules.append(color_rule(payments_id, 4, 5, "pending", *Y))
cond_rules.append(color_rule(payments_id, 4, 5, "failed", *R))
cond_rules.append(color_rule(payments_id, 4, 5, "refunded", *R))

# Payments tab - Col P (idx 15) = Settlement Status
cond_rules.append(color_rule(payments_id, 15, 16, "settled", *G))
cond_rules.append(color_rule(payments_id, 15, 16, "pending", *Y))

api('POST', f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate', {"requests": cond_rules})
print(f"  Applied {len(cond_rules)} conditional format rules")

# ── Step 5: Write M360 data and format ──
print("\n[5/5] Syncing M360 data...")

m360_data = json.loads(subprocess.run(['curl', '-s',
    f'https://zqlowjveyqiagnbmfwsb.supabase.co/rest/v1/v_m360_detail?select=*',
    '-H', f'apikey: {SRK}', '-H', f'Authorization: Bearer {SRK}'],
    capture_output=True, text=True).stdout)

M360_COLUMNS = [
    ('user_phone', 'Phone', None),
    ('user_name', 'User Name', None),
    ('user_status', 'User Status', None),
    ('m360_status', 'M360 Status', None),
    ('consent_phone', 'Consent Phone', None),
    ('m360_full_name', 'M360 Name', None),
    ('m360_gender', 'Gender', None),
    ('m360_date_of_birth', 'DOB', None),
    ('m360_age', 'Age', None),
    ('m360_occupation', 'Occupation', None),
    ('m360_total_income', 'Income', None),
    ('m360_aadhaar_masked', 'Aadhaar', None),
    ('m360_credit_score', 'Credit Score', None),
    ('risk_level', 'Risk Level', None),
    ('risk_safe', 'Risk Safe', None),
    ('risk_reason', 'Risk Reason', None),
    ('mobile_provider', 'Mobile Provider', None),
    ('connection_type', 'Connection', None),
    ('phone_type', 'Phone Type', None),
    ('otp_attempts', 'OTP Attempts', None),
    ('verified_at', 'Verified At', None),
    ('created_at', 'Created At', None),
]

headers = [c[1] for c in M360_COLUMNS]
rows = []
for row in m360_data:
    r = []
    for key, _, fmt in M360_COLUMNS:
        val = row.get(key)
        if val is None:
            r.append('')
        elif isinstance(val, (dict, list)):
            r.append(json.dumps(val)[:200])
        else:
            r.append(val)
    rows.append(r)

all_rows = [headers] + rows
m360_id = existing_tabs.get('M360', 100)

api('PUT',
    f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/M360!A1?valueInputOption=USER_ENTERED',
    {"values": all_rows})

# Format M360 header
m360_fmt = [
    {"repeatCell": {
        "range": {"sheetId": m360_id, "startRowIndex": 0, "endRowIndex": 1,
                   "startColumnIndex": 0, "endColumnIndex": len(headers)},
        "cell": {"userEnteredFormat": {
            "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
            "backgroundColor": {"red": 0.1, "green": 0.1, "blue": 0.18}
        }},
        "fields": "userEnteredFormat"}},
    {"updateSheetProperties": {
        "properties": {"sheetId": m360_id, "gridProperties": {"frozenRowCount": 1}},
        "fields": "gridProperties.frozenRowCount"}},
    {"autoResizeDimensions": {"dimensions": {"sheetId": m360_id, "dimension": "COLUMNS", "startIndex": 0, "endIndex": len(headers)}}},
    # M360 Status conditional formatting
    color_rule(m360_id, 3, 4, "SUCCESS", *G),
    color_rule(m360_id, 3, 4, "CONSENT_GIVEN", *Y),
    color_rule(m360_id, 3, 4, "OTP_SENT", *GR),
    color_rule(m360_id, 3, 4, "FAILED", *R),
]

api('POST', f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate', {"requests": m360_fmt})
print(f"  M360: {len(rows)} rows written")

# ── Format existing tabs better ──
print("\nFormatting existing tabs...")

# Auto-resize Users and Payments columns
resize_fmt = [
    {"autoResizeDimensions": {"dimensions": {"sheetId": users_id, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 47}}},
    {"autoResizeDimensions": {"dimensions": {"sheetId": payments_id, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 21}}},
    # Alternating row colors on Users
    {"addBanding": {
        "bandedRange": {
            "range": {"sheetId": users_id, "startRowIndex": 0, "startColumnIndex": 0, "endColumnIndex": 47},
            "rowProperties": {
                "headerColor": {"red": 0.1, "green": 0.1, "blue": 0.18},
                "firstBandColor": {"red": 1, "green": 1, "blue": 1},
                "secondBandColor": {"red": 0.95, "green": 0.95, "blue": 0.97}
            }
        }
    }},
    # Alternating row colors on Payments
    {"addBanding": {
        "bandedRange": {
            "range": {"sheetId": payments_id, "startRowIndex": 0, "startColumnIndex": 0, "endColumnIndex": 21},
            "rowProperties": {
                "headerColor": {"red": 0.1, "green": 0.1, "blue": 0.18},
                "firstBandColor": {"red": 1, "green": 1, "blue": 1},
                "secondBandColor": {"red": 0.95, "green": 0.95, "blue": 0.97}
            }
        }
    }},
]
resp = api('POST', f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}:batchUpdate', {"requests": resize_fmt})
if resp:
    print("  Alternating rows + auto-resize applied")

print(f"\n{'='*60}")
print("FORMATTING COMPLETE")
print(f"{'='*60}")
print(f"Sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit")
print(f"New tabs: M360 ({len(rows)} records), Status Legend")
print(f"Conditional formatting: {len(cond_rules)} rules on Users + Payments")
