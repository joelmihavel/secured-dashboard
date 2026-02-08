/**
 * UI vs Figma Comparison Tool
 *
 * Compares actual UI measurements from describe_ui against Figma extraction data
 * to identify pixel-perfect discrepancies.
 *
 * Usage: npx ts-node scripts/compare-ui-figma.ts
 */

// Figma extraction data for key elements (from enhanced-extraction.json)
const FIGMA_SPECS = {
  // Referral Code Input (node I41:11253;50:331;1106:66616)
  referralInputBox: {
    width: 64,
    height: 64,
    gap: 8, // between boxes
    borderRadius: 8,
  },

  // Benefits Card (node 41:11255)
  benefitsCard: {
    width: 313,
    height: 342,
    borderRadius: 12,
    paddingTop: 32,
    paddingHorizontal: 24,
  },

  // Benefits Card Title (node 41:11258)
  benefitsTitle: {
    width: 265,
    height: 80,
    fontSize: 28,
    lineHeight: 40,
  },

  // Benefit Item Text (nodes 41:11265, 41:11271, 41:11277)
  benefitText: {
    width: 196.48,
    height: 40, // can be 20 for single line
    fontSize: 12,
    lineHeight: 20,
  },

  // Button (Enter Invite Code)
  button: {
    width: 281,
    height: 58,
  },

  // Content width
  contentWidth: 313,
};

// Actual UI measurements from describe_ui (converted to comparable units)
// Note: describe_ui returns points, Figma uses pixels. On @3x devices, 1pt = 3px
// But React Native uses points, so we compare directly
const ACTUAL_UI = {
  // From describe_ui output
  referralInputBoxes: [
    { x: 70.33, y: 285.33, width: 46, height: 46 },
    { x: 142.33, y: 285.33, width: 46, height: 46 },
    { x: 214.33, y: 285.33, width: 46, height: 46 },
    { x: 286.33, y: 285.33, width: 46, height: 46 },
  ],

  benefitsTitle: {
    x: 68.67,
    y: 632.33,
    width: 242,
    height: 80.33,
    label: "What do you get\nwith Flent Secured?",
  },

  benefitTexts: [
    { x: 137, y: 736, width: 196.67, height: 40.33, label: "Earn 1% back for paying rent on time" },
    { x: 137, y: 810, width: 196.67, height: 20.33, label: "Build a stronger rent history" },
    { x: 137, y: 864, width: 196.67, height: 40.33, label: "Unlock exclusive renting benefits over time" },
  ],

  button: {
    x: 60.67,
    y: 478.33,
    width: 281,
    height: 58,
    label: "Enter Invite Code",
  },
};

interface Discrepancy {
  element: string;
  property: string;
  figma: number;
  actual: number;
  diff: number;
  percentOff: string;
  severity: 'critical' | 'warning' | 'minor';
}

function compareValues(
  element: string,
  property: string,
  figma: number,
  actual: number
): Discrepancy | null {
  const diff = Math.abs(figma - actual);

  if (diff < 0.5) return null; // Within tolerance

  const percentOff = ((diff / figma) * 100).toFixed(1);

  let severity: 'critical' | 'warning' | 'minor';
  if (diff > 10 || parseFloat(percentOff) > 20) {
    severity = 'critical';
  } else if (diff > 5 || parseFloat(percentOff) > 10) {
    severity = 'warning';
  } else {
    severity = 'minor';
  }

  return {
    element,
    property,
    figma,
    actual,
    diff,
    percentOff: `${percentOff}%`,
    severity,
  };
}

