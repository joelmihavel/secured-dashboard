#!/usr/bin/env python3
"""
Deploy Apps Script to the Admin Dashboard Google Sheet.
Re-authenticates with script.projects scope, then creates + pushes the script.

Run from terminal: python3 scripts/deploy-apps-script.py
(Browser will open for authorization)
"""
import json
import os
import subprocess
import sys

SHEET_ID = '114HbdCPKcFZvU5iFt8OWSXlKpJ6O8rEQVKInOA5jcIo'
QUOTA_PROJECT = 'mcp-access-481804'
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

# Supabase service key
SRK = subprocess.run(
    ['bash', '-c', 'supabase projects api-keys --project-ref uowjtrzmszuaiokqxgir 2>/dev/null | grep secret | awk \'{print $NF}\''],
    capture_output=True, text=True, cwd=PROJECT_DIR
).stdout.strip()
if not SRK:
    print("ERROR: Could not get Supabase service role key")
    sys.exit(1)
print(f"Got Supabase service key")

# ── OAuth with script scope ──
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.projects',
]

# Use the same client from gspread
CLIENT_CONFIG = {
    "installed": {
        "client_id": "764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com",
        "client_secret": "d-FL95Q19q7MQmFpd7hHD0Ty",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["http://localhost"]
    }
}

print("\nOpening browser for authorization (needs script.projects scope)...")
print("If browser doesn't open, copy the URL from the terminal.\n")

flow = InstalledAppFlow.from_client_config(CLIENT_CONFIG, SCOPES)
creds = flow.run_local_server(port=8090, open_browser=True)
TOKEN = creds.token
print(f"Authenticated successfully!")

# Save updated credentials for future use
auth_path = os.path.expanduser('~/.config/gspread/authorized_user.json')
with open(auth_path, 'w') as f:
    json.dump({
        "refresh_token": creds.refresh_token,
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(SCOPES),
        "universe_domain": "googleapis.com",
        "account": "",
    }, f, indent=2)
print(f"Saved updated credentials to {auth_path}")

# ── Helper ──
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

