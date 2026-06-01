import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Sparkles, Loader2, X, Plus, Download } from 'lucide-react';
import { useStore, useNodeIncomingData } from '../store/useStore';
import { downloadImage } from '../lib/download';
import { ScaleWrapper } from './ScaleWrapper';

const MODELS = ['Nano Banana 2', 'Nano Banana Pro', 'chatgptimage', 'dall-e-3', 'imagen-3.0-generate-001'];
const RESOLUTIONS = ['1:1 (1024x1024)', '4:3 (1024x768)', '3:4 (768x1024)', '4:5 (819x1024)', '5:5 (1024x1024)', '16:9 (1024x576)', '9:16 (576x1024)'];
const QUALITIES = ['1K', '2K', '4K'];
const BATCH_SIZES = [1, 2, 4];

export const ImageGenNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  
  const [selectedModel, setSelectedModel] = useState(data.model || 'Nano Banana 2');
  const [resolution, setResolution] = useState(data.resolution || '1:1 (1024x1024)');
  const [quality, setQuality] = useState(data.quality || '1K');
  const [batchSize, setBatchSize] = useState<number>(data.batch || 1);
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [previewUrls, setPreviewUrls] = useState<string[]>(data.images || (data.imageUrl ? [data.imageUrl] : []));
  
  const { updateNodeData, removeNode, settings, addFile } = useStore();
  const incomingData = useNodeIncomingData(id);

  useEffect(() => {
    if (data.images && data.images.length > 0) {
      setPreviewUrls(data.images);
    } else if (data.imageUrl) {
      setPreviewUrls([data.imageUrl]);
    }
  }, [data.images, data.imageUrl]);

  const handleGenerate = async () => {
    const incomingText = incomingData.map((d: any) => d.result || d.output || d.text || '').filter(Boolean).join(' ');
    
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
        
        let width = 512;
        let height = 512;
        if (resolution.includes('1024x768')) { width = 1024; height = 768; }
        else if (resolution.includes('768x1024')) { width = 768; height = 1024; }
        else if (resolution.includes('819x1024')) { width = 819; height = 1024; }
        else if (resolution.includes('1024x576')) { width = 1024; height = 576; }
        else if (resolution.includes('576x1024')) { width = 576; height = 1024; }

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
              "inputs": { "batch_size": batchSize, "width": width, "height": height }
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
        
        const newUrls = [];
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const historyRes = await fetch(`${comfyUrl}/history/${promptId}`);
          const historyData = await historyRes.json();
          if (historyData[promptId]) {
            const outputs = historyData[promptId].outputs;
            if (outputs && outputs['9'] && outputs['9'].images.length > 0) {
              outputs['9'].images.forEach((img: any) => {
                newUrls.push(`${comfyUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`);
              });
              break;
            }
          }
        }
        
        if (newUrls.length === 0) throw new Error('Generation timeout or failed in ComfyUI');
        
        setPreviewUrls(newUrls);
        updateNodeData(id, { images: newUrls, imageUrl: newUrls[0], prompt, model: selectedModel, resolution, batch: batchSize });
        newUrls.forEach(url => addFile({ name: `ComfyUI - ${new Date().toLocaleTimeString()}`, type: 'image', url: url }));
        
      } else {
        const response = await fetch('/api/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engine: apiSettings.engine || 'openai',
            baseUrl: apiSettings.baseUrl,
            apiKey: apiSettings.apiKey,
            modelId: selectedModel,
            prompt: finalPrompt,
            n: batchSize,
            size: resolution,
            quality: quality,
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'API request failed');
        }

        const data = await response.json();
        const newUrls = data.urls || (data.imageUrl ? [data.imageUrl] : []);

        if (newUrls.length === 0) throw new Error('No image URLs returned from API');

        setPreviewUrls(newUrls);
        updateNodeData(id, { images: newUrls, imageUrl: newUrls[0], prompt, model: selectedModel, resolution, batch: batchSize });
        newUrls.forEach((url, idx) => addFile({ name: `${selectedModel} (${idx + 1}) - ${new Date().toLocaleTimeString()}`, type: 'image', url: url }));
      }

    } catch (error: any) {
      console.error('Generation failed:', error);
      alert(`图片生成失败: ${error.message || '未知错误'}`);
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
    if (dragCounter.current === 1) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

    const dataTransfer = e.dataTransfer;
    const files = dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const url = ev.target?.result as string;
            setPreviewUrls([url]);
            updateNodeData(id, { imageUrl: url, images: [url] });
          };
          reader.readAsDataURL(file);
        }
      });
      return;
    }

    const rfDataRaw = dataTransfer.getData('application/reactflow/data');
    if (rfDataRaw) {
      try {
        const d = JSON.parse(rfDataRaw);
        if (d.imageUrl || d.url || d.images) {
           const urls = d.images || [d.imageUrl || d.url];
           setPreviewUrls(urls);
           updateNodeData(id, { imageUrl: urls[0], images: urls });
           return;
        }
      } catch (err) {}
    }

    const url = dataTransfer.getData('text/plain') || dataTransfer.getData('url');
    if (url && (url.startsWith('http') || url.startsWith('data:'))) {
      setPreviewUrls([url]);
      updateNodeData(id, { imageUrl: url, images: [url] });
    }
  };

  const getFontSizeStyle = () => (typeof settings.inputFontSize === 'number' ? { fontSize: `${settings.inputFontSize}px` } : {});
  const getFontSizeClass = () => {
    if (typeof settings.inputFontSize === 'number') return '';
    if (settings.inputFontSize === 'small') return 'text-[0.95em]';
    return 'text-[1.05em]';
  };

  const containerAspect = resolution.split(' ')[0].replace(':', '/');

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border w-full h-full ${selected ? 'border-[var(--accent)] shadow-[0_0_20px_var(--accent)]/30' : 'border-[var(--border)]'} rounded-3xl shadow-2xl overflow-visible group/node transition-all flex flex-col ${
        isDragOver ? 'ring-4 ring-accent/10' : ''
      } ${
        settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
      }`}
    >
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected} 
        minWidth={340}
        minHeight={450}
        keepAspectRatio={true}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '2px solid var(--accent)' }}
      />
      <ScaleWrapper id={id} type="image-gen">
        <div className={`p-4 border-b border-[var(--border)] flex items-center justify-between transition-all rounded-t-3xl shrink-0 react-flow__node-draghandle ${
        settings.barTexture === 'frosted' ? 'frosted-glass border-b-white/5' : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
      }`}>
        <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
          <Sparkles size={18} className="text-accent" />
          <span className="text-[1em] font-bold tracking-wider">生成图像</span>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={(e) => { e.stopPropagation(); previewUrls.forEach((url, idx) => downloadImage(url, `generated-image-\${id}-\${idx}.png`)); }}
             disabled={previewUrls.length === 0}
             className="p-1.5 disabled:opacity-50 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] transition-colors hover:text-accent"
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

      <div className={`p-4 min-h-[240px] flex items-center justify-center relative border-b border-[var(--border)] pt-8 pb-8 ${
        settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-[var(--bg-primary)]'
      }`}>
        <div className={`grid gap-4 w-full h-full relative z-10 ${
          previewUrls.length === 1 ? 'grid-cols-1' :
          previewUrls.length === 2 ? 'grid-cols-2' :
          previewUrls.length === 4 ? 'grid-cols-2' : 'grid-cols-1'
        }`}>
          {previewUrls.length > 0 ? (
            previewUrls.map((url, idx) => (
              <div key={idx} style={{ aspectRatio: containerAspect }} className="w-full flex items-center justify-center overflow-hidden border border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)]">
                <img draggable={false} src={url} alt={`Generated \${idx}`} className="w-full h-full object-cover" />
              </div>
            ))
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[var(--text-secondary)]/30">
              <Sparkles size={48} strokeWidth={1} />
            </div>
          )}
        </div>

        {isDragOver && (
          <div className="absolute inset-0 bg-accent/10 backdrop-blur-[2px] pointer-events-none z-[100] flex items-center justify-center">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center shadow-2xl animate-bounce">
              <Plus size={32} className="text-white" />
            </div>
          </div>
        )}
      </div>

      <div className={`p-4 transition-all rounded-b-3xl ${
        settings.barTexture === 'frosted' ? 'bg-white/5 border-t-white/5' : 'bg-[var(--bg-secondary)]'
      }`}>
        <div className="relative mb-3 nodrag">
          <textarea
            style={getFontSizeStyle()}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={`w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl p-4 pr-12 text-[var(--text-primary)] focus:outline-none focus:border-accent/50 resize-none min-h-[100px] placeholder:text-[var(--text-secondary)]/50 transition-all custom-scrollbar ${getFontSizeClass()}`}
            placeholder="描述任何你想要生成的内容..."
          />
          <button
            onClick={handleGenerate}
            disabled={loading || (!prompt && incomingData.length === 0)}
            className="absolute right-3 bottom-3 p-3 bg-accent hover:bg-accent/80 disabled:opacity-30 text-white rounded-xl shadow-lg transition-all active:scale-90"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
          </button>
        </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 nodrag">
               <select 
                 value={selectedModel} 
                 onChange={(e) => { setSelectedModel(e.target.value); updateNodeData(id, { model: e.target.value }); }}
                 className="px-2.5 py-1.5 text-[0.75em] font-bold bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] cursor-pointer outline-none focus:border-accent"
               >
                 {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
               </select>
               <select 
                 value={resolution} 
                 onChange={(e) => { setResolution(e.target.value); updateNodeData(id, { resolution: e.target.value }); }}
                 className="px-2.5 py-1.5 text-[0.75em] font-bold bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] cursor-pointer outline-none focus:border-accent"
               >
                 {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
               </select>
               <select 
                 value={quality} 
                 onChange={(e) => { setQuality(e.target.value); updateNodeData(id, { quality: e.target.value }); }}
                 className="px-2.5 py-1.5 text-[0.75em] font-bold bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] cursor-pointer outline-none focus:border-accent"
               >
                 {QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
               </select>
            </div>
            <div className="nodrag">
               <select 
                 value={batchSize} 
                 onChange={(e) => { setBatchSize(Number(e.target.value)); updateNodeData(id, { batch: Number(e.target.value) }); }}
                 className="px-2.5 py-1.5 text-[0.75em] font-bold bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] cursor-pointer outline-none focus:border-accent"
               >
                 {BATCH_SIZES.map(b => <option key={b} value={b}>{b} 张</option>)}
               </select>
            </div>
         </div>
      </div>

      </ScaleWrapper>

      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none"  />
      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none"  />
    </div>
  );
};
