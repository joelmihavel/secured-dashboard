const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-9249-blueprint.json', 'utf8'));

const findPath = (id, path = []) => {
  const node = blueprint.nodes.find(n => n.id === id);
  if (!node) return path;
  path.unshift(node.name);
  if (node.parentId) {
    return findPath(node.parentId, path);
  }
  return path;
}

const n = blueprint.nodes.find(n => n.name === 'Landlord invitation sent');
console.log('Path:', findPath(n.id).join(' -> '));

const card1 = blueprint.nodes.find(n => n.name === 'Card 1');
console.log('Path Card 1:', findPath(card1.id).join(' -> '));
