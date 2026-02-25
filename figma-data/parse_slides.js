const fs = require('fs');
['684-3081', '684-3107', '684-3128', '684-3149'].forEach(id => {
  const data = JSON.parse(fs.readFileSync(`data/blueprints/${id}-blueprint.json`));
  const textNodes = data.nodes.filter(n => n.type === 'TEXT');
  console.log(`\n=== SLIDE ${id} ===`);
  textNodes.forEach(n => {
    if (n.typography && n.typography.content) {
      console.log(`[Text: "${n.typography.content}"]`);
    } else {
      console.log(`[Text: "(no content)"]`);
    }
    
    // Check multiple fills or bound variables for segment colors?
    if (n.fills && n.fills[0]) {
      console.log(`  Color: ${n.fills[0].color}`);
    }
  });
});
