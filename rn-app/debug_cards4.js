const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-8639-blueprint.json', 'utf8'));

const getDescendantNodes = (parentId) => {
  const children = blueprint.nodes.filter(n => n.parentId === parentId);
  let nodes = [...children];
  for (const c of children) {
    nodes = nodes.concat(getDescendantNodes(c.id));
  }
  return nodes;
};

const cards = blueprint.nodes.filter(n => n.name.startsWith('Card '));
for (const card of cards) {
  const descendants = getDescendantNodes(card.id);
  const textNodes = descendants.filter(n => n.type === 'TEXT').map(n => ({
    name: n.name,
    content: n.typography?.content,
    fontFamily: n.typography?.fontFamily
  }));
  console.log(`\n--- ${card.name} ---`);
  textNodes.forEach(t => console.log(`  ${t.name}: ${t.content} (fontFamily: ${t.fontFamily})`));
}
