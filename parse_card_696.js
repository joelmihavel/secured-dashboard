const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/696-8140-blueprint.json', 'utf8'));

const printNode = (node, indent = '') => {
  let details = [];
  if (node.fills?.length) details.push(`Fills: ${JSON.stringify(node.fills)}`);
  if (node.strokes?.length) details.push(`Strokes: ${JSON.stringify(node.strokes)}`);
  if (node.effects?.length) details.push(`Effects: ${JSON.stringify(node.effects)}`);
  if (node.typography) details.push(`Text: "${node.typography.content}" Size: ${node.typography.fontSize} Color: ${node.typography.color} Font: ${node.typography.fontFamily}`);
  if (node.layout) details.push(`Layout: ${JSON.stringify(node.layout)}`);
  if (node.borderRadius) details.push(`Radius: ${JSON.stringify(node.borderRadius)}`);
  if (node.geometry) details.push(`Geometry: x=${node.geometry.x}, y=${node.geometry.y}, w=${node.geometry.width}, h=${node.geometry.height}`);
  if (node.type === 'IMAGE' || node.fills?.some(f => f.type === 'IMAGE')) details.push(`IMAGE REF`);
  
  console.log(`${indent}${node.name} (${node.type}) [${node.id}]`);
  details.forEach(d => console.log(`${indent}  - ${d}`));
  
  const children = blueprint.nodes.filter(n => n.parentId === node.id);
  children.forEach(c => printNode(c, indent + '  '));
};

const root = blueprint.nodes.find(n => n.parentId === null);
if (root) printNode(root);
