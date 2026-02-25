const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('figma-1on1parity/data/684-12836-blueprint.json', 'utf8'));

const extractLayouts = (node, indent = '') => {
  if (!node) return;
  const layout = node.layout || {};
  let info = `${indent}${node.name} (${node.type}) [${node.id}] y=${node.geometry?.y}`;
  
  if (layout.direction) {
    info += ` | Layout: ${layout.direction}, justify ${layout.justifyContent}, align ${layout.alignItems}, gap ${layout.gap}, padding ${JSON.stringify(layout.padding)}`;
  }
  if (node.typography) {
      info += ` | Text: "${node.typography.content}" size ${node.typography.fontSize} color ${node.typography.color}`;
  }
  
  // Only print frames and text that are meaningful layout containers
  if (node.type === 'FRAME' || node.type === 'TEXT') {
     console.log(info);
  }
  
  const children = blueprint.nodes.filter(n => n.parentId === node.id);
  children.forEach(c => extractLayouts(c, indent + '  '));
};

const root = blueprint.nodes.find(n => n.parentId === null);
extractLayouts(root);