# ── Apps Script code ──
APPS_SCRIPT_CODE = r"""
// ===== Configuration =====
const SUPABASE_URL = 'https://zqlowjveyqiagnbmfwsb.supabase.co';
const VIEW_USERS = 'v_user_funnel';
const VIEW_PAYMENTS = 'v_payment_detail';

function getServiceKey() {
  var key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SECRET_KEY');
  if (key) return key;
  return '""" + SRK + r"""';
}

// ===== Main Sync =====
function syncAll() {
  syncSheet(VIEW_USERS, 'Users', USER_COLUMNS);
  syncSheet(VIEW_PAYMENTS, 'Payments', PAYMENT_COLUMNS);
  buildConversions();
  updateTimestamp();
  SpreadsheetApp.flush();
}

// ===== Column Definitions =====
const USER_COLUMNS = [
  { key: 'phone', header: 'Phone' },
  { key: 'name', header: 'Name' },
  { key: 'user_status', header: 'Status' },
  { key: 'role', header: 'Role' },
  { key: 'signed_up_at', header: 'Signed Up', fmt: 'date' },
  { key: 'waitlist_position', header: 'WL Position' },
  { key: 'admin_review', header: 'Admin Review' },
  { key: 'risk_level', header: 'Risk' },
  { key: 'waitlist_joined_at', header: 'WL Joined', fmt: 'date' },
  { key: 'extraction_status', header: 'Extraction' },
  { key: 'agreement_verified', header: 'Verified' },
  { key: 'property_address', header: 'Address' },
  { key: 'property_city', header: 'City' },
  { key: 'property_state', header: 'State' },
  { key: 'monthly_rent_paise', header: 'Rent (₹)', fmt: 'paise' },
  { key: 'maintenance_paise', header: 'Maint (₹)', fmt: 'paise' },
  { key: 'landlord_display_name', header: 'Landlord' },
  { key: 'landlord_phone', header: 'Landlord Phone' },
  { key: 'lease_start_date', header: 'Lease Start' },
  { key: 'lease_end_date', header: 'Lease End' },
  { key: 'rent_due_day', header: 'Due Day' },
  { key: 'geocode_formatted_address', header: 'Google Maps Address' },
  { key: 'latitude', header: 'Lat' },
  { key: 'longitude', header: 'Lng' },
  { key: 'tenancy_id', header: 'Tenancy ID' },
  { key: 'tenancy_status', header: 'Tenancy Status' },
  { key: 'bank_verified', header: 'Bank ✓' },
  { key: 'utility_verified', header: 'Utility ✓' },
  { key: 'landlord_approved', header: 'Landlord ✓' },
  { key: 'm360_status', header: 'M360 Status' },
  { key: 'm360_full_name', header: 'M360 Name' },
  { key: 'm360_gender', header: 'M360 Gender' },
  { key: 'm360_date_of_birth', header: 'M360 DOB' },
  { key: 'm360_age', header: 'M360 Age' },
  { key: 'm360_occupation', header: 'M360 Occupation' },
  { key: 'm360_total_income', header: 'M360 Income' },
  { key: 'm360_aadhaar_masked', header: 'Aadhaar (masked)' },
  { key: 'm360_credit_score', header: 'Credit Score' },
  { key: 'm360_risk_level', header: 'Risk Level' },
  { key: 'm360_risk_safe', header: 'Risk Safe' },
  { key: 'm360_mobile_provider', header: 'Mobile Provider' },
  { key: 'm360_connection_type', header: 'Connection Type' },
  { key: 'm360_verified_at', header: 'M360 Verified At', fmt: 'date' },
  { key: 'successful_payments', header: 'Payments Made' },
  { key: 'total_paid_paise', header: 'Total Paid (₹)', fmt: 'paise' },
  { key: 'total_cashback_earned_paise', header: 'Cashback Earned (₹)', fmt: 'paise' },
  { key: 'cashback_balance_paise', header: 'CB Balance (₹)', fmt: 'paise' },
  { key: 'last_payment_at', header: 'Last Payment', fmt: 'date' },
];

const PAYMENT_COLUMNS = [
  { key: 'user_phone', header: 'Phone' },
  { key: 'user_name', header: 'Name' },
  { key: 'payment_month', header: 'Month' },
  { key: 'due_date', header: 'Due Date' },
  { key: 'payment_status', header: 'Status' },
  { key: 'payment_method', header: 'Method' },
  { key: 'rent_amount_paise', header: 'Rent (₹)', fmt: 'paise' },
  { key: 'total_amount_paise', header: 'Total (₹)', fmt: 'paise' },
  { key: 'cashback_applied_paise', header: 'CB Applied (₹)', fmt: 'paise' },
  { key: 'cashback_earned_paise', header: 'CB Earned (₹)', fmt: 'paise' },
  { key: 'pg_fee_paise', header: 'PG Fee (₹)', fmt: 'paise' },
  { key: 'payu_txn_id', header: 'PayU Txn' },
  { key: 'payu_mihpayid', header: 'PayU ID' },
  { key: 'initiated_at', header: 'Initiated', fmt: 'date' },
  { key: 'paid_at', header: 'Paid At', fmt: 'date' },
  { key: 'settlement_status', header: 'Settlement' },
  { key: 'settled_at', header: 'Settled At', fmt: 'date' },
  { key: 'property_address', header: 'Property' },
  { key: 'property_city', header: 'City' },
  { key: 'landlord_name', header: 'Landlord' },
  { key: 'tenancy_rent_paise', header: 'Agreement Rent (₹)', fmt: 'paise' },
];

// ===== Fetch & Write =====
function syncSheet(viewName, sheetName, columns) {
  const data = fetchView(viewName);
  if (!data || data.length === 0) return;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  const headers = columns.map(c => c.header);
  const rows = data.map(row =>
    columns.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) return '';
      if (c.fmt === 'paise') return Math.round(val / 100);
      if (c.fmt === 'date' && val) return new Date(val);
      return val;
    })
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
  sheet.setFrozenRows(1);
}

function fetchView(viewName) {
  const key = getServiceKey();
  const url = SUPABASE_URL + '/rest/v1/' + viewName + '?select=*';
  const options = {
    method: 'GET',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
    },
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    Logger.log('Fetch error for ' + viewName + ': ' + response.getContentText());
    return null;
  }
  return JSON.parse(response.getContentText());
}

function updateTimestamp() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  sheet.getRange('A1').setValue(new Date());
}

// ===== Conversions Tab =====
function buildConversions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = ss.getSheetByName('Users');
  const conv = ss.getSheetByName('Conversions');

  const data = users.getDataRange().getValues();
  if (data.length <= 1) return;
  const rows = data.slice(1);

  const COL = {
    signedUp: 4,
    extraction: 9,
    verified: 10,
    adminReview: 6,
    payments: 43,
  };

  const weeks = {};
  rows.forEach(function(r) {
    var d = r[COL.signedUp];
    if (!d) return;
    var dt = new Date(d);
    var weekKey = getWeekKey(dt);
    if (!weeks[weekKey]) {
      weeks[weekKey] = { signups: 0, uploaded: 0, verified: 0, approved: 0, paid: 0 };
    }
    weeks[weekKey].signups++;
    if (r[COL.extraction] === 'completed') weeks[weekKey].uploaded++;
    if (r[COL.verified] === true) weeks[weekKey].verified++;
    if (r[COL.adminReview] === 'approved') weeks[weekKey].approved++;
    if (r[COL.payments] > 0) weeks[weekKey].paid++;
  });

  conv.clearContents();
  var convHeaders = ['Week', 'Signups', 'Uploaded', 'Upload %', 'Verified', 'Verify %',
                     'Approved', 'Approve %', 'Paid', 'Payment %'];
  conv.getRange(1, 1, 1, convHeaders.length).setValues([convHeaders])
    .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');

  var sorted = Object.keys(weeks).sort().reverse().map(function(k) { return [k, weeks[k]]; });
  var convRows = sorted.map(function(entry) {
    var week = entry[0], d = entry[1];
    return [
      week, d.signups,
      d.uploaded, d.signups ? (d.uploaded / d.signups * 100).toFixed(1) + '%' : '0%',
      d.verified, d.signups ? (d.verified / d.signups * 100).toFixed(1) + '%' : '0%',
      d.approved, d.signups ? (d.approved / d.signups * 100).toFixed(1) + '%' : '0%',
      d.paid, d.signups ? (d.paid / d.signups * 100).toFixed(1) + '%' : '0%',
    ];
  });
  if (convRows.length > 0) {
    conv.getRange(2, 1, convRows.length, convHeaders.length).setValues(convRows);
  }
  conv.setFrozenRows(1);
}

function getWeekKey(date) {
  var jan1 = new Date(date.getFullYear(), 0, 1);
  var weekNum = Math.ceil(((date - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return date.getFullYear() + '-W' + ('0' + weekNum).slice(-2);
}

// ===== Trigger Setup (run once) =====
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyMinutes(10)
    .create();
  Logger.log('Trigger created: syncAll every 10 minutes');
}
""".strip()

