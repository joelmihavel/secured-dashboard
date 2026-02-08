# Edge Cases Encyclopedia
## Flent Secured - Comprehensive Error & Edge Scenario Documentation

<!-- FIGMA_STATUS: IN_PROGRESS -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: true -->

---

## Overview

This document catalogs all edge cases, error scenarios, and boundary conditions for the Flent Secured app. Each edge case includes:
- Trigger conditions
- Expected behavior
- UI response
- Recovery path
- Test priority

---

## 1. Authentication Edge Cases

### EC-AUTH-001: Invalid Phone Number (Too Short)
| Attribute | Value |
|-----------|-------|
| **Trigger** | User enters < 10 digits |
| **Input** | "987654321" (9 digits) |
| **Expected** | Button disabled, inline error |
| **Error Message** | "Enter a valid 10-digit number" |
| **UI State** | Phone field red border, error below |
| **Recovery** | Enter valid number |
| **Priority** | P0 |
| **Figma Node** | 1-31671 |

### EC-AUTH-002: Invalid Phone Number (Too Long)
| Attribute | Value |
|-----------|-------|
| **Trigger** | User enters > 10 digits |
| **Input** | "98765432101" (11 digits) |
| **Expected** | Input truncated to 10 digits |
| **Behavior** | Auto-format: "98765 43210" |
| **Recovery** | N/A (prevented) |
| **Priority** | P1 |

### EC-AUTH-003: Invalid Phone Number (Non-Numeric)
| Attribute | Value |
|-----------|-------|
| **Trigger** | User enters letters/symbols |
| **Input** | "98765abc10" |
| **Expected** | Non-numeric chars rejected |
| **Behavior** | Only digits accepted |
| **Recovery** | N/A (prevented) |
| **Priority** | P1 |

### EC-AUTH-004: Phone Already Registered
| Attribute | Value |
|-----------|-------|
| **Trigger** | Existing user tries to sign up |
| **API Response** | 409 Conflict |
| **Expected** | Error message shown |
| **Error Message** | "This number already exists" |
| **UI State** | Inline error, button re-enabled |
| **Recovery** | Use "Log in" or different number |
| **Priority** | P0 |

### EC-AUTH-005: Invalid Name (Too Short)
| Attribute | Value |
|-----------|-------|
| **Trigger** | Name < 2 characters |
| **Input** | "A" |
| **Expected** | Button disabled |
| **Error Message** | "Name is too short" |
| **Recovery** | Enter valid name |
| **Priority** | P1 |

### EC-AUTH-006: Consent Not Toggled
| Attribute | Value |
|-----------|-------|
| **Trigger** | Form valid but consent OFF |
| **Expected** | Button disabled |
| **UI State** | Button grayed out |
| **Recovery** | Toggle consent ON |
| **Priority** | P0 |

### EC-AUTH-007: Wrong OTP Code
| Attribute | Value |
|-----------|-------|
| **Trigger** | User enters incorrect 6-digit OTP |
| **API Response** | 401 Unauthorized |
| **Expected** | Error shown, can retry |
| **Error Message** | "Wrong Code" |
| **UI State** | OTP boxes shake, turn red |
| **Retry** | Clear and re-enter |
| **Priority** | P0 |
| **Figma Node** | 1-29065 |

### EC-AUTH-008: OTP Max Attempts Exceeded
| Attribute | Value |
|-----------|-------|
| **Trigger** | 3 wrong OTP attempts |
| **API Response** | 429 Too Many Requests |
| **Expected** | Lockout message |
| **Error Message** | "Too many attempts. Try again in 15 minutes" |
| **UI State** | Input disabled, timer shown |
| **Recovery** | Wait for lockout expiry |
| **Priority** | P0 |

### EC-AUTH-009: OTP Expired
| Attribute | Value |
|-----------|-------|
| **Trigger** | OTP entered after 5 minutes |
| **API Response** | 410 Gone |
| **Expected** | Expiry message |
| **Error Message** | "Code expired. Tap to resend" |
| **UI State** | Resend button highlighted |
| **Recovery** | Resend OTP |
| **Priority** | P0 |

### EC-AUTH-010: OTP Resend Cooldown
| Attribute | Value |
|-----------|-------|
| **Trigger** | Tap resend before 30s |
| **Expected** | Resend disabled with timer |
| **UI State** | "Resend in 0:25" |
| **Recovery** | Wait for cooldown |
| **Priority** | P1 |

