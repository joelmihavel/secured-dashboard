/**
 * Visual Tests - Home Flow
 * Compares against Figma baselines from Project "Secured v2" Branch "Secured 2.2"
 *
 * Home State Variants (20 total):
 * - 41:4569 - zeroState
 * - 41:3186 - setupPaymentUPI
 * - 41:7005 - setupPayment
 * - 41:5792 - emptyWithUPIPayments
 * - 41:5998 - emptyWithUPIPaid
 * - 41:6204 - emptyWithUPINoPayments
 * - 41:6385 - emptyWithCashback
 * - 41:6598 - emptyWithCashbackPaid
 * - 41:6811 - emptyNoCashback
 * - 41:3267 - activeQualified
 * - 41:3472 - activeComplete
 * - 41:3677 - latePayment
 * - 41:3885 - missedPayment
 * - 41:4093 - multipleMissedPayments
 * - Landlord substates: invitationSent, pendingUnder24hrs, pendingOver24hrs, invitationFailed, invitationDeclined
 */

import { browser, $ } from '@wdio/globals';
import { sauceVisualCheck, navigateToHomeScreen } from '../helpers/visual-helpers';

describe('Home Flow - Visual Tests', () => {
  // Note: These tests require different user states to be set up in mock service
  // The mock service should expose environment variables or launch args to control state

  describe('Zero State', () => {
    it('Home - Zero State (New User)', async () => {
      // Set mock state to zero state
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=zeroState'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-zero-state',
        testName: 'Home - Zero State',
        suiteName: 'Home Flow',
      });
    });
  });

  describe('Setup States', () => {
    it('Home - Setup Payment UPI', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=setupPaymentUPI'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-setup-payment-upi',
        testName: 'Home - Setup Payment UPI',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Setup Payment', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=setupPayment'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-setup-payment',
        testName: 'Home - Setup Payment',
        suiteName: 'Home Flow',
      });
    });
  });

  describe('Empty States with UPI', () => {
    it('Home - Empty With UPI Payments', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=emptyWithUPIPayments'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-empty-upi-payments',
        testName: 'Home - Empty With UPI Payments',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Empty With UPI Paid', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=emptyWithUPIPaid'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-empty-upi-paid',
        testName: 'Home - Empty With UPI Paid',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Empty With UPI No Payments', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=emptyWithUPINoPayments'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-empty-upi-no-payments',
        testName: 'Home - Empty With UPI No Payments',
        suiteName: 'Home Flow',
      });
    });
  });

  describe('Cashback States', () => {
    it('Home - Empty With Cashback', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=emptyWithCashback'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-empty-cashback',
        testName: 'Home - Empty With Cashback',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Empty With Cashback Paid', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=emptyWithCashbackPaid'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-empty-cashback-paid',
        testName: 'Home - Empty With Cashback Paid',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Empty No Cashback', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=emptyNoCashback'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-empty-no-cashback',
        testName: 'Home - Empty No Cashback',
        suiteName: 'Home Flow',
      });
    });
  });

  describe('Active States', () => {
    it('Home - Active Qualified', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=activeQualified'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-active-qualified',
        testName: 'Home - Active Qualified',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Active Complete', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=activeComplete'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-active-complete',
        testName: 'Home - Active Complete',
        suiteName: 'Home Flow',
      });
    });
  });

  describe('Payment Warning States', () => {
    it('Home - Late Payment', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=latePayment'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-late-payment',
        testName: 'Home - Late Payment',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Missed Payment', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=missedPayment'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-missed-payment',
        testName: 'Home - Missed Payment',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Multiple Missed Payments', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=multipleMissedPayments'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-multiple-missed-payments',
        testName: 'Home - Multiple Missed Payments',
        suiteName: 'Home Flow',
      });
    });
  });

  describe('Landlord Invitation States', () => {
    it('Home - Invitation Sent', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=invitationSent'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-invitation-sent',
        testName: 'Home - Invitation Sent',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Pending Under 24hrs', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=pendingUnder24hrs'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-pending-under-24hrs',
        testName: 'Home - Pending Under 24hrs',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Pending Over 24hrs', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=pendingOver24hrs'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-pending-over-24hrs',
        testName: 'Home - Pending Over 24hrs',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Invitation Failed', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=invitationFailed'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-invitation-failed',
        testName: 'Home - Invitation Failed',
        suiteName: 'Home Flow',
      });
    });

    it('Home - Invitation Declined', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-home-state=invitationDeclined'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'home-invitation-declined',
        testName: 'Home - Invitation Declined',
        suiteName: 'Home Flow',
      });
    });
  });
});
