import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { createPortal } from 'react-dom';

interface FullscreenViewerProps {
  images: any[];
  initialIndex: number;
  onClose: () => void;
}

export const FullscreenViewer: React.FC<FullscreenViewerProps> = ({ images, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [baseDim, setBaseDim] = useState({ w: 0, h: 0 });
  const [windowDim, setWindowDim] = useState({ w: window.innerWidth, h: window.innerHeight });

  const currentImage = images[currentIndex] || images[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
      if (e.key === 'ArrowRight') setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    const handleResize = () => setWindowDim({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [images.length, onClose]);

  // Reset zoom on index change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setBaseDim({ w: 0, h: 0 }); // reset dimension so it recalculates on load
  }, [currentIndex]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.altKey || e.ctrlKey || true) { // Also allow normal scroll to zoom exactly like the image if wanted, actually wait, they requested alt+scroll previously but here they say "支持滑动缩放大小", normal wheel is fine or just alt. Let's keep it easy with alt or normal? They didn't say alt this time. Let's support normal wheel for zooming if it's fullscreen! It's an image viewer.
      setScale(prev => Math.max(0.1, Math.min(20, prev - e.deltaY * 0.005)));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (!currentImage) return null;

  const showMinimap = scale > 1;

  // Minimap logic
  const minimapMaxW = 200;
  const minimapMaxH = 150;
  let minimapW = minimapMaxW;
  let minimapH = minimapMaxH;

  if (baseDim.w > 0 && baseDim.h > 0) {
    const ratio = baseDim.w / baseDim.h;
    if (ratio > minimapMaxW / minimapMaxH) {
      minimapH = minimapMaxW / ratio;
    } else {
      minimapW = minimapMaxH * ratio;
    }
  }

  const boxW = Math.min(100, (windowDim.w / ((baseDim.w * scale) || 1)) * 100);
  const boxH = Math.min(100, (windowDim.h / ((baseDim.h * scale) || 1)) * 100);
  const leftOff = (-position.x / scale / (baseDim.w || 1)) * 100;
  const topOff = (-position.y / scale / (baseDim.h || 1)) * 100;

  return createPortal(
    <div 
      className="fixed inset-0 z-[2000] bg-[#1a1a1a]/95 flex flex-col items-center justify-center overflow-hidden touch-none"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header matching Figure 1 */}
      <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-[2010] bg-black/40 backdrop-blur-sm border-b border-white/5">
         <div className="flex items-center gap-6 text-gray-300">
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg hover:text-white transition-colors" title="退出全屏 (Esc)">
              <ArrowLeft size={18} />
            </button>
            <div className="font-mono text-sm tracking-widest w-16 text-center -ml-2">{currentIndex + 1} / {images.length}</div>
            
            <div className="flex items-center gap-4">
              <input 
                type="range"
                min="0.1"
                max="5"
                step="0.01"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-48 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:bg-white/30 transition-colors [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
              <div className="font-mono text-sm tracking-wider w-12 text-right text-gray-400">{Math.round(scale * 100)}%</div>
            </div>
         </div>

         <div className="flex items-center gap-2 text-gray-400">
            <button 
              onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))}
              className="p-2 hover:bg-white/10 rounded-lg hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))}
              className="p-2 hover:bg-white/10 rounded-lg hover:text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
         </div>
      </div>

      <img 
        src={currentImage.url} 
        alt={currentImage.name}
        onLoad={(e) => setBaseDim({ w: e.currentTarget.clientWidth, h: e.currentTarget.clientHeight })}
        className="max-w-[95vw] max-h-[95vh] origin-center cursor-grab active:cursor-grabbing select-none pointer-events-auto shadow-2xl"
        draggable={false}
        style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
        onMouseDown={handleMouseDown}
      />

      {/* Minimap matching Figure 2 */}
      {showMinimap && baseDim.w > 0 && (
         <div className="absolute bottom-6 right-6 z-[2010] bg-black/60 p-1 border border-white/10 shadow-2xl overflow-hidden rounded backdrop-blur-md pointer-events-none">
            <div style={{ width: minimapW, height: minimapH }} className="relative bg-black/80">
              <img 
                src={currentImage.url} 
                className="w-full h-full object-fill opacity-40 grayscale-[20%]"
                alt="minimap"
              />
              <div 
                 className="absolute border-[1.5px] border-white/80 bg-white/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
                 style={{
                    width: `${boxW}%`,
                    height: `${boxH}%`,
                    left: `calc(50% - ${boxW / 2}% + ${leftOff}%)`,
                    top: `calc(50% - ${boxH / 2}% + ${topOff}%)`,
                 }}
              />
            </div>
         </div>
      )}
    </div>,
    document.body
  );
};
