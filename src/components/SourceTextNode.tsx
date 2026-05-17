import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useStore } from '../store/useStore';
import { 
  Type, 
  Maximize2, 
  Copy, 
  X, 
  Eraser, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FullscreenTextEditor } from './FullscreenTextEditor';

export const SourceTextNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const { updateNodeData, removeNode, settings } = useStore();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [localText, setLocalText] = useState(data.text || '');

  // Sync local state with store updates (e.g. clear, fullscreen edit)
  useEffect(() => {
    if (data.text !== localText) {
      setLocalText(data.text || '');
    }
  }, [data.text]);

  const handleTextChange = (val: string) => {
    setLocalText(val);
    updateNodeData(id, { text: val });
  };

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

  const clearText = () => {
    updateNodeData(id, { text: '' });
  };

  const copyText = () => {
    if (data.text) {
      navigator.clipboard.writeText(data.text);
    }
  };

  const handleAlignmentChange = (alignment: 'left' | 'center' | 'right') => {
    updateNodeData(id, { alignment });
  };

  return (
    <div 
      className={`relative border w-full h-full ${selected ? 'border-[var(--accent)] shadow-[0_0_20px_var(--accent)]/30' : 'border-[var(--border)]'} rounded-3xl shadow-2xl overflow-visible group/node transition-all flex flex-col ${
        settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
      }`}
    >
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected} 
        minWidth={200}
        minHeight={150}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '2px solid var(--accent)' }}
      />

      {/* Floating Toolbar */}
      <AnimatePresence>
        {selected && (
          <motion.div 
            initial={{ opacity: 1, y: -60, scale: 1 }}
            animate={{ opacity: 1, y: -60, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0 }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`absolute left-1/2 -translate-x-1/2 top-0 flex items-center gap-1 p-1 border border-[var(--border)] rounded-2xl shadow-2xl z-[100] whitespace-nowrap transition-all ${
              settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-tertiary)]'
            }`}
          >
            <ToolbarIconButton icon={<Copy size={16} />} onClick={copyText} title="复制" />
            <ToolbarIconButton icon={<Eraser size={16} />} onClick={clearText} title="清空文字" />
            
            <div className="w-px h-4 bg-[var(--border)] mx-1" />
            
            <ToolbarIconButton 
              active={data.alignment === 'left'} 
              icon={<AlignLeft size={16} />} 
              onClick={() => handleAlignmentChange('left')} 
              title="左对齐" 
            />
            <ToolbarIconButton 
              active={data.alignment === 'center'} 
              icon={<AlignCenter size={16} />} 
              onClick={() => handleAlignmentChange('center')} 
              title="居中" 
            />
            <ToolbarIconButton 
              active={data.alignment === 'right'} 
              icon={<AlignRight size={16} />} 
              onClick={() => handleAlignmentChange('right')} 
              title="右对齐" 
            />
            
            <div className="w-px h-4 bg-[var(--border)] mx-1" />
            
            <ToolbarIconButton icon={<Maximize2 size={16} />} onClick={() => setIsFullScreen(true)} title="全屏显示" />
            <ToolbarIconButton icon={<MoreHorizontal size={16} />} title="更多" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className={`p-4 border-b border-[var(--border)] flex items-center justify-between transition-all rounded-t-3xl shrink-0 react-flow__node-draghandle ${
        settings.barTexture === 'frosted' ? 'frosted-glass border-b-white/5' : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Type size={18} />
          </div>
          <span className="text-base font-bold tracking-wider text-[var(--text-primary)]">源文本</span>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setIsFullScreen(true)}
             className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] transition-colors"
           >
              <Maximize2 size={14} />
           </button>
           <button 
             onClick={() => removeNode(id)}
             className="p-1.5 hover:bg-red-500/10 rounded-lg text-[var(--text-secondary)] hover:text-red-400 transition-colors"
           >
              <X size={14} />
           </button>
        </div>
      </div>

      <div className={`flex-1 p-4 min-h-0 relative flex flex-col rounded-b-3xl nodrag ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-[var(--bg-primary)]'
      }`}>
        <textarea
          style={getFontSizeStyle()}
          value={localText}
          onChange={(e) => handleTextChange(e.target.value)}
          className={`nodrag nowheel w-full flex-1 bg-transparent text-[var(--text-primary)] outline-none resize-none placeholder:text-[var(--text-secondary)]/30 font-sans transition-all ${getFontSizeClass()} ${
            data.alignment === 'center' ? 'text-center' : data.alignment === 'right' ? 'text-right' : 'text-left'
          }`}
          placeholder="输入提示词开始创作"
        />
        
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-end shrink-0">
           <div className="text-sm text-[var(--text-secondary)]/50 font-mono">
              {data.text?.length || 0} 字
           </div>
        </div>
      </div>

      {/* Portals */}
      {createPortal(
        <AnimatePresence>
          {isFullScreen && (
            <FullscreenTextEditor 
              initialText={data.text || ''}
              initialAlignment={data.alignment || 'left'}
              onClose={() => setIsFullScreen(false)}
              onSave={(newText, newAlignment) => {
                updateNodeData(id, { text: newText, alignment: newAlignment });
                setIsFullScreen(false);
              }}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
    </div>
  );
};

const ToolbarIconButton = ({ icon, onClick, title, active = false }: { icon: React.ReactNode, onClick?: () => void, title?: string, active?: boolean }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
    title={title}
    className={`p-2.5 rounded-xl transition-all ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
        : 'hover:bg-white/10 text-[var(--text-secondary)] hover:text-white'
    }`}
  >
    {icon}
  </button>
);

