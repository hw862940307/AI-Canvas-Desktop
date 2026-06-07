import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Undo2, Redo2, Pencil, Square, Type, Eraser, Save,
  Circle, Minus, MousePointerClick, Trash2, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine,
  Eye, EyeOff, ZoomIn, ZoomOut, PenTool
} from 'lucide-react';

interface AnnotationModalProps {
  imageUrl: string;
  onSave: (editedImageUrl: string) => void;
  onClose: () => void;
}

type Tool = 'select' | 'rect' | 'circle' | 'line' | 'pencil' | 'text' | 'sequence' | 'smudge' | 'eraser' | 'pen' | 'clear';

interface DrawingAction {
  id: string;
  tool: Tool;
  color: string;
  bgColor: string;
  size: number;
  opacity: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  lineStyle?: 'straight' | 'curve' | 'wave' | 'heavyWave';
  arrowStyle: 'none' | 'right' | 'both';
  seqType: '1' | 'A' | 'I' | '汉';
  seqStart: number;
  fontSize: 'S' | 'M' | 'L' | 'XL' | number;
  borderRadius?: number;
  points?: { x: number; y: number }[];
  bezierNodes?: { x: number; y: number; h1x?: number; h1y?: number; h2x?: number; h2y?: number }[];
  rect?: { x: number; y: number; width: number; height: number };
  circle?: { x: number; y: number; rx: number; ry: number };
  text?: { x: number; y: number; content: string };
}

const SegmentControl = ({ label, options, value, onChange }: any) => (
  <div className="w-full">
    <span className="text-xs text-zinc-400 mb-1.5 block">{label}</span>
    <div className="flex bg-[#1a1a1a] rounded-lg p-1 gap-1 border border-white/5">
      {options.map((o:any) => (
        <button
           key={o.v}
           onClick={() => onChange(o.v)}
           className={`flex-1 h-8 rounded-md border flex items-center justify-center transition-all ${
             value === o.v 
              ? 'border-[#ef4444] bg-[#1a2333] text-[#ef4444]' 
              : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
           }`}
        >
          {o.i}
        </button>
      ))}
    </div>
  </div>
);

