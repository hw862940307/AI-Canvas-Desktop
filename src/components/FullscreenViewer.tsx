import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Crop, Maximize, Puzzle, Sidebar, Square, SplitSquareHorizontal, Layers, Eraser, Brush, Component } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [showEscHint, setShowEscHint] = useState(true);

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
    
    // Hide ESC hint after 3 seconds
    const timer = setTimeout(() => setShowEscHint(false), 3000);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [images.length, onClose]);

  // Reset zoom on index change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setBaseDim({ w: 0, h: 0 }); // reset dimension so it recalculates on load
  }, [currentIndex]);

  const handleWheel = (e: React.WheelEvent) => {
    setScale(prev => Math.max(0.1, Math.min(20, prev - e.deltaY * 0.005)));
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

  return (
    <div 
      className="fullscreen-viewer-active absolute inset-0 z-[2000] bg-[#1a1a1a] flex flex-col items-center justify-center overflow-hidden touch-none select-none"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute top-0 left-0 right-0 h-[48px] flex items-center justify-between px-4 z-[2010] bg-[#1d1d1d] border-b border-[#2a2a2a] select-none text-[#a0a0a0]">
         <div className="flex items-center gap-4 w-1/3">
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 hover:text-white rounded-md transition-colors" title="退出全屏 (Esc)">
              <ArrowLeft size={18} strokeWidth={1.5} />
            </button>
            <div className="font-sans text-[13px] tracking-wide text-[#a0a0a0] min-w-[80px]">{currentIndex + 1} / {images.length}</div>
         </div>

         {/* Center placeholder tools identical to Figure 1 */}
         <div className="flex items-center justify-center gap-1.5 w-1/3 text-[#808080]">
            {[Component, Layers, SplitSquareHorizontal, Eraser, Brush, Puzzle].map((Icon, i) => (
              <button key={i} className="p-1.5 hover:bg-white/10 hover:text-white rounded transition-colors flex items-center justify-center">
                <Icon size={16} strokeWidth={1.5} />
              </button>
            ))}
         </div>

         <div className="flex items-center justify-end gap-3 w-1/3">
            {/* The right side icons from Figure 1 */}
            <div className="flex items-center gap-1 mr-4">
               {[Puzzle, Sidebar, Crop, Square, Maximize].map((Icon, i) => (
                 <button key={'r'+i} className="p-1.5 hover:bg-white/10 hover:text-white rounded transition-colors flex items-center justify-center">
                   <Icon size={16} strokeWidth={1.5} />
                 </button>
               ))}
            </div>

            <div className="flex items-center gap-0.5 border-l border-[#3a3a3a] pl-3">
              <button 
                onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))}
                className="w-7 h-7 flex items-center justify-center hover:bg-white/10 hover:text-white rounded transition-colors"
                title="上一张 (Left Arrow)"
              >
                <ChevronLeft size={20} strokeWidth={1.5} />
              </button>
              <button 
                onClick={() => setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))}
                className="w-7 h-7 flex items-center justify-center hover:bg-white/10 hover:text-white rounded transition-colors"
                title="下一张 (Right Arrow)"
              >
                <ChevronRight size={20} strokeWidth={1.5} />
              </button>
            </div>
         </div>
      </div>
      
      {/* Esc Hint Toast matching Figure 3 */}
      <AnimatePresence>
        {showEscHint && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-[60px] left-4 z-[2010] bg-black/80 backdrop-blur text-[#d0d0d0] border border-white/10 shadow-lg px-3 py-1.5 rounded-md text-sm font-sans flex items-center gap-2 pointer-events-none"
          >
            离开 <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded border border-white/20 font-mono">ESC</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full h-full flex items-center justify-center pt-[52px]">
        <img 
          src={currentImage.url} 
          alt={currentImage.name}
          onLoad={(e) => setBaseDim({ w: e.currentTarget.clientWidth, h: e.currentTarget.clientHeight })}
          className="max-w-[100vw] max-h-[calc(100vh-52px)] object-contain origin-center cursor-grab active:cursor-grabbing pointer-events-auto"
          draggable={false}
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
          onMouseDown={handleMouseDown}
        />
      </div>

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
    </div>
  );
};
