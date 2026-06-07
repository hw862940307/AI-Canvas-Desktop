import React, { useState, useMemo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { CloudLightning, Zap, Loader2, Settings2, Sparkles, Layers } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { generateTextWithFallback } from '../lib/gemini';
import { ScaleWrapper } from './ScaleWrapper';

const MS_MODELS = [
  { id: 'zimage', label: 'ZImage Turbo', desc: 'Real-time 1step SDXL' },
  { id: 'flux_klein', label: 'FLUX Klein', desc: 'Ultra Detail / Realism' },
  { id: 'qwen_vl', label: 'Qwen VL Edit', desc: 'Visual Intent Editing' }
];

export function MsGenNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useStore((s) => s.updateNodeData);
  const getIncomingData = useStore((s) => s.getIncomingData);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [model, setModel] = useState(data.model || 'zimage');

  const incomingPrompts = useMemo(() => {
    return getIncomingData(id).filter(d => d.text || d.prompt || d.outputText).map(d => d.text || d.prompt || d.outputText);
  }, [id, getIncomingData]);

  const handleGenerate = async () => {
    if (running || !incomingPrompts.length) return;
    setRunning(true);
    setProgress(10);
    
    try {
      setProgress(40);
      const prompt = `[ModelScope ${model} Engine]\nInstruction: Generate a visual intent breakdown and enhanced generation prompt based on the following input.\n\nInput Context: ${incomingPrompts[0]}`;
      
      const text = await generateTextWithFallback(prompt);
      setProgress(85);
      
      updateNodeData(id, { output: text, lastResult: text });
      setProgress(100);
      setTimeout(() => {
        setRunning(false);
        setProgress(0);
      }, 500);
    } catch (error) {
      console.error('MsGen failed:', error);
      updateNodeData(id, { output: '执行失败' });
      setRunning(false);
      setProgress(0);
    }
  };

  return (
    <div className={`flex flex-col w-full h-full bg-[var(--bg-secondary)] rounded-3xl border-2 ${selected ? 'border-yellow-500 ring-8 ring-yellow-500/10' : 'border-[var(--border)]'} shadow-2xl transition-all relative`}>
      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  />
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  />

      <NodeResizer 
        color="#eab308" 
        isVisible={selected} 
        minWidth={280}
        minHeight={300}
        keepAspectRatio={true}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '2px solid #eab308' }}
      />

      <ScaleWrapper id={id} type="ms-gen">
        {/* Header */}
        <div className={`p-4 border-b border-[var(--border)] flex items-center justify-between bg-black/40 shrink-0 react-flow__node-draghandle rounded-t-2xl`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-600/20 text-white relative">
              <CloudLightning size={20} className="z-10" />
              <motion.div 
                 animate={{ opacity: [0.3, 0.6, 0.3] }}
                 transition={{ duration: 2, repeat: Infinity }}
                 className="absolute inset-0 bg-white/20 blur-md rounded-full"
              />
            </div>
            <div>
              <h3 className="text-[1.1em] font-bold text-white tracking-tight uppercase italic">ModelScope</h3>
              <div className="flex items-center gap-2">
                <span className="text-[0.65em] font-mono text-gray-400 tracking-[0.2em] uppercase">Cloud Generator</span>
                {running && <div className="w-1 h-1 rounded-full bg-yellow-500 animate-ping" />}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 nodrag flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Model Selector */}
            <div className="flex flex-col gap-2">
               <label className="text-[0.75em] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Layers size={10} /> Select Engine
               </label>
               <div className="grid grid-cols-1 gap-2 font-sans">
                 {MS_MODELS.map(m => (
                   <button 
                     key={m.id}
                     onClick={() => { setModel(m.id); updateNodeData(id, { model: m.id }); }}
                     className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 transition-all group ${
                       model === m.id 
                        ? 'border-yellow-500 bg-yellow-500/5 shadow-inner shadow-yellow-500/10' 
                        : 'border-[var(--border)] bg-white/2 hover:border-white/20'
                     }`}
                   >
                     <div className="text-left">
                        <p className={`text-[0.8em] font-black uppercase ${model === m.id ? 'text-yellow-500' : 'text-gray-400 group-hover:text-gray-200'}`}>{m.label}</p>
                        <p className="text-[0.65em] text-gray-500 font-medium italic">{m.desc}</p>
                     </div>
                     {model === m.id && <Sparkles size={11} className="text-yellow-500" />}
                   </button>
                 ))}
               </div>
            </div>

            {/* Input Scope */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                 <label className="text-[0.75em] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Zap size={10} /> Context
                 </label>
                 <span className={`text-[0.65em] font-bold ${incomingPrompts.length ? 'text-green-500' : 'text-yellow-500/50'}`}>
                    {incomingPrompts.length ? 'SYNCED' : 'WAITING'}
                 </span>
              </div>
              <div className="w-full bg-black/40 border border-[var(--border)] rounded-2xl p-4 min-h-[80px] flex items-center justify-center relative overflow-hidden group">
                 {incomingPrompts.length > 0 ? (
                   <p className="text-[0.8em] text-gray-400 font-medium leading-relaxed line-clamp-3 text-center italic">
                     "{incomingPrompts[0]}"
                   </p>
                 ) : (
                   <div className="flex flex-col items-center gap-2 opacity-30">
                      <span className="text-[0.75em] font-mono tracking-widest uppercase">Null Input</span>
                   </div>
                 )}
                 <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Action Button & Progress */}
          <div className="space-y-3">
            <button 
              onClick={handleGenerate}
              disabled={running || !incomingPrompts.length}
              className={`w-full h-12 rounded-2xl font-black text-[0.7em] tracking-[0.4em] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] border border-[var(--border)] ${
                running 
                  ? 'bg-transparent text-gray-600 cursor-not-allowed' 
                  : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-950/20'
              }`}
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} fill="currentColor" />}
              {running ? 'GEN_IN_PROGRESS' : 'START_GENERATION'}
            </button>

            {/* Progress Bar */}
            <AnimatePresence>
              {running && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5"
                >
                   <div className="flex justify-between px-1">
                      <span className="text-[0.7em] font-bold text-yellow-500/50 uppercase tracking-widest">Processing...</span>
                      <span className="text-[0.7em] font-mono text-yellow-500">{Math.round(progress)}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-[var(--border)]">
                      <motion.div 
                         className="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                         style={{ width: `${progress}%` }}
                      />
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="px-5 py-3 bg-black/40 border-t border-[var(--border)] flex items-center justify-between shrink-0 font-sans">
           <div className="flex items-center gap-2 text-gray-500">
              <Settings2 size={12} />
              <span className="text-[0.65em] font-black uppercase tracking-[0.2em]">Ready to Task</span>
           </div>
           <div className="flex items-center gap-3">
              {['S', 'M', 'L'].map(v => (
                <span key={v} className="text-[0.65em] font-bold text-gray-500 hover:text-white cursor-pointer px-1">{v}</span>
              ))}
           </div>
        </div>
      </ScaleWrapper>
    </div>
  );
}
