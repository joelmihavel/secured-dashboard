/**
 * Visual Tests - Profile Flow
 * Compares against Figma baselines from Project "Secured v2" Branch "Secured 2.2"
 *
 * Figma Screens:
 * - 41:11720 - Profile Main
 * - 41:5381 - Personal Details
 * - 41:5587 - Agreement Details
 * - 41:4969 - Landlord Bank Account
 * - 41:3885 - Credit Card Details
 * - 41:4093 - UPI Details
 */

import { browser, $ } from '@wdio/globals';
import { sauceVisualCheck } from '../helpers/visual-helpers';

describe('Profile Flow - Visual Tests', () => {
  describe('Profile Main Screen', () => {
    it('Profile - Main View', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-profile-state=main'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'profile-main',
        testName: 'Profile - Main View',
        suiteName: 'Profile Flow',
      });
    });
  });

  describe('Profile Detail Screens', () => {
    it('Personal Details', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-profile-state=personalDetails'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'profile-personal-details',
        testName: 'Profile - Personal Details',
        suiteName: 'Profile Flow',
      });
    });

    it('Agreement Details', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-profile-state=agreementDetails'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'profile-agreement-details',
        testName: 'Profile - Agreement Details',
        suiteName: 'Profile Flow',
      });
    });

    it('Landlord Bank Account', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-profile-state=landlordBankAccount'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'profile-landlord-bank',
        testName: 'Profile - Landlord Bank Account',
        suiteName: 'Profile Flow',
      });
    });

    it('Linked Landlord', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-profile-state=linkedLandlord'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'profile-linked-landlord',
        testName: 'Profile - Linked Landlord',
        suiteName: 'Profile Flow',
      });
    });

    it('Payment History', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-profile-state=paymentHistory'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'profile-payment-history',
        testName: 'Profile - Payment History',
        suiteName: 'Profile Flow',
      });
    });
  });
});
