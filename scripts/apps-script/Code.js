// ============================================================================
// FLENT SECURED — Admin Dashboard (Google Apps Script)
// McKinsey-grade formatting, formula-driven KPIs, embedded charts.
// Auto-syncs every 10 minutes from Supabase views.
// ============================================================================

// ===== Configuration =====
var SUPABASE_URL = 'https://uowjtrzmszuaiokqxgir.supabase.co';
var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_c80tL8IG3x46DQhLQ7WKfg_QUgIMI2x'; // public key — safe to embed
var HOLYGRAIL_ID = '1E1GAWuzMSSsdV-osseKOQhwwzgGsbflC1PnojBV8WUU';

// BOOTSTRAP: Sets script properties. Run once manually via Apps Script editor or doGet(?action=bootstrap).
// Keys must be provided as arguments or set manually in Script Properties (Project Settings > Script Properties).
// NEVER hardcode keys in source code.
function _bootstrap() {
  var props = PropertiesService.getScriptProperties();
  var serviceKey = props.getProperty('SUPABASE_SECRET_KEY');
  var adminKey = props.getProperty('ADMIN_API_KEY');
  if (!serviceKey || !adminKey) {
    Logger.log('ERROR: Set SUPABASE_SECRET_KEY and ADMIN_API_KEY in Script Properties before running bootstrap.');
    return 'FAIL: keys not set in Script Properties. Go to Project Settings > Script Properties.';
  }
  Logger.log('Script properties verified');
  return 'OK: both keys found in Script Properties';
}

function getServiceKey() {
  var key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SECRET_KEY');
  if (!key) throw new Error('SUPABASE_SECRET_KEY not set in Script Properties. Run _bootstrap() after setting keys.');
  return key;
}

function getAdminKey() {
  var key = PropertiesService.getScriptProperties().getProperty('ADMIN_API_KEY');
  if (!key) throw new Error('ADMIN_API_KEY not set in Script Properties. Run _bootstrap() after setting keys.');
  return key;
}

// ===== Diagnostic — remove after confirming sync works =====
function _testFetch() {
  var key = getServiceKey();
  var adminKey = getAdminKey();
  var url = SUPABASE_URL + '/functions/v1/admin-fetch-views';
  Logger.log('URL: ' + url);
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'apikey': SUPABASE_PUBLISHABLE_KEY, 'Authorization': 'Bearer ' + key },
    payload: JSON.stringify({ admin_key: adminKey }),
    muteHttpExceptions: true,
  });
  Logger.log('Status: ' + resp.getResponseCode());
  Logger.log('Body: ' + resp.getContentText().substring(0, 500));
  return resp.getResponseCode();
}