### EC-AUTH-011: Network Error During OTP Send
| Attribute | Value |
|-----------|-------|
| **Trigger** | No internet when requesting OTP |
| **Expected** | Network error message |
| **Error Message** | "No internet connection" |
| **UI State** | Retry button shown |
| **Recovery** | Restore connection, retry |
| **Priority** | P0 |

### EC-AUTH-012: Session Expired Mid-Flow
| Attribute | Value |
|-----------|-------|
| **Trigger** | Token expires during app use |
| **API Response** | 401 on any request |
| **Expected** | Redirect to login |
| **Behavior** | Clear session, show splash |
| **Recovery** | Re-authenticate |
| **Priority** | P0 |

### EC-AUTH-013: Concurrent Session Detected
| Attribute | Value |
|-----------|-------|
| **Trigger** | Login from another device |
| **Expected** | Session invalidated |
| **Error Message** | "Signed in on another device" |
| **Behavior** | Force logout current device |
| **Priority** | P1 |

---

## 2. Payment Edge Cases

### EC-PAY-001: Payment Timeout
| Attribute | Value |
|-----------|-------|
| **Trigger** | Payment takes > 5 minutes |
| **Expected** | Timeout message |
| **Error Message** | "Payment timed out. Please try again" |
| **UI State** | Failure screen with retry |
| **Recovery** | Check bank app, retry if needed |
| **Priority** | P0 |

### EC-PAY-002: Insufficient Funds (UPI)
| Attribute | Value |
|-----------|-------|
| **Trigger** | Bank account lacks funds |
| **Bank Response** | "Insufficient funds" |
| **Expected** | Bank error displayed |
| **Error Message** | "Payment failed: Insufficient funds" |
| **Recovery** | Add funds, retry |
| **Priority** | P0 |

### EC-PAY-003: UPI App Not Installed
| Attribute | Value |
|-----------|-------|
| **Trigger** | Selected UPI app not on device |
| **Expected** | Prompt to install or use other |
| **Behavior** | Show available UPI apps |
| **Recovery** | Select different UPI app |
| **Priority** | P1 |

### EC-PAY-004: UPI PIN Incorrect
| Attribute | Value |
|-----------|-------|
| **Trigger** | Wrong PIN in UPI app |
| **Bank Response** | "Invalid PIN" |
| **Expected** | Error shown |
| **Error Message** | "Payment failed: Invalid UPI PIN" |
| **Recovery** | Retry with correct PIN |
| **Priority** | P0 |

### EC-PAY-005: Bank Server Down
| Attribute | Value |
|-----------|-------|
| **Trigger** | Bank maintenance/outage |
| **Expected** | Server error message |
| **Error Message** | "Bank server unavailable. Try again later" |
| **Recovery** | Wait, retry later |
| **Priority** | P0 |

### EC-PAY-006: Duplicate Payment Attempt
| Attribute | Value |
|-----------|-------|
| **Trigger** | Payment already in progress |
| **Expected** | Blocked with notice |
| **Error Message** | "A payment is already in progress" |
| **UI State** | Show existing payment status |
| **Recovery** | Wait for completion |
| **Priority** | P0 |

### EC-PAY-007: Amount Mismatch
| Attribute | Value |
|-----------|-------|
| **Trigger** | Rent amount changed server-side |
| **Expected** | Refresh required |
| **Error Message** | "Amount has changed. Please review" |
| **Behavior** | Reload payment screen |
| **Priority** | P1 |

### EC-PAY-008: Cashback Cutoff (7th Midnight)
| Attribute | Value |
|-----------|-------|
| **Trigger** | Payment at 11:59 PM on 7th |
| **Expected** | Cashback still eligible |
| **Cutoff** | 23:59:59 on 7th |
| **Priority** | P0 |

### EC-PAY-009: Cashback Cutoff (8th 00:00)
| Attribute | Value |
|-----------|-------|
| **Trigger** | Payment at 00:00:01 on 8th |
| **Expected** | No cashback |
| **UI State** | Cashback locked/hidden |
| **Priority** | P0 |

### EC-PAY-010: Cashback Cap Exceeded
| Attribute | Value |
|-----------|-------|
| **Trigger** | 1% of rent > ₹10,000 |
| **Rent Amount** | ₹11,00,000 (1% = ₹11,000) |
| **Expected** | Cashback capped at ₹10,000 |
| **UI Display** | "Cashback: -₹10,000 (max)" |
| **Priority** | P1 |

