import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Brain, Play, Loader2, X, Terminal, Code2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateTextWithFallback } from '../lib/gemini';

const LOGIC_PRESETS = [
  { id: 'analyzer', name: '深度逻辑分析', prompt: '对输入内容进行多维度逻辑分析，指出潜在矛盾与优化点。' },
  { id: 'math', name: '数学/公式 推导', prompt: '将输入的问题转化为数学模型或代码逻辑，并给出推导过程。' },
  { id: 'decision', name: '智能决策树', prompt: '根据输入的条件给出最优决策路径和原因分析。' },
  { id: 'abstract', name: '核心逻辑抽取', prompt: '从复杂业务描述中抽取出核心逻辑算法原型。' },
];

export const LogicEngineNode = ({ id, data }: { id: string; data: any }) => {
  const { updateNodeData, removeNode, getIncomingData, settings } = useStore();
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    const incoming = getIncomingData(id);
    const context = incoming.map(d => JSON.stringify(d)).join('\n');

    setLoading(true);
    try {
      const selectedPreset = LOGIC_PRESETS.find(p => p.id === (data.preset || 'analyzer'));
      const systemPrompt = selectedPreset?.prompt || '';
      
      const resultText = await generateTextWithFallback(
        `[LOGIC ENGINE MODE]\n\nInputs:\n${context || data.input || 'No input data.'}`, 
        systemPrompt
      );
      updateNodeData(id, { output: resultText });
    } catch (error) {
      console.error('Logic Engine failed:', error);
      updateNodeData(id, { output: `执行失败: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative group min-w-[320px] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl transition-all ${
      settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[#0f1115]'
    }`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] transition-all react-flow__node-draghandle ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-blue-500/10'
      }`}>
        <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest">
          <Brain size={14} />
          <span>逻辑引擎</span>
        </div>
        <button 
          onClick={() => removeNode(id)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-500 hover:text-red-400"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 nodrag">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-1.5">
            <Terminal size={10} /> 逻辑预设
          </label>
          <div className="flex flex-wrap gap-2">
            {LOGIC_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => updateNodeData(id, { preset: preset.id })}
                className={`px-3 py-1.5 rounded-lg text-[10px] transition-all border ${
                  data.preset === preset.id 
                    ? 'bg-blue-600 border-blue-500 text-white font-bold' 
                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-1.5">
            <Code2 size={10} /> 推理结果
          </label>
          <div className="bg-black/60 border border-white/5 rounded-xl p-3 text-[11px] text-gray-300 min-h-[120px] max-h-[220px] overflow-y-auto whitespace-pre-wrap font-mono custom-scrollbar leading-relaxed">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-3 text-blue-500/50 italic">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-[9px] uppercase tracking-[0.2em] font-bold">深度推理中...</span>
              </div>
            ) : data.output || '等待输入并运行...'}
          </div>
        </div>

        <button 
          onClick={handleRun}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 group"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="group-hover:scale-110 transition-transform" />}
          <span>启动逻辑链</span>
        </button>
      </div>

      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
    </div>
  );
};
