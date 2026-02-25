const fs = require('fs');
['684-3107', '684-3128', '684-3149'].forEach(id => {
  const data = JSON.parse(fs.readFileSync(`data/blueprints/${id}-blueprint.json`));
  const bgNode = data.nodes.find(n => n.name === 'Background Shape');
  console.log(`\n=== SLIDE ${id} ===`);
  if (bgNode) {
    console.log(JSON.stringify(bgNode.absoluteBoundingBox, null, 2));
    console.log(JSON.stringify(bgNode.geometry, null, 2));
    console.log(`Opacity: ${bgNode.opacity}`);
  }
});
