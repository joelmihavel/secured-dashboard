# Admin Dashboard — Google Sheets Setup

Auto-syncing admin dashboard that pulls data from Supabase views every 10 minutes.

## Prerequisites

- Supabase migration `20260303100001_admin_dashboard_views.sql` deployed
- Service role key (get via `supabase projects api-keys --project-ref zqlowjveyqiagnbmfwsb`)

## Step 1: Create the Google Sheet

Create a new Google Sheet with **5 tabs** (exact names):

| Tab | Purpose |
|-----|---------|
| **Summary** | Key metrics dashboard |
| **Users** | Full user funnel (from `v_user_funnel`) |
| **Payments** | All transactions (from `v_payment_detail`) |
| **Conversions** | Weekly cohort conversion tracking |
| **Config** | Stores last sync timestamp (can be hidden) |

## Step 2: Add the Apps Script

1. Open the Google Sheet
2. Go to **Extensions > Apps Script**
3. Delete the default `Code.gs` content
4. Paste the entire script below
5. Save (Ctrl+S)

## Step 3: Set the Service Key

1. In Apps Script, go to **Project Settings** (gear icon)
2. Scroll to **Script Properties**
3. Click **Add Script Property**:
   - **Property**: `SUPABASE_SERVICE_KEY`
   - **Value**: paste the service_role key
4. Click **Save**

## Step 4: First Run

1. In the Apps Script editor, select `syncAll` from the function dropdown
2. Click **Run**
3. Authorize the script when prompted (Google will ask for permissions)
4. Check the Users and Payments tabs — they should now have data

## Step 5: Enable Auto-Sync

1. Select `setupTrigger` from the function dropdown
2. Click **Run**
3. This creates a 10-minute auto-refresh trigger

## Step 6: Add Summary Formulas

After the first sync populates data, add these formulas to the **Summary** tab:

```
A1: Flent Secured — Admin Dashboard
A2: =CONCATENATE("Last synced: ", TEXT(Config!A1, "yyyy-mm-dd hh:mm:ss"))

A4: FUNNEL
A5: Total Signups              B5: =COUNTA(Users!A:A)-1
A6: Uploaded Agreement          B6: =COUNTIF(Users!J:J,"completed")
A7: Verified Agreement          B7: =COUNTIF(Users!K:K,TRUE)
A8: Waitlist Approved           B8: =COUNTIF(Users!G:G,"approved")
A9: Has Tenancy                 B9: =COUNTA(Users!Y:Y)-COUNTBLANK(Users!Y:Y)
A10: Made Payment               B10: =COUNTIF(Users!AQ:AQ,">0")

D5: Conversion
D6: =IF(B5>0,B6/B5,0)
D7: =IF(B5>0,B7/B5,0)
D8: =IF(B5>0,B8/B5,0)
D9: =IF(B5>0,B9/B5,0)
D10: =IF(B5>0,B10/B5,0)

A12: REVENUE
A13: Total Collected (₹)       B13: =SUMIF(Payments!E:E,"success",Payments!H:H)/100
A14: Payments This Month        B14: =COUNTIFS(Payments!E:E,"success",Payments!N:N,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1))
A15: Avg Rent (₹)              B15: =IFERROR(AVERAGEIF(Users!O:O,">"&0,Users!O:O)/100,0)
```

> **Note**: Column letters depend on the final column order after sync. Verify by checking which column contains the referenced field (e.g., "extraction_status" for Upload, "agreement_verified" for Verified). Adjust letters as needed.

Format the D column as Percentage for conversion rates.

---

## Apps Script Code

```javascript
// ===== Configuration =====
const SUPABASE_URL = 'https://devapi.flent.in';  // CF Worker proxy
const VIEW_USERS = 'v_user_funnel';
const VIEW_PAYMENTS = 'v_payment_detail';

function getServiceKey() {
  return PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');
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
  // Agreement
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
  // Tenancy & Verification
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
  // Payments
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

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(sheetName);

  // Build header + rows
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

  // Clear and write
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  // Freeze header row
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Config');
  sheet.getRange('A1').setValue(new Date());
}

// ===== Conversions Tab =====
function buildConversions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = ss.getSheetByName('Users');
  const conv = ss.getSheetByName('Conversions');

  const data = users.getDataRange().getValues();
  if (data.length <= 1) return; // header only
  const rows = data.slice(1);

  // Column indices (0-based, matching USER_COLUMNS order)
  const COL = {
    signedUp: 4,      // Signed Up (date)
    extraction: 9,    // Extraction status
    verified: 10,     // Verified (bool)
    adminReview: 6,   // Admin Review
    payments: 43,     // Payments Made (successful_payments)
  };

  // Group by week
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

  // Write
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
  // Delete existing triggers
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  // Create 10-minute trigger
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyMinutes(10)
    .create();
  Logger.log('Trigger created: syncAll every 10 minutes');
}
```

---

## Verification

### 1. Test views via curl

```bash
# Get service role key
SRK=$(supabase projects api-keys --project-ref zqlowjveyqiagnbmfwsb | grep service_role | awk '{print $NF}')

# Test v_user_funnel
curl -s "https://devapi.flent.in/rest/v1/v_user_funnel?select=phone,name,user_status&limit=3" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" | python3 -m json.tool

# Test v_payment_detail
curl -s "https://devapi.flent.in/rest/v1/v_payment_detail?select=user_phone,payment_status,total_amount_paise&limit=3" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" | python3 -m json.tool

# Verify anon key is BLOCKED
ANON=$(supabase projects api-keys --project-ref zqlowjveyqiagnbmfwsb | grep anon | awk '{print $NF}')
curl -s "https://devapi.flent.in/rest/v1/v_user_funnel?limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# Should return 401 or empty
```

### 2. Test Google Sheet sync

1. Run `syncAll()` in Apps Script editor
2. Check Users tab has rows with correct headers
3. Check Payments tab has rows
4. Check Conversions tab shows weekly cohorts
5. Check Config!A1 has a timestamp

### 3. Test auto-refresh

Wait 10 minutes, verify Config!A1 timestamp updates automatically.

## Security Notes

- Views are **read-only** (no INSTEAD OF triggers)
- Only `SELECT` granted to `service_role`
- `anon` key has **zero access** to these views
- Apps Script only uses `GET` requests — no write operations
- Service key stored in Apps Script **Script Properties** (encrypted at rest by Google)