### EC-PAY-011: Payment While Offline
| Attribute | Value |
|-----------|-------|
| **Trigger** | No internet when tapping Pay |
| **Expected** | Error message |
| **Error Message** | "No internet connection" |
| **Behavior** | Button re-enabled on reconnect |
| **Priority** | P0 |

### EC-PAY-012: Payment Callback Lost
| Attribute | Value |
|-----------|-------|
| **Trigger** | App killed during payment |
| **Expected** | Check status on relaunch |
| **Behavior** | Query payment status API |
| **UI** | Show current payment state |
| **Priority** | P0 |

### EC-PAY-013: Refund Status Tracking
| Attribute | Value |
|-----------|-------|
| **Trigger** | Payment refunded |
| **Expected** | Status progression shown |
| **States** | Processing → Refund Initiated → Refunded |
| **Timeline** | 5-7 business days |
| **Priority** | P1 |

### EC-PAY-014: Net Banking Session Timeout
| Attribute | Value |
|-----------|-------|
| **Trigger** | Bank session expires |
| **Expected** | Return to app with error |
| **Error Message** | "Session expired at bank" |
| **Recovery** | Retry payment |
| **Priority** | P1 |

### EC-PAY-015: 3D Secure Failure
| Attribute | Value |
|-----------|-------|
| **Trigger** | Credit card 3DS fails |
| **Expected** | Card authentication error |
| **Error Message** | "Card verification failed" |
| **Recovery** | Use different card |
| **Priority** | P1 |

---

## 3. Home State Edge Cases

### EC-HOME-001: Zero State - No Verifications
| Attribute | Value |
|-----------|-------|
| **Trigger** | New user, no setup done |
| **Expected** | Setup prompts shown |
| **UI Elements** | 3-step setup checklist |
| **CTA** | "Finish Setup" |
| **Figma Node** | 243-6731 |
| **Priority** | P0 |

### EC-HOME-002: Partial Verification (1/3)
| Attribute | Value |
|-----------|-------|
| **Trigger** | Only bank added |
| **Expected** | Progress indicator |
| **UI State** | 1/3 checkmark, 2 pending |
| **Priority** | P0 |

### EC-HOME-003: Partial Verification (2/3)
| Attribute | Value |
|-----------|-------|
| **Trigger** | Bank + address proof |
| **Expected** | Waiting for landlord |
| **UI State** | 2/3 checkmark, 1 pending |
| **Priority** | P0 |

### EC-HOME-004: Landlord Invitation Declined
| Attribute | Value |
|-----------|-------|
| **Trigger** | Landlord rejects invitation |
| **Expected** | Decline message |
| **Error Message** | "Landlord declined your invitation" |
| **Recovery** | Contact support or re-invite |
| **Priority** | P0 |

### EC-HOME-005: Landlord Invitation Pending (>24h)
| Attribute | Value |
|-----------|-------|
| **Trigger** | No response after 24 hours |
| **Expected** | Resend option available |
| **UI State** | "Reminder available" button |
| **Priority** | P1 |

### EC-HOME-006: Late Payment (After 7th)
| Attribute | Value |
|-----------|-------|
| **Trigger** | Date > 7th, no payment |
| **Expected** | Warning banner |
| **UI State** | Orange warning banner |
| **Message** | "Your rent is overdue" |
| **Cashback** | Not available |
| **Priority** | P0 |

### EC-HOME-007: Missed Payment (30+ Days)
| Attribute | Value |
|-----------|-------|
| **Trigger** | 30+ days past due |
| **Expected** | Overdue status |
| **UI State** | Red alert banner |
| **Message** | "Payment overdue by X days" |
| **Priority** | P0 |

### EC-HOME-008: Multiple Missed Payments
| Attribute | Value |
|-----------|-------|
| **Trigger** | 2+ months unpaid |
| **Expected** | Aggregated amount shown |
| **UI State** | Total overdue displayed |
| **Message** | "₹X overdue for Y months" |
| **Priority** | P0 |

### EC-HOME-009: No Internet on Home Load
| Attribute | Value |
|-----------|-------|
| **Trigger** | App opened offline |
| **Expected** | Cached data + indicator |
| **UI State** | Offline banner at top |
| **Behavior** | Show last known state |
| **Priority** | P0 |

### EC-HOME-010: Realtime Update Failure
| Attribute | Value |
|-----------|-------|
| **Trigger** | WebSocket disconnects |
| **Expected** | Fallback to polling |
| **Behavior** | Refresh data every 30s |
| **Priority** | P1 |

---

## 4. Verification Edge Cases

