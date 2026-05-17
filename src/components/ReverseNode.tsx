import React, { useState, useMemo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { ScanSearch, Play, Loader2, Copy, Check, Info, Zap, Terminal, Maximize2, Minimize2, X } from 'lucide-react';
import { useStore, useNodeIncomingData } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { generateTextWithFallback } from '../lib/gemini';

export function ReverseNode({ id, data, selected }: NodeProps) {
  const nodeData = data as any;

  const { updateNodeData, getIncomingData } = useStore();
  const incomingData = useNodeIncomingData(id);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  
  const incomingImages = useMemo(() => {
    const imgs = incomingData.filter(d => d && (d.imageUrl || d.url || d.images)).flatMap(d => d.images || [d.imageUrl || d.url]);
    if (nodeData.imageUrl) {
      imgs.unshift(nodeData.imageUrl);
    }
    return imgs.filter(img => typeof img === 'string') as string[];
  }, [incomingData, nodeData.imageUrl]);

  const outputText = nodeData.outputText || '';
  const systemPrompt = nodeData.systemPrompt || '你是一个专业 AI 视觉反推提示词引擎。请严格根据输入图片与上游文本进行图像反推...';
  const instruction = nodeData.instruction || '请根据连接的图片节点，生成高质量中文反推提示词。输出包含：画面解析、正向提示词、反向提示词、最终可执行提示词。';

  const handleRun = async () => {
    if (running || !incomingImages.length) return;
    setRunning(true);
    try {
      const contents: any[] = [];
      const fullPrompt = `Objective: ${instruction}`;
      contents.push({ text: fullPrompt });

      // Add last image as reference for now, or all if model supports
      for (const imgUrl of incomingImages.slice(-3)) {
        if (imgUrl.startsWith('data:')) {
          contents.push({
            inlineData: {
              mimeType: "image/png",
              data: imgUrl.split(',')[1]
            }
          });
        }
      }

      const resultText = await generateTextWithFallback(contents, systemPrompt);
      updateNodeData(id, { outputText: resultText });
    } catch (e) {
      console.error('Reverse analysis failed:', e);
      updateNodeData(id, { outputText: `执行失败: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ReverseContent = (isPortal = false) => (
    <div className={`flex flex-col bg-[#0c1016] border border-white/10 overflow-hidden ${isPortal ? 'w-[90vw] h-[85vh] rounded-[32px] shadow-2xl' : 'flex-1 rounded-2xl'}`}>
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40 shrink-0 react-flow__node-draghandle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-600/20 relative overflow-hidden group">
            <ScanSearch size={20} className="text-white z-10" />
            <motion.div 
               animate={running ? { y: [0, 40, 0] } : {}}
               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
               className="absolute inset-x-0 h-1 bg-white/40 blur-sm z-0"
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight uppercase">提示词实验室 (LAB)</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-500 tracking-widest uppercase">PROMPT REVERSE V2</span>
              <div className={`w-1 h-1 rounded-full ${running ? 'bg-cyan-400 animate-pulse' : 'bg-cyan-900'} shadow-[0_0_5px_cyan]`} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsOverlayOpen(!isPortal)} className="p-2 text-gray-500 hover:text-white transition-all">
            {isPortal ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {isPortal && (
            <button onClick={() => setIsOverlayOpen(false)} className="p-2 text-red-500/50 hover:text-red-500 ml-1">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col gap-5 p-6 overflow-hidden nodrag ${isPortal ? 'grid grid-cols-2' : ''}`}>
        <div className="space-y-4 flex flex-col">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-600 uppercase tracking-[0.2em] flex items-center gap-1.5">
                 <Terminal size={10} /> Logic Processor
              </label>
              <textarea 
                className="w-full h-24 bg-black border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-500 outline-none focus:border-cyan-500/30 resize-none font-mono custom-scrollbar"
                value={systemPrompt}
                onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black text-gray-600 uppercase tracking-[0.2em] flex items-center gap-1.5">
                 <Zap size={10} /> Objective Path
              </label>
              <textarea 
                className="w-full h-24 bg-black border border-white/5 rounded-xl px-4 py-3 text-sm text-white/80 outline-none focus:border-cyan-500/30 resize-none font-mono custom-scrollbar"
                value={instruction}
                onChange={(e) => updateNodeData(id, { instruction: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-white/2 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
             {running && (
               <motion.div 
                 initial={{ left: '-100%' }}
                 animate={{ left: '100%' }}
                 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                 className="absolute inset-y-0 w-40 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent skew-x-12"
               />
             )}
             <div className="flex items-center justify-between z-10">
                <span className="text-sm text-gray-500 font-black uppercase tracking-widest">Active Data: {incomingImages.length} Layers</span>
                {incomingImages.length > 0 && <div className="flex -space-x-3">
                  {incomingImages.slice(0, 8).map((img, i) => (
                    <motion.img 
                      key={i} 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      src={img} 
                      className="w-8 h-8 rounded-xl border-2 border-[#0c1016] object-cover shadow-2xl" 
                      alt="" 
                    />
                  ))}
                </div>}
             </div>
             {!incomingImages.length && <p className="text-sm text-red-500/50 italic font-mono z-10 uppercase tracking-tighter">{'> awaiting image broadcast signal...'}</p>}
          </div>

          <button 
            onClick={handleRun}
            disabled={running || !incomingImages.length}
            className={`w-full h-14 rounded-2xl font-black text-base tracking-[0.4em] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] border border-white/5 uppercase ${
              running 
                ? 'bg-white/5 text-gray-600 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
            }`}
          >
            {running ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
            {running ? 'Computing...' : 'Start Synthesis'}
          </button>
        </div>

        <div className={`relative group rounded-2xl overflow-hidden border border-white/5 bg-black ${isPortal ? 'h-full' : 'h-44'}`}>
          {running && (
             <div className="absolute inset-0 z-10 bg-cyan-500/5 backdrop-blur-[2px] flex items-center justify-center">
                <div className="flex gap-2">
                   {[0, 1, 2].map(i => (
                     <motion.div 
                       key={i}
                       animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                       transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                       className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_cyan]"
                     />
                   ))}
                </div>
             </div>
          )}
          <textarea 
            className="w-full h-full bg-transparent p-5 text-base text-cyan-400/90 font-mono leading-relaxed outline-none resize-none custom-scrollbar pr-10"
            value={outputText}
            readOnly
            placeholder="> Analysis engine standby..."
          />
          <button 
            onClick={handleCopy}
            disabled={!outputText}
            className="absolute top-4 right-4 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 disabled:hidden z-20"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      <div className="px-6 py-3 bg-black border-t border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
           <div className={`w-1.5 h-1.5 rounded-full ${incomingImages.length ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]' : 'bg-red-500'} animate-pulse`} />
           <span className="text-sm text-gray-600 font-bold uppercase tracking-[0.3em]">Module Status: {incomingImages.length ? 'Online' : 'Disconnected'}</span>
        </div>
        <span className="text-sm text-gray-700 font-mono italic tracking-widest uppercase opacity-40">RT_CORE_X.9</span>
      </div>
    </div>
  );

  return (
    <>
      <NodeResizer minWidth={300} minHeight={400} isVisible={selected} lineClassName="border-cyan-500/50" handleClassName="h-3 w-3 bg-white border-2 border-cyan-500 rounded-sm" />
      <div className={`flex flex-col w-full h-full bg-[#0c1016] rounded-3xl border-2 border-white/10 overflow-hidden shadow-2xl transition-all ${selected ? 'border-cyan-500 ring-8 ring-cyan-500/10' : ''}`}>
        <Handle type="target" position={Position.Left} className="!bg-cyan-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
        <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />

        {ReverseContent(false)}
      </div>

      {isOverlayOpen && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-12 bg-black/85 backdrop-blur-3xl" onPointerDown={e => e.stopPropagation()}>
           <motion.div 
             initial={{ opacity: 0, scale: 0.9, y: 40 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.9, y: 40 }}
             className="w-full h-full"
           >
              {ReverseContent(true)}
           </motion.div>
           <div className="absolute inset-0 -z-10" onClick={() => setIsOverlayOpen(false)} />
        </div>,
        document.body
      )}
    </>
  );
}
