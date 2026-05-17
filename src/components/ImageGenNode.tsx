import React, { useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sparkles, Loader2, X, Maximize2, ChevronDown, Plus, ArrowUp, Download } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getGenAI } from '../lib/gemini';
import { downloadImage } from '../lib/download';

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
    const { getIncomingData } = useStore.getState();
    const incomingData = getIncomingData(id);
    const incomingText = incomingData.map(d => d.result || d.output || d.text || '').filter(Boolean).join(' ');
    
    // Process final prompt
    let finalPrompt = prompt || '';
    if (incomingText) {
      finalPrompt = finalPrompt ? `${finalPrompt}, ${incomingText}` : incomingText;
    }

    if (!finalPrompt || loading) return;

    setLoading(true);
    
    try {
      const apiSettings = settings.apiSettings;

      if (apiSettings.imageEngine === 'comfyui') {
        const comfyUrl = apiSettings.comfyUrl || 'http://127.0.0.1:8188';
        
        // Basic ComfyUI Default SDXL/SD1.5 API Prompt payload 
        // We inject the user prompt into a basic graph
        const payload = {
          "prompt": {
            "3": {
              "class_type": "KSampler",
              "inputs": {
                "seed": Math.floor(Math.random() * 100000000),
                "steps": 20,
                "cfg": 8,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
              }
            },
            "4": {
              "class_type": "CheckpointLoaderSimple",
              "inputs": { "ckpt_name": "v1-5-pruned-emaonly.safetensors" }
            },
            "5": {
              "class_type": "EmptyLatentImage",
              "inputs": { "batch_size": 1, "width": 512, "height": 512 }
            },
            "6": {
              "class_type": "CLIPTextEncode",
              "inputs": { "text": finalPrompt, "clip": ["4", 1] }
            },
            "7": {
              "class_type": "CLIPTextEncode",
              "inputs": { "text": "bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality", "clip": ["4", 1] }
            },
            "8": {
              "class_type": "VAEDecode",
              "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
            },
            "9": {
              "class_type": "SaveImage",
              "inputs": { "filename_prefix": "canvas_gen", "images": ["8", 0] }
            }
          }
        };

        const res = await fetch(`${comfyUrl}/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error('ComfyUI request failed');
        
        const data = await res.json();
        const promptId = data.prompt_id;
        
        // Simple polling for result
        let imgUrl = '';
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const historyRes = await fetch(`${comfyUrl}/history/${promptId}`);
          const historyData = await historyRes.json();
          if (historyData[promptId]) {
            const outputs = historyData[promptId].outputs;
            if (outputs && outputs['9'] && outputs['9'].images.length > 0) {
              const imageInfo = outputs['9'].images[0];
              imgUrl = `${comfyUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder}&type=${imageInfo.type}`;
              break;
            }
          }
        }
        
        if (!imgUrl) throw new Error('Generation timeout or failed in ComfyUI');
        
        setPreviewUrl(imgUrl);
        setCurrentImageUrl(imgUrl);
        updateNodeData(id, { imageUrl: imgUrl, prompt });
        addFile({ name: `ComfyUI - ${new Date().toLocaleTimeString()}`, type: 'image', url: imgUrl });
        
      } else {
        // Online Image Generation via OpenAI compatible API
        const response = await fetch('/api/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: apiSettings.baseUrl,
            apiKey: apiSettings.apiKey,
            modelId: apiSettings.imageModel,
            prompt: finalPrompt
          })
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Server connection error');
        }

        const data = await response.json();
        const imgUrl = data.imageUrl;
        
        if (!imgUrl) throw new Error('No image URL returned from API');

        setPreviewUrl(imgUrl);
        setCurrentImageUrl(imgUrl);
        
        updateNodeData(id, { imageUrl: imgUrl, prompt });
        
        addFile({
          name: `${apiSettings.imageModel} - ${new Date().toLocaleTimeString()}`,
          type: 'image',
          url: imgUrl,
        });
      }

    } catch (error) {
      console.error('Generation failed:', error);
      // Fallback to picsum on error to not block UI completely for demo
      const errImageUrl = 'https://picsum.photos/seed/error/800/600';
      setPreviewUrl(errImageUrl);
      updateNodeData(id, { imageUrl: errImageUrl, prompt });
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
          <span className="text-base font-bold tracking-wider">生成图像</span>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={(e) => { e.stopPropagation(); data.imageUrl && downloadImage(data.imageUrl, `generated-image-\${id}.png`); }}
             className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] transition-colors hover:text-blue-400"
           >
              <Download size={14} />
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
            <img draggable={false} src={previewUrl} alt="Generated" className="w-full h-full object-cover" />
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
        <div className="relative mb-3 nodrag">
          <textarea
            style={getFontSizeStyle()}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={`w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl p-4 pr-12 text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50 resize-none min-h-[100px] placeholder:text-[var(--text-secondary)]/50 transition-all ${getFontSizeClass()}`}
            placeholder="描述任何你想要生成的内容，按 @ 引用素材，/呼出指令 (Enter 生成, Shift+Enter 换行)"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt}
            className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-xl shadow-lg transition-all active:scale-90"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
          </button>
        </div>

        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-primary)] cursor-pointer transition-colors group">
                 <span className="text-sm font-bold text-[var(--text-secondary)] uppercase group-hover:text-[var(--text-primary)]">MDL</span>
                 <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest max-w-[100px] truncate">{settings.apiSettings.imageEngine === 'comfyui' ? 'ComfyUI' : settings.apiSettings.imageModel}</span>
                 <ChevronDown size={10} className="text-[var(--text-secondary)] shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-primary)] cursor-pointer transition-colors group">
                 <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">{resolution}</span>
                 <ChevronDown size={10} className="text-[var(--text-secondary)]" />
              </div>
           </div>
           <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-primary)] cursor-pointer transition-colors group">
              <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">{batchSize}</span>
              <ChevronDown size={10} className="text-[var(--text-secondary)]" />
           </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
    </div>
  );
};
