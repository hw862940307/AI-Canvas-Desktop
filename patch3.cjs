const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    if (content.includes('<img')) {
        // Only replace <img> tags that don't already have draggable={false}
        content = content.replace(/<img(?![^>]*draggable=\{false\})([^>]*)>/g, '<img draggable={false}$1>');
        fs.writeFileSync(fullPath, content);
        console.log('Updated ' + file);
    }
}
