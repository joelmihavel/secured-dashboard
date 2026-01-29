/**
 * Visual Tests - Splash Flow
 * Compares against Figma baselines from Project "Secured v2" Branch "Secured 2.2"
 *
 * Figma Screens:
 * - 1:28055 - Splash / get-started
 * - 1:28071 - Splash / animation
 * - 1:28985 - Carousel 1 - Good Habits
 * - 1:29025 - Carousel 2 - Earn Everytime
 * - 1:29065 - Carousel 3 - It Gets Better
 */

import { browser, $ } from '@wdio/globals';
import { sauceVisualCheck } from '../helpers/visual-helpers';

describe('Splash Flow - Visual Tests', () => {
  beforeEach(async () => {
    // Ensure app is launched fresh
    await browser.pause(2000);
  });

  it('Splash - Get Started Screen', async () => {
    // Wait for splash screen to fully render
    await browser.pause(3000);

    // Take visual snapshot matching Figma node 1:28055
    await sauceVisualCheck({
      name: 'splash-get-started',
      testName: 'Splash - Get Started Screen',
      suiteName: 'Splash Flow',
      // This should match metadata set in Figma export
    });
  });

  it('Carousel 1 - Good Habits', async () => {
    // Swipe to carousel 1
    const screenWidth = (await browser.getWindowSize()).width;
    const screenHeight = (await browser.getWindowSize()).height;

    // Swipe left to next carousel
    await browser.touchAction([
      { action: 'press', x: screenWidth * 0.8, y: screenHeight * 0.5 },
      { action: 'wait', ms: 300 },
      { action: 'moveTo', x: screenWidth * 0.2, y: screenHeight * 0.5 },
      { action: 'release' },
    ]);

    await browser.pause(1000);

    await sauceVisualCheck({
      name: 'carousel-1-good-habits',
      testName: 'Carousel 1 - Good Habits',
      suiteName: 'Splash Flow',
    });
  });

  it('Carousel 2 - Earn Everytime', async () => {
    // Swipe to carousel 2
    const screenWidth = (await browser.getWindowSize()).width;
    const screenHeight = (await browser.getWindowSize()).height;

    // Swipe left twice
    for (let i = 0; i < 2; i++) {
      await browser.touchAction([
        { action: 'press', x: screenWidth * 0.8, y: screenHeight * 0.5 },
        { action: 'wait', ms: 300 },
        { action: 'moveTo', x: screenWidth * 0.2, y: screenHeight * 0.5 },
        { action: 'release' },
      ]);
      await browser.pause(800);
    }

    await sauceVisualCheck({
      name: 'carousel-2-earn-everytime',
      testName: 'Carousel 2 - Earn Everytime',
      suiteName: 'Splash Flow',
    });
  });

  it('Carousel 3 - It Gets Better', async () => {
    // Swipe to carousel 3
    const screenWidth = (await browser.getWindowSize()).width;
    const screenHeight = (await browser.getWindowSize()).height;

    // Swipe left three times
    for (let i = 0; i < 3; i++) {
      await browser.touchAction([
        { action: 'press', x: screenWidth * 0.8, y: screenHeight * 0.5 },
        { action: 'wait', ms: 300 },
        { action: 'moveTo', x: screenWidth * 0.2, y: screenHeight * 0.5 },
        { action: 'release' },
      ]);
      await browser.pause(800);
    }

    await sauceVisualCheck({
      name: 'carousel-3-it-gets-better',
      testName: 'Carousel 3 - It Gets Better',
      suiteName: 'Splash Flow',
    });
  });
});
