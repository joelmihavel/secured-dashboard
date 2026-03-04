// ============================================================================
// FLENT SECURED — Admin Dashboard (Google Apps Script)
// McKinsey-grade formatting, formula-driven KPIs, embedded charts.
// Auto-syncs every 10 minutes from Supabase views.
// ============================================================================

// ===== Configuration =====
var SUPABASE_URL = 'https://devapi.flent.in';
var HOLYGRAIL_ID = '1E1GAWuzMSSsdV-osseKOQhwwzgGsbflC1PnojBV8WUU';

function getServiceKey() {
  var key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');
  if (key) return key;
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbG93anZleXFpYWduYm1md3NiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk5NjU1NSwiZXhwIjoyMDg0NTcyNTU1fQ.2eeohYeOPhcN1mAkoNmhU3FBAKcmDEnEQ9sx8LnapSU';
}

// ===== Color Palette =====
var C = {
  HEADER:     '#1B2A4A',
  SUBHEADER:  '#4A5568',
  ROW_EVEN:   '#FFFFFF',
  ROW_ODD:    '#F7FAFC',
  TEAL:       '#0D9488',
  TEAL_BG:    '#CCFBF1',
  GREEN:      '#059669',
  GREEN_BG:   '#D1FAE5',
  RED:        '#DC2626',
  RED_BG:     '#FEE2E2',
  AMBER:      '#D97706',
  AMBER_BG:   '#FEF3C7',
  MUTED:      '#6B7280',
  MUTED_BG:   '#F3F4F6',
  WHITE:      '#FFFFFF',
  DARK:       '#1F2937',
  LINK:       '#1D4ED8',
  BORDER:     '#E5E7EB',
  CARD_BG:    '#F8FAFC',
};

// ===== Sheet Order =====
var SHEET_ORDER = ['Summary', 'Users', 'User Details', 'Landlords', 'Verifications', 'Legends', 'M360', 'Conversions', 'Payments', 'Config', '_Data'];

// ============================================================================
// MAIN ENTRY POINTS
// ============================================================================

function syncAll() {
  try {
    ensureTrigger();
    var allData = fetchAllViews();
    if (!allData.users || allData.users.length === 0) {
      Logger.log('WARNING: No user data. Aborting sync.');
      return;
    }
    // Sort users by signup date descending
    allData.users.sort(function(a, b) {
      return (b.signed_up_at || '') > (a.signed_up_at || '') ? 1 : -1;
    });

    var tenantMap = {};
    try { tenantMap = fetchTenantLog(); } catch (e) {
      Logger.log('WARNING: Tenant Log fetch failed: ' + e.message);
    }
    safeWrite('Users', function() { writeUsersSheet(allData.users, tenantMap); });
    safeWrite('User Details', function() { writeUserDetailsSheet(allData.users); });
    safeWrite('Landlords', function() { writeLandlordsSheet(allData.users); });
    safeWrite('Verifications', function() { writeVerificationsSheet(allData.verifications || []); });
    safeWrite('Legends', function() { writeLegendsSheet(); });
    safeWrite('Payments', function() { writePaymentsSheet(allData.payments || []); });
    safeWrite('M360', function() { writeM360Sheet(allData.m360 || []); });

    var kpis = computeKPIs(allData.users, allData.payments || []);
    safeWrite('_Data', function() { writeDataSheet(kpis); });
    safeWrite('Conversions', function() { writeConversionsSheet(allData.users); });
    safeWrite('Summary', function() { refreshSummary(); });

    updateTimestamp();
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log('FATAL: ' + e.message + '\n' + e.stack);
  }
}

