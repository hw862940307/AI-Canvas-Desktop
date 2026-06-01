const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('Node.tsx'));

files.forEach(file => {
  let content = fs.readFileSync(path.join(dir, file), 'utf-8');
  
  // Replace the overflow-hidden on the root div.
  // The root div is usually right after `return (`
  const regex = /(return\s*\(\s*<div[^>]*?)(overflow-hidden)([^>]*?>)/g;
  
  if (regex.test(content)) {
    content = content.replace(regex, '$1$3');
    fs.writeFileSync(path.join(dir, file), content);
    console.log('Fixed overflow-hidden on root in', file);
  }
});
