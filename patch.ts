import fs from 'fs';
import path from 'path';

const componentsDir = 'src/components';

const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filepath = path.join(componentsDir, file);
  let content = fs.readFileSync(filepath, 'utf8');
  
  // Replace className="!w-3 !h-3..." or className="w-3 h-3..." on Handle
  const handleRegex = /(<Handle[^>]*className=)"([^"]+)"/g;
  
  content = content.replace(handleRegex, (match, p1, p2) => {
    let bgColor = '!bg-blue-500';
    const bgMatch = p2.match(/!?(bg-[a-z]+-[0-9]+)/);
    if (bgMatch) {
      bgColor = bgMatch[0].startsWith('!') ? bgMatch[0] : `!${bgMatch[0]}`;
    }
    
    // We want a white center with colored ring, or colored center with dark ring.
    // Colored center with dark ring:
    const newClass = `${bgColor} !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out`;
    return `${p1}"${newClass}"`;
  });

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Updated ${file}`);
}