// Web app endpoint — allows triggering syncAll via HTTP GET
function doGet(e) {
  try {
    syncAll();
    return ContentService.createTextOutput(JSON.stringify({ ok: true, ts: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function runDiagnostics() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {};
  var ds = ss.getSheetByName('_Data');
  if (!ds) { result._Data = 'MISSING'; }
  else {
    result._Data = {
      maxRows: ds.getMaxRows(), maxCols: ds.getMaxColumns(), hidden: ds.isSheetHidden(),
      colD_lastRow: lastRowInCol(ds, 4), colG_lastRow: lastRowInCol(ds, 7),
      colJ_lastRow: lastRowInCol(ds, 10), colM_lastRow: lastRowInCol(ds, 13),
    };
  }
  var sm = ss.getSheetByName('Summary');
  if (!sm) { result.Summary = 'MISSING'; }
  else { result.Summary = { maxRows: sm.getMaxRows(), maxCols: sm.getMaxColumns() }; }
  return result;
}

function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu('Flent Admin', [
    { name: 'Sync Now', functionName: 'syncAll' },
    { name: 'Rebuild Charts', functionName: 'rebuildAllCharts' },
    { name: 'Setup Auto-Sync (10 min)', functionName: 'setupTrigger' },
  ]);
}

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncAll').timeBased().everyMinutes(10).create();
  Logger.log('Trigger created: syncAll every 10 minutes');
}

function ensureTrigger() {
  var has = ScriptApp.getProjectTriggers().some(function(t) {
    return t.getHandlerFunction() === 'syncAll';
  });
  if (!has) {
    ScriptApp.newTrigger('syncAll').timeBased().everyMinutes(10).create();
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

function fetchAllViews() {
  var key = getServiceKey();
  var headers = { 'apikey': key, 'Authorization': 'Bearer ' + key };
  var requests = [
    { url: SUPABASE_URL + '/rest/v1/v_user_funnel?select=*', headers: headers, muteHttpExceptions: true },
    { url: SUPABASE_URL + '/rest/v1/v_payment_detail?select=*', headers: headers, muteHttpExceptions: true },
    { url: SUPABASE_URL + '/rest/v1/v_m360_detail?select=*', headers: headers, muteHttpExceptions: true },
    { url: SUPABASE_URL + '/rest/v1/v_verification_analysis?select=*', headers: headers, muteHttpExceptions: true },
  ];
  var responses = UrlFetchApp.fetchAll(requests);
  return {
    users: parseResp(responses[0], 'v_user_funnel'),
    payments: parseResp(responses[1], 'v_payment_detail'),
    m360: parseResp(responses[2], 'v_m360_detail'),
    verifications: parseResp(responses[3], 'v_verification_analysis'),
  };
}

function parseResp(resp, name) {
  if (resp.getResponseCode() !== 200) {
    Logger.log('Fetch error ' + name + ': ' + resp.getContentText());
    return [];
  }
  return JSON.parse(resp.getContentText());
}

// ============================================================================
// HOLYGRAIL TENANT LOG — phone matching
// ============================================================================

/**
 * Normalize phone number to bare 10 digits for comparison.
 * Strips +, spaces, dashes, and leading country code 91.
 */
function normalizePhone(raw) {
  if (!raw) return '';
  var clean = String(raw).replace(/[\s\-\+\(\)]/g, '');
  // Strip leading 91 if result is 12+ digits
  if (clean.length >= 12 && clean.substring(0, 2) === '91') {
    clean = clean.substring(2);
  }
  return clean;
}

/**
 * Ensures phone has + prefix for consistent display.
 * Handles: "+91...", "91...", "9876..." → "+91..."
 */
function displayPhone(raw) {
  if (!raw) return '';
  var s = String(raw).trim();
  if (s.charAt(0) === '+') return s;
  // Bare digits — add + prefix (e.g. "919876543210" → "+919876543210")
  return '+' + s;
}

/**
 * Fetches the Tenant Log sheet from Flent Holy Grail spreadsheet.
 * Returns a map of normalized phone -> { name, status, property }
 * When a phone has multiple entries, priority: Active > Contract renewed > Room Change > Moved out > Didn't move-in
 */
function fetchTenantLog() {
  var ss = SpreadsheetApp.openById(HOLYGRAIL_ID);
  var sheet = ss.getSheetByName('Tenant Log');
  if (!sheet) {
    Logger.log('WARNING: Tenant Log sheet not found in Holygrail');
    return {};
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 4) return {};

  // Row 3 (1-indexed) is the header row; data starts at row 4
  // Col A=Name, Col E=Ph. No., Col K=Tenant Status, Col W=Property Name
  var data = sheet.getRange(4, 1, lastRow - 3, 23).getValues(); // A:W

  var statusPriority = {
    'Active': 5,
    'Contract renewed': 4,
    'Room Change': 3,
    'Room change': 3,
    'Moved out': 2,
    "Didn't move-in": 1,
  };

  var tenantMap = {};
  data.forEach(function(row) {
    var phone = normalizePhone(row[4]); // Col E (0-indexed: 4)
    if (!phone || phone.length < 10) return;
    var name = String(row[0] || '').trim();       // Col A
    var status = String(row[10] || '').trim();     // Col K
    var property = String(row[22] || '').trim();   // Col W (index 22)

    var priority = statusPriority[status] || 0;
    var existing = tenantMap[phone];
    if (!existing || priority > (statusPriority[existing.status] || 0)) {
      tenantMap[phone] = { name: name, status: status, property: property };
    }
  });

  Logger.log('Tenant Log: ' + Object.keys(tenantMap).length + ' unique phones loaded');
  return tenantMap;
}

// ============================================================================
// USERS SHEET (11 columns — clean operator view + Flent Tenant match)
// ============================================================================

function writeUsersSheet(data, tenantMap) {
  var sheet = getOrCreateSheet('Users');
  var headers = ['Phone', 'Status', 'Name', 'Rent (\u20B9)', 'Address', 'Google Maps',
                 'Security Deposit (\u20B9)', 'Sign Up', 'Risk', 'Admin Review', 'Flent Tenant'];
  var widths = [130, 110, 200, 100, 280, 100, 140, 170, 90, 120, 180];
  var mapsUrls = [];
  tenantMap = tenantMap || {};

  var rows = data.map(function(r) {
    var name = r.m360_full_name || r.name || '';
    var rent = r.monthly_rent_paise ? Math.round(r.monthly_rent_paise / 100) : '';
    var lat = r.latitude, lng = r.longitude;
    var mapsUrl = (lat && lng) ? 'https://www.google.com/maps?q=' + lat + ',' + lng : '';
    mapsUrls.push(mapsUrl);

    // Flent Tenant match — Active, Moved Out, or No
    var normalizedPhone = normalizePhone(r.phone);
    var tenant = tenantMap[normalizedPhone];
    var tenantLabel = 'No';
    if (tenant) {
      var ts = (tenant.status || '').toLowerCase();
      if (ts === 'active' || ts === 'contract renewed' || ts === 'room change') {
        tenantLabel = 'Active';
      } else {
        tenantLabel = 'Moved Out';
      }
    }

    return [
      displayPhone(r.phone),
      r.user_status || '',
      name,
      rent,
      r.property_address || '',
      mapsUrl ? 'View Map' : '',
      rent, // security deposit = rent proxy
      r.signed_up_at ? new Date(r.signed_up_at) : '',
      r.risk_level || '',
      r.admin_review || '',
      tenantLabel,
    ];
  });

  writeSheetData(sheet, headers, rows, widths);

  // Hyperlinks for Google Maps (col 6)
  for (var i = 0; i < mapsUrls.length; i++) {
    if (mapsUrls[i]) {
      var cell = sheet.getRange(i + 2, 6);
      cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText('View Map').setLinkUrl(mapsUrls[i]).build());
      cell.setFontColor(C.LINK);
    }
  }

  // Conditional formatting
  var rc = rows.length;
  if (rc > 0) {
    applyStatusColors(sheet, 2, rc, statusRules());        // Status col 2
    sheet.getRange(2, 4, rc, 1).setNumberFormat('\u20B9#,##0');  // Rent
    sheet.getRange(2, 7, rc, 1).setNumberFormat('\u20B9#,##0');  // Security Deposit
    sheet.getRange(2, 8, rc, 1).setNumberFormat('dd-MMM-yyyy h:mm AM/PM');  // Sign Up
    applyStatusColors(sheet, 9, rc, riskRules());           // Risk col 9
    applyStatusColors(sheet, 10, rc, reviewRules());        // Admin Review col 10
    // Flent Tenant col 11 — Active (green), Moved Out (amber), No (muted)
    applyStatusColors(sheet, 11, rc, tenantRules());
    // Text wrap on Address column (col 5)
    sheet.getRange(2, 5, rc, 1).setWrap(true);
  }

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
}

// ============================================================================
// USER DETAILS SHEET (~42 columns, grouped with sub-header bands)
// ============================================================================

function writeUserDetailsSheet(data) {
  var sheet = getOrCreateSheet('User Details');

  // Column groups with sub-header coloring
  var groups = [
    { label: 'User', color: C.HEADER, cols: [
      { key: 'phone', header: 'Phone' },
      { key: 'user_status', header: 'Status' },
      { key: '_name', header: 'Name' },
      { key: 'name', header: 'Input Name' },
      { key: 'role', header: 'Role' },
      { key: 'signed_up_at', header: 'Signed Up', fmt: 'datetime' },
    ]},
    { label: 'Waitlist', color: C.SUBHEADER, cols: [
      { key: 'waitlist_position', header: 'WL Position' },
      { key: 'admin_review', header: 'Admin Review' },
      { key: 'risk_level', header: 'Risk' },
    ]},
    { label: 'Agreement / Property', color: C.TEAL, cols: [
      { key: 'extraction_status', header: 'Extraction' },
      { key: 'agreement_verified', header: 'Verified', fmt: 'bool' },
      { key: 'property_address', header: 'Address' },
      { key: 'property_city', header: 'City' },
      { key: 'property_state', header: 'State' },
      { key: 'property_pincode', header: 'Pincode' },
      { key: 'monthly_rent_paise', header: 'Rent (\u20B9)', fmt: 'paise' },
      { key: 'maintenance_paise', header: 'Maint (\u20B9)', fmt: 'paise' },
      { key: '_maps', header: 'Google Maps' },
    ]},
    { label: 'Landlord', color: C.SUBHEADER, cols: [
      { key: 'landlord_display_name', header: 'Landlord Name' },
      { key: 'landlord_phone', header: 'Landlord Phone' },
      { key: 'lease_start_date', header: 'Lease Start' },
      { key: 'lease_end_date', header: 'Lease End' },
      { key: 'rent_due_day', header: 'Due Day' },
    ]},
    { label: 'Tenancy', color: C.HEADER, cols: [
      { key: 'tenancy_status', header: 'Tenancy Status' },
      { key: 'bank_verified', header: 'Bank \u2713', fmt: 'bool' },
      { key: 'utility_verified', header: 'Utility \u2713', fmt: 'bool' },
      { key: 'landlord_approved', header: 'LL Approved', fmt: 'bool' },
    ]},
    { label: 'M360 Identity', color: C.TEAL, cols: [
      { key: 'm360_status', header: 'M360 Status' },
      { key: 'm360_full_name', header: 'M360 Name' },
      { key: 'm360_credit_score', header: 'Credit Score' },
      { key: 'm360_total_income', header: 'Income' },
      { key: 'm360_occupation', header: 'Occupation' },
      { key: 'm360_age', header: 'Age' },
      { key: 'm360_gender', header: 'Gender' },
      { key: 'm360_date_of_birth', header: 'DOB' },
      { key: 'm360_aadhaar_masked', header: 'Aadhaar' },
      { key: 'm360_risk_level', header: 'M360 Risk' },
    ]},
    { label: 'Payments', color: C.SUBHEADER, cols: [
      { key: 'successful_payments', header: 'Payments Made' },
      { key: 'total_paid_paise', header: 'Total Paid (\u20B9)', fmt: 'paise' },
      { key: 'total_cashback_earned_paise', header: 'CB Earned (\u20B9)', fmt: 'paise' },
      { key: 'cashback_balance_paise', header: 'CB Balance (\u20B9)', fmt: 'paise' },
      { key: 'last_payment_at', header: 'Last Payment', fmt: 'date' },
    ]},
    { label: 'Approval', color: C.HEADER, cols: [
      { key: '_ready', header: 'Ready to Approve' },
      { key: '_missing', header: 'Missing Data' },
    ]},
  ];

  // Flatten columns
  var allCols = [];
  var groupBands = []; // {startCol, endCol, color}
  var colIdx = 1;
  groups.forEach(function(g) {
    var start = colIdx;
    g.cols.forEach(function(c) { allCols.push(c); colIdx++; });
    groupBands.push({ start: start, end: colIdx - 1, color: g.color });
  });

  var headers = allCols.map(function(c) { return c.header; });
  var mapsUrls = [];

  var rows = data.map(function(r) {
    // Compute derived fields
    var m360Name = r.m360_full_name || '';
    var displayName = m360Name || r.name || '';
    var lat = r.latitude, lng = r.longitude;
    var mapsUrl = (lat && lng) ? 'https://www.google.com/maps?q=' + lat + ',' + lng : '';
    mapsUrls.push(mapsUrl);

    // Ready to Approve logic
    var missing = [];
    if (r.extraction_status !== 'completed') missing.push('Agreement');
    if (!r.property_address) missing.push('Address');
    if (!r.landlord_display_name && !r.landlord_name) missing.push('Landlord');
    if (!r.monthly_rent_paise || r.monthly_rent_paise === 0) missing.push('Rent');
    if (!r.lease_start_date) missing.push('Lease Start');
    if (!r.lease_end_date) missing.push('Lease End');
    if (r.m360_status !== 'SUCCESS' && !r.m360_full_name) missing.push('M360 Identity');
    if (!r.property_city) missing.push('City');
    if (!r.risk_level || r.risk_level === 'PENDING') missing.push('Risk Score');
    if (!r.waitlist_position && r.waitlist_position !== 0) missing.push('Waitlist');
    var ready = missing.length === 0 ? 'YES' : 'NO';

    return allCols.map(function(c) {
      if (c.key === '_name') return displayName;
      if (c.key === '_maps') return mapsUrl ? 'View Map' : '';
      if (c.key === '_ready') return ready;
      if (c.key === '_missing') return missing.join(', ');
      var val = r[c.key];
      if (val === null || val === undefined) return '';
      if (c.key === 'phone' || c.key === 'landlord_phone') return displayPhone(val);
      if (c.fmt === 'paise') return Math.round(val / 100);
      if ((c.fmt === 'date' || c.fmt === 'datetime') && val) return new Date(val);
      if (c.fmt === 'bool') return val === true ? '\u2713' : val === false ? '\u2717' : '';
      return val;
    });
  });

  // Write data
  sheet.clearContents();
  sheet.clearFormats();
  var totalCols = headers.length;
  var rc = rows.length;

  // Sub-header band row (row 1) — color per group
  sheet.getRange(1, 1, 1, totalCols).setValues([headers])
    .setFontWeight('bold').setFontColor(C.WHITE).setFontSize(9)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 32);

  groupBands.forEach(function(b) {
    sheet.getRange(1, b.start, 1, b.end - b.start + 1).setBackground(b.color);
  });

  if (rc > 0) {
    sheet.getRange(2, 1, rc, totalCols).setValues(rows);
    applyAlternatingRows(sheet, rc, totalCols);

    // Maps hyperlinks
    var mapsColIdx = allCols.findIndex(function(c) { return c.key === '_maps'; }) + 1;
    for (var i = 0; i < mapsUrls.length; i++) {
      if (mapsUrls[i]) {
        var cell = sheet.getRange(i + 2, mapsColIdx);
        cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText('View Map').setLinkUrl(mapsUrls[i]).build());
        cell.setFontColor(C.LINK);
      }
    }

    // Ready to Approve coloring
    var readyColIdx = allCols.findIndex(function(c) { return c.key === '_ready'; }) + 1;
    if (readyColIdx > 0) {
      var readyRange = sheet.getRange(2, readyColIdx, rc, 1);
      var vals = readyRange.getValues();
      readyRange.setBackgrounds(vals.map(function(v) { return [v[0] === 'YES' ? C.GREEN_BG : C.RED_BG]; }));
      readyRange.setFontColors(vals.map(function(v) { return [v[0] === 'YES' ? C.GREEN : C.RED]; }));
      readyRange.setFontWeight('bold').setHorizontalAlignment('center');
    }

    // Bool columns coloring
    allCols.forEach(function(c, idx) {
      if (c.fmt === 'bool') {
        var range = sheet.getRange(2, idx + 1, rc, 1);
        var boolVals = range.getValues();
        range.setBackgrounds(boolVals.map(function(v) {
          return [v[0] === '\u2713' ? C.GREEN_BG : v[0] === '\u2717' ? C.RED_BG : C.ROW_EVEN];
        }));
        range.setFontColors(boolVals.map(function(v) {
          return [v[0] === '\u2713' ? C.GREEN : v[0] === '\u2717' ? C.RED : C.MUTED];
        }));
        range.setFontWeight('bold').setHorizontalAlignment('center');
      }
      if (c.fmt === 'paise') {
        sheet.getRange(2, idx + 1, rc, 1).setNumberFormat('\u20B9#,##0');
      }
      if (c.fmt === 'date') {
        sheet.getRange(2, idx + 1, rc, 1).setNumberFormat('dd-MMM-yyyy');
      }
      if (c.fmt === 'datetime') {
        sheet.getRange(2, idx + 1, rc, 1).setNumberFormat('dd-MMM-yyyy h:mm AM/PM');
      }
    });

    // Status columns
    var statusIdx = allCols.findIndex(function(c) { return c.key === 'user_status'; }) + 1;
    if (statusIdx > 0) applyStatusColors(sheet, statusIdx, rc, statusRules());
    var reviewIdx = allCols.findIndex(function(c) { return c.key === 'admin_review'; }) + 1;
    if (reviewIdx > 0) applyStatusColors(sheet, reviewIdx, rc, reviewRules());
    var riskIdx = allCols.findIndex(function(c) { return c.key === 'risk_level'; }) + 1;
    if (riskIdx > 0) applyStatusColors(sheet, riskIdx, rc, riskRules());
  }

  // Borders
  if (rc > 0) {
    sheet.getRange(1, 1, rc + 1, totalCols)
      .setBorder(null, null, true, null, null, true, C.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  }

  trimSheet(sheet, rc + 1, totalCols);

  // Hide sensitive columns
  var incomeIdx = allCols.findIndex(function(c) { return c.key === 'm360_total_income'; }) + 1;
  if (incomeIdx > 0) sheet.hideColumns(incomeIdx);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
}

// ============================================================================
// LANDLORDS SHEET
// ============================================================================

function writeLandlordsSheet(data) {
  var sheet = getOrCreateSheet('Landlords');
  var headers = ['Landlord Name', 'Landlord Phone', 'Property Address', 'City', 'State',
                 'Tenant Name', 'Tenant Phone', 'Rent (\u20B9)', 'Lease Start', 'Lease End', 'LL Approved'];
  var widths = [180, 130, 280, 100, 100, 180, 130, 100, 110, 110, 110];

  var rows = [];
  data.forEach(function(r) {
    if (!r.landlord_display_name && !r.landlord_name && !r.landlord_phone) return;
    rows.push([
      r.landlord_display_name || r.landlord_name || '',
      displayPhone(r.landlord_phone),
      r.property_address || '',
      r.property_city || '',
      r.property_state || '',
      r.m360_full_name || r.name || '',
      displayPhone(r.phone),
      r.monthly_rent_paise ? Math.round(r.monthly_rent_paise / 100) : '',
      r.lease_start_date || '',
      r.lease_end_date || '',
      r.landlord_approved === true ? '\u2713' : r.landlord_approved === false ? '\u2717' : '',
    ]);
  });

  writeSheetData(sheet, headers, rows, widths);
  var rc = rows.length;
  if (rc > 0) {
    sheet.getRange(2, 8, rc, 1).setNumberFormat('\u20B9#,##0');
    // Bool coloring for LL Approved (col 11)
    var approvedRange = sheet.getRange(2, 11, rc, 1);
    var vals = approvedRange.getValues();
    approvedRange.setBackgrounds(vals.map(function(v) {
      return [v[0] === '\u2713' ? C.GREEN_BG : v[0] === '\u2717' ? C.RED_BG : C.ROW_EVEN];
    }));
    approvedRange.setFontColors(vals.map(function(v) {
      return [v[0] === '\u2713' ? C.GREEN : v[0] === '\u2717' ? C.RED : C.MUTED];
    }));
    approvedRange.setFontWeight('bold').setHorizontalAlignment('center');
  }
  sheet.setFrozenRows(1);
}

// ============================================================================
// VERIFICATIONS SHEET (grouped sub-headers, one row per user)
// ============================================================================

function writeVerificationsSheet(data) {
  var sheet = getOrCreateSheet('Verifications');

  var groups = [
    { label: 'User', color: C.HEADER, cols: [
      { key: 'phone', header: 'Phone' },
      { key: 'full_name', header: 'Name' },
      { key: 'user_status', header: 'Status' },
    ]},
    { label: 'M360 Identity', color: '#065F46', cols: [
      { key: 'm360_status', header: 'Status' },
      { key: 'm360_attempted', header: 'Attempted', fmt: 'bool' },
      { key: 'm360_completed', header: 'Completed', fmt: 'bool' },
      { key: 'm360_failure_reason', header: 'Failure Reason' },
      { key: 'm360_created_at', header: 'Date', fmt: 'date' },
    ]},
    { label: 'Tenant Name Match', color: '#1E40AF', cols: [
      { key: 'tenant_match_score', header: 'Score' },
      { key: 'tenant_match_type', header: 'Type' },
      { key: 'tenant_match_attempted', header: 'Attempted', fmt: 'bool' },
      { key: 'tenant_match_result', header: 'Result' },
    ]},
    { label: 'Agreement', color: '#6B21A8', cols: [
      { key: 'agreement_status', header: 'Status' },
      { key: 'agreement_attempted', header: 'Attempted', fmt: 'bool' },
      { key: 'agreement_completed', header: 'Completed', fmt: 'bool' },
      { key: 'agreement_failure_reason', header: 'Failure Reason' },
      { key: 'agreement_confidence', header: 'Confidence' },
    ]},
    { label: 'Bank Verification', color: '#92400E', cols: [
      { key: 'bank_penny_drop_status', header: 'Penny Drop' },
      { key: 'bank_attempted', header: 'Attempted', fmt: 'bool' },
      { key: 'bank_verified', header: 'Verified', fmt: 'bool' },
      { key: 'bank_failure_reason', header: 'Failure Reason' },
      { key: 'bank_agreement_name_match', header: 'Name Match', fmt: 'bool' },
    ]},
    { label: 'PAN Verification', color: '#831843', cols: [
      { key: 'pan_verified', header: 'Verified', fmt: 'bool' },
      { key: 'pan_attempted', header: 'Attempted', fmt: 'bool' },
      { key: 'pan_status', header: 'Status' },
    ]},
    { label: 'Utility Verification', color: '#164E63', cols: [
      { key: 'utility_status', header: 'Status' },
      { key: 'utility_attempted', header: 'Attempted', fmt: 'bool' },
      { key: 'utility_verified', header: 'Verified', fmt: 'bool' },
      { key: 'utility_name_match', header: 'Name Match', fmt: 'bool' },
      { key: 'utility_address_match', header: 'Addr Match', fmt: 'bool' },
    ]},
    { label: 'Landlord Approval', color: '#78350F', cols: [
      { key: 'landlord_status', header: 'Status' },
      { key: 'landlord_approved', header: 'Approved', fmt: 'bool' },
      { key: 'landlord_phone', header: 'Phone' },
      { key: 'landlord_response_at', header: 'Response Date', fmt: 'date' },
    ]},
    { label: 'Risk', color: '#7C2D12', cols: [
      { key: 'risk_level', header: 'Level' },
      { key: 'risk_factors', header: 'Factors' },
      { key: 'admin_review', header: 'Admin Review' },
    ]},
    { label: 'Overall', color: C.HEADER, cols: [
      { key: 'checks_passed', header: 'Passed' },
      { key: 'checks_total', header: 'Total' },
    ]},
  ];

  // Flatten columns + build group bands
  var allCols = [];
  var groupBands = [];
  var colIdx = 1;
  groups.forEach(function(g) {
    var start = colIdx;
    g.cols.forEach(function(c) { allCols.push(c); colIdx++; });
    groupBands.push({ start: start, end: colIdx - 1, color: g.color, label: g.label });
  });

  var headers = allCols.map(function(c) { return c.header; });
  var totalCols = headers.length;

  var rows = data.map(function(r) {
    return allCols.map(function(c) {
      var val = r[c.key];
      if (val === null || val === undefined) return '';
      if (c.key === 'phone' || c.key === 'landlord_phone') return displayPhone(val);
      if (c.key === 'risk_factors' && typeof val === 'object') {
        if (Array.isArray(val)) return val.map(function(f) { return f.signal || f; }).join(', ');
        return JSON.stringify(val);
      }
      if (c.fmt === 'bool') return val === true ? '\u2713' : val === false ? '\u2717' : '';
      if ((c.fmt === 'date' || c.fmt === 'datetime') && val) return new Date(val);
      if (c.key === 'agreement_confidence' && val) return Math.round(Number(val));
      return val;
    });
  });

  // Write data
  sheet.clearContents();
  sheet.clearFormats();
  var rc = rows.length;

  // Row 1: group band sub-headers
  var groupRow = [];
  for (var i = 0; i < totalCols; i++) groupRow.push('');
  groupBands.forEach(function(b) { groupRow[b.start - 1] = b.label; });
  sheet.getRange(1, 1, 1, totalCols).setValues([groupRow])
    .setFontWeight('bold').setFontColor(C.WHITE).setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 28);
  groupBands.forEach(function(b) {
    var range = sheet.getRange(1, b.start, 1, b.end - b.start + 1);
    range.setBackground(b.color);
    if (b.end - b.start > 0) range.merge();
  });

  // Row 2: column headers
  sheet.getRange(2, 1, 1, totalCols).setValues([headers])
    .setFontWeight('bold').setFontColor(C.WHITE).setFontSize(9)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(2, 30);
  groupBands.forEach(function(b) {
    sheet.getRange(2, b.start, 1, b.end - b.start + 1).setBackground(b.color);
  });

  if (rc > 0) {
    sheet.getRange(3, 1, rc, totalCols).setValues(rows)
      .setFontSize(10).setFontColor(C.DARK).setVerticalAlignment('middle');

    // Alternating rows (starting from row 3)
    var bgs = [];
    for (var r = 0; r < rc; r++) {
      var color = r % 2 === 0 ? C.ROW_EVEN : C.ROW_ODD;
      var row = [];
      for (var c = 0; c < totalCols; c++) row.push(color);
      bgs.push(row);
    }
    sheet.getRange(3, 1, rc, totalCols).setBackgrounds(bgs);

    // Bool column coloring
    allCols.forEach(function(col, idx) {
      if (col.fmt === 'bool') {
        var range = sheet.getRange(3, idx + 1, rc, 1);
        var vals = range.getValues();
        range.setBackgrounds(vals.map(function(v) {
          return [v[0] === '\u2713' ? C.GREEN_BG : v[0] === '\u2717' ? C.RED_BG : C.ROW_EVEN];
        }));
        range.setFontColors(vals.map(function(v) {
          return [v[0] === '\u2713' ? C.GREEN : v[0] === '\u2717' ? C.RED : C.MUTED];
        }));
        range.setFontWeight('bold').setHorizontalAlignment('center');
      }
      if (col.fmt === 'date') {
        sheet.getRange(3, idx + 1, rc, 1).setNumberFormat('dd-MMM-yyyy');
      }
    });

    // Status coloring — User Status
    var userStatusIdx = allCols.findIndex(function(c) { return c.key === 'user_status'; }) + 1;
    if (userStatusIdx > 0) applyStatusColorsOffset(sheet, userStatusIdx, 3, rc, statusRules());

    // M360 Status
    var m360Idx = allCols.findIndex(function(c) { return c.key === 'm360_status'; }) + 1;
    if (m360Idx > 0) applyStatusColorsOffset(sheet, m360Idx, 3, rc, m360StatusRules());

    // Tenant Match Result
    var matchIdx = allCols.findIndex(function(c) { return c.key === 'tenant_match_result'; }) + 1;
    if (matchIdx > 0) applyStatusColorsOffset(sheet, matchIdx, 3, rc, passFailRules());

    // Agreement Status
    var agreeIdx = allCols.findIndex(function(c) { return c.key === 'agreement_status'; }) + 1;
    if (agreeIdx > 0) applyStatusColorsOffset(sheet, agreeIdx, 3, rc, extractionStatusRules());

    // Bank Penny Drop
    var bankIdx = allCols.findIndex(function(c) { return c.key === 'bank_penny_drop_status'; }) + 1;
    if (bankIdx > 0) applyStatusColorsOffset(sheet, bankIdx, 3, rc, pennyDropRules());

    // PAN Status
    var panIdx = allCols.findIndex(function(c) { return c.key === 'pan_status'; }) + 1;
    if (panIdx > 0) applyStatusColorsOffset(sheet, panIdx, 3, rc, panStatusRules());

    // Utility Status
    var utilIdx = allCols.findIndex(function(c) { return c.key === 'utility_status'; }) + 1;
    if (utilIdx > 0) applyStatusColorsOffset(sheet, utilIdx, 3, rc, utilityStatusRules());

    // Landlord Status
    var llIdx = allCols.findIndex(function(c) { return c.key === 'landlord_status'; }) + 1;
    if (llIdx > 0) applyStatusColorsOffset(sheet, llIdx, 3, rc, landlordStatusRules());

    // Risk Level
    var riskIdx = allCols.findIndex(function(c) { return c.key === 'risk_level'; }) + 1;
    if (riskIdx > 0) applyStatusColorsOffset(sheet, riskIdx, 3, rc, riskRules());

    // Admin Review
    var revIdx = allCols.findIndex(function(c) { return c.key === 'admin_review'; }) + 1;
    if (revIdx > 0) applyStatusColorsOffset(sheet, revIdx, 3, rc, reviewRules());

    // Overall — color the Passed column based on count
    var passedIdx = allCols.findIndex(function(c) { return c.key === 'checks_passed'; }) + 1;
    if (passedIdx > 0) {
      var passedRange = sheet.getRange(3, passedIdx, rc, 1);
      var passedVals = passedRange.getValues();
      passedRange.setBackgrounds(passedVals.map(function(v) {
        var n = Number(v[0]);
        if (n >= 6) return [C.GREEN_BG];
        if (n >= 3) return [C.AMBER_BG];
        if (n >= 1) return [C.RED_BG];
        return [C.MUTED_BG];
      }));
      passedRange.setFontColors(passedVals.map(function(v) {
        var n = Number(v[0]);
        if (n >= 6) return [C.GREEN];
        if (n >= 3) return [C.AMBER];
        if (n >= 1) return [C.RED];
        return [C.MUTED];
      }));
      passedRange.setFontWeight('bold').setHorizontalAlignment('center');
    }

    // Tenant match score — color green (>=70) or red (<70)
    var scoreIdx = allCols.findIndex(function(c) { return c.key === 'tenant_match_score'; }) + 1;
    if (scoreIdx > 0) {
      var scoreRange = sheet.getRange(3, scoreIdx, rc, 1);
      var scoreVals = scoreRange.getValues();
      scoreRange.setFontColors(scoreVals.map(function(v) {
        if (v[0] === '' || v[0] === null) return [C.MUTED];
        return [Number(v[0]) >= 70 ? C.GREEN : C.RED];
      }));
      scoreRange.setFontWeight('bold').setHorizontalAlignment('center');
    }

    // Borders
    sheet.getRange(1, 1, rc + 2, totalCols)
      .setBorder(null, null, true, null, null, true, C.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    // Group separator borders (thicker vertical lines between groups)
    groupBands.forEach(function(b) {
      sheet.getRange(1, b.start, rc + 2, 1)
        .setBorder(null, true, null, null, null, null, C.SUBHEADER, SpreadsheetApp.BorderStyle.SOLID);
    });
  }

  // Column widths
  var widths = [];
  allCols.forEach(function(c) {
    if (c.key === 'phone' || c.key === 'landlord_phone') widths.push(130);
    else if (c.key === 'full_name') widths.push(180);
    else if (c.header === 'Failure Reason' || c.key === 'risk_factors') widths.push(200);
    else if (c.key === 'tenant_match_type') widths.push(90);
    else widths.push(100);
  });
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  trimSheet(sheet, rc + 2, totalCols);
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(2);
}

/**
 * Like applyStatusColors but starts from a custom row offset (for sheets with 2-row headers).
 */
function applyStatusColorsOffset(sheet, colNum, startRow, rowCount, rules) {
  var range = sheet.getRange(startRow, colNum, rowCount, 1);
  var vals = range.getValues();
  var bgs = vals.map(function(v) {
    var key = String(v[0]).toLowerCase();
    var r = rules[key] || rules[String(v[0])];
    return [r ? r.bg : null];
  });
  var fcs = vals.map(function(v) {
    var key = String(v[0]).toLowerCase();
    var r = rules[key] || rules[String(v[0])];
    return [r ? r.fg : null];
  });
  var currentBgs = range.getBackgrounds();
  var currentFcs = range.getFontColors();
  var finalBgs = bgs.map(function(b, i) { return [b[0] || currentBgs[i][0]]; });
  var finalFcs = fcs.map(function(f, i) { return [f[0] || currentFcs[i][0]]; });
  range.setBackgrounds(finalBgs);
  range.setFontColors(finalFcs);
  range.setFontWeight('bold').setHorizontalAlignment('center');
}

// ── Verification-specific status rules ──

function m360StatusRules() {
  return {
    'success': { bg: C.GREEN_BG, fg: C.GREEN },
    'SUCCESS': { bg: C.GREEN_BG, fg: C.GREEN },
    'failed': { bg: C.RED_BG, fg: C.RED },
    'FAILED': { bg: C.RED_BG, fg: C.RED },
    'pending': { bg: C.AMBER_BG, fg: C.AMBER },
    'PENDING': { bg: C.AMBER_BG, fg: C.AMBER },
    'otp_sent': { bg: C.AMBER_BG, fg: C.AMBER },
    'OTP_SENT': { bg: C.AMBER_BG, fg: C.AMBER },
    'otp_expired': { bg: C.RED_BG, fg: C.RED },
    'OTP_EXPIRED': { bg: C.RED_BG, fg: C.RED },
    'otp_invalid': { bg: C.RED_BG, fg: C.RED },
    'OTP_INVALID': { bg: C.RED_BG, fg: C.RED },
    'consent_given': { bg: C.AMBER_BG, fg: C.AMBER },
    'CONSENT_GIVEN': { bg: C.AMBER_BG, fg: C.AMBER },
    'details_not_found': { bg: C.RED_BG, fg: C.RED },
    'DETAILS_NOT_FOUND': { bg: C.RED_BG, fg: C.RED },
  };
}

function passFailRules() {
  return {
    'pass': { bg: C.GREEN_BG, fg: C.GREEN },
    'PASS': { bg: C.GREEN_BG, fg: C.GREEN },
    'fail': { bg: C.RED_BG, fg: C.RED },
    'FAIL': { bg: C.RED_BG, fg: C.RED },
  };
}

function extractionStatusRules() {
  return {
    'completed': { bg: C.GREEN_BG, fg: C.GREEN },
    'failed': { bg: C.RED_BG, fg: C.RED },
    'pending': { bg: C.AMBER_BG, fg: C.AMBER },
    'processing': { bg: C.AMBER_BG, fg: C.AMBER },
    'manual_review': { bg: C.AMBER_BG, fg: C.AMBER },
  };
}

function pennyDropRules() {
  return {
    'success': { bg: C.GREEN_BG, fg: C.GREEN },
    'SUCCESS': { bg: C.GREEN_BG, fg: C.GREEN },
    'failed': { bg: C.RED_BG, fg: C.RED },
    'FAILED': { bg: C.RED_BG, fg: C.RED },
    'pending': { bg: C.AMBER_BG, fg: C.AMBER },
    'PENDING': { bg: C.AMBER_BG, fg: C.AMBER },
  };
}

function panStatusRules() {
  return {
    'verified': { bg: C.GREEN_BG, fg: C.GREEN },
    'Verified': { bg: C.GREEN_BG, fg: C.GREEN },
    'attempted \u2014 not verified': { bg: C.AMBER_BG, fg: C.AMBER },
    'Attempted \u2014 not verified': { bg: C.AMBER_BG, fg: C.AMBER },
    'not attempted': { bg: C.MUTED_BG, fg: C.MUTED },
    'Not attempted': { bg: C.MUTED_BG, fg: C.MUTED },
  };
}

function utilityStatusRules() {
  return {
    'success': { bg: C.GREEN_BG, fg: C.GREEN },
    'failed': { bg: C.RED_BG, fg: C.RED },
    'pending': { bg: C.AMBER_BG, fg: C.AMBER },
    'not_found': { bg: C.RED_BG, fg: C.RED },
  };
}

function landlordStatusRules() {
  return {
    'verified': { bg: C.GREEN_BG, fg: C.GREEN },
    'declined': { bg: C.RED_BG, fg: C.RED },
    'invited': { bg: C.AMBER_BG, fg: C.AMBER },
    'none': { bg: C.MUTED_BG, fg: C.MUTED },
  };
}

// ============================================================================
// LEGENDS SHEET (status codes and color meanings)
// ============================================================================

function writeLegendsSheet() {
  var sheet = getOrCreateSheet('Legends');
  sheet.clearContents();
  sheet.clearFormats();
  sheet.setHiddenGridlines(true);

  // Badge colors: darker bg with white text for readability
  var BADGE = {
    green:  { bg: '#059669', fg: '#FFFFFF' },  // dark green bg, white text
    amber:  { bg: '#D97706', fg: '#FFFFFF' },  // dark amber bg, white text
    red:    { bg: '#DC2626', fg: '#FFFFFF' },  // dark red bg, white text
    muted:  { bg: '#9CA3AF', fg: '#FFFFFF' },  // grey bg, white text
  };

  var sections = [
    { title: 'User Status', sheet: 'Users / User Details', items: [
      { value: 'signed_up', label: 'Signed Up', desc: 'User registered but not yet onboarded', badge: BADGE.muted },
      { value: 'waitlisted', label: 'Waitlisted', desc: 'Pending admin review in waitlist queue', badge: BADGE.amber },
      { value: 'approved', label: 'Approved', desc: 'Admin approved, can proceed to payment', badge: BADGE.green },
      { value: 'active', label: 'Active', desc: 'Completed first payment, fully onboarded', badge: BADGE.green },
      { value: 'not_eligible', label: 'Not Eligible', desc: 'Rejected or ineligible for service', badge: BADGE.red },
    ]},
    { title: 'Admin Review', sheet: 'Users / User Details', items: [
      { value: 'due', label: 'Due', desc: 'Not yet reviewed by admin', badge: BADGE.amber },
      { value: 'approved', label: 'Approved', desc: 'Admin approved the application', badge: BADGE.green },
      { value: 'rejected', label: 'Rejected', desc: 'Admin rejected the application', badge: BADGE.red },
    ]},
    { title: 'Risk Level', sheet: 'Users / Verifications', items: [
      { value: 'LOW', label: 'Low', desc: 'Low risk \u2014 clear signals, safe profile', badge: BADGE.green },
      { value: 'MEDIUM', label: 'Medium', desc: 'Moderate risk \u2014 some signals need review', badge: BADGE.amber },
      { value: 'HIGH', label: 'High', desc: 'High risk \u2014 multiple red flags detected', badge: BADGE.red },
      { value: 'PENDING', label: 'Pending', desc: 'Risk not yet computed', badge: BADGE.muted },
    ]},
    { title: 'M360 Identity Verification', sheet: 'Verifications / M360', items: [
      { value: 'SUCCESS', label: 'Success', desc: 'OTP verified, identity data retrieved from Cashfree', badge: BADGE.green },
      { value: 'CONSENT_GIVEN', label: 'Consent Given', desc: 'User consented but OTP not yet sent/verified', badge: BADGE.amber },
      { value: 'OTP_SENT', label: 'OTP Sent', desc: 'OTP dispatched, awaiting user input', badge: BADGE.amber },
      { value: 'PENDING', label: 'Pending', desc: 'Verification initiated but not completed', badge: BADGE.amber },
      { value: 'FAILED', label: 'Failed', desc: 'Verification failed (API error or invalid data)', badge: BADGE.red },
      { value: 'OTP_EXPIRED', label: 'OTP Expired', desc: 'OTP timed out before verification', badge: BADGE.red },
      { value: 'OTP_INVALID', label: 'OTP Invalid', desc: 'Wrong OTP entered', badge: BADGE.red },
      { value: 'DETAILS_NOT_FOUND', label: 'Not Found', desc: 'No identity data found for this number', badge: BADGE.red },
    ]},
    { title: 'Tenant Name Match', sheet: 'Verifications', items: [
      { value: 'PASS', label: 'Pass (\u2265 70)', desc: 'M360 name matches agreement tenant name', badge: BADGE.green },
      { value: 'FAIL', label: 'Fail (< 70)', desc: 'Names do not sufficiently match', badge: BADGE.red },
      { value: '\u2014', label: 'Not Attempted', desc: 'M360 or agreement data not yet available', badge: BADGE.muted },
    ]},
    { title: 'Agreement Extraction', sheet: 'Verifications / User Details', items: [
      { value: 'completed', label: 'Completed', desc: 'Document parsed, all fields extracted', badge: BADGE.green },
      { value: 'processing', label: 'Processing', desc: 'Document is being parsed by Gemini AI', badge: BADGE.amber },
      { value: 'pending', label: 'Pending', desc: 'Document uploaded, extraction not started', badge: BADGE.amber },
      { value: 'manual_review', label: 'Manual Review', desc: 'Low confidence \u2014 needs human review', badge: BADGE.amber },
      { value: 'failed', label: 'Failed', desc: 'Extraction failed (unreadable or invalid document)', badge: BADGE.red },
    ]},
    { title: 'Bank Penny Drop', sheet: 'Verifications', items: [
      { value: 'SUCCESS', label: 'Success', desc: '\u20B91 deposited and verified via Cashfree', badge: BADGE.green },
      { value: 'PENDING', label: 'Pending', desc: 'Penny drop initiated, awaiting confirmation', badge: BADGE.amber },
      { value: 'FAILED', label: 'Failed', desc: 'Bank rejected the transaction', badge: BADGE.red },
    ]},
    { title: 'PAN Verification', sheet: 'Verifications', items: [
      { value: 'Verified', label: 'Verified', desc: 'PAN validated and name matched', badge: BADGE.green },
      { value: 'Attempted', label: 'Attempted', desc: 'PAN submitted but not yet verified', badge: BADGE.amber },
      { value: 'Not attempted', label: 'Not Attempted', desc: 'User has not submitted PAN', badge: BADGE.muted },
    ]},
    { title: 'Utility Verification', sheet: 'Verifications', items: [
      { value: 'success', label: 'Success', desc: 'Bill fetched, name & address verified', badge: BADGE.green },
      { value: 'pending', label: 'Pending', desc: 'Verification in progress', badge: BADGE.amber },
      { value: 'failed', label: 'Failed', desc: 'Could not fetch or verify bill', badge: BADGE.red },
      { value: 'not_found', label: 'Not Found', desc: 'Consumer number not found at provider', badge: BADGE.red },
    ]},
    { title: 'Landlord Approval', sheet: 'Verifications / Landlords', items: [
      { value: 'verified', label: 'Verified', desc: 'Landlord confirmed the tenancy', badge: BADGE.green },
      { value: 'invited', label: 'Invited', desc: 'Invitation sent, awaiting response', badge: BADGE.amber },
      { value: 'declined', label: 'Declined', desc: 'Landlord rejected the tenancy claim', badge: BADGE.red },
      { value: 'none', label: 'None', desc: 'No invitation sent yet', badge: BADGE.muted },
    ]},
    { title: 'Overall Checks (X / 6)', sheet: 'Verifications', items: [
      { value: '6/6', label: 'All Passed', desc: 'All 6 verification checks passed', badge: BADGE.green },
      { value: '3\u20135/6', label: 'Partial', desc: 'Some checks passed, some pending or failed', badge: BADGE.amber },
      { value: '1\u20132/6', label: 'Few', desc: 'Most checks not passed', badge: BADGE.red },
      { value: '0/6', label: 'None', desc: 'No verification checks passed', badge: BADGE.muted },
    ]},
    { title: 'Boolean Symbols', sheet: 'All Sheets', items: [
      { value: '\u2713', label: 'Checkmark', desc: 'Condition is true / passed / verified', badge: BADGE.green },
      { value: '\u2717', label: 'Cross', desc: 'Condition is false / failed / not verified', badge: BADGE.red },
    ]},
  ];

  var row = 1;

  // ── Title ──
  sheet.getRange(row, 1, 1, 4).merge().setValue('LEGENDS & STATUS CODES')
    .setBackground(C.HEADER).setFontColor(C.WHITE).setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(row, 48);
  row++;

  sheet.getRange(row, 1, 1, 4).merge()
    .setValue('Color codes and status meanings used across all dashboard sheets')
    .setFontColor(C.MUTED).setFontSize(10).setHorizontalAlignment('center')
    .setBackground(C.ROW_ODD);
  sheet.setRowHeight(row, 28);
  row++;

  // ── Sections ──
  sections.forEach(function(section) {
    // Spacer row
    sheet.setRowHeight(row, 12);
    sheet.getRange(row, 1, 1, 4).setBackground(C.WHITE);
    row++;

    // Section header
    sheet.getRange(row, 1, 1, 3).merge().setValue('  ' + section.title)
      .setBackground(C.HEADER).setFontColor(C.WHITE).setFontSize(11).setFontWeight('bold')
      .setVerticalAlignment('middle');
    sheet.getRange(row, 4).setValue(section.sheet)
      .setBackground(C.HEADER).setFontColor('#94A3B8').setFontSize(9)
      .setHorizontalAlignment('right').setVerticalAlignment('middle');
    sheet.setRowHeight(row, 32);
    row++;

    // Column sub-header
    sheet.getRange(row, 1, 1, 4)
      .setValues([['Status Badge', 'DB Value', 'Description', 'Used In']])
      .setBackground('#E2E8F0').setFontColor(C.SUBHEADER).setFontWeight('bold')
      .setFontSize(9).setVerticalAlignment('middle');
    sheet.setRowHeight(row, 24);
    row++;

    // Items
    section.items.forEach(function(item, idx) {
      var rowBg = idx % 2 === 0 ? C.ROW_EVEN : C.ROW_ODD;

      // Col 1: Badge (colored bg with white text)
      sheet.getRange(row, 1).setValue('  ' + item.label)
        .setBackground(item.badge.bg).setFontColor(item.badge.fg)
        .setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle');

      // Col 2: Raw value (monospace-style)
      sheet.getRange(row, 2).setValue(item.value)
        .setBackground(rowBg).setFontColor(C.DARK).setFontSize(10)
        .setVerticalAlignment('middle').setFontFamily('Roboto Mono');

      // Col 3: Description
      sheet.getRange(row, 3).setValue(item.desc)
        .setBackground(rowBg).setFontColor(C.DARK).setFontSize(10)
        .setVerticalAlignment('middle');

      // Col 4: empty (clean)
      sheet.getRange(row, 4).setValue('')
        .setBackground(rowBg);

      sheet.setRowHeight(row, 28);
      row++;
    });
  });

  // ── Column widths ──
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 420);
  sheet.setColumnWidth(4, 10); // minimal — keeps sheet tight

  // ── Trim + freeze ──
  trimSheet(sheet, row - 1, 4);
  sheet.setFrozenRows(2);
}

// ============================================================================
// M360 SHEET
// ============================================================================

function writeM360Sheet(data) {
  var sheet = getOrCreateSheet('M360');
  var cols = [
    { key: 'user_phone', header: 'Phone' },
    { key: 'user_name', header: 'User Name' },
    { key: 'user_status', header: 'User Status' },
    { key: 'm360_status', header: 'M360 Status' },
    { key: 'consent_phone', header: 'Consent Phone' },
    { key: 'm360_full_name', header: 'M360 Name' },
    { key: 'm360_gender', header: 'Gender' },
    { key: 'm360_date_of_birth', header: 'DOB' },
    { key: 'm360_age', header: 'Age' },
    { key: 'm360_occupation', header: 'Occupation' },
    { key: 'm360_total_income', header: 'Income' },
    { key: 'm360_aadhaar_masked', header: 'Aadhaar' },
    { key: 'm360_credit_score', header: 'Credit Score' },
    { key: 'risk_level', header: 'Risk Level' },
    { key: 'risk_safe', header: 'Risk Safe' },
    { key: 'risk_reason', header: 'Risk Reason' },
    { key: 'mobile_provider', header: 'Mobile Provider' },
    { key: 'connection_type', header: 'Connection' },
    { key: 'phone_valid', header: 'Phone Valid' },
    { key: 'otp_attempts', header: 'OTP Attempts' },
    { key: 'verified_at', header: 'Verified At', fmt: 'date' },
    { key: 'created_at', header: 'Created At', fmt: 'date' },
  ];
  var headers = cols.map(function(c) { return c.header; });
  var rows = data.map(function(r) {
    return cols.map(function(c) {
      var val = r[c.key];
      if (val === null || val === undefined) return '';
      if ((c.fmt === 'date' || c.fmt === 'datetime') && val) return new Date(val);
      return val;
    });
  });

  writeSheetData(sheet, headers, rows);
  var rc = rows.length;
  if (rc > 0) {
    // M360 Status coloring (col 4)
    applyStatusColors(sheet, 4, rc, {
      'SUCCESS': { bg: C.GREEN_BG, fg: C.GREEN },
      'CONSENT_GIVEN': { bg: C.AMBER_BG, fg: C.AMBER },
      'OTP_GENERATED': { bg: C.AMBER_BG, fg: C.AMBER },
      'VERIFICATION_FAILED': { bg: C.RED_BG, fg: C.RED },
    });
    // Risk Level (col 14)
    applyStatusColors(sheet, 14, rc, riskRules());
    // Date columns
    cols.forEach(function(c, idx) {
      if (c.fmt === 'date') sheet.getRange(2, idx + 1, rc, 1).setNumberFormat('dd-MMM-yyyy');
    });
  }
  sheet.setFrozenRows(1);
  sheet.hideSheet();
}

// ============================================================================
// PAYMENTS SHEET
// ============================================================================

function writePaymentsSheet(data) {
  var sheet = getOrCreateSheet('Payments');
  var cols = [
    { key: 'user_phone', header: 'Phone' },
    { key: 'user_name', header: 'Name' },
    { key: 'payment_month', header: 'Month' },
    { key: 'due_date', header: 'Due Date' },
    { key: 'payment_status', header: 'Status' },
    { key: 'payment_method', header: 'Method' },
    { key: 'rent_amount_paise', header: 'Rent (\u20B9)', fmt: 'paise' },
    { key: 'total_amount_paise', header: 'Total (\u20B9)', fmt: 'paise' },
    { key: 'cashback_applied_paise', header: 'CB Applied (\u20B9)', fmt: 'paise' },
    { key: 'cashback_earned_paise', header: 'CB Earned (\u20B9)', fmt: 'paise' },
    { key: 'pg_fee_paise', header: 'PG Fee (\u20B9)', fmt: 'paise' },
    { key: 'payu_txn_id', header: 'PayU Txn' },
    { key: 'payu_mihpayid', header: 'PayU ID' },
    { key: 'initiated_at', header: 'Initiated', fmt: 'date' },
    { key: 'paid_at', header: 'Paid At', fmt: 'date' },
    { key: 'settlement_status', header: 'Settlement' },
    { key: 'settled_at', header: 'Settled At', fmt: 'date' },
    { key: 'property_address', header: 'Property' },
    { key: 'property_city', header: 'City' },
    { key: 'landlord_name', header: 'Landlord' },
    { key: 'tenancy_rent_paise', header: 'Agreed Rent (\u20B9)', fmt: 'paise' },
  ];
  var headers = cols.map(function(c) { return c.header; });
  var rows = data.map(function(r) {
    return cols.map(function(c) {
      var val = r[c.key];
      if (val === null || val === undefined) return '';
      if (c.fmt === 'paise') return Math.round(val / 100);
      if ((c.fmt === 'date' || c.fmt === 'datetime') && val) return new Date(val);
      return val;
    });
  });

  writeSheetData(sheet, headers, rows);
  var rc = rows.length;
  if (rc > 0) {
    // Payment Status (col 5)
    applyStatusColors(sheet, 5, rc, {
      'completed': { bg: C.GREEN_BG, fg: C.GREEN },
      'success': { bg: C.GREEN_BG, fg: C.GREEN },
      'pending': { bg: C.AMBER_BG, fg: C.AMBER },
      'initiated': { bg: C.AMBER_BG, fg: C.AMBER },
      'failed': { bg: C.RED_BG, fg: C.RED },
    });
    // Currency and date formatting
    cols.forEach(function(c, idx) {
      if (c.fmt === 'paise') sheet.getRange(2, idx + 1, rc, 1).setNumberFormat('\u20B9#,##0');
      if (c.fmt === 'date') sheet.getRange(2, idx + 1, rc, 1).setNumberFormat('dd-MMM-yyyy');
    });
  }
  sheet.setFrozenRows(1);
}

// ============================================================================
// CONVERSIONS SHEET (weekly cohort + chart)
// ============================================================================

function writeConversionsSheet(data) {
  var sheet = getOrCreateSheet('Conversions');
  var weeks = {};
  data.forEach(function(r) {
    if (!r.signed_up_at) return;
    var wk = getWeekKey(new Date(r.signed_up_at));
    if (!weeks[wk]) weeks[wk] = { signups: 0, uploaded: 0, verified: 0, approved: 0, paid: 0 };
    weeks[wk].signups++;
    if (r.extraction_status === 'completed') weeks[wk].uploaded++;
    if (r.agreement_verified === true) weeks[wk].verified++;
    if (r.admin_review === 'approved') weeks[wk].approved++;
    if (r.successful_payments > 0) weeks[wk].paid++;
  });

  var headers = ['Week', 'Signups', 'Uploaded', 'Upload %', 'Verified', 'Verify %',
                 'Approved', 'Approve %', 'Paid', 'Payment %'];
  var sorted = Object.keys(weeks).sort().reverse();
  var rows = sorted.map(function(k) {
    var d = weeks[k];
    var s = d.signups || 1;
    return [k, d.signups, d.uploaded, d.uploaded / s, d.verified, d.verified / s,
            d.approved, d.approved / s, d.paid, d.paid / s];
  });

  writeSheetData(sheet, headers, rows, [90, 80, 80, 80, 80, 80, 80, 80, 80, 80]);
  var rc = rows.length;
  if (rc > 0) {
    // Format percentage columns (4, 6, 8, 10) as actual percentages
    [4, 6, 8, 10].forEach(function(col) {
      sheet.getRange(2, col, rc, 1).setNumberFormat('0.0%');
    });
  }

  // Embedded chart
  sheet.getCharts().forEach(function(ch) { sheet.removeChart(ch); });
  if (rc >= 2) {
    var lastRow = rc + 1;
    var chart = sheet.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(sheet.getRange('A1:A' + lastRow))
      .addRange(sheet.getRange('D1:D' + lastRow))
      .addRange(sheet.getRange('F1:F' + lastRow))
      .addRange(sheet.getRange('H1:H' + lastRow))
      .addRange(sheet.getRange('J1:J' + lastRow))
      .setOption('title', 'Conversion Rates by Week')
      .setOption('titleTextStyle', { color: C.HEADER, fontSize: 13, bold: true })
      .setOption('colors', [C.TEAL, '#3B82F6', C.GREEN, C.AMBER])
      .setOption('curveType', 'function')
      .setOption('pointSize', 5)
      .setOption('legend', { position: 'top', textStyle: { fontSize: 10 } })
      .setOption('vAxis', { format: '#%', textStyle: { fontSize: 10 } })
      .setOption('hAxis', { slantedText: true, textStyle: { fontSize: 9 } })
      .setOption('chartArea', { left: 60, top: 50, width: '80%', height: '65%' })
      .setOption('backgroundColor', { fill: 'transparent' })
      .setOption('width', 900)
      .setOption('height', 350)
      .setPosition(rc + 3, 1, 0, 0)
      .build();
    sheet.insertChart(chart);
  }

  // Keep extra rows for the chart area (chart sits at rc+3, needs ~20 rows for rendering)
  trimSheet(sheet, rc + 25, 10);
  sheet.setFrozenRows(1);
}

// ============================================================================
// KPI COMPUTATION
// ============================================================================

function computeKPIs(users, payments) {
  var total = users.length;
  var byStatus = {};
  var approved = 0, pending = 0, paid = 0;
  var totalRevenue = 0, rentSum = 0, rentCount = 0, totalCashback = 0;
  var creditSum = 0, creditCount = 0;
  var riskDist = { Low: 0, Medium: 0, High: 0, Pending: 0 };
  var funnel = { 'Signed Up': total, 'Uploaded': 0, 'Verified': 0, 'Approved': 0, 'Paid': 0 };
  var weeklySignups = {};

  users.forEach(function(u) {
    var st = u.user_status || 'unknown';
    byStatus[st] = (byStatus[st] || 0) + 1;

    if (u.admin_review === 'approved') approved++;
    if (!u.admin_review || u.admin_review === 'pending') pending++;
    if (u.successful_payments > 0) paid++;

    totalRevenue += (u.total_paid_paise || 0);
    if (u.monthly_rent_paise) { rentSum += u.monthly_rent_paise; rentCount++; }
    totalCashback += (u.total_cashback_earned_paise || 0);
    if (u.m360_credit_score) { creditSum += u.m360_credit_score; creditCount++; }

    var risk = (u.risk_level || 'PENDING').toUpperCase();
    if (risk === 'LOW') riskDist.Low++;
    else if (risk === 'MEDIUM') riskDist.Medium++;
    else if (risk === 'HIGH') riskDist.High++;
    else riskDist.Pending++;

    if (u.extraction_status === 'completed') funnel['Uploaded']++;
    if (u.agreement_verified === true) funnel['Verified']++;
    if (u.admin_review === 'approved') funnel['Approved']++;
    if (u.successful_payments > 0) funnel['Paid']++;

    if (u.signed_up_at) {
      var wk = getWeekKey(new Date(u.signed_up_at));
      weeklySignups[wk] = (weeklySignups[wk] || 0) + 1;
    }
  });

  return {
    total: total,
    approved: approved,
    pending: pending,
    paid: paid,
    totalRevenue: Math.round(totalRevenue / 100),
    avgRent: rentCount ? Math.round(rentSum / rentCount / 100) : 0,
    totalCashback: Math.round(totalCashback / 100),
    avgCreditScore: creditCount ? Math.round(creditSum / creditCount) : 0,
    byStatus: byStatus,
    riskDist: riskDist,
    funnel: funnel,
    weeklySignups: weeklySignups,
  };
}

// ============================================================================
// _DATA SHEET (hidden, chart source data)
// ============================================================================

function writeDataSheet(kpis) {
  var sheet = getOrCreateSheet('_Data');
  sheet.clearContents();
  sheet.clearFormats();

  // KPI values (A:B)
  var kpiRows = [
    ['Metric', 'Value'],
    ['total_users', kpis.total],
    ['approved_users', kpis.approved],
    ['pending_review', kpis.pending],
    ['paid_users', kpis.paid],
    ['total_revenue', kpis.totalRevenue],
    ['avg_rent', kpis.avgRent],
    ['total_cashback', kpis.totalCashback],
    ['avg_credit_score', kpis.avgCreditScore],
  ];
  sheet.getRange(1, 1, kpiRows.length, 2).setValues(kpiRows);

  // Status distribution (D:E)
  var statusData = [['Status', 'Count']];
  var statusOrder = ['signed_up', 'waitlisted', 'approved', 'active', 'rejected'];
  var statusLabels = { signed_up: 'Signed Up', waitlisted: 'Waitlisted', approved: 'Approved', active: 'Active', rejected: 'Rejected' };
  statusOrder.forEach(function(s) {
    if (kpis.byStatus[s]) statusData.push([statusLabels[s] || s, kpis.byStatus[s]]);
  });
  // Add any other statuses
  Object.keys(kpis.byStatus).forEach(function(s) {
    if (statusOrder.indexOf(s) === -1 && kpis.byStatus[s] > 0) {
      statusData.push([s, kpis.byStatus[s]]);
    }
  });
  if (statusData.length > 1) {
    sheet.getRange(1, 4, statusData.length, 2).setValues(statusData);
  }

  // Funnel (G:H)
  var funnelData = [['Stage', 'Count']];
  ['Signed Up', 'Uploaded', 'Verified', 'Approved', 'Paid'].forEach(function(stage) {
    funnelData.push([stage, kpis.funnel[stage] || 0]);
  });
  sheet.getRange(1, 7, funnelData.length, 2).setValues(funnelData);

  // Risk distribution (J:K)
  var riskData = [['Risk Level', 'Count']];
  ['Low', 'Medium', 'High', 'Pending'].forEach(function(r) {
    if (kpis.riskDist[r] > 0) riskData.push([r, kpis.riskDist[r]]);
  });
  if (riskData.length > 1) {
    sheet.getRange(1, 10, riskData.length, 2).setValues(riskData);
  }

  // Weekly signups (M:N) — sorted chronologically
  var weeklyData = [['Week', 'Signups']];
  Object.keys(kpis.weeklySignups).sort().forEach(function(wk) {
    weeklyData.push([wk, kpis.weeklySignups[wk]]);
  });
  if (weeklyData.length > 1) {
    sheet.getRange(1, 13, weeklyData.length, 2).setValues(weeklyData);
  }

  // Trim and hide — use max across ALL data sections
  var maxDataRows = Math.max(kpiRows.length, statusData.length, funnelData.length, riskData.length, weeklyData.length, 10);
  trimSheet(sheet, maxDataRows, 14);
  sheet.hideSheet();
}

// ============================================================================
// SUMMARY SHEET (KPI cards + 4 charts)
// ============================================================================

function refreshSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var old = ss.getSheetByName('Summary');
  if (old) {
    var other = ss.getSheetByName('Users') || ss.getSheets()[0];
    if (other.getName() !== 'Summary') ss.setActiveSheet(other);
    ss.deleteSheet(old);
  }
  var sheet = ss.insertSheet('Summary', 0);
  buildSummaryLayout(sheet);
  SpreadsheetApp.flush();
  buildSummaryVisuals(sheet);
  SpreadsheetApp.flush();
  trimSheet(sheet, 26, 12);
}

