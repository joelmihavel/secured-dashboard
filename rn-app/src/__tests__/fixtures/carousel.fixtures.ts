/**
 * Test fixtures for Carousel Screen
 * Source: Figma blueprints 1-28985, 1-29025, 1-29065
 *
 * Carousel is a static onboarding screen with 3 slides.
 * No backend data fetching -- all content is hardcoded in the component.
 * No loading/error/empty states from API -- this is purely a UI flow.
 *
 * Updated 2026-02-19: headings are now single text nodes with colored spans
 * (matching Figma blueprint typography.spans), not split into titleLine1/titleLine2.
 */

// --- Slide content from Figma blueprints (exact text per typography.content) ---

export const SLIDE_1 = {
  figmaId: '1-28985',
  state: 'page4',
  headingContent: 'Earn 1% back on your rent',
  /** Segments for color verification */
  segments: [
    { text: 'Earn 1% back ', color: '#FF9A6D' },
    { text: 'on your rent', color: '#A9A9A9' },
  ],
  description: 'For every timely payment made via UPI, netbanking or credit cards.',
  skipText: 'Skip',
  skipArrow: '\u2192',           // right arrow character
};

export const SLIDE_2 = {
  figmaId: '1-29025',
  state: 'page5',
  headingContent: 'More than  just cashback',  // double space per Figma
  segments: [
    { text: 'More than ', color: '#A9A9A9' },
    { text: ' just cashback', color: '#FF9A6D' },
  ],
  description: 'Keep paying via Secured to unlock exclusive renting benefits over time',
  skipText: 'Skip',
  skipArrow: '\u2192',
};

export const SLIDE_3 = {
  figmaId: '1-29065',
  state: 'page6',
  headingContent: 'Your landlord benefits too',
  segments: [
    { text: 'Your', color: '#A9A9A9' },
    { text: ' ', color: '#A9A9A9' },
    { text: 'landlord', color: '#A9A9A9' },
    { text: ' ', color: '#FFFFFF' },
    { text: 'benefits too', color: '#FF9A6D' },
  ],
  description: '3 months of rent payments unlock a free vacancy cover for your landlord',
  skipText: 'Skip',
  skipArrow: '\u2192',
};

export const ALL_SLIDES = [SLIDE_1, SLIDE_2, SLIDE_3];

// --- Expected text content (for text content matching assertions) ---

export const EXPECTED_TEXT = {
  slide1: {
    heading: /Earn 1% back/,
    subheading: /on your rent/,
    body: /For every timely payment made via UPI, netbanking or credit cards/,
  },
  slide2: {
    heading: /More than/,
    subheading: /just cashback/,
    body: /Keep paying via Secured to unlock exclusive renting benefits over time/,
  },
  slide3: {
    heading: /Your landlord/,
    subheading: /benefits too/,
    body: /3 months of rent payments unlock a free vacancy cover for your landlord/,
  },
  skip: /Skip/,
};

// --- Navigation targets ---

export const EXPECTED_NAVIGATION = {
  skipTarget: '/(auth)/sign-up',
};

// --- Test IDs ---

export const EXPECTED_TEST_IDS = {
  screen: 'carousel-screen',
};

// --- Carousel configuration ---

export const CAROUSEL_CONFIG = {
  totalSlides: 3,
  dotCount: 3,
};
