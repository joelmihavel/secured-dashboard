/**
 * Visual Tests - Payment Flow
 * Compares against Figma baselines from Project "Secured v2" Branch "Secured 2.2"
 *
 * Figma Screens:
 * - 1:30268 - Transaction - With Cashback
 * - 41:9811 - Transaction - No Cashback
 * - 41:4430 - Transaction - First Visit
 * - 41:9388 - Transaction - Late Payment
 * - 41:9307 - Methods - Without Setup
 * - 41:8529 - Methods - Before 7th
 * - 41:11313 - Methods - After 7th
 * - 41:7741 - Processing
 * - 41:8880 - Success - With Cashback
 * - 41:4345 - Success - No Cashback
 * - 41:9114 - Failed
 * - 41:7005 - Refunded
 */

import { browser, $ } from '@wdio/globals';
import { sauceVisualCheck } from '../helpers/visual-helpers';

describe('Payment Flow - Visual Tests', () => {
  describe('Payment Transaction Screen', () => {
    it('Transaction - With Cashback', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=transactionWithCashback'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-transaction-cashback',
        testName: 'Transaction - With Cashback',
        suiteName: 'Payment Flow',
      });
    });

    it('Transaction - No Cashback', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=transactionNoCashback'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-transaction-no-cashback',
        testName: 'Transaction - No Cashback',
        suiteName: 'Payment Flow',
      });
    });

    it('Transaction - First Visit', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=transactionFirstVisit'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-transaction-first-visit',
        testName: 'Transaction - First Visit',
        suiteName: 'Payment Flow',
      });
    });

    it('Transaction - Late Payment', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=transactionLatePayment'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-transaction-late',
        testName: 'Transaction - Late Payment',
        suiteName: 'Payment Flow',
      });
    });
  });

  describe('Payment Methods Screen', () => {
    it('Methods - Without Setup', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=methodsWithoutSetup'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-methods-without-setup',
        testName: 'Payment Methods - Without Setup',
        suiteName: 'Payment Flow',
      });
    });

    it('Methods - Before 7th (Cashback Available)', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=methodsBefore7th'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-methods-before-7th',
        testName: 'Payment Methods - Before 7th',
        suiteName: 'Payment Flow',
      });
    });

    it('Methods - After 7th (No Cashback)', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=methodsAfter7th'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-methods-after-7th',
        testName: 'Payment Methods - After 7th',
        suiteName: 'Payment Flow',
      });
    });
  });

  describe('Payment Processing Screen', () => {
    it('Processing Animation', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=processing'],
      });

      await browser.pause(2000);

      await sauceVisualCheck({
        name: 'payment-processing',
        testName: 'Payment Processing',
        suiteName: 'Payment Flow',
        // Ignore animated areas
        ignoreRegions: [
          { x: 100, y: 300, width: 200, height: 200 }, // Lottie animation area
        ],
      });
    });
  });

  describe('Payment Result Screens', () => {
    it('Success - With Cashback', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=successWithCashback'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-success-cashback',
        testName: 'Payment Success - With Cashback',
        suiteName: 'Payment Flow',
      });
    });

    it('Success - No Cashback', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=successNoCashback'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-success-no-cashback',
        testName: 'Payment Success - No Cashback',
        suiteName: 'Payment Flow',
      });
    });

    it('Failed', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=failed'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-failed',
        testName: 'Payment Failed',
        suiteName: 'Payment Flow',
      });
    });

    it('Refunded', async () => {
      await browser.execute('mobile: launchApp', {
        bundleId: 'app.flent.secured',
        arguments: ['--mock-payment-state=refunded'],
      });

      await browser.pause(3000);

      await sauceVisualCheck({
        name: 'payment-refunded',
        testName: 'Payment Refunded',
        suiteName: 'Payment Flow',
      });
    });
  });
});
