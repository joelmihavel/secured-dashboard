# Archived audit reports

These reports were point-in-time audits at their original creation date. They were moved here on 2026-04-25 because the systems they audit have evolved significantly — most notably the Cashfree migration completed mid-March 2026, the Cloud Run extraction service Phase-0/Phase-2 work landed Apr 9, and the stamp verification pipeline shipped Apr 24.

They are kept for historical reference (debugging "why was X done that way?") but should not be treated as descriptions of the current system. For current-state docs see `docs/backend/` and `docs/infrastructure/`.

| File | Original date | What it audited | Why archived |
|---|---|---|---|
| BACKEND_E2E_AUDIT_REPORT.md | 2026-01-30 | Full backend at v2.0 | Predates Cashfree, M360, stamp-verification, Cloud Run |
| audit-document-ai-ocr-reliability.md | 2026-04-03 | Document AI failure modes | Superseded by `c742e4bd` DocAI 15-page imagelessMode + Gemini fallback |
| audit-error-handling-process-document.md | 2026-04-03 | process-document error paths | Superseded by Cloud Run extraction-service moving most of this logic out |
| audit-gemini-safety-filter-edge-cases.md | 2026-04-03 | Gemini safety filter triggers on rent agreements | Findings still relevant; kept as reference |
| audit-retry-logic-process-document.md | 2026-04-03 | Retry behavior in extraction | Superseded by extraction-recovery cron + Cloud Run heartbeat pattern |
