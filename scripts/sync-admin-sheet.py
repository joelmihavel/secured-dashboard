#!/usr/bin/env python3
"""
sync-admin-sheet.py -- Sync Review and Risk sheets in the Flent Admin Dashboard.

Queries Supabase views directly via REST API, then writes
the Review and Risk tabs to the existing Google Sheet via Sheets API.

Auth:
  - Google Sheets: service account at SA_KEY_PATH (see below)
  - Supabase: service role key from `supabase` CLI

Usage:
  python3 scripts/sync-admin-sheet.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

SA_KEY_PATH = "/Users/atrishabh/Documents/Dev/mcp-access-481804-4fa603a53bd4.json"
QUOTA_PROJECT = "mcp-access-481804"

SPREADSHEET_ID = "114HbdCPKcFZvU5iFt8OWSXlKpJ6O8rEQVKInOA5jcIo"
SUPABASE_URL = "https://uowjtrzmszuaiokqxgir.supabase.co"
SUPABASE_PUBLISHABLE_KEY = "sb_publishable_c80tL8IG3x46DQhLQ7WKfg_QUgIMI2x"

REVIEW_HEADERS = [
    "ID", "Phone", "Name", "Status", "Rent (\u20b9)",
    "City", "Risk", "Audit Status", "Missing Data", "Admin Review",
]

RISK_HEADERS = [
    "Phone", "Name", "Status", "Risk Level", "Admin Review",
    "Tenant Name", "M360 Name", "Agreement Tenant", "Name Score",
    "Penny Drop", "Bank Holder", "Agreement Landlord", "Bank Score",
    "Utility", "Landlord", "Agreement Status",
    "Confidence", "Manual Review?", "Lease End", "Expired?",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def die(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def display_phone(raw: Any) -> str:
    if not raw:
        return ""
    s = str(raw).strip()
    return s if s.startswith("+") else f"+{s}"


def curl_json(
    method: str,
    url: str,
    headers: dict[str, str] | None = None,
    body: dict | list | None = None,
    description: str = "",
) -> Any:
    """Execute an HTTP request via curl and return parsed JSON."""
    cmd: list[str] = ["curl", "-s", "-X", method, url]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        die(f"curl failed ({description}): {result.stderr}")
    text = result.stdout.strip()
    if not text:
        die(f"Empty response ({description})")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        die(f"Invalid JSON ({description}): {text[:300]}")


# ---------------------------------------------------------------------------
# Google Sheets auth via service account
# ---------------------------------------------------------------------------


def get_google_token() -> str:
    """Get a Google OAuth2 token using Application Default Credentials.

    Requires: gcloud auth application-default login --scopes=spreadsheets,drive
    """
    import google.auth
    import google.auth.transport.requests

    creds, project = google.auth.default(
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]
    )
    creds.refresh(google.auth.transport.requests.Request())
    if not creds.token:
        die("Failed to obtain Google access token via ADC")
    return creds.token


def sheets_api(
    token: str,
    method: str,
    path: str,
    body: dict | list | None = None,
) -> Any:
    """Call the Google Sheets REST API."""
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "x-goog-user-project": "mcp-access-481804",
    }
    return curl_json(method, url, headers=headers, body=body, description=path)


# ---------------------------------------------------------------------------
# Supabase data fetch
# ---------------------------------------------------------------------------


def get_service_role_key() -> str:
    """Retrieve the Supabase service role key via CLI."""
    r = subprocess.run(
        [
            "bash", "-c",
            "supabase projects api-keys --project-ref uowjtrzmszuaiokqxgir 2>/dev/null"
            " | grep service_role | awk '{print $NF}'",
        ],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    key = r.stdout.strip()
    if not key:
        die("Could not retrieve Supabase service role key. Run `supabase login` first.")
    return key


def fetch_view(service_key: str, view_name: str) -> list[dict]:
    """Query a Supabase view directly via REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{view_name}?select=*"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }
    resp = curl_json("GET", url, headers=headers, description=view_name)
    if isinstance(resp, dict) and ("error" in resp or "message" in resp):
        die(f"View query error ({view_name}): {resp}")
    return resp


def fetch_all_views(service_key: str) -> dict[str, list[dict]]:
    """Fetch all required views directly from Supabase REST API."""
    return {
        "user_funnel": fetch_view(service_key, "v_user_funnel"),
        "risk_detail": fetch_view(service_key, "v_risk_detail"),
    }


# ---------------------------------------------------------------------------
# Sheet helpers
# ---------------------------------------------------------------------------


def get_existing_sheets(token: str) -> dict[str, int]:
    """Return {title: sheetId} for all existing sheets."""
    resp = sheets_api(token, "GET", "?fields=sheets.properties")
    return {
        s["properties"]["title"]: s["properties"]["sheetId"]
        for s in resp.get("sheets", [])
    }


