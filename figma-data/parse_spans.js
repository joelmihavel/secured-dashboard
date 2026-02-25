const fs = require('fs');
['684-3107', '684-3128', '684-3149'].forEach(id => {
  const data = JSON.parse(fs.readFileSync(`data/blueprints/${id}-blueprint.json`));
  const textNodes = data.nodes.filter(n => n.type === 'TEXT');
  console.log(`\n=== SLIDE ${id} ===`);
  textNodes.forEach(n => {
    if (n.name === 'Login Text' || n.name === 'Skip ->' || n.name.startsWith('13:13') || n.name === 'For every timely' || n.name.startsWith('Keep paying') || n.name.startsWith('3 months')) return;
    console.log(`[Text: "${n.typography?.content}"]`);
    console.log('Spans:', JSON.stringify(n.typography?.spans, null, 2));
  });
});
