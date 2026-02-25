const fs = require('fs');

function inspectCashbackPill(fileId) {
  const data = JSON.parse(fs.readFileSync(`figma-1on1parity/data/${fileId}-blueprint.json`, 'utf8'));
  
  const pillNode = data.nodes.find(n => n.type === 'TEXT' && n.typography?.content?.includes('Cashback applies'));
  if (pillNode) {
    console.log(`Pill text in ${fileId}:`, pillNode);
    // Find parent
    const parentId = Object.keys(data.nodes).find(key => {
      const p = data.nodes[key];
      return p.childIds && p.childIds.includes(pillNode.id);
    });
    if (parentId) {
      console.log('Parent:', data.nodes.find(n => n.id === parentId));
    }
  }
}

inspectCashbackPill('684-6128');