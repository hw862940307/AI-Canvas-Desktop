import React, { useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sparkles, Loader2, X, Maximize2, ChevronDown, Plus, ArrowUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { GoogleGenAI } from '@google/genai';

let ai: any = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize GoogleGenAI in ImageGenNode:", e);
}

export const ImageGenNode = ({ id, data }: { id: string; data: any }) => {
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const [selectedModel, setSelectedModel] = useState(data.model || 'Nano Banana 2');
  const [resolution, setResolution] = useState(data.resolution || '自适应 · 2K');
  const [batchSize, setBatchSize] = useState(data.batch || '1x');
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [previewUrl, setPreviewUrl] = useState(data.imageUrl || null);
  
  const { updateNodeData, removeNode, settings, addFile } = useStore();
  const [currentImageUrl, setCurrentImageUrl] = useState(data.imageUrl || null);

  // Sync state with data changes (e.g. from global paste)
  React.useEffect(() => {
    if (data.imageUrl !== undefined) {
      setPreviewUrl(data.imageUrl);
      setCurrentImageUrl(data.imageUrl);
    }
  }, [data.imageUrl]);

  const handleGenerate = async () => {
    if (!prompt || loading || !ai) return;

    setLoading(true);
    try {
      const newImageUrl = 'https://picsum.photos/seed/' + Math.random() + '/800/600';
      setPreviewUrl(newImageUrl);
      setCurrentImageUrl(newImageUrl);
      
      updateNodeData(id, { imageUrl: newImageUrl, prompt });
      
      // Save to history
      addFile({
        name: `Generated - ${new Date().toLocaleTimeString()}`,
        type: 'image',
        url: newImageUrl,
      });

    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

    const dataTransfer = e.dataTransfer;
    
    // 1. Try to get files directly
    const files = dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const url = ev.target?.result as string;
            setPreviewUrl(url);
            setCurrentImageUrl(url);
            updateNodeData(id, { imageUrl: url });
          };
          reader.readAsDataURL(file);
        }
      });
      return;
    }

    // 2. Handle data from other nodes
    const rfDataRaw = dataTransfer.getData('application/reactflow/data');
    const rfDataOldRaw = dataTransfer.getData('application/reactflow');
    
    if (rfDataRaw) {
      try {
        const d = JSON.parse(rfDataRaw);
        if (d.imageUrl || d.url) {
          const url = d.imageUrl || d.url;
          setPreviewUrl(url);
          setCurrentImageUrl(url);
          updateNodeData(id, { imageUrl: url });
          return;
        }
      } catch (err) {}
    }

    if (rfDataOldRaw) {
      try {
        const nodeData = JSON.parse(rfDataOldRaw);
        const url = nodeData.imageUrl || nodeData.url;
        if (url) {
          setPreviewUrl(url);
          setCurrentImageUrl(url);
          updateNodeData(id, { imageUrl: url });
          return;
        }
      } catch (err) {}
    }

    const url = dataTransfer.getData('text/plain') || dataTransfer.getData('url');
    if (url && (url.startsWith('http') || url.startsWith('data:'))) {
      setPreviewUrl(url);
      setCurrentImageUrl(url);
      updateNodeData(id, { imageUrl: url });
    }
  };

  const getFontSizeClass = () => {
    if (settings.inputFontSize === 'small') return 'text-[10px]';
    if (settings.inputFontSize === 'large') return 'text-sm';
    return 'text-xs';
  };

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden min-w-[340px] max-w-[420px] group/node transition-all relative ${
        isDragOver ? 'border-blue-500 ring-4 ring-blue-500/10' : ''
      } ${
        settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
      }`}
    >
      {/* Header */}
      <div className={`p-4 border-b border-[var(--border)] flex items-center justify-between transition-all rounded-t-3xl shrink-0 react-flow__node-draghandle ${
        settings.barTexture === 'frosted' ? 'frosted-glass border-b-white/5' : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
      }`}>
        <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
          <Sparkles size={18} className="text-blue-400" />
          <span className="text-xs font-bold tracking-wider">生成图像</span>
        </div>
        <div className="flex items-center gap-2">
           <button className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] transition-colors">
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

      {/* Preview Area */}
      <div className={`p-4 min-h-[240px] flex items-center justify-center relative border-b border-[var(--border)] ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-[var(--bg-primary)]'
      }`}>
        <div className="absolute left-1/2 top-11 -translate-x-1/2 w-[240px] h-[240px] border border-[var(--border)] rounded-3xl overflow-hidden flex items-center justify-center bg-[var(--bg-secondary)] relative">
          {previewUrl ? (
            <img src={previewUrl} alt="Generated" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-4 text-[var(--text-secondary)]/30">
              <Sparkles size={48} strokeWidth={1} />
            </div>
          )}

          {/* Drop Overlay */}
          {isDragOver && (
            <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[2px] pointer-events-none z-50 flex items-center justify-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                <Plus size={32} className="text-white" />
              </div>
            </div>
          )}
        </div>
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
           <Plus size={16} />
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
           <Plus size={16} />
        </div>
      </div>

      {/* Input Section */}
      <div className={`p-4 transition-all rounded-b-3xl ${
        settings.barTexture === 'frosted' ? 'bg-white/5 border-t-white/5' : 'bg-[var(--bg-secondary)]'
      }`}>
        <div className="relative mb-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={`w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl p-4 pr-12 text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 resize-none min-h-[100px] placeholder:text-[var(--text-secondary)]/50 transition-all ${getFontSizeClass()}`}
            placeholder="描述任何你想要生成的内容，按 @ 引用素材，/呼出指令 (Enter 生成, Shift+Enter 换行)"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt || !ai}
            className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-xl shadow-lg transition-all active:scale-90"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
          </button>
        </div>

        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-primary)] cursor-pointer transition-colors group">
                 <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase group-hover:text-[var(--text-primary)]">AM</span>
                 <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-widest">{selectedModel}</span>
                 <ChevronDown size={10} className="text-[var(--text-secondary)]" />
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-primary)] cursor-pointer transition-colors group">
                 <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-widest">{resolution}</span>
                 <ChevronDown size={10} className="text-[var(--text-secondary)]" />
              </div>
           </div>
           <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-primary)] cursor-pointer transition-colors group">
              <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-widest">{batchSize}</span>
              <ChevronDown size={10} className="text-[var(--text-secondary)]" />
           </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500 border-2 border-[var(--bg-secondary)]" />
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500 border-2 border-[var(--bg-secondary)]" />
    </div>
  );
};
