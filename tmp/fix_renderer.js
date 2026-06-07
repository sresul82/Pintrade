const fs = require('fs');
const path = 'h:/_Egitim ve Gelistirme/Kodlama/_V2.4/Sidebarlar/js/drawing/tools/drawing-trend.js';
let content = fs.readFileSync(path, 'utf8');

// replace all instances of s.textColor || '#a3a6af' to s.textColor || '#ffffff'
content = content.replace(/s\.textColor\s*\|\|\s*['"]#a3a6af['"]/g, "s.textColor || '#ffffff'");

// Also handle the special one in _drawHRay: s.textColor || s.color || '#a3a6af'
content = content.replace(/s\.textColor\s*\|\|\s*s\.color\s*\|\|\s*['"]#a3a6af['"]/g, "s.textColor || '#ffffff'");

// Handle hint text: ctx.fillStyle = '#a3a6af';
// But BE CAREFUL not to replace everything. We only want text hints.
// Based on my view_file: Satır 759, 1022 vb. 
// We'll be more specific here.
content = content.replace(/ctx\.fillStyle\s*=\s*['"]#a3a6af['"];\s*\/\/ hint/g, "ctx.fillStyle = '#ffffff'; // hint");

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated drawing-trend.js renderer fallbacks.');