// ===== Date Helpers =====
/** Convert UTC date string to IST (UTC+5:30) Date object for Sheets display */
function toIST(val) {
  if (!val) return '';
  var d = new Date(val);
  if (isNaN(d.getTime())) return val;
  d.setMinutes(d.getMinutes() + 330); // +5h30m
  return d;
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
var SHEET_ORDER = ['Summary', 'Users', 'Review', 'User Details', 'Landlords', 'Risk', 'Verifications', 'Legends', 'M360', 'Conversions', 'Payments', 'Config', '_Data'];

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

    // Auto-audit waitlisted users with admin_review = 'due'
    try {
      var dueUsers = allData.users.filter(function(r) {
        return r.user_status === 'waitlisted' && r.admin_review === 'due';
      });
      if (dueUsers.length > 0) {
        var userIds = dueUsers.map(function(r) { return r.user_id; }).filter(Boolean);
        if (userIds.length > 0) {
          var auditResults = runBatchAudit(userIds, true);
          if (auditResults) {
            mergeAuditResults(allData.users, auditResults);
          }
        }
      }
    } catch (e) {
      Logger.log('WARNING: Auto-audit failed (non-fatal): ' + e.message);
    }

    var tenantMap = {};
    try { tenantMap = fetchTenantLog(); } catch (e) {
      Logger.log('WARNING: Tenant Log fetch failed: ' + e.message);
    }
    safeWrite('Users', function() { writeUsersSheet(allData.users, tenantMap); });
    safeWrite('Review', function() { writeReviewSheet(allData.users); });
    safeWrite('User Details', function() { writeUserDetailsSheet(allData.users); });
    safeWrite('Landlords', function() { writeLandlordsSheet(allData.users); });
    safeWrite('Risk', function() { writeRiskSheet(allData.riskDetail || []); });
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

// Web app endpoint — allows triggering syncAll or bootstrap via HTTP GET.
// Requires ?key= matching ADMIN_API_KEY in Script Properties as defense-in-depth.
function doGet(e) {
  try {
    var providedKey = (e && e.parameter && e.parameter.key) || '';
    var expectedKey = PropertiesService.getScriptProperties().getProperty('ADMIN_API_KEY') || '';
    if (!providedKey || !expectedKey || providedKey !== expectedKey) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var action = (e && e.parameter && e.parameter.action) || 'sync';
    if (action === 'bootstrap') {
      var result = _bootstrap();
      return ContentService.createTextOutput(JSON.stringify({ ok: true, action: 'bootstrap', result: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }
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
    null, // separator
    { name: '\u2713 Approve Selected Users', functionName: 'approveSelectedUsers' },
    { name: '\u2717 Reject Selected Users', functionName: 'rejectSelectedUsers' },
    null, // separator
    { name: '\uD83D\uDD12 Setup Column Protection', functionName: 'setupUsersProtection' },
    { name: '\u26A1 Setup Edit Trigger', functionName: 'setupEditTrigger' },
    null, // separator
    { name: '\u2795 Add Reviewer Access', functionName: 'addReviewerAccess' },
    { name: '\u2796 Remove Reviewer Access', functionName: 'removeReviewerAccess' },
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
// APPROVE / REJECT SELECTED USERS
// ============================================================================

/**
 * Helper: extract user rows from the active selection on Users/User Details sheet.
 * Returns array of { userId, name, phone, rent, risk, adminReview, auditStatus, missingData, row }.
 * Cols: 1=ID 2=Phone 3=Status 4=Name 5=Rent 6=Address 12=Risk 13=AdminReview 14=Extraction 15=Queue# 16=AuditStatus 17=MissingData 18=FlentTenant
 */
function _getSelectedUserRows() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var sheetName = sheet.getName();
  if (sheetName !== 'Users' && sheetName !== 'User Details' && sheetName !== 'Review') {
    return { error: 'Please select rows on the "Users" or "Review" sheet.' };
  }

  var selection = sheet.getActiveRange();
  if (!selection) return { error: 'No rows selected.' };

  var startRow = selection.getRow();
  var numRows = selection.getNumRows();
  if (startRow <= 1) { startRow = 2; numRows = numRows - (2 - selection.getRow()); }
  if (numRows <= 0) return { error: 'No data rows selected (header row doesn\'t count).' };

  var users = [];
  if (sheetName === 'Review') {
    // Review cols: 0=ID, 1=Phone, 2=Name, 3=Status, 4=Rent, 5=City, 6=Risk, 7=Audit, 8=Missing, 9=AdminReview
    var data = sheet.getRange(startRow, 1, numRows, REVIEW_SHEET_ADMIN_COL).getValues();
    for (var i = 0; i < data.length; i++) {
      var userId = String(data[i][0] || '').trim();
      if (!userId || userId.length < 30) continue;
      users.push({
        userId: userId,
        phone: String(data[i][1] || ''),
        status: String(data[i][3] || ''),
        name: String(data[i][2] || '') || userId.substring(0, 8),
        rent: String(data[i][4] || ''),
        risk: String(data[i][6] || ''),
        adminReview: String(data[i][9] || '').trim().toLowerCase(),
        auditStatus: String(data[i][7] || ''),
        missingData: String(data[i][8] || ''),
        row: startRow + i,
      });
    }
  } else {
    // Users/User Details cols: 0=ID, 1=Phone, 2=Status, 3=Name, 4=Rent, 11=Risk, 12=Admin, 15=Audit, 16=Missing
    var data = sheet.getRange(startRow, 1, numRows, 17).getValues();
    for (var i = 0; i < data.length; i++) {
      var userId = String(data[i][0] || '').trim();
      if (!userId || userId.length < 30) continue;
      users.push({
        userId: userId,
        phone: String(data[i][1] || ''),
        status: String(data[i][2] || ''),
        name: String(data[i][3] || '') || userId.substring(0, 8),
        rent: String(data[i][4] || ''),
        risk: String(data[i][11] || ''),
        adminReview: String(data[i][12] || '').trim().toLowerCase(),
        auditStatus: String(data[i][15] || ''),
        missingData: String(data[i][16] || ''),
        row: startRow + i,
      });
    }
  }

  if (users.length === 0) return { error: 'No valid user IDs found. Make sure you selected data rows (not headers).' };
  return { users: users, sheet: sheet };
}

/**
 * Helper: build a readable summary of users for confirmation dialogs.
 */
function _buildUserSummary(users, maxShow) {
  maxShow = maxShow || 10;
  var lines = [];
  for (var i = 0; i < Math.min(users.length, maxShow); i++) {
    var u = users[i];
    var line = (i + 1) + '. ' + u.name;
    if (u.phone) line += '  (' + u.phone + ')';
    if (u.rent) line += '  —  ₹' + u.rent;
    if (u.risk && u.risk !== 'PENDING') line += '  [' + u.risk + ']';
    lines.push(line);
  }
  if (users.length > maxShow) lines.push('... + ' + (users.length - maxShow) + ' more');
  return lines.join('\n');
}

/**
 * Helper: instantly update Status + Admin Review columns on the Users sheet
 * after a successful approve/reject, so admins see the change without waiting for sync.
 * Cols: 3=Status, 13=Admin Review
 */
function _updateSheetStatus(userIds, newReview) {
  var idSet = {};
  for (var i = 0; i < userIds.length; i++) idSet[userIds[i]] = true;
  var statusMap = { 'approved': 'approved', 'rejected': 'not_eligible' };
  var newStatus = statusMap[newReview] || newReview;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Update Users sheet
  try {
    var usersSheet = ss.getSheetByName('Users');
    if (usersSheet && usersSheet.getLastRow() > 1) {
      var data = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, ADMIN_REVIEW_COL).getValues();
      for (var r = 0; r < data.length; r++) {
        if (idSet[String(data[r][0] || '').trim()]) {
          usersSheet.getRange(r + 2, 3).setValue(newStatus);
          usersSheet.getRange(r + 2, ADMIN_REVIEW_COL).setValue(newReview);
        }
      }
    }
  } catch (e) {
    Logger.log('_updateSheetStatus Users error: ' + e.message);
  }

  // Update Review sheet
  try {
    var reviewSheet = ss.getSheetByName('Review');
    if (reviewSheet && reviewSheet.getLastRow() > 1) {
      var rData = reviewSheet.getRange(2, 1, reviewSheet.getLastRow() - 1, REVIEW_SHEET_ADMIN_COL).getValues();
      for (var r = 0; r < rData.length; r++) {
        if (idSet[String(rData[r][0] || '').trim()]) {
          reviewSheet.getRange(r + 2, 4).setValue(newStatus); // Status col 4 on Review
          reviewSheet.getRange(r + 2, REVIEW_SHEET_ADMIN_COL).setValue(newReview);
        }
      }
    }
  } catch (e) {
    Logger.log('_updateSheetStatus Review error: ' + e.message);
  }
}

/**
 * Helper: run pre-approval audit with auto_fix on a batch of user IDs.
 * Returns { ok, users: [{user_id, status, blockers, auto_fixes}], unfixable: [{user_id, name, blockers}], errorMsg }.
 */
function _runPreApprovalAudit(userIds) {
  var key = getServiceKey();
  var adminKey = getAdminKey();
  try {
    var resp = UrlFetchApp.fetch(SUPABASE_URL + '/functions/v1/pre-approval-audit', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'apikey': SUPABASE_PUBLISHABLE_KEY, 'Authorization': 'Bearer ' + key },
      payload: JSON.stringify({ user_ids: userIds, auto_fix: true, admin_key: adminKey }),
      muteHttpExceptions: true,
    });
    var code = resp.getResponseCode();
    var body = resp.getContentText();
    if (code !== 200) {
      var errMsg = '';
      try { errMsg = JSON.parse(body).message || body; } catch (_) { errMsg = body; }
      return { ok: false, errorMsg: 'Audit HTTP ' + code + ': ' + errMsg.substring(0, 400) };
    }
    var data = JSON.parse(body);
    var users = data.users || [];
    // Identify users still blocked after auto_fix (ignore B02/B04 which are status-related, not data gaps)
    var unfixable = [];
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var realBlockers = (u.blockers || []).filter(function(b) {
        return b.code !== 'B02' && b.code !== 'B04';
      });
      if (realBlockers.length > 0) {
        unfixable.push({ user_id: u.user_id, name: u.name || u.phone || u.user_id.substring(0, 8), blockers: realBlockers });
      }
    }
    // Count fixes applied
    var totalFixes = 0;
    for (var j = 0; j < users.length; j++) {
      totalFixes += (users[j].auto_fixes || []).length;
    }
    return { ok: true, users: users, unfixable: unfixable, totalFixes: totalFixes };
  } catch (e) {
    return { ok: false, errorMsg: 'Audit network error: ' + e.message };
  }
}

/**
 * Helper: call admin-waitlist edge function.
 * Returns { ok, result, errorMsg }.
 */
function _callAdminWaitlist(payload) {
  var key = getServiceKey();
  var adminKey = getAdminKey();
  payload.admin_key = adminKey;
  try {
    var resp = UrlFetchApp.fetch(SUPABASE_URL + '/functions/v1/admin-waitlist', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'apikey': SUPABASE_PUBLISHABLE_KEY, 'Authorization': 'Bearer ' + key },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var code = resp.getResponseCode();
    var body = resp.getContentText();
    if (code === 200) {
      return { ok: true, result: JSON.parse(body) };
    } else {
      var errMsg = '';
      try { errMsg = JSON.parse(body).message || body; } catch (_) { errMsg = body; }
      return { ok: false, errorMsg: 'HTTP ' + code + ': ' + errMsg.substring(0, 400) };
    }
  } catch (e) {
    return { ok: false, errorMsg: 'Network error: ' + e.message };
  }
}

function approveSelectedUsers() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    SpreadsheetApp.getUi().alert('Another operation is in progress. Please wait.');
    return;
  }

  try {
    var sel = _getSelectedUserRows();
    if (sel.error) { SpreadsheetApp.getUi().alert(sel.error); return; }
    var ui = SpreadsheetApp.getUi();

    // Filter: skip already approved users
    var eligible = [];
    var skipped = [];
    for (var i = 0; i < sel.users.length; i++) {
      var u = sel.users[i];
      if (u.adminReview === 'approved') {
        skipped.push(u.name + ' (already approved)');
      } else {
        eligible.push(u);
      }
    }

    if (eligible.length === 0) {
      ui.alert('Nothing to approve', 'All ' + skipped.length + ' selected user(s) are already approved.', ui.ButtonSet.OK);
      return;
    }

    var userIds = eligible.map(function(u) { return u.userId; });

    // Step 1: Run pre-approval audit with auto_fix BEFORE approving
    ui.alert('Running Audit', 'Running pre-approval audit with auto-fix for ' + eligible.length + ' user(s)...\nThis may take a moment.', ui.ButtonSet.OK);
    var audit = _runPreApprovalAudit(userIds);

    if (!audit.ok) {
      ui.alert('Audit Failed', audit.errorMsg + '\n\nApproval aborted.', ui.ButtonSet.OK);
      return;
    }

    // Step 2: Check for unfixable blockers
    var warnings = '';
    if (audit.totalFixes > 0) {
      warnings += '\n\n🔧 Auto-fixed ' + audit.totalFixes + ' data gap(s).';
    }

    if (audit.unfixable.length > 0) {
      // Remove unfixable users from approval list
      var unfixableIds = {};
      for (var k = 0; k < audit.unfixable.length; k++) unfixableIds[audit.unfixable[k].user_id] = true;
      var fixable = eligible.filter(function(u) { return !unfixableIds[u.userId]; });
      var blockedUsers = eligible.filter(function(u) { return unfixableIds[u.userId]; });

      warnings += '\n\n⛔ ' + audit.unfixable.length + ' user(s) have unfixable issues (will NOT be approved):';
      for (var m = 0; m < Math.min(audit.unfixable.length, 5); m++) {
        var uf = audit.unfixable[m];
        var blockerTexts = uf.blockers.map(function(b) { return b.code + ': ' + b.message; });
        warnings += '\n  • ' + uf.name + ' — ' + blockerTexts.join(', ');
      }
      if (audit.unfixable.length > 5) warnings += '\n  ... + ' + (audit.unfixable.length - 5) + ' more';

      if (fixable.length === 0) {
        ui.alert('Cannot Approve', 'All ' + eligible.length + ' user(s) have unfixable data gaps.' + warnings + '\n\nNo users approved.', ui.ButtonSet.OK);
        return;
      }

      // Continue with only fixable users
      eligible = fixable;
      userIds = eligible.map(function(u) { return u.userId; });
    }

    var summary = _buildUserSummary(eligible);
    var msg = 'Approve ' + eligible.length + ' user(s)?\n\n' + summary;
    if (skipped.length > 0) msg += '\n\nSkipping ' + skipped.length + ' already approved.';
    msg += warnings;
    msg += '\n\nThis will advance their status to "approved".';

    var confirm = ui.alert('✓ Confirm Approval', msg, ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) return;

    var resp = _callAdminWaitlist({ action: 'approve', user_ids: userIds });

    if (resp.ok) {
      var r = resp.result;
      var successCount = r.approved || userIds.length;
      var resultMsg = '✓ Approved: ' + successCount + ' user(s)';
      if (r.errors && r.errors.length > 0) {
        resultMsg += '\n\nFailed (' + r.errors.length + '):';
        r.errors.slice(0, 5).forEach(function(e) { resultMsg += '\n  • ' + (e.user_id || '').substring(0, 8) + ': ' + e.error; });
      }
      if (skipped.length > 0) resultMsg += '\n\nSkipped: ' + skipped.length + ' already approved.';
      _updateSheetStatus(userIds, 'approved');
      ui.alert('Approval Complete', resultMsg, ui.ButtonSet.OK);
    } else {
      ui.alert('Approval Failed', resp.errorMsg, ui.ButtonSet.OK);
    }
  } finally {
    lock.releaseLock();
  }
}