function buildSummaryLayout(sheet) {
  sheet.setHiddenGridlines(true);
  for (var i = 1; i <= 12; i++) sheet.setColumnWidth(i, 95);

  // Title
  sheet.getRange('A1:L1').merge().setValue('FLENT SECURED')
    .setBackground(C.HEADER).setFontColor(C.WHITE).setFontSize(20).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 50);

  // Subtitle
  sheet.getRange('A2:L2').merge()
    .setFormula('="Admin Dashboard  \u2022  Last synced: " & TEXT(Config!A1, "dd-MMM-yyyy HH:mm")')
    .setFontColor(C.MUTED).setFontSize(10).setHorizontalAlignment('center')
    .setBackground(C.ROW_ODD);
  sheet.setRowHeight(2, 28);

  // Separator
  sheet.setRowHeight(3, 8);
  sheet.getRange('A3:L3').setBackground(C.WHITE);

  // KPI Cards — Row 1 (rows 4-5)
  var cards = [
    { label: 'Total Users', formula: '=_Data!B2', col: 1, accent: C.TEAL },
    { label: 'Approved', formula: '=_Data!B3', col: 4, accent: C.GREEN },
    { label: 'Total Revenue', formula: '="\u20B9" & TEXT(_Data!B6, "#,##0")', col: 7, accent: C.TEAL, fmt: '@' },
    { label: 'Avg Rent', formula: '="\u20B9" & TEXT(_Data!B7, "#,##0")', col: 10, accent: '#3B82F6', fmt: '@' },
  ];
  var cards2 = [
    { label: 'Pending Review', formula: '=_Data!B4', col: 1, accent: C.AMBER },
    { label: 'Paid Users', formula: '=_Data!B5', col: 4, accent: C.GREEN },
    { label: 'Cashback Given', formula: '="\u20B9" & TEXT(_Data!B8, "#,##0")', col: 7, accent: C.TEAL, fmt: '@' },
    { label: 'Avg Credit Score', formula: '=_Data!B9', col: 10, accent: C.SUBHEADER },
  ];

  buildKPIRow(sheet, 4, cards);
  buildKPIRow(sheet, 7, cards2);

  // Separator
  sheet.setRowHeight(6, 6);
  sheet.setRowHeight(9, 8);

  // Rows 10+ handled by buildSummaryVisuals()
}

