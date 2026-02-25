const fs = require('fs');

const data1 = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-8639-blueprint.json', 'utf8'));
const data2 = JSON.parse(fs.readFileSync('rn-app/figma-1on1parity/data/684-9249-blueprint.json', 'utf8'));

console.log("684-8639 Top Nodes:");
data1.nodes.slice(0, 10).forEach(n => console.log(n.name, n.type));

console.log("\n684-9249 Top Nodes:");
data2.nodes.slice(0, 10).forEach(n => console.log(n.name, n.type));
