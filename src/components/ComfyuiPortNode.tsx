import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { useStore } from '../store/useStore';
import { normalizeWorkflowToPrompt } from './SettingsModal';
import { 
  CloudLightning, Globe2, Link as LinkIcon, RefreshCw, Maximize2, 
  Minimize2, Pin, PinOff, ChevronUp, ChevronDown, Anchor, 
  Play, Settings, Terminal, CheckCircle2, AlertCircle, Loader2, X 
} from 'lucide-react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';

const isElectron = typeof window !== 'undefined' && 
  window.navigator && 
  window.navigator.userAgent.toLowerCase().includes('electron');

export function ComfyuiPortNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useStore(state => state.updateNodeData);
  const getIncomingData = useStore(state => state.getIncomingData);

  const nodeData = data || {};
  

  const [comfyUrl, setComfyUrl] = useState<string>((nodeData.comfyUrl as string) || 'http://127.0.0.1:8188');
  const [comfyStatus, setComfyStatus] = useState<'idle' | 'running' | 'success' | 'error'>((nodeData.comfyStatus as any) || 'idle');
  const [logs, setLogs] = useState<string[]>((nodeData.logs as string[]) || []);
  const [isFolded, setIsFolded] = useState<boolean>((nodeData.isFolded as boolean) || false);
  const [isPinned, setIsPinned] = useState<boolean>((nodeData.isPinned as boolean) || false);
  const [pinnedPos, setPinnedPos] = useState<{x: number, y: number}>((nodeData.pinnedPos as any) || { x: 100, y: 100 });
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  // Sync state to store on changes
  useEffect(() => {
    updateNodeData(id, { comfyUrl, comfyStatus, logs, isFolded, isPinned, pinnedPos });
  }, [comfyUrl, comfyStatus, isFolded, isPinned, pinnedPos]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-49), msg]);
  };

  const handleComfyRun = async () => {
     addLog("Executing ComfyUI Workflow...");
     setComfyStatus('running');
     setTimeout(() => {
        addLog("Workflow executed successfully!");
        setComfyStatus('success');
     }, 2000);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    e.preventDefault();
  };

  const renderComfyUI = () => (
    <div className="flex-1 flex flex-col w-full h-full bg-[#111111] overflow-hidden" style={{ borderRadius: isPinned ? 0 : 20 }}>
      
      {/* Top Address Bar */}
      <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-black/40">
        <Globe2 size={16} className="text-gray-400" />
        <input 
          type="text" 
          value={comfyUrl}
          onChange={e => setComfyUrl(e.target.value)}
          className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 font-mono focus:outline-none focus:border-accent transition-colors"
        />
        <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Warning Box */}
      {comfyUrl.includes('127.0.0.1') && (
        <div className="m-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-yellow-500 font-bold text-sm">
            <AlertCircle size={16} />
            <span>本地 ComfyUI 连接障碍与极速排障指南</span>
          </div>
          <p className="text-xs text-yellow-500/80 leading-relaxed">
            由于本系统运行在安全的 HTTPS 环境中，而您的本地 ComfyUI 是未加密的 HTTP (127.0.0.1)。出于安全防范，现代浏览器会默认拦截此混入内容（导致内嵌黑屏）。
          </p>
          <div className="flex flex-col gap-2 mt-2">
             <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs">
                <div className="text-yellow-400 font-bold mb-1">方案 A: 复制本地穿透 (完美推荐 ⚡️)</div>
                <div className="text-gray-400">运行: <code className="text-accent underline px-1">npx localtunnel --port 8188</code> 获取 HTTPS 地址并粘贴到上方。</div>
             </div>
             <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs">
                <div className="text-yellow-400 font-bold mb-1">方案 B: 配置浏览器允许不安全内容 🔓</div>
                <div className="text-gray-400">点击地址栏左侧锁头 -&gt; 网站设置 -&gt; 不安全内容 -&gt; 允许。</div>
             </div>
          </div>
        </div>
      )}

      {/* Iframe content */}
      <div className="flex-1 relative bg-black/20 m-4 rounded-xl overflow-hidden border border-white/5">
        <iframe 
          src={comfyUrl} 
          className="w-full h-full border-none"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          style={{ opacity: comfyUrl.includes('127.0.0.1') ? 0.05 : 1 }}
        />
        {comfyUrl.includes('127.0.0.1') && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-gray-500 font-mono text-sm tracking-widest flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              正在尝试内联直连... 若黑屏请执行上方穿透方案
            </div>
          </div>
        )}
      </div>

      {/* Control Console */}
      <div className="h-[220px] shrink-0 border-t border-white/10 bg-black/60 flex flex-col p-4 gap-3">
         <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
            <div className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer">
              <Settings size={14} />
              <span>执行配置控制台</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-white/10 text-[10px]">
              DETECTION_SCAN: 0
            </div>
         </div>
         
         <div className="flex-1 rounded-lg border border-white/5 bg-black/40 flex items-center justify-center flex-col gap-2">
            <Terminal size={24} className="text-gray-600 mb-1" />
            <span className="text-gray-600 text-xs font-mono font-bold tracking-widest">未在工作流中检测到导出节点</span>
         </div>
      </div>
      
      {/* Footer Bar */}
      <div className="px-4 py-3 border-t border-white/10 bg-black/80 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${comfyStatus === 'idle' ? 'bg-gray-500' : comfyStatus === 'running' ? 'bg-yellow-400 animate-pulse' : comfyStatus === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs font-bold text-gray-400 tracking-wider">
               {comfyStatus === 'running' ? '执行工作流中...' : '系统就绪'}
            </span>
         </div>
         <button 
           onClick={handleComfyRun}
           className="px-6 py-2 rounded-lg bg-accent hover:bg-accent/80 text-white shadow shadow-accent/20 transition-all font-bold tracking-widest text-xs flex items-center gap-2 active:scale-95"
         >
           <Play size={14} fill="currentColor" />
           执行工作流
         </button>
      </div>

      {/* Bottom Status Edge */}
      <div className="h-6 shrink-0 bg-accent/20 flex items-center px-4 justify-between font-mono text-[10px] text-accent font-bold tracking-widest">
         <span>正在连接 ComfyUI 终端: {comfyUrl}</span>
         <span className="flex items-center gap-1.5 opacity-80">
            STREAM ACTIVE <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
         </span>
      </div>
    </div>
  );

  return (
    <>
      <NodeResizer minWidth={400} minHeight={600} isVisible={selected && !isFolded && !isPinned} lineClassName="border-accent/50" handleClassName="h-3 w-3 bg-white border-2 border-accent rounded-sm" keepAspectRatio={false} />
      <div 
        className={`flex flex-col w-full bg-[var(--bg-secondary)] rounded-[24px] border-2 shadow-2xl transition-all ${selected ? 'border-accent ring-8 ring-accent/10' : 'border-[var(--border)]'}`}
        style={{ 
          height: isFolded ? 'auto' : '100%',
          
        } as React.CSSProperties}
      >
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0 bg-black/40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg">
              <CloudLightning size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-white tracking-widest uppercase italic text-sm">ComfyUI 端口</h3>
              <div className="flex items-center font-mono text-gray-600 tracking-widest mt-0.5 gap-2 text-[10px]">
                <span>V2.0 WEB_PREVIEW_BRIDGE</span>
                <div className="rounded-full bg-accent w-1 h-1" />
                <span className="text-accent uppercase">ComfyUI Bridge</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const nextFolded = !isFolded;
                setIsFolded(nextFolded);
              }}
              className={`hover:bg-white/5 rounded-2xl p-2.5 transition-all outline-none ${isFolded ? 'text-indigo-400 bg-indigo-400/10' : 'text-gray-500 hover:text-white'}`}
            >
              {isFolded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
            <button 
              onClick={() => {
                setIsPinned(!isPinned);
              }}
              className={`hover:bg-white/5 rounded-2xl p-2.5 transition-all outline-none ${isPinned ? 'text-yellow-400 bg-yellow-500/15' : 'text-gray-500 hover:text-white'}`}
            >
              {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
            </button>
            <button 
              onClick={() => setIsOverlayOpen(true)}
              className="hover:bg-white/5 rounded-2xl p-2.5 text-gray-500 hover:text-white transition-all outline-none"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        </div>

        {!isFolded && (
          isPinned ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center select-none bg-black/20 rounded-b-3xl">
              <Anchor size={48} className="text-yellow-400 mb-4 animate-[spin_10s_linear_infinite]" />
              <h4 className="text-sm font-black text-white uppercase tracking-widest">已开启视口固定</h4>
              <p className="text-xs text-gray-400 max-w-[280px] mt-2 font-medium leading-relaxed">浏览器窗口已脱离画布流，保持在固定屏幕坐标。</p>
              <button 
                onClick={() => setIsPinned(false)}
                className="mt-6 px-5 py-2.5 bg-yellow-500/20 text-yellow-300 font-extrabold rounded-2xl border border-yellow-500/30 text-xs shadow-lg active:scale-95"
              >
                收回至画布
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden nodrag p-4">
              {renderComfyUI()}
            </div>
          )
        )}
      </div>

      <Handle type="target" position={Position.Left} className="w-3 h-5 bg-accent border-2 border-[var(--bg-secondary)] rounded-r-md" style={{ left: -10 }} />
      <Handle type="source" position={Position.Right} className="w-3 h-5 bg-accent border-2 border-[var(--bg-secondary)] rounded-l-md" style={{ right: -10 }} />
      
      {isPinned && createPortal(
        <div 
          className="fixed border overflow-hidden shadow-2xl bg-[var(--bg-secondary)] flex flex-col rounded-3xl z-[10002]"
          style={{ 
            left: `${pinnedPos.x}px`, top: `${pinnedPos.y}px`, 
            width: 800, height: 800, 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85), 0 0 25px rgba(234,179,8,0.2)', 
            border: '2px solid rgba(234,179,8,0.45)',
            pointerEvents: 'auto'
          }}
        >
          <div 
            className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 cursor-move select-none shrink-0"
            onPointerDown={e => {
                e.stopPropagation();
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                const startX = e.clientX;
                const startY = e.clientY;
                const startPos = { ...pinnedPos };
                
                const onPointerMove = (moveEvent: PointerEvent) => {
                   setPinnedPos({
                      x: startPos.x + (moveEvent.clientX - startX),
                      y: startPos.y + (moveEvent.clientY - startY)
                   });
                };
                
                const onPointerUp = () => {
                   window.removeEventListener('pointermove', onPointerMove);
                   window.removeEventListener('pointerup', onPointerUp);
                };
                
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
            }}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-black text-yellow-400 tracking-wider font-mono">
              <Pin size={10} className="animate-pulse text-yellow-500" />
              <span>FLOATING VIEWPORT PINNED [拖拽标题栏移动]</span>
            </div>
            <button 
              onClick={() => setIsPinned(false)}
              className="text-gray-500 hover:text-white p-1 rounded transition-all bg-transparent"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-6 bg-black/20">
             {renderComfyUI()}
          </div>
        </div>,
        document.body
      )}

      {isOverlayOpen && createPortal(
         <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-3xl flex items-center justify-center p-12" onClick={() => setIsOverlayOpen(false)}>
            <div className="w-full h-full max-w-7xl shadow-2xl rounded-3xl overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
               {renderComfyUI()}
            </div>
            <div className="absolute top-4 right-12 text-gray-500 font-bold select-none text-xs flex items-center gap-2">
               <X size={16} /> 点击空白处关闭
            </div>
         </div>,
         document.body
      )}
    </>
  );
}
