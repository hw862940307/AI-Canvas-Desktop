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
  
  content = content.replace(/bg-\[#[0-9a-fA-F]+\]/g, (match) => {
    const v = match.toLowerCase();
    if (v.includes('0a0a0a') || v.includes('050505') || v.includes('080808') || v.includes('080a0f')) return 'bg-[var(--bg-primary)]';
    if (v.includes('0c1016') || v.includes('0c0e12') || v.includes('0f1115') || v.includes('0a0a0c') || v.includes('09090b') || v.includes('0f0f0f')) return 'bg-[var(--bg-secondary)]';
    if (v.includes('1a1a1a') || v.includes('151515') || v.includes('111')) return 'bg-[var(--bg-tertiary)]';
    return match;
  });
  
  content = content.replace(/hover:bg-\[#[1aA]+\]/ig, 'hover:bg-[var(--bg-tertiary)]');
  content = content.replace(/hover:bg-\[#222\]/g, 'hover:bg-[var(--border)]');
  content = content.replace(/hover:bg-\[#333\]/g, 'hover:bg-[var(--border)]');
  
  content = content.replace(/border-\[#333\]/g, 'border-[var(--border)]');
  content = content.replace(/border-\[#222\]/g, 'border-[var(--border)]');
  
  content = content.replace(/border-white\/5(?!0)/g, 'border-[var(--border)]');
  content = content.replace(/border-white\/10/g, 'border-[var(--border)]');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