function buildKPIRow(sheet, startRow, cards) {
  cards.forEach(function(card) {
    // Value (large)
    var vr = sheet.getRange(startRow, card.col, 1, 3);
    vr.merge().setNumberFormat(card.fmt || '#,##0').setFormula(card.formula)
      .setFontSize(26).setFontWeight('bold').setFontColor(C.HEADER)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBackground(C.CARD_BG);
    sheet.setRowHeight(startRow, 44);

    // Label
    var lr = sheet.getRange(startRow + 1, card.col, 1, 3);
    lr.merge().setValue(card.label)
      .setFontSize(10).setFontColor(C.MUTED).setHorizontalAlignment('center')
      .setBackground(C.CARD_BG);
    sheet.setRowHeight(startRow + 1, 24);

    // Left accent border
    sheet.getRange(startRow, card.col, 2, 1)
      .setBorder(null, true, null, null, null, null, card.accent, SpreadsheetApp.BorderStyle.SOLID_THICK);

    // Card border
    sheet.getRange(startRow, card.col, 2, 3)
      .setBorder(true, true, true, true, null, null, C.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
}

/**
 * Builds SPARKLINE-based visual tables for Summary dashboard.
 * Uses native SPARKLINE formulas (guaranteed rendering, no embedded chart API).
 */
function buildSummaryVisuals(sheet) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = ss.getSheetByName('_Data');
  if (!dataSheet) return;

  // Read data from _Data (skip header rows)
  var statusLastRow = lastRowInCol(dataSheet, 4);
  var riskLastRow = lastRowInCol(dataSheet, 10);
  var weeklyLastRow = lastRowInCol(dataSheet, 13);

  var statusVals = statusLastRow > 1 ? dataSheet.getRange(2, 4, statusLastRow - 1, 2).getValues() : [];
  var funnelVals = dataSheet.getRange(2, 7, 5, 2).getValues();
  var weeklyVals = weeklyLastRow > 1 ? dataSheet.getRange(2, 13, weeklyLastRow - 1, 2).getValues() : [];
  var riskVals = riskLastRow > 1 ? dataSheet.getRange(2, 10, riskLastRow - 1, 2).getValues() : [];
  var totalUsers = dataSheet.getRange(2, 2).getValue() || 1;

  // ── Section 1: Status Distribution + Conversion Funnel (rows 10-16) ──
  sheet.getRange('A10:F10').merge().setValue('  Status Distribution')
    .setFontSize(12).setFontWeight('bold').setFontColor(C.HEADER).setBackground(C.ROW_ODD);
  sheet.getRange('G10:L10').merge().setValue('  Conversion Funnel')
    .setFontSize(12).setFontWeight('bold').setFontColor(C.HEADER).setBackground(C.ROW_ODD);
  sheet.setRowHeight(10, 30);

  var statusColors = {'Signed Up': C.MUTED, 'Waitlisted': C.AMBER, 'Approved': C.GREEN, 'Active': C.TEAL, 'Rejected': C.RED};
  buildSparkTable(sheet, 11, 1, statusVals, totalUsers, statusColors, 'Status', 5);

  var maxFunnel = 1;
  funnelVals.forEach(function(v) { if (v[1] > maxFunnel) maxFunnel = v[1]; });
  var funnelColors = {'Signed Up': C.MUTED, 'Uploaded': C.AMBER, 'Verified': C.TEAL, 'Approved': C.GREEN, 'Paid': '#3B82F6'};
  buildSparkTable(sheet, 11, 7, funnelVals, maxFunnel, funnelColors, 'Stage', 5);

  // ── Separator ──
  sheet.setRowHeight(17, 8);
  sheet.getRange('A17:L17').setBackground(C.WHITE);

  // ── Section 2: Weekly Signups + Risk Distribution (rows 18-25) ──
  var weekLabel = weeklyVals.length > 0 ? '  Weekly Signups (' + weeklyVals.length + ' wks)' : '  Weekly Signups';
  sheet.getRange('A18:F18').merge().setValue(weekLabel)
    .setFontSize(12).setFontWeight('bold').setFontColor(C.HEADER).setBackground(C.ROW_ODD);
  sheet.getRange('G18:L18').merge().setValue('  Risk Distribution')
    .setFontSize(12).setFontWeight('bold').setFontColor(C.HEADER).setBackground(C.ROW_ODD);
  sheet.setRowHeight(18, 30);

  // Weekly SPARKLINE column chart (merged A19:F24)
  if (weeklyVals.length > 0) {
    var counts = weeklyVals.map(function(v) { return v[1] || 0; });
    sheet.getRange('A19:F24').merge()
      .setFormula('=SPARKLINE({' + counts.join(',') + '}, {"charttype","column";"color","' + C.TEAL + '"})')
      .setBackground(C.WHITE).setVerticalAlignment('middle');

    // Week labels: show first and last
    sheet.setRowHeight(25, 18);
    sheet.getRange(25, 1, 1, 3).merge().setValue(weeklyVals[0][0])
      .setFontSize(7).setFontColor(C.MUTED).setHorizontalAlignment('left').setBackground(C.WHITE);
    if (weeklyVals.length > 1) {
      sheet.getRange(25, 4, 1, 3).merge().setValue(weeklyVals[weeklyVals.length - 1][0])
        .setFontSize(7).setFontColor(C.MUTED).setHorizontalAlignment('right').setBackground(C.WHITE);
    }
  } else {
    sheet.getRange('A19:F24').merge().setValue('No data yet')
      .setFontColor(C.MUTED).setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBackground(C.WHITE);
    sheet.setRowHeight(25, 18);
    sheet.getRange(25, 1, 1, 6).setBackground(C.WHITE);
  }

  // Risk Distribution table (rows 19-24, cols G-L)
  var totalRisk = 0;
  riskVals.forEach(function(r) { totalRisk += r[1]; });
  if (totalRisk === 0) totalRisk = 1;
  var riskColors = {'Low': C.GREEN, 'Medium': C.AMBER, 'High': C.RED, 'Pending': C.MUTED};
  buildSparkTable(sheet, 19, 7, riskVals, totalRisk, riskColors, 'Level', 4);

  // Fill remaining risk area (if < 4 risk levels) through row 25
  for (var er = 19 + 1 + Math.min(riskVals.length, 4); er <= 25; er++) {
    sheet.getRange(er, 7, 1, 6).setBackground(C.WHITE);
  }

  // Bottom border
  sheet.setRowHeight(26, 4);
  sheet.getRange('A26:L26').setBackground(C.HEADER);
}

/**
 * Builds a compact data table with SPARKLINE horizontal bars.
 * Each row: [label (2 cols merged)] [count] [SPARKLINE bar (3 cols merged)]
 */
function buildSparkTable(sheet, startRow, startCol, data, total, colors, labelHeader, maxRows) {
  // Sub-header
  sheet.getRange(startRow, startCol, 1, 2).merge().setValue('  ' + labelHeader).setBackground('#E8EDF3')
    .setFontWeight('bold').setFontSize(9).setFontColor(C.HEADER);
  sheet.getRange(startRow, startCol + 2).setValue('Count').setBackground('#E8EDF3')
    .setFontWeight('bold').setFontSize(9).setFontColor(C.HEADER).setHorizontalAlignment('center');
  sheet.getRange(startRow, startCol + 3, 1, 3).merge().setBackground('#E8EDF3');
  sheet.setRowHeight(startRow, 24);

  for (var i = 0; i < maxRows; i++) {
    var row = startRow + 1 + i;
    var bg = (i % 2 === 0) ? C.ROW_EVEN : C.ROW_ODD;

    if (i < data.length && data[i][0]) {
      var label = data[i][0];
      var count = data[i][1] || 0;
      var ratio = Math.max(count / total, 0.01);
      var color = colors[label] || C.MUTED;

      sheet.getRange(row, startCol, 1, 2).merge().setValue('  ' + label).setBackground(bg)
        .setFontSize(10).setFontColor(C.DARK);
      sheet.getRange(row, startCol + 2).setValue(count).setBackground(bg)
        .setFontSize(11).setFontColor(C.DARK).setHorizontalAlignment('center').setFontWeight('bold');
      sheet.getRange(row, startCol + 3, 1, 3).merge()
        .setFormula('=SPARKLINE({' + ratio.toFixed(4) + ',' + Math.max(1 - ratio, 0).toFixed(4) + '}, {"charttype","bar";"color1","' + color + '";"color2","#E5E7EB"})')
        .setBackground(bg);
    } else {
      sheet.getRange(row, startCol, 1, 6).setBackground(bg);
    }
    sheet.setRowHeight(row, 26);
  }
}

function rebuildAllCharts() {
  // Visuals are now SPARKLINE-based; just refresh the summary
  refreshSummary();
}

// ============================================================================
// SHARED FORMATTING UTILITIES
// ============================================================================

function writeSheetData(sheet, headers, rows, widths) {
  sheet.clearContents();
  sheet.clearFormats();
  var colCount = headers.length;
  var rc = rows.length;

  // Header
  sheet.getRange(1, 1, 1, colCount).setValues([headers])
    .setBackground(C.HEADER).setFontColor(C.WHITE).setFontWeight('bold')
    .setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 34);

  // Data
  if (rc > 0) {
    sheet.getRange(2, 1, rc, colCount).setValues(rows);
    applyAlternatingRows(sheet, rc, colCount);
    // Body font
    sheet.getRange(2, 1, rc, colCount).setFontSize(10).setFontColor(C.DARK).setVerticalAlignment('middle');
    // Borders
    sheet.getRange(1, 1, rc + 1, colCount)
      .setBorder(null, null, true, null, null, true, C.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  }

  // Column widths
  if (widths) {
    widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });
  }

  trimSheet(sheet, rc + 1, colCount);
}

