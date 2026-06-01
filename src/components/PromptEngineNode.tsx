import React, { useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Cpu, Play, Loader2, X, Settings2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateTextWithFallback } from '../lib/gemini';
import { ScaleWrapper } from './ScaleWrapper';

const PRESETS = [
  { id: 'background', name: '产品背景更换', prompt: '分析此产品图像，并建议一个专业的电影级背景提示词。' },
  { id: 'dna', name: 'DNA 提取', prompt: '从该图像中提取关键视觉元素（颜色、风格、构图）作为文本 DNA。' },
  { id: 'enhance', name: '提示词增强', prompt: '将以下原始提示词扩展为详细的高质量 AI 图像提示词。' },
  { id: 'angle', name: '角度控制', prompt: '为该产品生成一个角度控制提示词。使用水平/垂直角度参数描述一个新的透视角度。' },
];

export const PromptEngineNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const { updateNodeData, removeNode, getIncomingData, settings } = useStore();
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    const incoming = getIncomingData(id);
    const context = incoming.map(d => d.text || d.output || d.imageUrl || '').join('\n');

    setLoading(true);
    try {
      const selectedPreset = PRESETS.find(p => p.id === (data.preset || 'enhance'));
      const systemPrompt = selectedPreset?.prompt || '';
      
      const resultText = await generateTextWithFallback(`Input Context: ${context || data.inputContext || 'No context provided.'}`, systemPrompt);
      updateNodeData(id, { output: resultText });
    } catch (error) {
      console.error('Prompt Engine failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative group w-full h-full border ${selected ? 'border-[var(--accent)] shadow-[0_0_20px_var(--accent)]/30' : 'border-[var(--border)]'} rounded-2xl shadow-2xl transition-all flex flex-col ${
      settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
    }`}>
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected} 
        minWidth={260}
        minHeight={280}
        keepAspectRatio={true}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '2px solid var(--accent)' }}
      />
      <ScaleWrapper id={id} type="prompt-engine">
        <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] transition-all react-flow__node-draghandle ${
          settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-purple-500/10'
        } rounded-t-2xl`}>
          <div className="flex items-center gap-2 text-[1em] font-bold text-purple-400 uppercase tracking-wider">
            <Cpu size={14} />
            <span>提示词引擎</span>
          </div>
          <button 
            onClick={() => removeNode(id)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-[var(--text-secondary)] hover:text-red-400"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 nodrag">
          <div className="flex flex-col gap-2">
            <label className="text-[0.75em] uppercase font-bold text-[var(--text-secondary)] tracking-widest">框架 / 预设</label>
            <div className="grid grid-cols-1 gap-1.5 font-sans">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => updateNodeData(id, { preset: preset.id })}
                  className={`text-left px-3 py-2 rounded-xl text-[0.85em] transition-all ${
                    data.preset === preset.id 
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                      : 'bg-black/40 text-[var(--text-secondary)] hover:bg-black/60 border border-transparent hover:border-purple-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{preset.name}</span>
                    {data.preset === preset.id && <Settings2 size={10} />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[0.75em] uppercase font-bold text-[var(--text-secondary)] tracking-widest">引擎输出结果</label>
            <div className="bg-black/40 border border-[var(--border)] rounded-xl p-3 text-[0.85em] text-[var(--text-primary)] min-h-[100px] max-h-[180px] overflow-y-auto whitespace-pre-wrap font-mono custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[100px] gap-2 text-[var(--text-secondary)] italic">
                  <Loader2 size={20} className="animate-spin text-purple-500" />
                  <span className="text-[0.75em] uppercase tracking-widest font-bold">处理中...</span>
                </div>
              ) : data.output || '结果将在此显示...'}
            </div>
          </div>

          <button 
            onClick={handleRun}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-purple-600/20 text-[0.9em]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            <span>运行引擎</span>
          </button>
        </div>
      </ScaleWrapper>

      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none"  />
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none"  />
    </div>
  );
};
