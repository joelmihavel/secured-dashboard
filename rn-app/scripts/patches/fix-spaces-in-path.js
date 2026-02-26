#!/usr/bin/env node
/**
 * fix-spaces-in-path.js
 *
 * Idempotently patches iOS build files that break when the project directory
 * path contains spaces (e.g., "Secured v2-react-native project").
 *
 * Targets:
 *   1. node_modules/expo-constants/ios/EXConstants.podspec
 *      - Quotes $PODS_TARGET_SRCROOT in script_phase
 *   2. node_modules/expo-updates/ios/EXUpdates.podspec
 *      - Quotes $PODS_TARGET_SRCROOT in script_phase
 *   3. node_modules/@sentry/react-native/scripts/sentry-xcode.sh
 *      - Changes /bin/sh -c "$VAR" to /bin/sh "$VAR" on line ~65
 *   4. ios/FlentSecured.xcodeproj/project.pbxproj
 *      - Replaces backtick $() expansions with quoted variables for sentry/RN scripts
 *   5. ios/Podfile
 *      - Adds post_install hook to quote $PODS_TARGET_SRCROOT (if not present)
 *
 * Usage:
 *   node scripts/patches/fix-spaces-in-path.js
 *
 * All patches are idempotent -- safe to run multiple times.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const NODE_MODULES = path.join(PROJECT_ROOT, 'node_modules');
const IOS_DIR = path.join(PROJECT_ROOT, 'ios');

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';

function log(msg) {
  console.log(`${CYAN}[fix-spaces]${RESET} ${msg}`);
}

function logSkip(reason) {
  console.log(`${DIM}  -> SKIP: ${reason}${RESET}`);
}

function logPatched(detail) {
  console.log(`${GREEN}  -> PATCHED: ${detail}${RESET}`);
}

function logAlready(detail) {
  console.log(`${YELLOW}  -> ALREADY OK: ${detail}${RESET}`);
}

function logError(detail) {
  console.log(`${RED}  -> ERROR: ${detail}${RESET}`);
}

/**
 * Reads a file, returns null if it does not exist.
 */
function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Writes content to a file, creating parent directories as needed.
 */