function rejectSelectedUsers() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    SpreadsheetApp.getUi().alert('Another operation is in progress. Please wait.');
    return;
  }

  try {
    var sel = _getSelectedUserRows();
    if (sel.error) { SpreadsheetApp.getUi().alert(sel.error); return; }
    var ui = SpreadsheetApp.getUi();

    // Filter: skip already rejected users
    var eligible = [];
    var skipped = [];
    for (var i = 0; i < sel.users.length; i++) {
      var u = sel.users[i];
      if (u.adminReview === 'rejected') {
        skipped.push(u.name + ' (already rejected)');
      } else {
        eligible.push(u);
      }
    }

    if (eligible.length === 0) {
      ui.alert('Nothing to reject', 'All ' + skipped.length + ' selected user(s) are already rejected.', ui.ButtonSet.OK);
      return;
    }

    // Warn if rejecting approved users
    var approvedOnes = eligible.filter(function(u) { return u.adminReview === 'approved'; });
    var approvedWarning = '';
    if (approvedOnes.length > 0) {
      approvedWarning = '\n\n⚠ ' + approvedOnes.length + ' user(s) are currently APPROVED and will be reverted:\n';
      approvedWarning += approvedOnes.slice(0, 3).map(function(u) { return '  • ' + u.name; }).join('\n');
      if (approvedOnes.length > 3) approvedWarning += '\n  ... + ' + (approvedOnes.length - 3) + ' more';
    }

    var summary = _buildUserSummary(eligible);

    // Prompt for optional reason
    var reasonResp = ui.prompt('✗ Reject ' + eligible.length + ' User(s)',
      'Users to reject:\n' + summary + approvedWarning +
      (skipped.length > 0 ? '\n\nSkipping ' + skipped.length + ' already rejected.' : '') +
      '\n\n──────────────────────────\nEnter rejection reason (optional):',
      ui.ButtonSet.OK_CANCEL);

    if (reasonResp.getSelectedButton() !== ui.Button.OK) return;
    var reason = reasonResp.getResponseText().trim();

    // Final confirmation
    var confirmMsg = 'Reject ' + eligible.length + ' user(s)?\n\n' + summary;
    if (reason) confirmMsg += '\n\nReason: "' + reason + '"';
    if (skipped.length > 0) confirmMsg += '\n\nSkipping ' + skipped.length + ' already rejected.';

    var confirm = ui.alert('✗ Confirm Rejection', confirmMsg, ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) return;

    var userIds = eligible.map(function(u) { return u.userId; });
    var effectiveReason = reason || 'Admin rejected (no reason given)';
    var payload = { action: 'reject', user_ids: userIds, rejection_reasons: userIds.map(function() { return effectiveReason; }) };
    var resp = _callAdminWaitlist(payload);

    if (resp.ok) {
      var r = resp.result;
      var successCount = r.rejected || userIds.length;
      var resultMsg = '✗ Rejected: ' + successCount + ' user(s)\nReason: "' + reason + '"';
      if (r.errors && r.errors.length > 0) {
        resultMsg += '\n\nFailed (' + r.errors.length + '):';
        r.errors.slice(0, 5).forEach(function(e) { resultMsg += '\n  • ' + (e.user_id || '').substring(0, 8) + ': ' + e.error; });
      }
      if (skipped.length > 0) resultMsg += '\n\nSkipped: ' + skipped.length + ' already rejected.';
      _updateSheetStatus(userIds, 'rejected');
      ui.alert('Rejection Complete', resultMsg, ui.ButtonSet.OK);
    } else {
      ui.alert('Rejection Failed', resp.errorMsg, ui.ButtonSet.OK);
    }
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// ON-EDIT TRIGGER — Admin Review column changes
// Must be INSTALLABLE (not simple) to use UrlFetchApp and UI dialogs.
// Run setupEditTrigger() once from the menu to install it.
// ============================================================================

var ADMIN_REVIEW_COL = 13; // Admin Review is column 13 on Users sheet

var REVIEW_SHEET_ADMIN_COL = 10; // Admin Review is column 10 on Review sheet

function onAdminReviewEdit(e) {
  try {
    var sheet = e.range.getSheet();
    var sheetName = sheet.getName();
    if (sheetName !== 'Users' && sheetName !== 'Review') return;

    var col = e.range.getColumn();
    var row = e.range.getRow();
    var targetCol = sheetName === 'Review' ? REVIEW_SHEET_ADMIN_COL : ADMIN_REVIEW_COL;
    if (col !== targetCol || row <= 1) return;

    var newValue = String(e.value || '').trim().toLowerCase();
    var oldValue = String(e.oldValue || '').trim().toLowerCase();
    if (newValue === oldValue) return;
    if (newValue !== 'approved' && newValue !== 'rejected') return;

    // Read context for all edited rows in one batch
    var numRows = e.range.getNumRows();
    var maxCols = sheetName === 'Review' ? REVIEW_SHEET_ADMIN_COL : 15;
    var rowData = sheet.getRange(row, 1, numRows, maxCols).getValues();
    var users = [];
    for (var i = 0; i < rowData.length; i++) {
      var userId = String(rowData[i][0] || '').trim();
      if (!userId || userId.length < 30) continue;
      // Column mapping differs between Users (col 13) and Review (col 10)
      var reviewIdx = sheetName === 'Review' ? REVIEW_SHEET_ADMIN_COL - 1 : 12;
      var currentReview = String(rowData[i][reviewIdx] || '').trim().toLowerCase();
      // For single-cell edit, rowData[i][reviewIdx] is the NEW value; use oldValue for row 0
      if (i === 0) currentReview = oldValue;
      if (sheetName === 'Review') {
        // Review cols: 0=ID, 1=Phone, 2=Name, 3=Status, 4=Rent, 5=City, 6=Risk, 7=Audit, 8=Missing, 9=AdminReview
        users.push({
          userId: userId,
          name: String(rowData[i][2] || '') || userId.substring(0, 8),
          phone: String(rowData[i][1] || ''),
          rent: String(rowData[i][4] || ''),
          risk: String(rowData[i][6] || ''),
          auditStatus: String(rowData[i][7] || ''),
          missingData: String(rowData[i][8] || ''),
          currentReview: currentReview,
        });
      } else {
        // Users cols: 0=ID, 1=Phone, 3=Name, 4=Rent, 11=Risk, 12=AdminReview, 13=AuditStatus, 14=MissingData
        users.push({
          userId: userId,
          name: String(rowData[i][3] || '') || userId.substring(0, 8),
          phone: String(rowData[i][1] || ''),
          rent: String(rowData[i][4] || ''),
          risk: String(rowData[i][11] || ''),
          auditStatus: String(rowData[i][13] || ''),
          missingData: String(rowData[i][14] || ''),
          currentReview: currentReview,
        });
      }
    }
    if (users.length === 0) return;

    var ui = SpreadsheetApp.getUi();
    var action = newValue === 'approved' ? 'APPROVE' : 'REJECT';
    var icon = newValue === 'approved' ? '✓' : '✗';

    // Skip users already in the target state
    var eligible = [];
    var skippedNames = [];
    for (var j = 0; j < users.length; j++) {
      if (users[j].currentReview === newValue) {
        skippedNames.push(users[j].name + ' (already ' + newValue + ')');
      } else {
        eligible.push(users[j]);
      }
    }

    if (eligible.length === 0) {
      ui.alert('Nothing to do', 'All selected user(s) are already ' + newValue + '.', ui.ButtonSet.OK);
      e.range.setValue(oldValue || 'due');
      return;
    }

    // Build detailed user summary
    var summary = _buildUserSummary(eligible);
    var userIds = eligible.map(function(u) { return u.userId; });
    var warnings = '';

    // For APPROVAL: run pre-approval audit with auto_fix first
    if (newValue === 'approved') {
      var audit = _runPreApprovalAudit(userIds);
      if (!audit.ok) {
        ui.alert('Audit Failed', audit.errorMsg + '\n\nApproval aborted. Cell reverted.', ui.ButtonSet.OK);
        e.range.setValue(oldValue || 'due');
        return;
      }
      if (audit.totalFixes > 0) {
        warnings += '\n\n🔧 Auto-fixed ' + audit.totalFixes + ' data gap(s).';
      }
      if (audit.unfixable.length > 0) {
        var unfixableIds = {};
        for (var k = 0; k < audit.unfixable.length; k++) unfixableIds[audit.unfixable[k].user_id] = true;
        var fixable = eligible.filter(function(u) { return !unfixableIds[u.userId]; });
        warnings += '\n\n⛔ ' + audit.unfixable.length + ' user(s) have unfixable issues (will NOT be approved):';
        for (var m = 0; m < Math.min(audit.unfixable.length, 5); m++) {
          var uf = audit.unfixable[m];
          var blockerTexts = uf.blockers.map(function(b) { return b.code + ': ' + b.message; });
          warnings += '\n  • ' + uf.name + ' — ' + blockerTexts.join(', ');
        }
        if (fixable.length === 0) {
          ui.alert('Cannot Approve', 'All user(s) have unfixable data gaps.' + warnings + '\n\nCell reverted.', ui.ButtonSet.OK);
          e.range.setValue(oldValue || 'due');
          return;
        }
        eligible = fixable;
        userIds = eligible.map(function(u) { return u.userId; });
        summary = _buildUserSummary(eligible);
      }
    }

    // For REJECTION: warn about reverting approved users
    if (newValue === 'rejected') {
      var approvedOnes = eligible.filter(function(u) { return u.currentReview === 'approved'; });
      if (approvedOnes.length > 0) {
        warnings = '\n\n⚠ ' + approvedOnes.length + ' user(s) are currently APPROVED and will be reverted.';
      }
    }

    // Rejection: prompt for optional reason
    var reason = '';
    if (newValue === 'rejected') {
      var reasonResp = ui.prompt(icon + ' ' + action + ' ' + eligible.length + ' user(s)',
        'Users:\n' + summary + warnings +
        (skippedNames.length > 0 ? '\n\nSkipping: ' + skippedNames.join(', ') : '') +
        '\n\n──────────────────────────\nEnter rejection reason (optional):',
        ui.ButtonSet.OK_CANCEL);
      if (reasonResp.getSelectedButton() !== ui.Button.OK) {
        e.range.setValue(oldValue || 'due');
        return;
      }
      reason = reasonResp.getResponseText().trim();
    }

    // Final confirmation
    var confirmMsg = action + ' ' + eligible.length + ' user(s)?\n\n' + summary;
    if (reason) confirmMsg += '\n\nReason: "' + reason + '"';
    if (skippedNames.length > 0) confirmMsg += '\n\nSkipping: ' + skippedNames.length + ' already ' + newValue + '.';
    confirmMsg += warnings;

    var confirm = ui.alert(icon + ' Confirm ' + action, confirmMsg, ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) {
      e.range.setValue(oldValue || 'due');
      return;
    }

    // Call backend
    var payload = { action: newValue === 'approved' ? 'approve' : 'reject', user_ids: userIds };
    if (newValue === 'rejected') {
      var effectiveReason = reason || 'Admin rejected (no reason given)';
      payload.rejection_reasons = userIds.map(function() { return effectiveReason; });
    }

    var resp = _callAdminWaitlist(payload);

    if (resp.ok) {
      var r = resp.result;
      var count = r.approved || r.rejected || userIds.length;
      var resultMsg = icon + ' ' + action + ': ' + count + ' user(s) updated.';
      if (r.errors && r.errors.length > 0) {
        resultMsg += '\n\nFailed (' + r.errors.length + '):';
        r.errors.slice(0, 5).forEach(function(err) { resultMsg += '\n  • ' + (err.user_id || '').substring(0, 8) + ': ' + err.error; });
      }
      // Instant status update in the sheet (no sync needed)
      _updateSheetStatus(userIds, newValue);
      ui.alert(action + ' Complete', resultMsg, ui.ButtonSet.OK);
    } else {
      ui.alert(action + ' Failed', resp.errorMsg + '\n\nCell reverted.', ui.ButtonSet.OK);
      e.range.setValue(oldValue || 'due');
    }
  } catch (err) {
    Logger.log('onAdminReviewEdit error: ' + err.message + '\n' + err.stack);
    try { e.range.setValue(String(e.oldValue || 'due').trim().toLowerCase()); } catch (_) {}
  }
}

// ============================================================================
// SHEET PROTECTION — lock everything except Admin Review column
// ============================================================================

/**
 * Run once to set up protection on the Users sheet.
 * Protects all columns except Admin Review (col 13).
 * Editors can only change the Admin Review dropdown.
 * Owner (you) retains full access.
 *
 * To grant access: Flent Admin → Add Reviewer Access, then enter their email.
 * They'll get edit access ONLY to the Admin Review column.
 */
function setupUsersProtection() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = ss.getSheets();

  // Get saved reviewer emails
  var reviewerEmails = [];
  try {
    var saved = PropertiesService.getScriptProperties().getProperty('REVIEWER_EMAILS');
    if (saved) reviewerEmails = saved.split(',').map(function(e) { return e.trim(); }).filter(Boolean);
  } catch (e) {}

  var protectedCount = 0;

  for (var i = 0; i < allSheets.length; i++) {
    var sheet = allSheets[i];
    var name = sheet.getName();

    // Remove existing protections on this sheet
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function(p) {
      p.remove();
    });

    var protection = sheet.protect().setDescription(name + ' \u2014 locked');
    protection.setWarningOnly(false);

    // Users sheet: owner can edit Admin Review column
    if (name === 'Users') {
      var lastRow = Math.max(sheet.getLastRow(), 500);
      protection.setUnprotectedRanges([sheet.getRange(2, ADMIN_REVIEW_COL, lastRow, 1)]);
      protection.setDescription('Users \u2014 Admin Review editable (owner only)');
    }

    // Review sheet: reviewers can edit Admin Review column (col 10)
    if (name === 'Review') {
      var lastRow = Math.max(sheet.getLastRow(), 500);
      protection.setUnprotectedRanges([sheet.getRange(2, REVIEW_SHEET_ADMIN_COL, lastRow, 1)]);
      protection.setDescription('Review \u2014 Admin Review editable');
    }

    // Add reviewers as editors on ALL sheet protections
    // They can view all sheets but only edit unprotected ranges (Review's Admin Review)
    if (reviewerEmails.length > 0) {
      protection.addEditors(reviewerEmails);
    }

    protectedCount++;
  }

  Logger.log('Protected ' + protectedCount + ' sheets. Reviewers: ' + (reviewerEmails.length || 'none'));
  SpreadsheetApp.getUi().alert('Protection set on all ' + protectedCount + ' sheets.\n\n' +
    'Reviewers can ONLY edit the "Admin Review" column on the Review sheet.\n' +
    'All other sheets and columns are locked.\n\n' +
    'Reviewers: ' + (reviewerEmails.length > 0 ? reviewerEmails.join(', ') : 'none \u2014 use "Add Reviewer Access" to add.'));
}