MANIFEST = json.dumps({
    "timeZone": "Asia/Kolkata",
    "dependencies": {},
    "exceptionLogging": "STACKDRIVER",
    "runtimeVersion": "V8",
    "oauthScopes": [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/script.external_request"
    ]
})

# ── Step 1: Create Apps Script project bound to the sheet ──
print(f"\n[1/2] Creating Apps Script project bound to sheet...")
resp = api('POST', 'https://script.googleapis.com/v1/projects', {
    "title": "Admin Dashboard Sync",
    "parentId": SHEET_ID
})
if not resp or 'scriptId' not in resp:
    print("FAILED: Could not create Apps Script project.")
    print("Make sure the Apps Script API is enabled:")
    print("  https://script.google.com/home/usersettings")
    sys.exit(1)

script_id = resp['scriptId']
print(f"  Script ID: {script_id}")

# ── Step 2: Push code ──
print(f"[2/2] Pushing Apps Script code...")
resp = api('PUT', f'https://script.googleapis.com/v1/projects/{script_id}/content', {
    "files": [
        {"name": "Code", "type": "SERVER_JS", "source": APPS_SCRIPT_CODE},
        {"name": "appsscript", "type": "JSON", "source": MANIFEST}
    ]
})
if not resp:
    print("FAILED: Could not push code to Apps Script.")
    sys.exit(1)

print(f"\n{'='*60}")
print("APPS SCRIPT DEPLOYED SUCCESSFULLY")
print(f"{'='*60}")
print(f"Sheet:  https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit")
print(f"Script: https://script.google.com/d/{script_id}/edit")
print(f"\nFINAL STEP — Enable auto-sync:")
print(f"  1. Open the Script link above")
print(f"  2. Select 'setupTrigger' from the function dropdown")
print(f"  3. Click Run > Authorize")
print(f"  (This enables 10-minute auto-sync)")
