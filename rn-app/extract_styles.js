const fs = require('fs');
const path = 'figma-1on1parity/data/684-6018-blueprint.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const extractTextStyles = (nodeId) => {
  const node = data.nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  if (node.type === 'TEXT') {
    const typo = node.typography;
    console.log(`${node.name}:`);
    console.log(`  fontFamily: '${typo.fontFamily}',`);
    console.log(`  fontSize: ${typo.fontSize},`);
    console.log(`  lineHeight: ${typo.lineHeight},`);
    console.log(`  color: '${typo.color}',`);
    if (typo.fontWeight) console.log(`  fontWeight: ${typo.fontWeight},`);
    if (typo.letterSpacing) console.log(`  letterSpacing: ${typo.letterSpacing},`);
  }
  
  if (node.childIds) {
    node.childIds.forEach(extractTextStyles);
  }
};

extractTextStyles('684:6018');