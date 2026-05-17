import React, { useState, useMemo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CloudLightning, Zap, Loader2, Maximize2, Settings2, Sparkles, Layers } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';

const MS_MODELS = [
  { id: 'zimage', label: 'ZImage Turbo', desc: 'Real-time 1step SDXL' },
  { id: 'flux_klein', label: 'FLUX Klein', desc: 'Ultra Detail / Realism' },
  { id: 'qwen_vl', label: 'Qwen VL Edit', desc: 'Visual Intent Editing' }
];

export function MsGenNode({ id, data, selected }: NodeProps) {
  const { updateNodeData, getIncomingData } = useStore();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [model, setModel] = useState(data.model || 'zimage');

  const incomingPrompts = useMemo(() => {
    return getIncomingData(id).filter(d => d.text || d.prompt || d.outputText).map(d => d.text || d.prompt || d.outputText);
  }, [id, getIncomingData]);

  const handleGenerate = () => {
    if (running || !incomingPrompts.length) return;
    setRunning(true);
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setRunning(false);
        setProgress(0);
      }
      setProgress(p);
    }, 200);
  };

  return (
    <div className={`flex flex-col w-[380px] bg-[#0c1016] rounded-3xl border-2 border-white/10 overflow-hidden shadow-2xl transition-all ${selected ? 'border-yellow-500 ring-8 ring-yellow-500/10 scale-[1.01]' : ''}`}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-yellow-500" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-yellow-500" />

      {/* Header */}
      <div className={`p-4 border-b border-white/5 flex items-center justify-between bg-black/40 shrink-0 react-flow__node-draghandle`}>
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
            <h3 className="text-sm font-bold text-white tracking-tight uppercase italic">ModelScope</h3>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-gray-500 tracking-[0.2em] uppercase">Cloud Generator</span>
              {running && <div className="w-1 h-1 rounded-full bg-yellow-500 animate-ping" />}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 nodrag">
        {/* Model Selector */}
        <div className="flex flex-col gap-2">
           <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1 flex items-center gap-2">
              <Layers size={10} /> Select Engine
           </label>
           <div className="grid grid-cols-1 gap-2">
             {MS_MODELS.map(m => (
               <button 
                 key={m.id}
                 onClick={() => { setModel(m.id); updateNodeData(id, { model: m.id }); }}
                 className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all group ${
                   model === m.id 
                    ? 'border-yellow-500 bg-yellow-500/5 shadow-inner shadow-yellow-500/10' 
                    : 'border-white/5 bg-white/2 hover:border-white/20'
                 }`}
               >
                 <div className="text-left">
                    <p className={`text-[11px] font-black uppercase ${model === m.id ? 'text-yellow-500' : 'text-gray-400 group-hover:text-gray-200'}`}>{m.label}</p>
                    <p className="text-[9px] text-gray-600 font-medium italic">{m.desc}</p>
                 </div>
                 {model === m.id && <Sparkles size={12} className="text-yellow-500" />}
               </button>
             ))}
           </div>
        </div>

        {/* Input Scope */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
             <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                <Zap size={10} /> Context
             </label>
             <span className={`text-[9px] font-bold ${incomingPrompts.length ? 'text-green-500' : 'text-yellow-500/50'}`}>
                {incomingPrompts.length ? 'SYNCED' : 'WAITING'}
             </span>
          </div>
          <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 min-h-[80px] flex items-center justify-center relative overflow-hidden group">
             {incomingPrompts.length > 0 ? (
               <p className="text-[11px] text-gray-400 font-medium leading-relaxed line-clamp-3 text-center italic">
                 "{incomingPrompts[0]}"
               </p>
             ) : (
               <div className="flex flex-col items-center gap-2 opacity-30">
                  <span className="text-[10px] font-mono tracking-widest uppercase">Null Input</span>
               </div>
             )}
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none" />
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-3">
          <button 
            onClick={handleGenerate}
            disabled={running || !incomingPrompts.length}
            className={`w-full h-14 rounded-2xl font-black text-[13px] tracking-[0.4em] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] border border-white/10 ${
              running 
                ? 'bg-transparent text-gray-600 cursor-not-allowed' 
                : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-950/20'
            }`}
          >
            {running ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} fill="currentColor" />}
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
                    <span className="text-[9px] font-bold text-yellow-500/50 uppercase tracking-widest">Processing...</span>
                    <span className="text-[9px] font-mono text-yellow-500">{Math.round(progress)}%</span>
                 </div>
                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
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

      <div className="px-5 py-3 bg-black/40 border-t border-white/5 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-2 text-gray-600">
            <Settings2 size={12} />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Ready to Task</span>
         </div>
         <div className="flex items-center gap-3">
            {['S', 'M', 'L'].map(v => (
              <span key={v} className="text-[9px] font-bold text-gray-700 hover:text-white cursor-pointer px-1">{v}</span>
            ))}
         </div>
      </div>
    </div>
  );
}
