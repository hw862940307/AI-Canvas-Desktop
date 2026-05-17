import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Languages, Play, Loader2, X, Globe2, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GoogleGenAI } from '@google/genai';

let ai: any = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize GoogleGenAI in TranslateEngineNode:", e);
}

const LANGUAGES = [
  { id: 'en', name: '英文 - English' },
  { id: 'ja', name: '日文 - 日本語' },
  { id: 'ko', name: '韩文 - 한국어' },
  { id: 'fr', name: '法文 - Français' },
  { id: 'de', name: '德文 - Deutsch' },
  { id: 'zh', name: '中文 - 简体中文' },
];

export const TranslateEngineNode = ({ id, data }: { id: string; data: any }) => {
  const { updateNodeData, removeNode, getIncomingData, settings } = useStore();
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    const incoming = getIncomingData(id);
    const content = incoming.map(d => d.text || d.output || d.input || '').join('\n');

    if (!content && !data.input) {
      updateNodeData(id, { output: '请提供输入内容' });
      return;
    }

    setLoading(true);
    try {
      if (!ai) {
        updateNodeData(id, { output: 'Gemini API not configured.' });
        return;
      }
      const targetLang = LANGUAGES.find(l => l.id === (data.targetLang || 'en'))?.name || 'English';
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the following text into ${targetLang}. Preserve tokens for image generation if present.\n\nText:\n${content || data.input}`,
      });

      updateNodeData(id, { output: response.text });
    } catch (error) {
      console.error('Translation failed:', error);
      updateNodeData(id, { output: '翻译失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative group min-w-[300px] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl transition-all ${
      settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[#0a0a0c]'
    }`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] transition-all react-flow__node-draghandle ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-emerald-500/10'
      }`}>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest">
          <Languages size={14} />
          <span>翻译引擎</span>
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
            <Globe2 size={10} /> 目标语言
          </label>
          <select 
            value={data.targetLang || 'en'}
            onChange={(e) => updateNodeData(id, { targetLang: e.target.value })}
            className="bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-[11px] text-gray-300 focus:outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
          >
            {LANGUAGES.map(lang => (
              <option key={lang.id} value={lang.id} className="bg-[#0a0a0c]">{lang.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-1.5">
            <Sparkles size={10} /> 翻译结果
          </label>
          <div className="bg-black/60 border border-white/5 rounded-xl p-3 text-[11px] text-gray-300 min-h-[100px] max-h-[180px] overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[100px] gap-2 text-emerald-500/50 italic">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-[9px] uppercase tracking-widest font-bold">正在翻译...</span>
              </div>
            ) : data.output || '结果将在此显示...'}
          </div>
        </div>

        <button 
          onClick={handleRun}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          <span>运行翻译</span>
        </button>
      </div>

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-[#0a0a0c]" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-[#0a0a0c]" />
    </div>
  );
};
