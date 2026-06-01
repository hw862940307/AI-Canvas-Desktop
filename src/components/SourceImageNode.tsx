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
  Pencil,
  Crop as CropIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnnotationModal } from './AnnotationModal';
import { downloadImage } from '../lib/download';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { ScaleWrapper } from './ScaleWrapper';

const CROP_ASPECTS = [
  { label: '自由比例', value: undefined },
  { label: '原图比例', value: 'original' },
  { label: '1:1', value: 1 / 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '21:9', value: 21 / 9 },
];

export const SourceImageNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const { updateNodeData, addNode, settings, nodes, setNodes } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropMode, setCropMode] = useState<'rect' | 'grid'>('rect');
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 100,
    height: 100,
    x: 0,
    y: 0
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [gridCols, setGridCols] = useState(2);
  const [gridRows, setGridRows] = useState(2);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Resize when original dimensions are provided (e.g. from global paste / drag drops)
  useEffect(() => {
    if (data.originalWidth && data.originalHeight && data.url) {
      const maxWidth = 400; // Optimal card base width to adapt to the canvas
      const ratio = data.originalWidth / data.originalHeight;
      const width = Math.min(data.originalWidth, maxWidth);
      
      const targetH = Math.round(width / ratio);
      
      const updatedNodes = nodes.map(n => {
        if (n.id === id) {
          return {
            ...n,
            style: {
              ...(n.style || {}),
              width,
              height: targetH
            },
            data: {
              ...n.data,
              width,
              height: targetH,
              aspectRatio: ratio,
              originalWidth: undefined,
              originalHeight: undefined
            }
          };
        }
        return n;
      });
      setNodes(updatedNodes);
    }
  }, [data.originalWidth, data.originalHeight, data.url, id, nodes, setNodes]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setDimensions({ width: naturalWidth, height: naturalHeight });

    // Intelligently resize node style directly in the store to fit the natural aspect ratio
    if (naturalWidth && naturalHeight) {
      const ratio = naturalWidth / naturalHeight;
      const currentNode = nodes.find(n => n.id === id);
      if (currentNode) {
        // Fallback to active style width, or measured width, or base width (300)
        const currentW = currentNode.style?.width 
          ? (typeof currentNode.style.width === 'number' ? currentNode.style.width : parseInt(currentNode.style.width as string, 10))
          : (currentNode.measured?.width || 300);

        // Precise layout height formula:
        // No header inside the node once loading image, no padding as well (p-0).
        const targetH = Math.round(currentW / ratio);

        const currentH = currentNode.style?.height
          ? (typeof currentNode.style.height === 'number' ? currentNode.style.height : parseInt(currentNode.style.height as string, 10))
          : 0;

        if (Math.abs(currentH - targetH) > 2 || !currentNode.style?.width) {
          const updatedNodes = nodes.map(n => {
            if (n.id === id) {
              return {
                ...n,
                style: {
                  ...(n.style || {}),
                  width: currentW,
                  height: targetH
                },
                data: {
                  ...n.data,
                  width: currentW,
                  height: targetH,
                  aspectRatio: ratio
                }
              };
            }
            return n;
          });
          setNodes(updatedNodes);
        }
      }
    }
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
          
          const targetH = Math.round(displayWidth / ratio);
          
          updateNodeData(id, { 
            url: finalUrl,
            name: file.name,
            aspectRatio: ratio,
            width: displayWidth,
            height: targetH
          });

          // Also update the physical style dimensions of the node directly for instant layout match
          const updatedNodes = nodes.map(n => {
            if (n.id === id) {
              return {
                ...n,
                style: {
                  ...(n.style || {}),
                  width: displayWidth,
                  height: targetH
                }
              };
            }
            return n;
          });
          setNodes(updatedNodes);
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
    updateNodeData(id, { url: null, width: 300, height: 350 });
    const updatedNodes = nodes.map(n => {
      if (n.id === id) {
        return {
          ...n,
          style: {
            ...(n.style || {}),
            width: 300,
            height: 350
          }
        };
      }
      return n;
    });
    setNodes(updatedNodes);
  };

  const getCroppedImg = useCallback((image: HTMLImageElement, pixelCrop: PixelCrop): string => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = Math.floor(pixelCrop.width * scaleX);
    canvas.height = Math.floor(pixelCrop.height * scaleY);
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    ctx.drawImage(
      image,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return canvas.toDataURL('image/png', 1.0);
  }, []);

  const handleGridCrop = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    
    const sliceWidth = img.naturalWidth / gridCols;
    const sliceHeight = img.naturalHeight / gridRows;

    const baseData = { ...data };
    
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const canvas = document.createElement('canvas');
        canvas.width = sliceWidth;
        canvas.height = sliceHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            img,
            c * sliceWidth,
            r * sliceHeight,
            sliceWidth,
            sliceHeight,
            0,
            0,
            sliceWidth,
            sliceHeight
          );
          
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          
          addNode('image-source', window.innerWidth / 2 + (c * 250) - 200, window.innerHeight / 2 + (r * 250) - 200, {
             ...baseData,
             url: dataUrl
          });
        }
      }
    }
    
    setIsCropping(false);
  };

  const currentRatio = data.aspectRatio || (data.width && data.height ? data.width / data.height : 1.0);
  const nodeMinWidth = data.url ? 60 : 150;
  const nodeMinHeight = data.url ? Math.round(60 / currentRatio) : 150;

  return (
    <div 
      onDragEnter={(e) => handleDragEnter(e)}
      onDragOver={(e) => handleDragOver(e)}
      onDragLeave={(e) => handleDragLeave(e)}
      onDrop={(e) => handleDrop(e)}
      className={`relative border w-full h-full ${selected ? 'border-[var(--accent)] shadow-[0_0_20px_var(--accent)]/30' : 'border-[var(--border)]'} rounded-3xl overflow-visible shadow-2xl transition-all flex flex-col pointer-events-auto h-full ${
        isDragOver ? 'border-[var(--accent)] ring-4 ring-[var(--accent)]/10' : ''
      } ${
        data.url ? 'bg-transparent' : (settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]')
      }`}
    >
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected} 
        minWidth={nodeMinWidth}
        minHeight={nodeMinHeight}
        keepAspectRatio={true}
        handleStyle={{ width: 12, height: 12, borderRadius: '50%', background: 'white', border: '2px solid var(--accent)', zIndex: 100 }}
      />

      {/* Floating Header Tag at the top-left (outside ScaleWrapper, so it doesn't scale / stays sharp and clean) */}
      {data.url && (
        <div className="absolute left-0 -top-[32px] flex items-center gap-1.5 bg-[#0d0d0d]/95 backdrop-blur-md border border-[var(--border)] rounded-xl py-1 px-2.5 shadow-xl z-[150] pointer-events-none whitespace-nowrap text-zinc-300">
          <ImageIcon size={12} className="text-green-400 shrink-0" />
          <span className="text-[11px] font-bold truncate max-w-[150px]">{data.name || "源图像"}</span>
        </div>
      )}

      {/* Floating Toolbar above the node (stretching dynamic width matching the node, outside ScaleWrapper, so it doesn't scale / stays sharp and clean) */}
      <AnimatePresence>
        {selected && data.url && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-0 right-0 -top-[64px] h-14 flex items-center justify-between px-4 bg-[#0d0d0d]/95 backdrop-blur-md border border-[var(--border)] rounded-2xl shadow-2xl z-[200] text-zinc-400 gap-4 nodrag"
          >
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsAnnotating(true); }}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer pointer-events-auto"
                title="标注模式"
              >
                <Pencil size={24} />
              </button>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsCropping(true); setCropMode('rect'); }}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer pointer-events-auto"
                title="裁剪模式"
              >
                <CropIcon size={24} />
              </button>
              <div className="w-px h-5 bg-[var(--border)] mx-1" />
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsFullScreen(true); }}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer pointer-events-auto"
                title="全屏显示"
              >
                <Maximize2 size={24} />
              </button>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); data.url && downloadImage(data.url, `${data.name || 'image'}.png`); }}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer pointer-events-auto"
                title="下载"
              >
                <Download size={24} />
              </button>
            </div>
            {dimensions && (
              <span className="text-[11px] font-mono font-bold text-zinc-500 select-none tracking-wider pr-1 truncate">
                {dimensions.width} × {dimensions.height} PX
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      <ScaleWrapper id={id} type="image-source" baseWidth={data.width || 300} baseHeight={data.height || 350} disableDynamicHeight={true}>
        {/* Header - only show when NO image URL is set */}
        {!data.url && (
          <div className={`p-3 border-b border-[var(--border)] flex items-center justify-between transition-all rounded-t-3xl shrink-0 react-flow__node-draghandle ${
            settings.barTexture === 'frosted' ? 'frosted-glass border-b-white/5' : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
                <ImageIcon size={18} />
              </div>
              <span className="text-sm font-bold tracking-wider text-[var(--text-primary)] truncate max-w-[124px] md:max-w-[180px]">{data.name || "源图像"}</span>
            </div>
          </div>
        )}

        <div className={`relative w-full flex-1 flex flex-col min-h-0 ${data.url ? 'p-0 pb-0' : 'p-5'}`}>
          {/* Main content body with exact visual framing and dashed border */}
          <div 
            className={`w-full flex-1 overflow-hidden flex flex-col items-center justify-center relative ${
              data.url 
                ? 'bg-transparent h-full' 
                : 'rounded-[18px] border-2 border-dashed border-[var(--border)] hover:border-green-500/50 cursor-pointer bg-[var(--bg-primary)]/24 flex flex-col items-center justify-center gap-3 p-6 min-h-[200px] nodrag'
            }`}
            onClick={(e) => {
              if (!data.url) {
                e.stopPropagation();
                fileInputRef.current?.click();
              }
            }}
          >
            {data.url ? (
              <div className="w-full h-full relative group/img-container flex items-center justify-center">
                <img 
                  draggable={false} 
                  src={data.url} 
                  alt={data.name || "Source Asset"} 
                  onLoad={onImageLoad} 
                  ref={imgRef} 
                  className="w-full h-full object-fill select-none pointer-events-none rounded-3xl" 
                />
                <button 
                  type="button"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    e.preventDefault();
                    clearImage(); 
                  }}
                  className="absolute top-3 right-3 p-2 bg-black/90 hover:bg-red-600 text-white rounded-xl transition-all shadow-lg border border-white/10 z-[100] cursor-pointer pointer-events-auto nodrag"
                  title="删除图片"
                >
                  <X size={16} />
                </button>
                <button 
                  type="button"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    e.preventDefault();
                    fileInputRef.current?.click(); 
                  }}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 py-1.5 px-3 bg-[#0d0d0d]/90 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-bold rounded-xl transition-all border border-white/10 shadow-lg z-[100] cursor-pointer pointer-events-auto nodrag"
                  title="重新上传"
                >
                  <Upload size={13} strokeWidth={2.5} className="shrink-0" />
                  <span>上传</span>
                </button>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 animate-pulse">
                  <Upload size={18} />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm font-bold text-[var(--text-primary)] tracking-wide">上传或拖入图片</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5 font-mono">PNG, JPG, WEBP</span>
                </div>
              </>
            )}

            {/* Drop Overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-green-500/10 backdrop-blur-[1px] pointer-events-none z-50 flex items-center justify-center rounded-[16px]">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-2xl animate-bounce text-white">
                  <Upload size={22} />
                </div>
              </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
              onClick={(e) => {
                e.stopPropagation();
                (e.target as HTMLInputElement).value = '';
              }}
            />
          </div>
        </div>

      {/* Portals Section */}
      {createPortal(
        <>
          {/* Crop Mode Portal */}
          <AnimatePresence>
            {isCropping && data.url && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onPointerDown={(e) => e.stopPropagation()}
                className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 overflow-hidden"
              >
                <div className="absolute top-6 left-6 flex items-center gap-4 z-20 bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-[var(--border)]">
                  <button
                    onClick={() => setCropMode('rect')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${cropMode === 'rect' ? 'bg-[var(--accent)] text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  >
                    标准裁剪
                  </button>
                  <button
                    onClick={() => setCropMode('grid')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${cropMode === 'grid' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  >
                    多宫格裁剪
                  </button>
                </div>

                <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
                  <button 
                    onClick={() => setIsCropping(false)} 
                    className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-red-500 text-white rounded-2xl transition-all border border-[var(--border)] shadow-2xl"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 w-full flex items-center justify-center relative min-h-0 bg-transparent py-10">
                  {cropMode === 'rect' ? (
                    <div className="relative inline-block max-h-full max-w-full shadow-2xl">
                      <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={aspect}
                        ruleOfThirds
                      >
                        <img 
                          ref={imgRef}
                          src={data.url} 
                          alt="Crop target" 
                          style={{ display: 'block', maxWidth: '90vw', maxHeight: '70vh', width: 'auto', height: 'auto' }}
                          crossOrigin="anonymous"
                        />
                      </ReactCrop>
                    </div>
                  ) : (
                    <div className="relative inline-block max-h-full max-w-full rounded-2xl overflow-hidden shadow-2xl">
                      <img 
                        ref={imgRef}
                        src={data.url} 
                        alt="Grid Crop target" 
                        style={{ display: 'block', maxWidth: '90vw', maxHeight: '70vh', width: 'auto', height: 'auto' }}
                      />
                      <div className="absolute inset-0 right-0 bottom-0 top-0 left-0 border-2 border-purple-500 pointer-events-none" style={{
                         display: 'grid',
                         gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
                         gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`
                      }}>
                          {Array.from({ length: gridRows * gridCols }).map((_, i) => (
                             <div key={i} className="border border-purple-500/50 bg-purple-500/10 flex items-center justify-center backdrop-blur-[1px]">
                                <span className="text-white/50 font-black text-2xl drop-shadow-md">{i + 1}</span>
                             </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {cropMode === 'rect' ? (
                  <div className="mt-4 flex items-center gap-6 shrink-0 bg-white/5 backdrop-blur-xl p-4 rounded-3xl border border-[var(--border)] shadow-2xl">
                    <div className="flex bg-black/40 rounded-xl p-1 gap-1">
                      {CROP_ASPECTS.map(a => {
                         const currentSelectedVal = a.value === 'original' && dimensions ? dimensions.width / dimensions.height : a.value;
                         const isSelected = aspect === currentSelectedVal;
                         return (
                           <button
                             key={a.label}
                             onClick={() => setAspect(currentSelectedVal as number | undefined)}
                             className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                               isSelected
                                 ? 'bg-[var(--accent)] text-white shadow-lg'
                                 : 'text-gray-400 hover:text-white hover:bg-white/10'
                             }`}
                           >
                             {a.label}
                           </button>
                         );
                      })}
                    </div>

                    <button
                      onClick={() => {
                         if (completedCrop && imgRef.current) {
                            try {
                              const croppedImageUrl = getCroppedImg(imgRef.current, completedCrop);
                              const currentNode = nodes.find(n => n.id === id);
                               const currentX = currentNode?.position?.x ?? 100;
                               const currentY = currentNode?.position?.y ?? 100;
                               
                               const baseData = { ...data };
                               delete baseData.width;
                               delete baseData.height;
                               delete baseData.aspectRatio;
                               
                               const newName = data.name ? `${data.name}_已裁剪` : "已裁剪图像";
                               
                               addNode('image-source', currentX + 50, currentY + 50, {
                                 ...baseData,
                                 name: newName,
                                 url: croppedImageUrl
                               });
                              setIsCropping(false);
                            } catch (e) {
                              console.error(e);
                            }
                         }
                      }}
                      disabled={!completedCrop?.width || !completedCrop?.height}
                      className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 uppercase tracking-wider"
                    >
                      <Check size={18} />
                      确认裁剪
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-6 shrink-0 bg-white/5 backdrop-blur-xl p-4 rounded-3xl border border-[var(--border)] shadow-2xl">
                    <div className="flex items-center gap-4 text-white">
                       <label className="flex items-center gap-3 font-bold text-gray-300">
                          宫格划分:
                          <select 
                            value={`${gridCols}x${gridRows}`}
                            onChange={(e) => {
                               const [c, r] = e.target.value.split('x').map(Number);
                               setGridCols(c);
                               setGridRows(r);
                            }}
                            className="bg-black border border-white/20 rounded-xl px-4 py-2 hover:border-purple-500/50 focus:border-purple-500 focus:outline-none transition-all cursor-pointer font-mono"
                          >
                             <option value="2x2">2 × 2 (四宫格)</option>
                             <option value="3x3">3 × 3 (九宫格)</option>
                             <option value="1x2">1 × 2 (上下切片)</option>
                             <option value="2x1">2 × 1 (左右切片)</option>
                             <option value="1x3">1 × 3 (重直三切)</option>
                             <option value="3x1">3 × 1 (水平三切)</option>
                             <option value="2x3">2 × 3</option>
                             <option value="3x2">3 × 2</option>
                             <option value="4x4">4 × 4</option>
                          </select>
                       </label>
                    </div>
                    
                    <button
                      onClick={handleGridCrop}
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 uppercase tracking-wider disabled:opacity-50"
                    >
                      <CropIcon size={18} />
                      执行宫格切片并生成新节点
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

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
                  <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md rounded-2xl border border-[var(--border)] p-1.5 px-3">
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
                    className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-red-500 text-white rounded-2xl transition-all border border-[var(--border)] shadow-2xl"
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
                      className="max-w-[90vw] max-h-[85vh] object-contain shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-3xl border border-[var(--border)] select-none pointer-events-none" 
                    />
                  </motion.div>
                </div>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl border border-[var(--border)] rounded-[24px] z-20">
                   <div className="flex items-center gap-2 pr-4 border-r border-[var(--border)]">
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
      </ScaleWrapper>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="!bg-green-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:scale-110 hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white before:content-['+'] before:text-lg before:leading-none"  
      />
    </div>
  );
};

const ToolbarIconButton = ({ icon, onClick, title, disabled = false }: { icon: React.ReactNode, onClick?: () => void, title?: string, disabled?: boolean }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
    disabled={disabled}
    title={title}
    className="p-2.5 hover:bg-[var(--border)] text-gray-500 hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {icon}
  </button>
);

