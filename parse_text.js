const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/694-6560-blueprint.json', 'utf8'));

const node = blueprint.nodes.find(n => n.id === '694:6575');
if (node && node.typography) {
  console.log(JSON.stringify(node.typography, null, 2));
  if (node.styleOverrideTable) {
     console.log('Style Overrides:', JSON.stringify(node.styleOverrideTable, null, 2));
  }
  if (node.characterStyleOverrides) {
     console.log('Character Overrides:', JSON.stringify(node.characterStyleOverrides, null, 2));
  }
}
