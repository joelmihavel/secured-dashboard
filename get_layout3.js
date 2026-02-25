const fs = require('fs');

function parseBlueprint(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  // Create dictionary for fast lookup
  const nodeMap = {};
  data.nodes.forEach(n => { nodeMap[n.id] = n; });
  
  function walk(node, depth = 0) {
    if (!node) return;
    const pad = '  '.repeat(depth);
    const box = node.absoluteBoundingBox || node.absoluteRenderBounds || {};
    const layout = node.layout || {};
    
    console.log(`${pad}- ${node.name} (${node.type}) [x:${box.x}, y:${box.y}, w:${box.width}, h:${box.height}]`);
    if (layout.direction && layout.direction !== 'none') {
      console.log(`${pad}  Layout: ${layout.direction}, justify: ${layout.justifyContent}, align: ${layout.alignItems}, gap: ${layout.gap}, pad: ${JSON.stringify(layout.padding)}`);
    }
    
    if (node.childIds) {
      for (const cid of node.childIds) {
        walk(nodeMap[cid], depth + 1);
      }
    }
  }
  
  const rootNode = data.nodes.find(n => n.parentId === null);
  walk(rootNode);
}

console.log("=== 684-3081 (Splash) ===");
parseBlueprint('rn-app/figma-1on1parity/data/684-3081-blueprint.json');
