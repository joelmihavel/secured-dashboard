const fs = require('fs');
['684-3107'].forEach(id => {
  const data = JSON.parse(fs.readFileSync(`data/blueprints/${id}-blueprint.json`));
  const textNodes = data.nodes.filter(n => n.type === 'TEXT');
  console.log(`\n=== SLIDE ${id} ===`);
  textNodes.forEach(n => {
    console.log(`[Text: "${n.typography?.content}"]`);
    console.log(JSON.stringify(n.typography, null, 2));
    if (n.fills) {
      console.log('Fills:', JSON.stringify(n.fills, null, 2));
    }
  });
});
