import fs from 'fs';
const content = `import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Undo2, Redo2, Pencil, Square, Type, Eraser, Save,
  Circle, Minus, MousePointerClick, Trash2, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine
} from 'lucide-react';

interface AnnotationModalProps {
  imageUrl: string;
  onSave: (editedImageUrl: string) => void;
  onClose: () => void;
}

type Tool = 'select' | 'rect' | 'circle' | 'line' | 'pencil' | 'text' | 'sequence' | 'smudge' | 'eraser';

interface DrawingAction {
  id: string;
  tool: Tool;
  color: string;
  bgColor: string;
  size: number;
  opacity: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  lineStyle?: 'straight' | 'curve';
  arrowStyle: 'none' | 'right' | 'both';
  seqType: '1' | 'A' | 'I' | '汉';
  seqStart: number;
  fontSize: 'S' | 'M' | 'L' | 'XL';
  points?: { x: number; y: number }[];
  rect?: { x: number; y: number; width: number; height: number };
  circle?: { x: number; y: number; rx: number; ry: number };
  text?: { x: number; y: number; content: string };
}

export const AnnotationModal = ({ imageUrl, onSave, onClose }: AnnotationModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#FF4D4F');
  const [bgColor, setBgColor] = useState('transparent');
  const [size, setSize] = useState(6);
  const [opacity, setOpacity] = useState(1);
  const [strokeStyle, setStrokeStyle] = useState<'solid'|'dashed'|'dotted'>('solid');
  const [lineStyle, setLineStyle] = useState<'straight'|'curve'>('straight');
  const [arrowStyle, setArrowStyle] = useState<'none'|'right'|'both'>('none');
  const [seqType, setSeqType] = useState<'1'|'A'|'I'|'汉'>('1');
  const [seqStart, setSeqStart] = useState(1);
  const [fontSize, setFontSize] = useState<'S'|'M'|'L'|'XL'>('M');
  
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [polylineState, setPolylineState] = useState<{ active: boolean, id: string } | null>(null);
  const [altPressed, setAltPressed] = useState(false);
  const [sizingBrush, setSizingBrush] = useState<{ active: boolean, startX: number, startSize: number, currentX: number, currentY: number } | null>(null);

  const [dragState, setDragState] = useState<{
    type: 'move' | 'point' | 'resize',
    index?: number,
    startPos: {x:number, y:number},
    originalAction: DrawingAction
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPressed(true);
      if (e.key === 'Escape' || e.key === 'Enter') {
         if (polylineState?.active && currentAction) {
            const pts = [...currentAction.points!];
            pts.pop();
            if (pts.length >= 2) setHistory(h => [...h, { ...currentAction, points: pts }]);
            setCurrentAction(null);
            setPolylineState(null);
            setIsDrawing(false);
         }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
         if (!textInput.show && selectedId) {
            setHistory(h => h.filter(a => a.id !== selectedId));
            setSelectedId(null);
         }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltPressed(false);
        if (sizingBrush) setSizingBrush(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedId, textInput, history, polylineState, currentAction, sizingBrush]);

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

  const getBBox = (action: DrawingAction) => {
    if (action.tool === 'rect' && action.rect) {
       const x = Math.min(action.rect.x, action.rect.x + action.rect.width);
       const y = Math.min(action.rect.y, action.rect.y + action.rect.height);
       const w = Math.abs(action.rect.width);
       const h = Math.abs(action.rect.height);
       return { x, y, w, h };
    }
    if (action.tool === 'circle' && action.circle) return { x: action.circle.x - Math.abs(action.circle.rx), y: action.circle.y - Math.abs(action.circle.ry), w: Math.abs(action.circle.rx)*2, h: Math.abs(action.circle.ry)*2 };
    if (action.points && action.points.length > 0) {
      let minX=action.points[0].x, maxX=action.points[0].x, minY=action.points[0].y, maxY=action.points[0].y;
      action.points.forEach(p => { if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; });
      return { x: minX, y: minY, w: maxX-minX, h: maxY-minY };
    }
    if (action.tool === 'text' && action.text) return { x: action.text.x, y: action.text.y - 20, w: 100, h: 40 };
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
        if (action.bgColor !== 'transparent') tctx.fillRect(action.rect.x, action.rect.y, action.rect.width, action.rect.height);
        tctx.strokeRect(action.rect.x, action.rect.y, action.rect.width, action.rect.height);
      } else if (action.tool === 'circle' && action.circle) {
        tctx.beginPath();
        tctx.ellipse(action.circle.x, action.circle.y, Math.abs(action.circle.rx), Math.abs(action.circle.ry), 0, 0, Math.PI * 2);
        if (action.bgColor !== 'transparent') tctx.fill();
        tctx.stroke();
      } else if (action.tool === 'line' && action.points && action.points.length > 1) {
        if (action.lineStyle === 'curve' && action.points.length > 2) {
           drawSpline(tctx, action.points);
        } else {
           tctx.beginPath();
           tctx.moveTo(action.points[0].x, action.points[0].y);
           for(let i=1; i<action.points.length; i++) tctx.lineTo(action.points[i].x, action.points[i].y);
           tctx.stroke();
        }
        
        tctx.setLineDash([]); 
        if (action.arrowStyle === 'right' || action.arrowStyle === 'both') {
           const p1 = action.points.length >= 2 ? action.points[action.points.length-2] : action.points[0];
           const p2 = action.points[action.points.length-1];
           drawArrow(tctx, p1, p2, action.size);
        }
        if (action.arrowStyle === 'both') {
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
        tctx.font = \`bold \${Math.max(12, action.size * 2)}px sans-serif\`;
        tctx.textAlign = 'center';
        tctx.textBaseline = 'middle';
        tctx.fillText(displayStr, p.x, p.y);
        seqCounter++;
      } else if (action.tool === 'text' && action.text) {
        let fSize = 24;
        if(action.fontSize === 'S') fSize = 16;
        if(action.fontSize === 'M') fSize = 24;
        if(action.fontSize === 'L') fSize = 36;
        if(action.fontSize === 'XL') fSize = 48;
        tctx.font = \`\${fSize}px sans-serif\`;
        tctx.fillStyle = action.color;
        tctx.fillText(action.text.content, action.text.x, action.text.y);
      }
      
      if (selectedId === action.id && activeTool === 'select') {
        const box = getBBox(action);
        tctx.setLineDash([]);
        tctx.strokeStyle = '#0066ff';
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
        
        if (action.tool === 'line' && action.points) {
          action.points.forEach(pt => {
            tctx.beginPath();
            tctx.arc(pt.x, pt.y, 5, 0, Math.PI*2);
            tctx.fill();
            tctx.stroke();
          });
        }
      } else if (selectedId !== action.id && action.color === 'transparent' && action.bgColor === 'transparent' && activeTool === 'select') {
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
  }, [history, currentAction, selectedId, seqStart, dragState, mousePos, activeTool, size, sizingBrush]);

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
      }
    }
  }, [selectedId, history]);

  const updateSelectedProps = (updates: Partial<DrawingAction>) => {
    if (selectedId) syncProperties(selectedId, updates);
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    if ('button' in e && (e as any).button === 1) {
      setIsMiddlePanning(true);
      return;
    }

    if (e.altKey && ['pencil', 'eraser', 'smudge'].includes(activeTool)) {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      setSizingBrush({ active: true, startX: clientX, startSize: size, currentX: clientX, currentY: clientY });
      return;
    }

    const pos = getCanvasPos(e);
    
    if (activeTool === 'select') {
      const selAction = history.find(a => a.id === selectedId);
      
      if (selAction && selAction.tool === 'line' && selAction.points) {
        const ptIdx = selAction.points.findIndex(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 10);
        if (ptIdx !== -1) {
          setDragState({ type: 'point', index: ptIdx, startPos: pos, originalAction: JSON.parse(JSON.stringify(selAction)) });
          return;
        }
      }
      
      if (selAction && ['rect', 'circle'].includes(selAction.tool)) {
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
      
      let foundId = null;
      for (let i = history.length - 1; i >= 0; i--) {
        const box = getBBox(history[i]);
        if (pos.x >= box.x - 5 && pos.x <= box.x + box.w + 5 && pos.y >= box.y - 5 && pos.y <= box.y + box.h + 5) {
          foundId = history[i].id;
          break;
        }
      }
      setSelectedId(foundId);
      if (foundId) {
        const act = history.find(a => a.id === foundId)!;
        setDragState({ type: 'move', startPos: pos, originalAction: JSON.parse(JSON.stringify(act)) });
      }
      return;
    }

    if (textInput.show) return;
    setIsDrawing(true);
    
    if (activeTool === 'text') {
      setTextInput({ show: true, x: pos.x, y: pos.y, val: '' });
      setIsDrawing(false);
      return;
    }

    const newId = Date.now().toString();
    const baseAction: Omit<DrawingAction, 'tool'> = {
        id: newId, color, bgColor, size, opacity, strokeStyle, lineStyle, arrowStyle, seqType, seqStart, fontSize
    };
    
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
      if (['pencil', 'eraser', 'smudge'].includes(activeTool)) updateSelectedProps({ size: newSize });
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
        setHistory(history.map(a => a.id === selectedId ? act : a));
      } else if (dragState.type === 'point' && act.points && dragState.index !== undefined) {
        act.points[dragState.index] = { x: act.points[dragState.index].x + dx, y: act.points[dragState.index].y + dy };
        setHistory(history.map(a => a.id === selectedId ? act : a));
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
         }
         dragState.startPos = pos;
         dragState.originalAction = act; 
         setHistory(history.map(a => a.id === selectedId ? act : a));
      }
      return;
    }

    if (polylineState?.active && currentAction?.id === polylineState.id) {
       const pts = [...currentAction.points!];
       pts[pts.length - 1] = pos;
       setCurrentAction({ ...currentAction, points: pts });
       return;
    }

    if (!isDrawing || !currentAction) return;

    if (['pencil', 'smudge', 'eraser'].includes(currentAction.tool)) {
      setCurrentAction({ ...currentAction, points: [...(currentAction.points || []), pos] });
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
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomSpeed = 0.002;
        const delta = -e.deltaY * zoomSpeed;
        let newScale = scale * (1 + delta);
        newScale = Math.max(0.1, Math.min(newScale, 10));
        setScale(newScale);
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    const c = containerRef.current;
    if (c) c.addEventListener('wheel', handleWheel, { passive: false });
    return () => { if (c) c.removeEventListener('wheel', handleWheel); };
  }, [scale]);

  const SegmentControl = ({ label, options, value, onChange }: any) => (
    <div>
      <span className="text-xs text-zinc-400 mb-1.5 block">{label}</span>
      <div className="flex bg-[#1a1a1a] rounded-lg p-1 gap-1 border border-white/5">
        {options.map((o:any) => (
          <button
             key={o.v}
             onClick={() => onChange(o.v)}
             className={\`flex-1 h-8 rounded-md border flex items-center justify-center transition-all \${
               value === o.v 
                ? 'border-[#0066ff] bg-[#1a2333] text-[#0066ff]' 
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
             }\`}
          >
            {o.i}
          </button>
        ))}
      </div>
    </div>
  );

  const COLORS = ['transparent', '#FF4D4F', '#52C41A', '#1890FF', '#FFA940', '#FFFFFF', '#000000'];
  const ColorPicker = ({ label, value, onChange }: any) => (
    <div>
      <span className="text-xs text-zinc-400 mb-1.5 block">{label}</span>
      <div className="flex gap-1 justify-between">
         {COLORS.map(c => (
           <button 
              key={c} 
              onClick={() => onChange(c)} 
              className={\`w-6 h-6 rounded border border-white/20 relative \${c === value ? 'ring-2 ring-[#0066ff] ring-offset-1 ring-offset-[#222]' : ''}\`} 
              style={{background: c === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px' : c}}
           >
              {c === 'transparent' && <div className="absolute inset-0 border-t border-red-500 rotate-45 transform origin-center"></div>}
           </button>
         ))}
      </div>
    </div>
  );

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
            transform: \`translate(\${pan.x}px, \${pan.y}px) scale(\${scale})\`,
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
            className={\`w-full h-full bg-transparent \${
              isMiddlePanning || altPressed ? 'cursor-crosshair' :
              activeTool === 'select' ? 'cursor-auto' : 
              activeTool === 'text' ? 'cursor-text' : 
              (activeTool === 'pencil' || activeTool === 'smudge' || activeTool === 'eraser' || activeTool === 'sequence' ? 'cursor-none' : 'cursor-crosshair')
            }\`}
          />
          
          {textInput.show && (
            <div className="absolute z-[10001]" style={{ left: textInput.x, top: textInput.y }}>
              <input 
                autoFocus
                className="bg-transparent border-b-2 border-dashed border-red-500 px-1 py-0 outline-none w-auto min-w-[200px]"
                style={{ color, fontSize: \`\${fontSize === 'S'?16:fontSize==='M'?24:fontSize==='L'?36:48}px\`, transform: 'translateY(-100%)' }}
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

      <div className="absolute right-6 top-24 w-[280px] bg-[#222222] border border-white/5 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none p-4 pb-6 h-auto max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-5">
             <ColorPicker label="描边" value={color} onChange={(c:string) => {setColor(c); updateSelectedProps({color: c})}} />

             {['rect', 'circle', 'sequence'].includes(activeTool) && (
               <ColorPicker label="背景" value={bgColor} onChange={(c:string) => {setBgColor(c); updateSelectedProps({bgColor: c})}} />
             )}

             {activeTool === 'sequence' && (
             <>
               <SegmentControl
                  label="序列号类型"
                  value={seqType}
                  onChange={(v:any) => { setSeqType(v); updateSelectedProps({seqType: v}) }}
                  options={[{v:'1', i:'8'}, {v:'A', i:'A'}, {v:'I', i:'Ⅲ'}, {v:'汉', i:'汉'}]}
               />
               <div>
                  <span className="text-xs text-zinc-400 mb-1.5 block">序号起始</span>
                  <input type="number" min="1" value={seqStart} onChange={e => {setSeqStart(parseInt(e.target.value)||1); updateSelectedProps({seqStart: parseInt(e.target.value)||1})}} className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#0066ff]" />
               </div>
             </>
             )}

             {activeTool !== 'text' && (
                <SegmentControl
                  label="描边宽度"
                  value={size}
                  onChange={(v:any) => { setSize(v); updateSelectedProps({size: v}) }}
                  options={[
                    { v: 2, i: <div className="w-5 border-b-[2px] border-current" /> },
                    { v: 6, i: <div className="w-5 border-b-[4px] border-current" /> },
                    { v: 12, i: <div className="w-5 border-b-[6px] border-current" /> }
                  ]}
                />
             )}

             {['rect', 'circle', 'line'].includes(activeTool) && (
                <SegmentControl
                  label="边框样式"
                  value={strokeStyle}
                  onChange={(v:any) => { setStrokeStyle(v); updateSelectedProps({strokeStyle: v}) }}
                  options={[
                    { v: 'solid', i: <div className="w-5 border-b-2 border-current" /> },
                    { v: 'dashed', i: <div className="w-5 border-b-2 border-dashed border-current" /> },
                    { v: 'dotted', i: <div className="w-5 border-b-2 border-dotted border-current" /> }
                  ]}
                />
             )}

             {activeTool === 'line' && (
               <>
                <SegmentControl
                  label="线条风格"
                  value={lineStyle}
                  onChange={(v:any) => { setLineStyle(v); updateSelectedProps({lineStyle: v}) }}
                  options={[
                    { v: 'straight', i: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="4"/></svg> },
                    { v: 'curve', i: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20 Q 10 0 20 4"/></svg> }
                  ]}
                />
                <SegmentControl
                  label="箭头类型"
                  value={arrowStyle}
                  onChange={(v:any) => { setArrowStyle(v); updateSelectedProps({arrowStyle: v}) }}
                  options={[
                    { v: 'none', i: <Minus size={16}/> },
                    { v: 'right', i: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12 h16 m -6 -6 l 6 6 l -6 6"/></svg> },
                    { v: 'both', i: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12 h16 m -16 0 l 6 -6 m -6 6 l 6 6 m 10 -6 l -6 -6 m 6 6 l -6 6"/></svg> }
                  ]}
                />
               </>
             )}

             {activeTool === 'text' && (
                <SegmentControl
                  label="字体大小"
                  value={fontSize}
                  onChange={(v:any) => { setFontSize(v); updateSelectedProps({fontSize: v}) }}
                  options={[{v:'S',i:'S'}, {v:'M',i:'M'}, {v:'L',i:'L'}, {v:'XL',i:'XL'}]}
                />
             )}

             <div>
                <span className="text-xs text-zinc-400 mb-1.5 block">透明度</span>
                <div className="flex items-center gap-2">
                   <input 
                     type="range" min="0.1" max="1" step="0.1" value={opacity} 
                     onChange={(e) => {setOpacity(parseFloat(e.target.value)); updateSelectedProps({opacity: parseFloat(e.target.value)})}}
                     className="w-full accent-[#0066ff]"
                   />
                </div>
             </div>

             <div>
                <span className="text-xs text-zinc-400 mb-1.5 block">图层</span>
                <div className="flex bg-[#1a1a1a] rounded-lg p-1 gap-1 border border-white/5">
                   <button onClick={() => moveLayer('back')} className="flex-1 py-1 text-zinc-400 hover:text-white rounded-md flex justify-center hover:bg-white/5"><ArrowDownToLine size={16}/></button>
                   <button onClick={() => moveLayer('down')} className="flex-1 py-1 text-zinc-400 hover:text-white rounded-md flex justify-center hover:bg-white/5"><ArrowDown size={16}/></button>
                   <button onClick={() => moveLayer('up')} className="flex-1 py-1 text-zinc-400 hover:text-white rounded-md flex justify-center hover:bg-white/5"><ArrowUp size={16}/></button>
                   <button onClick={() => moveLayer('front')} className="flex-1 py-1 text-zinc-400 hover:text-white rounded-md flex justify-center hover:bg-white/5"><ArrowUpToLine size={16}/></button>
                </div>
             </div>
          </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#222222] border border-white/5 rounded-2xl shadow-2xl px-2 py-2 flex items-center gap-1 select-none">
        <ToolButton icon={<MousePointerClick size={16} />} title="选择对象" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
        <div className="w-px h-6 bg-white/10 mx-1" />
        <ToolButton icon={<Square size={16} />} title="矩形框选" active={activeTool === 'rect'} onClick={() => setActiveTool('rect')} />
        <ToolButton icon={<Circle size={16} />} title="圆形框选" active={activeTool === 'circle'} onClick={() => setActiveTool('circle')} />
        <ToolButton icon={<Minus size={16} className="rotate-45" />} title="多段线/箭头" active={activeTool === 'line'} onClick={() => setActiveTool('line')} />
        <ToolButton icon={<Pencil size={16} />} title="画笔 (按住Alt左/右拖拽调整大小)" active={activeTool === 'pencil'} onClick={() => setActiveTool('pencil')} />
        <ToolButton icon={<Type size={16} />} title="文本" active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
        <ToolButton icon={<div className="font-bold font-mono text-[10px] bg-zinc-700 text-white rounded-full w-[18px] h-[18px] flex items-center justify-center">1</div>} title="序号" active={activeTool === 'sequence'} onClick={() => setActiveTool('sequence')} />
        <ToolButton icon={<Eraser size={16} />} title="橡皮擦 (按住Alt左/右拖拽调整大小)" active={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} />
        <div className="w-px h-6 bg-white/10 mx-1" />
        <ToolButton icon={<Undo2 size={16} />} title="撤销" disabled={history.length === 0} onClick={() => { if(history.length) { setRedoStack([history[history.length-1], ...redoStack]); setHistory(history.slice(0, -1)); setSelectedId(null); } }} />
        <ToolButton icon={<Redo2 size={16} />} title="重做" disabled={redoStack.length === 0} onClick={() => { if(redoStack.length) { setHistory([...history, redoStack[0]]); setRedoStack(redoStack.slice(1)); } }} />
        <ToolButton icon={<Trash2 size={16} />} title="删除选中" onClick={() => { if(selectedId) { setHistory(history.filter(a => a.id !== selectedId)); setSelectedId(null); } }} disabled={!selectedId} className="text-red-400 hover:text-red-300 hover:bg-red-500/10" />
        <div className="w-px h-6 bg-white/10 mx-1" />
        <ToolButton icon={<Save size={16} />} title="保存" onClick={() => onSave(canvasRef.current!.toDataURL('image/webp'))} className="bg-[#0066ff] text-white hover:bg-[#3385ff] shadow-sm ml-1" />
        <ToolButton icon={<X size={16} />} title="关闭" onClick={onClose} className="hover:bg-red-500/10 text-red-400" />
      </div>
    </div>,
    document.body
  );
};

interface ToolBtnProps { icon: React.ReactNode; title?: string; active?: boolean; disabled?: boolean; onClick: () => void; className?: string; }
const ToolButton = ({ icon, title, active, disabled, onClick, className = '' }: ToolBtnProps) => (
  <button onClick={onClick} disabled={disabled} title={title} className={\`p-2.5 rounded-xl transition-all flex items-center justify-center \${className} \${active ? 'bg-[#1a2333] text-[#0066ff] shadow-inner border border-[#0066ff]/50' : 'text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400'}\`}>{icon}</button>
);
`
fs.writeFileSync('src/components/AnnotationModal.tsx', content);
