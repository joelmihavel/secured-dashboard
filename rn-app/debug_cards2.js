const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-8639-blueprint.json', 'utf8'));

const getDescendantText = (parentId) => {
  const children = blueprint.nodes.filter(n => n.parentId === parentId);
  let text = [];
  for (const c of children) {
    if (c.type === 'TEXT') text.push(c.typography?.content);
    text = text.concat(getDescendantText(c.id));
  }
  return text.filter(t => t);
};

const cards = blueprint.nodes.filter(n => n.name.startsWith('Card '));
for (const card of cards) {
  console.log(card.name, '->', getDescendantText(card.id).join(' | '));
}

const setupCard = blueprint.nodes.filter(n => n.name.includes('setup') || n.name.includes('Landlord invitation sent') || n.name === 'Setup progress');
for (const sc of setupCard) {
  console.log(sc.name, '->', getDescendantText(sc.id).join(' | '));
}