def ensure_sheet(token: str, title: str, existing: dict[str, int]) -> int:
    """Create a sheet if it doesn't exist. Returns sheetId."""
    if title in existing:
        print(f"  Sheet '{title}' already exists (id={existing[title]})")
        return existing[title]

    resp = sheets_api(token, "POST", ":batchUpdate", {
        "requests": [{"addSheet": {"properties": {"title": title}}}]
    })
    if "error" in resp:
        die(f"Failed to create sheet '{title}': {resp['error']}")
    sheet_id = resp["replies"][0]["addSheet"]["properties"]["sheetId"]
    existing[title] = sheet_id
    print(f"  Created sheet '{title}' (id={sheet_id})")
    return sheet_id


def clear_and_write(
    token: str,
    sheet_title: str,
    sheet_id: int,
    headers: list[str],
    rows: list[list[Any]],
) -> None:
    """Clear existing data and write headers + rows."""
    # Clear
    sheets_api(token, "POST", f"/values/{sheet_title}:clear", {})

    all_rows = [headers] + rows
    # Write values
    sheets_api(token, "PUT",
               f"/values/{sheet_title}!A1?valueInputOption=USER_ENTERED",
               {"values": all_rows})

    # Format header row: bold + dark bg
    sheets_api(token, "POST", ":batchUpdate", {"requests": [
        {"repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 0, "endRowIndex": 1,
                "startColumnIndex": 0, "endColumnIndex": len(headers),
            },
            "cell": {"userEnteredFormat": {
                "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
                "backgroundColor": {"red": 0.1, "green": 0.1, "blue": 0.18},
            }},
            "fields": "userEnteredFormat.textFormat,userEnteredFormat.backgroundColor",
        }},
        {"updateSheetProperties": {
            "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount",
        }},
    ]})

    print(f"  Wrote {len(rows)} rows to '{sheet_title}'")


# ---------------------------------------------------------------------------
# Review sheet logic (mirrors Code.js writeReviewSheet)
# ---------------------------------------------------------------------------


def build_review_rows(users: list[dict]) -> list[list[Any]]:
    """Filter to waitlisted/agreement_confirmed and compute missing data."""
    filtered = [
        r for r in users
        if r.get("user_status") in ("waitlisted", "agreement_confirmed")
    ]

    rows: list[list[Any]] = []
    for r in filtered:
        name = r.get("m360_full_name") or r.get("name") or ""
        rent_paise = r.get("monthly_rent_paise")
        rent = round(rent_paise / 100) if rent_paise else ""

        # Compute missing data (same logic as Code.js)
        missing: list[str] = []
        if r.get("extraction_status") != "completed":
            missing.append("Agreement")
        if not r.get("property_address"):
            missing.append("Address")
        if not r.get("landlord_display_name") and not r.get("landlord_name"):
            missing.append("Landlord")
        if not r.get("monthly_rent_paise"):
            missing.append("Rent")
        if not r.get("lease_start_date"):
            missing.append("Lease Start")
        if not r.get("lease_end_date"):
            missing.append("Lease End")
        if r.get("m360_status") != "SUCCESS" and not r.get("m360_full_name"):
            missing.append("M360 Identity")
        if not r.get("risk_level") or r.get("risk_level") == "PENDING":
            missing.append("Risk Score")

        audit_status = r.get("_audit_status") or ("READY" if not missing else "BLOCKED")

        rows.append([
            r.get("user_id", ""),
            display_phone(r.get("phone")),
            name,
            r.get("user_status", ""),
            rent,
            r.get("property_city", ""),
            r.get("risk_level", ""),
            audit_status,
            ", ".join(missing),
            r.get("admin_review", ""),
        ])

    return rows


# ---------------------------------------------------------------------------
# Risk sheet logic (mirrors Code.js writeRiskSheet)
# ---------------------------------------------------------------------------