/**
 * Add a reviewer who can edit the Admin Review column.
 * They get: sheet-level editor on the unprotected range + spreadsheet viewer access.
 * They will NOT see the hidden user_id column or be able to edit other columns.
 */
function addReviewerAccess() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('Add Reviewer',
    'Enter the email address of the person who should be able to approve/reject users:',
    ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var email = resp.getResponseText().trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) {
    ui.alert('Invalid email address.');
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reviewSheet = ss.getSheetByName('Review');
  if (!reviewSheet) { ui.alert('Review sheet not found. Run Sync first.'); return; }

  // 1. Share the spreadsheet as editor (required for Google Sheets protection to work)
  try {
    ss.addEditor(email);
  } catch (e) {
    // May already have access — fine
  }

  // 2. Save to Script Properties for persistence across protection resets
  try {
    var props = PropertiesService.getScriptProperties();
    var existing = props.getProperty('REVIEWER_EMAILS') || '';
    var emails = existing.split(',').map(function(e) { return e.trim(); }).filter(Boolean);
    if (emails.indexOf(email) === -1) emails.push(email);
    props.setProperty('REVIEWER_EMAILS', emails.join(','));
  } catch (e) { /* non-critical */ }

  // 3. Re-run protection setup to lock reviewers out of everything except Review's Admin Review
  setupUsersProtection();

  ui.alert('Access Granted',
    email + ' can now:\n' +
    '  \u2022 View all sheets (read-only)\n' +
    '  \u2022 Edit the Admin Review dropdown on the Review sheet\n' +
    '  \u2022 Trigger approve/reject via the dropdown\n\n' +
    'All other sheets and columns are locked.',
    ui.ButtonSet.OK);
}

