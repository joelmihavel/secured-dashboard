const fs = require('fs');

function extractModalStyles(fileId) {
  const data = JSON.parse(fs.readFileSync(`figma-1on1parity/data/${fileId}-blueprint.json`, 'utf8'));
  
  // Find the modal background frame: "Frame 1686557301" or the wrapper "Frame 2095586317"
  const modalWrapper = data.nodes.find(n => n.name === 'Frame 2095586317');
  const modalBg = data.nodes.find(n => n.name === 'Frame 1686557301');
  const topTextGroup = data.nodes.find(n => n.name === 'Frame 2095586346');
  const amountText = data.nodes.find(n => n.name === '₹ 32500.00' || n.name === '₹ 28500.00' || n.name === '₹ 33500.00');
  const warningBg = data.nodes.find(n => n.name === 'Frame 2095586455');
  
  console.log(`\n=== MODAL STYLES FOR ${fileId} ===\n`);
  
  if (modalWrapper) {
    console.log('Modal Wrapper:', JSON.stringify(modalWrapper.layout, null, 2));
    console.log('Padding:', modalWrapper.padding);
  }
  
  if (modalBg) {
    console.log('Modal BG:', JSON.stringify(modalBg.layout, null, 2));
    console.log('Modal BG color:', modalBg.fills?.[0]?.color);
    console.log('Modal BG radius:', modalBg.borderRadius);
  }
  
  // Find all texts inside the modal
  const textNodes = data.nodes.filter(n => n.type === 'TEXT' && n.absoluteRenderBounds?.y > 7500); // Filter out background texts
  console.log('\nText Nodes in Modal:');
  textNodes.forEach(t => {
    console.log(`- "${t.typography?.content}" [color: ${t.typography?.color}, size: ${t.typography?.fontSize}, font: ${t.typography?.fontFamily}, lineH: ${t.typography?.lineHeight}]`);
  });
  
  if (warningBg) {
    console.log('\nWarning BG color:', warningBg.fills?.[0]?.color);
    console.log('Warning BG radius:', warningBg.borderRadius);
    console.log('Warning BG layout:', JSON.stringify(warningBg.layout, null, 2));
  }
}

extractModalStyles('684-11956');
extractModalStyles('684-12177');
extractModalStyles('684-12400');
