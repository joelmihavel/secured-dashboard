const fs = require('fs');
['684-3107', '684-3128', '684-3149'].forEach(id => {
  const data = JSON.parse(fs.readFileSync(`data/blueprints/${id}-blueprint.json`));
  const imageNodes = data.nodes.filter(n => n.fills && n.fills.some(f => f.type === 'IMAGE'));
  console.log(`\n=== SLIDE ${id} ===`);
  imageNodes.forEach(n => {
    console.log(`Node: ${n.name}`);
    console.log(JSON.stringify(n.geometry, null, 2));
  });
});
