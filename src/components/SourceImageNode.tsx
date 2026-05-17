import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useStore } from '../store/useStore';
import { 
  Image as ImageIcon, 
  Upload, 
  Maximize2, 
  X, 
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
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { motion, AnimatePresence } from 'motion/react';
import { AnnotationModal } from './AnnotationModal';

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

export const SourceImageNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const { updateNodeData, addNode, settings } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [isCropping, setIsCropping] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isGridCropping, setIsGridCropping] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
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

  const generateCroppedImage = async () => {
    try {
      if (!imgRef.current || !completedCrop) return;
      
      const croppedImage = await getCroppedImg(imgRef.current, completedCrop);
      // Find current node to place new node nearby
      const currentNode = useStore.getState().nodes.find(n => n.id === id);
      const x = currentNode ? currentNode.position.x + 350 : window.innerWidth / 2;
      const y = currentNode ? currentNode.position.y : window.innerHeight / 2;
      
      const ratio = completedCrop.width / completedCrop.height;
      const width = Math.min(completedCrop.width, 400);
      const imageHeight = width / ratio;

      addNode('image-source', x, y, { 
        url: croppedImage,
        aspectRatio: ratio,
        width,
        height: imageHeight + 150
      });
      setIsCropping(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGridCrop = async (count: number) => {
    const gridSize = Math.sqrt(count);
    const img = new Image();
    img.src = data.url;
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
    const nodeWidth = 400;
    const nodeHeight = (nodeWidth / ratio) + 150;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        ctx.clearRect(0, 0, tileW, tileH);
        ctx.drawImage(img, col * tileW, row * tileH, tileW, tileH, 0, 0, tileW, tileH);
        const tileUrl = canvas.toDataURL('image/webp');
        addNode('image-source', startX + col * 350, startY + row * 280, { 
          url: tileUrl,
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
    
    // Optimization: only add point if it's far enough from the last point
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
      
      addNode('image-source', x, y, { 
        url: croppedImage,
        width: 400,
        height: 480,
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
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/reactflow', JSON.stringify({ 
          type: 'image-source',
          url: data.url,
          id: id 
        }));
        e.dataTransfer.effectAllowed = 'copyMove';
      }}
      onDragEnter={(e) => handleDragEnter(e)}
      onDragOver={(e) => handleDragOver(e)}
      onDragLeave={(e) => handleDragLeave(e)}
      onDrop={(e) => handleDrop(e)}
      className={`relative border ${selected ? 'border-[var(--accent)] shadow-[0_0_20px_var(--accent)]/30' : 'border-[var(--border)]'} rounded-3xl overflow-visible shadow-2xl transition-all flex flex-col pointer-events-auto ${
        isDragOver ? 'border-blue-500 ring-4 ring-blue-500/10' : ''
      } ${
        settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
      }`}
      style={{ width: data.width || 400, height: data.height || 400 }}
    >
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected} 
        minWidth={200}
        minHeight={200}
        keepAspectRatio={true}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '2px solid #3b82f6' }}
        onResize={(_, { width, height }) => {
          updateNodeData(id, { width, height });
        }}
      />
      {/* Floating Toolbar */}
      <AnimatePresence>
        {selected && data.url && !isCropping && !isGridCropping && (
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
            <ToolbarIconButton icon={<ImageIcon size={16} />} title="属性" />
            <ToolbarIconButton icon={<Pencil size={16} />} onClick={() => setIsAnnotating(true)} title="标注模式" />
            <ToolbarIconButton icon={<MoreHorizontal size={16} />} title="更多" />
            <div className="w-px h-4 bg-[var(--border)] mx-1" />
            <ToolbarIconButton icon={<LayoutGrid size={16} />} onClick={() => setIsGridCropping(true)} title="宫格裁剪" />
            <ToolbarIconButton icon={<CropIcon size={16} />} onClick={() => { setIsCropping(true); setCropMode('rect'); }} title="裁剪" />
            <ToolbarIconButton icon={<Maximize2 size={16} />} onClick={() => setIsFullScreen(true)} title="全屏显示" />
            <ToolbarIconButton icon={<Download size={16} />} title="下载" />
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
          <span className="text-xs font-bold tracking-wider text-[var(--text-primary)]">源图像</span>
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
              <img src={data.url} alt="Source" className="w-full h-full object-contain" />
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
                <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">上传图片</span>
                <span className="text-[10px] text-[var(--text-secondary)]/50 mt-1">PNG, JPG, WEBP</span>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] rounded-lg text-xs text-[var(--text-secondary)] font-bold border border-[var(--border)] transition-all"
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
                        <h3 className="text-sm font-bold text-white tracking-widest uppercase">宫格裁剪</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">将源图像均匀切割为多个子节点</p>
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
                            <span className="text-sm font-bold">{count} 宫格</span>
                            <span className="text-[10px] text-gray-600 font-mono tracking-tighter">{Math.sqrt(count)}×{Math.sqrt(count)} 网格</span>
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
                      className="px-6 py-2.5 text-xs font-bold text-gray-500 hover:text-white transition-all"
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
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold transition-all ${cropMode === 'rect' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                      >
                        <CropIcon size={14} />
                        <span>矩形裁切</span>
                      </button>
                      <button 
                        onClick={() => { setCropMode('path'); setCrop(undefined); setPathPoints([]); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold transition-all ${cropMode === 'path' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
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
                       <span className="text-[10px] font-mono text-blue-500 font-bold">{Math.round(zoom * 100)}%</span>
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
                          src={data.url} 
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
                          <div className="absolute top-4 left-4 bg-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white shadow-xl pointer-events-none">
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
                        <img 
                          ref={imgRef}
                          src={data.url} 
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
                            img.src = data.url;
                            await new Promise(res => img.onload = res);
                            setAspect(img.width / img.height);
                          } else {
                            setAspect(opt.value as any);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${aspect === (opt.value === 'original' ? aspect : opt.value) ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {cropMode === 'path' && (
                      <button 
                        onClick={() => setPathPoints([])}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white rounded-xl text-[10px] font-bold transition-all border border-white/5"
                      >
                        重置点
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setIsCropping(false)} 
                      className="px-6 py-2 text-xs font-bold text-gray-500 hover:text-white transition-all"
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
                    <span className="text-white/80 font-mono text-sm min-w-[60px] text-center">
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
                    <img 
                      src={data.url} 
                      alt="Fullscreen" 
                      className="max-w-[90vw] max-h-[85vh] object-contain shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-3xl border border-white/5 select-none pointer-events-none" 
                    />
                  </motion.div>
                </div>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] z-20">
                   <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                     <span className="text-[10px] font-bold text-white/40 tracking-wider">SOURCE ASSET</span>
                   </div>
                   <span className="text-[10px] font-mono text-white/60">
                     {dimensions ? `${dimensions.width} × ${dimensions.height}` : '...'} PX
                   </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500 border-2 border-[#111]" />
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