function runComparison(): void {
  console.log('\n📊 UI vs Figma Comparison Report');
  console.log('================================\n');

  const discrepancies: Discrepancy[] = [];

  // Compare Referral Input Boxes
  console.log('🔲 Referral Code Input Boxes:');
  const inputBox = ACTUAL_UI.referralInputBoxes[0];

  const widthDisc = compareValues('ReferralInputBox', 'width', FIGMA_SPECS.referralInputBox.width, inputBox.width);
  const heightDisc = compareValues('ReferralInputBox', 'height', FIGMA_SPECS.referralInputBox.height, inputBox.height);

  if (widthDisc) discrepancies.push(widthDisc);
  if (heightDisc) discrepancies.push(heightDisc);

  console.log(`   Figma: ${FIGMA_SPECS.referralInputBox.width}x${FIGMA_SPECS.referralInputBox.height}`);
  console.log(`   Actual: ${inputBox.width}x${inputBox.height}`);

  // Calculate gap between boxes
  const actualGap = ACTUAL_UI.referralInputBoxes[1].x - (ACTUAL_UI.referralInputBoxes[0].x + ACTUAL_UI.referralInputBoxes[0].width);
  const gapDisc = compareValues('ReferralInputBox', 'gap', FIGMA_SPECS.referralInputBox.gap, actualGap);
  if (gapDisc) discrepancies.push(gapDisc);

  console.log(`   Gap - Figma: ${FIGMA_SPECS.referralInputBox.gap}, Actual: ${actualGap.toFixed(2)}`);

  // Compare Benefits Title
  console.log('\n📝 Benefits Card Title:');
  const titleWidthDisc = compareValues('BenefitsTitle', 'width', FIGMA_SPECS.benefitsTitle.width, ACTUAL_UI.benefitsTitle.width);
  const titleHeightDisc = compareValues('BenefitsTitle', 'height', FIGMA_SPECS.benefitsTitle.height, ACTUAL_UI.benefitsTitle.height);

  if (titleWidthDisc) discrepancies.push(titleWidthDisc);
  if (titleHeightDisc) discrepancies.push(titleHeightDisc);

  console.log(`   Figma: ${FIGMA_SPECS.benefitsTitle.width}x${FIGMA_SPECS.benefitsTitle.height}`);
  console.log(`   Actual: ${ACTUAL_UI.benefitsTitle.width}x${ACTUAL_UI.benefitsTitle.height}`);

  // Compare Benefit Text Items
  console.log('\n📋 Benefit Text Items:');
  ACTUAL_UI.benefitTexts.forEach((text, i) => {
    const textWidthDisc = compareValues(`BenefitText[${i}]`, 'width', FIGMA_SPECS.benefitText.width, text.width);
    if (textWidthDisc) discrepancies.push(textWidthDisc);
    console.log(`   [${i}] "${text.label.substring(0, 30)}..."`);
    console.log(`       Figma width: ${FIGMA_SPECS.benefitText.width}, Actual: ${text.width}`);
  });

  // Compare Button
  console.log('\n🔘 Enter Invite Code Button:');
  const btnWidthDisc = compareValues('Button', 'width', FIGMA_SPECS.button.width, ACTUAL_UI.button.width);
  const btnHeightDisc = compareValues('Button', 'height', FIGMA_SPECS.button.height, ACTUAL_UI.button.height);

  if (btnWidthDisc) discrepancies.push(btnWidthDisc);
  if (btnHeightDisc) discrepancies.push(btnHeightDisc);

  console.log(`   Figma: ${FIGMA_SPECS.button.width}x${FIGMA_SPECS.button.height}`);
  console.log(`   Actual: ${ACTUAL_UI.button.width}x${ACTUAL_UI.button.height}`);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 DISCREPANCY SUMMARY');
  console.log('='.repeat(50) + '\n');

  const critical = discrepancies.filter(d => d.severity === 'critical');
  const warnings = discrepancies.filter(d => d.severity === 'warning');
  const minor = discrepancies.filter(d => d.severity === 'minor');

  if (critical.length > 0) {
    console.log('🔴 CRITICAL (>10px or >20% off):');
    critical.forEach(d => {
      console.log(`   ${d.element}.${d.property}: Figma=${d.figma}, Actual=${d.actual} (${d.percentOff} off)`);
    });
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('🟡 WARNINGS (>5px or >10% off):');
    warnings.forEach(d => {
      console.log(`   ${d.element}.${d.property}: Figma=${d.figma}, Actual=${d.actual} (${d.percentOff} off)`);
    });
    console.log('');
  }

  if (minor.length > 0) {
    console.log('🟢 MINOR (<5px):');
    minor.forEach(d => {
      console.log(`   ${d.element}.${d.property}: Figma=${d.figma}, Actual=${d.actual} (${d.percentOff} off)`);
    });
    console.log('');
  }

  if (discrepancies.length === 0) {
    console.log('✅ All measurements match Figma specs!');
  } else {
    console.log(`\nTotal discrepancies: ${discrepancies.length}`);
    console.log(`  Critical: ${critical.length}`);
    console.log(`  Warnings: ${warnings.length}`);
    console.log(`  Minor: ${minor.length}`);
  }
}

runComparison();
