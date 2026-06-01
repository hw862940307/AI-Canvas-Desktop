import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { 
  Sparkles, 
  Loader2, 
  X, 
  Plus, 
  Download, 
  Cpu, 
  Zap, 
  Send, 
  Cable, 
  RotateCw, 
  Images, 
  Play 
} from 'lucide-react';
import { useStore, useNodeIncomingData } from '../store/useStore';
import { downloadImage } from '../lib/download';
import { ScaleWrapper } from './ScaleWrapper';

const ENGINE_TABS = [
  { id: 'gpt', name: 'GPT图像', icon: Cpu },
  { id: 'banana', name: '香蕉图像', icon: Sparkles },
  { id: 'runninghub', name: 'RunningHub', icon: Zap },
  { id: 'jimeng', name: '即梦', icon: Send },
  { id: 'comfyui', name: 'ComfyUI', icon: Cable },
];

export const ImageGenNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  
  const { updateNodeData, removeNode, settings, addFile } = useStore();
  const incomingData = useNodeIncomingData(id);

  // General States mapped to Node Data to ensure persistence
  const [activeTab, setActiveTab] = useState<string>(data.activeTab || 'gpt');
  const [prompt, setPrompt] = useState<string>(data.prompt || '');
  const [previewUrls, setPreviewUrls] = useState<string[]>(data.images || (data.imageUrl ? [data.imageUrl] : []));

  // --- OpenAI / GPT Tab Specific States ---
  const [gptProvider, setGptProvider] = useState<string>(data.gptProvider || 'OpenAI');
  const [gptModel, setGptModel] = useState<string>(data.gptModel || 'gpt-image-2');
  const [gptRatio, setGptRatio] = useState<string>(data.gptRatio || '自动');
  const [gptSize, setGptSize] = useState<string>(data.gptSize || '默认');
  const [gptQuality, setGptQuality] = useState<string>(data.gptQuality || 'auto');
  const [gptBatch, setGptBatch] = useState<number>(data.gptBatch || 1);
  const [gptAsync, setGptAsync] = useState<boolean>(data.gptAsync !== undefined ? data.gptAsync : true);

  // --- Google AI / Banana Tab Specific States ---
  const [bananaProvider, setBananaProvider] = useState<string>(data.bananaProvider || 'Google AI');
  const [bananaModel, setBananaModel] = useState<string>(data.bananaModel || 'gemini-2.0-flash-preview-image-generation');
  const [bananaRatio, setBananaRatio] = useState<string>(data.bananaRatio || 'auto');
  const [bananaResolution, setBananaResolution] = useState<string>(data.bananaResolution || '1K');
  const [bananaBatch, setBananaBatch] = useState<number>(data.bananaBatch || 1);
  const [bananaAsync, setBananaAsync] = useState<boolean>(data.bananaAsync !== undefined ? data.bananaAsync : true);

  // --- RunningHub Tab Specific States ---
  const [rhFunction, setRhFunction] = useState<string>(data.rhFunction || '全能图片');
  const [rhModel, setRhModel] = useState<string>(data.rhModel || '全能图片V2');
  const [rhResolution, setRhResolution] = useState<string>(data.rhResolution || '2K');
  const [rhRatio, setRhRatio] = useState<string>(data.rhRatio || 'auto');
  const [rhBatch, setRhBatch] = useState<number>(data.rhBatch || 1);

  // --- ComfyUI Tab Specific States ---
  const [comfyWorkflow, setComfyWorkflow] = useState<string>(data.comfyWorkflow || '请先在设置中选择文件夹');

  // Synchronize ComfyUI workflows list with dropdown selection in real time
  useEffect(() => {
    const list = settings.apiSettings.comfyWorkflows || [];
    if (settings.apiSettings.comfyWorkflowPath !== '未选择目录' && list.length > 0) {
      if (comfyWorkflow === '请先在设置中选择文件夹' || !list.includes(comfyWorkflow)) {
        setComfyWorkflow(list[0]);
        handleUpdateField('comfyWorkflow', list[0]);
      }
    } else {
      if (comfyWorkflow !== '请先在设置中选择文件夹') {
        setComfyWorkflow('请先在设置中选择文件夹');
        handleUpdateField('comfyWorkflow', '请先在设置中选择文件夹');
      }
    }
  }, [settings.apiSettings.comfyWorkflows, settings.apiSettings.comfyWorkflowPath]);

  // --- 即梦 / Jimeng Tab Specific States ---
  const [jmModel, setJmModel] = useState<string>(data.jmModel || 'doubao-seedream-5-0-260128');
  const [jmMode, setJmMode] = useState<string>(data.jmMode || '单图');
  const [jmResolution, setJmResolution] = useState<string>(data.jmResolution || '2K');
  const [jmRatio, setJmRatio] = useState<string>(data.jmRatio || '1:1');
  const [jmBatch, setJmBatch] = useState<number>(data.jmBatch || 1);

  // Sync state with store save
  const handleUpdateField = (key: string, val: any) => {
    updateNodeData(id, { [key]: val });
  };

  useEffect(() => {
    if (data.images && data.images.length > 0) {
      setPreviewUrls(data.images);
    } else if (data.imageUrl) {
      setPreviewUrls([data.imageUrl]);
    }
  }, [data.images, data.imageUrl]);

  // Extract all connected reference images dynamically
  const incomingImages = useMemo(() => {
    const urls: string[] = [];
    incomingData.forEach((d: any) => {
      if (!d) return;
      if (d.url) urls.push(d.url);
      else if (d.imageUrl) urls.push(d.imageUrl);
      else if (Array.isArray(d.images)) {
        d.images.forEach((img: any) => {
          if (typeof img === 'string') urls.push(img);
          else if (img && typeof img === 'object' && img.url) urls.push(img.url);
        });
      }
    });
    return urls.filter(Boolean);
  }, [incomingData]);

  // Handle Main Deletion Action inside Image Previews
  const handleDeletePreview = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newUrls = previewUrls.filter((_, i) => i !== idx);
    setPreviewUrls(newUrls);
    updateNodeData(id, { images: newUrls, imageUrl: newUrls[0] || null });
  };

  // Handle Main Redo Action inside Image Previews
  const handleRedoPreview = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    handleGenerate();
  };

  const [launching, setLaunching] = useState(false);

  const handleLaunchComfyUI = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (launching) return;
    
    // Fallback if none configured
    const batPath = settings.apiSettings.comfyLauncherPath || '';
    if (!batPath) {
      alert("请先进入应用侧栏「设置」 -> 「ComfyUI」，配置您本地 ComfyUI 启动器 (.bat) 的绝对路径！");
      return;
    }

    setLaunching(true);
    try {
      const response = await fetch('/api/comfy/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launcherPath: batPath })
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        alert(data.message);
      } else {
        alert(`启动失败：\n${data.error || '未知错误'}`);
      }
    } catch (err: any) {
      alert(`无法连通服务启动器接口 API：${err.message || String(err)}`);
    } finally {
      setLaunching(false);
    }
  };

  const handleGenerate = async () => {
    const incomingText = incomingData
      .map((d: any) => d.result || d.output || d.text || '')
      .filter(Boolean)
      .join(' ');
    
    let finalPrompt = prompt || '';
    if (incomingText) {
      finalPrompt = finalPrompt ? `${finalPrompt}, ${incomingText}` : incomingText;
    }

    if (!finalPrompt && incomingImages.length === 0) return;
    if (loading) return;

    setLoading(true);
    
    try {
      const apiSettings = settings.apiSettings;

      // Extract options according to active tab
      let engine = apiSettings.engine || 'openai';
      let selectedModel = gptModel;
      let batchSize = gptBatch;
      let resolution = gptRatio;
      let quality = gptQuality;

      if (activeTab === 'banana') {
        engine = 'gemini';
        selectedModel = bananaModel;
        batchSize = bananaBatch;
        resolution = bananaRatio;
        quality = bananaResolution;
      } else if (activeTab === 'runninghub') {
        selectedModel = rhModel;
        batchSize = rhBatch;
        resolution = rhRatio;
        quality = rhResolution;
      } else if (activeTab === 'jimeng') {
        selectedModel = jmModel;
        batchSize = jmBatch;
        resolution = jmRatio;
        quality = jmResolution;
      }

      if (activeTab === 'comfyui') {
        const comfyUrl = apiSettings.comfyUrl || 'http://127.0.0.1:8188';
        const isLocal = comfyUrl.includes('127.0.0.1') || comfyUrl.includes('localhost');
        
        let width = 512;
        let height = 512;
        if (gptRatio.includes('1024x768')) { width = 1024; height = 768; }
        else if (gptRatio.includes('768x1024')) { width = 768; height = 1024; }
        else if (gptRatio.includes('819x1024')) { width = 819; height = 1024; }
        else if (gptRatio.includes('1024x576')) { width = 1024; height = 576; }
        else if (gptRatio.includes('576x1024')) { width = 576; height = 1024; }

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

        let promptId = '';
        if (!isLocal) {
          // Remote/Proxy route via Express server
          const res = await fetch(`/api/comfy/run-workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: comfyUrl,
              workflow: payload.prompt,
              client_id: `client_${Math.random().toString(36).substring(2, 10)}`
            })
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`ComfyUI 代理请求失败: ${errorText || res.statusText}`);
          }
          const resData = await res.json();
          promptId = resData.prompt_id;
        } else {
          // Local direct route (standard browser)
          const res = await fetch(`${comfyUrl.replace(/\/$/, '')}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('ComfyUI 本地直接请求失败，请确保本地 ComfyUI 已经配置 CORS 跨域许可');
          const resData = await res.json();
          promptId = resData.prompt_id;
        }
        
        const newUrls: string[] = [];
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          let historyData;
          
          if (!isLocal) {
            const historyRes = await fetch(`/api/comfy/history/${promptId}?url=${encodeURIComponent(comfyUrl)}`);
            historyData = await historyRes.json();
          } else {
            const historyRes = await fetch(`${comfyUrl.replace(/\/$/, '')}/history/${promptId}`);
            historyData = await historyRes.json();
          }
          
          if (historyData[promptId]) {
            const outputs = historyData[promptId].outputs;
            if (outputs && outputs['9'] && outputs['9'].images.length > 0) {
              outputs['9'].images.forEach((img: any) => {
                if (!isLocal) {
                  newUrls.push(`/api/comfy/view?url=${encodeURIComponent(comfyUrl)}&filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type || 'output'}`);
                } else {
                  newUrls.push(`${comfyUrl.replace(/\/$/, '')}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`);
                }
              });
              break;
            }
          }
        }
        
        if (newUrls.length === 0) throw new Error('Generation timeout or failed in ComfyUI');
        
        setPreviewUrls(newUrls);
        updateNodeData(id, { images: newUrls, imageUrl: newUrls[0], prompt, model: selectedModel, resolution, batch: batchSize, activeTab });
        newUrls.forEach(url => addFile({ name: `ComfyUI - ${new Date().toLocaleTimeString()}`, type: 'image', url: url }));
        
      } else {
        const response = await fetch('/api/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engine,
            baseUrl: apiSettings.baseUrl,
            apiKey: apiSettings.apiKey,
            modelId: selectedModel,
            prompt: finalPrompt,
            n: batchSize,
            size: resolution,
            quality,
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
        updateNodeData(id, { images: newUrls, imageUrl: newUrls[0], prompt, model: selectedModel, resolution, batch: batchSize, activeTab });
        newUrls.forEach((url, idx) => addFile({ name: `${selectedModel} (${idx + 1}) - ${new Date().toLocaleTimeString()}`, type: 'image', url: url }));
      }

    } catch (error: any) {
      console.error('Generation failed:', error);
      if (activeTab === 'comfyui') {
        const comfyUrl = settings.apiSettings.comfyUrl || 'http://127.0.0.1:8188';
        const isLocal = comfyUrl.includes('127.0.0.1') || comfyUrl.includes('localhost') || comfyUrl.includes('192.168.') || comfyUrl.includes('10.');
        if (isLocal) {
          alert(`ComfyUI 本地图片生成失败：\n${error.message || '未知错误'}\n\n💡 诊断建议：\n1. 请确认您的本地 ComfyUI 服务已正常打开运行，且监听了 8188 端口。\n2. 跨域拦截: 请在本地命令行启动 ComfyUI 时附带 "--allow-cors" 参数以支持跨域访问。\n3. HTTPS 限制: 在侧栏“设置”中，点击「在浏览器中打开」，弹出的新页面可能会拦截不安全内容，可以在浏览器地址栏左侧的“网站设置”中，将“不安全内容”设为“允许”。`);
        } else {
          alert(`ComfyUI 远程图片生成失败：\n${error.message || '未知错误'}\n\n💡 诊断建议：\n1. 请检查您的 ComfyUI 远程服务地址 (URL) 输入是否完全正确。\n2. 如果使用了公网代理（如 ngrok 等），请确保代理隧道处于 ACTIVE 在线状态，并且服务端已被正确映射启动。`);
        }
      } else {
        alert(`图片生成失败: ${error.message || '未知错误'}`);
      }
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

  const getContainerAspect = () => {
    let ratioStr = '1:1';
    if (activeTab === 'gpt') ratioStr = gptRatio;
    else if (activeTab === 'banana') ratioStr = bananaRatio;
    else if (activeTab === 'runninghub') ratioStr = rhRatio;
    else if (activeTab === 'jimeng') ratioStr = jmRatio;
    
    if (!ratioStr || ratioStr === '自动' || ratioStr === 'auto') {
      return '1/1';
    }
    return ratioStr.replace(':', '/');
  };
  const containerAspect = getContainerAspect();

  const renderTabs = () => {
    return (
      <div className="flex bg-[#0f0f11]/70 p-1 rounded-2xl gap-1 mb-4 border border-white/5 shadow-inner nodrag">
        {ENGINE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const IconComp = tab.icon;
          
          return (
            <button
              key={tab.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id); handleUpdateField('activeTab', tab.id); }}
              className={`flex items-center justify-center gap-2 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-[12px] flex-1 min-w-0 ${
                isActive 
                  ? 'bg-zinc-100 text-black shadow-lg scale-102' 
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
              }`}
              title={tab.name}
            >
              <IconComp size={13} className={isActive ? 'text-indigo-600' : 'text-zinc-400'} />
              {isActive && <span className="text-[10px] font-sans tracking-wide truncate">{tab.name}</span>}
            </button>
          );
        })}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'gpt':
        return (
          <div className="grid grid-cols-2 gap-3 mb-4 text-[11px] nodrag">
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">服务商</span>
              <select 
                value={gptProvider} 
                onChange={(e) => { e.stopPropagation(); setGptProvider(e.target.value); handleUpdateField('gptProvider', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="OpenAI">OpenAI</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">模型</span>
              <select 
                value={gptModel} 
                onChange={(e) => { e.stopPropagation(); setGptModel(e.target.value); handleUpdateField('gptModel', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="gpt-image-2">gpt-image-2</option>
                <option value="dall-e-3">dall-e-3</option>
                <option value="dall-e-2">dall-e-2</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">比例</span>
              <select 
                value={gptRatio} 
                onChange={(e) => { e.stopPropagation(); setGptRatio(e.target.value); handleUpdateField('gptRatio', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="自动">自动 (Auto)</option>
                <option value="1:1">1:1</option>
                <option value="3:4">3:4</option>
                <option value="4:3">4:3</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="3:2">3:2</option>
                <option value="2:3">2:3</option>
                <option value="21:9">21:9</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">尺寸</span>
              <select 
                value={gptSize} 
                onChange={(e) => { e.stopPropagation(); setGptSize(e.target.value); handleUpdateField('gptSize', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="默认">默认</option>
                <option value="1024x1024">1024x1024</option>
                <option value="1024x768">1024x768</option>
                <option value="768x1024">768x1024</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">质量</span>
              <select 
                value={gptQuality} 
                onChange={(e) => { e.stopPropagation(); setGptQuality(e.target.value); handleUpdateField('gptQuality', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="auto">auto</option>
                <option value="standard">standard</option>
                <option value="hd">hd</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">数量</span>
              <select 
                value={gptBatch} 
                onChange={(e) => { e.stopPropagation(); setGptBatch(Number(e.target.value)); handleUpdateField('gptBatch', Number(e.target.value)); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value={1}>1 张</option>
                <option value={2}>2 张</option>
                <option value={4}>4 张</option>
              </select>
            </div>
            <div className="col-span-2 mt-1">
              <div className="flex items-center justify-between py-2 px-3 bg-[#0d0d0f]/50 backdrop-blur-md rounded-xl border border-white/5">
                <span className="text-gray-400 font-bold">第三方网关异步轮询</span>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setGptAsync(!gptAsync); handleUpdateField('gptAsync', !gptAsync); }}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer border-none ${gptAsync ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${gptAsync ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        );
      case 'banana':
        return (
          <div className="grid grid-cols-2 gap-3 mb-4 text-[11px] nodrag">
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">服务商</span>
              <select 
                value={bananaProvider} 
                onChange={(e) => { e.stopPropagation(); setBananaProvider(e.target.value); handleUpdateField('bananaProvider', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="Google AI">Google AI</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">模型</span>
              <select 
                value={bananaModel} 
                onChange={(e) => { e.stopPropagation(); setBananaModel(e.target.value); handleUpdateField('bananaModel', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[9px] truncate"
              >
                <option value="gemini-2.0-flash-preview-image-generation">gemini-2.0-flash-preview...</option>
                <option value="imagen-3.0-generate-001">imagen-3.0-generate-001</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">比例</span>
              <select 
                value={bananaRatio} 
                onChange={(e) => { e.stopPropagation(); setBananaRatio(e.target.value); handleUpdateField('bananaRatio', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="auto">auto</option>
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">分辨率</span>
              <select 
                value={bananaResolution} 
                onChange={(e) => { e.stopPropagation(); setBananaResolution(e.target.value); handleUpdateField('bananaResolution', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">数量</span>
              <select 
                value={bananaBatch} 
                onChange={(e) => { e.stopPropagation(); setBananaBatch(Number(e.target.value)); handleUpdateField('bananaBatch', Number(e.target.value)); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value={1}>1 张</option>
                <option value={2}>2 张</option>
                <option value={4}>4 张</option>
              </select>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between py-2 px-3 bg-[#0d0d0f]/50 backdrop-blur-md rounded-xl border border-white/5 h-9">
                <span className="text-gray-400 font-bold">异步轮询</span>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setBananaAsync(!bananaAsync); handleUpdateField('bananaAsync', !bananaAsync); }}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer border-none ${bananaAsync ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${bananaAsync ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        );
      case 'runninghub':
        return (
          <div className="grid grid-cols-2 gap-3 mb-4 text-[11px] nodrag">
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">功能</span>
              <select 
                value={rhFunction} 
                onChange={(e) => { e.stopPropagation(); setRhFunction(e.target.value); handleUpdateField('rhFunction', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="全能图片">全能图片</option>
                <option value="参考设计">参考设计</option>
                <option value="文生图">文生图</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">模型</span>
              <select 
                value={rhModel} 
                onChange={(e) => { e.stopPropagation(); setRhModel(e.target.value); handleUpdateField('rhModel', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="全能图片V2">全能图片V2</option>
                <option value="全能图片V1">全能图片V1</option>
                <option value="SDXL_Turbo">SDXL_Turbo</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">分辨率</span>
              <select 
                value={rhResolution} 
                onChange={(e) => { e.stopPropagation(); setRhResolution(e.target.value); handleUpdateField('rhResolution', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="2K">2K</option>
                <option value="1K">1K</option>
                <option value="4K">4K</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">比例</span>
              <select 
                value={rhRatio} 
                onChange={(e) => { e.stopPropagation(); setRhRatio(e.target.value); handleUpdateField('rhRatio', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="auto">auto</option>
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-gray-500 font-bold uppercase tracking-wider">数量</span>
              <select 
                value={rhBatch} 
                onChange={(e) => { e.stopPropagation(); setRhBatch(Number(e.target.value)); handleUpdateField('rhBatch', Number(e.target.value)); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value={1}>1 张</option>
                <option value={2}>2 张</option>
                <option value={4}>4 张</option>
              </select>
            </div>
          </div>
        );
      case 'comfyui':
        return (
          <div className="flex flex-col gap-3.5 mb-4 text-[11px] bg-black/10 p-3.5 rounded-2xl border border-white/5 nodrag">
            <span className="text-zinc-500 font-bold leading-relaxed text-[11px]">
              在侧栏「ComfyUI」配置服务地址与工作流文件夹
            </span>
            <button 
              type="button"
              onClick={handleLaunchComfyUI}
              disabled={launching}
              className={`w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-heavy py-2.5 px-4 rounded-xl shadow-lg hover:shadow-indigo-550/20 active:scale-98 transition-all flex items-center justify-center gap-2 mt-1 h-9 select-none cursor-pointer border-none text-[11px] ${launching ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Play size={13} fill="currentColor" className={launching ? 'animate-spin' : ''} /> 
              {launching ? '正在唤醒启动器...' : '启动 ComfyUI'}
            </button>
            
            <div className="flex flex-col gap-1 mt-1.5">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">工作流</span>
              <select 
                value={comfyWorkflow} 
                onChange={(e) => { e.stopPropagation(); setComfyWorkflow(e.target.value); handleUpdateField('comfyWorkflow', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-400 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                {settings.apiSettings.comfyWorkflowPath === '未选择目录' ? (
                  <option value="请先在设置中选择文件夹">⚠️ 请先在设置中选择工作流目录</option>
                ) : (
                  (settings.apiSettings.comfyWorkflows || []).map((wf) => (
                    <option key={wf} value={wf}>{wf}</option>
                  ))
                )}
              </select>
            </div>
            
            <div className="text-[10px] font-mono text-zinc-500 mt-1.5 flex items-center gap-2 bg-black/15 px-3 py-2 rounded-xl border border-white/5 select-none">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span>服务地址: {settings.apiSettings.comfyUrl || 'http://127.0.0.1:8188'}</span>
            </div>
          </div>
        );
      case 'jimeng':
        return (
          <div className="grid grid-cols-2 gap-3 mb-4 text-[11px] nodrag">
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">模型</span>
              <select 
                value={jmModel} 
                onChange={(e) => { e.stopPropagation(); setJmModel(e.target.value); handleUpdateField('jmModel', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[10px]"
              >
                <option value="doubao-seedream-5-0-260128">doubao-seedream-5-0...</option>
                <option value="doubao-image-v2">doubao-image-v2</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">生成模式</span>
              <select 
                value={jmMode} 
                onChange={(e) => { e.stopPropagation(); setJmMode(e.target.value); handleUpdateField('jmMode', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="单图">单图</option>
                <option value="多图">多图</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">比例</span>
              <select 
                value={jmRatio} 
                onChange={(e) => { e.stopPropagation(); setJmRatio(e.target.value); handleUpdateField('jmRatio', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">分辨率</span>
              <select 
                value={jmResolution} 
                onChange={(e) => { e.stopPropagation(); setJmResolution(e.target.value); handleUpdateField('jmResolution', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="2K">2K</option>
                <option value="1K">1K</option>
                <option value="4K">4K</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-gray-500 font-bold uppercase tracking-wider">数量</span>
              <select 
                value={jmBatch} 
                onChange={(e) => { e.stopPropagation(); setJmBatch(Number(e.target.value)); handleUpdateField('jmBatch', Number(e.target.value)); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value={1}>1 张</option>
                <option value={2}>2 张</option>
                <option value={4}>4 张</option>
              </select>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border w-full h-full ${selected ? 'border-[var(--accent)] shadow-[0_0_20px_var(--accent)]/30' : 'border-[var(--border)]'} rounded-3xl shadow-2xl overflow-visible group/node transition-all flex flex-col pointer-events-auto ${
        isDragOver ? 'ring-4 ring-accent/10' : ''
      } ${
        settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
      }`}
    >
      <NodeResizer 
        color="var(--accent)" 
        isVisible={selected} 
        minWidth={440}
        minHeight={550}
        keepAspectRatio={false}
        handleStyle={{ width: 12, height: 12, borderRadius: 3, background: 'white', border: '2px solid var(--accent)' }}
      />
      <ScaleWrapper id={id} type="image-gen" disableDynamicHeight={false}>
        <div className={`p-4 border-b border-[var(--border)] flex items-center justify-between transition-all rounded-t-3xl shrink-0 react-flow__node-draghandle ${
          settings.barTexture === 'frosted' ? 'frosted-glass border-b-white/5' : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
        }`}>
          <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
            <Sparkles size={18} className="text-accent shrink-0" />
            <span className="text-[14px] font-bold tracking-wider">生成图像</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); previewUrls.forEach((url, idx) => downloadImage(url, `generated-image-${id}-${idx}.png`)); }}
              disabled={previewUrls.length === 0}
              className="p-1.5 disabled:opacity-50 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] transition-colors hover:text-accent cursor-pointer"
              title="下载全部生成图片"
            >
              <Download size={14} />
            </button>
            <button 
              type="button"
              onClick={() => removeNode(id)}
              className="p-1.5 hover:bg-red-500/10 rounded-lg text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer"
              title="删除节点"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Generated Image Preview Grid Area */}
        <div className={`p-4 min-h-[220px] flex items-center justify-center relative border-b border-[var(--border)] ${
          settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-[var(--bg-primary)]/40'
        }`}>
          <div className={`grid gap-4 w-full h-full relative z-10 ${
            previewUrls.length === 1 ? 'grid-cols-1 font-bold' :
            previewUrls.length === 2 ? 'grid-cols-2' :
            previewUrls.length === 4 ? 'grid-cols-2' : 'grid-cols-1'
          }`}>
            {previewUrls.length > 0 ? (
              previewUrls.map((url, idx) => (
                <div 
                  key={idx} 
                  style={{ aspectRatio: containerAspect }} 
                  className="w-full flex items-center justify-center overflow-hidden border border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)] relative group/prev hover:border-zinc-500 transition-all shadow-md shrink-0"
                >
                  <img draggable={false} src={url} alt={`Generated ${idx}`} className="w-full h-full object-cover select-none" />
                  
                  {/* Deletion & Redo Floating Hover Buttons */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/prev:opacity-100 transition-all duration-150 flex items-center justify-center gap-3">
                    <button 
                      type="button"
                      onClick={(e) => handleRedoPreview(idx, e)}
                      className="p-2 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer pointer-events-auto flex items-center justify-center"
                      title="重试 / 重新生成"
                    >
                      <RotateCw size={14} className="text-zinc-100" />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => handleDeletePreview(idx, e)}
                      className="p-2 bg-red-950/90 border border-red-500/20 hover:bg-red-600 hover:text-white text-red-400 rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer pointer-events-auto flex items-center justify-center"
                      title="删除"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]/30 min-h-[180px] select-none">
                <Sparkles size={40} strokeWidth={1} className="text-zinc-600 animate-pulse" />
                <span className="text-[11px] tracking-widest text-zinc-600 uppercase font-black">等待图像生成</span>
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

        {/* Configurations, Connected Images & Controls Area */}
        <div className={`p-5 transition-all rounded-b-3xl ${
          settings.barTexture === 'frosted' ? 'bg-white/5 border-t-white/5' : 'bg-[var(--bg-secondary)]'
        }`}>
          
          {/* 1. Sleek Engine Tabs Selector */}
          {renderTabs()}

          {/* 2. Interactive Form Parameter Fields For Active Tab */}
          {renderTabContent()}

          {/* 3. Horizontal Connected Reference Source Images Container [Fig 8] */}
          {incomingImages.length > 0 && (
            <div className="flex flex-col gap-2 mb-4 nodrag bg-[#0d0d0f]/20 py-3 px-4 rounded-2xl border border-white/5 shadow-inner">
              <div className="flex items-center justify-between select-none">
                <span className="text-[10px] font-black text-zinc-400 tracking-widest uppercase flex items-center gap-2">
                  <Images size={13} className="text-indigo-500" /> 连接的参考图
                </span>
                <span className="text-[9px] font-mono text-zinc-500 font-bold">{incomingImages.length} 个资源已连接</span>
              </div>
              
              <div className="flex gap-3 overflow-x-auto py-1.5 custom-scrollbar scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {incomingImages.map((url, index) => (
                  <div key={index} className="flex flex-col items-center gap-1.5 shrink-0 group/ref relative">
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-[#121214] flex items-center justify-center relative shadow-sm">
                      <img src={url} alt={`Ref ${index + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/ref:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-[8px] font-black text-white uppercase bg-indigo-600 px-1.5 py-0.5 rounded-md">@ {index + 1}</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-zinc-500">图片 {index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Interactive Input Textarea Area */}
          <div className="relative mb-4 nodrag">
            <textarea
              style={getFontSizeStyle()}
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); handleUpdateField('prompt', e.target.value); }}
              className={`w-full bg-[#121214]/60 border border-white/5 rounded-2xl p-4 pr-12 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50 resize-none min-h-[96px] placeholder:text-[var(--text-secondary)]/40 transition-all custom-scrollbar ${getFontSizeClass()}`}
              placeholder="描述你想要生成的内容，输入 @ 可引用已连接的参考图..."
            />
          </div>

          {/* 5. Giga Generate Trigger Button [Fig 2-6 bottom] */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || (!prompt && incomingImages.length === 0)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-heavy text-xs tracking-widest py-3 px-5 rounded-2xl shadow-xl hover:shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2 border-none select-none cursor-pointer nodrag"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span className="uppercase font-bold tracking-wider">正在生成图像...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span className="uppercase font-bold tracking-wider">生成图片</span>
              </>
            )}
          </button>

        </div>
      </ScaleWrapper>

      {/* Inputs / Outputs handles */}
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!bg-green-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:scale-110 hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white before:content-['+'] before:text-lg before:leading-none"  
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!bg-green-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:scale-110 hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white before:content-['+'] before:text-lg before:leading-none"  
      />
    </div>
  );
};
