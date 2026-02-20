const fs = require('fs');
const data = JSON.parse(fs.readFileSync('../figma-data/data/blueprints/1-29108-blueprint.json', 'utf8'));

const nodeMap = new Map();
data.nodes.forEach(n => nodeMap.set(n.id, n));

function getAbs(node) {
  let x = node.geometry.x;
  let y = node.geometry.y;
  let p = nodeMap.get(node.parentId);
  while(p) {
    x += p.geometry.x;
    y += p.geometry.y;
    p = nodeMap.get(p.parentId);
  }
  return {x, y};
}

data.nodes.filter(n => n.type === 'TEXT').forEach(n => {
  if (n.name.includes("Let’s get to")) {
    const abs = getAbs(n);
    console.log(`"${n.name}" - Abs: (${abs.x.toFixed(2)}, ${abs.y.toFixed(2)}), Rel: (${n.geometry.x.toFixed(2)}, ${n.geometry.y.toFixed(2)})`);
  }
});
