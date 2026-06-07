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
import { ScaleWrapper } from './ScaleWrapper';

export const SourceTextNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const updateNodeData = useStore((s) => s.updateNodeData);
  const removeNode = useStore((s) => s.removeNode);
  const settings = useStore((s) => s.settings);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [localText, setLocalText] = useState(data.text || '');
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastPushedTextRef = React.useRef(data.text || '');

  const [isDragOver, setIsDragOver] = useState(false);

  // Sync local state with store updates (e.g. clear, fullscreen edit)
  useEffect(() => {
    if (data.text !== localText && data.text !== lastPushedTextRef.current) {
      setLocalText(data.text || '');
      lastPushedTextRef.current = data.text || '';
    }
  }, [data.text]);

  const handleTextChange = (val: string) => {
    setLocalText(val);
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      lastPushedTextRef.current = val;
      updateNodeData(id, { text: val });
    }, 250);
  };

  const handleBlur = () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    if (localText !== data.text) {
      lastPushedTextRef.current = localText;
      updateNodeData(id, { text: localText });
    }
  };

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    // First try extracting text from internal react flow
    const type = e.dataTransfer.getData("application/reactflow/type");
    let droppedText = '';
    
    if (type === 'text-source') {
      try {
        const dataStr = e.dataTransfer.getData("application/reactflow/data");
        const parsed = JSON.parse(dataStr);
        droppedText = parsed.text || '';
      } catch {}
    }
    
    // If no internal text, try getting text from dropped text files
    const files = e.dataTransfer.files;
    const isTextFile = (file: File) => {
      const type = file.type;
      const name = file.name.toLowerCase();
      return type.startsWith("text/") || 
             type === "application/json" ||
             name.endsWith(".txt") || 
             name.endsWith(".md") ||
             name.endsWith(".json") ||
             name.endsWith(".csv") ||
             name.endsWith(".xml") ||
             name.endsWith(".log") ||
             name.endsWith(".yaml") ||
             name.endsWith(".yml") ||
             name.endsWith(".html") ||
             name.endsWith(".js") ||
             name.endsWith(".ts") ||
             name.endsWith(".jsx") ||
             name.endsWith(".tsx") ||
             name.endsWith(".css");
    };
    const textFiles = Array.from(files).filter(isTextFile);
    
    if (textFiles.length > 0) {
      textFiles[0].text().then(fileContent => {
        if (fileContent) {
           const newText = localText ? localText + '\n\n' + fileContent : fileContent;
           handleTextChange(newText);
        }
      }).catch(err => console.error("Failed to read text file", err));
      return;
    }
    
    // Fall back to external selected text
    if (!droppedText) {
      droppedText = e.dataTransfer.getData('text/plain');
    }
    
    if (droppedText) {
      const newText = localText ? localText + '\n\n' + droppedText : droppedText;
      handleTextChange(newText);
    }
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
    setLocalText('');
    lastPushedTextRef.current = '';
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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border w-full h-full border-[var(--border)] rounded-3xl shadow-2xl overflow-visible group/node transition-all duration-200 flex flex-col ${
        settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
      } ${isDragOver ? 'ring-2 ring-blue-500/80 scale-[1.02] bg-blue-500/5' : ''}`}
    >
      <NodeResizer 
        color="transparent" 
        isVisible={selected} 
        minWidth={200}
        minHeight={150}
        keepAspectRatio={true}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'transparent', border: 'none' }}
      />
      <ScaleWrapper id={id} type="text-source">
        {/* Toolbar (Now integrated inside when selected) */}
        <AnimatePresence>
        {selected && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`flex items-center gap-1 p-2 border-b border-[var(--border)] rounded-t-3xl shrink-0 overflow-hidden ${
              settings.barTexture === 'frosted' ? 'frosted-glass border-b-white/5' : 'bg-[var(--bg-tertiary)]'
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
      <div className={`p-4 border-b border-[var(--border)] flex items-center justify-between transition-all ${selected ? '' : 'rounded-t-3xl'} shrink-0 react-flow__node-draghandle ${
        settings.barTexture === 'frosted' ? 'frosted-glass border-b-white/5' : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
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
          onBlur={handleBlur}
          className={`nodrag nowheel w-full flex-1 bg-transparent text-[var(--text-primary)] outline-none resize-none placeholder:text-[var(--text-secondary)]/30 font-sans transition-all ${getFontSizeClass()} ${
            data.alignment === 'center' ? 'text-center' : data.alignment === 'right' ? 'text-right' : 'text-left'
          }`}
          placeholder="输入提示词开始创作"
        />
        
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-end shrink-0">
           <div className="text-sm text-[var(--text-secondary)]/50 font-mono">
              {localText.length} 字
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
                setLocalText(newText);
                lastPushedTextRef.current = newText;
                updateNodeData(id, { text: newText, alignment: newAlignment });
                setIsFullScreen(false);
              }}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
      </ScaleWrapper>

      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  />
    </div>
  );
};

const ToolbarIconButton = ({ icon, onClick, title, active = false }: { icon: React.ReactNode, onClick?: () => void, title?: string, active?: boolean }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
    title={title}
    className={`p-2.5 rounded-xl transition-all ${
      active 
        ? 'bg-accent text-white shadow-lg shadow-accent/20' 
        : 'hover:bg-white/10 text-[var(--text-secondary)] hover:text-white'
    }`}
  >
    {icon}
  </button>
);

