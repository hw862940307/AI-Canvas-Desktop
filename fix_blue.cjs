const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('src', file => {
  if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;
  
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  content = content.replace(/blue-400/g, 'accent');
  content = content.replace(/blue-500/g, 'accent');
  content = content.replace(/blue-600/g, 'accent');
  content = content.replace(/blue-100/g, 'white');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated blue colors in ${file}`);
  }
});
