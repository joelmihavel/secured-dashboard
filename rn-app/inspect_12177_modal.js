const fs = require('fs');
const path = 'figma-1on1parity/data/684-12177-blueprint.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const targetNode = data.nodes.find(n => n.name === 'Frame 2095586317');

function printTree(nodeId, depth = 0) {
  const node = data.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const indent = '  '.repeat(depth);
  let extra = '';
  if (node.type === 'TEXT') {
    extra = ` "${node.typography.content.replace(/\n/g, '\\n')}" [size:${node.typography.fontSize} color:${node.typography.color}]`;
  } else if (node.type === 'RECTANGLE' || node.type === 'FRAME') {
    const fill = node.fills?.find(f => f.type === 'SOLID');
    if (fill) extra += ` bg:${fill.color}`;
    if (node.borderRadius) extra += ` r:${node.borderRadius}`;
    if (node.size) extra += ` w:${node.size.x} h:${node.size.y}`;
  }
  
  const bounds = node.absoluteRenderBounds ? ` (y: ${Math.round(node.absoluteRenderBounds.y)})` : '';
  console.log(`${indent}- ${node.name} [${node.type}]${extra}${bounds}`);
  
  if (node.childIds) {
    node.childIds.forEach(childId => printTree(childId, depth + 1));
  }
}

if (targetNode) {
  printTree(targetNode.id);
} else {
  console.log('Node not found');
}
