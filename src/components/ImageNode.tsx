import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  Maximize2, 
  Crop as CropIcon, 
  LayoutGrid, 
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
import { useStore } from '../store/useStore';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { motion, AnimatePresence } from 'motion/react';
import { AnnotationModal } from './AnnotationModal';
import { downloadImage } from '../lib/download';

const CROP_ASPECTS = [
  { label: '自由比例', value: undefined },
  { label: '原图比例', value: 'original' },
  { label: '21:9', value: 21 / 9 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '1:1', value: 1 / 1 },
];

export const ImageNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { updateNodeData, removeNode, addNode, settings } = useStore();

  const [isCropping, setIsCropping] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isGridCropping, setIsGridCropping] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [cropMode, setCropMode] = useState<'rect' | 'path'>('rect');
  const [pathPoints, setPathPoints] = useState<{ x: number, y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);

  // Resize when original dimensions are provided (e.g. from global paste)
  useEffect(() => {
    if (data.originalWidth && data.originalHeight && data.imageUrl) {
      console.log('ImageNode: Resizing due to original dimensions');
      const maxWidth = 800; // Increased max width for better "original" feel
      const ratio = data.originalWidth / data.originalHeight;
      const width = Math.min(data.originalWidth, maxWidth);
      const imageHeight = width / ratio;
      
      updateNodeData(id, { 
        width,
        height: imageHeight + 140,
        aspectRatio: ratio,
        // Clear these so we don't trigger the effect repeatedly
        originalWidth: undefined,
        originalHeight: undefined
      });
    }
  }, [data.originalWidth, data.originalHeight, data.imageUrl, id, updateNodeData]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight, width, height } = e.currentTarget;
    setDimensions({ width: naturalWidth, height: naturalHeight });

    if (aspect) {
      setCrop(centerCrop(
        makeAspectCrop(
          { unit: '%', width: 90 },
          aspect,
          width,
          height
        ),
        width,
        height
      ));
    }
  };

  useEffect(() => {
    if (isCropping && imgRef.current && aspect) {
       const { width, height } = imgRef.current;
       setCrop(centerCrop(
        makeAspectCrop(
          { unit: '%', width: 90 },
          aspect,
          width,
          height
        ),
        width,
        height
      ));
    }
  }, [aspect, isCropping]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxWidth = 320;
        const ratio = img.width / img.height;
        const width = Math.min(img.width, maxWidth);
        const imageHeight = width / ratio;
        
        updateNodeData(id, { 
          imageUrl,
          aspectRatio: ratio,
          width,
          height: imageHeight + 140 // Chrome height approx
        });
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
          updateNodeData(id, { imageUrl: d.imageUrl || d.url });
          return;
        }
      } catch (err) {}
    }

    if (rfDataOldRaw) {
      try {
        const nodeData = JSON.parse(rfDataOldRaw);
        if (nodeData.imageUrl) { 
          updateNodeData(id, { imageUrl: nodeData.imageUrl });
          return;
        }
        if (nodeData.url) {
          updateNodeData(id, { imageUrl: nodeData.url });
          return;
        }
      } catch (err) {}
    }

    const url = dataTransfer.getData('text/plain') || dataTransfer.getData('url');
    if (url && (url.startsWith('http') || url.startsWith('data:'))) {
      updateNodeData(id, { imageUrl: url });
    }
  };

  const generateCroppedImage = async () => {
    try {
      if (!imgRef.current || !completedCrop) return;
      
      const croppedImage = await getCroppedImg(imgRef.current, completedCrop);
      const currentNode = useStore.getState().nodes.find(n => n.id === id);
      const x = currentNode ? currentNode.position.x + 350 : window.innerWidth / 2;
      const y = currentNode ? currentNode.position.y : window.innerHeight / 2;
      
      const ratio = completedCrop.width / completedCrop.height;
      const width = Math.min(completedCrop.width, 320);
      const imageHeight = width / ratio;

      addNode('image', x, y, { 
        imageUrl: croppedImage,
        aspectRatio: ratio,
        width,
        height: imageHeight + 140
      });
      setIsCropping(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGridCrop = async (count: number) => {
    const gridSize = Math.sqrt(count);
    const img = new Image();
    img.src = data.imageUrl;
    await new Promise((res) => (img.onload = res));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tileW = img.width / gridSize;
    const tileH = img.height / gridSize;
    canvas.width = tileW;
    canvas.height = tileH;

    const currentNode = useStore.getState().nodes.find(n => n.id === id);
    const startX = currentNode ? currentNode.position.x + 400 : window.innerWidth / 2;
    const startY = currentNode ? currentNode.position.y : window.innerHeight / 2;

    const ratio = tileW / tileH;
    const nodeWidth = 320;
    const nodeHeight = (nodeWidth / ratio) + 140;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        ctx.clearRect(0, 0, tileW, tileH);
        ctx.drawImage(img, col * tileW, row * tileH, tileW, tileH, 0, 0, tileW, tileH);
        const tileUrl = canvas.toDataURL('image/webp');
        addNode('image', startX + col * 350, startY + row * 280, { 
          imageUrl: tileUrl,
          width: nodeWidth,
          height: nodeHeight,
          aspectRatio: ratio
        });
      }
    }
    setIsGridCropping(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (cropMode !== 'path' || !imgRef.current) return;
    setIsDrawing(true);
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPathPoints([{ x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || cropMode !== 'path' || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const lastPoint = pathPoints[pathPoints.length - 1];
    if (lastPoint) {
      const dist = Math.sqrt(Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2));
      if (dist < 0.5) return;
    }
    
    setPathPoints([...pathPoints, { x, y }]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const generatePathCroppedImage = async () => {
    if (!imgRef.current || pathPoints.length < 3) return;
    try {
      const croppedImage = await getPathCroppedImg(imgRef.current, pathPoints);
      
      const currentNode = useStore.getState().nodes.find(n => n.id === id);
      const x = currentNode ? currentNode.position.x + 350 : window.innerWidth / 2;
      const y = currentNode ? currentNode.position.y : window.innerHeight / 2;
      
      addNode('image', x, y, { 
        imageUrl: croppedImage,
        width: 320,
        height: 400,
        aspectRatio: 1
      });
      setIsCropping(false);
      setPathPoints([]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div 
      onDragEnter={(e) => handleDragEnter(e)}
      onDragOver={(e) => handleDragOver(e)}
      onDragLeave={(e) => handleDragLeave(e)}
      onDrop={(e) => handleDrop(e)}
      className={`relative group/node border w-full h-full ${selected ? 'border-[var(--accent)] shadow-[0_0_20px_var(--accent)]/30' : 'border-[var(--border)]'} rounded-3xl overflow-visible shadow-2xl transition-all flex flex-col pointer-events-auto ${
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
        {selected && data.imageUrl && !isCropping && !isGridCropping && (
          <motion.div 
            initial={{ opacity: 1, y: -60, scale: 1 }}
            animate={{ opacity: 1, y: -60, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0 }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`absolute left-1/2 -translate-x-1/2 top-0 flex items-center gap-1 p-1 border border-[var(--border)] rounded-2xl shadow-2xl z-[100] whitespace-nowrap transition-all ${
              settings.barTexture === 'frosted' ? 'bg-[var(--bg-tertiary)]/80 backdrop-blur-xl' : 'bg-[var(--bg-tertiary)]'
            }`}
          >
            <ToolbarIconButton icon={<ImageIcon size={16} />} title="属性" />
            <ToolbarIconButton icon={<Pencil size={16} />} onClick={() => setIsAnnotating(true)} title="标注模式" />
            <ToolbarIconButton icon={<MoreHorizontal size={16} />} title="更多" />
            <div className="w-px h-4 bg-[var(--border)] mx-1" />
            <ToolbarIconButton icon={<LayoutGrid size={16} />} onClick={() => setIsGridCropping(true)} title="宫格裁剪" />
            <ToolbarIconButton icon={<CropIcon size={16} />} onClick={() => { setIsCropping(true); setCropMode('rect'); }} title="裁剪" />
            <ToolbarIconButton icon={<Maximize2 size={16} />} onClick={() => setIsFullScreen(true)} title="全屏显示" />
            <ToolbarIconButton icon={<Download size={16} />} onClick={() => data.imageUrl && downloadImage(data.imageUrl, `image-\${id}.png`)} title="下载" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] rounded-t-3xl shrink-0 transition-all react-flow__node-draghandle ${
        settings.barTexture === 'frosted' ? 'bg-[var(--bg-tertiary)]/80 backdrop-blur-md' : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <ImageIcon size={18} />
          </div>
          <span className="text-base font-bold tracking-wider text-[var(--text-primary)]">图像节点</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); data.imageUrl && setIsFullScreen(true); }}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-secondary)]"
          >
            <Maximize2 size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); removeNode(id); }}
            className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-[var(--text-secondary)] hover:text-red-400"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className={`flex-1 p-4 rounded-b-3xl min-h-0 flex flex-col nodrag ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-[var(--bg-primary)]'
      }`}>
        {data.imageUrl ? (
          <div 
            className="relative w-full flex-1 rounded-2xl overflow-hidden bg-black/60 group/img ring-1 ring-[var(--border)]"
          >
            <img draggable={false} src={data.imageUrl} alt="Node content" className="w-full h-full object-contain" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full transition-all border border-white/10 shadow-xl"
              >
                <Upload size={18} />
              </button>
            </div>

            {/* Drop Overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[2px] pointer-events-none z-50 flex items-center justify-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                  <Upload size={32} className="text-white" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center w-full flex-1 border-2 border-dashed border-[#222] hover:border-blue-500/50 hover:bg-blue-500/5 rounded-2xl transition-all text-gray-400 gap-4 relative overflow-hidden ${
              isDragOver ? 'bg-blue-500/5 border-blue-500/50' : ''
            }`}
          >
            <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center">
              <ImageIcon size={32} className="text-gray-600" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-base font-bold text-gray-300 uppercase tracking-widest">添加上传图片</span>
              <span className="text-sm text-gray-600 mt-1">PNG, JPG, WEBP</span>
            </div>

            {/* Drop Overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[2px] pointer-events-none z-50 flex items-center justify-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                  <Upload size={24} className="text-white" />
                </div>
              </div>
            )}

            <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
          </button>
        )}
      </div>

      {/* Portals Section */}
      {createPortal(
        <>
          {/* Annotation Mode Portal */}
          <AnimatePresence>
            {isAnnotating && data.imageUrl && (
              <AnnotationModal 
                imageUrl={data.imageUrl}
                onClose={() => setIsAnnotating(false)}
                onSave={(newUrl) => {
                  updateNodeData(id, { imageUrl: newUrl });
                  setIsAnnotating(false);
                }}
              />
            )}
          </AnimatePresence>

          {/* Grid Cropping Modal */}
          <AnimatePresence>
            {isGridCropping && (
              <div 
                className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setIsGridCropping(false); }}
              >
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-xl bg-[#0a0a0a] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl flex flex-col p-8"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <LayoutGrid size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-widest uppercase">宫格裁剪</h3>
                        <p className="text-sm text-gray-500 mt-0.5">将图像均匀切割为多个子节点</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsGridCropping(false)}
                      className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-gray-500 hover:text-white rounded-full transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[4, 9, 16, 25].map((count) => (
                      <button 
                        key={count}
                        onClick={() => handleGridCrop(count)}
                        className="flex items-center justify-between p-5 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] hover:border-blue-500/50 rounded-2xl text-gray-400 hover:text-white transition-all group relative overflow-hidden"
                      >
                        <div className="flex items-center gap-3 relative z-10">
                          <LayoutGrid size={22} className="text-gray-700 group-hover:text-blue-400 transition-colors" />
                          <div className="flex flex-col items-start">
                            <span className="text-lg font-bold">{count} 宫格</span>
                            <span className="text-sm text-gray-600 font-mono tracking-tighter">{Math.sqrt(count)}×{Math.sqrt(count)} 网格</span>
                          </div>
                        </div>
                        <div className="p-1.5 bg-blue-600/10 text-blue-500 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all z-10">
                          <Plus size={16} />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    <button 
                      onClick={() => setIsGridCropping(false)}
                      className="px-6 py-2.5 text-base font-bold text-gray-500 hover:text-white transition-all"
                    >
                       取消
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Manual Cropping Modal */}
          <AnimatePresence>
            {isCropping && (
              <div 
                className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-3xl flex flex-col p-4"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Simplified Header */}
                <div className="flex items-center justify-between px-8 py-6 bg-[#0a0a0a] border border-white/5 rounded-t-[32px]">
                  <div className="flex items-center gap-4">
                    <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
                      <button 
                        onClick={() => { setCropMode('rect'); setPathPoints([]); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${cropMode === 'rect' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                      >
                        <CropIcon size={14} />
                        <span>矩形裁切</span>
                      </button>
                      <button 
                        onClick={() => { setCropMode('path'); setCrop(undefined); setPathPoints([]); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${cropMode === 'path' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                      >
                        <Pen size={14} />
                        <span>套索工具</span>
                      </button>
                    </div>
                    <div className="w-px h-6 bg-white/10 mx-2" />
                    <div className="flex items-center gap-3">
                       <ZoomOut size={14} className="text-gray-500" />
                       <input 
                         type="range" 
                         min="0.5" 
                         max="3" 
                         step="0.1" 
                         value={zoom} 
                         onChange={(e) => setZoom(parseFloat(e.target.value))}
                         className="w-32 accent-blue-600"
                       />
                       <ZoomIn size={14} className="text-gray-500" />
                       <span className="text-sm font-mono text-blue-500 font-bold">{Math.round(zoom * 100)}%</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCropping(false)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-red-500 text-gray-500 hover:text-white rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div 
                  ref={containerRef}
                  className="flex-1 relative bg-[#050505] overflow-auto flex items-center justify-center border-x border-white/5"
                  onWheel={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault();
                      setZoom(prev => Math.min(Math.max(prev - e.deltaY * 0.005, 0.5), 5));
                    }
                  }}
                >
                  <motion.div 
                    style={{ scale: zoom }}
                    className="relative origin-center transition-transform duration-200"
                  >
                    {cropMode === 'path' ? (
                      <div 
                        className="relative group cursor-crosshair" 
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        <img 
                          ref={imgRef}
                          src={data.imageUrl} 
                          alt="Crop Source" 
                          onLoad={onImageLoad}
                          className="max-h-[70vh] object-contain select-none shadow-2xl"
                          draggable={false}
                        />
                        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                          {pathPoints.length > 0 && (
                            <path 
                              d={`M ${(pathPoints[0].x * (imgRef.current?.width || 0)) / 100} ${(pathPoints[0].y * (imgRef.current?.height || 0)) / 100} ${pathPoints.slice(1).map(p => `L ${(p.x * (imgRef.current?.width || 0)) / 100} ${(p.y * (imgRef.current?.height || 0)) / 100}`).join(' ')} ${pathPoints.length > 2 ? 'Z' : ''}`}
                              fill={pathPoints.length > 2 ? "rgba(37, 99, 235, 0.2)" : "none"}
                              stroke="#2563eb"
                              strokeWidth="2"
                              strokeDasharray={pathPoints.length > 2 ? "none" : "4 4"}
                            />
                          )}
                          {pathPoints.map((p, i) => (
                            <circle 
                              key={i}
                              cx={(p.x * (imgRef.current?.width || 0)) / 100}
                              cy={(p.y * (imgRef.current?.height || 0)) / 100}
                              r={4}
                              fill="#2563eb"
                              stroke="white"
                              strokeWidth="1"
                            />
                          ))}
                        </svg>
                        {pathPoints.length > 0 && (
                          <div className="absolute top-4 left-4 bg-blue-600 px-3 py-1.5 rounded-xl text-sm font-bold text-white shadow-xl pointer-events-none">
                            按住并拖动进行手动绘制 ({pathPoints.length})
                          </div>
                        )}
                      </div>
                    ) : (
                      <ReactCrop
                        crop={crop}
                        onChange={c => setCrop(c)}
                        onComplete={c => setCompletedCrop(c)}
                        aspect={aspect}
                        className="max-h-[70vh]"
                      >
                        <img draggable={false} 
                          ref={imgRef}
                          src={data.imageUrl} 
                          alt="Crop Source" 
                          onLoad={onImageLoad}
                          className="max-h-[70vh] object-contain select-none shadow-2xl border border-white/10"
                        />
                      </ReactCrop>
                    )}
                  </motion.div>
                </div>
                
                <div className="px-8 py-6 bg-[#0a0a0a] border border-white/5 rounded-b-[32px] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {cropMode === 'rect' && CROP_ASPECTS.map((opt) => (
                      <button 
                        key={opt.label}
                        onClick={async () => {
                          if (opt.value === 'original') {
                            const img = new Image();
                            img.src = data.imageUrl;
                            await new Promise(res => img.onload = res);
                            setAspect(img.width / img.height);
                          } else {
                            setAspect(opt.value as any);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${aspect === (opt.value === 'original' ? aspect : opt.value) ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {cropMode === 'path' && (
                      <button 
                        onClick={() => setPathPoints([])}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white rounded-xl text-sm font-bold transition-all border border-white/5"
                      >
                        重置点
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setIsCropping(false)} 
                      className="px-6 py-2 text-base font-bold text-gray-500 hover:text-white transition-all"
                    >
                      取消
                    </button>
                    <button 
                      onClick={cropMode === 'rect' ? generateCroppedImage : generatePathCroppedImage} 
                      disabled={cropMode === 'rect' ? !completedCrop : pathPoints.length < 3}
                      className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                      <Check size={18} />
                      <span>应用方案</span>
                    </button>
                  </div>
                </div>
              </div>
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
                onClick={() => setIsFullScreen(false)}
                className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 lg:p-20"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 40 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 40 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative max-w-full max-h-full flex flex-col items-center gap-4"
                >
                  <div className="absolute -top-16 right-0 flex items-center gap-4">
                    <div className="px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-sm font-bold text-white/50 tracking-widest uppercase">全屏预览</div>
                    <button onClick={() => setIsFullScreen(false)} className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-red-500 text-white rounded-full transition-all border border-white/10 shadow-2xl">
                      <X size={20} />
                    </button>
                  </div>
                  <img draggable={false} src={data.imageUrl} alt="Fullscreen" className="max-w-full max-h-[85vh] object-contain shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-3xl border border-white/5" />
                  <div className="flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px]">
                     <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                       <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                       <span className="text-sm font-bold text-white/40 tracking-wider">IMAGE NODE</span>
                     </div>
                     <span className="text-sm font-mono text-white/60">
                       {dimensions ? `${dimensions.width} × ${dimensions.height}` : '...'} PX
                     </span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}

      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
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

/**
 * Utility to crop image
 */
async function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return canvas.toDataURL('image/webp');
}

async function getPathCroppedImg(image: HTMLImageElement, points: { x: number, y: number }[]): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const scaleX = image.naturalWidth / 100;
  const scaleY = image.naturalHeight / 100;

  // Find bounds
  let minX = 100, minY = 100, maxX = 0, maxY = 0;
  points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  const width = (maxX - minX) * scaleX;
  const height = (maxY - minY) * scaleY;
  canvas.width = width;
  canvas.height = height;

  ctx.beginPath();
  ctx.moveTo((points[0].x - minX) * scaleX, (points[0].y - minY) * scaleY);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo((points[i].x - minX) * scaleX, (points[i].y - minY) * scaleY);
  }
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(
    image,
    minX * scaleX,
    minY * scaleY,
    (maxX - minX) * scaleX,
    (maxY - minY) * scaleY,
    0,
    0,
    width,
    height
  );

  return canvas.toDataURL('image/webp');
}

