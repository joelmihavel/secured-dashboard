const fs = require('fs');
const blueprint694 = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/694-6560-blueprint.json', 'utf8'));

const printDetailedNode = (node, indent = '') => {
  let output = `${indent}${node.name} (${node.type}) [${node.id}]`;
  if (node.geometry) output += ` | x=${node.geometry.x}, y=${node.geometry.y}, w=${node.geometry.width}, h=${node.geometry.height}`;
  console.log(output);
  
  if (node.fills && node.fills.length > 0) {
    node.fills.forEach(f => {
      if (f.type === 'SOLID') console.log(`${indent}  - Fill: ${f.color} @ opacity ${f.opacity || 1}`);
      if (f.type === 'IMAGE') console.log(`${indent}  - Image Fill: ref ${f.imageRef}`);
      if (f.type === 'GRADIENT_LINEAR') console.log(`${indent}  - Gradient: stops ${f.gradientStops.map(s => s.color).join(', ')} @ opacity ${f.opacity || 1}`);
    });
  }
  
  if (node.strokes && node.strokes.length > 0) {
    node.strokes.forEach(s => console.log(`${indent}  - Stroke: ${s.color} width ${s.weight} align ${s.align}`));
  }
  if (node.borderRadius) console.log(`${indent}  - BorderRadius: ${node.borderRadius}`);
  if (node.layout) console.log(`${indent}  - Layout: ${node.layout.direction}, justify ${node.layout.justifyContent}, align ${node.layout.alignItems}, gap ${node.layout.gap}, padding ${JSON.stringify(node.layout.padding)}`);
  if (node.typography) console.log(`${indent}  - Text: "${node.typography.content}", size ${node.typography.fontSize}, color ${node.typography.color}, font ${node.typography.fontFamily}, align ${node.typography.textAlignHorizontal}`);
  
  if (node.effects && node.effects.length > 0) {
    node.effects.forEach(e => console.log(`${indent}  - Effect: ${e.type} color ${e.color} offset ${e.offset?.x},${e.offset?.y} blur ${e.radius}`));
  }

  const children = blueprint694.nodes.filter(n => n.parentId === node.id);
  children.forEach(c => printDetailedNode(c, indent + '  '));
};

const root694 = blueprint694.nodes.find(n => n.parentId === null);
if (root694) {
  console.log("=== FRONT CARD (694-6560) ===");
  printDetailedNode(root694);
}
