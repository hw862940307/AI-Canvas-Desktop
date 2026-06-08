import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { NodeResizer, Handle, Position, useViewport } from '@xyflow/react';
import { Monitor, Anchor, ChevronUp, ChevronDown, Maximize2, PinOff, Pin, ExternalLink, RefreshCw, Plus, ArrowLeft, ArrowRight, Home, Settings, Search, Database, Camera, FileText, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'motion/react';

// Help TypeScript understand window.electron / window.ipcRenderer
declare global {
  interface Window {
    electron?: {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (channel: string, func: (...args: any[]) => void) => void;
      }
    };
  }
}

export const BrowserNode = ({ id, data, selected }: any) => {
  const { updateNodeData } = useStore();
  const [url, setUrl] = useState(data.url || 'https://www.pinterest.com');
  const [inputUrl, setInputUrl] = useState(url);
  const [isFolded, setIsFolded] = useState(data.isFolded || false);
  const [isPinned, setIsPinned] = useState(data.isPinned || false);
  const browserId = useRef(`browser_${id}_${Math.random().toString(36).substr(2, 6)}`);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isElectron = typeof window !== 'undefined' && !!window.electron;
  
  const viewport = useViewport();

  const handleNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let finalUrl = inputUrl;
    if (!finalUrl.startsWith('http') && !finalUrl.startsWith('chrome:')) {
      finalUrl = 'https://' + finalUrl;
    }
    setUrl(finalUrl);
    updateNodeData(id, { url: finalUrl });
    
    if (isElectron) {
      window.electron?.ipcRenderer.send('browser-manager-navigate', {
        browserId: browserId.current,
        url: finalUrl
      });
    }
  };

  // Lifecycle & Coordinate Sync Manager
  useEffect(() => {
    if (isElectron) {
      // 1. Create Browser Instance in Main Process
      window.electron?.ipcRenderer.send('browser-manager-create', {
        browserId: browserId.current,
        url: url
      });
      
      // Cleanup on unmount
      return () => {
        window.electron?.ipcRenderer.send('browser-manager-destroy', {
          browserId: browserId.current
        });
      };
    }
  }, []); // Run once on mount

  // Sync Coordinates using RequestAnimationFrame + BoundingClientRect
  // This automatically accounts for Canvas pan, zoom, Node drag, resize etc!
  useLayoutEffect(() => {
    if (!isElectron) return;
    
    let reqId: number;
    let lastBounds = '';
    
    const syncBounds = () => {
      if (containerRef.current && !isFolded && !isPinned) {
        const rect = containerRef.current.getBoundingClientRect();
        
        // Calculate exact bounds taking into account overlay UI height (like the toolbar)
        // Toolbar is exactly ~64px height here. So we offset the view.
        const toolbarHeight = 64; 
        const currentBounds = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}`;
        
        if (currentBounds !== lastBounds && rect.width > 0 && rect.height > 0) {
          lastBounds = currentBounds;
          window.electron?.ipcRenderer.send('browser-manager-bounds', {
            browserId: browserId.current,
            bounds: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            toolbarHeight,
            zoom: viewport.zoom
          });
        }
      } else if (isFolded || isPinned) {
         // Hide the bounds completely if folded or pinned
         window.electron?.ipcRenderer.send('browser-manager-bounds', {
            browserId: browserId.current,
            bounds: { x: -9999, y: -9999, width: 0, height: 0 }
         });
      }
      reqId = requestAnimationFrame(syncBounds);
    };
    
    reqId = requestAnimationFrame(syncBounds);
    return () => cancelAnimationFrame(reqId);
  }, [isElectron, isFolded, isPinned, viewport.zoom]); // React to zoom changes from viewport hook
  
  // Update visibility on selection changes (Overlay Manager logic)
  useEffect(() => {
     if (isElectron) {
        // Send focus/depth signals based on selection
        window.electron?.ipcRenderer.send('browser-manager-focus', {
           browserId: browserId.current,
           focused: selected
        });
     }
  }, [selected, isElectron]);

  const handleAction = (actionType: string) => {
    if (isElectron) {
       window.electron?.ipcRenderer.send(`browser-manager-action`, {
         browserId: browserId.current,
         action: actionType
       });
    }
  };

  return (
    <>
      <NodeResizer minWidth={400} minHeight={300} isVisible={selected && !isFolded && !isPinned} lineClassName="border-blue-500/50" handleClassName="h-3 w-3 bg-white border-2 border-blue-500 rounded-sm" keepAspectRatio={false} />
      <div 
        className={`flex flex-col w-full bg-[var(--bg-secondary)] rounded-2xl border-2 shadow-2xl transition-all ${selected ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-[var(--border)]'}`}
        style={{ height: isFolded ? 'auto' : '100%' }}
      >
        <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] z-50 hover:!scale-150 transition-transform" />
        <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] z-50 hover:!scale-150 transition-transform" />

        {/* Header - Custom Browser Tab look */}
        <div className="bg-black/90 rounded-t-[14px] flex flex-col shrink-0 custom-drag-handle react-flow__node-draghandle cursor-grab active:cursor-grabbing border-b border-white/5">
          <div className="flex items-center justify-between p-2 pb-0">
            <div className="flex items-center gap-2 mt-1 ml-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-sm cursor-pointer hover:bg-red-400" onClick={() => handleAction('close')} />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-sm cursor-pointer hover:bg-yellow-400" onClick={() => setIsFolded(!isFolded)} />
              <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-sm cursor-pointer hover:bg-green-400" onClick={() => setIsPinned(!isPinned)} />
            </div>
            
            <div className="flex flex-1 items-center justify-center pointer-events-none">
              <div className="bg-[#2a2b2e] px-4 py-1.5 rounded-t-lg flex items-center gap-2 min-w-[150px] shadow-[0_-2px_5px_rgba(0,0,0,0.2)] border-t border-x border-white/5">
                <Monitor size={12} className={isElectron ? "text-emerald-400" : "text-blue-400"} />
                <span className="text-[11px] text-gray-300 font-bold uppercase tracking-widest">
                  {isElectron ? 'WebContentsView Host' : 'Web Sandbox Node'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 mr-2 text-gray-500">
              <button className="p-1 hover:bg-white/10 rounded cursor-pointer pointer-events-auto" onClick={() => setIsFolded(!isFolded)} title="Fold Browser">
                {isFolded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
              <button className="p-1 hover:bg-white/10 rounded text-amber-500/80 cursor-pointer pointer-events-auto" onClick={() => setIsPinned(!isPinned)} title="Pin Overlay">
                {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
            </div>
          </div>
          
          {!isFolded && (
             <div className="flex items-center gap-2 p-2 px-3 bg-[#2a2b2e] pointer-events-auto z-10">
               <button onClick={() => handleAction('goBack')} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer">
                 <ArrowLeft size={16} />
               </button>
               <button onClick={() => handleAction('goForward')} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer">
                 <ArrowRight size={16} />
               </button>
               <button onClick={() => handleAction('reload')} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer">
                 <RefreshCw size={14} />
               </button>
               
               <form onSubmit={handleNavigate} className="flex-1 mx-2 relative flex items-center group">
                 <div className="absolute left-3 text-gray-500 flex items-center">
                   <Monitor size={12} />
                 </div>
                 <input 
                   type="text" 
                   value={inputUrl} 
                   onChange={(e) => setInputUrl(e.target.value)}
                   className="w-full bg-[#1a1b1e] text-gray-300 text-[13px] px-8 py-1.5 rounded-full border border-black/50 focus:border-blue-500/50 outline-none font-mono"
                 />
                 <div className="absolute right-2 text-gray-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => window.open(url, '_blank')} className="p-1 hover:text-blue-400 rounded cursor-pointer" title="Open in System Browser">
                      <ExternalLink size={12} />
                    </button>
                 </div>
               </form>

               <button onClick={() => handleAction('openDevTools')} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer" title="Developer Tools">
                 <Settings size={16} />
               </button>
             </div>
          )}
        </div>

        {!isFolded && (
          isPinned ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#202124] rounded-b-[14px]">
               <Anchor size={48} className="text-amber-500 mb-4 animate-[spin_10s_linear_infinite]" />
               <h3 className="text-white font-bold tracking-widest uppercase text-sm">Browser Detached</h3>
               <p className="text-[11px] text-gray-500 mt-2 text-center max-w-[250px] leading-relaxed">
                 The WebContentsView is now pinned relative to the screen, detached from the infinite canvas space.
               </p>
               <button onClick={() => setIsPinned(false)} className="mt-6 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg text-[10px] font-bold font-mono transition-colors border border-amber-500/30 cursor-pointer">
                 RE-ATTACH TO CANVAS
               </button>
            </div>
          ) : (
             <div ref={containerRef} className="flex-1 bg-[#1a1a1a] relative rounded-b-[12px] overflow-hidden nodrag w-full h-full flex flex-col">
               {isElectron ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111]">
                     <Loader2 size={32} className="text-emerald-500 animate-spin mb-4" />
                     <p className="font-mono text-emerald-500/70 text-xs">Waiting for Native WebContentsView Sync...</p>
                  </div>
               ) : (
                 <iframe 
                   src={url}
                   className="w-full h-full border-none bg-white absolute inset-0"
                   sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
                   loading="lazy"
                 />
               )}
               
               {/* Overlay Web Action Menu */}
               <div className="absolute bottom-4 right-4 flex flex-col gap-2 group z-50 pointer-events-none">
                 <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1.5 pointer-events-auto transform translate-y-4 group-hover:translate-y-0 duration-200">
                   <button onClick={() => handleAction('scrapeText')} className="px-3 py-2 bg-[#2a2b2e] hover:bg-[#35363a] text-gray-300 rounded-lg text-[10px] uppercase tracking-wider shadow-xl border border-white/10 flex items-center gap-2 cursor-pointer transition-transform active:scale-95 font-bold">
                     <Database size={12} className="text-indigo-400" />
                     <span>Send to Scrape Node</span>
                   </button>
                   <button onClick={() => handleAction('htmlToText')} className="px-3 py-2 bg-[#2a2b2e] hover:bg-[#35363a] text-gray-300 rounded-lg text-[10px] uppercase tracking-wider shadow-xl border border-white/10 flex items-center gap-2 cursor-pointer transition-transform active:scale-95 font-bold">
                     <FileText size={12} className="text-emerald-400" />
                     <span>Convert to Text</span>
                   </button>
                   <button onClick={() => handleAction('captureScreenshot')} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] uppercase tracking-wider shadow-xl border border-blue-400/50 flex items-center gap-2 cursor-pointer transition-transform active:scale-95 font-bold">
                     <Camera size={12} />
                     <span>Screenshot to Canvas</span>
                   </button>
                 </div>
                 {/* Trigger hint area to make hover easier */}
                 <div className="w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white backdrop-blur-md self-end transition-all border border-white/10 pointer-events-auto hover:bg-blue-600 hover:border-blue-400/50 hover:shadow-[0_0_15px_rgba(37,99,235,0.5)] cursor-pointer">
                    <Plus size={16} />
                 </div>
               </div>
            </div>
          )
        )}
      </div>
    </>
  );
};
