/**
 * Visual Testing Helpers
 * Integrates with Sauce Labs Visual SDK for Figma baseline comparison
 */

import { browser, $ } from '@wdio/globals';

// Sauce Visual SDK types
interface VisualCheckOptions {
  name: string;
  testName: string;
  suiteName: string;
  fullPage?: boolean;
  ignoreRegions?: { x: number; y: number; width: number; height: number }[];
}

/**
 * Take a visual snapshot and compare against Figma baseline
 * The snapshot metadata must match what was exported from Figma
 */
export async function sauceVisualCheck(options: VisualCheckOptions): Promise<void> {
  const { name, testName, suiteName, fullPage = true, ignoreRegions = [] } = options;

  console.log(`Taking visual snapshot: ${name}`);
  console.log(`  Test: ${testName}`);
  console.log(`  Suite: ${suiteName}`);

  try {
    // Use Sauce Visual API to take snapshot
    // The @saucelabs/visual package provides this functionality
    await (browser as any).sauceVisualCheck(name, {
      // Metadata to match Figma baseline
      testName,
      suiteName,
      // Full page screenshot for mobile
      fullPage,
      // Ignore dynamic regions (like timestamps)
      ignoreRegions: [
        // Status bar (time, battery, etc.)
        { x: 0, y: 0, width: 430, height: 54 },
        ...ignoreRegions,
      ],
    });

    console.log(`  ✓ Snapshot captured: ${name}`);
  } catch (error) {
    console.error(`  ✗ Failed to capture snapshot: ${name}`, error);
    throw error;
  }
}

/**
 * Navigate from splash to phone entry screen
 */
export async function navigateToPhoneEntry(): Promise<void> {
  // Wait for splash screen
  await browser.pause(2000);

  // Tap "Get Started" button
  const getStartedButton = await $('~primary_button');
  if (await getStartedButton.isDisplayed()) {
    await getStartedButton.click();
    await browser.pause(1000);
  }
}

/**
 * Complete phone entry and navigate to OTP screen
 */
export async function navigateToOTPScreen(phoneNumber: string = '9999999999'): Promise<void> {
  await navigateToPhoneEntry();

  const phoneInput = await $('~phone_input');
  await phoneInput.setValue(phoneNumber);

  const continueButton = await $('~primary_button');
  await continueButton.click();

  // Wait for OTP screen
  await browser.pause(3000);
}

/**
 * Complete OTP verification and navigate to name screen
 */
export async function completeOTPVerification(otp: string = '000000'): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const otpField = await $(`~otp_input_${i}`);
    if (await otpField.isDisplayed()) {
      await otpField.setValue(otp[i]);
    }
  }

  const verifyButton = await $('~primary_button');
  await verifyButton.click();

  await browser.pause(3000);
}

/**
 * Navigate through onboarding to reach home screen
 * Uses mock services for testing
 */
export async function navigateToHomeScreen(): Promise<void> {
  await navigateToOTPScreen();
  await completeOTPVerification();

  // Complete name verification
  const nameInput = await $('~name_input');
  if (await nameInput.isDisplayed()) {
    await nameInput.setValue('Test User');
    const continueButton = await $('~primary_button');
    await continueButton.click();
    await browser.pause(2000);
  }

  // Skip any remaining onboarding steps
  // The mock service should auto-complete onboarding
  await browser.pause(3000);
}

/**
 * Swipe gesture helper
 */
export async function swipe(
  direction: 'left' | 'right' | 'up' | 'down',
  distance: number = 0.6
): Promise<void> {
  const { width, height } = await browser.getWindowSize();

  const start = { x: width / 2, y: height / 2 };
  const end = { x: width / 2, y: height / 2 };

  switch (direction) {
    case 'left':
      start.x = width * 0.8;
      end.x = width * (1 - distance - 0.2);
      break;
    case 'right':
      start.x = width * 0.2;
      end.x = width * (distance + 0.2);
      break;
    case 'up':
      start.y = height * 0.8;
      end.y = height * (1 - distance - 0.2);
      break;
    case 'down':
      start.y = height * 0.2;
      end.y = height * (distance + 0.2);
      break;
  }

  await browser.touchAction([
    { action: 'press', x: start.x, y: start.y },
    { action: 'wait', ms: 300 },
    { action: 'moveTo', x: end.x, y: end.y },
    { action: 'release' },
  ]);
}

/**
 * Wait for element and take screenshot
 */
export async function waitAndCapture(
  accessibilityId: string,
  visualCheckOptions: VisualCheckOptions,
  timeout: number = 10000
): Promise<void> {
  const element = await $(`~${accessibilityId}`);
  await element.waitForDisplayed({ timeout });
  await browser.pause(500); // Let animations settle
  await sauceVisualCheck(visualCheckOptions);
}
