# Flent Secured - Visual Testing with Sauce Labs

Visual regression testing using Sauce Labs Visual with Figma baselines from Project "Secured v2" Branch "Secured 2.2".

## Overview

This test suite uses:
- **WebdriverIO** with Appium for iOS app automation
- **Sauce Labs Visual SDK** for visual snapshot comparison
- **Figma baselines** exported via Sauce Labs Figma plugin

## Prerequisites

1. **Sauce Labs Account** with Visual Testing enabled
2. **Environment Variables**:
   ```bash
   export SAUCE_USERNAME=your-username
   export SAUCE_ACCESS_KEY=your-access-key
   ```

3. **App uploaded to Sauce Labs Storage**:
   ```bash
   curl -u "$SAUCE_USERNAME:$SAUCE_ACCESS_KEY" \
     --location --request POST 'https://api.us-west-1.saucelabs.com/v1/storage/upload' \
     --form 'payload=@/path/to/Flent.ipa' \
     --form 'name=Flent.ipa'
   ```

## Figma Baseline Setup

The baselines are exported from Figma using the Sauce Labs Figma plugin:

1. **Project**: Secured v2
2. **Branch**: Secured 2.2
3. **File Key**: HZaVuwWn6B6jOjrmxZ7Kzv

### Baseline Metadata Mapping

Each visual test snapshot must match the Figma baseline metadata:

| Snapshot Name | Test Name | Suite Name | Figma Node |
|---------------|-----------|------------|------------|
| splash-get-started | Splash - Get Started Screen | Splash Flow | 1:28055 |
| phone-entry-empty | Phone Entry - Empty State | Auth Flow | 1:29108 |
| home-zero-state | Home - Zero State | Home Flow | 41:4569 |
| payment-transaction-cashback | Transaction - With Cashback | Payment Flow | 1:30268 |
| profile-main | Profile - Main View | Profile Flow | 41:11720 |

## Installation

```bash
cd tests/visual
npm install
```

## Running Tests

### All Visual Tests
```bash
npm test
```

### Specific Flow
```bash
npm run test:splash   # Splash flow only
npm run test:auth     # Auth flow only
npm run test:home     # Home flow only
npm run test:payment  # Payment flow only
npm run test:profile  # Profile flow only
```

## Test Structure

```
tests/visual/
├── package.json
├── wdio.conf.ts           # WebdriverIO config with Sauce Visual
├── tsconfig.json
├── specs/
│   ├── helpers/
│   │   └── visual-helpers.ts   # Sauce Visual SDK wrapper
│   └── visual/
│       ├── splash.spec.ts      # Splash flow (6 screens)
│       ├── auth.spec.ts        # Auth flow (8 screens)
│       ├── home.spec.ts        # Home flow (20 screens)
│       ├── payment.spec.ts     # Payment flow (11 screens)
│       └── profile.spec.ts     # Profile flow (6 screens)
└── README.md
```

## Viewing Results

After tests run, view visual comparison results at:
https://app.saucelabs.com/visual/builds

The dashboard shows:
- Side-by-side comparison with Figma baselines
- Pixel diff highlighting
- Accept/Reject workflow for changes

## Updating Baselines

When design changes are intentional:

1. **From Figma**: Re-export updated designs using Sauce Labs Figma plugin
2. **From Test Results**: Accept the new snapshots as baselines in Sauce Labs dashboard

## Troubleshooting

### Baseline Not Found
Ensure snapshot metadata (name, testName, suiteName) matches exactly what was set in Figma export.

### App Not Launching
Verify app is uploaded to Sauce Labs storage with correct filename.

### Visual Differences
Check if differences are:
- **Design bugs**: Fix iOS implementation
- **Intentional changes**: Update Figma baseline
- **Dynamic content**: Add to ignoreRegions

## Screen Coverage

| Flow | Screens | Figma Nodes |
|------|---------|-------------|
| Splash | 6 | 1:28055, 1:28071, 1:28985, 1:29025, 1:29065, 1:29105 |
| Auth | 8 | 1:29108, 1:31073, 1:31590, 1:31671, 1:31175, 1:31277, 1:31485, 1:31380 |
| Home | 20 | 41:4569, 41:3186, 41:7005, 41:5792, ... |
| Payment | 11 | 1:30268, 41:9811, 41:4430, 41:9388, 41:9307, 41:8529, 41:11313, 41:7741, 41:8880, 41:4345, 41:9114 |
| Profile | 6 | 41:11720, 41:5381, 41:5587, 41:4969, 41:3885, 41:4093 |
| **Total** | **51+** | |