### EC-VER-001: Invalid IFSC Code
| Attribute | Value |
|-----------|-------|
| **Trigger** | IFSC format incorrect |
| **Input** | "INVALID123" |
| **Expected** | Validation error |
| **Error Message** | "Invalid IFSC code format" |
| **Format** | 4 letters + 7 alphanumeric |
| **Priority** | P0 |

### EC-VER-002: Bank Not Found (IFSC)
| Attribute | Value |
|-----------|-------|
| **Trigger** | IFSC not in database |
| **API Response** | 404 Not Found |
| **Expected** | Bank not found error |
| **Error Message** | "Bank branch not found" |
| **Priority** | P1 |

### EC-VER-003: Penny Drop Failed
| Attribute | Value |
|-----------|-------|
| **Trigger** | Bank verification fails |
| **Expected** | Retry with edit option |
| **Error Message** | "Verification failed. Check details" |
| **Recovery** | Re-enter account number |
| **Priority** | P0 |

### EC-VER-004: Account Number Mismatch
| Attribute | Value |
|-----------|-------|
| **Trigger** | Account doesn't match bank |
| **Expected** | Verification failure |
| **Error Message** | "Account not found at this bank" |
| **Priority** | P0 |

### EC-VER-005: Invalid File Format (Agreement)
| Attribute | Value |
|-----------|-------|
| **Trigger** | Non-PDF uploaded |
| **Input** | .docx, .jpg, etc. |
| **Expected** | Format error |
| **Error Message** | "Please upload a PDF file" |
| **Priority** | P0 |

### EC-VER-006: File Too Large
| Attribute | Value |
|-----------|-------|
| **Trigger** | PDF > 10MB |
| **Expected** | Size error |
| **Error Message** | "File too large. Maximum 10MB" |
| **Priority** | P1 |

### EC-VER-007: Landlord Email Invalid
| Attribute | Value |
|-----------|-------|
| **Trigger** | Invalid email format |
| **Input** | "invalid@" |
| **Expected** | Validation error |
| **Error Message** | "Enter a valid email address" |
| **Priority** | P0 |

### EC-VER-008: Landlord Invitation Already Sent
| Attribute | Value |
|-----------|-------|
| **Trigger** | Invite within 24h cooldown |
| **Expected** | Cooldown message |
| **Error Message** | "Invitation already sent. Can resend in X hours" |
| **Priority** | P1 |

### EC-VER-009: Document Processing Timeout
| Attribute | Value |
|-----------|-------|
| **Trigger** | OCR/validation takes > 30s |
| **Expected** | Timeout with retry |
| **Error Message** | "Processing timed out. Please try again" |
| **Priority** | P1 |

---

## 5. Profile Edge Cases

### EC-PROF-001: Name Change Validation
| Attribute | Value |
|-----------|-------|
| **Trigger** | Name < 2 characters |
| **Expected** | Save disabled |
| **Error Message** | "Name is too short" |
| **Priority** | P1 |

### EC-PROF-002: Email Change Verification
| Attribute | Value |
|-----------|-------|
| **Trigger** | Email change requested |
| **Expected** | Verification required |
| **Behavior** | Send verification email |
| **Priority** | P2 |

### EC-PROF-003: Profile Picture Upload Failed
| Attribute | Value |
|-----------|-------|
| **Trigger** | Image upload error |
| **Expected** | Retry option |
| **Error Message** | "Failed to upload. Try again" |
| **Priority** | P2 |

### EC-PROF-004: Sign Out Confirmation
| Attribute | Value |
|-----------|-------|
| **Trigger** | Tap Sign Out |
| **Expected** | Confirmation modal |
| **Options** | "Cancel" / "Sign Out" |
| **Priority** | P1 |

### EC-PROF-005: Delete Account Confirmation
| Attribute | Value |
|-----------|-------|
| **Trigger** | Tap Delete Account |
| **Expected** | Multi-step confirmation |
| **Steps** | Warning → OTP → Final confirm |
| **Priority** | P1 |

---

## 6. Network & System Edge Cases

### EC-NET-001: Complete Offline Mode
| Attribute | Value |
|-----------|-------|
| **Trigger** | No network at all |
| **Expected** | Offline banner, cached data |
| **Behavior** | Queue actions for sync |
| **Priority** | P0 |

### EC-NET-002: Slow Network (3G)
| Attribute | Value |
|-----------|-------|
| **Trigger** | High latency connection |
| **Expected** | Extended loading states |
| **Timeout** | 30s before timeout |
| **Priority** | P1 |

