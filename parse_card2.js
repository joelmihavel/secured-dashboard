const fs = require('fs');
const bp = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-12836-blueprint.json', 'utf8'));

// Check for Card 2 to see how multiple cards are styled side-by-side
const card2 = bp.nodes.find(n => n.name === 'Card 2');
if (card2) {
   const details = [];
   if (card2.fills) details.push(`Fills: ${JSON.stringify(card2.fills)}`);
   if (card2.geometry) details.push(`Geom: w=${card2.geometry.width} h=${card2.geometry.height}`);
   console.log('Card 2 Details:', details.join(' | '));
}
