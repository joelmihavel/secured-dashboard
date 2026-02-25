const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('../figma-data/data/blueprints/684-12836-blueprint.json', 'utf8'));

const texts = blueprint.nodes.filter(n => n.type === 'TEXT').map(n => ({
  content: n.typography?.content,
  y: n.geometry?.y || 0,
  name: n.name,
  size: n.typography?.fontSize
}));

texts.sort((a,b) => a.y - b.y).forEach(t => console.log(`Y: ${t.y.toFixed(0)} | Size: ${t.size} | Text: "${t.content}" | Name: ${t.name}`));
