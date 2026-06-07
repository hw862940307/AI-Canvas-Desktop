import React, { useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Brain, Play, Loader2, X, Terminal, Code2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateTextWithFallback } from '../lib/gemini';
import { ScaleWrapper } from './ScaleWrapper';

const LOGIC_PRESETS = [
  { id: 'analyzer', name: '深度逻辑分析', prompt: '对输入内容进行多维度逻辑分析，指出潜在矛盾与优化点。' },
  { id: 'math', name: '数学/公式 推导', prompt: '将输入的问题转化为数学模型或代码逻辑，并给出推导过程。' },
  { id: 'decision', name: '智能决策树', prompt: '根据输入的条件给出最优决策路径 and 原因分析。' },
  { id: 'abstract', name: '核心逻辑抽取', prompt: '从复杂业务描述中抽取出核心逻辑算法原型。' },
];

export const LogicEngineNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const updateNodeData = useStore((s) => s.updateNodeData);
  const removeNode = useStore((s) => s.removeNode);
  const getIncomingData = useStore((s) => s.getIncomingData);
  const settings = useStore((s) => s.settings);
  const [loading, setLoading] = useState(false);

  const [localInput, setLocalInput] = useState(data.input || '');
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastPushedTextRef = React.useRef(data.input || '');

  React.useEffect(() => {
    if (data.input !== localInput && data.input !== lastPushedTextRef.current) {
      setLocalInput(data.input || '');
      lastPushedTextRef.current = data.input || '';
    }
  }, [data.input]);

  const handleInputChange = (val: string) => {
    setLocalInput(val);
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      lastPushedTextRef.current = val;
      updateNodeData(id, { input: val });
    }, 250);
  };

  const handleBlur = () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    if (localInput !== data.input) {
      lastPushedTextRef.current = localInput;
      updateNodeData(id, { input: localInput });
    }
  };

  React.useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const handleRun = async () => {
    const incoming = getIncomingData(id);
    const context = incoming.map(d => JSON.stringify(d)).join('\n');

    setLoading(true);
    try {
      const selectedPreset = LOGIC_PRESETS.find(p => p.id === (data.preset || 'analyzer'));
      const systemPrompt = selectedPreset?.prompt || '';
      
      const resultText = await generateTextWithFallback(
        `[LOGIC ENGINE MODE]\n\nInputs:\n${context || localInput || 'No input data.'}`, 
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
    <div className={`relative group w-full h-full ${selected ? 'border-[var(--accent)] shadow-[0_0_20px_var(--accent)]/30' : 'border-[var(--border)]'} border rounded-2xl shadow-2xl transition-all flex flex-col ${
      settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
    }`}>
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected} 
        minWidth={280}
        minHeight={300}
        keepAspectRatio={true}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '2px solid var(--accent)' }}
      />
      <ScaleWrapper id={id} type="logic-engine">
        <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] transition-all react-flow__node-draghandle ${
          settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-accent/10'
        } rounded-t-2xl`}>
          <div className="flex items-center gap-2 text-[1em] font-bold text-accent uppercase tracking-widest">
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
            <label className="text-[0.75em] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-1.5">
              <Terminal size={10} /> 输入内容 (可选)
            </label>
            <textarea
              value={localInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleBlur}
              placeholder="支持从上游节点传入，也可以在此手动输入..."
              className="w-full h-24 bg-black/40 border border-[var(--border)] rounded-xl p-3 text-[0.8em] text-gray-300 focus:outline-none focus:border-accent/50 resize-none font-mono custom-scrollbar"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[0.75em] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-1.5">
              <Terminal size={10} /> 逻辑预设
            </label>
            <div className="flex flex-wrap gap-2">
              {LOGIC_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => updateNodeData(id, { preset: preset.id })}
                  className={`px-3 py-1.5 rounded-lg text-[0.75em] transition-all border ${
                    data.preset === preset.id 
                      ? 'bg-accent border-accent text-white font-bold' 
                      : 'bg-white/5 border-[var(--border)] text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[0.75em] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-1.5">
              <Code2 size={10} /> 推理结果
            </label>
            <div className="bg-black/60 border border-[var(--border)] rounded-xl p-3 text-[0.85em] text-gray-300 min-h-[120px] max-h-[220px] overflow-y-auto whitespace-pre-wrap font-mono custom-scrollbar leading-relaxed">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-3 text-accent/50 italic">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="text-[0.75em] uppercase tracking-[0.2em] font-bold">深度推理中...</span>
                </div>
              ) : data.output || '等待输入并运行...'}
            </div>
          </div>

          <button 
            onClick={handleRun}
            disabled={loading}
            className="w-full bg-accent hover:bg-accent disabled:bg-blue-900/50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-accent/20 group text-[0.9em]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="group-hover:scale-110 transition-transform" />}
            <span>启动逻辑链</span>
          </button>
        </div>
      </ScaleWrapper>

      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  />
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  />
    </div>
  );
};
