/**
 * WebdriverIO Configuration for Sauce Labs Visual Testing
 * Uses VDC (Virtual Device Cloud / Simulators) for iOS testing
 * Integrates with Figma baselines from Project "Secured v2" Branch "Secured 2.2"
 */

// Sauce Labs Visual configuration
const sauceVisualConfig = {
  project: 'Secured v2',
  branch: 'Secured 2.4',
  buildName: `Visual-${new Date().toISOString().split('T')[0]}`,
};

export const config = {
  // ====================
  // Runner Configuration
  // ====================
  runner: 'local',
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: './tsconfig.json',
      transpileOnly: true,
    },
  },

  // ==================
  // Sauce Labs Service
  // ==================
  user: process.env.SAUCE_USERNAME,
  key: process.env.SAUCE_ACCESS_KEY,
  hostname: 'ondemand.us-west-1.saucelabs.com',
  port: 443,
  protocol: 'https',
  path: '/wd/hub',

  // ============
  // Capabilities - Using VDC (Simulators)
  // ============
  capabilities: [
    {
      platformName: 'iOS',
      browserName: '',
      'appium:deviceName': 'iPhone 14 Pro Simulator',
      'appium:platformVersion': '17.0',
      'appium:automationName': 'XCUITest',
      'appium:app': 'storage:filename=FlentSecured-simulator.app.zip',
      'appium:noReset': false,
      'appium:fullReset': false,
      'sauce:options': {
        name: 'Flent Visual Tests - iPhone 14 Pro',
        tags: ['visual', 'ios', 'figma-baseline', 'vdc'],
        build: sauceVisualConfig.buildName,
        appiumVersion: '2.11.3',
      },
    },
  ],

  // ==================
  // Test Configuration
  // ==================
  specs: ['./specs/**/*.spec.ts'],
  exclude: [],
  maxInstances: 1,
  logLevel: 'info',
  bail: 0,
  waitforTimeout: 30000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // =========
  // Framework
  // =========
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 300000,
  },

  // =========
  // Reporters
  // =========
  reporters: ['spec'],

  // ========
  // Services
  // ========
  services: [
    [
      'sauce',
      {
        sauceConnect: false,
      },
    ],
    [
      '@saucelabs/wdio-sauce-visual-service',
      {
        buildName: sauceVisualConfig.buildName,
        project: sauceVisualConfig.project,
        branch: sauceVisualConfig.branch,
      },
    ],
  ],

  // =====
  // Hooks
  // =====
  before: async function () {
    console.log('Starting Sauce Labs Visual Tests (VDC)');
    console.log(`Project: ${sauceVisualConfig.project}`);
    console.log(`Branch: ${sauceVisualConfig.branch}`);
    console.log(`Build: ${sauceVisualConfig.buildName}`);
  },

  afterTest: async function (test: any, context: any, { error }: any) {
    if (error) {
      console.error(`Test "${test.title}" failed:`, error.message);
    }
  },

  after: async function () {
    console.log('Visual tests completed. Check Sauce Labs Visual dashboard for results.');
  },
};
