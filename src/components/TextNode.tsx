import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Type, X } from 'lucide-react';
import { useStore } from '../store/useStore';

export const TextNode = ({ id, data }: { id: string; data: any }) => {
  const { updateNodeData, removeNode, settings } = useStore();

  const getFontSizeStyle = () => {
    return typeof settings.inputFontSize === 'number' 
      ? { fontSize: `${settings.inputFontSize}px` } 
      : {};
  };
  const getFontSizeClass = () => {
    if (typeof settings.inputFontSize === 'number') return '';
    if (settings.inputFontSize === 'small') return 'text-[10px]';
    if (settings.inputFontSize === 'large') return 'text-sm';
    return 'text-xs';
  };

  return (
    <div className={`relative group min-w-[280px] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl transition-all ${
      settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
    }`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] transition-all react-flow__node-draghandle ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-black/40'
      }`}>
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Type size={16} className="text-emerald-400" />
          <span>文本节点</span>
        </div>
        <button 
          onClick={() => removeNode(id)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-[var(--text-secondary)] hover:text-red-400"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 nodrag">
        <textarea
          style={getFontSizeStyle()}
          className={`w-full min-h-[140px] bg-black/40 border border-[var(--border)] rounded-xl p-3 text-[var(--text-primary)] focus:outline-none focus:border-emerald-500/50 transition-all resize-y font-mono placeholder:text-[var(--text-secondary)]/50 ${getFontSizeClass()}`}
          placeholder="在此输入文本..."
          value={data.text || ''}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
        />
        <div className="mt-2 flex justify-between items-center px-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-widest">Type Input</span>
          <span className="text-[10px] text-[var(--text-secondary)]">{(data.text || '').length} 字符</span>
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="!bg-emerald-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
      <Handle type="source" position={Position.Right} className="!bg-emerald-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
    </div>
  );
};
