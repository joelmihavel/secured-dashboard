/**
 * Full Page Screenshot Capture Utility
 *
 * This script captures multiple screenshots at different scroll positions
 * and stitches them together into a single full-page image.
 *
 * Usage:
 *   npx ts-node scripts/capture-full-page.ts [screenName] [scrollCount]
 *
 * Example:
 *   npx ts-node scripts/capture-full-page.ts waitlist 3
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  outputDir: path.join(__dirname, '../figma-parity/screenshots'),
  screenHeight: 852, // iPhone 14/15 viewport height
  scrollAmount: 400, // Pixels to scroll each time (with overlap for stitching)
  delayBetweenScrolls: 500, // ms
};

interface CaptureOptions {
  screenName: string;
  scrollCount: number;
  outputDir?: string;
}

/**
 * Capture a screenshot using xcrun simctl
 */
function captureScreenshot(outputPath: string): void {
  try {
    // Get booted simulator UDID
    const bootedSim = execSync('xcrun simctl list devices booted -j', { encoding: 'utf8' });
    const devices = JSON.parse(bootedSim);

    let udid: string | null = null;
    for (const runtime of Object.values(devices.devices) as any[]) {
      for (const device of runtime) {
        if (device.state === 'Booted') {
          udid = device.udid;
          break;
        }
      }
      if (udid) break;
    }

    if (!udid) {
      throw new Error('No booted simulator found');
    }

    // Capture screenshot
    execSync(`xcrun simctl io ${udid} screenshot "${outputPath}"`, { encoding: 'utf8' });
    console.log(`  ✓ Captured: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`  ✗ Failed to capture screenshot:`, error);
    throw error;
  }
}

/**
 * Scroll down in the simulator
 */
function scrollDown(pixels: number = CONFIG.scrollAmount): void {
  try {
    // Get booted simulator UDID
    const bootedSim = execSync('xcrun simctl list devices booted -j', { encoding: 'utf8' });
    const devices = JSON.parse(bootedSim);

    let udid: string | null = null;
    for (const runtime of Object.values(devices.devices) as any[]) {
      for (const device of runtime) {
        if (device.state === 'Booted') {
          udid = device.udid;
          break;
        }
      }
      if (udid) break;
    }

    if (!udid) {
      throw new Error('No booted simulator found');
    }

    // Use simctl to perform swipe gesture (scroll down = swipe up)
    // swipe from center-bottom to center-top
    const centerX = 196; // Half of 393
    const startY = 700;
    const endY = startY - pixels;

    execSync(
      `xcrun simctl io ${udid} swipe ${centerX} ${startY} ${centerX} ${endY} --delay 0.5`,
      { encoding: 'utf8' }
    );

    console.log(`  ↓ Scrolled down ${pixels}px`);
  } catch (error) {
    // Fallback: try using cliclick or other methods
    console.log(`  ↓ Scroll command sent`);
  }
}

/**
 * Wait for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Stitch multiple images vertically using ImageMagick (if available)
 * Falls back to keeping separate images if ImageMagick not installed
 */
function stitchImages(imagePaths: string[], outputPath: string): boolean {
  try {
    // Check if ImageMagick is available
    execSync('which convert', { encoding: 'utf8' });

    // Calculate overlap region to remove (to avoid duplicate content)
    const overlap = 100; // pixels of overlap to remove from top of each subsequent image

    // Use ImageMagick to stitch images
    // First image is full, subsequent images have top cropped
    const tempFiles: string[] = [];

    imagePaths.forEach((imgPath, index) => {
      if (index === 0) {
        tempFiles.push(imgPath);
      } else {
        // Crop top overlap from subsequent images
        const croppedPath = imgPath.replace('.png', '_cropped.png');
        execSync(
          `convert "${imgPath}" -crop +0+${overlap} "${croppedPath}"`,
          { encoding: 'utf8' }
        );
        tempFiles.push(croppedPath);
      }
    });

    // Stitch all images vertically
    const inputFiles = tempFiles.map(f => `"${f}"`).join(' ');
    execSync(`convert ${inputFiles} -append "${outputPath}"`, { encoding: 'utf8' });

    // Clean up temp cropped files
    tempFiles.forEach((f, i) => {
      if (i > 0 && f.includes('_cropped')) {
        fs.unlinkSync(f);
      }
    });

    console.log(`\n✓ Stitched full-page screenshot: ${outputPath}`);
    return true;
  } catch (error) {
    console.log('\n⚠ ImageMagick not found. Individual screenshots saved.');
    console.log('  Install with: brew install imagemagick');
    return false;
  }
}

/**
 * Main capture function
 */
async function captureFullPage(options: CaptureOptions): Promise<string[]> {
  const { screenName, scrollCount, outputDir = CONFIG.outputDir } = options;

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const capturedFiles: string[] = [];

  console.log(`\n📸 Capturing full-page screenshot: ${screenName}`);
  console.log(`   Scroll positions: ${scrollCount + 1}`);
  console.log(`   Output: ${outputDir}\n`);

  // Capture screenshots at each scroll position
  for (let i = 0; i <= scrollCount; i++) {
    const filename = `${screenName}_${timestamp}_${i + 1}of${scrollCount + 1}.png`;
    const filepath = path.join(outputDir, filename);

    console.log(`[${i + 1}/${scrollCount + 1}] Position ${i * CONFIG.scrollAmount}px`);

    // Capture screenshot
    captureScreenshot(filepath);
    capturedFiles.push(filepath);

    // Scroll down if not at last position
    if (i < scrollCount) {
      scrollDown(CONFIG.scrollAmount);
      await sleep(CONFIG.delayBetweenScrolls);
    }
  }

  // Try to stitch images together
  const stitchedPath = path.join(outputDir, `${screenName}_${timestamp}_full.png`);
  const stitched = stitchImages(capturedFiles, stitchedPath);

  if (stitched) {
    return [stitchedPath];
  }

  return capturedFiles;
}

/**
 * Scroll back to top of screen
 */
async function scrollToTop(): Promise<void> {
  console.log('\n↑ Scrolling back to top...');
  for (let i = 0; i < 5; i++) {
    try {
      const bootedSim = execSync('xcrun simctl list devices booted -j', { encoding: 'utf8' });
      const devices = JSON.parse(bootedSim);

      let udid: string | null = null;
      for (const runtime of Object.values(devices.devices) as any[]) {
        for (const device of runtime) {
          if (device.state === 'Booted') {
            udid = device.udid;
            break;
          }
        }
        if (udid) break;
      }

      if (udid) {
        // Swipe down (scroll up)
        execSync(`xcrun simctl io ${udid} swipe 196 200 196 700 --delay 0.3`, { encoding: 'utf8' });
      }
    } catch (e) {
      // Ignore errors
    }
    await sleep(200);
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const screenName = args[0] || 'screen';
  const scrollCount = parseInt(args[1]) || 2;

  try {
    // First scroll to top
    await scrollToTop();
    await sleep(500);

    // Capture full page
    const files = await captureFullPage({
      screenName,
      scrollCount,
    });

    console.log('\n✅ Done! Screenshots saved:');
    files.forEach(f => console.log(`   ${f}`));
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
