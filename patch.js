const fs = require('fs');
const file = 'src/components/AnnotationModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "Circle, Minus, MousePointerClick, Trash2, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine",
  "Circle, Minus, MousePointerClick, Trash2, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine,\n  Eye, EyeOff\n"
);

content = content.replace(
  "const [textInput, setTextInput] = useState({ show: false, x: 0, y: 0, val: '' });",
  "const [textInput, setTextInput] = useState({ show: false, x: 0, y: 0, val: '' });\n  const [showAnnotations, setShowAnnotations] = useState(true);"
);

content = content.replace(
  "actions.forEach((action) => {",
  `actions.forEach((action) => {
      if (!showAnnotations) {
        const box = getBBox(action);
        tctx.setLineDash([4, 4]);
        tctx.strokeStyle = '#0066ff';
        tctx.lineWidth = 1;
        tctx.strokeRect(box.x, box.y, box.w, box.h);
        return;
      }`
);

content = content.replace(
  "if (action.tool === 'line' && action.points) {\n          action.points.forEach(pt => {\n            tctx.beginPath();\n            tctx.arc(pt.x, pt.y, 5, 0, Math.PI*2);\n            tctx.fill();\n            tctx.stroke();\n          });\n        }",
  `if (action.tool === 'line' && action.points) {
          tctx.fillStyle = '#fff';
          tctx.strokeStyle = '#0066ff';
          tctx.lineWidth = 1.5;
          tctx.setLineDash([]);
          action.points.forEach(pt => {
            tctx.beginPath();
            tctx.arc(pt.x, pt.y, 4, 0, Math.PI*2);
            tctx.fill();
            tctx.stroke();
          });
        }`
);

content = content.replace(
  "} else if (selectedId !== action.id && action.color === 'transparent' && action.bgColor === 'transparent' && activeTool === 'select') {",
  `} else if (selectedId !== action.id && action.color === 'transparent' && action.bgColor === 'transparent' && activeTool === 'select' && showAnnotations) {`
);

content = content.replace(
  "currentAction, selectedId, seqStart, dragState, mousePos, activeTool, size, sizingBrush",
  "currentAction, selectedId, seqStart, dragState, mousePos, activeTool, size, sizingBrush, showAnnotations"
);

content = content.replace(
  "<ToolButton icon={<Undo2 size={16} />} title=\"撤销\"",
  `<ToolButton icon={showAnnotations ? <Eye size={16} /> : <EyeOff size={16} />} title={showAnnotations ? "隐藏标注" : "显示标注"} active={!showAnnotations} onClick={() => setShowAnnotations(!showAnnotations)} />
        <div className="w-px h-6 bg-white/10 mx-1" />
        <ToolButton icon={<Undo2 size={16} />} title="撤销"`
);

fs.writeFileSync(file, content);
console.log('patched');
