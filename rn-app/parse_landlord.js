const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-9249-blueprint.json', 'utf8'));

const getDescendantText = (parentId) => {
  const children = blueprint.nodes.filter(n => n.parentId === parentId);
  let text = [];
  for (const c of children) {
    if (c.type === 'TEXT') text.push(c.typography?.content);
    text = text.concat(getDescendantText(c.id));
  }
  return text.filter(t => t);
};

const n = blueprint.nodes.find(n => n.name === 'Landlord invitation sent');
if (n) {
  let p = blueprint.nodes.find(parent => parent.id === n.parentId); // Frame 1686557237
  let gp = blueprint.nodes.find(parent => parent.id === p.parentId); // Frame 1686557239
  let ggp = blueprint.nodes.find(parent => parent.id === gp.parentId); // Frame 2095586353
  
  console.log('Grandparent text:', getDescendantText(ggp.id).join(' | '));
}
