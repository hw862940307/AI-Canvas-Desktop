const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('Node.tsx'));

files.forEach(file => {
  let content = fs.readFileSync(path.join(dir, file), 'utf-8');
  
  // Find react-flow__node-draghandle and ensure it has rounded-t-2xl or rounded-t-3xl or rounded-t-[inherit]
  const regex = /className="([^"]*?react-flow__node-draghandle[^"]*?)"/g;
  const regex2 = /className={`([^`]*?react-flow__node-draghandle[^`]*?)`}/g;

  let modified = false;

  content = content.replace(regex, (match, p1) => {
    if (!p1.includes('rounded-t-') && !p1.includes('rounded-3xl')) {
      modified = true;
      return `className="${p1} rounded-t-2xl"`;
    }
    return match;
  });

  content = content.replace(regex2, (match, p1) => {
    if (!p1.includes('rounded-t-') && !p1.includes('rounded-3xl')) {
      modified = true;
      return `className={\`${p1} rounded-t-2xl\`}`;
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(path.join(dir, file), content);
    console.log('Fixed rounded corners in', file);
  }
});