/**
 * Remove a reviewer's access.
 */
function removeReviewerAccess() {
  var ui = SpreadsheetApp.getUi();

  // Show current reviewers
  var currentEmails = '';
  try {
    currentEmails = PropertiesService.getScriptProperties().getProperty('REVIEWER_EMAILS') || '';
  } catch (e) {}

  var resp = ui.prompt('Remove Reviewer',
    'Current reviewers: ' + (currentEmails || '(none)') +
    '\n\nEnter the email to remove:',
    ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var email = resp.getResponseText().trim().toLowerCase();
  if (!email) return;

  // Remove from saved list
  try {
    var props = PropertiesService.getScriptProperties();
    var emails = (props.getProperty('REVIEWER_EMAILS') || '').split(',')
      .map(function(e) { return e.trim(); })
      .filter(function(e) { return e && e !== email; });
    props.setProperty('REVIEWER_EMAILS', emails.join(','));
  } catch (e) {}

  // Re-run protection setup to remove from all sheet protections
  setupUsersProtection();

  ui.alert('Removed', email + ' can no longer edit Admin Review.', ui.ButtonSet.OK);
}

/**
 * Install the onEdit trigger as an INSTALLABLE trigger.
 * Simple onEdit can't use UrlFetchApp or UI dialogs.
 * Run once from the Flent Admin menu.
 */
function setupEditTrigger() {
  // Remove any existing onAdminReviewEdit triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onAdminReviewEdit') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('onAdminReviewEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert('Edit trigger installed!\n\nChanging the Admin Review dropdown on the Users sheet will now show a confirmation dialog and call the backend.');
}

// ============================================================================
// DATA FETCHING
// ============================================================================

function fetchAllViews() {
  var key = getServiceKey();
  var adminKey = getAdminKey();
  var headers = { 'apikey': SUPABASE_PUBLISHABLE_KEY, 'Authorization': 'Bearer ' + key };

  // Fetch views via edge function with body-based admin_key auth
  // (Supabase relay strips/replaces Authorization for opaque keys,
  //  but still requires it to accept the request)
  var viewsResp = UrlFetchApp.fetch(SUPABASE_URL + '/functions/v1/admin-fetch-views', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({ admin_key: adminKey }),
    muteHttpExceptions: true
  });
  var payResp = UrlFetchApp.fetch(SUPABASE_URL + '/functions/v1/admin-payment-data', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({ admin_key: adminKey }),
    muteHttpExceptions: true
  });

  var views = {};
  if (viewsResp.getResponseCode() === 200) {
    views = JSON.parse(viewsResp.getContentText());
  } else {
    Logger.log('admin-fetch-views error: ' + viewsResp.getContentText());
  }

  return {
    users: views.user_funnel || [],
    payments: parseResp(payResp, 'admin-payment-data'),
    m360: views.m360 || [],
    verifications: views.verifications || [],
    riskDetail: views.risk_detail || [],
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
// AUTO-AUDIT — calls pre-approval-audit edge function
// ============================================================================

function runBatchAudit(userIds, autoFix) {
  var key = getServiceKey();
  var batchSize = 50;
  var allResults = [];

  for (var i = 0; i < userIds.length; i += batchSize) {
    var batch = userIds.slice(i, i + batchSize);
    try {
      var resp = UrlFetchApp.fetch(SUPABASE_URL + '/functions/v1/pre-approval-audit', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'apikey': SUPABASE_PUBLISHABLE_KEY, 'Authorization': 'Bearer ' + key },
        payload: JSON.stringify({ user_ids: batch, auto_fix: !!autoFix }),
        muteHttpExceptions: true,
      });

      if (resp.getResponseCode() === 200) {
        var data = JSON.parse(resp.getContentText());
        if (data.users && Array.isArray(data.users)) {
          allResults = allResults.concat(data.users);
        }
      } else {
        Logger.log('Audit batch failed (' + resp.getResponseCode() + '): ' + resp.getContentText().substring(0, 200));
      }
    } catch (e) {
      Logger.log('Audit batch error: ' + e.message);
    }
  }

  return allResults;
}

function mergeAuditResults(users, auditResults) {
  var auditMap = {};
  auditResults.forEach(function(r) {
    auditMap[r.user_id] = r;
  });

  users.forEach(function(u) {
    var audit = auditMap[u.user_id];
    if (!audit) return;
    u._audit_status = audit.status; // READY, WARNING, BLOCKED
    var fixCount = (audit.auto_fixes || []).filter(function(f) { return f.success; }).length;
    u._audit_fixes = fixCount > 0 ? fixCount + ' fixed' : '';
  });
}

// ============================================================================
// USERS SHEET (12 columns — clean operator view + Flent Tenant match)
// ============================================================================

