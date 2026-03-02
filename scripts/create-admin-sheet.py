#!/usr/bin/env python3
"""
Create the Admin Dashboard Google Sheet, deploy Apps Script, and run first sync.
Uses gspread OAuth credentials + quota project header.
"""

import json
import subprocess
import sys
import re
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
QUOTA_PROJECT = 'mcp-access-481804'

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
print(f"Authenticated (token valid: {creds.valid})")

def api(method, url, body=None):
    cmd = ['curl', '-s', '-X', method, url,
           '-H', f'Authorization: Bearer {TOKEN}',
           '-H', f'x-goog-user-project: {QUOTA_PROJECT}',
           '-H', 'Content-Type: application/json']
    if body:
        cmd += ['-d', json.dumps(body)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if not r.stdout.strip():
        print(f"Empty response from {method} {url}")
        sys.exit(1)
    resp = json.loads(r.stdout)
    if 'error' in resp:
        print(f"API Error ({method} {url}):\n{json.dumps(resp['error'], indent=2)}")
        sys.exit(1)
    return resp

# ── Supabase key ──
SRK = subprocess.run(
    ['bash', '-c', 'supabase projects api-keys --project-ref zqlowjveyqiagnbmfwsb 2>/dev/null | grep service_role | awk \'{print $NF}\''],
    capture_output=True, text=True, cwd=PROJECT_DIR
).stdout.strip()
if not SRK:
    print("ERROR: Could not get Supabase service role key")
    sys.exit(1)
print("Got Supabase service key")

# ── Step 1: Create spreadsheet ──
print("\n[1/5] Creating Google Sheet...")
sheet = api('POST', 'https://sheets.googleapis.com/v4/spreadsheets', {
    "properties": {"title": "Flent Secured — Admin Dashboard"},
    "sheets": [
        {"properties": {"title": "Summary", "index": 0}},
        {"properties": {"title": "Users", "index": 1}},
        {"properties": {"title": "Payments", "index": 2}},
        {"properties": {"title": "Conversions", "index": 3}},
        {"properties": {"title": "Config", "index": 4, "hidden": True}},
    ]
})
sid = sheet['spreadsheetId']
url = sheet['spreadsheetUrl']
print(f"  {url}")

sheet_ids = {s['properties']['title']: s['properties']['sheetId'] for s in sheet['sheets']}

# ── Step 2: Summary formulas ──
print("\n[2/5] Adding Summary formulas...")
api('PUT',
    f'https://sheets.googleapis.com/v4/spreadsheets/{sid}/values/Summary!A1:D15?valueInputOption=USER_ENTERED',
    {"values": [
        ["Flent Secured — Admin Dashboard", "", "", ""],
        ['=CONCATENATE("Last synced: ", TEXT(Config!A1, "yyyy-mm-dd hh:mm:ss"))', "", "", ""],
        ["", "", "", ""],
        ["FUNNEL", "", "", ""],
        ["Total Signups", '=COUNTA(Users!A:A)-1', "", "Conversion"],
        ["Uploaded Agreement", '=COUNTIF(Users!J:J,"completed")', "", '=IF(B5>0,B6/B5,0)'],
        ["Verified Agreement", '=COUNTIF(Users!K:K,TRUE)', "", '=IF(B5>0,B7/B5,0)'],
        ["Waitlist Approved", '=COUNTIF(Users!G:G,"approved")', "", '=IF(B5>0,B8/B5,0)'],
        ["Has Tenancy", '=COUNTA(Users!Y:Y)-COUNTBLANK(Users!Y:Y)', "", '=IF(B5>0,B9/B5,0)'],
        ["Made Payment", '=COUNTIF(Users!AR:AR,">0")', "", '=IF(B5>0,B10/B5,0)'],
        ["", "", "", ""],
        ["REVENUE", "", "", ""],
        ["Total Collected (₹)", '=SUMIF(Payments!E:E,"success",Payments!H:H)/100', "", ""],
        ["Payments This Month", '=COUNTIFS(Payments!E:E,"success",Payments!N:N,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1))', "", ""],
        ["Avg Rent (₹)", '=IFERROR(AVERAGEIF(Users!O:O,">"&0,Users!O:O)/100,0)', "", ""],
    ]})

# ── Step 3: Format Summary ──
print("[3/5] Formatting Summary tab...")
api('POST', f'https://sheets.googleapis.com/v4/spreadsheets/{sid}:batchUpdate', {"requests": [
    {"repeatCell": {
        "range": {"sheetId": sheet_ids["Summary"], "startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": 0, "endColumnIndex": 4},
        "cell": {"userEnteredFormat": {"textFormat": {"bold": True, "fontSize": 14}}},
        "fields": "userEnteredFormat.textFormat"}},
    {"repeatCell": {
        "range": {"sheetId": sheet_ids["Summary"], "startRowIndex": 3, "endRowIndex": 4, "startColumnIndex": 0, "endColumnIndex": 1},
        "cell": {"userEnteredFormat": {"textFormat": {"bold": True, "fontSize": 11}}},
        "fields": "userEnteredFormat.textFormat"}},
    {"repeatCell": {
        "range": {"sheetId": sheet_ids["Summary"], "startRowIndex": 11, "endRowIndex": 12, "startColumnIndex": 0, "endColumnIndex": 1},
        "cell": {"userEnteredFormat": {"textFormat": {"bold": True, "fontSize": 11}}},
        "fields": "userEnteredFormat.textFormat"}},
    {"repeatCell": {
        "range": {"sheetId": sheet_ids["Summary"], "startRowIndex": 4, "endRowIndex": 5, "startColumnIndex": 3, "endColumnIndex": 4},
        "cell": {"userEnteredFormat": {"textFormat": {"bold": True}}},
        "fields": "userEnteredFormat.textFormat"}},
    {"repeatCell": {
        "range": {"sheetId": sheet_ids["Summary"], "startRowIndex": 5, "endRowIndex": 10, "startColumnIndex": 3, "endColumnIndex": 4},
        "cell": {"userEnteredFormat": {"numberFormat": {"type": "PERCENT", "pattern": "0.0%"}}},
        "fields": "userEnteredFormat.numberFormat"}},
    {"repeatCell": {
        "range": {"sheetId": sheet_ids["Summary"], "startRowIndex": 12, "endRowIndex": 13, "startColumnIndex": 1, "endColumnIndex": 2},
        "cell": {"userEnteredFormat": {"numberFormat": {"type": "NUMBER", "pattern": "₹#,##0"}}},
        "fields": "userEnteredFormat.numberFormat"}},
    {"repeatCell": {
        "range": {"sheetId": sheet_ids["Summary"], "startRowIndex": 14, "endRowIndex": 15, "startColumnIndex": 1, "endColumnIndex": 2},
        "cell": {"userEnteredFormat": {"numberFormat": {"type": "NUMBER", "pattern": "₹#,##0"}}},
        "fields": "userEnteredFormat.numberFormat"}},
    {"autoResizeDimensions": {"dimensions": {"sheetId": sheet_ids["Summary"], "dimension": "COLUMNS", "startIndex": 0, "endIndex": 4}}},
]})

# ── Step 4: Deploy Apps Script ──
print("\n[4/5] Deploying Apps Script...")

with open(os.path.join(SCRIPT_DIR, 'setup-google-sheets.md'), 'r') as f:
    md_content = f.read()
match = re.search(r'## Apps Script Code\s*```javascript\s*(.*?)```', md_content, re.DOTALL)
if not match:
    print("ERROR: Could not extract Apps Script code"); sys.exit(1)
apps_script_code = match.group(1).strip()

# Embed Supabase key as fallback
apps_script_code = apps_script_code.replace(
    "return PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');",
    f"var key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');\n"
    f"  if (key) return key;\n"
    f"  return '{SRK}';"
)

# Try deploying Apps Script (may fail if token lacks script scope)
script_id = None
try:
    r = subprocess.run(['curl', '-s', '-X', 'POST', 'https://script.googleapis.com/v1/projects',
        '-H', f'Authorization: Bearer {TOKEN}',
        '-H', f'x-goog-user-project: {QUOTA_PROJECT}',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps({"title": "Admin Dashboard Sync", "parentId": sid})],
        capture_output=True, text=True)
    resp = json.loads(r.stdout)
    if 'scriptId' in resp:
        script_id = resp['scriptId']
        print(f"  Script ID: {script_id}")
        subprocess.run(['curl', '-s', '-X', 'PUT',
            f'https://script.googleapis.com/v1/projects/{script_id}/content',
            '-H', f'Authorization: Bearer {TOKEN}',
            '-H', f'x-goog-user-project: {QUOTA_PROJECT}',
            '-H', 'Content-Type: application/json',
            '-d', json.dumps({"files": [
                {"name": "Code", "type": "SERVER_JS", "source": apps_script_code},
                {"name": "appsscript", "type": "JSON", "source": json.dumps({
                    "timeZone": "Asia/Kolkata", "dependencies": {},
                    "exceptionLogging": "STACKDRIVER", "runtimeVersion": "V8",
                    "oauthScopes": [
                        "https://www.googleapis.com/auth/spreadsheets",
                        "https://www.googleapis.com/auth/script.external_request"
                    ]
                })}
            ]})], capture_output=True, text=True)
        print("  Apps Script deployed!")
    else:
        print("  Skipped (scope not available). Add manually via Extensions > Apps Script.")
except Exception:
    print("  Skipped. Add manually via Extensions > Apps Script.")

# ── Step 5: First data sync (write data directly via Sheets API) ──
print("\n[5/5] Running first data sync...")

USER_COLUMNS = [
    ('phone','Phone',None), ('name','Name',None), ('user_status','Status',None),
    ('role','Role',None), ('signed_up_at','Signed Up',None),
    ('waitlist_position','WL Position',None), ('admin_review','Admin Review',None),
    ('risk_level','Risk',None), ('waitlist_joined_at','WL Joined',None),
    ('extraction_status','Extraction',None), ('agreement_verified','Verified',None),
    ('property_address','Address',None), ('property_city','City',None),
    ('property_state','State',None), ('monthly_rent_paise','Rent (₹)','paise'),
    ('maintenance_paise','Maint (₹)','paise'), ('landlord_display_name','Landlord',None),
    ('landlord_phone','Landlord Phone',None), ('lease_start_date','Lease Start',None),
    ('lease_end_date','Lease End',None), ('rent_due_day','Due Day',None),
    ('geocode_formatted_address','Google Maps Address',None),
    ('latitude','Lat',None), ('longitude','Lng',None),
    ('tenancy_id','Tenancy ID',None), ('tenancy_status','Tenancy Status',None),
    ('bank_verified','Bank ✓',None), ('utility_verified','Utility ✓',None),
    ('landlord_approved','Landlord ✓',None),
    ('m360_status','M360 Status',None), ('m360_full_name','M360 Name',None),
    ('m360_gender','M360 Gender',None), ('m360_date_of_birth','M360 DOB',None),
    ('m360_age','M360 Age',None), ('m360_occupation','M360 Occupation',None),
    ('m360_total_income','M360 Income',None), ('m360_aadhaar_masked','Aadhaar (masked)',None),
    ('m360_credit_score','Credit Score',None), ('m360_risk_level','Risk Level',None),
    ('m360_risk_safe','Risk Safe',None), ('m360_mobile_provider','Mobile Provider',None),
    ('m360_connection_type','Connection Type',None),
    ('m360_verified_at','M360 Verified At',None),
    ('successful_payments','Payments Made',None),
    ('total_paid_paise','Total Paid (₹)','paise'),
    ('total_cashback_earned_paise','Cashback Earned (₹)','paise'),
    ('cashback_balance_paise','CB Balance (₹)','paise'),
    ('last_payment_at','Last Payment',None),
]

PAYMENT_COLUMNS = [
    ('user_phone','Phone',None), ('user_name','Name',None),
    ('payment_month','Month',None), ('due_date','Due Date',None),
    ('payment_status','Status',None), ('payment_method','Method',None),
    ('rent_amount_paise','Rent (₹)','paise'), ('total_amount_paise','Total (₹)','paise'),
    ('cashback_applied_paise','CB Applied (₹)','paise'),
    ('cashback_earned_paise','CB Earned (₹)','paise'),
    ('pg_fee_paise','PG Fee (₹)','paise'), ('payu_txn_id','PayU Txn',None),
    ('payu_mihpayid','PayU ID',None), ('initiated_at','Initiated',None),
    ('paid_at','Paid At',None), ('settlement_status','Settlement',None),
    ('settled_at','Settled At',None), ('property_address','Property',None),
    ('property_city','City',None), ('landlord_name','Landlord',None),
    ('tenancy_rent_paise','Agreement Rent (₹)','paise'),
]

def fetch_supabase(view):
    r = subprocess.run(['curl', '-s',
        f'https://devapi.flent.in/rest/v1/{view}?select=*',
        '-H', f'apikey: {SRK}', '-H', f'Authorization: Bearer {SRK}'],
        capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  Fetch error for {view}")
        return []
    return json.loads(r.stdout)

def write_tab(tab_name, columns, data):
    headers = [c[1] for c in columns]
    rows = []
    for row in data:
        r = []
        for key, _, fmt in columns:
            val = row.get(key)
            if val is None:
                r.append('')
            elif fmt == 'paise' and isinstance(val, (int, float)):
                r.append(round(val / 100))
            else:
                r.append(val)
        rows.append(r)

    all_rows = [headers] + rows
    # Write in batches (Sheets API limit)
    api('PUT',
        f'https://sheets.googleapis.com/v4/spreadsheets/{sid}/values/{tab_name}!A1?valueInputOption=USER_ENTERED',
        {"values": all_rows})

    # Bold header + dark bg
    api('POST', f'https://sheets.googleapis.com/v4/spreadsheets/{sid}:batchUpdate', {"requests": [
        {"repeatCell": {
            "range": {"sheetId": sheet_ids[tab_name], "startRowIndex": 0, "endRowIndex": 1,
                       "startColumnIndex": 0, "endColumnIndex": len(headers)},
            "cell": {"userEnteredFormat": {
                "textFormat": {"bold": True},
                "backgroundColor": {"red": 0.1, "green": 0.1, "blue": 0.18}
            }},
            "fields": "userEnteredFormat.textFormat,userEnteredFormat.backgroundColor"}},
        {"updateSheetProperties": {
            "properties": {"sheetId": sheet_ids[tab_name], "gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount"}},
    ]})
    return len(rows)

# Fetch and write Users
print("  Fetching v_user_funnel...")
users = fetch_supabase('v_user_funnel')
n = write_tab('Users', USER_COLUMNS, users)
print(f"  Users: {n} rows written")

# Fetch and write Payments
print("  Fetching v_payment_detail...")
payments = fetch_supabase('v_payment_detail')
n = write_tab('Payments', PAYMENT_COLUMNS, payments)
print(f"  Payments: {n} rows written")

# Write timestamp to Config
from datetime import datetime
api('PUT',
    f'https://sheets.googleapis.com/v4/spreadsheets/{sid}/values/Config!A1?valueInputOption=USER_ENTERED',
    {"values": [[datetime.now().strftime('%Y-%m-%d %H:%M:%S')]]})

# ── Done ──
print()
print("=" * 60)
print("SETUP COMPLETE — FIRST SYNC DONE")
print("=" * 60)
print(f"Sheet:  {url}")
print(f"Script: https://script.google.com/d/{script_id}/edit")
print(f"Data:   {len(users)} users, {len(payments)} payments synced")
print()
if script_id:
    print(f"Script: https://script.google.com/d/{script_id}/edit")
    print("\nLAST STEP: Open the Apps Script link, then:")
    print("  1. Select 'setupTrigger' → Run → Authorize")
    print("     (this enables 10-minute auto-sync)")
else:
    print("\nTO ENABLE AUTO-SYNC:")
    print("  1. Open the Sheet → Extensions → Apps Script")
    print("  2. Delete default code, paste from scripts/setup-google-sheets.md")
    print("  3. Select 'syncAll' → Run → Authorize")
    print("  4. Select 'setupTrigger' → Run")
