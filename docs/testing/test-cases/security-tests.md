# Security Test Specifications
## Flent Secured - Security Testing Documentation

<!-- FIGMA_STATUS: N/A -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: false -->

---

## Overview

This document specifies security tests for the Flent Secured application. Security testing covers authentication, authorization, data protection, input validation, and common vulnerability categories (OWASP Top 10).

**Scope:**
- Mobile app (React Native)
- Backend APIs (Supabase Edge Functions)
- Data storage (Supabase PostgreSQL, Secure Storage)
- Third-party integrations (Payment gateways)

---

## 1. Authentication Security

### SEC-AUTH-001: OTP Security

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-AUTH-001-A | OTP brute force protection | Attempt 100 OTPs rapidly | Rate limited after 3-5 attempts |
| SEC-AUTH-001-B | OTP expiry enforcement | Use OTP after 5 min | Rejected as expired |
| SEC-AUTH-001-C | OTP single use | Reuse valid OTP | Rejected on second use |
| SEC-AUTH-001-D | OTP not logged | Check server logs | No OTP in logs |
| SEC-AUTH-001-E | OTP transmission security | Intercept traffic | HTTPS only, no plaintext |
| SEC-AUTH-001-F | Timing attack resistance | Measure response times | Consistent timing for valid/invalid |

**Test Procedure:**
```
1. Generate valid OTP for test phone
2. Attempt to use OTP 6 times with wrong codes
3. Verify lockout occurs
4. Wait for lockout expiry (15 min)
5. Attempt with correct OTP
6. Verify success
```

---

### SEC-AUTH-002: Token Security

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-AUTH-002-A | JWT signature validation | Modify JWT payload | Rejected as invalid |
| SEC-AUTH-002-B | JWT expiry check | Use expired token | 401 Unauthorized |
| SEC-AUTH-002-C | Refresh token rotation | Use old refresh token | Revoked, force re-login |
| SEC-AUTH-002-D | Token in secure storage | Inspect app storage | Not in plain text/AsyncStorage |
| SEC-AUTH-002-E | Token not in URL | Check all network calls | Never in query params |
| SEC-AUTH-002-F | Token revocation on logout | Check token after logout | Invalid |

**Test Procedure:**
```
1. Capture valid JWT from login
2. Decode JWT, modify user_id claim
3. Re-encode with original signature
4. Send modified JWT to protected endpoint
5. Verify rejection
```

---

### SEC-AUTH-003: Session Security

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-AUTH-003-A | Concurrent session handling | Login from two devices | Both sessions valid OR one invalidated |
| SEC-AUTH-003-B | Session fixation prevention | Reuse pre-auth session | Session regenerated after auth |
| SEC-AUTH-003-C | Session timeout | Leave app idle 30+ min | Re-authentication required |
| SEC-AUTH-003-D | Cross-device session visibility | Check profile | "Active sessions" shown if feature exists |

---

## 2. Authorization Security

### SEC-AUTHZ-001: API Authorization

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-AUTHZ-001-A | Access other user's data | Modify user_id in request | 403 Forbidden |
| SEC-AUTHZ-001-B | Access without token | Remove Authorization header | 401 Unauthorized |
| SEC-AUTHZ-001-C | Access with wrong role | Use tenant token for admin | 403 Forbidden |
| SEC-AUTHZ-001-D | IDOR on payment ID | Access another's payment | 403/404 |
| SEC-AUTHZ-001-E | IDOR on tenancy ID | Access another's tenancy | 403/404 |

**Test Procedure:**
```
1. Login as User A, get payment ID PA1
2. Login as User B, get token TB
3. Request GET /payments/PA1 with token TB
4. Verify 403 Forbidden (not 200 or 500)
```

---

### SEC-AUTHZ-002: Row Level Security (RLS)

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-AUTHZ-002-A | User isolation | Query all payments | Only own payments returned |
| SEC-AUTHZ-002-B | Direct DB query attempt | Bypass API, query DB | Anon/user role blocked |
| SEC-AUTHZ-002-C | RLS on all tables | Check each table | RLS enabled |
| SEC-AUTHZ-002-D | Service role restriction | Use service key from client | Should not be possible |

---

## 3. Input Validation Security

### SEC-INPUT-001: Injection Prevention

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-INPUT-001-A | SQL injection in phone | `phone='; DROP TABLE users;--` | Sanitized, no SQL error |
| SEC-INPUT-001-B | SQL injection in search | Search with SQL payload | Parameterized query used |
| SEC-INPUT-001-C | NoSQL injection | JSON payload manipulation | Rejected or sanitized |
| SEC-INPUT-001-D | Command injection | Shell chars in input | Rejected or sanitized |

**Test Payloads:**
```
SQL: ' OR '1'='1
SQL: '; DROP TABLE users; --
SQL: 1; UPDATE users SET role='admin' WHERE id=1
NoSQL: {"$gt": ""}
Command: ; ls -la
Command: $(cat /etc/passwd)
```

