# Flow 4: Agreement -- PRD

## Overview

The agreement flow handles rental agreement document upload and verification. Users upload their rental agreement (PDF/image), the system processes it, and then the user reviews extracted details for accuracy. The flow has two screens: upload (5 states covering idle, progress, and error cases) and review (2 states for verify and modify). All states use the DottedPattern background.

**Entry Point**: Waitlist accepted --> Agreement upload
**Exit Point**: Agreement verified --> Flow 5 (Setup)
**Total States**: 7
**Total Stories**: 23 (7 states x 3 + 1 flow test + 1 system improvement)

## Screens & States

### 1. Agreement Upload (/(agreement)/upload)

| State | Figma ID | Description |
|-------|----------|-------------|
| default | 1-30090 | Idle state with upload zone, supported formats, size limit info |
| uploading | 1-30001 | Upload in progress with progress bar, file name, cancel option |
| expired | 1-30178 | Error: agreement has expired, re-upload prompt with explanation |
| too-large | 1-30268 | Error: file exceeds size limit, retry with smaller file prompt |
| manual-review | 1-30358 | Upload successful but requires manual review, estimated timeline |

**Route Params**:
- `?state=idle` (default)
- `?state=uploading`
- `?state=expired`
- `?state=too-large`
- `?state=manual-review`

#### Default (Idle)
**Key Elements**:
- DottedPattern background (backgroundShape: "agreement")
- "Upload your rental agreement" headline
- FileUploadZone component (tap/drag to upload area)
- DocumentUploadCard (shows supported formats: PDF, JPG, PNG)
- File size limit text (e.g., "Max 10MB")
- AgreementUploadSection composed component
- Background images (ellipse-26, image-148, rectangle-30)
- PrimaryButton or implicit upload trigger

**Functional Requirements**:
- Tap upload zone opens document picker
- Supports PDF, JPG, PNG formats
- File size validation before upload (client-side)
- Format validation before upload

#### Uploading
**Key Elements**:
- Same background as default
- DocumentUploadCard showing file name and progress
- Progress bar (percentage indicator)
- "Cancel" TextButton to abort upload
- File icon with file name truncated

**Functional Requirements**:
- Progress bar updates in real-time
- Cancel aborts upload and returns to default state
- Network error during upload shows toast and returns to default
- Upload completion transitions to processing/review

#### Expired
**Key Elements**:
- Error icon (warning/alert)
- "Your agreement has expired" error headline
- Explanation text about expiration
- PrimaryButton "Upload New Agreement" to retry
- Error styling (may include red accent)

**Functional Requirements**:
- Clear error message explaining why agreement is invalid
- CTA returns to default state for re-upload
- Previous file cleared from state

#### Too Large
**Key Elements**:
- Error icon
- "File too large" error headline
- "Maximum file size is 10MB" explanation
- Current file size shown
- PrimaryButton "Try Again" to retry
- Suggestion to compress or use different format

**Functional Requirements**:
- Shows actual file size vs. limit
- CTA returns to default state
- Previous file selection cleared

#### Manual Review
**Key Elements**:
- Information icon (blue/neutral)
- "Under manual review" headline
- "Your agreement needs manual verification" explanation
- Estimated review time (e.g., "1-2 business days")
- TextButton "Contact Support" option
- No forward navigation CTA (user waits for review)

**Functional Requirements**:
- User cannot proceed until review complete
- Polling for review status (or push notification)
- Shows estimated timeline
- Support contact available

### 2. Agreement Review (/(agreement)/review)

| State | Figma ID | Description |
|-------|----------|-------------|
| verify | 1-30448 | Extracted agreement details for user verification, all fields pre-filled |
| modify | 1-30820 | Edit mode with modifiable fields, save changes CTA |

**Route Params**:
- `?state=verify`
- `?state=modify`

#### Verify
**Key Elements**:
- "Verify your agreement details" headline
- Extracted fields displayed as read-only cards:
  - Tenant name
  - Landlord name
  - Property address
  - Monthly rent amount
  - Agreement start/end dates
  - Security deposit
- PrimaryButton "Confirm" to accept details
- TextButton "Edit Details" to switch to modify state
- Background with gradient overlay

**Functional Requirements**:
- All fields pre-populated from backend extraction
- "Confirm" submits verified data, navigates to setup
- "Edit Details" transitions to modify state
- Back navigation returns to upload screen

#### Modify
**Key Elements**:
- Same fields as verify but as editable TextInput components
- Each field is a TextInput with label and current value
- TextInput with onHintPress for "Edit" button behavior
- PrimaryButton "Save Changes"
- TextButton "Cancel" to return to verify state

**Functional Requirements**:
- All fields editable via TextInput component
- Validation on each field (required, format checks)
- "Save Changes" submits modified data to backend
- "Cancel" discards changes, returns to verify state
- Shows loading state during save

### State Transitions

