import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Check, 
  Undo2, 
  Redo2, 
  Pencil, 
  Square, 
  Type, 
  Eraser, 
  Save,
  RotateCcw,
  Minus,
  Plus,
  ArrowUpRight,
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';

interface AnnotationModalProps {
  imageUrl: string;
  onSave: (editedImageUrl: string) => void;
  onClose: () => void;
}

type Tool = 'brush' | 'rectangle' | 'text' | 'eraser' | 'arrow' | 'circle';

interface DrawingAction {
  tool: Tool;
  color: string;
  size: number;
  opacity: number;
  points?: { x: number; y: number }[];
  rect?: { x: number; y: number; width: number; height: number };
  text?: { x: number; y: number; content: string };
  arrow?: { from: { x: number; y: number }; to: { x: number; y: number } };
  circle?: { x: number; y: number; rx: number; ry: number };
}

export const AnnotationModal = ({ imageUrl, onSave, onClose }: AnnotationModalProps) => {
  const settings = useStore((state) => state.settings);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#ff0000');
  const [size, setSize] = useState(12);
  const [opacity, setOpacity] = useState(1);
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  const [history, setHistory] = useState<DrawingAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingAction[]>([]);
  const [currentAction, setCurrentAction] = useState<DrawingAction | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [textInput, setTextInput] = useState({ show: false, x: 0, y: 0, val: '' });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      setImage(img);
      const aspect = img.width / img.height;
      let w = Math.min(img.width, window.innerWidth * 0.85);
      let h = w / aspect;
      if (h > window.innerHeight * 0.75) {
        h = window.innerHeight * 0.75;
        w = h * aspect;
      }
      setDimensions({ width: w, height: h });
    };
  }, [imageUrl]);

  const drawAll = useCallback((ctx: CanvasRenderingContext2D, baseImage: HTMLImageElement) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(baseImage, 0, 0, ctx.canvas.width, ctx.canvas.height);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = ctx.canvas.width;
    tempCanvas.height = ctx.canvas.height;
    const tctx = tempCanvas.getContext('2d');
    if (!tctx) return;

    const actions = [...history, ...(currentAction ? [currentAction] : [])];
    
    actions.forEach(action => {
      tctx.strokeStyle = action.color;
      tctx.fillStyle = action.color;
      tctx.lineWidth = action.size;
      tctx.lineCap = 'round';
      tctx.lineJoin = 'round';
      tctx.globalAlpha = action.opacity;

      if (action.tool === 'brush' || action.tool === 'eraser') {
        if (action.tool === 'eraser') {
          tctx.globalCompositeOperation = 'destination-out';
          tctx.globalAlpha = 1; // Eraser always full strength against previous markup
        } else {
          tctx.globalCompositeOperation = 'source-over';
        }
        
        if (action.points && action.points.length > 0) {
          tctx.beginPath();
          tctx.moveTo(action.points[0].x, action.points[0].y);
          action.points.forEach(p => tctx.lineTo(p.x, p.y));
          tctx.stroke();
        }
        tctx.globalCompositeOperation = 'source-over';
      } else if (action.tool === 'rectangle') {
        if (action.rect) {
          tctx.strokeRect(action.rect.x, action.rect.y, action.rect.width, action.rect.height);
        }
      } else if (action.tool === 'circle') {
        if (action.circle) {
          tctx.beginPath();
          tctx.ellipse(action.circle.x, action.circle.y, Math.abs(action.circle.rx), Math.abs(action.circle.ry), 0, 0, Math.PI * 2);
          tctx.stroke();
        }
      } else if (action.tool === 'arrow') {
        if (action.arrow) {
          const { from, to } = action.arrow;
          const headlen = action.size * 3;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const angle = Math.atan2(dy, dx);
          tctx.beginPath();
          tctx.moveTo(from.x, from.y);
          tctx.lineTo(to.x, to.y);
          tctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
          tctx.moveTo(to.x, to.y);
          tctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
          tctx.stroke();
        }
      } else if (action.tool === 'text') {
        if (action.text) {
          tctx.font = `${action.size * 5}px sans-serif`;
          tctx.fillText(action.text.content, action.text.x, action.text.y);
        }
      }
    });

    ctx.drawImage(tempCanvas, 0, 0);

    // Draw brush preview if applicable
    if (mousePos && (activeTool === 'brush' || activeTool === 'eraser')) {
      // Outer black ring for contrast
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, size / 2 + 1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Yellow ring as requested
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, size / 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [history, currentAction, mousePos, activeTool, size, color]);

  useEffect(() => {
    if (canvasRef.current && image) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) drawAll(ctx, image);
    }
  }, [image, history, currentAction, mousePos, drawAll]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (textInput.show) return;
    setIsDrawing(true);
    const pos = getPos(e);
    
    if (activeTool === 'text') {
      setTextInput({ show: true, x: pos.x, y: pos.y, val: '' });
      setIsDrawing(false);
      return;
    }

    const nextAction: DrawingAction = {
      tool: activeTool,
      color,
      size,
      opacity,
      points: (activeTool === 'brush' || activeTool === 'eraser') ? [pos] : undefined,
      rect: activeTool === 'rectangle' ? { x: pos.x, y: pos.y, width: 0, height: 0 } : undefined,
      arrow: activeTool === 'arrow' ? { from: pos, to: pos } : undefined,
      circle: activeTool === 'circle' ? { x: pos.x, y: pos.y, rx: 0, ry: 0 } : undefined
    };
    setCurrentAction(nextAction);
    setRedoStack([]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e);
    setMousePos(pos);

    if (!isDrawing || !currentAction) return;

    if (currentAction.tool === 'brush' || currentAction.tool === 'eraser') {
      setCurrentAction({
        ...currentAction,
        points: [...(currentAction.points || []), pos]
      });
    } else if (currentAction.tool === 'rectangle') {
      setCurrentAction({
        ...currentAction,
        rect: {
          x: currentAction.rect!.x,
          y: currentAction.rect!.y,
          width: pos.x - currentAction.rect!.x,
          height: pos.y - currentAction.rect!.y
        }
      });
    } else if (currentAction.tool === 'arrow') {
      setCurrentAction({
        ...currentAction,
        arrow: { ...currentAction.arrow!, to: pos }
      });
    } else if (currentAction.tool === 'circle') {
      setCurrentAction({
        ...currentAction,
        circle: {
          ...currentAction.circle!,
          rx: (pos.x - currentAction.circle!.x),
          ry: (pos.y - currentAction.circle!.y)
        }
      });
    }
  };

  const handleEnd = () => {
    if (!isDrawing || !currentAction) return;
    setIsDrawing(false);
    setHistory([...history, currentAction]);
    setCurrentAction(null);
  };

  const handleTextSubmit = () => {
    if (textInput.val.trim()) {
      setHistory([...history, {
        tool: 'text',
        color,
        size,
        opacity,
        text: { x: textInput.x, y: textInput.y, content: textInput.val }
      }]);
    }
    setTextInput({ show: false, x: 0, y: 0, val: '' });
  };

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setRedoStack([last, ...redoStack]);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const first = redoStack[0];
    setRedoStack(redoStack.slice(1));
    setHistory([...history, first]);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    onSave(canvasRef.current.toDataURL('image/webp'));
  };

  return (
    <div 
      className={`fixed inset-0 z-[10000] flex flex-col p-4 transition-all ${
        settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]/95 backdrop-blur-3xl'
      }`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header Toolbar */}
      <div className={`flex items-center justify-between px-8 py-4 border border-[var(--border)] rounded-t-[32px] transition-all ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-[var(--bg-tertiary)]'
      }`}>
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-all text-[var(--text-secondary)] hover:text-white">
            <X size={20} />
          </button>
          <div className="w-px h-6 bg-[var(--border)]" />
          
          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
            <ToolButton active={activeTool === 'brush'} icon={<Pencil size={18} />} onClick={() => setActiveTool('brush')} />
            <ToolButton active={activeTool === 'rectangle'} icon={<Square size={18} />} onClick={() => setActiveTool('rectangle')} />
            <ToolButton active={activeTool === 'circle'} icon={<Circle size={18} />} onClick={() => setActiveTool('circle')} />
            <ToolButton active={activeTool === 'arrow'} icon={<ArrowUpRight size={18} />} onClick={() => setActiveTool('arrow')} />
            <ToolButton active={activeTool === 'eraser'} icon={<Eraser size={18} />} onClick={() => setActiveTool('eraser')} />
            <ToolButton active={activeTool === 'text'} icon={<Type size={18} />} onClick={() => setActiveTool('text')} />
          </div>

          <div className="flex items-center gap-4 px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2">
              {['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#ffff00', '#000000'].map(c => (
                <button 
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="w-px h-6 bg-white/10" />
            
            <div className="flex flex-col gap-1 min-w-[200px]">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">大小</span>
                <span className="text-[10px] font-mono text-blue-500 font-bold">{size}px</span>
              </div>
              <input 
                type="range"
                min="1"
                max="100"
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value))}
                className="w-full accent-blue-600 h-1.5 rounded-lg appearance-none bg-white/10 cursor-pointer"
              />
            </div>

            <div className="w-px h-6 bg-white/10" />

            <div className="flex flex-col gap-1 min-w-[140px]">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">不透明度</span>
                <span className="text-[10px] font-mono text-blue-500 font-bold">{Math.round(opacity * 100)}%</span>
              </div>
              <input 
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1.5 rounded-lg appearance-none bg-white/10 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
            <ToolButton icon={<Undo2 size={18} />} onClick={undo} disabled={history.length === 0} />
            <ToolButton icon={<Redo2 size={18} />} onClick={redo} disabled={redoStack.length === 0} />
            <ToolButton icon={<RotateCcw size={18} />} onClick={() => setHistory([])} disabled={history.length === 0} />
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl active:scale-95"
        >
          <Save size={18} />
          <span>保存修改</span>
        </button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative bg-[var(--bg-primary)] overflow-hidden flex items-center justify-center p-8 border-x border-[var(--border)]">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={() => { handleEnd(); setMousePos(null); }}
          onMouseEnter={(e) => setMousePos(getPos(e))}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className={`bg-white shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-sm ${activeTool === 'text' ? 'cursor-text' : (activeTool === 'brush' || activeTool === 'eraser' ? 'cursor-none' : 'cursor-crosshair')}`}
        />
        
        {textInput.show && (
          <div 
            className="absolute z-[10001] flex flex-col gap-2 p-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl shadow-2xl"
            style={{ 
              left: textInput.x + (window.innerWidth - dimensions.width) / 2, 
              top: textInput.y + (window.innerHeight - dimensions.height) / 2 
            }}
          >
            <input 
              autoFocus
              className="bg-transparent border-b border-blue-500 text-[var(--text-primary)] px-2 py-1 outline-none"
              style={{ color }}
              value={textInput.val}
              onChange={(e) => setTextInput({ ...textInput, val: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setTextInput({ show: false, x: 0, y: 0, val: '' })} className="p-1 px-3 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">取消</button>
              <button onClick={handleTextSubmit} className="p-1 px-3 text-[10px] bg-blue-600 text-white rounded-lg">确定</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ToolButton = ({ active, icon, onClick, disabled }: { active?: boolean, icon: React.ReactNode, onClick: () => void, disabled?: boolean }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`p-2.5 rounded-xl transition-all ${
      active 
        ? 'bg-blue-600 text-white shadow-lg' 
        : 'text-gray-500 hover:text-white hover:bg-white/5 disabled:opacity-20'
    }`}
  >
    {icon}
  </button>
);
