const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'generated');
const dest = path.join(__dirname, '..', 'dist', 'generated');

if (fs.existsSync(src)) {
  fs.cpSync(src, dest, { recursive: true });
  console.log('[build] Copied src/generated -> dist/generated');
}