function writeUsersSheet(data, tenantMap) {
  var sheet = getOrCreateSheet('Users');
  var headers = ['ID', 'Phone', 'Status', 'Name', 'Rent (\u20B9)', 'Address', 'Google Maps',
                 'Security Deposit (\u20B9)', 'Sign Up', 'Wait Hours', 'SLA', 'Risk', 'Admin Review',
                 'Extraction', 'Queue #', 'Audit Status', 'Missing Data', 'Flent Tenant'];
  var widths = [50, 130, 110, 200, 100, 280, 100, 140, 170, 90, 70, 90, 120, 100, 60, 100, 200, 180];
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

    // Wait hours + SLA — show for all users who entered the waitlist
    var hoursSince = '';
    var slaBreach = '';
    if (r.waitlist_joined_at) {
      var joinedAt = new Date(r.waitlist_joined_at);
      var diffHours = Math.round((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60));
      hoursSince = diffHours;
      if (r.user_status === 'waitlisted' && r.admin_review === 'due') {
        // Actively waiting for review — track SLA breach
        slaBreach = diffHours > 24 ? 'BREACHED' : 'OK';
      } else {
        // Already reviewed (approved/rejected) or no longer waitlisted
        slaBreach = 'OK';
      }
    }

    // Audit: ready-to-approve check + missing data
    var missingData = [];
    if (!r.extraction_id) {
      missingData.push('\u26A0 Re-upload needed');
    } else if (r.extraction_status !== 'completed') {
      missingData.push('Agreement (' + (r.extraction_status || 'unknown') + ')');
    }
    if (!r.property_address) missingData.push('Address');
    if (!r.landlord_display_name && !r.landlord_name) missingData.push('Landlord');
    if (!r.monthly_rent_paise || r.monthly_rent_paise === 0) missingData.push('Rent');
    if (!r.lease_start_date) missingData.push('Lease Start');
    if (!r.lease_end_date) missingData.push('Lease End');
    if (r.m360_status !== 'SUCCESS' && !r.m360_full_name) missingData.push('M360 Identity');
    if (!r.property_city) missingData.push('City');
    if (!r.risk_level || r.risk_level === 'PENDING') missingData.push('Risk Score');
    if (!r.waitlist_position && r.waitlist_position !== 0) missingData.push('Waitlist');
    if (r.user_status === 'waitlisted' && !r.extraction_id) missingData.push('Extraction Link');
    // Prefer server audit status if available, else compute locally
    var auditStatus = r._audit_status || (missingData.length === 0 ? 'READY' : 'BLOCKED');

    return [
      r.user_id || '',
      displayPhone(r.phone),
      r.user_status || '',
      name,
      rent,
      r.property_address || '',
      mapsUrl ? 'View Map' : '',
      rent, // security deposit = rent proxy
      r.signed_up_at ? toIST(r.signed_up_at) : '',
      hoursSince,
      slaBreach,
      r.risk_level || '',
      r.admin_review || '',
      r.extraction_status || '',
      r.waitlist_position || '',
      auditStatus,
      missingData.join(', '),
      tenantLabel,
    ];
  });

  writeSheetData(sheet, headers, rows, widths);
  sheet.hideColumns(1); // Hide user_id column

  // Hyperlinks for Google Maps (col 7)
  for (var i = 0; i < mapsUrls.length; i++) {
    if (mapsUrls[i]) {
      var cell = sheet.getRange(i + 2, 7);
      cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText('View Map').setLinkUrl(mapsUrls[i]).build());
      cell.setFontColor(C.LINK);
    }
  }

  // Conditional formatting
  var rc = rows.length;
  if (rc > 0) {
    applyStatusColors(sheet, 3, rc, statusRules());        // Status col 3
    sheet.getRange(2, 5, rc, 1).setNumberFormat('\u20B9#,##0');  // Rent col 5
    sheet.getRange(2, 8, rc, 1).setNumberFormat('\u20B9#,##0');  // Security Deposit col 8
    sheet.getRange(2, 9, rc, 1).setNumberFormat('dd-MMM-yyyy h:mm AM/PM');  // Sign Up col 9
    sheet.getRange(2, 10, rc, 1).setHorizontalAlignment('center'); // Hours Since col 10
    // SLA col 11
    applyStatusColors(sheet, 11, rc, {
      'breached': { bg: C.RED_BG, fg: C.RED },
      'BREACHED': { bg: C.RED_BG, fg: C.RED },
      'ok': { bg: C.GREEN_BG, fg: C.GREEN },
      'OK': { bg: C.GREEN_BG, fg: C.GREEN },
    });
    applyStatusColors(sheet, 12, rc, riskRules());           // Risk col 12
    applyStatusColors(sheet, 13, rc, reviewRules());        // Admin Review col 13
    // Data validation dropdown on Admin Review col 13
    var reviewValidation = SpreadsheetApp.newDataValidation()
      .requireValueInList(['due', 'in_progress', 'approved', 'rejected'], true)
      .setAllowInvalid(false)
      .setHelpText('Select: due, in_progress, approved, or rejected')
      .build();
    sheet.getRange(2, 13, rc, 1).setDataValidation(reviewValidation);
    // Extraction Status col 14
    applyStatusColors(sheet, 14, rc, {
      'completed': { bg: C.GREEN_BG, fg: C.GREEN },
      'processing': { bg: C.AMBER_BG, fg: C.AMBER },
      'pending': { bg: C.AMBER_BG, fg: C.AMBER },
      'manual_review': { bg: C.AMBER_BG, fg: C.AMBER },
      'failed': { bg: C.RED_BG, fg: C.RED },
    });
    // Queue # col 15
    sheet.getRange(2, 15, rc, 1).setHorizontalAlignment('center');
    // Audit Status col 16
    applyStatusColors(sheet, 16, rc, {
      'ready': { bg: C.GREEN_BG, fg: C.GREEN },
      'READY': { bg: C.GREEN_BG, fg: C.GREEN },
      'warning': { bg: C.AMBER_BG, fg: C.AMBER },
      'WARNING': { bg: C.AMBER_BG, fg: C.AMBER },
      'blocked': { bg: C.RED_BG, fg: C.RED },
      'BLOCKED': { bg: C.RED_BG, fg: C.RED },
    });
    // Missing Data col 17
    sheet.getRange(2, 17, rc, 1).setWrap(true).setFontSize(9).setFontColor(C.MUTED);
    // Flent Tenant col 18
    applyStatusColors(sheet, 18, rc, tenantRules());
    // Text wrap on Address column (col 6)
    sheet.getRange(2, 6, rc, 1).setWrap(true);
  }

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2); // Freeze Phone column (ID is hidden col 1)
}

// ============================================================================
// REVIEW SHEET — Simplified view for external reviewers (approve/reject only)
// ============================================================================

function writeReviewSheet(data) {
  var sheet = getOrCreateSheet('Review');
  // Only show review candidates (waitlisted or agreement_confirmed)
  var filtered = data.filter(function(r) {
    return r.user_status === 'waitlisted' || r.user_status === 'agreement_confirmed';
  });

  var headers = ['ID', 'Phone', 'Name', 'Status', 'Rent (\u20B9)', 'City', 'Risk', 'Audit Status', 'Missing Data', 'Admin Review'];
  var widths = [50, 130, 200, 110, 100, 120, 90, 100, 220, 120];

  var rows = filtered.map(function(r) {
    var name = r.m360_full_name || r.name || '';
    var rent = r.monthly_rent_paise ? Math.round(r.monthly_rent_paise / 100) : '';

    // Compute audit status + missing data (same logic as Users sheet)
    var missingData = [];
    if (!r.extraction_id) {
      missingData.push('\u26A0 Re-upload needed');
    } else if (r.extraction_status !== 'completed') {
      missingData.push('Agreement (' + (r.extraction_status || 'unknown') + ')');
    }
    if (!r.property_address) missingData.push('Address');
    if (!r.landlord_display_name && !r.landlord_name) missingData.push('Landlord');
    if (!r.monthly_rent_paise || r.monthly_rent_paise === 0) missingData.push('Rent');
    if (!r.lease_start_date) missingData.push('Lease Start');
    if (!r.lease_end_date) missingData.push('Lease End');
    if (r.m360_status !== 'SUCCESS' && !r.m360_full_name) missingData.push('M360 Identity');
    if (!r.risk_level || r.risk_level === 'PENDING') missingData.push('Risk Score');
    var auditStatus = r._audit_status || (missingData.length === 0 ? 'READY' : 'BLOCKED');

    return [
      r.user_id || '',
      displayPhone(r.phone),
      name,
      r.user_status || '',
      rent,
      r.property_city || '',
      r.risk_level || '',
      auditStatus,
      missingData.join(', '),
      r.admin_review || '',
    ];
  });

  writeSheetData(sheet, headers, rows, widths);
  sheet.hideColumns(1); // Hide user_id column

  var rc = rows.length;
  if (rc > 0) {
    applyStatusColors(sheet, 4, rc, statusRules());       // Status col 4
    sheet.getRange(2, 5, rc, 1).setNumberFormat('\u20B9#,##0'); // Rent col 5
    applyStatusColors(sheet, 7, rc, riskRules());          // Risk col 7
    // Audit Status col 8
    applyStatusColors(sheet, 8, rc, {
      'ready': { bg: C.GREEN_BG, fg: C.GREEN },
      'READY': { bg: C.GREEN_BG, fg: C.GREEN },
      'warning': { bg: C.AMBER_BG, fg: C.AMBER },
      'WARNING': { bg: C.AMBER_BG, fg: C.AMBER },
      'blocked': { bg: C.RED_BG, fg: C.RED },
      'BLOCKED': { bg: C.RED_BG, fg: C.RED },
    });
    // Missing Data col 9
    sheet.getRange(2, 9, rc, 1).setWrap(true).setFontSize(9).setFontColor(C.MUTED);
    // Admin Review dropdown col 10
    applyStatusColors(sheet, 10, rc, reviewRules());
    var reviewValidation = SpreadsheetApp.newDataValidation()
      .requireValueInList(['due', 'in_progress', 'approved', 'rejected'], true)
      .setAllowInvalid(false)
      .setHelpText('Select: due, in_progress, approved, or rejected')
      .build();
    sheet.getRange(2, REVIEW_SHEET_ADMIN_COL, rc, 1).setDataValidation(reviewValidation);
  }

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1); // Freeze ID col (hidden)
}

