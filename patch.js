const fs = require('fs');
const glob = require('glob'); // Note: we can just use fs.readdirSync if glob is missing, but glob might be available or not.
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('!w-4 !h-4')) {
        content = content.replace(/!w-4 !h-4/g, '!w-6 !h-6');
        fs.writeFileSync(fullPath, content);
        console.log('Updated ' + file);
    }
}