### EC-NET-003: Network Change Mid-Request
| Attribute | Value |
|-----------|-------|
| **Trigger** | WiFi → Cellular switch |
| **Expected** | Request retry |
| **Behavior** | Auto-retry with new connection |
| **Priority** | P1 |

### EC-NET-004: API Rate Limiting
| Attribute | Value |
|-----------|-------|
| **Trigger** | Too many requests |
| **API Response** | 429 Too Many Requests |
| **Expected** | Backoff message |
| **Error Message** | "Please slow down. Try again in X seconds" |
| **Priority** | P1 |

### EC-NET-005: Server Maintenance
| Attribute | Value |
|-----------|-------|
| **Trigger** | Planned downtime |
| **API Response** | 503 Service Unavailable |
| **Expected** | Maintenance screen |
| **Message** | "We're updating. Back soon!" |
| **Priority** | P1 |

### EC-NET-006: App Update Required
| Attribute | Value |
|-----------|-------|
| **Trigger** | API version mismatch |
| **API Response** | 426 Upgrade Required |
| **Expected** | Update prompt |
| **Behavior** | Link to app store |
| **Priority** | P0 |

---

## 7. Device & Platform Edge Cases

### EC-DEV-001: Low Storage Space
| Attribute | Value |
|-----------|-------|
| **Trigger** | < 100MB free |
| **Expected** | Warning when caching |
| **Impact** | May fail to save data |
| **Priority** | P2 |

### EC-DEV-002: Background App Refresh Disabled
| Attribute | Value |
|-----------|-------|
| **Trigger** | iOS setting disabled |
| **Expected** | No push data refresh |
| **Impact** | Stale data until foreground |
| **Priority** | P2 |

### EC-DEV-003: Notifications Disabled
| Attribute | Value |
|-----------|-------|
| **Trigger** | Push notifications OFF |
| **Expected** | In-app prompt to enable |
| **Impact** | No payment reminders |
| **Priority** | P1 |

### EC-DEV-004: Location Permission Denied
| Attribute | Value |
|-----------|-------|
| **Trigger** | Location access denied |
| **Expected** | App works without |
| **Impact** | Some features limited |
| **Priority** | P2 |

### EC-DEV-005: Biometric Auth Failed
| Attribute | Value |
|-----------|-------|
| **Trigger** | Face ID / fingerprint fails |
| **Expected** | Fallback to OTP |
| **Behavior** | Prompt for alternative |
| **Priority** | P1 |

### EC-DEV-006: App Killed During Payment
| Attribute | Value |
|-----------|-------|
| **Trigger** | User force-quits app |
| **Expected** | Payment continues server-side |
| **On Relaunch** | Check and show status |
| **Priority** | P0 |

---

## 8. Data & Input Edge Cases

### EC-DATA-001: Special Characters in Name
| Attribute | Value |
|-----------|-------|
| **Trigger** | Name with unicode |
| **Input** | "José García-López" |
| **Expected** | Accepted if valid |
| **Behavior** | Store and display correctly |
| **Priority** | P1 |

### EC-DATA-002: Very Long Name
| Attribute | Value |
|-----------|-------|
| **Trigger** | Name > 100 chars |
| **Expected** | Truncation or error |
| **Limit** | 100 characters max |
| **Priority** | P2 |

### EC-DATA-003: Emoji in Input Fields
| Attribute | Value |
|-----------|-------|
| **Trigger** | User enters emoji |
| **Expected** | Stripped or rejected |
| **Behavior** | Name field: rejected |
| **Priority** | P2 |

### EC-DATA-004: Copy-Paste Phone Number
| Attribute | Value |
|-----------|-------|
| **Trigger** | Paste "+91 98765 43210" |
| **Expected** | Clean and format |
| **Result** | "98765 43210" displayed |
| **Priority** | P1 |

### EC-DATA-005: International Phone Number
| Attribute | Value |
|-----------|-------|
| **Trigger** | Non-Indian number |
| **Expected** | Error (India only) |
| **Error Message** | "Only Indian numbers supported" |
| **Priority** | P1 |

---

## 9. Security Edge Cases

### EC-SEC-001: JWT Token Tampering
| Attribute | Value |
|-----------|-------|
| **Trigger** | Modified token sent |
| **API Response** | 401 Unauthorized |
| **Expected** | Force logout |
| **Priority** | P0 |

