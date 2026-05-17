const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
files.push('../App.tsx'); // Add App.tsx

for (const file of files) {
    const fullPath = path.join(dir, file);
    if (!fs.existsSync(fullPath)) continue;
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    // Convert getFontSizeClass to getFontSizeStyle
    if (content.includes('getFontSizeClass = () => {')) {
        content = content.replace(
            /const getFontSizeClass = \(\) => {\s*if \(settings\.inputFontSize === 'small'\) [^}]*};/g,
            `const getFontSizeStyle = () => {
    return typeof settings.inputFontSize === 'number' 
      ? { fontSize: \`\${settings.inputFontSize}px\` } 
      : {};
  };
  const getFontSizeClass = () => {
    if (typeof settings.inputFontSize === 'number') return '';
    if (settings.inputFontSize === 'small') return 'text-[10px]';
    if (settings.inputFontSize === 'large') return 'text-sm';
    return 'text-xs';
  };`
        );
        
        // Add style={getFontSizeStyle()} to textareas/inputs missing it that use getFontSizeClass
        content = content.replace(/className=\{([^}]+getFontSizeClass\(\)[^}]+)\}/g, (match, classContent) => {
            return `className={${classContent}} style={getFontSizeStyle()}`;
        });

        changed = true;
    }

    if (file === '../App.tsx' && content.includes('settings.inputFontSize === \'large\' ?')) {
        // App.tsx has inline ternary
        content = content.replace(
            /settings\.inputFontSize === 'large' \? 'text-base' :\s*settings\.inputFontSize === 'small' \? 'text-\[10px\]' : 'text-sm'/g,
            `typeof settings.inputFontSize === 'number' ? '' : (settings.inputFontSize === 'large' ? 'text-base' : settings.inputFontSize === 'small' ? 'text-[10px]' : 'text-sm')`
        );
        content = content.replace(
            /placeholder="描述想法，Gemini 1\.5 为你护航\.\.\."/g,
            `placeholder="描述想法，Gemini 1.5 为你护航..."
                    style={{ fontSize: typeof settings.inputFontSize === 'number' ? \`\${settings.inputFontSize}px\` : undefined }}`
        );
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated ' + file);
    }
}
