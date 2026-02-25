const fs = require('fs');

function parseBlueprint(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  function walk(node, depth = 0) {
    if (!node) return;
    const pad = '  '.repeat(depth);
    const box = node.absoluteBoundingBox || node.absoluteRenderBounds || {};
    const layout = node.layout || {};
    
    console.log(`${pad}- ${node.name} (${node.type}) [x:${box.x}, y:${box.y}, w:${box.width}, h:${box.height}]`);
    if (layout.direction) {
      console.log(`${pad}  Layout: ${layout.direction}, justify: ${layout.justifyContent}, align: ${layout.alignItems}, gap: ${layout.gap}, pad: ${JSON.stringify(layout.padding)}`);
    }
    
    if (node.childIds) {
      for (const cid of node.childIds) {
        walk(data.nodes[cid], depth + 1);
      }
    }
  }
  
  const rootId = Object.keys(data.nodes).find(k => data.nodes[k].parentId === null);
  walk(data.nodes[rootId]);
}

console.log("=== 684-3081 (Splash) ===");
parseBlueprint('figma-data/data/blueprints/684-3081-blueprint.json');
console.log("\n=== 684-3107 (Carousel 1) ===");
parseBlueprint('figma-data/data/blueprints/684-3107-blueprint.json');
