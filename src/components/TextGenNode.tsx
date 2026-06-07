import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useStore } from '../store/useStore';
import { generateTextWithFallback } from '../lib/gemini';
import { 
  Type, 
  Sparkles, 
  Loader2, 
  ChevronDown, 
  Copy, 
  Maximize2, 
  X, 
  Eraser,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScaleWrapper } from './ScaleWrapper';
import { FullscreenTextEditor } from './FullscreenTextEditor';


export const TextGenNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const updateNodeData = useStore((s) => s.updateNodeData);
  const removeNode = useStore((s) => s.removeNode);
  const settings = useStore((s) => s.settings);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const result = data.result || '';
  const selectedModel = data.model || 'gemini-3-flash-preview';

  const getFontSizeStyle = () => {
    return typeof settings.inputFontSize === 'number' 
      ? { fontSize: `${settings.inputFontSize}px` } 
      : {};
  };
  const getFontSizeClass = () => {
    if (typeof settings.inputFontSize === 'number') return '';
    if (settings.inputFontSize === 'small') return 'text-[0.95em]';
    if (settings.inputFontSize === 'large') return 'text-[1.125em]';
    return 'text-[1.05em]';
  };

  const handleGenerate = async () => {
    const { getIncomingData } = useStore.getState();
    const incomingData = getIncomingData(id);
    const incomingText = incomingData.map(d => d.result || d.output || d.text || '').filter(Boolean).join('\n\n');
    
    // Combine local prompt with incoming data if any exists
    const finalPrompt = incomingText ? `${prompt}\n\n[Context from connected modules]:\n${incomingText}` : prompt;

    if (!finalPrompt || loading) return;

    setLoading(true);
    try {
      const text = await generateTextWithFallback(finalPrompt);
      updateNodeData(id, { result: text, prompt });
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearResult = () => {
    updateNodeData(id, { result: '' });
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result);
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
        minWidth={280}
        minHeight={300}
        keepAspectRatio={true}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '2px solid var(--accent)' }}
      />
      <ScaleWrapper id={id} type="text-gen">
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
            <ToolbarIconButton icon={<Copy size={16} />} onClick={copyResult} title="复制结果" />
            <ToolbarIconButton icon={<Eraser size={16} />} onClick={clearResult} title="清空文字" />
            
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
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Type size={18} />
          </div>
          <span className="text-[1em] font-bold tracking-wider text-[var(--text-primary)]">生成文本</span>
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

      {/* Result Display Area */}
      <div className={`flex-1 p-1 min-h-0 relative flex flex-col nodrag ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-[var(--bg-primary)]'
      }`}>
        <textarea
          style={getFontSizeStyle()}
          value={result}
          readOnly
          className={`nodrag nowheel w-full flex-1 bg-transparent p-4 text-[var(--text-primary)] outline-none resize-none placeholder:text-[var(--text-secondary)]/30 transition-all ${getFontSizeClass()} ${
            data.alignment === 'center' ? 'text-center' : data.alignment === 'right' ? 'text-right' : 'text-left'
          }`}
          placeholder="生成的文本结果将显示在此..."
        />
        
        <div className="p-3 border-t border-[var(--border)] flex justify-end shrink-0 bg-[var(--bg-secondary)]/30">
          <div className="text-[0.8em] text-[var(--text-secondary)]/50 font-mono">
             {result.length} 字
          </div>
        </div>
      </div>

      {/* Generation Input Area */}
      <div className={`p-4 border-t border-[var(--border)] rounded-b-3xl transition-all shrink-0 nodrag ${
        settings.barTexture === 'frosted' ? 'bg-white/5 border-t-white/5' : 'bg-[var(--bg-secondary)]'
      }`}>
        <div className="relative mb-3">
          <textarea
            style={getFontSizeStyle()}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={`nodrag nowheel w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl p-3 pr-10 text-[var(--text-primary)] focus:outline-none focus:border-purple-500/50 resize-none min-h-[60px] placeholder:text-[var(--text-secondary)]/50 ${getFontSizeClass()}`}
            placeholder="描述你想生成的文本内容..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt}
            className={`absolute right-2 bottom-2 p-1.5 rounded-lg transition-all ${
              loading ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-600 text-white hover:bg-purple-500 active:scale-95'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          </button>
        </div>

        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-primary)] cursor-pointer transition-colors">
              <span className="text-[0.75em] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{selectedModel}</span>
              <ChevronDown size={10} className="text-[var(--text-secondary)]" />
           </div>
           <div className="text-[0.7em] text-[var(--text-secondary)] italic">
              (Enter 生成)
           </div>
        </div>
      </div>

      {/* Portals */}
      {createPortal(
        <AnimatePresence>
          {isFullScreen && (
            <FullscreenTextEditor 
              initialText={result}
              initialAlignment={data.alignment || 'left'}
              onClose={() => setIsFullScreen(false)}
              onSave={(newText, newAlignment) => {
                updateNodeData(id, { result: newText, alignment: newAlignment });
                setIsFullScreen(false);
              }}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
      </ScaleWrapper>

      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  />
      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  />
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

