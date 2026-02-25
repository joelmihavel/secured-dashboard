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
    
    // Format coordinates and dimensions
    const x = box.x !== undefined ? Math.round(box.x * 10) / 10 : '?';
    const y = box.y !== undefined ? Math.round(box.y * 10) / 10 : '?';
    const w = box.width !== undefined ? Math.round(box.width * 10) / 10 : '?';
    const h = box.height !== undefined ? Math.round(box.height * 10) / 10 : '?';
    
    // Add text info if available
    let extra = '';
    if (node.type === 'TEXT') {
       extra = ` "${node.typography?.content || ''}" color:${node.fills?.[0]?.color || '?'}`;
       if (node.typography?.spans?.length > 0) {
         extra += ` (has spans)`;
       }
    } else if (node.type === 'VECTOR') {
       extra = ` fill:${node.fills?.[0]?.color || 'none'} stroke:${node.strokes?.[0]?.color || 'none'}`;
    } else if (node.fills && node.fills.length > 0) {
       extra = ` fill:${node.fills[0].color || node.fills[0].type}`;
    }
    
    console.log(`${pad}- ${node.name} (${node.type}) [x:${x}, y:${y}, w:${w}, h:${h}]${extra}`);
    
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

console.log("=== 694-6560 (Card 1) ===");
parseBlueprint('rn-app/figma-1on1parity/data/694-6560-blueprint.json');
