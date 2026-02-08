# Testing Documentation Maintenance Guide
## Flent Secured - Living Documentation Procedures

<!-- FIGMA_STATUS: N/A -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: false -->

---

## Overview

This guide describes how to maintain and update testing documentation as the app evolves. It covers procedures for handling Figma design changes, adding new test cases, and keeping documentation in sync with the codebase.

---

## Document Lifecycle

### Document Status Markers

All test documents include metadata markers:

```markdown
<!-- FIGMA_STATUS: IN_PROGRESS | STABLE | ARCHIVED -->
<!-- LAST_VERIFIED: YYYY-MM-DD -->
<!-- FIGMA_NODE: nodeId (if applicable) -->
<!-- AUTO_UPDATE: true | false -->
```

**Status Definitions:**

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| IN_PROGRESS | Designs actively changing | Review frequently |
| STABLE | Designs finalized | Review on major changes |
| ARCHIVED | No longer relevant | May be deleted |

---

## Figma Design Change Workflow

### 1. Detecting Changes

**Automatic Detection (Recommended):**

```javascript
// scripts/check-figma-changes.js
const FIGMA_FILE_KEY = 'HZaVuwWn6B6jOjrmxZ7Kzv';

async function checkForChanges() {
  const response = await fetch(
    `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN } }
  );

  const data = await response.json();
  const lastModified = new Date(data.lastModified);

  // Compare with stored baseline
  const baseline = await readBaseline();
  if (lastModified > baseline.lastModified) {
    console.log('Figma file has been updated!');
    return true;
  }
  return false;
}
```

**Manual Detection:**
- Check Figma file for recent updates
- Review designer notifications
- Monitor #design-updates channel

### 2. Impact Analysis

When changes are detected:

1. **Identify affected screens:**
   - Which Figma frames changed?
   - Map to test documentation files

2. **Categorize change type:**

| Change Type | Documentation Impact |
|-------------|---------------------|
| Visual tweak (colors, spacing) | Update visual test baselines |
| New component | Add component tests |
| Component removed | Archive/remove tests |
| Flow changed | Update user journeys, E2E tests |
| New screen | Full documentation cycle |
| Screen removed | Archive documentation |

3. **Flag affected documents:**
   - Update `LAST_VERIFIED` date
   - Add reviewer comments
   - Create update tasks

### 3. Updating Documentation

**For Screen Inventory (`screen-inventory.json`):**

```json
// Add new screen
{
  "id": "new-feature",
  "figmaNodeId": "123-4567",
  "module": "feature",
  "status": "new",
  "addedDate": "2026-02-01"
}

// Mark screen as changed
{
  "id": "existing-screen",
  "status": "changed",
  "lastModified": "2026-02-01",
  "changeType": "visual"
}

// Archive removed screen
{
  "id": "old-screen",
  "status": "archived",
  "archivedDate": "2026-02-01"
}
```

**For User Journeys:**

1. Review affected journey
2. Update screen sequence if changed
3. Add new decision points
4. Update Figma node references
5. Bump `LAST_VERIFIED` date

**For Test Cases:**

1. Add tests for new functionality
2. Modify tests for changed behavior
3. Archive tests for removed features
4. Update expected values

### 4. Visual Baseline Updates

When Figma designs change, update visual test baselines:

```bash
# Capture new baselines
cd tests/visual
npm run baseline:update

# Review changes
npm run baseline:review

# Accept specific screens
npm run baseline:accept --screens=splash,home
```

---

## Adding New Test Cases

### Process

1. **Identify Need:**
   - New feature added
   - Bug found and fixed
   - Edge case discovered

2. **Determine Test Type:**

| Scenario | Test Type | File |
|----------|-----------|------|
| Component behavior | Unit | unit-tests.md |
| Screen integration | Integration | integration-tests.md |
| Complete flow | E2E | e2e-tests.md |
| Visual appearance | Visual | visual-tests.md |
| Backend logic | API | api-tests.md |
| Vulnerability | Security | security-tests.md |
| Speed/memory | Performance | performance-tests.md |

3. **Follow Test ID Convention:**

```
{CATEGORY}-{MODULE}-{NUMBER}

