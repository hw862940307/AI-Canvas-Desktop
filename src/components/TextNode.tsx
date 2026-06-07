import React from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Type, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ScaleWrapper } from './ScaleWrapper';

export const TextNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const updateNodeData = useStore((s) => s.updateNodeData);
  const removeNode = useStore((s) => s.removeNode);
  const settings = useStore((s) => s.settings);

  const getFontSizeStyle = () => {
    return typeof settings.inputFontSize === 'number' 
      ? { fontSize: `${settings.inputFontSize}px` } 
      : {};
  };
  const getFontSizeClass = () => {
    if (typeof settings.inputFontSize === 'number') return '';
    if (settings.inputFontSize === 'small') return 'text-base';
    if (settings.inputFontSize === 'large') return 'text-lg';
    return 'text-lg';
  };

  return (
    <div className={`relative group w-full h-full border ${selected ? 'border-[var(--accent)] shadow-[0_0_20px_var(--accent)]/30' : 'border-[var(--border)]'} rounded-2xl shadow-2xl transition-all flex flex-col ${
      settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
    }`}>
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected} 
        minWidth={240}
        minHeight={200}
        keepAspectRatio={true}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '2px solid var(--accent)' }}
      />
      <ScaleWrapper id={id} type="text">
        <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--border)] transition-all react-flow__node-draghandle ${
          settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-black/40'
        } rounded-t-2xl`}>
          <div className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
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

        <div className="p-4 flex-1 flex flex-col justify-between nodrag">
          <textarea
            style={getFontSizeStyle()}
            className={`w-full h-full min-h-[140px] bg-black/40 border border-[var(--border)] rounded-xl p-3 text-[var(--text-primary)] focus:outline-none focus:border-emerald-500/50 transition-all resize-none font-mono placeholder:text-[var(--text-secondary)]/50 ${getFontSizeClass()}`}
            placeholder="在此输入文本..."
            value={data.text || ''}
            onChange={(e) => updateNodeData(id, { text: e.target.value })}
          />
          <div className="mt-2 flex justify-between items-center px-1">
            <span className="text-xs text-[var(--text-secondary)] uppercase font-bold tracking-widest">Type Input</span>
            <span className="text-xs text-[var(--text-secondary)]">{(data.text || '').length} 字符</span>
          </div>
        </div>
      </ScaleWrapper>

      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  />
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  />
    </div>
  );
};
