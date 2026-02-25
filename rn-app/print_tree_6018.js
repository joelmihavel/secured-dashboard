const fs = require('fs');
const path = 'figma-1on1parity/data/684-6018-blueprint.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

function printTree(nodeId, depth = 0) {
  const node = data.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const indent = '  '.repeat(depth);
  const text = node.typography?.content ? ` "${node.typography.content.replace(/\n/g, '\\n')}"` : '';
  const bounds = node.absoluteRenderBounds ? ` (y: ${Math.round(node.absoluteRenderBounds.y)})` : '';
  console.log(`${indent}- ${node.name} [${node.type}]${text}${bounds}`);
  
  if (node.childIds) {
    node.childIds.forEach(childId => printTree(childId, depth + 1));
  }
}

printTree('684:6018');