// ============================================================================
// RISK SHEET — Verification match statuses and agreement quality
// ============================================================================

function writeRiskSheet(data) {
  var sheet = getOrCreateSheet('Risk');

  var headers = [
    'Phone', 'Name', 'Status', 'Risk Level', 'Admin Review',
    'Tenant Name', 'M360 Name', 'Agreement Tenant', 'Name Score',
    'Penny Drop', 'Bank Holder', 'Agreement Landlord', 'Bank Score',
    'Utility', 'Landlord', 'Agreement Status',
    'Confidence', 'Manual Review?', 'Lease End', 'Expired?'
  ];
  var widths = [
    130, 200, 110, 90, 100,
    100, 200, 200, 80,
    110, 200, 200, 80,
    100, 110, 120,
    80, 90, 110, 70
  ];

  var verdictRules = {
    'match': { bg: C.GREEN_BG, fg: C.GREEN },
    'MATCH': { bg: C.GREEN_BG, fg: C.GREEN },
    'verified': { bg: C.GREEN_BG, fg: C.GREEN },
    'VERIFIED': { bg: C.GREEN_BG, fg: C.GREEN },
    'ok': { bg: C.GREEN_BG, fg: C.GREEN },
    'OK': { bg: C.GREEN_BG, fg: C.GREEN },
    'partial': { bg: C.AMBER_BG, fg: C.AMBER },
    'PARTIAL': { bg: C.AMBER_BG, fg: C.AMBER },
    'pending': { bg: C.AMBER_BG, fg: C.AMBER },
    'PENDING': { bg: C.AMBER_BG, fg: C.AMBER },
    'pending_response': { bg: C.AMBER_BG, fg: C.AMBER },
    'PENDING_RESPONSE': { bg: C.AMBER_BG, fg: C.AMBER },
    'low_confidence': { bg: C.AMBER_BG, fg: C.AMBER },
    'LOW_CONFIDENCE': { bg: C.AMBER_BG, fg: C.AMBER },
    'no_match': { bg: C.RED_BG, fg: C.RED },
    'NO_MATCH': { bg: C.RED_BG, fg: C.RED },
    'failed': { bg: C.RED_BG, fg: C.RED },
    'FAILED': { bg: C.RED_BG, fg: C.RED },
    'expired': { bg: C.RED_BG, fg: C.RED },
    'EXPIRED': { bg: C.RED_BG, fg: C.RED },
    'manual_review': { bg: C.RED_BG, fg: C.RED },
    'MANUAL_REVIEW': { bg: C.RED_BG, fg: C.RED },
    'incomplete': { bg: C.RED_BG, fg: C.RED },
    'INCOMPLETE': { bg: C.RED_BG, fg: C.RED },
    'no_agreement': { bg: C.RED_BG, fg: C.RED },
    'NO_AGREEMENT': { bg: C.RED_BG, fg: C.RED },
    'not_attempted': { bg: C.MUTED_BG, fg: C.MUTED },
    'NOT_ATTEMPTED': { bg: C.MUTED_BG, fg: C.MUTED },
    'not_invited': { bg: C.MUTED_BG, fg: C.MUTED },
    'NOT_INVITED': { bg: C.MUTED_BG, fg: C.MUTED },
  };

  var rows = data.map(function(r) {
    // Tenant name verdict
    var tenantVerdict = 'PENDING';
    if (r.tenant_match_score !== null && r.tenant_match_score !== undefined) {
      if (r.tenant_match_score >= 70) tenantVerdict = 'MATCH';
      else if (r.tenant_match_score >= 40) tenantVerdict = 'PARTIAL';
      else tenantVerdict = 'NO_MATCH';
    }

    // Penny drop verdict
    var pennyVerdict = 'NOT_ATTEMPTED';
    if (r.bank_verified) {
      pennyVerdict = 'MATCH';
    } else if (r.penny_drop_status === 'FAILED') {
      pennyVerdict = 'FAILED';
    } else if (r.penny_drop_status === 'SUCCESS' || r.penny_drop_status === 'PENDING') {
      pennyVerdict = 'PENDING';
    } else if (r.bank_holder_name) {
      // Penny drop returned a name but no match yet
      pennyVerdict = r.bank_name_match_score >= 40 ? 'PARTIAL' : 'NO_MATCH';
    }

    // Utility verdict
    var utilityVerdict = 'NOT_ATTEMPTED';
    if (r.tenancy_utility_verified) {
      utilityVerdict = 'MATCH';
    } else if (r.utility_status === 'success') {
      utilityVerdict = r.utility_address_verified ? 'MATCH' : 'PARTIAL';
    } else if (r.utility_status === 'failed') {
      utilityVerdict = 'FAILED';
    } else if (r.utility_status === 'pending') {
      utilityVerdict = 'PENDING';
    }

    // Landlord verdict
    var landlordVerdict = 'NOT_INVITED';
    if (r.landlord_approved) {
      landlordVerdict = 'VERIFIED';
    } else if (r.landlord_status === 'invited') {
      landlordVerdict = 'PENDING_RESPONSE';
    } else if (r.landlord_status === 'rejected') {
      landlordVerdict = 'FAILED';
    }

    // Agreement expired check
    var expired = '';
    if (r.lease_end_date) {
      var endDate = new Date(r.lease_end_date);
      if (!isNaN(endDate.getTime()) && endDate < new Date()) expired = 'YES';
      else expired = 'No';
    }

    // Confidence as percentage
    var confidence = '';
    if (r.extraction_confidence !== null && r.extraction_confidence !== undefined) {
      var pct = r.extraction_confidence > 1 ? r.extraction_confidence : Math.round(r.extraction_confidence * 100);
      confidence = pct + '%';
    }

    return [
      displayPhone(r.phone),
      r.name || '',
      r.user_status || '',
      r.risk_level || '',
      r.admin_review || '',
      tenantVerdict,
      r.m360_full_name || '',
      r.agreement_tenant_name || '',
      r.tenant_match_score !== null && r.tenant_match_score !== undefined ? r.tenant_match_score : '',
      pennyVerdict,
      r.bank_holder_name || '',
      r.agreement_landlord_name || '',
      r.bank_name_match_score !== null && r.bank_name_match_score !== undefined ? r.bank_name_match_score : '',
      utilityVerdict,
      landlordVerdict,
      r.agreement_verdict || '',
      confidence,
      r.needs_manual_review ? 'YES' : '',
      r.lease_end_date || '',
      expired,
    ];
  });

  writeSheetData(sheet, headers, rows, widths);

  var rc = rows.length;
  if (rc > 0) {
    applyStatusColors(sheet, 3, rc, statusRules());         // Status col 3
    applyStatusColors(sheet, 4, rc, riskRules());            // Risk Level col 4
    applyStatusColors(sheet, 5, rc, reviewRules());          // Admin Review col 5
    applyStatusColors(sheet, 6, rc, verdictRules);           // Tenant Name verdict col 6
    sheet.getRange(2, 9, rc, 1).setHorizontalAlignment('center'); // Name Score col 9
    applyStatusColors(sheet, 10, rc, verdictRules);          // Penny Drop verdict col 10
    sheet.getRange(2, 13, rc, 1).setHorizontalAlignment('center'); // Bank Score col 13
    applyStatusColors(sheet, 14, rc, verdictRules);          // Utility verdict col 14
    applyStatusColors(sheet, 15, rc, verdictRules);          // Landlord verdict col 15
    applyStatusColors(sheet, 16, rc, verdictRules);          // Agreement Status col 16
    sheet.getRange(2, 17, rc, 1).setHorizontalAlignment('center'); // Confidence col 17
    // Manual Review col 18
    applyStatusColors(sheet, 18, rc, {
      'yes': { bg: C.RED_BG, fg: C.RED },
      'YES': { bg: C.RED_BG, fg: C.RED },
    });
    // Expired col 20
    applyStatusColors(sheet, 20, rc, {
      'yes': { bg: C.RED_BG, fg: C.RED },
      'YES': { bg: C.RED_BG, fg: C.RED },
      'no': { bg: C.GREEN_BG, fg: C.GREEN },
      'No': { bg: C.GREEN_BG, fg: C.GREEN },
    });
  }

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2); // Freeze Phone + Name
}

