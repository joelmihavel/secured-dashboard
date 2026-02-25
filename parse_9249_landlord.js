const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-9249-blueprint.json', 'utf8'));

const findNode = (name) => {
  return blueprint.nodes.find(n => n.name === name);
}

const n = findNode('Landlord invitation sent');
if (n) {
  console.log(n.name, 'parent:', n.parentId);
  let p = blueprint.nodes.find(parent => parent.id === n.parentId);
  console.log('parent name:', p ? p.name : 'unknown');
  
  // also check other nodes that are peers
  let peers = blueprint.nodes.filter(peer => peer.parentId === n.parentId);
  console.log('peers:', peers.map(p => p.name).join(', '));
}
