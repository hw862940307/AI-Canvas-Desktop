import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Copy, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Bold, 
  Italic, 
  List, 
  Minus, 
  Type, 
  Check,
  Heading1,
  Heading2,
  Heading3,
  Text as TextIcon
} from 'lucide-react';

interface FullscreenTextEditorProps {
  initialText: string;
  initialAlignment?: 'left' | 'center' | 'right';
  onClose: () => void;
  onSave: (text: string, alignment: 'left' | 'center' | 'right') => void;
}

export const FullscreenTextEditor = ({ 
  initialText, 
  initialAlignment = 'left', 
  onClose, 
  onSave 
}: FullscreenTextEditorProps) => {
  const [text, setText] = useState(initialText);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(initialAlignment);
  
  // Helper to insert text at cursor or wrap selection
  const insertText = (before: string, after: string = '') => {
    const textarea = document.getElementById('fullscreen-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = text.substring(start, end);
    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
    
    setText(newText);
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-[var(--bg-secondary)]/95 backdrop-blur-3xl flex flex-col p-4 md:p-8"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-8 py-4 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-t-[32px] shadow-2xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              navigator.clipboard.writeText(text);
            }}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-all text-[var(--text-secondary)] hover:text-white"
            title="复制"
          >
            <Copy size={18} />
          </button>
          
          <div className="w-px h-6 bg-[var(--border)] mx-2" />

          {/* Formatting Tools */}
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/10">
            <EditorToolButton onClick={() => insertText('# ', '')} icon={<Heading1 size={18} />} title="一级标题" />
            <EditorToolButton onClick={() => insertText('## ', '')} icon={<Heading2 size={18} />} title="二级标题" />
            <EditorToolButton onClick={() => insertText('### ', '')} icon={<Heading3 size={18} />} title="三级标题" />
            <EditorToolButton onClick={() => insertText('')} icon={<TextIcon size={18} />} title="正文" />
            
            <div className="w-px h-4 bg-white/10 mx-1" />
            
            <EditorToolButton onClick={() => insertText('**', '**')} icon={<Bold size={18} />} title="加粗" />
            <EditorToolButton onClick={() => insertText('*', '*')} icon={<Italic size={18} />} title="斜体" />
            
            <div className="w-px h-4 bg-white/10 mx-1" />
            
            <EditorToolButton 
              active={alignment === 'left'} 
              onClick={() => setAlignment('left')} 
              icon={<AlignLeft size={18} />} 
              title="左对齐" 
            />
            <EditorToolButton 
              active={alignment === 'center'} 
              onClick={() => setAlignment('center')} 
              icon={<AlignCenter size={18} />} 
              title="居中对齐" 
            />
            <EditorToolButton 
              active={alignment === 'right'} 
              onClick={() => setAlignment('right')} 
              icon={<AlignRight size={18} />} 
              title="右对齐" 
            />
            
            <div className="w-px h-4 bg-white/10 mx-1" />
            
            <EditorToolButton onClick={() => insertText('- ', '')} icon={<List size={18} />} title="无序列表" />
            <EditorToolButton onClick={() => insertText('\n---\n')} icon={<Minus size={18} />} title="分割线" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-bold text-[var(--text-secondary)] hover:text-white transition-all"
          >
            取消
          </button>
          <button 
            onClick={() => onSave(text, alignment)}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl active:scale-95"
          >
            <Check size={18} />
            <span>保存变更</span>
          </button>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-500 rounded-full transition-all ml-2"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 bg-[var(--bg-primary)] border-x border-b border-[var(--border)] rounded-b-[32px] overflow-hidden flex flex-col p-12">
        <textarea
          id="fullscreen-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`w-full flex-1 bg-transparent text-white outline-none resize-none placeholder:text-gray-700 text-lg leading-relaxed ${
            alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left'
          }`}
          placeholder="在此输入文本内容..."
          autoFocus
        />
        
        <div className="mt-8 flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-mono uppercase tracking-[0.2em] border-t border-[var(--border)] pt-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>字符数: {text.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>行数: {text.split('\n').length}</span>
            </div>
          </div>
          <div>ADOBE STYLE EDITOR PRO</div>
        </div>
      </div>
    </motion.div>
  );
};

const EditorToolButton = ({ 
  icon, 
  onClick, 
  title, 
  active = false 
}: { 
  icon: React.ReactNode; 
  onClick: () => void; 
  title: string;
  active?: boolean;
}) => (
  <button 
    onClick={onClick}
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
