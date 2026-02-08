# Testing Documentation
## Flent Secured - Comprehensive Testing Infrastructure

**Created:** 2026-01-31
**Version:** 1.0
**Status:** Complete (Documentation Phase)

---

## Quick Links

| Document | Description | Tests |
|----------|-------------|-------|
| [Screen Inventory](./screen-inventory.json) | All 97 Figma screens mapped | - |
| [User Journeys](./user-journeys.md) | 12 end-to-end user flows | 159 |
| [Use Cases](./use-cases.md) | 62 use cases across 6 modules | 62 |
| [Edge Cases](./edge-cases.md) | 82 error & edge scenarios | 82 |

### Test Specifications

| Document | Type | Test Count |
|----------|------|------------|
| [Unit Tests](./test-cases/unit-tests.md) | Component & utility tests | 109 |
| [Integration Tests](./test-cases/integration-tests.md) | Screen-level tests | 106 |
| [E2E Tests](./test-cases/e2e-tests.md) | Detox flow tests | 21 |
| [Visual Tests](./test-cases/visual-tests.md) | Sauce Labs visual regression | 77 |
| [API Tests](./test-cases/api-tests.md) | Backend API tests | 75 |
| [Security Tests](./test-cases/security-tests.md) | Security assessments | 89 |
| [Performance Tests](./test-cases/performance-tests.md) | Performance benchmarks | 74 |

### Additional Documentation

| Document | Purpose |
|----------|---------|
| [Refactoring Validation](./refactoring-validation.md) | Verify refactoring completeness |
| [Manual Testing Runbook](./manual-testing/runbook.md) | Step-by-step test procedures |
| [Maintenance Guide](./maintenance-guide.md) | How to update documentation |

---

## Coverage Summary

### Total Test Cases: **613**

| Category | Count | Priority P0 | Priority P1 | Priority P2 |
|----------|-------|-------------|-------------|-------------|
| Unit Tests | 109 | 65 | 32 | 12 |
| Integration Tests | 106 | 74 | 30 | 2 |
| E2E Tests | 21 | 15 | 6 | 0 |
| Visual Tests | 77 | 49 | 22 | 6 |
| API Tests | 75 | 48 | 27 | 0 |
| Security Tests | 89 | 60 | 29 | 0 |
| Performance Tests | 74 | 45 | 29 | 0 |

### Screen Coverage: **97 Figma Screens**

| Module | Screens | Test Coverage |
|--------|---------|---------------|
| Onboarding/Auth | 12 | Full |
| Home States | 15 | Full |
| Payment Flow | 18 | Full |
| Profile | 8 | Full |
| Setup/Verification | 14 | Full |
| Transactions | 10 | Full |
| Waitlist | 6 | Full |
| Settings | 5 | Full |
| Error States | 5 | Full |
| Success States | 4 | Full |

---

## Getting Started

### For Manual Testing

1. Read the [Manual Testing Runbook](./manual-testing/runbook.md)
2. Set up test accounts (see runbook)
3. Follow test procedures TP-001 through TP-008
4. Report bugs using the template

### For Automated Testing

```bash
# Unit & Integration Tests
cd rn-app && npm test

# E2E Tests (Detox)
cd rn-app && npm run e2e:ios

# Visual Tests (Sauce Labs)
cd tests/visual && npm test

# API Tests
cd supabase/functions && deno test
```

### For Updating Documentation

1. Read the [Maintenance Guide](./maintenance-guide.md)
2. Check for Figma changes
3. Update relevant documents
4. Submit PR with changes

---

## Document Markers

All documents include metadata markers for tracking:

```markdown
<!-- FIGMA_STATUS: IN_PROGRESS | STABLE | ARCHIVED -->
<!-- LAST_VERIFIED: YYYY-MM-DD -->
<!-- AUTO_UPDATE: true | false -->
```

- **FIGMA_STATUS**: Design stability indicator
- **LAST_VERIFIED**: When document was last reviewed
- **AUTO_UPDATE**: Whether to update on Figma changes

---

## Test Frameworks

| Type | Framework | Location |
|------|-----------|----------|
| Unit/Integration | Jest + React Native Testing Library | `rn-app/__tests__/` |
| E2E | Detox | `rn-app/e2e/` |
| Visual | WebdriverIO + Sauce Labs | `tests/visual/` |
| API | Deno Test | `supabase/functions/_tests/` |
| Performance | Flashlight + k6 | On-demand |

---

## CI/CD Integration

### GitHub Actions Workflows

| Workflow | Trigger | Tests Run |
|----------|---------|-----------|
| `ci-rn-tests.yml` | PR to main | Unit, Integration |
| `ci-e2e.yml` | PR to main | E2E smoke |
| `ci-visual.yml` | PR to main | Visual regression |
| `nightly.yml` | Daily 2 AM | Full test suite |
| `release.yml` | Release tag | All + Security |

---

## Key Contacts

| Role | Responsibility |
|------|----------------|
| QA Lead | Test documentation, execution |
| Dev Lead | Technical accuracy |
| Product | Feature alignment |
| Design | Figma updates |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-31 | 1.0 | Initial documentation complete |

---

*This documentation is a living document. See [Maintenance Guide](./maintenance-guide.md) for update procedures.*