---

### SEC-INPUT-002: XSS Prevention

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-INPUT-002-A | Script in name field | `<script>alert(1)</script>` | Escaped or stripped |
| SEC-INPUT-002-B | Event handler in input | `<img onerror="alert(1)">` | Escaped or stripped |
| SEC-INPUT-002-C | Stored XSS check | Submit XSS, view profile | Not executed |
| SEC-INPUT-002-D | React native XSS via URL | Deep link with XSS | Not executed |

**Note:** React Native is less susceptible to XSS than web, but still test data display.

---

### SEC-INPUT-003: File Upload Security

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-INPUT-003-A | File type validation | Upload .exe as .pdf | Rejected (content type check) |
| SEC-INPUT-003-B | File size limit | Upload 100MB file | Rejected (max 10MB) |
| SEC-INPUT-003-C | Malware scan | Upload EICAR test file | Blocked or quarantined |
| SEC-INPUT-003-D | Path traversal | Filename: `../../../etc/passwd` | Sanitized filename |
| SEC-INPUT-003-E | Double extension | `file.pdf.exe` | Rejected |

---

## 4. Data Protection Security

### SEC-DATA-001: Data at Rest

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-DATA-001-A | Sensitive data in Keychain/SecureStore | Inspect storage | Tokens in secure storage |
| SEC-DATA-001-B | No sensitive data in AsyncStorage | Inspect AsyncStorage | No tokens/passwords |
| SEC-DATA-001-C | Database encryption | Check Supabase config | At-rest encryption enabled |
| SEC-DATA-001-D | Backup encryption | Check backup content | Encrypted |
| SEC-DATA-001-E | PII handling | Check stored data | Minimal PII, encrypted if needed |

---

### SEC-DATA-002: Data in Transit

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-DATA-002-A | TLS enforcement | Attempt HTTP | Redirected to HTTPS |
| SEC-DATA-002-B | TLS version | Check cipher suites | TLS 1.2+ only |
| SEC-DATA-002-C | Certificate pinning | MITM attack | Connection rejected |
| SEC-DATA-002-D | No sensitive data in logs | Check network logs | No passwords/tokens |
| SEC-DATA-002-E | Payment data masking | Check API responses | Card numbers masked |

---

### SEC-DATA-003: Privacy & Compliance

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-DATA-003-A | Data deletion | Delete account request | All PII removed within 30 days |
| SEC-DATA-003-B | Data export | Request data export | All user data provided |
| SEC-DATA-003-C | Consent tracking | Check consent records | Consent stored with timestamp |
| SEC-DATA-003-D | Minimum data collection | Review data collected | Only necessary data |

---

## 5. Payment Security

### SEC-PAY-001: Payment Flow Security

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-PAY-001-A | Amount tampering | Modify amount client-side | Server recalculates |
| SEC-PAY-001-B | Double payment | Submit same payment twice | Idempotency prevents duplicate |
| SEC-PAY-001-C | Replay attack on webhook | Replay old webhook | Rejected (timestamp check) |
| SEC-PAY-001-D | Webhook signature validation | Modify webhook payload | Rejected (HMAC mismatch) |
| SEC-PAY-001-E | Payment to wrong account | Modify landlord bank | Validated against stored |

---

### SEC-PAY-002: PCI DSS Considerations

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-PAY-002-A | Card data not stored | Check database | No full card numbers |
| SEC-PAY-002-B | Card entry on secure page | Check card input | PG hosted/tokenized |
| SEC-PAY-002-C | CVV not logged | Check all logs | No CVV anywhere |
| SEC-PAY-002-D | Secure card transmission | Check network | Direct to PG, not via backend |

---

## 6. Mobile-Specific Security

### SEC-MOB-001: App Security

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-MOB-001-A | Root/jailbreak detection | Run on rooted device | Warning or block |
| SEC-MOB-001-B | Debugger detection | Attach debugger | Detection (if implemented) |
| SEC-MOB-001-C | Screen capture prevention | Screenshot on sensitive screens | Blank or blocked (if implemented) |
| SEC-MOB-001-D | Clipboard security | Copy sensitive data | Cleared or prevented |
| SEC-MOB-001-E | Background task screenshot | App backgrounded | Sensitive data obscured |

---

### SEC-MOB-002: Binary Security

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-MOB-002-A | Code obfuscation | Decompile APK/IPA | Logic hard to understand |
| SEC-MOB-002-B | No hardcoded secrets | Search binary | No API keys/secrets |
| SEC-MOB-002-C | Anti-tampering | Modify binary | App detects (if implemented) |
| SEC-MOB-002-D | Secure key storage | Reverse engineer | Keys in secure enclave |

---

### SEC-MOB-003: Deep Link Security

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-MOB-003-A | Deep link validation | Malformed deep link | Graceful error |
| SEC-MOB-003-B | Auth required for sensitive | `flent://payment` without auth | Redirect to login |
| SEC-MOB-003-C | Intent hijacking | Malicious app intercepts | Signed app links only |