def build_risk_rows(risk_data: list[dict]) -> list[list[Any]]:
    """Build risk rows with verdict computations."""
    rows: list[list[Any]] = []
    now = datetime.now(timezone.utc)

    for r in risk_data:
        # Tenant name verdict
        score = r.get("tenant_match_score")
        if score is not None:
            if score >= 70:
                tenant_verdict = "MATCH"
            elif score >= 40:
                tenant_verdict = "PARTIAL"
            else:
                tenant_verdict = "NO_MATCH"
        else:
            tenant_verdict = "PENDING"

        # Penny drop verdict
        if r.get("bank_verified"):
            penny_verdict = "MATCH"
        elif r.get("penny_drop_status") == "FAILED":
            penny_verdict = "FAILED"
        elif r.get("penny_drop_status") in ("SUCCESS", "PENDING"):
            penny_verdict = "PENDING"
        elif r.get("bank_holder_name"):
            bank_score = r.get("bank_name_match_score")
            penny_verdict = "PARTIAL" if bank_score and bank_score >= 40 else "NO_MATCH"
        else:
            penny_verdict = "NOT_ATTEMPTED"

        # Utility verdict
        if r.get("tenancy_utility_verified"):
            utility_verdict = "MATCH"
        elif r.get("utility_status") == "success":
            utility_verdict = "MATCH" if r.get("utility_address_verified") else "PARTIAL"
        elif r.get("utility_status") == "failed":
            utility_verdict = "FAILED"
        elif r.get("utility_status") == "pending":
            utility_verdict = "PENDING"
        else:
            utility_verdict = "NOT_ATTEMPTED"

        # Landlord verdict
        if r.get("landlord_approved"):
            landlord_verdict = "VERIFIED"
        elif r.get("landlord_status") == "invited":
            landlord_verdict = "PENDING_RESPONSE"
        elif r.get("landlord_status") == "rejected":
            landlord_verdict = "FAILED"
        else:
            landlord_verdict = "NOT_INVITED"

        # Agreement expired check
        expired = ""
        lease_end = r.get("lease_end_date")
        if lease_end:
            try:
                end_str = str(lease_end).replace("Z", "+00:00")
                end_dt = datetime.fromisoformat(end_str)
                if end_dt.tzinfo is None:
                    end_dt = end_dt.replace(tzinfo=timezone.utc)
                expired = "YES" if end_dt < now else "No"
            except (ValueError, AttributeError):
                pass

        # Confidence as percentage
        confidence = ""
        conf_val = r.get("extraction_confidence")
        if conf_val is not None:
            pct = conf_val if conf_val > 1 else round(conf_val * 100)
            confidence = f"{pct}%"

        rows.append([
            display_phone(r.get("phone")),
            r.get("name", ""),
            r.get("user_status", ""),
            r.get("risk_level", ""),
            r.get("admin_review", ""),
            tenant_verdict,
            r.get("m360_full_name", ""),
            r.get("agreement_tenant_name", ""),
            score if score is not None else "",
            penny_verdict,
            r.get("bank_holder_name", ""),
            r.get("agreement_landlord_name", ""),
            r.get("bank_name_match_score") if r.get("bank_name_match_score") is not None else "",
            utility_verdict,
            landlord_verdict,
            r.get("agreement_verdict", ""),
            confidence,
            "YES" if r.get("needs_manual_review") else "",
            lease_end or "",
            expired,
        ])

    return rows


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    print("=== Flent Admin Sheet Sync (Review + Risk) ===\n")

    # 1. Google auth
    print("[1/4] Authenticating with Google...")
    token = get_google_token()
    print("  Google token obtained")

    # 2. Supabase service key
    print("[2/4] Getting Supabase service role key...")
    service_key = get_service_role_key()
    print("  Service key obtained")

    # 3. Fetch data directly from Supabase REST API
    print("[3/4] Fetching data from Supabase views...")
    views = fetch_all_views(service_key)
    users = views.get("user_funnel", [])
    risk_detail = views.get("risk_detail", [])
    print(f"  Got {len(users)} users, {len(risk_detail)} risk records")

    if not users:
        die("No user data returned. Check admin key and edge function.")

    # Sort users by signup date descending
    users.sort(key=lambda u: u.get("signed_up_at") or "", reverse=True)

    # 4. Write to Google Sheets
    print("[4/4] Writing to Google Sheets...")
    existing = get_existing_sheets(token)
    review_id = ensure_sheet(token, "Review", existing)
    risk_id = ensure_sheet(token, "Risk", existing)

    review_rows = build_review_rows(users)
    clear_and_write(token, "Review", review_id, REVIEW_HEADERS, review_rows)

    risk_rows = build_risk_rows(risk_detail)
    clear_and_write(token, "Risk", risk_id, RISK_HEADERS, risk_rows)

    # Update timestamp in Config if it exists
    if "Config" in existing:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sheets_api(token, "PUT",
                   "/values/Config!B1?valueInputOption=USER_ENTERED",
                   {"values": [[f"Review/Risk synced: {ts}"]]})

    print()
    print("=" * 55)
    print("SYNC COMPLETE")
    print("=" * 55)
    print(f"  Review: {len(review_rows)} rows (waitlisted + agreement_confirmed)")
    print(f"  Risk:   {len(risk_rows)} rows")
    print(f"  Sheet:  https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}")


if __name__ == "__main__":
    main()
