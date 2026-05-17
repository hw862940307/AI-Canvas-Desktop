import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useStore } from '../store/useStore';
import { 
  Image as ImageIcon, 
  Upload, 
  Maximize2, 
  X, 
  Download, 
  MoreHorizontal, 
  Edit2, 
  Check, 
  RotateCcw,
  Plus,
  Minimize2,
  Pen,
  ZoomIn,
  ZoomOut,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnnotationModal } from './AnnotationModal';
import { downloadImage } from '../lib/download';

export const SourceImageNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const { updateNodeData, addNode, settings } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Resize when original dimensions are provided (e.g. from global paste)
  useEffect(() => {
    if (data.originalWidth && data.originalHeight && data.url) {
      const maxWidth = 1000; // Increased max width for better "original" feel
      const ratio = data.originalWidth / data.originalHeight;
      const width = Math.min(data.originalWidth, maxWidth);
      const imageHeight = width / ratio;
      
      updateNodeData(id, { 
        width,
        height: imageHeight + 150,
        aspectRatio: ratio,
        // Clear these so we don't trigger the effect repeatedly
        originalWidth: undefined,
        originalHeight: undefined
      });
    }
  }, [data.originalWidth, data.originalHeight, data.url, id, updateNodeData]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight, width, height } = e.currentTarget;
    setDimensions({ width: naturalWidth, height: naturalHeight });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const imageUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Calculate scale based on quality setting
        let qualityScale = 1.0;
        let webpQuality = 0.9;
        
        if (settings.uploadQuality === 'standard') {
          qualityScale = 0.5;
          webpQuality = 0.7;
        } else if (settings.uploadQuality === 'high') {
          qualityScale = 0.75;
          webpQuality = 0.85;
        } else {
          qualityScale = 1.0;
          webpQuality = 1.0;
        }
        
        const targetWidth = img.width * qualityScale;
        const targetHeight = img.height * qualityScale;
        
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          const finalUrl = canvas.toDataURL('image/webp', webpQuality);
          
          const maxWidth = 400;
          const ratio = targetWidth / targetHeight;
          const displayWidth = Math.min(targetWidth, maxWidth);
          const displayHeight = displayWidth / ratio;
          
          updateNodeData(id, { 
            url: finalUrl,
            aspectRatio: ratio,
            width: displayWidth,
            height: displayHeight + 150 
          });
        }
      };
      img.src = imageUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

    const dataTransfer = e.dataTransfer;
    
    // 1. Try to get files directly
    const files = dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
        if (file.type.startsWith('image/')) {
          processFile(file);
        }
      });
      return;
    }

    // 2. Try to get image from items
    if (dataTransfer.items) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        if (dataTransfer.items[i].kind === 'file' && dataTransfer.items[i].type.startsWith('image/')) {
          const file = dataTransfer.items[i].getAsFile();
          if (file) {
            processFile(file);
            return;
          }
        }
      }
    }

    // 3. Handle data from other nodes
    const rfDataRaw = dataTransfer.getData('application/reactflow/data');
    const rfDataOldRaw = dataTransfer.getData('application/reactflow');
    
    if (rfDataRaw) {
      try {
        const d = JSON.parse(rfDataRaw);
        if (d.imageUrl || d.url) {
          updateNodeData(id, { url: d.imageUrl || d.url });
          return;
        }
      } catch (err) {}
    }

    if (rfDataOldRaw) {
      try {
        const nodeData = JSON.parse(rfDataOldRaw);
        if (nodeData.imageUrl) { // ImageNode uses imageUrl
          updateNodeData(id, { url: nodeData.imageUrl });
          return;
        }
        if (nodeData.url) {
          updateNodeData(id, { url: nodeData.url });
          return;
        }
      } catch (err) {}
    }

    const url = dataTransfer.getData('text/plain') || dataTransfer.getData('url');
    if (url && (url.startsWith('http') || url.startsWith('data:'))) {
      updateNodeData(id, { url });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isFullScreen) return;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(zoomScale + delta, 0.5), 5);
    setZoomScale(newScale);
  };

  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (!isFullScreen || zoomScale <= 1) return;
    setIsDraggingImage(true);
    setDragStart({ x: e.clientX - zoomOffset.x, y: e.clientY - zoomOffset.y });
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingImage) return;
    setZoomOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleImageMouseUp = () => {
    setIsDraggingImage(false);
  };
    
  const clearImage = () => {
    updateNodeData(id, { url: null });
  };

  return (
    <div 
      onDragEnter={(e) => handleDragEnter(e)}
      onDragOver={(e) => handleDragOver(e)}
      onDragLeave={(e) => handleDragLeave(e)}
      onDrop={(e) => handleDrop(e)}
      className={`relative border w-full h-full ${selected ? 'border-[var(--accent)] shadow-[0_0_20px_var(--accent)]/30' : 'border-[var(--border)]'} rounded-3xl overflow-visible shadow-2xl transition-all flex flex-col pointer-events-auto ${
        isDragOver ? 'border-blue-500 ring-4 ring-blue-500/10' : ''
      } ${
        settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
      }`}
    >
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected} 
        minWidth={200}
        minHeight={200}
        keepAspectRatio={true}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '2px solid #3b82f6' }}
      />
      {/* Floating Toolbar */}
      <AnimatePresence>
        {selected && data.url && (
          <motion.div 
            initial={{ opacity: 1, y: -60, scale: 1 }}
            animate={{ opacity: 1, y: -60, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0 }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`absolute left-1/2 -translate-x-1/2 top-0 flex items-center gap-1 p-1 border border-[var(--border)] rounded-2xl shadow-2xl z-[100] whitespace-nowrap transition-all ${
              settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-tertiary)]'
            }`}
          >
            <ToolbarIconButton icon={<Pencil size={16} />} onClick={() => setIsAnnotating(true)} title="标注模式" />
            <div className="w-px h-4 bg-[var(--border)] mx-1" />
            <ToolbarIconButton icon={<Maximize2 size={16} />} onClick={() => setIsFullScreen(true)} title="全屏显示" />
            <ToolbarIconButton icon={<Download size={16} />} onClick={() => data.url && downloadImage(data.url, `source-image-\${id}.png`)} title="下载" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className={`p-4 border-b border-[var(--border)] flex items-center justify-between transition-all rounded-t-3xl shrink-0 react-flow__node-draghandle ${
        settings.barTexture === 'frosted' ? 'frosted-glass border-b-white/5' : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
            <ImageIcon size={18} />
          </div>
          <span className="text-base font-bold tracking-wider text-[var(--text-primary)]">源图像</span>
        </div>
        <div className="flex items-center gap-2">
           <button 
            onClick={(e) => { e.stopPropagation(); data.url && setIsFullScreen(true); }}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] transition-colors"
           >
              <Maximize2 size={14} />
           </button>
        </div>
      </div>

      <div className={`flex-1 p-4 min-h-0 flex flex-col rounded-b-3xl nodrag ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-[var(--bg-primary)]'
      }`}>
        <div 
          className="w-full flex-1 rounded-2xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)]/50 flex flex-col items-center justify-center gap-4 transition-all relative overflow-hidden bg-[var(--bg-primary)]"
          onClick={() => !data.url && fileInputRef.current?.click()}
        >
          {data.url ? (
            <>
              <img draggable={false} src={data.url} alt="Source" className="w-full h-full object-contain" />
              <button 
                onClick={(e) => { e.stopPropagation(); clearImage(); }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover/node:opacity-100 transition-all backdrop-blur-sm"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
                <Upload size={24} />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-base font-bold text-[var(--text-secondary)] uppercase tracking-widest">上传图片</span>
                <span className="text-sm text-[var(--text-secondary)]/50 mt-1">PNG, JPG, WEBP</span>
              </div>
            </>
          )}

          {/* Drop Overlay */}
          {isDragOver && (
            <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[2px] pointer-events-none z-50 flex items-center justify-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                <Upload size={32} className="text-white" />
              </div>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange} 
          />
        </div>

        <div className="flex items-center gap-2 mt-4 shrink-0 justify-end">
           <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] rounded-lg text-base text-[var(--text-secondary)] font-bold border border-[var(--border)] transition-all"
           >
              <Upload size={14} />
              <span>上传</span>
           </button>
        </div>
      </div>

      {/* Portals Section */}
      {createPortal(
        <>
          {/* Annotation Mode Portal */}
          <AnimatePresence>
            {isAnnotating && data.url && (
              <AnnotationModal 
                imageUrl={data.url}
                onClose={() => setIsAnnotating(false)}
                onSave={(newUrl) => {
                  updateNodeData(id, { url: newUrl });
                  setIsAnnotating(false);
                }}
              />
            )}
          </AnimatePresence>

          {/* Full Screen View */}
          <AnimatePresence>
            {isFullScreen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onWheel={handleWheel}
                className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 overflow-hidden"
              >
                <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
                  <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-1.5 px-3">
                    <button 
                      onClick={() => setZoomScale(Math.max(zoomScale - 0.2, 0.5))}
                      className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all"
                    >
                      <ZoomOut size={20} />
                    </button>
                    <span className="text-white/80 font-mono text-lg min-w-[60px] text-center">
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button 
                      onClick={() => setZoomScale(Math.min(zoomScale + 0.2, 5))}
                      className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all"
                    >
                      <ZoomIn size={20} />
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button 
                      onClick={() => { setZoomScale(1); setZoomOffset({ x: 0, y: 0 }); }}
                      className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all"
                      title="Reset"
                    >
                      <RotateCcw size={18} />
                    </button>
                  </div>

                  <button 
                    onClick={() => { setIsFullScreen(false); setZoomScale(1); setZoomOffset({ x: 0, y: 0 }); }} 
                    className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-red-500 text-white rounded-2xl transition-all border border-white/10 shadow-2xl"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div 
                  className={`w-full h-full flex items-center justify-center overflow-hidden ${zoomScale > 1 ? 'cursor-move' : 'cursor-default'}`}
                  onMouseDown={handleImageMouseDown}
                  onMouseMove={handleImageMouseMove}
                  onMouseUp={handleImageMouseUp}
                  onMouseLeave={handleImageMouseUp}
                >
                  <motion.div 
                    animate={{ 
                      scale: zoomScale,
                      x: zoomOffset.x,
                      y: zoomOffset.y
                    }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="relative max-w-full max-h-full flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img draggable={false} 
                      src={data.url} 
                      alt="Fullscreen" 
                      className="max-w-[90vw] max-h-[85vh] object-contain shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-3xl border border-white/5 select-none pointer-events-none" 
                    />
                  </motion.div>
                </div>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] z-20">
                   <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                     <span className="text-sm font-bold text-white/40 tracking-wider">SOURCE ASSET</span>
                   </div>
                   <span className="text-sm font-mono text-white/60">
                     {dimensions ? `${dimensions.width} × ${dimensions.height}` : '...'} PX
                   </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}

      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
    </div>
  );
};

const ToolbarIconButton = ({ icon, onClick, title, disabled = false }: { icon: React.ReactNode, onClick?: () => void, title?: string, disabled?: boolean }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
    disabled={disabled}
    title={title}
    className="p-2.5 hover:bg-[#222] text-gray-500 hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {icon}
  </button>
);