const COLORS = ['transparent', '#FF4D4F', '#52C41A', '#1890FF', '#FFA940', '#FFFFFF', '#000000'];
const ColorPicker = ({ label, value, onChange }: any) => (
  <div className="w-full">
    <span className="text-xs text-zinc-400 mb-1.5 block">{label}</span>
    <div className="flex bg-[#1a1a1a] rounded-lg p-1 gap-1 border border-white/5">
       {COLORS.map(c => (
         <button 
            key={c} 
            onClick={() => onChange(c)} 
            className={`flex-1 h-[26px] rounded-md border relative transition-all min-w-0 ${c === value ? 'border-[#ef4444] shadow-[0_0_0_1px_#ef4444] z-10' : 'border-white/10 hover:border-white/30'}`} 
            style={{background: c === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, #404040 0% 50%) 50% / 4px 4px' : c}}
         >
            {c === 'transparent' && (
              <svg className="absolute inset-0 w-full h-full opacity-70" viewBox="0 0 100 100" preserveAspectRatio="none">
                 <line x1="0" y1="100" x2="100" y2="0" stroke="#ff4d4f" strokeWidth="6" />
              </svg>
            )}
         </button>
       ))}
       <div className={`flex-1 h-[26px] rounded-md border relative transition-all overflow-hidden min-w-0 group ${!COLORS.includes(value) ? 'border-[#ef4444] shadow-[0_0_0_1px_#ef4444] z-10' : 'border-white/10 hover:border-white/30'}`}>
         <div className="absolute inset-0 pointer-events-none" style={{background: !COLORS.includes(value) ? value : 'linear-gradient(135deg, red, yellow, green, cyan, blue, magenta, red)'}}></div>
         <input type="color" className="absolute opacity-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer z-0" value={!COLORS.includes(value) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} />
       </div>
    </div>
  </div>
);

export const AnnotationModal = ({ imageUrl, onSave, onClose }: AnnotationModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#FF4D4F');
  const [bgColor, setBgColor] = useState('transparent');
  const [size, setSize] = useState(6);
  const [opacity, setOpacity] = useState(1);
  const [strokeStyle, setStrokeStyle] = useState<'solid'|'dashed'|'dotted'>('solid');
  const [lineStyle, setLineStyle] = useState<'straight' | 'curve' | 'wave' | 'heavyWave'>('straight');
  const [arrowStyle, setArrowStyle] = useState<'none'|'right'|'both'>('none');
  const [seqType, setSeqType] = useState<'1'|'A'|'I'|'汉'>('1');
  const [seqStart, setSeqStart] = useState(1);
  const [fontSize, setFontSize] = useState<'S'|'M'|'L'|'XL'|number>('M');
  const [borderRadius, setBorderRadius] = useState(0);
  
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  const [history, setHistory] = useState<DrawingAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingAction[]>([]);
  const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  const [textInput, setTextInput] = useState({ show: false, x: 0, y: 0, val: '' });
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 24, y: typeof window !== 'undefined' ? window.innerHeight / 2 - 250 : 0 });
  const [rightPanel, setRightPanel] = useState({ w: 290, h: typeof window !== 'undefined' ? window.innerHeight - 120 : 600, top: 60 });
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number, isRight?: boolean } | null>(null);
  const rightResizeRef = useRef<{ startX: number, startY: number, initW: number, initH: number, initTop: number, edge: string, currentW?: number, currentH?: number, currentTop?: number } | null>(null);
  const rightPanelDomRef = useRef<HTMLDivElement>(null);
  const lastEscTime = useRef<number>(0);
  const lastClickRef = useRef<{ time: number, id: string, nodeIdx: number }>({ time: 0, id: '', nodeIdx: -1 });

  const initRightResize = (e: React.PointerEvent, edge: string) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    rightResizeRef.current = { startX: e.clientX, startY: e.clientY, initW: rightPanel.w, initH: rightPanel.h, initTop: rightPanel.top, edge };
  };

  const handleToolbarPointerDown = (e: React.PointerEvent, isRight: boolean = false) => {
    const isMiddleClick = e.button === 1;
    if (!isMiddleClick && ((e.target as HTMLElement).tagName.toLowerCase() === 'button' || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).tagName.toLowerCase() === 'input')) return;
    
    if (isRight) return;
    
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: toolbarPos.x, initialY: toolbarPos.y, isRight: false };
    setIsDraggingToolbar(true);
  };

  const handleToolbarPointerMove = (e: React.PointerEvent) => {
    if (rightResizeRef.current) {
        e.stopPropagation();
        e.preventDefault();
        const { startX, startY, initW, initH, initTop, edge } = rightResizeRef.current;
        let newW = initW;
        let newH = initH;
        let newTop = initTop;

        if (edge.includes('left')) {
           newW = initW + (startX - e.clientX);
        }
        if (edge.includes('top')) {
           const dy = e.clientY - startY;
           newTop = Math.max(10, initTop + dy);
           newH = initH - dy;
        }
        if (edge.includes('bottom')) {
           newH = initH + (e.clientY - startY);
        }

        const finalW = Math.min(window.innerWidth - 100, Math.max(240, newW));
        const finalH = Math.min(window.innerHeight - 64, Math.max(300, newH));
        const finalTop = newTop;

        if (rightPanelDomRef.current) {
            rightPanelDomRef.current.style.width = `${finalW}px`;
            rightPanelDomRef.current.style.height = `${finalH}px`;
            rightPanelDomRef.current.style.top = `${finalTop}px`;
        }
        
        rightResizeRef.current.currentW = finalW;
        rightResizeRef.current.currentH = finalH;
        rightResizeRef.current.currentTop = finalTop;
        return;
    }
  
    if (isDraggingToolbar && dragRef.current && !dragRef.current.isRight) {
      e.stopPropagation();
      setToolbarPos({
        x: dragRef.current.initialX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.initialY + (e.clientY - dragRef.current.startY)
      });
    }
  };

  const handleToolbarPointerUp = (e: React.PointerEvent) => {
    if (rightResizeRef.current) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        const { currentW, currentH, currentTop } = rightResizeRef.current;
        if (currentW !== undefined && currentH !== undefined && currentTop !== undefined) {
            setRightPanel({ w: currentW, h: currentH, top: currentTop });
        }
        rightResizeRef.current = null;
        return;
    }

    if (!isDraggingToolbar) return;
    e.stopPropagation();
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDraggingToolbar(false);
    dragRef.current = null;
  };
  const [polylineState, setPolylineState] = useState<{ active: boolean, id: string } | null>(null);
  const [altPressed, setAltPressed] = useState(false);
  const [sizingBrush, setSizingBrush] = useState<{ active: boolean, startX: number, startSize: number, currentX: number, currentY: number } | null>(null);

  const [dragState, setDragState] = useState<{
    type: 'move' | 'point' | 'resize' | 'bezierNode',
    index?: number,
    handle?: 'node' | 'h1' | 'h2',
    startPos: {x:number, y:number},
    originalAction: DrawingAction
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPressed(true);
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '=' || e.key === '+') {
         setScale(s => {
            const newScale = Math.min(s * 1.1, 10);
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            setPan(p => ({ x: cx - (cx - p.x) * (newScale / s), y: cy - (cy - p.y) * (newScale / s) }));
            return newScale;
         });
      }
      if (e.key === '-') {
         setScale(s => {
            const newScale = Math.max(s / 1.1, 0.1);
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            setPan(p => ({ x: cx - (cx - p.x) * (newScale / s), y: cy - (cy - p.y) * (newScale / s) }));
            return newScale;
         });
      }
      if (e.key === '[' || e.key === '{') {
         setSize(s => Math.max(1, s - 1));
      }
      if (e.key === ']' || e.key === '}') {
         setSize(s => Math.min(200, s + 1));
      }
      if (e.key === 'Escape') {
          const now = Date.now();
          if (now - lastEscTime.current < 500) {
             onClose();
             return;
          }
          lastEscTime.current = now;
      }
      
      if (e.key === 'Escape' || e.key === 'Enter') {
         if (polylineState?.active && currentAction) {
            if (currentAction.tool === 'pen' && currentAction.bezierNodes) {
               const nodes = [...currentAction.bezierNodes];
               nodes.pop();
               if (nodes.length >= 2) setHistory(h => [...h, { ...currentAction, bezierNodes: nodes }]);
            } else if (currentAction.points) {
               const pts = [...currentAction.points];
               pts.pop();
               if (pts.length >= 2) setHistory(h => [...h, { ...currentAction, points: pts }]);
            }
            setCurrentAction(null);
            setPolylineState(null);
            setIsDrawing(false);
         } else if (e.key === 'Escape') {
            if (selectedId) setSelectedId(null);
         }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
         if (!textInput.show && selectedId) {
            setHistory(h => h.filter(a => a.id !== selectedId));
            setSelectedId(null);
         }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
         e.stopPropagation();
         e.preventDefault();
         if (e.shiftKey) {
            if (redoStack.length > 0) {
              setHistory(h => [...h, redoStack[0]]);
              setRedoStack(r => r.slice(1));
            }
         } else {
            if (history.length > 0) {
              setRedoStack(r => [history[history.length - 1], ...r]);
              setHistory(h => h.slice(0, -1));
              setSelectedId(null);
            }
         }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
         e.stopPropagation();
         e.preventDefault();
         if (redoStack.length > 0) {
           setHistory(h => [...h, redoStack[0]]);
           setRedoStack(r => r.slice(1));
         }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltPressed(false);
        if (sizingBrush) setSizingBrush(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [selectedId, textInput, history, polylineState, currentAction, sizingBrush, redoStack]);

  useEffect(() => {
    const img = new Image();
    const isBlobOrData = imageUrl.startsWith('data:') || imageUrl.startsWith('blob:');
    if (!isBlobOrData && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    }
    img.src = imageUrl;
    
    img.onload = () => {
      setImage(img);
      const aspect = img.width / img.height;
      let w = window.innerWidth * 0.7;
      let h = w / aspect;
      if (h > window.innerHeight * 0.7) {
        h = window.innerHeight * 0.7;
        w = h * aspect;
      }
      setDimensions({ width: img.width, height: img.height });
      const initialScale = w / img.width;
      setScale(initialScale);
      setPan({
        x: (window.innerWidth - img.width * initialScale) / 2,
        y: (window.innerHeight - img.height * initialScale) / 2
      });
    };
  }, [imageUrl]);

  const drawArrow = (ctx: CanvasRenderingContext2D, from: {x:number,y:number}, to: {x:number,y:number}, size: number) => {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const headlen = Math.max(10, size * 3);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const drawSpline = (ctx: CanvasRenderingContext2D, points: {x:number,y:number}[]) => {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
       const xc = (points[i].x + points[i + 1].x) / 2;
       const yc = (points[i].y + points[i + 1].y) / 2;
       ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  };

  const drawBumpyPath = (ctx: CanvasRenderingContext2D, points: {x:number,y:number}[], type: 'wave' | 'heavyWave', closed: boolean) => {
    if (points.length < 2) return;
    const segLen = type === 'heavyWave' ? 10 : 20;
    const amp = type === 'heavyWave' ? 4 : 2;
    
    let path = [];
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.floor(dist / segLen));
        for (let j = 0; j < steps; j++) {
            const t = j / steps;
            const x = p1.x + dx * t;
            const y = p1.y + dy * t;
            // Add deterministic noise
            const nx = -dy / dist;
            const ny = dx / dist;
            const pseudoRandom = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
            const noise = pseudoRandom - Math.floor(pseudoRandom);
            const offset = (noise - 0.5) * 2 * amp;
            path.push({ x: x + nx * offset, y: y + ny * offset });
        }
    }
    path.push(points[points.length - 1]);
    
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    path.forEach((p, i) => {
        if (i > 0) ctx.lineTo(p.x, p.y);
    });
    if (closed) ctx.closePath();
    ctx.stroke();
  };

  const measureText = (text: string, fontSize: number) => {
    if (typeof window === 'undefined') return { width: 100 };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.font = `${fontSize}px sans-serif`;
        return ctx.measureText(text);
    }
    return { width: text.length * fontSize * 0.6 };
  };

  const getBBox = (action: DrawingAction) => {
    if (action.tool === 'rect' && action.rect) {
       const x = Math.min(action.rect.x, action.rect.x + action.rect.width);
       const y = Math.min(action.rect.y, action.rect.y + action.rect.height);
       const w = Math.abs(action.rect.width);
       const h = Math.abs(action.rect.height);
       return { x, y, w, h };
    }
    if (action.tool === 'circle' && action.circle) return { x: action.circle.x - Math.abs(action.circle.rx), y: action.circle.y - Math.abs(action.circle.ry), w: Math.abs(action.circle.rx)*2, h: Math.abs(action.circle.ry)*2 };
    if (action.tool === 'text' && action.text) {
       let fSize = 24;
       if(typeof action.fontSize === 'number') fSize = action.fontSize;
       else if(action.fontSize === 'S') fSize = 16;
       else if(action.fontSize === 'M') fSize = 24;
       else if(action.fontSize === 'L') fSize = 36;
       else if(action.fontSize === 'XL') fSize = 48;
       const tm = measureText(action.text.content, fSize);
       return { x: action.text.x, y: action.text.y - fSize, w: tm.width, h: fSize * 1.2 };
    }
    if (action.tool === 'sequence' && action.points && action.points.length > 0) {
       const r = Math.max(16, action.size * 3);
       return { x: action.points[0].x - r, y: action.points[0].y - r, w: r * 2, h: r * 2 };
    }
    if (action.bezierNodes && action.bezierNodes.length > 0) {
       const xs = action.bezierNodes.map(p => p.x).concat(action.bezierNodes.filter(p=>p.h1x!==undefined).map(p=>p.h1x!)).concat(action.bezierNodes.filter(p=>p.h2x!==undefined).map(p=>p.h2x!));
       const ys = action.bezierNodes.map(p => p.y).concat(action.bezierNodes.filter(p=>p.h1y!==undefined).map(p=>p.h1y!)).concat(action.bezierNodes.filter(p=>p.h2y!==undefined).map(p=>p.h2y!));
       return {
          x: Math.min(...xs), y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)
       };
    }
    if (action.points && action.points.length > 0) {
      let minX=action.points[0].x, maxX=action.points[0].x, minY=action.points[0].y, maxY=action.points[0].y;
      action.points.forEach(p => { if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; });
      return { x: minX, y: minY, w: maxX-minX, h: maxY-minY };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  };

  const drawAll = useCallback((ctx: CanvasRenderingContext2D, baseImage: HTMLImageElement) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(baseImage, 0, 0, ctx.canvas.width, ctx.canvas.height);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = ctx.canvas.width;
    tempCanvas.height = ctx.canvas.height;
    const tctx = tempCanvas.getContext('2d');
    if (!tctx) return;

    const actions = [...history];
    if (currentAction && !dragState) actions.push(currentAction);

    let seqCounter = seqStart;

    actions.forEach((action) => {
      if (action.tool === 'clear') {
         tctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
         return;
      }
      if (!showAnnotations) {
        const box = getBBox(action);
        tctx.setLineDash([4, 4]);
        tctx.strokeStyle = '#ef4444';
        tctx.lineWidth = 1;
        tctx.strokeRect(box.x, box.y, box.w, box.h);
        return;
      }

      tctx.strokeStyle = action.color;
      tctx.fillStyle = action.bgColor === 'transparent' ? 'transparent' : action.bgColor;
      tctx.lineWidth = action.size;
      tctx.lineCap = 'round';
      tctx.lineJoin = 'round';
      tctx.globalAlpha = action.opacity;
      
      if (action.strokeStyle === 'dashed') tctx.setLineDash([action.size * 2, action.size * 2]);
      else if (action.strokeStyle === 'dotted') tctx.setLineDash([action.size, action.size * 2]);
      else tctx.setLineDash([]);

      if (action.tool === 'pencil' || action.tool === 'smudge' || action.tool === 'eraser') {
        if (action.tool === 'eraser') { tctx.globalCompositeOperation = 'destination-out'; tctx.globalAlpha = 1; } 
        else { tctx.globalCompositeOperation = 'source-over'; }
        if (action.points && action.points.length > 0) {
          tctx.beginPath();
          tctx.moveTo(action.points[0].x, action.points[0].y);
          action.points.forEach(p => tctx.lineTo(p.x, p.y));
          tctx.stroke();
        }
        tctx.globalCompositeOperation = 'source-over';
      } else if (action.tool === 'rect' && action.rect) {
        let path = new Path2D();
        const r = action.borderRadius || 0;
        
        if (action.lineStyle === 'wave' || action.lineStyle === 'heavyWave') {
            const rx = action.rect.x, ry = action.rect.y, rw = action.rect.width, rh = action.rect.height;
            const pts = [
               {x: rx, y: ry}, {x: rx+rw, y: ry}, {x: rx+rw, y: ry+rh}, {x: rx, y: ry+rh}, {x: rx, y: ry}
            ];
            drawBumpyPath(tctx, pts, action.lineStyle, true);
        } else {
            if (typeof tctx.roundRect === 'function' && r > 0) {
               path.roundRect(action.rect.x, action.rect.y, action.rect.width, action.rect.height, r);
            } else {
               path.rect(action.rect.x, action.rect.y, action.rect.width, action.rect.height);
            }
            if (action.bgColor !== 'transparent') tctx.fill(path);
            tctx.stroke(path);
        }
      } else if (action.tool === 'circle' && action.circle) {
        if (action.lineStyle === 'wave' || action.lineStyle === 'heavyWave') {
            const cx = action.circle.x, cy = action.circle.y, rx = Math.abs(action.circle.rx), ry = Math.abs(action.circle.ry);
            const pts = [];
            for (let i = 0; i <= 36; i++) {
               const angle = (i / 36) * Math.PI * 2;
               pts.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
            }
            drawBumpyPath(tctx, pts, action.lineStyle, true);
        } else {
            tctx.beginPath();
            tctx.ellipse(action.circle.x, action.circle.y, Math.abs(action.circle.rx), Math.abs(action.circle.ry), 0, 0, Math.PI * 2);
            if (action.bgColor !== 'transparent') tctx.fill();
            tctx.stroke();
        }
      } else if (action.tool === 'pen' && action.bezierNodes && action.bezierNodes.length > 0) {
        tctx.beginPath();
        tctx.moveTo(action.bezierNodes[0].x, action.bezierNodes[0].y);
        for(let i=0; i<action.bezierNodes.length-1; i++) {
           const p1 = action.bezierNodes[i];
           const p2 = action.bezierNodes[i+1];
           const cp1x = p1.h2x !== undefined ? p1.h2x : p1.x;
           const cp1y = p1.h2y !== undefined ? p1.h2y : p1.y;
           const cp2x = p2.h1x !== undefined ? p2.h1x : p2.x;
           const cp2y = p2.h1y !== undefined ? p2.h1y : p2.y;
           tctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
        if (action.bgColor !== 'transparent') {
           tctx.fillStyle = action.bgColor;
           tctx.fill();
        }
        tctx.stroke();
      } else if (action.tool === 'line' && action.points && action.points.length > 1) {
        if (action.lineStyle === 'wave' || action.lineStyle === 'heavyWave') {
            drawBumpyPath(tctx, action.points, action.lineStyle, false);
        } else if (action.lineStyle === 'curve' && action.points.length > 2) {
           drawSpline(tctx, action.points);
        } else {
           tctx.beginPath();
           tctx.moveTo(action.points[0].x, action.points[0].y);
           for(let i=1; i<action.points.length; i++) tctx.lineTo(action.points[i].x, action.points[i].y);
           tctx.stroke();
        }
        
        tctx.setLineDash([]); 
        if (action.tool === 'line' && (action.arrowStyle === 'right' || action.arrowStyle === 'both')) {
           const p1 = action.points.length >= 2 ? action.points[action.points.length-2] : action.points[0];
           const p2 = action.points[action.points.length-1];
           drawArrow(tctx, p1, p2, action.size);
        }
        if (action.tool === 'line' && action.arrowStyle === 'both') {
           const p1 = action.points.length >= 2 ? action.points[1] : action.points[0];
           const p2 = action.points[0];
           drawArrow(tctx, p1, p2, action.size);
        }
      } else if (action.tool === 'sequence' && action.points && action.points[0]) {
        const p = action.points[0];
        let displayStr = String(seqCounter);
        if (action.seqType === 'A') displayStr = String.fromCharCode(64 + seqCounter);
        if (action.seqType === 'I') displayStr = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][seqCounter-1] || String(seqCounter);
        if (action.seqType === '汉') displayStr = ['一','二','三','四','五','六','七','八','九','十'][seqCounter-1] || String(seqCounter);
        
        tctx.beginPath();
        tctx.arc(p.x, p.y, Math.max(16, action.size * 3), 0, Math.PI * 2);
        tctx.fillStyle = action.bgColor === 'transparent' ? action.color : action.bgColor;
        tctx.fill();
        tctx.fillStyle = '#fff';
        tctx.font = `bold ${Math.max(12, action.size * 2)}px sans-serif`;
        tctx.textAlign = 'center';
        tctx.textBaseline = 'middle';
        tctx.fillText(displayStr, p.x, p.y);
        seqCounter++;
      } else if (action.tool === 'text' && action.text) {
        let fSize = 24;
        if(typeof action.fontSize === 'number') fSize = action.fontSize;
        else if(action.fontSize === 'S') fSize = 16;
        else if(action.fontSize === 'M') fSize = 24;
        else if(action.fontSize === 'L') fSize = 36;
        else if(action.fontSize === 'XL') fSize = 48;
        tctx.font = `${fSize}px sans-serif`;
        tctx.fillStyle = action.color;
        tctx.fillText(action.text.content, action.text.x, action.text.y);
      }
      
      if (selectedId === action.id && activeTool === 'select') {
        const box = getBBox(action);
        tctx.setLineDash([]);
        tctx.strokeStyle = '#ef4444';
        tctx.lineWidth = 1.5;
        tctx.strokeRect(box.x, box.y, box.w, box.h);
        
        if (['rect', 'circle'].includes(action.tool)) {
            const handles = [
                {x: box.x, y: box.y},
                {x: box.x + box.w/2, y: box.y},
                {x: box.x + box.w, y: box.y},
                {x: box.x + box.w, y: box.y + box.h/2},
                {x: box.x + box.w, y: box.y + box.h},
                {x: box.x + box.w/2, y: box.y + box.h},
                {x: box.x, y: box.y + box.h},
                {x: box.x, y: box.y + box.h/2},
            ];
            tctx.fillStyle = '#fff';
            handles.forEach(h => {
                tctx.beginPath();
                tctx.arc(h.x, h.y, 4, 0, Math.PI*2);
                tctx.fill();
                tctx.stroke();
            });
        }
        
        if (action.tool === 'pen' && action.bezierNodes) {
           tctx.lineWidth = 1;
           action.bezierNodes.forEach((node) => {
               if (node.h1x !== undefined && node.h1y !== undefined) {
                   tctx.strokeStyle = 'rgba(239,68,68,0.5)';
                   tctx.beginPath();
                   tctx.moveTo(node.x, node.y);
                   tctx.lineTo(node.h1x, node.h1y);
                   tctx.stroke();
                   
                   tctx.fillStyle = '#fff';
                   tctx.strokeStyle = '#ef4444';
                   tctx.beginPath();
                   tctx.arc(node.h1x, node.h1y, 3, 0, Math.PI*2);
                   tctx.fill(); tctx.stroke();
               }
               if (node.h2x !== undefined && node.h2y !== undefined) {
                   tctx.strokeStyle = 'rgba(239,68,68,0.5)';
                   tctx.beginPath();
                   tctx.moveTo(node.x, node.y);
                   tctx.lineTo(node.h2x, node.h2y);
                   tctx.stroke();
                   
                   tctx.fillStyle = '#fff';
                   tctx.strokeStyle = '#ef4444';
                   tctx.beginPath();
                   tctx.arc(node.h2x, node.h2y, 3, 0, Math.PI*2);
                   tctx.fill(); tctx.stroke();
               }
               tctx.fillStyle = '#fff';
               tctx.strokeStyle = '#ef4444';
               tctx.beginPath();
               tctx.rect(node.x - 3, node.y - 3, 6, 6);
               tctx.fill(); tctx.stroke();
           });
        }
        
        if (action.tool === 'line' && action.points) {
          tctx.fillStyle = '#fff';
          tctx.strokeStyle = '#ef4444';
          tctx.lineWidth = 1.5;
          tctx.setLineDash([]);
          action.points.forEach(pt => {
            tctx.beginPath();
            tctx.arc(pt.x, pt.y, 4, 0, Math.PI*2);
            tctx.fill();
            tctx.stroke();
          });
        }
      } else if (selectedId !== action.id && action.color === 'transparent' && action.bgColor === 'transparent' && activeTool === 'select' && showAnnotations) {
        const box = getBBox(action);
        tctx.setLineDash([4, 4]);
        tctx.strokeStyle = 'rgba(255,255,255,0.2)';
        tctx.lineWidth = 1;
        tctx.strokeRect(box.x, box.y, box.w, box.h);
      }
    });

    ctx.drawImage(tempCanvas, 0, 0);

    if (mousePos && (activeTool === 'pencil' || activeTool === 'smudge' || activeTool === 'eraser') && !sizingBrush?.active) {
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, size / 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [history, currentAction, selectedId, seqStart, dragState, mousePos, activeTool, size, sizingBrush, showAnnotations]);

  useEffect(() => {
    if (canvasRef.current && image) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) drawAll(ctx, image);
    }
  }, [image, history, currentAction, mousePos, drawAll]);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as any).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as any).clientY;
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  };

  const syncProperties = (id: string, updates: Partial<DrawingAction>) => {
    setHistory(history.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  useEffect(() => {
    if (selectedId) {
      const act = history.find(a => a.id === selectedId);
      if (act) {
        setColor(act.color);
        setBgColor(act.bgColor);
        setSize(act.size);
        setStrokeStyle(act.strokeStyle);
        setArrowStyle(act.arrowStyle);
        if(act.lineStyle) setLineStyle(act.lineStyle);
        if(act.seqType) setSeqType(act.seqType);
        if(act.seqStart) setSeqStart(act.seqStart);
        if(act.fontSize) setFontSize(act.fontSize);
        if(act.borderRadius !== undefined) setBorderRadius(act.borderRadius);
      }
    }
  }, [selectedId, history]);

  const updateSelectedProps = (updates: Partial<DrawingAction>) => {
    if (selectedId) syncProperties(selectedId, updates);
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    if (textInput.show) {
       handleTextSubmit();
    }
    
    if ('button' in e && (e as any).button === 1) {
      setIsMiddlePanning(true);
      return;
    }

    if (e.altKey) {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      setSizingBrush({ active: true, startX: clientX, startSize: size, currentX: clientX, currentY: clientY });
      return;
    }

    const pos = getCanvasPos(e);
    
    if (activeTool === 'select') {
      const selAction = history.find(a => a.id === selectedId);
      
      if (selAction && selAction.tool === 'pen' && selAction.bezierNodes) {
        const HIT_R = 10 / scale;
        for (let i = 0; i < selAction.bezierNodes.length; i++) {
           const node = selAction.bezierNodes[i];
           if (Math.hypot(node.x - pos.x, node.y - pos.y) < HIT_R) {
               const now = Date.now();
               if (now - lastClickRef.current.time < 300 && lastClickRef.current.id === selAction.id && lastClickRef.current.nodeIdx === i) {
                   const updatedAction = JSON.parse(JSON.stringify(selAction));
                   const n = updatedAction.bezierNodes[i];
                   if (n.h1x === undefined) {
                      n.h1x = n.x - 20; n.h1y = n.y;
                      n.h2x = n.x + 20; n.h2y = n.y;
                   } else {
                      delete n.h1x; delete n.h1y; delete n.h2x; delete n.h2y;
                   }
                   setHistory(history.map(a => a.id === selAction.id ? updatedAction : a));
                   setDragState({ type: 'bezierNode', startPos: pos, originalAction: updatedAction, index: i, handle: 'node' });
                   return;
               }
               lastClickRef.current = { time: now, id: selAction.id, nodeIdx: i };
               setDragState({ type: 'bezierNode', startPos: pos, originalAction: JSON.parse(JSON.stringify(selAction)), index: i, handle: 'node' });
               return;
           }
           if (node.h1x !== undefined && node.h1y !== undefined && Math.hypot(node.h1x - pos.x, node.h1y - pos.y) < HIT_R) {
               setDragState({ type: 'bezierNode', startPos: pos, originalAction: JSON.parse(JSON.stringify(selAction)), index: i, handle: 'h1' });
               return;
           }
           if (node.h2x !== undefined && node.h2y !== undefined && Math.hypot(node.h2x - pos.x, node.h2y - pos.y) < HIT_R) {
               setDragState({ type: 'bezierNode', startPos: pos, originalAction: JSON.parse(JSON.stringify(selAction)), index: i, handle: 'h2' });
               return;
           }
        }
      }
      
      if (selAction && selAction.tool === 'line' && selAction.points) {
        const ptIdx = selAction.points.findIndex(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 10);
        if (ptIdx !== -1) {
          setDragState({ type: 'point', index: ptIdx, startPos: pos, originalAction: JSON.parse(JSON.stringify(selAction)) });
          return;
        }
      }
      
      if (selAction && ['rect', 'circle', 'text'].includes(selAction.tool)) {
         const box = getBBox(selAction);
         const handles = [
            {x: box.x, y: box.y}, {x: box.x + box.w/2, y: box.y}, {x: box.x + box.w, y: box.y},
            {x: box.x + box.w, y: box.y + box.h/2}, {x: box.x + box.w, y: box.y + box.h},
            {x: box.x + box.w/2, y: box.y + box.h}, {x: box.x, y: box.y + box.h}, {x: box.x, y: box.y + box.h/2}
         ];
         const handleIdx = handles.findIndex(h => Math.hypot(h.x - pos.x, h.y - pos.y) < 8);
         if (handleIdx !== -1) {
            setDragState({ type: 'resize', index: handleIdx, startPos: pos, originalAction: JSON.parse(JSON.stringify(selAction)) });
            return;
         }
      }
      
      if (selAction && selAction.tool === 'text') {
         const box = getBBox(selAction);
         if (pos.x >= box.x - 10 && pos.x <= box.x + box.w + 10 && pos.y >= box.y - 10 && pos.y <= box.y + box.h + 10) {
             const now = Date.now();
             if (now - lastClickRef.current.time < 300 && lastClickRef.current.id === selAction.id) {
                 setTextInput({ show: true, x: selAction.text!.x, y: selAction.text!.y, val: selAction.text!.content });
                 setHistory(history.filter(a => a.id !== selAction.id));
                 return;
             }
             lastClickRef.current = { time: now, id: selAction.id, nodeIdx: -1 };
         }
      }
      
      let foundId = null;
      if (selAction) {
         const box = getBBox(selAction);
         if (pos.x >= box.x - 10 && pos.x <= box.x + box.w + 10 && pos.y >= box.y - 10 && pos.y <= box.y + box.h + 10) {
            foundId = selAction.id;
         }
      }
      if (!foundId) {
         for (let i = history.length - 1; i >= 0; i--) {
           if (history[i].tool === 'clear') break;
           const box = getBBox(history[i]);
           if (pos.x >= box.x - 10 && pos.x <= box.x + box.w + 10 && pos.y >= box.y - 10 && pos.y <= box.y + box.h + 10) {
             foundId = history[i].id;
             break;
           }
         }
      }
      setSelectedId(foundId);
      if (foundId) {
        const act = history.find(a => a.id === foundId)!;
        setDragState({ type: 'move', startPos: pos, originalAction: JSON.parse(JSON.stringify(act)) });
      }
      return;
    }

    setIsDrawing(true);
    
    if (activeTool === 'text') {
      setTextInput({ show: true, x: pos.x, y: pos.y, val: '' });
      setIsDrawing(false);
      return;
    }

    const newId = Date.now().toString();
    const baseAction: Omit<DrawingAction, 'tool'> = {
        id: newId, color, bgColor, size, opacity, strokeStyle, lineStyle, arrowStyle, seqType, seqStart, fontSize, borderRadius
    };
    
    if (activeTool === 'pen') {
      if (polylineState?.active && currentAction?.id === polylineState.id) {
         const nodes = [...currentAction.bezierNodes!];
         const firstNode = nodes[0];
         const isCloseToStart = nodes.length > 2 && Math.hypot(pos.x - firstNode.x, pos.y - firstNode.y) < 20;

         if (isCloseToStart) {
            // Close path
            nodes.pop();
            nodes.push({ ...firstNode }); 
            setHistory([...history, { ...currentAction, bezierNodes: nodes }]);
            setCurrentAction(null);
            setPolylineState(null);
            setIsDrawing(false);
            return;
         }

         nodes[nodes.length - 1] = { x: pos.x, y: pos.y };
         nodes.push({ x: pos.x, y: pos.y });
         setCurrentAction({ ...currentAction, bezierNodes: nodes });
         setIsDrawing(true);
         return;
      }
      setCurrentAction({ ...baseAction, tool: 'pen', bezierNodes: [{ x: pos.x, y: pos.y }, { x: pos.x, y: pos.y }] });
      setIsDrawing(true);
      return;
    }

    if (activeTool === 'line') {
      if (polylineState?.active && currentAction?.id === polylineState.id) {
         const pts = [...currentAction.points!];
         const lastPt = pts[pts.length - 2]; 

         if (lastPt && Math.hypot(pos.x - lastPt.x, pos.y - lastPt.y) < 5) {
            pts.pop(); 
            if (pts.length >= 2) setHistory([...history, { ...currentAction, points: pts }]);
            setCurrentAction(null);
            setPolylineState(null);
            setIsDrawing(false);
            return;
         }
         pts.push(pos);
         setCurrentAction({ ...currentAction, points: pts });
         return;
      }
      setCurrentAction({ ...baseAction, tool: 'line', points: [pos, pos] });
      return;
    }

    const nextAction: DrawingAction = {
      ...baseAction,
      tool: activeTool,
      points: ['pencil', 'smudge', 'eraser', 'sequence'].includes(activeTool) ? [pos, pos] : undefined,
      rect: activeTool === 'rect' ? { x: pos.x, y: pos.y, width: 0, height: 0 } : undefined,
      circle: activeTool === 'circle' ? { x: pos.x, y: pos.y, rx: 0, ry: 0 } : undefined
    };
    setCurrentAction(nextAction);
    setRedoStack([]);
    setSelectedId(newId);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    if (isMiddlePanning && 'movementX' in e) {
      setPan(p => ({ x: p.x + (e as any).movementX, y: p.y + (e as any).movementY }));
      return;
    }

    if (sizingBrush?.active) {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      const dx = clientX - sizingBrush.startX;
      const newSize = Math.max(1, Math.min(200, sizingBrush.startSize + dx * 0.5));
      setSize(newSize);
      setSizingBrush({ ...sizingBrush, currentX: clientX, currentY: clientY });
      return;
    }

    const pos = getCanvasPos(e);
    setMousePos(pos);

    if (activeTool === 'select' && dragState && selectedId) {
      const act = JSON.parse(JSON.stringify(dragState.originalAction));
      const dx = pos.x - dragState.startPos.x;
      const dy = pos.y - dragState.startPos.y;
      
      if (dragState.type === 'move') {
        if (act.rect) { act.rect.x += dx; act.rect.y += dy; }
        if (act.circle) { act.circle.x += dx; act.circle.y += dy; }
        if (act.points) { act.points = act.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy })); }
        if (act.text) { act.text.x += dx; act.text.y += dy; }
        if (act.bezierNodes) {
           act.bezierNodes = dragState.originalAction.bezierNodes!.map((p: any) => {
              const newNode: any = { x: p.x + dx, y: p.y + dy };
              if (p.h1x !== undefined) { newNode.h1x = p.h1x + dx; newNode.h1y = p.h1y + dy; }
              if (p.h2x !== undefined) { newNode.h2x = p.h2x + dx; newNode.h2y = p.h2y + dy; }
              return newNode;
           });
        }
        setHistory(history.map(a => a.id === selectedId ? act : a));
      } else if (dragState.type === 'point' && act.points && dragState.index !== undefined) {
        act.points[dragState.index] = { x: act.points[dragState.index].x + dx, y: act.points[dragState.index].y + dy };
        setHistory(history.map(a => a.id === selectedId ? act : a));
      } else if (dragState.type === 'bezierNode' && dragState.index !== undefined && act.bezierNodes) {
          const node = act.bezierNodes[dragState.index];
          const origNode = dragState.originalAction.bezierNodes![dragState.index];
          if (dragState.handle === 'node') {
              node.x = origNode.x + dx;
              node.y = origNode.y + dy;
              if (node.h1x !== undefined) { node.h1x = origNode.h1x! + dx; node.h1y = origNode.h1y! + dy; }
              if (node.h2x !== undefined) { node.h2x = origNode.h2x! + dx; node.h2y = origNode.h2y! + dy; }
          } else if (dragState.handle === 'h1') {
              node.h1x = origNode.h1x! + dx;
              node.h1y = origNode.h1y! + dy;
              if (node.h2x !== undefined && e.altKey === false) {
                 const angle = Math.atan2(node.h1y - node.y, node.h1x - node.x);
                 const dist2 = Math.hypot(node.h2x - node.x, node.h2y - node.y);
                 node.h2x = node.x - Math.cos(angle) * dist2;
                 node.h2y = node.y - Math.sin(angle) * dist2;
              }
          } else if (dragState.handle === 'h2') {
              node.h2x = origNode.h2x! + dx;
              node.h2y = origNode.h2y! + dy;
              if (node.h1x !== undefined && e.altKey === false) {
                 const angle = Math.atan2(node.h2y - node.y, node.h2x - node.x);
                 const dist1 = Math.hypot(node.h1x - node.x, node.h1y - node.y);
                 node.h1x = node.x - Math.cos(angle) * dist1;
                 node.h1y = node.y - Math.sin(angle) * dist1;
              }
          }
      } else if (dragState.type === 'resize' && dragState.index !== undefined) {
         if (act.tool === 'rect') {
           const rect = act.rect!;
           if ([0,6,7].includes(dragState.index)) { rect.x += dx; rect.width -= dx; }
           if ([0,1,2].includes(dragState.index)) { rect.y += dy; rect.height -= dy; }
           if ([2,3,4].includes(dragState.index)) { rect.width += dx; }
           if ([4,5,6].includes(dragState.index)) { rect.height += dy; }
         } else if (act.tool === 'circle') {
           const circle = act.circle!;
           if ([0,6,7].includes(dragState.index)) { circle.rx -= dx/2; circle.x += dx/2; }
           if ([2,3,4].includes(dragState.index)) { circle.rx += dx/2; circle.x += dx/2; }
           if ([0,1,2].includes(dragState.index)) { circle.ry -= dy/2; circle.y += dy/2; }
           if ([4,5,6].includes(dragState.index)) { circle.ry += dy/2; circle.y += dy/2; }
         } else if (act.tool !== 'line' && act.tool !== 'rect') {
            const oldBox = getBBox(dragState.originalAction);
            let nx = oldBox.x, ny = oldBox.y, nw = oldBox.w, nh = oldBox.h;
            if ([0,6,7].includes(dragState.index)) { nx += dx; nw -= dx; }
            if ([0,1,2].includes(dragState.index)) { ny += dy; nh -= dy; }
            if ([2,3,4].includes(dragState.index)) { nw += dx; }
            if ([4,5,6].includes(dragState.index)) { nh += dy; }
            
            if (nw < 5) nw = 5;
            if (nh < 5) nh = 5;
            
            const sx = oldBox.w === 0 ? 1 : nw / oldBox.w;
            const sy = oldBox.h === 0 ? 1 : nh / oldBox.h;

            if (act.points) {
               act.points = dragState.originalAction.points!.map(p => ({
                  x: nx + (p.x - oldBox.x) * sx,
                  y: ny + (p.y - oldBox.y) * sy
               }));
            }
            if (act.bezierNodes) {
               act.bezierNodes = dragState.originalAction.bezierNodes!.map(p => {
                  const newNode: { x: number; y: number; h1x?: number; h1y?: number; h2x?: number; h2y?: number } = { x: nx + (p.x - oldBox.x) * sx, y: ny + (p.y - oldBox.y) * sy };
                  if (p.h1x !== undefined && p.h1y !== undefined) {
                     newNode.h1x = nx + (p.h1x - oldBox.x) * sx;
                     newNode.h1y = ny + (p.h1y - oldBox.y) * sy;
                  }
                  if (p.h2x !== undefined && p.h2y !== undefined) {
                     newNode.h2x = nx + (p.h2x - oldBox.x) * sx;
                     newNode.h2y = ny + (p.h2y - oldBox.y) * sy;
                  }
                  return newNode;
               });
            }
            if (act.text) {
               act.text.x = nx + (dragState.originalAction.text!.x - oldBox.x) * sx;
               act.text.y = ny + (dragState.originalAction.text!.y - oldBox.y) * sy;
               const baseFSize = typeof dragState.originalAction.fontSize === 'number' ? dragState.originalAction.fontSize : 
                    (dragState.originalAction.fontSize === 'S' ? 16 : dragState.originalAction.fontSize === 'L' ? 36 : dragState.originalAction.fontSize === 'XL' ? 48 : 24);
               act.fontSize = baseFSize * sy;
            }
         }
         dragState.startPos = pos;
         dragState.originalAction = act; 
         setHistory(history.map(a => a.id === selectedId ? act : a));
      }
      return;
    }

    if (polylineState?.active && currentAction?.id === polylineState.id) {
       if (currentAction.tool === 'pen' && currentAction.bezierNodes) {
          const nodes = [...currentAction.bezierNodes];
          if (isDrawing) {
             // Dragging to set handles
             const dx = pos.x - nodes[nodes.length - 2].x;
             const dy = pos.y - nodes[nodes.length - 2].y;
             nodes[nodes.length - 2].h2x = pos.x;
             nodes[nodes.length - 2].h2y = pos.y;
             nodes[nodes.length - 2].h1x = nodes[nodes.length - 2].x - dx;
             nodes[nodes.length - 2].h1y = nodes[nodes.length - 2].y - dy;
          } else {
             nodes[nodes.length - 1].x = pos.x;
             nodes[nodes.length - 1].y = pos.y;
          }
          setCurrentAction({ ...currentAction, bezierNodes: nodes });
          return;
       }
       if (currentAction.points) {
          const pts = [...currentAction.points];
          pts[pts.length - 1] = pos;
          setCurrentAction({ ...currentAction, points: pts });
          return;
       }
    }

    if (!isDrawing || !currentAction) return;

    if (['pencil', 'smudge', 'eraser'].includes(currentAction.tool)) {
      setCurrentAction({ ...currentAction, points: [...(currentAction.points || []), pos] });
    } else if (currentAction.tool === 'pen' && currentAction.bezierNodes) {
      const nodes = [...currentAction.bezierNodes];
      if (nodes.length > 1) {
         const dx = pos.x - nodes[0].x;
         const dy = pos.y - nodes[0].y;
         nodes[0].h2x = pos.x;
         nodes[0].h2y = pos.y;
         nodes[0].h1x = nodes[0].x - dx;
         nodes[0].h1y = nodes[0].y - dy;
      }
      setCurrentAction({ ...currentAction, bezierNodes: nodes });
    } else if (currentAction.tool === 'line' && currentAction.points) {
      const newPoints = [...currentAction.points];
      newPoints[newPoints.length - 1] = pos;
      setCurrentAction({ ...currentAction, points: newPoints });
    } else if (currentAction.tool === 'rect') {
      let width = pos.x - currentAction.rect!.x;
      let height = pos.y - currentAction.rect!.y;
      if (e.shiftKey) {
         const max = Math.max(Math.abs(width), Math.abs(height));
         width = width < 0 ? -max : max;
         height = height < 0 ? -max : max;
      }
      setCurrentAction({ ...currentAction, rect: { x: currentAction.rect!.x, y: currentAction.rect!.y, width, height } });
    } else if (currentAction.tool === 'circle') {
      let rx = pos.x - currentAction.circle!.x;
      let ry = pos.y - currentAction.circle!.y;
      if (e.shiftKey) {
         const max = Math.max(Math.abs(rx), Math.abs(ry));
         rx = rx < 0 ? -max : max;
         ry = ry < 0 ? -max : max;
      }
      setCurrentAction({ ...currentAction, circle: { ...currentAction.circle!, rx, ry } });
    }
  };

  const handleEnd = () => {
    if (isMiddlePanning) { setIsMiddlePanning(false); return; }
    if (sizingBrush?.active) { setSizingBrush(null); return; }
    if (activeTool === 'select' && dragState) { setDragState(null); return; }
    
    if (currentAction?.tool === 'pen' && currentAction.bezierNodes) {
       if (!polylineState?.active) {
          setPolylineState({ active: true, id: currentAction.id });
       }
       setIsDrawing(false);
       return;
    }

    if (currentAction?.tool === 'line') {
       const pts = currentAction.points!;
       if (!polylineState?.active && pts.length === 2 && Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) < 5) {
          setPolylineState({ active: true, id: currentAction.id });
          return;
       } else if (polylineState?.active) {
          return;
       }
    }

    if (!isDrawing || !currentAction) return;
    setIsDrawing(false);
    setHistory([...history, currentAction]);
    setCurrentAction(null);
  };

  const handleToolSelect = (tool: Tool) => {
    setActiveTool(tool);
    setSelectedId(null);
  };

  const handleUndo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      setRedoStack(r => [h[h.length - 1], ...r]);
      return h.slice(0, -1);
    });
    setSelectedId(null);
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack(r => {
      if (r.length === 0) return r;
      setHistory(h => [...h, r[0]]);
      return r.slice(1);
    });
  }, []);

  const handleTextSubmit = () => {
    if (textInput.val.trim()) {
      const newId = Date.now().toString();
      setHistory([...history, {
        id: newId, tool: 'text', color, bgColor, size, opacity, strokeStyle, arrowStyle, seqType, seqStart, fontSize,
        text: { x: textInput.x, y: textInput.y, content: textInput.val }
      }]);
      setSelectedId(newId);
    }
    setTextInput({ show: false, x: 0, y: 0, val: '' });
  };

  const moveLayer = (direction: 'up' | 'down' | 'front' | 'back') => {
    if (!selectedId) return;
    const idx = history.findIndex(a => a.id === selectedId);
    if (idx < 0) return;
    const newHist = [...history];
    const item = newHist.splice(idx, 1)[0];
    if (direction === 'up') newHist.splice(Math.min(idx + 1, newHist.length), 0, item);
    else if (direction === 'down') newHist.splice(Math.max(idx - 1, 0), 0, item);
    else if (direction === 'front') newHist.push(item);
    else if (direction === 'back') newHist.unshift(item);
    setHistory(newHist);
  };

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!containerRef.current) return;
      if ((e.target as HTMLElement).closest('.toolbar-panel')) return;
      e.preventDefault();
      
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      
      const zoomSpeed = 0.002;
      const delta = -e.deltaY * zoomSpeed;
      let newScale = scale * (1 + delta);
      newScale = Math.max(0.1, Math.min(newScale, 10));
      
      const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
      const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);

      setScale(newScale);
      setPan({ x: newPanX, y: newPanY });
    };
    const c = containerRef.current;
    if (c) c.addEventListener('wheel', handleWheel, { passive: false });
    return () => { if (c) c.removeEventListener('wheel', handleWheel); };
  }, [scale, pan]);

  return createPortal(
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[10000] bg-[#121212] flex font-sans overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 pattern-dots opacity-10 pointer-events-none" />
      
      <div className="absolute w-full h-full cursor-grab active:cursor-grabbing">
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: dimensions.width || 0,
            height: dimensions.height || 0,
          }}
          className="relative shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_0_20px_rgba(0,0,0,0.5)]"
        >
           <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={(e) => { handleEnd(); setMousePos(null); }}
            onMouseEnter={(e) => { setMousePos(getCanvasPos(e)); }}
            className={`w-full h-full bg-transparent ${
              isMiddlePanning || altPressed ? 'cursor-crosshair' :
              activeTool === 'select' ? 'cursor-auto' : 
              activeTool === 'text' ? 'cursor-text' : 
              (activeTool === 'pencil' || activeTool === 'smudge' || activeTool === 'eraser' || activeTool === 'sequence' ? 'cursor-none' : 'cursor-crosshair')
            }`}
          />
          
          {textInput.show && (
            <div className="absolute z-[10001]" style={{ left: textInput.x, top: textInput.y }}>
              <input 
                autoFocus
                className="bg-transparent px-1 py-0 outline-none w-auto min-w-[200px]"
                style={{ color, fontSize: `${fontSize === 'S'?16:fontSize==='M'?24:fontSize==='L'?36:48}px`, transform: 'translateY(-100%)' }}
                value={textInput.val}
                onChange={(e) => setTextInput({ ...textInput, val: e.target.value })}
                onKeyDown={(e) => { e.stopPropagation(); e.key === 'Enter' && handleTextSubmit(); }}
                onMouseDown={e => e.stopPropagation()}
                placeholder="在此输入文本..."
              />
            </div>
          )}
        </div>
      </div>

      {sizingBrush?.active && (
        <div className="absolute z-[10002] pointer-events-none" style={{ left: sizingBrush.currentX, top: sizingBrush.currentY, transform: 'translate(-50%, -50%)' }}>
          <div 
            className="rounded-full bg-red-500/50 border border-red-500/80 shadow-[0_0_10px_rgba(255,0,0,0.5)] flex items-center justify-center transition-all duration-75"
            style={{ width: size * scale, height: size * scale }}
          />
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-zinc-900 border border-white/20 rounded px-3 py-2 text-white text-xs whitespace-nowrap shadow-xl font-mono">
             <div>直径: {Math.round(size)} 像素</div>
             <div>硬度: 20%</div>
             <div>不透明度: {Math.round(opacity * 100)}%</div>
          </div>
        </div>
      )}

      <div 
         ref={rightPanelDomRef}
         className="absolute bg-[#222222] border border-white/5 rounded-2xl shadow-2xl flex flex-col select-none p-4 pb-6 z-[10005] overflow-visible toolbar-panel"
         style={{ right: 24, top: rightPanel.top, width: rightPanel.w, height: rightPanel.h, touchAction: 'none' }}
         onPointerMove={handleToolbarPointerMove}
         onPointerUp={handleToolbarPointerUp}
         onWheel={e => e.stopPropagation()}
      >
          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize -translate-x-1" onPointerDown={e => initRightResize(e, 'left')} />
          <div className="absolute left-0 right-0 top-0 h-2 cursor-row-resize -translate-y-1" onPointerDown={e => initRightResize(e, 'top')} />
          <div className="absolute left-0 right-0 bottom-0 h-2 cursor-row-resize translate-y-1" onPointerDown={e => initRightResize(e, 'bottom')} />
          <div className="absolute left-0 top-0 w-3 h-3 cursor-nwse-resize -translate-x-1 -translate-y-1 z-10" onPointerDown={e => initRightResize(e, 'top-left')} />
          <div className="absolute left-0 bottom-0 w-3 h-3 cursor-nesw-resize -translate-x-1 translate-y-1 z-10" onPointerDown={e => initRightResize(e, 'bottom-left')} />

          <div className="overflow-y-auto w-full h-full custom-scrollbar pr-2 flex flex-col gap-y-5 [&>*]:shrink-0">
             {(() => {
                const currentPropTool = selectedId ? history.find(a => a.id === selectedId)?.tool || activeTool : activeTool;
                if (currentPropTool === 'select' && !selectedId) {
                   return <div className="text-zinc-500 text-sm text-center py-4 w-full">选择一个对象以编辑属性</div>;
                }
                const isSequence = currentPropTool === 'sequence';
                const isText = currentPropTool === 'text';
                const isShape = ['rect', 'circle'].includes(currentPropTool);
                return (
                  <>
                     <ColorPicker label={isText ? "文本颜色" : "描边"} value={color} onChange={(c:string) => {setColor(c); updateSelectedProps({color: c})}} />

                     {(isShape || isSequence || currentPropTool === 'pen') && (
                       <ColorPicker label="背景" value={bgColor} onChange={(c:string) => {setBgColor(c); updateSelectedProps({bgColor: c})}} />
                     )}

                     {isSequence && (
                     <>
                       <SegmentControl
                          label="序列号类型"
                          value={seqType}
                          onChange={(v:any) => { setSeqType(v); updateSelectedProps({seqType: v}) }}
                          options={[{v:'1', i:'8'}, {v:'A', i:'A'}, {v:'I', i:'Ⅲ'}, {v:'汉', i:'汉'}]}
                       />
                       <div className="w-full">
                          <span className="text-xs text-zinc-400 mb-1.5 block">序号起始</span>
                          <input type="number" min="1" value={seqStart} onChange={e => {setSeqStart(parseInt(e.target.value)||1); updateSelectedProps({seqStart: parseInt(e.target.value)||1})}} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#ef4444]" />
                       </div>
                     </>
                     )}

                     {currentPropTool === 'rect' && (
                        <SegmentControl
                          label="边角"
                          value={borderRadius}
                          onChange={(v:any) => { setBorderRadius(v); updateSelectedProps({borderRadius: v}) }}
                          options={[
                            { v: 0, i: <Square size={16} /> },
                            { v: 16, i: <div className="w-4 h-4 border-2 border-current rounded-md" /> }
                          ]}
                        />
                     )}

                     {currentPropTool !== 'text' && (
                        <div className="w-full">
                           <span className="text-xs text-zinc-400 mb-1.5 block">大小</span>
                           <div className="flex flex-col gap-2 bg-[#1a1a1a] p-2 rounded-lg border border-white/5">
                              <div className="flex items-center gap-2">
                                <input 
                                   type="number" 
                                   value={size} 
                                   onChange={e => {
                                      const val = parseFloat(e.target.value) || 1;
                                      setSize(val); 
                                      updateSelectedProps({size: val});
                                   }}
                                   className="flex-1 bg-transparent border-none text-white text-center outline-none text-sm" 
                                   min="1" max="200"
                                />
                                <span className="text-zinc-500 text-xs pr-2">pt</span>
                              </div>
                              <input type="range" min="1" max="200" value={size} onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setSize(val);
                                  updateSelectedProps({size: val});
                              }} className="w-full accent-[#ef4444]" />
                           </div>
                        </div>
                     )}

                     {['rect', 'circle', 'line', 'pen'].includes(currentPropTool) && (
                       <>
                         <SegmentControl
                            label="边框样式"
                            value={strokeStyle}
                            onChange={(v:any) => { setStrokeStyle(v); updateSelectedProps({strokeStyle: v}) }}
                            options={[
                              { v: 'solid', i: <div className="w-5 border-b-[2px] border-current" /> },
                              { v: 'dashed', i: <div className="w-5 border-b-[2px] border-dashed border-current" /> },
                              { v: 'dotted', i: <div className="w-5 border-b-[2px] border-dotted border-current" /> }
                            ]}
                         />
                         <SegmentControl
                            label="线条风格"
                            value={lineStyle}
                            onChange={(v:any) => { setLineStyle(v); updateSelectedProps({lineStyle: v}) }}
                            options={[
                              { v: 'straight', i: <Minus size={16} /> },
                              { v: 'wave', i: <span className="font-serif">~</span> },
                              { v: 'heavyWave', i: <span className="font-serif text-lg font-bold">~</span> }
                            ].concat(currentPropTool === 'line' || currentPropTool === 'pen' ? [{ v: 'curve', i: <b className="text-sm font-sans">S</b> }] : [])}
                         />
                       </>
                     )}

                     {currentPropTool === 'line' && (
                         <SegmentControl
                            label="箭头"
                            value={arrowStyle}
                            onChange={(v:any) => { setArrowStyle(v); updateSelectedProps({arrowStyle: v}) }}
                            options={[
                              { v: 'none', i: <Minus size={16} /> },
                              { v: 'right', i: <ArrowUpToLine size={16} className="rotate-90" /> },
                              { v: 'both', i: <ArrowDownToLine size={16} className="rotate-45" /> }
                            ]}
                         />
                     )}

                     {(isText || isSequence) && (
                        <div className="w-full">
                           <span className="text-xs text-zinc-400 mb-1.5 block">字体大小</span>
                           <div className="flex flex-col gap-2 bg-[#1a1a1a] p-2 rounded-lg border border-white/5">
                              <div className="flex items-center gap-2">
                                <input 
                                   type="number" 
                                   value={typeof fontSize === 'number' ? fontSize : (fontSize === 'S' ? 16 : fontSize === 'M' ? 24 : fontSize === 'L' ? 36 : 48)} 
                                   onChange={e => {
                                      const val = parseFloat(e.target.value) || 12;
                                      setFontSize(val); 
                                      updateSelectedProps({fontSize: val});
                                   }}
                                   className="flex-1 bg-transparent border-none text-white text-center outline-none text-sm" 
                                   min="12" max="200"
                                />
                                <span className="text-zinc-500 text-xs pr-2">pt</span>
                              </div>
                              <input type="range" min="12" max="200" value={typeof fontSize === 'number' ? fontSize : (fontSize === 'S' ? 16 : fontSize === 'M' ? 24 : fontSize === 'L' ? 36 : 48)} onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setFontSize(val);
                                  updateSelectedProps({fontSize: val});
                              }} className="w-full accent-[#ef4444]" />
                           </div>
                        </div>
                     )}

                     <div className="w-full">
                        <span className="text-xs text-zinc-400 mb-1.5 block">不透明度</span>
                        <div className="flex flex-col gap-2 bg-[#1a1a1a] p-2 rounded-lg border border-white/5">
                           <div className="flex items-center gap-2">
                              <span className="flex-1 text-white text-sm text-center">{Math.round(opacity * 100)}</span>
                              <span className="text-zinc-500 text-xs pr-2">%</span>
                           </div>
                           <input type="range" min="10" max="100" step="1" value={opacity * 100} onChange={(e) => { const v = parseFloat(e.target.value) / 100; setOpacity(v); updateSelectedProps({opacity: v}); }} className="w-full accent-[#ef4444]" />
                        </div>
                     </div>
                  </>
                );
             })()}

             <div className="w-full">
                <span className="text-xs text-zinc-400 mb-1.5 block">图层</span>
                <div className="flex bg-[#1a1a1a] rounded-lg p-1 gap-1 border border-white/5">
                   <button onClick={() => moveLayer('back')} className="flex-1 h-8 text-zinc-400 hover:text-white rounded-md flex items-center justify-center hover:bg-white/5 border border-transparent"><ArrowDownToLine size={16}/></button>
                   <button onClick={() => moveLayer('down')} className="flex-1 h-8 text-zinc-400 hover:text-white rounded-md flex items-center justify-center hover:bg-white/5 border border-transparent"><ArrowDown size={16}/></button>
                   <button onClick={() => moveLayer('up')} className="flex-1 h-8 text-zinc-400 hover:text-white rounded-md flex items-center justify-center hover:bg-white/5 border border-transparent"><ArrowUp size={16}/></button>
                   <button onClick={() => moveLayer('front')} className="flex-1 h-8 text-zinc-400 hover:text-white rounded-md flex items-center justify-center hover:bg-white/5 border border-transparent"><ArrowUpToLine size={16}/></button>
                </div>
             </div>
          </div>
      </div>

      <div 
         className="absolute bg-[#222222] border border-white/5 rounded-2xl shadow-2xl px-2 py-2 flex flex-col items-center gap-1 select-none z-[10005] max-h-[calc(100vh-64px)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] toolbar-panel"
         style={{ left: toolbarPos.x, top: toolbarPos.y, touchAction: 'none' }}
         onPointerDown={(e) => handleToolbarPointerDown(e, false)}
         onPointerMove={handleToolbarPointerMove}
         onPointerUp={handleToolbarPointerUp}
         onWheel={e => e.stopPropagation()}
      >
        <ToolButton icon={<MousePointerClick size={16} />} title="选择对象" active={activeTool === 'select'} onClick={() => handleToolSelect('select')} />
        
        <div className="h-px w-6 bg-white/10 my-1" />
        <ToolButton icon={<Square size={16} />} title="矩形框选" active={activeTool === 'rect'} onClick={() => handleToolSelect('rect')} />
        <ToolButton icon={<Circle size={16} />} title="圆形框选" active={activeTool === 'circle'} onClick={() => handleToolSelect('circle')} />
        <ToolButton icon={<PenTool size={16} />} title="样条线 (钢笔 - 拖拽调整手柄, Enter结束)" active={activeTool === 'pen'} onClick={() => handleToolSelect('pen')} />
        <ToolButton icon={<Minus size={16} className="rotate-45" />} title="多段线/箭头" active={activeTool === 'line'} onClick={() => handleToolSelect('line')} />
        
        <div className="h-px w-6 bg-white/10 my-1" />
        <ToolButton icon={<Pencil size={16} />} title="画笔 (按住Alt左/右拖拽调整大小)" active={activeTool === 'pencil'} onClick={() => handleToolSelect('pencil')} />
        <ToolButton icon={<Type size={16} />} title="文本" active={activeTool === 'text'} onClick={() => handleToolSelect('text')} />
        <ToolButton icon={<div className="font-bold font-mono text-[10px] bg-zinc-700 text-white rounded-full w-[18px] h-[18px] flex items-center justify-center">1</div>} title="序号" active={activeTool === 'sequence'} onClick={() => handleToolSelect('sequence')} />
        <ToolButton icon={<Eraser size={16} />} title="橡皮擦 (按住Alt左/右拖拽调整大小)" active={activeTool === 'eraser'} onClick={() => handleToolSelect('eraser')} />
        
        <div className="h-px w-6 bg-white/10 my-1" />
        <ToolButton icon={showAnnotations ? <Eye size={16} /> : <EyeOff size={16} />} title={showAnnotations ? "隐藏标注" : "显示标注"} active={!showAnnotations} onClick={() => setShowAnnotations(!showAnnotations)} />
        <div className="h-px w-6 bg-white/10 my-1" />
        <ToolButton icon={<X size={16} />} title="关闭" onClick={onClose} className="hover:bg-red-500/10 text-red-400" />
      </div>

      {/* Bottom Zoom Controls */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 rounded-[100px] flex items-center h-12 px-4 shadow-2xl z-[10005] select-none text-zinc-400 gap-1">
         <button 
           onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}
           className="h-7 px-2.5 flex items-center justify-center hover:bg-white/10 rounded-md text-xs font-mono transition-colors border border-zinc-700 cursor-pointer text-zinc-300 mr-2"
           title="重置视图 (1:1)"
         >
           1:1
         </button>
         
         <span className="text-xs font-mono font-medium max-w-[48px] min-w-[42px] text-center mr-2">
           {Math.round(scale * 100)}%
         </span>
         
         <button 
           onClick={() => {
              const newScale = Math.min(scale + 0.15, 10);
              const cx = window.innerWidth / 2;
              const cy = window.innerHeight / 2;
              setPan({ x: cx - (cx - pan.x) * (newScale / scale), y: cy - (cy - pan.y) * (newScale / scale) });
              setScale(newScale);
           }}
           className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors cursor-pointer mr-1"
           title="放大"
         >
           <ZoomIn size={16} />
         </button>
         
         <button 
           onClick={() => {
              const newScale = Math.max(scale - 0.15, 0.1);
              const cx = window.innerWidth / 2;
              const cy = window.innerHeight / 2;
              setPan({ x: cx - (cx - pan.x) * (newScale / scale), y: cy - (cy - pan.y) * (newScale / scale) });
              setScale(newScale);
           }}
           className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors cursor-pointer mr-2"
           title="缩小"
         >
           <ZoomOut size={16} />
         </button>

         <div className="w-px h-6 bg-white/10 mx-1" />

         <button onClick={handleUndo} disabled={history.length === 0} title="撤销" className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed">
            <Undo2 size={16} />
         </button>
         
         <button onClick={handleRedo} disabled={redoStack.length === 0} title="重做" className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed mr-1">
            <Redo2 size={16} />
         </button>

         <button 
           title="清除所有标记" 
           onClick={() => { 
             setHistory([...history, { 
                id: Date.now().toString(), tool: 'clear', color, bgColor, size, opacity, strokeStyle, arrowStyle, seqType, seqStart, fontSize 
             } as any]);
             setRedoStack([]);
             setSelectedId(null);
           }} 
           className="h-8 px-3 flex items-center justify-center gap-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-zinc-300 mr-2"
         >
            <Trash2 size={14} />
            <span className="text-[11px] font-medium leading-none">清除标记</span>
         </button>

         <button 
           onClick={() => onSave(canvasRef.current!.toDataURL('image/webp'))} 
           title="保存" 
           className="h-8 px-3 ml-1 flex items-center justify-center gap-1.5 bg-[#ef4444] text-white hover:bg-[#f87171] rounded-full transition-colors shadow-sm cursor-pointer"
         >
            <Save size={14} />
            <span className="text-[12px] font-medium leading-none">保存</span>
         </button>

      </div>
    </div>,
    document.body
  );
};

interface ToolBtnProps { icon: React.ReactNode; title?: string; active?: boolean; disabled?: boolean; onClick: () => void; className?: string; }
const ToolButton = ({ icon, title, active, disabled, onClick, className = '' }: ToolBtnProps) => (
  <button onClick={onClick} disabled={disabled} title={title} className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${className} ${active ? 'bg-[#1a2333] text-[#ef4444] shadow-inner border border-[#ef4444]/50' : 'text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400'}`}>{icon}</button>
);