// ============================================================================
// USER DETAILS SHEET (~42 columns, grouped with sub-header bands)
// ============================================================================

function writeUserDetailsSheet(data) {
  var sheet = getOrCreateSheet('User Details');

  // Column groups with sub-header coloring
  var groups = [
    { label: 'User', color: C.HEADER, cols: [
      { key: 'user_id', header: 'ID' },
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
    { label: 'Audit', color: C.HEADER, cols: [
      { key: '_audit_status', header: 'Audit Status' },
      { key: '_audit_fixes', header: 'Auto Fixes' },
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
      if (c.key === '_audit_status') return r._audit_status || '';
      if (c.key === '_audit_fixes') return r._audit_fixes || '';
      var val = r[c.key];
      if (val === null || val === undefined) return '';
      if (c.key === 'phone' || c.key === 'landlord_phone') return displayPhone(val);
      if (c.fmt === 'paise') return Math.round(val / 100);
      if ((c.fmt === 'date' || c.fmt === 'datetime') && val) return toIST(val);
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

    // Audit Status coloring
    var auditStatusIdx = allCols.findIndex(function(c) { return c.key === '_audit_status'; }) + 1;
    if (auditStatusIdx > 0) {
      var auditRange = sheet.getRange(2, auditStatusIdx, rc, 1);
      var auditVals = auditRange.getValues();
      auditRange.setBackgrounds(auditVals.map(function(v) {
        if (v[0] === 'READY') return [C.GREEN_BG];
        if (v[0] === 'WARNING') return [C.AMBER_BG];
        if (v[0] === 'BLOCKED') return [C.RED_BG];
        return [C.MUTED_BG];
      }));
      auditRange.setFontColors(auditVals.map(function(v) {
        if (v[0] === 'READY') return [C.GREEN];
        if (v[0] === 'WARNING') return [C.AMBER];
        if (v[0] === 'BLOCKED') return [C.RED];
        return [C.MUTED];
      }));
      auditRange.setFontWeight('bold').setHorizontalAlignment('center');
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

  // Hide user_id column (col 1)
  sheet.hideColumns(1);

  // Hide sensitive columns
  var incomeIdx = allCols.findIndex(function(c) { return c.key === 'm360_total_income'; }) + 1;
  if (incomeIdx > 0) sheet.hideColumns(incomeIdx);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
}

// ============================================================================
// LANDLORDS SHEET
// ============================================================================

function writeLandlordsSheet(data) {
  var sheet = getOrCreateSheet('Landlords');
  var headers = ['Landlord Name', 'Landlord Phone', 'Property Address', 'City', 'State',
                 'Tenant Name', 'Tenant Phone', 'Rent (\u20B9)',
                 'Bank A/C', 'IFSC', 'Bank Holder Name', 'Bank Verified',
                 'Lease Start', 'Lease End', 'LL Approved'];
  var widths = [180, 130, 280, 100, 100, 180, 130, 100, 150, 120, 180, 100, 110, 110, 110];

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
      r.ll_bank_account_masked || '',
      r.ll_bank_ifsc || '',
      r.ll_bank_holder_name || '',
      r.ll_bank_verified === true ? '\u2713' : r.ll_bank_verified === false ? '\u2717' : '',
      r.lease_start_date || '',
      r.lease_end_date || '',
      r.landlord_approved === true ? '\u2713' : r.landlord_approved === false ? '\u2717' : '',
    ]);
  });

  writeSheetData(sheet, headers, rows, widths);
  var rc = rows.length;
  if (rc > 0) {
    sheet.getRange(2, 8, rc, 1).setNumberFormat('\u20B9#,##0');
    // Bool coloring for Bank Verified (col 12)
    var bankVerifiedRange = sheet.getRange(2, 12, rc, 1);
    var bvVals = bankVerifiedRange.getValues();
    bankVerifiedRange.setBackgrounds(bvVals.map(function(v) {
      return [v[0] === '\u2713' ? C.GREEN_BG : v[0] === '\u2717' ? C.RED_BG : C.ROW_EVEN];
    }));
    bankVerifiedRange.setFontColors(bvVals.map(function(v) {
      return [v[0] === '\u2713' ? C.GREEN : v[0] === '\u2717' ? C.RED : C.MUTED];
    }));
    bankVerifiedRange.setFontWeight('bold').setHorizontalAlignment('center');
    // Bool coloring for LL Approved (col 15)
    var approvedRange = sheet.getRange(2, 15, rc, 1);
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
      if ((c.fmt === 'date' || c.fmt === 'datetime') && val) return toIST(val);
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
  // Freeze first group boundary (3 = User group has 3 cols: Phone, Name, Status)
  // to avoid cutting through merged header cells in row 1
  try { sheet.setFrozenColumns(3); } catch (e) { Logger.log('Freeze cols skipped: ' + e.message); }
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
  // Ensure enough rows exist before writing (Legends needs ~100 rows for all sections)
  if (sheet.getMaxRows() < 150) {
    sheet.insertRowsAfter(sheet.getMaxRows(), 150 - sheet.getMaxRows());
  }

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
      { value: 'agreement_confirmed', label: 'Agreement Confirmed', desc: 'User confirmed extracted agreement data', badge: BADGE.amber },
      { value: 'waitlisted', label: 'Waitlisted', desc: 'Pending admin review in waitlist queue', badge: BADGE.amber },
      { value: 'approved', label: 'Approved', desc: 'Admin approved, can proceed to payment', badge: BADGE.green },
      { value: 'active', label: 'Active', desc: 'Completed first payment, fully onboarded', badge: BADGE.green },
      { value: 'not_eligible', label: 'Not Eligible', desc: 'Rejected or ineligible for service', badge: BADGE.red },
    ]},
    { title: 'Admin Review', sheet: 'Users / User Details', items: [
      { value: 'due', label: 'Due', desc: 'Not yet reviewed by admin', badge: BADGE.amber },
      { value: 'in_progress', label: 'In Progress', desc: 'Admin is reviewing the application', badge: BADGE.amber },
      { value: 'approved', label: 'Approved', desc: 'Admin approved the application', badge: BADGE.green },
      { value: 'rejected', label: 'Rejected', desc: 'Admin rejected the application', badge: BADGE.red },
    ]},
    { title: 'Tenancy Status', sheet: 'User Details', items: [
      { value: 'pending_verification', label: 'Pending Verification', desc: 'Tenancy created, awaiting admin approval', badge: BADGE.amber },
      { value: 'active', label: 'Active', desc: 'Tenancy verified and active', badge: BADGE.green },
      { value: 'expired', label: 'Expired', desc: 'Lease period ended', badge: BADGE.muted },
      { value: 'terminated', label: 'Terminated', desc: 'Tenancy cancelled or terminated', badge: BADGE.red },
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
      if ((c.fmt === 'date' || c.fmt === 'datetime') && val) return toIST(val);
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
    { key: 'll_bank_account', header: 'LL Bank A/C', fmt: 'text' },
    { key: 'll_bank_ifsc', header: 'LL IFSC', fmt: 'text' },
    { key: 'll_bank_holder', header: 'LL Bank Holder' },
  ];
  var headers = cols.map(function(c) { return c.header; });
  var rows = data.map(function(r) {
    return cols.map(function(c) {
      var val = r[c.key];
      if (val === null || val === undefined) return '';
      if (c.fmt === 'paise') return Math.round(val / 100);
      if ((c.fmt === 'date' || c.fmt === 'datetime') && val) return toIST(val);
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
    // Currency, date, and text formatting
    cols.forEach(function(c, idx) {
      if (c.fmt === 'paise') sheet.getRange(2, idx + 1, rc, 1).setNumberFormat('\u20B9#,##0');
      if (c.fmt === 'date') sheet.getRange(2, idx + 1, rc, 1).setNumberFormat('dd-MMM-yyyy');
      if (c.fmt === 'text') sheet.getRange(2, idx + 1, rc, 1).setNumberFormat('@');
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