### EC-SEC-002: Replay Attack (Webhook)
| Attribute | Value |
|-----------|-------|
| **Trigger** | Duplicate webhook received |
| **Expected** | Idempotency check |
| **Behavior** | Second request ignored |
| **Priority** | P0 |

### EC-SEC-003: Amount Tampering
| Attribute | Value |
|-----------|-------|
| **Trigger** | Client sends wrong amount |
| **Expected** | Server validation |
| **Behavior** | Reject mismatched amounts |
| **Priority** | P0 |

### EC-SEC-004: Session Fixation Attempt
| Attribute | Value |
|-----------|-------|
| **Trigger** | Using old session token |
| **Expected** | Token invalidation |
| **Behavior** | Force new authentication |
| **Priority** | P0 |

### EC-SEC-005: Secure Storage Corruption
| Attribute | Value |
|-----------|-------|
| **Trigger** | Keychain data corrupted |
| **Expected** | Clear and re-authenticate |
| **Behavior** | Logout user gracefully |
| **Priority** | P1 |

---

## 10. Swift → React Native Refactoring Edge Cases

### EC-REF-001: Navigation State Mismatch
| Attribute | Value |
|-----------|-------|
| **Trigger** | Deep link after state change |
| **Swift Behavior** | Coordinator handles |
| **RN Risk** | Stack state desync |
| **Mitigation** | Reset stack before deep nav |
| **Priority** | P0 |

### EC-REF-002: Animation Timing Differences
| Attribute | Value |
|-----------|-------|
| **Trigger** | Spring animation config |
| **Swift Behavior** | SwiftUI spring(0.6) |
| **RN Risk** | Different feel |
| **Mitigation** | Match Reanimated config |
| **Priority** | P1 |

### EC-REF-003: Keyboard Handling Differences
| Attribute | Value |
|-----------|-------|
| **Trigger** | Input focus behavior |
| **Swift Behavior** | Native keyboard avoidance |
| **RN Risk** | KeyboardAvoidingView issues |
| **Mitigation** | Test all input screens |
| **Priority** | P0 |

### EC-REF-004: Safe Area Inconsistency
| Attribute | Value |
|-----------|-------|
| **Trigger** | Notch/home indicator |
| **Swift Behavior** | Native safe area |
| **RN Risk** | Manual padding needed |
| **Mitigation** | SafeAreaProvider testing |
| **Priority** | P0 |

### EC-REF-005: Haptic Feedback Differences
| Attribute | Value |
|-----------|-------|
| **Trigger** | Button press feedback |
| **Swift Behavior** | UIImpactFeedbackGenerator |
| **RN Risk** | expo-haptics behavior |
| **Mitigation** | Verify haptic types |
| **Priority** | P2 |

### EC-REF-006: Date/Time Formatting
| Attribute | Value |
|-----------|-------|
| **Trigger** | Locale-specific display |
| **Swift Behavior** | DateFormatter |
| **RN Risk** | Different locale handling |
| **Mitigation** | Test IST timezone |
| **Priority** | P1 |

### EC-REF-007: Currency Formatting (Paise)
| Attribute | Value |
|-----------|-------|
| **Trigger** | ₹32,500 from 3250000 paise |
| **Swift Behavior** | Custom formatter |
| **RN Risk** | Rounding errors |
| **Mitigation** | Integer math only |
| **Priority** | P0 |

### EC-REF-008: Realtime Subscription Reconnect
| Attribute | Value |
|-----------|-------|
| **Trigger** | WebSocket disconnect |
| **Swift Behavior** | Auto-reconnect with backoff |
| **RN Risk** | Supabase-js behavior differs |
| **Mitigation** | Test reconnection logic |
| **Priority** | P0 |

---

## Summary Matrix

| Category | Total Cases | P0 | P1 | P2 |
|----------|-------------|----|----|-----|
| Authentication | 13 | 8 | 4 | 1 |
| Payment | 15 | 10 | 5 | 0 |
| Home State | 10 | 7 | 3 | 0 |
| Verification | 9 | 5 | 4 | 0 |
| Profile | 5 | 0 | 3 | 2 |
| Network/System | 6 | 2 | 4 | 0 |
| Device/Platform | 6 | 2 | 2 | 2 |
| Data/Input | 5 | 0 | 3 | 2 |
| Security | 5 | 4 | 1 | 0 |
| Refactoring | 8 | 5 | 2 | 1 |
| **Total** | **82** | **43** | **31** | **8** |

---

*Document generated: 2026-01-31*
*Next review: When edge cases discovered during testing*