function applyAlternatingRows(sheet, rowCount, colCount) {
  var bgs = [];
  for (var r = 0; r < rowCount; r++) {
    var color = r % 2 === 0 ? C.ROW_EVEN : C.ROW_ODD;
    var row = [];
    for (var c = 0; c < colCount; c++) row.push(color);
    bgs.push(row);
  }
  sheet.getRange(2, 1, rowCount, colCount).setBackgrounds(bgs);
}

function applyStatusColors(sheet, colNum, rowCount, rules) {
  var range = sheet.getRange(2, colNum, rowCount, 1);
  var vals = range.getValues();
  var bgs = vals.map(function(v) {
    var key = String(v[0]).toLowerCase();
    var r = rules[key] || rules[String(v[0])];
    return [r ? r.bg : null];
  });
  var fcs = vals.map(function(v) {
    var key = String(v[0]).toLowerCase();
    var r = rules[key] || rules[String(v[0])];
    return [r ? r.fg : null];
  });
  // Only apply non-null
  var currentBgs = range.getBackgrounds();
  var currentFcs = range.getFontColors();
  var finalBgs = bgs.map(function(b, i) { return [b[0] || currentBgs[i][0]]; });
  var finalFcs = fcs.map(function(f, i) { return [f[0] || currentFcs[i][0]]; });
  range.setBackgrounds(finalBgs);
  range.setFontColors(finalFcs);
  range.setFontWeight('bold').setHorizontalAlignment('center');
}

