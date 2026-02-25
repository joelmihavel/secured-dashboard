const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/694-6560-blueprint.json', 'utf8'));

const printNode = (node, indent = '') => {
  let details = [];
  if (node.fills?.length) details.push(`Fills: ${JSON.stringify(node.fills)}`);
  if (node.strokes?.length) details.push(`Strokes: ${JSON.stringify(node.strokes)}`);
  if (node.effects?.length) details.push(`Effects: ${JSON.stringify(node.effects)}`);
  if (node.typography) details.push(`Text: "${node.typography.content}" Size: ${node.typography.fontSize} Color: ${node.typography.color}`);
  if (node.layout) details.push(`Layout: ${JSON.stringify(node.layout)}`);
  if (node.borderRadius) details.push(`Radius: ${JSON.stringify(node.borderRadius)}`);
  if (node.geometry) details.push(`Geometry: x=${node.geometry.x}, y=${node.geometry.y}, w=${node.geometry.width}, h=${node.geometry.height}`);
  
  console.log(`${indent}${node.name} (${node.type}) [${node.id}]`);
  details.forEach(d => console.log(`${indent}  - ${d}`));
  
  const children = blueprint.nodes.filter(n => n.parentId === node.id);
  children.forEach(c => printNode(c, indent + '  '));
};

const sticker = blueprint.nodes.find(n => n.name === 'sticker 13');
if (sticker) {
  console.log("=== STICKER ===");
  printNode(sticker);
}

const cashbackBox = blueprint.nodes.find(n => n.name === 'Frame 2095586539');
if (cashbackBox) {
  console.log("\n=== CASHBACK BOX ===");
  printNode(cashbackBox);
}
