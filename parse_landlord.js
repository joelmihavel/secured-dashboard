const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-9249-blueprint.json', 'utf8'));

const extractText = (node) => {
  let texts = [];
  if (node.type === 'TEXT') texts.push(node.typography?.content || '');
  if (node.children) node.children.forEach(c => texts.push(...extractText(c)));
  return texts.filter(t => t);
};

const cn = blueprint.nodes.find(n => n.name === 'Frame 1686557239'); // This seems to be the card container
if (cn) {
  console.log('Setup Card found:', extractText(cn).join(' | '));
}