// Status rules
function statusRules() {
  return {
    'signed_up': { bg: C.MUTED_BG, fg: C.MUTED },
    'waitlisted': { bg: C.AMBER_BG, fg: C.AMBER },
    'approved': { bg: C.GREEN_BG, fg: C.GREEN },
    'active': { bg: C.GREEN_BG, fg: C.GREEN },
    'rejected': { bg: C.RED_BG, fg: C.RED },
  };
}

function riskRules() {
  return {
    'low': { bg: C.GREEN_BG, fg: C.GREEN },
    'LOW': { bg: C.GREEN_BG, fg: C.GREEN },
    'medium': { bg: C.AMBER_BG, fg: C.AMBER },
    'MEDIUM': { bg: C.AMBER_BG, fg: C.AMBER },
    'high': { bg: C.RED_BG, fg: C.RED },
    'HIGH': { bg: C.RED_BG, fg: C.RED },
    'pending': { bg: C.MUTED_BG, fg: C.MUTED },
    'PENDING': { bg: C.MUTED_BG, fg: C.MUTED },
  };
}

function reviewRules() {
  return {
    'approved': { bg: C.GREEN_BG, fg: C.GREEN },
    'rejected': { bg: C.RED_BG, fg: C.RED },
    'pending': { bg: C.AMBER_BG, fg: C.AMBER },
  };
}

