/**
 * Visual Tests - Auth Flow
 * Compares against Figma baselines from Project "Secured v2" Branch "Secured 2.2"
 *
 * Figma Screens:
 * - 1:29108 - Phone Entry - Empty
 * - 1:31073 - Phone Entry - Filled
 * - 1:31590 - Phone Entry - Error 1
 * - 1:31671 - Phone Entry - Error 2
 * - 1:31175 - OTP Entry - Empty
 * - 1:31277 - OTP Entry - Filled
 * - 1:31485 - OTP Entry - Error 1
 * - 1:31380 - OTP Entry - Error 2
 */

import { browser, $, $$ } from '@wdio/globals';
import { sauceVisualCheck, navigateToPhoneEntry } from '../helpers/visual-helpers';

describe('Auth Flow - Visual Tests', () => {
  beforeEach(async () => {
    await browser.pause(2000);
  });

  describe('Phone Entry Screen', () => {
    it('Phone Entry - Empty State', async () => {
      await navigateToPhoneEntry();
      await browser.pause(1500);

      await sauceVisualCheck({
        name: 'phone-entry-empty',
        testName: 'Phone Entry - Empty State',
        suiteName: 'Auth Flow',
      });
    });

    it('Phone Entry - Filled State', async () => {
      await navigateToPhoneEntry();
      await browser.pause(1000);

      // Find phone input and enter number
      const phoneInput = await $('~phone_input');
      await phoneInput.setValue('9999999999');
      await browser.pause(500);

      await sauceVisualCheck({
        name: 'phone-entry-filled',
        testName: 'Phone Entry - Filled State',
        suiteName: 'Auth Flow',
      });
    });

    it('Phone Entry - Error State (Invalid Number)', async () => {
      await navigateToPhoneEntry();
      await browser.pause(1000);

      // Enter invalid phone number
      const phoneInput = await $('~phone_input');
      await phoneInput.setValue('12345');
      await browser.pause(500);

      // Try to submit
      const continueButton = await $('~primary_button');
      await continueButton.click();
      await browser.pause(1000);

      await sauceVisualCheck({
        name: 'phone-entry-error-invalid',
        testName: 'Phone Entry - Error Invalid Number',
        suiteName: 'Auth Flow',
      });
    });

    it('Phone Entry - Error State (Invalid Start Digit)', async () => {
      await navigateToPhoneEntry();
      await browser.pause(1000);

      // Enter phone starting with 5 (invalid)
      const phoneInput = await $('~phone_input');
      await phoneInput.setValue('5555555555');
      await browser.pause(500);

      // Try to submit
      const continueButton = await $('~primary_button');
      await continueButton.click();
      await browser.pause(1000);

      await sauceVisualCheck({
        name: 'phone-entry-error-start-digit',
        testName: 'Phone Entry - Error Invalid Start Digit',
        suiteName: 'Auth Flow',
      });
    });
  });

  describe('OTP Verification Screen', () => {
    beforeEach(async () => {
      // Navigate to OTP screen
      await navigateToPhoneEntry();
      await browser.pause(1000);

      const phoneInput = await $('~phone_input');
      await phoneInput.setValue('9999999999');

      const continueButton = await $('~primary_button');
      await continueButton.click();

      // Wait for OTP screen
      await browser.pause(3000);
    });

    it('OTP Entry - Empty State', async () => {
      await sauceVisualCheck({
        name: 'otp-entry-empty',
        testName: 'OTP Entry - Empty State',
        suiteName: 'Auth Flow',
      });
    });

    it('OTP Entry - Filled State', async () => {
      // Enter OTP digits
      for (let i = 0; i < 6; i++) {
        const otpField = await $(`~otp_input_${i}`);
        if (await otpField.isDisplayed()) {
          await otpField.setValue('0');
        }
      }
      await browser.pause(500);

      await sauceVisualCheck({
        name: 'otp-entry-filled',
        testName: 'OTP Entry - Filled State',
        suiteName: 'Auth Flow',
      });
    });

    it('OTP Entry - Error State (Invalid OTP)', async () => {
      // Enter wrong OTP
      for (let i = 0; i < 6; i++) {
        const otpField = await $(`~otp_input_${i}`);
        if (await otpField.isDisplayed()) {
          await otpField.setValue('1');
        }
      }

      // Try to verify
      const verifyButton = await $('~primary_button');
      await verifyButton.click();
      await browser.pause(2000);

      await sauceVisualCheck({
        name: 'otp-entry-error',
        testName: 'OTP Entry - Error State',
        suiteName: 'Auth Flow',
      });
    });
  });
});