function safeWrite(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

let patchCount = 0;
let skipCount = 0;
let errorCount = 0;

// -------------------------------------------------------------------------
// Patch 1: expo-constants podspec
// -------------------------------------------------------------------------

function patchExpoConstants() {
  log('Patch 1/5: expo-constants EXConstants.podspec');

  const filePath = path.join(
    NODE_MODULES,
    'expo-constants',
    'ios',
    'EXConstants.podspec',
  );
  const content = safeRead(filePath);
  if (content === null) {
    logSkip('File not found (module not installed yet?)');
    skipCount++;
    return;
  }

  // The vulnerable line looks like:
  //   :script => "bash -l -c \"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"",
  // We need to ensure $PODS_TARGET_SRCROOT is quoted.
  // The fix: wrap the path expansion in escaped quotes.

  // The script_phase :script value looks like:
  // Original: "bash -l -c \"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\""
  // Fixed:    "bash -l -c \"#{env_vars}\\\"$PODS_TARGET_SRCROOT\\\"/../scripts/get-app-config-ios.sh\""
  const original = '$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh';
  const fixed = '\\\"$PODS_TARGET_SRCROOT\\\"/../scripts/get-app-config-ios.sh';

  // Already-patched check: the fixed string is already present
  if (content.includes(fixed)) {
    logAlready('$PODS_TARGET_SRCROOT already quoted');
    return;
  }

  if (!content.includes(original)) {
    logAlready('Pattern not found (already patched or podspec format changed)');
    return;
  }

  const newContent = content.replace(original, fixed);
  safeWrite(filePath, newContent);
  logPatched('Quoted $PODS_TARGET_SRCROOT in script_phase');
  patchCount++;
}

// -------------------------------------------------------------------------
// Patch 2: expo-updates podspec
// -------------------------------------------------------------------------

function patchExpoUpdates() {
  log('Patch 2/5: expo-updates EXUpdates.podspec');

  const filePath = path.join(
    NODE_MODULES,
    'expo-updates',
    'ios',
    'EXUpdates.podspec',
  );
  const content = safeRead(filePath);
  if (content === null) {
    logSkip('File not found (module not installed yet?)');
    skipCount++;
    return;
  }

  // The vulnerable line looks like:
  //   :script => force_bundling_flag + 'bash -l -c "$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh"',
  // We need to quote $PODS_TARGET_SRCROOT.

  const original = '$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh';
  const fixed = '\\\"$PODS_TARGET_SRCROOT\\\"/../scripts/create-updates-resources-ios.sh';

  if (content.includes(fixed)) {
    logAlready('$PODS_TARGET_SRCROOT already quoted');
    return;
  }

  if (!content.includes(original)) {
    logAlready('Pattern not found (already patched or podspec format changed)');
    return;
  }

  const newContent = content.replace(original, fixed);
  safeWrite(filePath, newContent);
  logPatched('Quoted $PODS_TARGET_SRCROOT in script_phase');
  patchCount++;
}

// -------------------------------------------------------------------------
// Patch 3: sentry-xcode.sh
// -------------------------------------------------------------------------

function patchSentryXcode() {
  log('Patch 3/5: @sentry/react-native sentry-xcode.sh');

  const filePath = path.join(
    NODE_MODULES,
    '@sentry',
    'react-native',
    'scripts',
    'sentry-xcode.sh',
  );
  const content = safeRead(filePath);
  if (content === null) {
    logSkip('File not found (module not installed yet?)');
    skipCount++;
    return;
  }

  // The problematic line near line 65:
  //   /bin/sh -c "$REACT_NATIVE_XCODE"
  // Fix: /bin/sh "$REACT_NATIVE_XCODE" (remove the -c flag so the argument is treated as a file)
  //
  // But actually looking at the code, the line is:
  //   SENTRY_XCODE_COMMAND_OUTPUT=$(/bin/sh -c "\"$LOCAL_NODE_BINARY\" $REACT_NATIVE_XCODE_WITH_SENTRY" 2>&1)
  // That one is fine because $LOCAL_NODE_BINARY is a simple path.
  //
  // The actual problematic line when SENTRY_DISABLE_AUTO_UPLOAD=true is:
  //   /bin/sh -c "$REACT_NATIVE_XCODE"
  // which word-splits on spaces in the path.

  const originalPattern = '/bin/sh -c "$REACT_NATIVE_XCODE"';
  const fixedPattern = '/bin/sh "$REACT_NATIVE_XCODE"';

  if (content.includes(fixedPattern) && !content.includes(originalPattern)) {
    logAlready('/bin/sh -c already fixed');
    return;
  }

  if (!content.includes(originalPattern)) {
    // Try alternate patterns
    logAlready('Pattern not found (already patched or script format changed)');
    return;
  }

  const newContent = content.replace(originalPattern, fixedPattern);
  safeWrite(filePath, newContent);
  logPatched('Changed /bin/sh -c "$VAR" to /bin/sh "$VAR"');
  patchCount++;
}

// -------------------------------------------------------------------------
// Patch 4: project.pbxproj -- backtick expansions
// -------------------------------------------------------------------------

function patchPbxproj() {
  log('Patch 4/5: ios/FlentSecured.xcodeproj/project.pbxproj');

  const filePath = path.join(
    IOS_DIR,
    'FlentSecured.xcodeproj',
    'project.pbxproj',
  );
  const content = safeRead(filePath);
  if (content === null) {
    logSkip('File not found (run expo prebuild first)');
    skipCount++;
    return;
  }

  let newContent = content;
  let changes = 0;

  // Fix 4a: The "Bundle React Native code and images" script phase
  // It has lines like:
  //   /bin/sh $("$NODE_BINARY" --print "...sentry...") $("$NODE_BINARY" --print "...react-native...")
  // These backtick/subshell expansions break on paths with spaces.
  // Fix: quote the $(...) expansions.
  //
  // Original pattern (in the escaped pbxproj string):
  //   /bin/sh $("$NODE_BINARY" --print "require('path')...sentry-xcode.sh'") $("$NODE_BINARY" --print "require('path')...react-native-xcode.sh'")
  // Fixed:
  //   /bin/sh "$("$NODE_BINARY" --print "require('path')...sentry-xcode.sh'")" "$("$NODE_BINARY" --print "require('path')...react-native-xcode.sh'")"

  // Pattern for unquoted $(...) around sentry-xcode.sh
  const sentryBundleOriginal =
    '/bin/sh $(\\\"$NODE_BINARY\\\" --print \\\"require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\')) + \'/scripts/sentry-xcode.sh\'\\\")'
    + ' $(\\\"$NODE_BINARY\\\" --print \\\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\\")';

  const sentryBundleFixed =
    '/bin/sh \\\"$(\\\"$NODE_BINARY\\\" --print \\\"require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\')) + \'/scripts/sentry-xcode.sh\'\\\")\\\"'
    + ' \\\"$(\\\"$NODE_BINARY\\\" --print \\\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\\")\\\"';

  if (newContent.includes(sentryBundleOriginal)) {
    newContent = newContent.replace(sentryBundleOriginal, sentryBundleFixed);
    changes++;
  }

  // Fix 4b: The "Upload Debug Symbols to Sentry" script phase
  // Original: /bin/sh $(${NODE_BINARY:-node} --print "require('path')...sentry-xcode-debug-files.sh'")
  // Fixed:    /bin/sh "$(${NODE_BINARY:-node} --print "require('path')...sentry-xcode-debug-files.sh'")"
  const debugOriginal =
    '/bin/sh $(${NODE_BINARY:-node} --print \\\"require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\')) + \'/scripts/sentry-xcode-debug-files.sh\'\\\")';
  const debugFixed =
    '/bin/sh \\\"$(${NODE_BINARY:-node} --print \\\"require(\'path\').dirname(require.resolve(\'@sentry/react-native/package.json\')) + \'/scripts/sentry-xcode-debug-files.sh\'\\\")\\\"';

  if (newContent.includes(debugOriginal)) {
    newContent = newContent.replace(debugOriginal, debugFixed);
    changes++;
  }

  if (changes === 0) {
    logAlready('No unquoted backtick expansions found (already patched or format changed)');
    return;
  }

  safeWrite(filePath, newContent);
  logPatched(`Fixed ${changes} unquoted shell expansion(s) in pbxproj`);
  patchCount++;
}

// -------------------------------------------------------------------------
// Patch 5: Podfile -- post_install $PODS_TARGET_SRCROOT quoting
// -------------------------------------------------------------------------

function patchPodfile() {
  log('Patch 5/5: ios/Podfile post_install $PODS_TARGET_SRCROOT quoting');

  const filePath = path.join(IOS_DIR, 'Podfile');
  const content = safeRead(filePath);
  if (content === null) {
    logSkip('File not found (run expo prebuild first)');
    skipCount++;
    return;
  }

  // Check if our patch marker is already present
  const MARKER = '# [fix-spaces-in-path] Quote $PODS_TARGET_SRCROOT in script phases';
  if (content.includes(MARKER)) {
    logAlready('Post-install hook for $PODS_TARGET_SRCROOT quoting already present');
    return;
  }

  // We need to inject our quoting logic into the existing post_install block.
  // The Podfile has:
  //   post_install do |installer|
  //     react_native_post_install(...)
  //   end
  //
  // We inject AFTER react_native_post_install but BEFORE the closing end.

  const hookCode = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        if config.build_settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS']
          # no-op, just iterating
        end
      end
      target.shell_script_build_phases.each do |phase|
        if phase.shell_script.include?('$PODS_TARGET_SRCROOT')
          phase.shell_script = phase.shell_script.gsub(
            /(?<!")\\$PODS_TARGET_SRCROOT(?!")/,
            '"$PODS_TARGET_SRCROOT"'
          )
        end
      end
    end`;

  // Find the post_install block and inject before its closing `end`
  // Pattern: the last `end` that closes `post_install do |installer|`
  const postInstallMatch = content.match(
    /(post_install\s+do\s+\|installer\|[\s\S]*?)(^\s*end\s*$)/m,
  );

  if (!postInstallMatch) {
    logError('Could not find post_install block in Podfile');
    errorCount++;
    return;
  }

  const insertionPoint = postInstallMatch.index + postInstallMatch[1].length;
  const newContent =
    content.slice(0, insertionPoint) +
    hookCode +
    '\n' +
    content.slice(insertionPoint);

  safeWrite(filePath, newContent);
  logPatched('Added $PODS_TARGET_SRCROOT quoting to post_install hook');
  patchCount++;
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

function main() {
  console.log('');
  log('=== fix-spaces-in-path.js ===');
  log(`Project root: ${PROJECT_ROOT}`);
  console.log('');

  patchExpoConstants();
  console.log('');
  patchExpoUpdates();
  console.log('');
  patchSentryXcode();
  console.log('');
  patchPbxproj();
  console.log('');
  patchPodfile();

  console.log('');
  log('=== Summary ===');
  log(`  Patches applied: ${patchCount}`);
  log(`  Skipped (file missing): ${skipCount}`);
  log(`  Errors: ${errorCount}`);
  console.log('');

  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