---

## 7. API Security

### SEC-API-001: Rate Limiting

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-API-001-A | OTP rate limit | 10 requests/min | Blocked after limit |
| SEC-API-001-B | Login rate limit | Rapid login attempts | Blocked after limit |
| SEC-API-001-C | API general rate limit | 1000 requests/min | 429 after limit |
| SEC-API-001-D | Rate limit bypass attempts | Rotate IP/user-agent | Still limited by user ID |

---

### SEC-API-002: Error Handling

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-API-002-A | Stack trace exposure | Trigger error | No stack trace in response |
| SEC-API-002-B | Internal path disclosure | Trigger error | No file paths exposed |
| SEC-API-002-C | Database error disclosure | Invalid query | Generic error message |
| SEC-API-002-D | Consistent error format | All errors | Same format, no info leak |

---

### SEC-API-003: CORS & Headers

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-API-003-A | CORS configuration | Cross-origin request | Only allowed origins |
| SEC-API-003-B | Security headers | Check response headers | CSP, X-Frame-Options, etc. |
| SEC-API-003-C | HSTS enabled | Check header | Strict-Transport-Security set |
| SEC-API-003-D | X-Content-Type-Options | Check header | nosniff set |

---

## 8. Third-Party Security

### SEC-3P-001: SDK Security

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-3P-001-A | Dependency vulnerabilities | `npm audit` | No high/critical |
| SEC-3P-001-B | SDK permissions | Review SDK permissions | Minimum required |
| SEC-3P-001-C | SDK data collection | Review privacy policies | Compliant |
| SEC-3P-001-D | SDK update policy | Check versions | Up to date |

---

### SEC-3P-002: Payment Gateway Security

| Test ID | Scenario | Test Method | Expected Result |
|---------|----------|-------------|-----------------|
| SEC-3P-002-A | PG certificate validation | MITM attempt | Rejected |
| SEC-3P-002-B | PG callback validation | Forge callback | Rejected (signature) |
| SEC-3P-002-C | PG test vs prod keys | Check configuration | Prod keys in prod only |

---

## 9. Penetration Testing Checklist

### Pre-Test Checklist

- [ ] Scope defined and documented
- [ ] Authorization obtained
- [ ] Test environment isolated
- [ ] Rollback plan ready
- [ ] Monitoring in place

### Test Execution

| Phase | Activity | Priority |
|-------|----------|----------|
| Reconnaissance | Endpoint discovery | P0 |
| Reconnaissance | Technology fingerprinting | P1 |
| Vulnerability Scan | Automated scanning | P0 |
| Authentication | Credential testing | P0 |
| Authorization | Access control testing | P0 |
| Injection | SQL/NoSQL/Command | P0 |
| Business Logic | Payment flow manipulation | P0 |
| API | REST security testing | P0 |
| Mobile | Binary analysis | P1 |
| Mobile | Runtime analysis | P1 |

### Post-Test

- [ ] Findings documented
- [ ] Severity ratings assigned
- [ ] Remediation recommendations
- [ ] Retest schedule

---

## 10. Compliance Checklists

### OWASP Mobile Top 10 Coverage

| Category | Status | Relevant Tests |
|----------|--------|----------------|
| M1: Improper Platform Usage | ✓ | SEC-MOB-001-* |
| M2: Insecure Data Storage | ✓ | SEC-DATA-001-* |
| M3: Insecure Communication | ✓ | SEC-DATA-002-* |
| M4: Insecure Authentication | ✓ | SEC-AUTH-* |
| M5: Insufficient Cryptography | ✓ | SEC-DATA-* |
| M6: Insecure Authorization | ✓ | SEC-AUTHZ-* |
| M7: Client Code Quality | ○ | Code review |
| M8: Code Tampering | ○ | SEC-MOB-002-* |
| M9: Reverse Engineering | ○ | SEC-MOB-002-* |
| M10: Extraneous Functionality | ○ | Code review |

### PCI DSS Relevance

| Requirement | Status | Notes |
|-------------|--------|-------|
| Req 3: Protect stored data | ✓ | No card data stored |
| Req 4: Encrypt transmission | ✓ | TLS enforced |
| Req 6: Secure development | ○ | SDLC review |
| Req 8: Authentication | ✓ | OTP + tokens |

---

## Summary

| Category | Test Count | Priority |
|----------|------------|----------|
| Authentication | 15 | P0 |
| Authorization | 9 | P0 |
| Input Validation | 13 | P0 |
| Data Protection | 12 | P0 |
| Payment Security | 9 | P0 |
| Mobile Security | 13 | P1 |
| API Security | 11 | P0 |
| Third-Party | 7 | P1 |
| **Total** | **89** | - |

---

*Document generated: 2026-01-31*
*Review frequency: Quarterly or after major changes*