Examples:
BTN-001     - Button component test 1
INT-SPL-001 - Integration Splash test 1
E2E-ONB-001 - E2E Onboarding test 1
VIS-HOME-001 - Visual Home test 1
API-AUTH-001 - API Auth test 1
SEC-AUTH-001 - Security Auth test 1
PERF-START-001 - Performance Startup test 1
```

4. **Document the Test:**

```markdown
| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| NEW-001 | Description | Setup steps | Expected results | P0/P1/P2 |
```

5. **Update Summary Counts:**
   - Update test count at end of document
   - Update priority distribution

---

## Deprecating Test Cases

### When to Deprecate

- Feature removed from app
- Test duplicates another
- Test no longer relevant
- Functionality changed significantly

### Process

1. **Mark as deprecated (don't delete immediately):**

```markdown
| ~~TEST-001~~ | ~~Old test~~ | DEPRECATED: Removed in v2.0 |
```

2. **Move to archived section:**

```markdown
## Archived Tests

Tests in this section are no longer active but kept for reference.

| Test ID | Reason | Deprecated Date |
|---------|--------|-----------------|
| TEST-001 | Feature removed | 2026-02-01 |
```

3. **After 90 days:** May be permanently removed

---

## Documentation Review Schedule

### Weekly Reviews

| Task | Frequency | Owner |
|------|-----------|-------|
| Check Figma for updates | Weekly | QA Lead |
| Review open test failures | Weekly | QA Team |
| Update test counts | Weekly | QA Lead |

### Monthly Reviews

| Task | Frequency | Owner |
|------|-----------|-------|
| Full document audit | Monthly | QA Lead |
| Archive stale content | Monthly | QA Lead |
| Update device matrix | Monthly | QA Team |
| Review test coverage | Monthly | Dev Lead + QA |

### Quarterly Reviews

| Task | Frequency | Owner |
|------|-----------|-------|
| Security test update | Quarterly | Security Team |
| Performance benchmark update | Quarterly | Dev Lead |
| Full journey validation | Quarterly | Product + QA |

---

## Version Control

### Commit Message Format

```
docs(testing): [ACTION] [SCOPE] - [DESCRIPTION]

Examples:
docs(testing): add unit tests for OTP component
docs(testing): update user journey for payment flow
docs(testing): archive deprecated auth tests
docs(testing): fix screen inventory node IDs
```

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Latest stable docs |
| `docs/testing-*` | Doc updates in progress |
| `figma-update/*` | Figma change sync |

### Pull Request Template

```markdown
## Documentation Update

### Type
- [ ] New tests added
- [ ] Tests updated
- [ ] Tests deprecated
- [ ] Figma sync
- [ ] Maintenance

### Affected Documents
- [ ] screen-inventory.json
- [ ] user-journeys.md
- [ ] use-cases.md
- [ ] unit-tests.md
- [ ] integration-tests.md
- [ ] e2e-tests.md
- [ ] visual-tests.md
- [ ] api-tests.md
- [ ] security-tests.md
- [ ] performance-tests.md

### Figma Changes (if applicable)
- [ ] Node IDs updated
- [ ] Baselines updated
- [ ] Screenshots captured

### Checklist
- [ ] Test IDs follow convention
- [ ] Counts updated
- [ ] LAST_VERIFIED updated
- [ ] Cross-references verified
```

---

## Quick Reference

### File Locations

```
docs/testing/
├── README.md                 # Master index
├── screen-inventory.json     # All screens
├── user-journeys.md          # User flows
├── use-cases.md              # Use case catalog
├── edge-cases.md             # Edge scenarios
├── refactoring-validation.md # Refactor checks
├── maintenance-guide.md      # This file
│
├── test-cases/
│   ├── unit-tests.md
│   ├── integration-tests.md
│   ├── e2e-tests.md
│   ├── visual-tests.md
│   ├── api-tests.md
│   ├── security-tests.md
│   └── performance-tests.md
│
└── manual-testing/
    └── runbook.md
```

### Common Tasks

| Task | Command/Action |
|------|----------------|
| Check Figma changes | `node scripts/check-figma-changes.js` |
| Update visual baselines | `cd tests/visual && npm run baseline:update` |
| Run all tests | `npm test` |
| Generate coverage | `npm run test:coverage` |
| Validate doc links | `npm run docs:validate` |

### Contact Points

| Role | Responsibility |
|------|----------------|
| QA Lead | Document ownership, reviews |
| Dev Lead | Technical accuracy |
| Product | Feature alignment |
| Design | Figma updates notification |

---

## Troubleshooting

### Common Issues

**Q: Figma node ID not found**
A: Screen may have been renamed or deleted. Check Figma history.

**Q: Test counts don't match**
A: Re-run count script: `node scripts/count-tests.js`

**Q: Visual baseline mismatch**
A: Capture new baseline or investigate if unintended change.

**Q: Broken document links**
A: Run link validator: `npm run docs:links`

---

*Document generated: 2026-01-31*
*Review: Quarterly*
