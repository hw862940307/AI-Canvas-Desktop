import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Cpu, Play, Loader2, X, Settings2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GoogleGenAI } from '@google/genai';

let ai: any = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize GoogleGenAI in PromptEngineNode:", e);
}

const PRESETS = [
  { id: 'background', name: '产品背景更换', prompt: '分析此产品图像，并建议一个专业的电影级背景提示词。' },
  { id: 'dna', name: 'DNA 提取', prompt: '从该图像中提取关键视觉元素（颜色、风格、构图）作为文本 DNA。' },
  { id: 'enhance', name: '提示词增强', prompt: '将以下原始提示词扩展为详细的高质量 AI 图像提示词。' },
  { id: 'angle', name: '角度控制', prompt: '为该产品生成一个角度控制提示词。使用水平/垂直角度参数描述一个新的透视角度。' },
];

export const PromptEngineNode = ({ id, data }: { id: string; data: any }) => {
  const { updateNodeData, removeNode, getIncomingData, settings } = useStore();
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    const incoming = getIncomingData(id);
    const context = incoming.map(d => d.text || d.output || d.imageUrl || '').join('\n');

    setLoading(true);
    try {
      if (!ai) {
        console.error("Gemini AI not initialized. Check API key.");
        return;
      }
      const selectedPreset = PRESETS.find(p => p.id === (data.preset || 'enhance'));
      const systemPrompt = selectedPreset?.prompt || '';
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${systemPrompt}\n\nInput Context: ${context || data.inputContext || 'No context provided.'}`,
      });

      updateNodeData(id, { output: response.text });
    } catch (error) {
      console.error('Prompt Engine failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative group min-w-[300px] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl transition-all ${
      settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
    }`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] transition-all react-flow__node-draghandle ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-purple-500/10'
      }`}>
        <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
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
          <label className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-widest">框架 / 预设</label>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => updateNodeData(id, { preset: preset.id })}
                className={`text-left px-3 py-2 rounded-xl text-[11px] transition-all ${
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
          <label className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-widest">引擎输出结果</label>
          <div className="bg-black/40 border border-[var(--border)] rounded-xl p-3 text-[11px] text-[var(--text-primary)] min-h-[100px] max-h-[180px] overflow-y-auto whitespace-pre-wrap font-mono custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[100px] gap-2 text-[var(--text-secondary)] italic">
                <Loader2 size={20} className="animate-spin text-purple-500" />
                <span className="text-[10px] uppercase tracking-widest font-bold">处理中...</span>
              </div>
            ) : data.output || '结果将在此显示...'}
          </div>
        </div>

        <button 
          onClick={handleRun}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-purple-600/20"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          <span>运行引擎</span>
        </button>
      </div>

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-[var(--bg-secondary)]" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-[var(--bg-secondary)]" />
    </div>
  );
};
