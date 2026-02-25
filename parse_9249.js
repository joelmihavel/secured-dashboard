const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-9249-blueprint.json', 'utf8'));

const extractText = (node) => {
  let texts = [];
  if (node.type === 'TEXT') texts.push(node.typography?.content || '');
  if (node.children) node.children.forEach(c => texts.push(...extractText(c)));
  return texts.filter(t => t);
};

const cn = blueprint.nodes.find(n => n.name === 'Frame 2095586448');
if (cn) {
  const children = blueprint.nodes.filter(n => n.parentId === cn.id);
  console.log('Carousel Node Children:');
  for (const c of children) {
    console.log('  Child:', c.name);
    const subChildren = blueprint.nodes.filter(n => n.parentId === c.id);
    for (const sc of subChildren) {
      console.log('    Sub:', sc.name);
    }
  }
} else {
  console.log('Carousel node not found');
}
