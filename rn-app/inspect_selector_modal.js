const fs = require('fs');

function extractModalStyles(fileId) {
  const data = JSON.parse(fs.readFileSync(`figma-1on1parity/data/${fileId}-blueprint.json`, 'utf8'));
  
  // Find the modal background frame
  const modalWrapper = data.nodes.find(n => n.name === 'Frame 2095586317' || n.name?.includes('Sheet') || n.name?.includes('Modal') || n.children?.some(c => c.name?.includes('Choose a')));
  
  // Alternative: Find the node with the text "Choose a Payment Method" and get its ancestors
  const titleNode = data.nodes.find(n => n.type === 'TEXT' && n.typography?.content?.includes('Choose a'));
  if (titleNode) {
    console.log(`Title node found in ${fileId}:`, titleNode.id);
  }

  const textNodes = data.nodes.filter(n => n.type === 'TEXT' && n.absoluteRenderBounds?.y > 5000); 
  console.log(`\nText Nodes in ${fileId} Modal (y > 5000):`);
  textNodes.forEach(t => {
    console.log(`- "${t.typography?.content}" [color: ${t.typography?.color}, size: ${t.typography?.fontSize}, font: ${t.typography?.fontFamily}, lineH: ${t.typography?.lineHeight}] (y: ${t.absoluteRenderBounds?.y})`);
  });
}

extractModalStyles('684-6128');
extractModalStyles('684-5915');