/**
 * Tenant column rules — matches on prefix (value starts with status keyword).
 * Returns rule map keyed by status prefix.
 */
function tenantRules() {
  return {
    'Active': { bg: C.GREEN_BG, fg: C.GREEN },
    'active': { bg: C.GREEN_BG, fg: C.GREEN },
    'Moved Out': { bg: C.AMBER_BG, fg: C.AMBER },
    'moved out': { bg: C.AMBER_BG, fg: C.AMBER },
    'No': { bg: C.MUTED_BG, fg: C.MUTED },
    'no': { bg: C.MUTED_BG, fg: C.MUTED },
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function getOrCreateSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Attempt to order
    var idx = SHEET_ORDER.indexOf(name);
    if (idx >= 0) {
      try { ss.setActiveSheet(sheet); ss.moveActiveSheet(idx + 1); } catch(e) {}
    }
  }
  return sheet;
}

function safeWrite(name, fn) {
  try { fn(); } catch (e) {
    Logger.log('ERROR writing ' + name + ': ' + e.message + '\n' + e.stack);
  }
}

function updateTimestamp() {
  var sheet = getOrCreateSheet('Config');
  sheet.getRange('A1').setValue(new Date());
  trimSheet(sheet, 1, 1);
}

function getWeekKey(date) {
  var jan1 = new Date(date.getFullYear(), 0, 1);
  var weekNum = Math.ceil(((date - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return date.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

function lastRowInCol(sheet, col) {
  var vals = sheet.getRange(1, col, sheet.getMaxRows(), 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (vals[i][0] !== '') return i + 1;
  }
  return 1;
}

/**
 * Deletes unused rows and columns beyond the data area for a clean look.
 * Keeps at least 1 row/col to avoid errors on empty sheets.
 */
function trimSheet(sheet, usedRows, usedCols) {
  try {
    var keepRows = Math.max(usedRows, 1);
    var keepCols = Math.max(usedCols, 1);
    var maxRows = sheet.getMaxRows();
    var maxCols = sheet.getMaxColumns();
    // Expand if sheet was previously trimmed too small
    if (maxRows < keepRows) {
      sheet.insertRowsAfter(maxRows, keepRows - maxRows);
    }
    if (maxCols < keepCols) {
      sheet.insertColumnsAfter(maxCols, keepCols - maxCols);
    }
    // Re-read after possible expansion
    maxRows = sheet.getMaxRows();
    maxCols = sheet.getMaxColumns();
    // Trim excess
    if (maxRows > keepRows) {
      sheet.deleteRows(keepRows + 1, maxRows - keepRows);
    }
    if (maxCols > keepCols) {
      sheet.deleteColumns(keepCols + 1, maxCols - keepCols);
    }
  } catch (e) {
    Logger.log('trimSheet(' + sheet.getName() + '): ' + e.message);
  }
}
