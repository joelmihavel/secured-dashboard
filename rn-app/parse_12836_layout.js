const fs = require('fs');
const blueprint = JSON.parse(fs.readFileSync('figma-1on1parity/data/684-12836-blueprint.json', 'utf8'));

const root = blueprint.nodes.find(n => n.parentId === null);
console.log("Root Layout:", root.layout);

const children = blueprint.nodes.filter(n => n.parentId === root.id);
children.forEach(c => {
  console.log(`\nChild: ${c.name} | Layout:`, c.layout, `| Geom: x=${c.geometry.x}, y=${c.geometry.y}, w=${c.geometry.width}, h=${c.geometry.height}`);
});
