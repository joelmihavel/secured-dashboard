const fs = require('fs');
const path = 'figma-1on1parity/data/684-11956-blueprint.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// The bottom sheet background should be #202020 or similar.
// It's probably the second child of the main screen frame (after the dashboard background).
// Let's print the top-level children of the root node.

const rootNode = data.nodes.find(n => n.id === '684:11956');
if (rootNode && rootNode.childIds) {
  rootNode.childIds.forEach(id => {
    const child = data.nodes.find(n => n.id === id);
    console.log(`- ${child.name} [${child.type}] (y: ${child.absoluteRenderBounds?.y})`);
  });
}