```
[Waitlist Accepted] --> upload/default
upload/default --> (file selected, valid) --> upload/uploading
upload/default --> (file too large) --> upload/too-large
upload/uploading --> (upload success, auto-verified) --> review/verify
upload/uploading --> (upload success, needs review) --> upload/manual-review
upload/uploading --> (agreement expired) --> upload/expired
upload/uploading --> (cancel) --> upload/default
upload/expired --> (re-upload) --> upload/default
upload/too-large --> (retry) --> upload/default
upload/manual-review --> (review complete) --> review/verify
review/verify --> (tap Edit) --> review/modify
review/verify --> (tap Confirm) --> [EXIT: Setup]
review/modify --> (tap Save) --> review/verify
review/modify --> (tap Cancel) --> review/verify
```

## Shared Components Used

| Component | Screens Using It |
|-----------|-----------------|
| Screen | upload, review |
| Text | upload (all states), review (all states) |
| PrimaryButton | upload (default, expired, too-large), review (verify, modify) |
| TextButton | upload (uploading cancel, manual-review support), review (edit, cancel) |
| TextInput | review/modify (all editable fields) |
| DottedPattern | upload (all states) |
| DocumentUploadCard | upload (default, uploading) |
| FileUploadZone | upload (default) |
| AgreementUploadSection | upload (default) |

## Stories

### Upload -- Default (3 stories)
| # | Story | Points |
|---|-------|--------|
| 1.1 | EXTRACT: Pull blueprint for 1-30090 (upload default) | 1 |
| 1.2 | BUILD: Implement upload idle state with FileUploadZone, DocumentUploadCard | 5 |
| 1.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Upload -- Uploading (3 stories)
| # | Story | Points |
|---|-------|--------|
| 2.1 | EXTRACT: Pull blueprint for 1-30001 (upload uploading) | 1 |
| 2.2 | BUILD: Implement uploading state with progress bar, cancel | 5 |
| 2.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Upload -- Expired (3 stories)
| # | Story | Points |
|---|-------|--------|
| 3.1 | EXTRACT: Pull blueprint for 1-30178 (upload expired) | 1 |
| 3.2 | BUILD: Implement expired error state | 3 |
| 3.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Upload -- Too Large (3 stories)
| # | Story | Points |
|---|-------|--------|
| 4.1 | EXTRACT: Pull blueprint for 1-30268 (upload too-large) | 1 |
| 4.2 | BUILD: Implement too-large error state | 3 |
| 4.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Upload -- Manual Review (3 stories)
| # | Story | Points |
|---|-------|--------|
| 5.1 | EXTRACT: Pull blueprint for 1-30358 (upload manual-review) | 1 |
| 5.2 | BUILD: Implement manual review state with timeline | 3 |
| 5.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Review -- Verify (3 stories)
| # | Story | Points |
|---|-------|--------|
| 6.1 | EXTRACT: Pull blueprint for 1-30448 (review verify) | 1 |
| 6.2 | BUILD: Implement verify state with extracted fields display | 5 |
| 6.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Review -- Modify (3 stories)
| # | Story | Points |
|---|-------|--------|
| 7.1 | EXTRACT: Pull blueprint for 1-30820 (review modify) | 1 |
| 7.2 | BUILD: Implement modify state with editable TextInput fields | 5 |
| 7.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Flow-Level Stories (2 stories)
| # | Story | Points |
|---|-------|--------|
| 8.1 | FLOW TEST: Maestro E2E test covering upload --> verify --> confirm | 3 |
| 8.2 | SYSTEM IMPROVEMENT: Refine upload components or agreement review patterns | 3 |

**Total: 23 stories, 68 points**

## Dependencies

- **Upstream**: Flow 3 (Waitlist) -- accepted status triggers agreement flow
- **Downstream**: Flow 5 (Setup) -- verified agreement leads to setup
- **Shared Components**: DocumentUploadCard, FileUploadZone, AgreementUploadSection are agreement-specific. TextInput from Flow 1 reused for review/modify.
- **Backend**: `upload`, `verify`, `get-status`, `modify` Supabase edge functions
- **State**: useAgreement hook manages agreement data and status

## Backend Integration

| Endpoint | Trigger | Response |
|----------|---------|----------|
| upload | File selected and upload begins | { uploadId, status: processing } |
| get-status | Polling during upload/manual-review | { status: verified/manual-review/expired/error, extractedData? } |
| verify | Tap "Confirm" on review | { status: verified, agreementId } |
| modify | Tap "Save Changes" on review/modify | { status: updated, updatedFields } |

## DottedPattern Configuration

| Screen | backgroundShape Key |
|--------|-------------------|
| upload (all states) | agreement |
| review (all states) | agreement (or default -- verify from blueprint) |

## Exit Criteria

1. All 7 agreement states achieve CERTIFIED status in BuildBot
2. Coverage >=98% for all 7 states
3. ODiff <=18% for DottedPattern screens (upload), <=3% for non-DottedPattern (review, if applicable)
4. File upload flow works end-to-end: select file --> upload --> progress --> review
5. All error states (expired, too-large) display correctly with recovery paths
6. Review/verify shows all extracted fields correctly
7. Review/modify allows editing and saving all fields
8. Maestro flow test passes: upload file --> verify details --> confirm --> navigate to setup
9. Zero TypeScript errors, zero ESLint warnings
10. No regressions in Flows 1-3
