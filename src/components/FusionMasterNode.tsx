import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { 
  Layers, 
  Sparkles, 
  Settings2, 
  X, 
  Upload, 
  Image as ImageIcon,
  ChevronRight,
  Command,
  Plus,
  RefreshCw,
  Search,
  Scan,
  Zap,
  Info,
  Maximize2 as Maximize,
  Minimize2 as Minimize,
  Activity,
  Cpu,
  Monitor,
  Terminal,
  Grid,
  Copy,
  Check,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateTextWithFallback } from '../lib/gemini';
import { useStore } from '../store/useStore';
import { DEFAULT_FRAMEWORK } from '../data/defaultFramework';
import { ScaleWrapper } from './ScaleWrapper';

const FusionMasterNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameworkInputRef = useRef<HTMLInputElement>(null);
  const [showTools, setShowTools] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [mode, setMode] = useState<'Mode A' | 'Mode B' | 'Mode C'>(data?.mode || 'Mode A');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragCounters = useRef<{ [key: string]: number }>({
    productMaster: 0,
    sceneReference: 0,
    node: 0
  });
  const [isDragOver, setIsDragOver] = useState<{ [key: string]: boolean }>({
    productMaster: false,
    sceneReference: false,
  });
  
  const [mainSlots, setMainSlots] = useState<{ [key: string]: string | null }>({
    productMaster: data?.productMaster || null,
    sceneReference: data?.sceneReference || null,
  });

  const updateNodeData = (nodeId: string, newData: any) => {
    // Port to parent component
    if (data?.onDataUpdate) data.onDataUpdate(nodeId, newData);
  };
  
  const [supportAssets, setSupportAssets] = useState<string[]>(data?.supportAssets || []);
  const [userPrompt, setUserPrompt] = useState(data?.userPrompt || '');
  const [framework, setFramework] = useState(data?.framework || DEFAULT_FRAMEWORK);
  const [frameworkName, setFrameworkName] = useState(data?.frameworkName || '');
  const [resultPrompt, setResultPrompt] = useState(data?.resultPrompt || '');
  const [copied, setCopied] = useState(false);

  const [commands, setCommands] = useState<{[key: string]: string[] }>(data?.commands || {
    'Mode A': [
      '模式A：PRODUCT MASTER 是产品主控图，请严格保持PRODUCT MASTER 的外观结构、材质、大小、位置、角度、透视、细节、Logo等所有特征完全不变，仅重绘和生成适合产品的背景空间',
      '模式A：PRODUCT MASTER 产品完全不动，严格保持结构、材质、大小、位置、方向、透视、裁切、Logo等特征完全一致，仅通过Prompt描述和SCENE REFERENCE提供的环境光影、色调、构图需求来完成场景融合'
    ],
    'Mode B': [
      '模式B：SCENE REFERENCE 是场景参考图，请深度分析参考图的构图、光影、色阶、视角，并以此为基础进行创意性融合',
      '模式B：保持场景逻辑一致性，允许在细节处进行智能微调'
    ],
    'Mode C': [
      '模式C：深度分析单张图片的色调、构图和提示词逻辑',
      '模式C：仅处理场景逻辑，不涉及PRODUCT MASTER，适用于纯场景参考、视觉反推、构图解析等特定场景需求'
    ]
  });

  // Sync state to React Flow data
  useEffect(() => {
    updateNodeData(id, { 
      productMaster: mainSlots.productMaster, 
      sceneReference: mainSlots.sceneReference,
      mode,
      userPrompt,
      framework,
      frameworkName,
      resultPrompt,
      commands,
      supportAssets
    });
  }, [mainSlots, mode, userPrompt, framework, frameworkName, resultPrompt, commands, supportAssets]);

  // ESC key for fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeSlot) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setMainSlots(prev => ({ ...prev, [activeSlot]: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFrameworkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFrameworkName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        let text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object') {
              if (parsed.framework) {
                text = typeof parsed.framework === 'string' ? parsed.framework : JSON.stringify(parsed.framework, null, 2);
              } else if (parsed.prompt) {
                text = typeof parsed.prompt === 'string' ? parsed.prompt : JSON.stringify(parsed.prompt, null, 2);
              } else {
                text = JSON.stringify(parsed, null, 2);
              }
            }
          } catch (err) {
            console.error('Failed to parse uploaded JSON framework, loading as plain text:', err);
          }
        }
        setFramework(text);
      };
      reader.readAsText(file);
    }
  };

  const triggerUpload = (slot: string) => {
    setActiveSlot(slot);
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent, slot?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Explicitly set dropEffect to copy to signal browser that we handle this
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent, slot: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounters.current[slot]++;
    if (dragCounters.current[slot] === 1) {
      setIsDragOver(prev => ({ ...prev, [slot]: true }));
    }
  };

  const handleDragLeave = (e: React.DragEvent, slot: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounters.current[slot]--;
    if (dragCounters.current[slot] === 0) {
      setIsDragOver(prev => ({ ...prev, [slot]: false }));
    }
  };

  const handleSlotDrop = (e: React.DragEvent, slot: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounters.current[slot] = 0;
    setIsDragOver(prev => ({ ...prev, [slot]: false }));

    const dataTransfer = e.dataTransfer;
    
    // 1. Try to get files directly
    const files = dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setMainSlots(prev => ({ ...prev, [slot]: event.target?.result as string }));
          };
          reader.readAsDataURL(file);
        }
      });
      return;
    }

    // 2. Try to get image from items (handles some browser-specific drag-drops)
    if (dataTransfer.items) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        if (dataTransfer.items[i].kind === 'file' && dataTransfer.items[i].type.startsWith('image/')) {
          const file = dataTransfer.items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              setMainSlots(prev => ({ ...prev, [slot]: event.target?.result as string }));
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    }

    // 3. Fallback to data from other nodes or text/urls
    const rfDataRaw = dataTransfer.getData('application/reactflow/data');
    const rfDataOldRaw = dataTransfer.getData('application/reactflow');
    
    if (rfDataRaw) {
      try {
        const d = JSON.parse(rfDataRaw);
        if (d.imageUrl || d.url) {
          setMainSlots(prev => ({ ...prev, [slot]: d.imageUrl || d.url }));
          return;
        }
      } catch (err) {}
    }

    if (rfDataOldRaw) {
      try {
        const nodeData = JSON.parse(rfDataOldRaw);
        if (nodeData.imageUrl) { // ImageNode uses imageUrl
          setMainSlots(prev => ({ ...prev, [slot]: nodeData.imageUrl }));
          return;
        }
        if (nodeData.url) {
          setMainSlots(prev => ({ ...prev, [slot]: nodeData.url }));
          return;
        }
      } catch (err) {}
    }

    const url = dataTransfer.getData('text/plain') || dataTransfer.getData('url');
    if (url && (url.startsWith('http') || url.startsWith('data:'))) {
      setMainSlots(prev => ({ ...prev, [slot]: url }));
    }
  };

  const handlePaste = (e: React.ClipboardEvent, slot: string) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setMainSlots(prev => ({ ...prev, [slot]: event.target?.result as string }));
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
  };

  const addCommand = () => {
    const newCommands = { ...commands };
    newCommands[mode] = [...newCommands[mode], 'New Custom Directive...'];
    setCommands(newCommands);
  };

  const editCommand = (idx: number, val: string) => {
    const newCommands = { ...commands };
    newCommands[mode][idx] = val;
    setCommands(newCommands);
  };

  const deleteCommand = (idx: number) => {
    const newCommands = { ...commands };
    newCommands[mode] = newCommands[mode].filter((_, i) => i !== idx);
    setCommands(newCommands);
  };

  const applyCommand = (cmd: string) => {
    setUserPrompt(prev => prev + (prev ? '\n' : '') + cmd);
  };

  const ensureBase64 = async (url: string): Promise<string> => {
    if (!url) return '';
    if (url.startsWith('data:')) {
      return url.split(',')[1];
    }
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error('Failed to convert image url to base64 in FusionMaster:', err);
      // Fallback
      if (url.includes(';base64,')) {
        return url.split(';base64,')[1];
      }
      return '';
    }
  };

  const runAnalysis = async () => {
    if (mode !== 'Mode C' && (!mainSlots.productMaster || !mainSlots.sceneReference)) return;
    if (mode === 'Mode C' && !mainSlots.sceneReference) return;

    setIsProcessing(true);
    setResultPrompt('');
    try {
      const systemPrompt = `[FUSION MASTER SYSTEM]
CONTEXT: ${framework}
CURRENT MODE: ${mode}
OPERATIONAL GUIDELINES:
${commands[mode].join('\n')}

Analyze the provided visual assets and generate a high-fidelity fusion prompt. Focus on:
1. Spatial geometry preservation.
2. Lighting matching (Global Illumination, Caustics).
3. Material interaction.
4. Composition integrity.
5. Technical parameters (Shutter speed, Focal length, ISO).

OUTPUT FORMAT: Provide a comprehensive engineered prompt in plain text.`;

      const attachments: any[] = [];
      if (mode !== 'Mode C' && mainSlots.productMaster) {
        const base64 = await ensureBase64(mainSlots.productMaster);
        if (base64) {
          attachments.push({
            type: "image/png",
            base64,
            name: "productMaster.png"
          });
        }
      }

      if (mainSlots.sceneReference) {
        const base64 = await ensureBase64(mainSlots.sceneReference);
        if (base64) {
          attachments.push({
            type: "image/png",
            base64,
            name: "sceneReference.png"
          });
        }
      }

      const prompt = `User Input: ${userPrompt || 'Analyze these images and provide the fusion prompt.'}`;
      const responseText = await generateTextWithFallback(prompt, systemPrompt, attachments);
      setResultPrompt(responseText);
    } catch (error) {
      console.error('Core Fusion Engine Error:', error);
      setResultPrompt(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const [toolUrl, setToolUrl] = useState('https://ais-pre-jfhjab27dnu3slxhgooqtv-64590648228.run.app/');

  const NodeHeader = ({ inFullscreen = false }) => (
    <div className={`flex items-center justify-between px-6 py-5 border-b border-[var(--border)] bg-black/40 backdrop-blur-xl react-flow__node-draghandle ${inFullscreen ? 'py-4 px-8' : ''} rounded-t-2xl`}>
      <div className="flex items-center gap-4">
        <div className={`p-3 bg-accent rounded-2xl shadow-lg ring-4 ring-accent/10 ${inFullscreen ? 'scale-110' : ''}`}>
          <Layers size={inFullscreen ? 24 : 20} className="text-white" />
        </div>
        <div>
          <h2 className={`${inFullscreen ? 'text-lg' : 'text-base'} font-black text-white tracking-[0.2em] uppercase`}>Fusion Master <span className="ml-2 px-1.5 py-0.5 bg-orange-500/10 text-orange-500 rounded text-sm border border-orange-500/20">V5.9.1</span></h2>
          <p className="text-sm text-gray-500 font-bold mt-1 uppercase tracking-wider">AI Product Fusion & Reverse Engineering</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsFullscreen(!isFullscreen);
          }} 
          className={`p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition-all border border-[var(--border)] ${inFullscreen ? 'scale-110' : ''}`}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
        >
          {isFullscreen ? <Minimize size={inFullscreen ? 20 : 18} /> : <Maximize size={inFullscreen ? 20 : 18} />}
        </button>
        {!inFullscreen && (
          <button onClick={(e) => { e.stopPropagation(); setShowTools(!showTools); }} className={`p-2.5 rounded-xl transition-all border ${showTools ? 'bg-accent border-accent' : 'bg-white/5 border-[var(--border)] hover:bg-white/10'}`}>
            <Settings2 size={18} className={showTools ? 'text-white' : 'text-gray-400'} />
          </button>
        )}
      </div>
    </div>
  );

  const ControlPanel = ({ inFullscreen = false }) => (
    <div className={`space-y-8 ${inFullscreen ? 'p-0' : ''}`}>
      {/* Visual Asset Binding */}
      <div className={`grid gap-4 ${mode === 'Mode C' ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {mode !== 'Mode C' && (
          <div 
            onDragOver={(e) => handleDragOver(e, 'productMaster')}
            onDragEnter={(e) => handleDragEnter(e, 'productMaster')}
            onDragLeave={(e) => handleDragLeave(e, 'productMaster')}
            onDrop={(e) => handleSlotDrop(e, 'productMaster')}
            onPaste={(e) => handlePaste(e, 'productMaster')}
            className={`aspect-square rounded-[24px] border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-all group pointer-events-auto ${
              isDragOver.productMaster ? 'border-accent bg-accent/20 scale-[1.02]' : 
              mainSlots.productMaster ? 'border-accent/30 bg-accent/5' : 'border-[var(--border)] bg-white/2 hover:border-accent/20'
            }`}
          >
            <div className="w-full h-full flex flex-col items-center justify-center">
              {mainSlots.productMaster ? (
                <div className="w-full h-full relative">
                  <img draggable={false} src={mainSlots.productMaster!} className="w-full h-full object-cover" alt="Product Master" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                    <button onClick={() => triggerUpload('productMaster')} className="p-2.5 bg-accent rounded-xl text-white pointer-events-auto"><ImageIcon size={18} /></button>
                    <button onClick={() => setMainSlots(prev => ({ ...prev, productMaster: null }))} className="p-2.5 bg-red-500 rounded-xl text-white pointer-events-auto"><X size={18} /></button>
                  </div>
                  <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-[var(--border)] text-[10px] font-black text-white/70 uppercase tracking-widest">PRODUCT MASTER</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center cursor-pointer p-6 text-center" onClick={() => triggerUpload('productMaster')}>
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload size={24} className="text-gray-500 group-hover:text-accent" />
                  </div>
                  <span className="text-sm font-black text-gray-500 uppercase tracking-widest">Product Master</span>
                  <p className="text-[10px] text-gray-700 mt-2 font-bold uppercase">Click, Drag or Paste</p>
                </div>
              )}
            </div>

            {/* Drop Overlay */}
            {isDragOver.productMaster && (
              <div className="absolute inset-0 bg-accent/10 backdrop-blur-[2px] pointer-events-none z-50 flex items-center justify-center">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                  <Upload size={24} className="text-white" />
                </div>
              </div>
            )}
          </div>
        )}
        
        <div 
          onDragOver={(e) => handleDragOver(e, 'sceneReference')}
          onDragEnter={(e) => handleDragEnter(e, 'sceneReference')}
          onDragLeave={(e) => handleDragLeave(e, 'sceneReference')}
          onDrop={(e) => handleSlotDrop(e, 'sceneReference')}
          onPaste={(e) => handlePaste(e, 'sceneReference')}
          className={`aspect-square rounded-[24px] border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-all group pointer-events-auto ${
            isDragOver.sceneReference ? 'border-accent bg-accent/20 scale-[1.02]' :
            mainSlots.sceneReference ? 'border-accent/30 bg-accent/5' : 'border-[var(--border)] bg-white/2 hover:border-accent/20'
          } ${mode === 'Mode C' ? 'max-w-[420px] mx-auto w-full' : ''}`}
        >
          <div className="w-full h-full flex flex-col items-center justify-center">
            {mainSlots.sceneReference ? (
              <div className="w-full h-full relative">
                <img draggable={false} src={mainSlots.sceneReference!} className="w-full h-full object-cover" alt="Scene Reference" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                  <button onClick={() => triggerUpload('sceneReference')} className="p-2.5 bg-accent rounded-xl text-white pointer-events-auto"><ImageIcon size={18} /></button>
                  <button onClick={() => setMainSlots(prev => ({ ...prev, sceneReference: null }))} className="p-2.5 bg-red-500 rounded-xl text-white pointer-events-auto"><X size={18} /></button>
                </div>
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-[var(--border)] text-[10px] font-black text-white/70 uppercase tracking-widest">
                  {mode === 'Mode C' ? 'REVERSE TARGET' : 'SCENE REFERENCE'}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center cursor-pointer p-6 text-center" onClick={() => triggerUpload('sceneReference')}>
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload size={24} className="text-gray-500 group-hover:text-accent" />
                </div>
                <span className="text-sm font-black text-gray-500 uppercase tracking-widest">
                  {mode === 'Mode C' ? 'REVERSE TARGET' : 'SCENE REFERENCE'}
                </span>
                <p className="text-[10px] text-gray-700 mt-2 font-bold uppercase">Click, Drag or Paste</p>
              </div>
            )}
          </div>

          {/* Drop Overlay */}
          {isDragOver.sceneReference && (
              <div className="absolute inset-0 bg-accent/10 backdrop-blur-[2px] pointer-events-none z-50 flex items-center justify-center">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                  <Upload size={24} className="text-white" />
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Logic Config */}
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-gray-500 uppercase tracking-widest">Fusion Engine Modes</span>
            <div className="flex bg-white/5 p-1 rounded-xl border border-[var(--border)] overflow-hidden">
              {['Mode A', 'Mode B', 'Mode C'].map((m) => (
                <button 
                  key={m}
                  onClick={() => setMode(m as any)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-black transition-all ${mode === m ? 'bg-accent text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {m.split(' ')[1]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-accent/5 border border-accent/10 rounded-2xl">
            <div className="flex gap-3">
              <div className="p-2 bg-accent/20 rounded-lg shrink-0">
                <Scan size={14} className="text-accent" />
              </div>
              <div>
                <p className="text-sm text-accent font-black uppercase tracking-widest">视觉逻辑</p>
                <p className="text-base text-gray-400 mt-1 leading-relaxed">
                  {mode === 'Mode A' ? '保持产品角度不变，生成适配产品的背景。' : (mode === 'Mode B' ? '基于参考图进行创意性融合，允许光效调整。' : '深度分析单张图片色调、构图和提示词逻辑。')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
           <div className="flex items-center justify-between">
              <span className="text-sm font-black text-gray-500 uppercase tracking-widest">Standard Commands</span>
              <Plus size={14} className="text-accent cursor-pointer hover:scale-125 transition-transform" onClick={(e) => { e.stopPropagation(); addCommand(); }} />
           </div>
           {commands[mode].map((cmd, i) => (
             <div 
               key={i} 
               onClick={() => applyCommand(cmd)}
               className="p-3.5 bg-black/40 border border-[var(--border)] rounded-2xl text-sm text-gray-400 font-medium leading-relaxed hover:border-accent/30 transition-all group cursor-pointer active:scale-95 relative"
             >
               <div className="flex gap-3">
                 <Command size={12} className="text-gray-700 shrink-0 mt-0.5 group-hover:text-accent" />
                 <textarea
                   className={`nodrag nopan bg-transparent border-none outline-none ${getFontSizeClass()} text-gray-400 w-full font-medium resize-none scrollbar-hide`}
                   value={cmd}
                   rows={2}
                   onClick={(e) => e.stopPropagation()}
                   onChange={(e) => editCommand(i, e.target.value)}
                 />
                 <button 
                   onClick={(e) => { e.stopPropagation(); deleteCommand(i); }}
                   className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-all"
                 >
                   <X size={10} className="text-red-500" />
                 </button>
               </div>
             </div>
           ))}
        </div>

        <div className="space-y-3">
          <span className="text-sm font-black text-gray-500 uppercase tracking-widest">Iterative Prompt Refinement</span>
          <textarea 
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="追问或特殊分析指令或优化建议..."
            className={`nodrag nopan w-full min-h-[100px] p-4 bg-black/40 border border-[var(--border)] rounded-2xl ${getFontSizeClass()} text-gray-300 outline-none focus:border-accent/50 transition-all font-medium scrollbar-hide resize-none font-mono`}
          />
        </div>

        {/* Core Analysis Output Terminal */}
        {(resultPrompt || isProcessing) && (
          <div className="space-y-3 relative">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black text-accent uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                <Terminal size={12} /> Analysis Engine Output
              </span>
              {resultPrompt && (
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(resultPrompt);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1 px-2.5 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg text-xs text-accent font-bold transition-all flex items-center gap-1.5"
                >
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy Result'}
                </button>
              )}
            </div>
            <div className="relative group overflow-hidden border border-accent/20 bg-black/50 rounded-2xl min-h-[140px] flex flex-col p-4">
              {isProcessing ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                  <RefreshCw className="text-accent animate-spin mb-3" size={24} />
                  <p className="text-xs text-accent font-mono animate-pulse">Executing product fusion framework analysis...</p>
                </div>
              ) : (
                <div className={`text-xs text-accent font-mono leading-relaxed outline-none overflow-y-auto whitespace-pre-wrap max-h-[220px] custom-scrollbar ${getFontSizeClass()}`}>
                  {resultPrompt}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={runAnalysis}
        disabled={isProcessing || (mode !== 'Mode C' && (!mainSlots.productMaster || !mainSlots.sceneReference)) || (mode === 'Mode C' && !mainSlots.sceneReference)}
        className={`w-full py-5 rounded-[24px] flex items-center justify-center gap-3 transition-all font-black text-base uppercase tracking-[0.25em] ${isProcessing ? 'bg-white/5 text-gray-700' : 'bg-accent hover:bg-accent text-white shadow-2xl shadow-accent/30 active:scale-[0.98]'}`}
      >
        {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
        {isProcessing ? 'Analyzing Core Logic...' : 'Run Core Analysis'}
      </button>
    </div>
  );

  const ToolPanel = () => (
    <div className="flex-1 flex flex-col p-6 h-full">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
            Core Instruction Framework
            {frameworkName && <span className="text-xs text-accent px-2 py-0.5 bg-accent/10 border border-accent/20 rounded-full">{frameworkName}</span>}
          </span>
          <button onClick={() => frameworkInputRef.current?.click()} className="px-3 py-1 bg-accent text-white text-sm font-black rounded-lg uppercase flex items-center gap-2"><Upload size={12} /> Upload (.txt/.json)</button>
        </div>
        <div className="p-4 bg-black/60 rounded-2xl border border-[var(--border)] max-h-[150px] overflow-y-auto scrollbar-hide">
          <p className="text-sm text-gray-500 font-mono leading-relaxed">{framework}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4 bg-white/5 p-3 rounded-2xl border border-[var(--border)]">
        <Search size={16} className="text-gray-500" />
        <input type="text" value={toolUrl} onChange={(e) => setToolUrl(e.target.value)} placeholder="Tool URL..." className="nodrag nopan bg-transparent border-none outline-none text-base text-gray-300 w-full font-mono" />
      </div>
      <div className="flex-1 bg-black rounded-2xl border border-[var(--border)] overflow-hidden relative shadow-2xl min-h-[300px]">
        <iframe src={toolUrl} className="w-full h-full border-none bg-white" title="Sandbox" />
        <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/80 backdrop-blur-md rounded-lg border border-[var(--border)] text-sm font-black text-accent uppercase tracking-widest underline decoration-accent/50">Standalone Engine</div>
      </div>
    </div>
  );

  return (
    <>
      <div 
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className={`bg-[var(--bg-primary)] rounded-[32px] border-2 transition-all flex flex-col w-full h-full ${
          selected ? 'border-accent ring-8 ring-accent/10 scale-[1.01]' : 'border-[var(--border)]'
        }`}
      >
        <NodeResizer 
          isVisible={selected} 
          minWidth={400} 
          minHeight={528} 
          keepAspectRatio={true}
        />
        <ScaleWrapper id={id} type="fusion-master">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
          <input type="file" ref={frameworkInputRef} onChange={handleFrameworkUpload} className="hidden" accept=".txt,.json" />
          
          <NodeHeader />

          <div className="flex-1 overflow-y-auto scrollbar-hide nodrag">
            <AnimatePresence mode="wait">
              {!showTools ? (
                <motion.div 
                  key="fusion" 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  className="p-7"
                >
                  <ControlPanel />
                </motion.div>
              ) : (
                <motion.div 
                  key="tools" 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -20 }}
                  className="flex-1"
                >
                  <ToolPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScaleWrapper>

        <Handle type="target" position={Position.Left} className="!bg-green-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none"  />
        <Handle type="source" position={Position.Right} className="!bg-green-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none"  />
      </div>

      {createPortal(
        <AnimatePresence>
          {isFullscreen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] bg-[var(--bg-primary)] flex flex-col font-sans overflow-hidden"
            >
              {/* Fullscreen Header */}
              <div className="h-20 shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border)] flex items-center justify-between px-10">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20">
                      <Layers size={22} className="text-white" />
                    </div>
                    <div>
                      <h1 className="text-lg font-black text-white tracking-[0.2em] uppercase">Fusion Master Pro <span className="ml-2 text-accent font-mono text-sm">LATEST</span></h1>
                      <p className="text-sm text-gray-600 font-bold uppercase tracking-widest flex items-center gap-2">
                        <Activity size={10} className="text-accent/50" /> Focus Mode Engine
                      </p>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-white/5 mx-2" />
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-[var(--border)]">
                      <Terminal size={12} className="text-accent" />
                      <span className="text-sm font-mono text-gray-500 uppercase tracking-tighter">Session: Active</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-[var(--border)]">
                      <Cpu size={12} className="text-accent" />
                      <span className="text-sm font-mono text-gray-500 uppercase tracking-tighter">Kern: AI_v3</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex bg-white/2 p-1 rounded-2xl border border-[var(--border)]">
                    <button className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-all">
                      <Monitor size={14} /> Full Studio
                    </button>
                    <button className="px-5 py-2.5 text-gray-500 hover:text-white rounded-xl text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-all">
                      <Grid size={14} /> Layout Grid
                    </button>
                  </div>
                  <button 
                    onClick={() => setIsFullscreen(false)}
                    className="w-12 h-12 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all border border-red-500/10 shadow-2xl"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Fullscreen Body */}
              <div className="flex-1 flex overflow-hidden">
                {/* Visual Content (Left) */}
                <div className="flex-1 bg-[var(--bg-primary)] p-10 flex items-center justify-center relative overflow-hidden"
                     onDragOver={handleDragOver}
                     onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  <div className="absolute inset-0 opacity-20 pointer-events-none" 
                       style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e40af 0%, transparent 70%)' }} />
                  
                  <div className="w-full max-w-6xl relative z-10">
                    <div className={`grid gap-12 ${mode === 'Mode C' ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-2'}`}>
                      {mode !== 'Mode C' && (
                        <div className="space-y-6 group">
                           <div className="flex items-center justify-between px-2">
                             <span className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                               <Zap size={10} className="text-accent" /> Product Origin
                             </span>
                             <span className="text-sm font-mono text-gray-700 tracking-tighter">SRC_7392_MASTER</span>
                           </div>
                           <div 
                             onDragOver={(e) => handleDragOver(e, 'productMaster')}
                             onDragEnter={(e) => handleDragEnter(e, 'productMaster')}
                             onDragLeave={(e) => handleDragLeave(e, 'productMaster')}
                             onDrop={(e) => handleSlotDrop(e, 'productMaster')}
                             onPaste={(e) => handlePaste(e, 'productMaster')}
                             className={`aspect-square bg-black rounded-[48px] border-2 border-dashed shadow-[0_0_100px_rgba(37,99,235,0.05)] relative overflow-hidden transition-all flex items-center justify-center pointer-events-auto ${
                               isDragOver.productMaster ? 'border-accent bg-accent/20 scale-[1.02]' : 'border-[var(--border)]'
                             }`}
                           >
                             <div className={`w-full h-full flex flex-col items-center justify-center ${isDragOver.productMaster ? 'pointer-events-none' : ''}`}>
                               {mainSlots.productMaster ? (
                                 <div className="w-full h-full relative group/img">
                                   <img draggable={false} src={mainSlots.productMaster!} className="w-full h-full object-contain" alt="PROD" />
                                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center gap-4">
                                     <button onClick={() => triggerUpload('productMaster')} className="p-4 bg-accent rounded-[20px] text-white hover:scale-110 active:scale-95 transition-all shadow-xl pointer-events-auto"><ImageIcon size={24} /></button>
                                     <button onClick={() => setMainSlots(prev => ({ ...prev, productMaster: null }))} className="p-4 bg-red-500 rounded-[20px] text-white hover:scale-110 active:scale-95 transition-all shadow-xl pointer-events-auto"><X size={24} /></button>
                                   </div>
                                 </div>
                               ) : (
                                 <div onClick={() => triggerUpload('productMaster')} className="flex flex-col items-center gap-6 cursor-pointer">
                                   <div className="w-24 h-24 bg-white/2 rounded-[32px] flex items-center justify-center border border-[var(--border)] group-hover:border-accent/30 transition-all">
                                     <Upload size={40} className="text-gray-700 group-hover:text-accent" />
                                   </div>
                                   <span className="text-base font-black text-gray-700 uppercase tracking-[0.3em] group-hover:text-accent transition-colors text-center">Deploy<br/>Master Asset</span>
                                 </div>
                               )}
                             </div>
                           </div>
                        </div>
                      )}

                      <div className="space-y-6 group">
                         <div className="flex items-center justify-between px-2">
                           <span className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                             <Zap size={10} className="text-accent" /> {mode === 'Mode C' ? 'Reverse Target' : 'Visual Context'}
                           </span>
                           <span className="text-sm font-mono text-gray-700 tracking-tighter">REF_1029_STUDIO</span>
                         </div>
                         <div 
                           onDragOver={(e) => handleDragOver(e, 'sceneReference')}
                           onDragEnter={(e) => handleDragEnter(e, 'sceneReference')}
                           onDragLeave={(e) => handleDragLeave(e, 'sceneReference')}
                           onDrop={(e) => handleSlotDrop(e, 'sceneReference')}
                           onPaste={(e) => handlePaste(e, 'sceneReference')}
                           className={`aspect-square bg-black rounded-[48px] border-2 border-dashed shadow-[0_0_100px_rgba(37,99,235,0.05)] relative overflow-hidden transition-all flex items-center justify-center pointer-events-auto ${
                             isDragOver.sceneReference ? 'border-accent bg-accent/20 scale-[1.02]' : 'border-[var(--border)]'
                           }`}
                         >
                            <div className={`w-full h-full flex flex-col items-center justify-center ${isDragOver.sceneReference ? 'pointer-events-none' : ''}`}>
                              {mainSlots.sceneReference ? (
                                 <div className="w-full h-full relative group/img">
                                   <img draggable={false} src={mainSlots.sceneReference!} className="w-full h-full object-contain" alt="SCN" />
                                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center gap-4">
                                     <button onClick={() => triggerUpload('sceneReference')} className="p-4 bg-accent rounded-[20px] text-white hover:scale-110 active:scale-95 transition-all shadow-xl pointer-events-auto"><ImageIcon size={24} /></button>
                                     <button onClick={() => setMainSlots(prev => ({ ...prev, sceneReference: null }))} className="p-4 bg-red-500 rounded-[20px] text-white hover:scale-110 active:scale-95 transition-all shadow-xl pointer-events-auto"><X size={24} /></button>
                                   </div>
                                 </div>
                               ) : (
                                 <div onClick={() => triggerUpload('sceneReference')} className="flex flex-col items-center gap-6 cursor-pointer">
                                   <div className="w-24 h-24 bg-white/2 rounded-[32px] flex items-center justify-center border border-[var(--border)] group-hover:border-accent/30 transition-all">
                                     <Upload size={40} className="text-gray-700 group-hover:text-accent" />
                                   </div>
                                   <span className="text-base font-black text-gray-700 uppercase tracking-[0.3em] group-hover:text-accent transition-colors text-center">Deploy<br/>Reference Asset</span>
                                 </div>
                               )}
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Panel (Right) */}
                  <div className="w-[440px] shrink-0 bg-[var(--bg-primary)] border-l border-[var(--border)] flex flex-col shadow-2xl relative z-10 overflow-hidden">
                    <div className="p-10 flex-1 overflow-y-auto scrollbar-hide">
                      <div className="space-y-10">
                        <div>
                          <div className="flex items-center gap-3 mb-8">
                             <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_rgba(37,99,235,0.8)]" />
                             <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.4em]">Engine Directives</h3>
                          </div>
                          <ControlPanel inFullscreen={true} />
                        </div>
                      </div>
                    </div>
                    {/* Fullscreen Tool Access Toggle */}
                    <div className="p-8 border-t border-[var(--border)] bg-[var(--bg-primary)]">
                       <button onClick={() => setShowTools(!showTools)} className="w-full py-5 bg-white/2 hover:bg-accent/10 rounded-[24px] border border-[var(--border)] hover:border-accent/30 text-sm font-black text-gray-500 hover:text-accent uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4">
                         {showTools ? <Zap size={16} className="text-accent" /> : <Settings2 size={16} />}
                         {showTools ? 'Back to Fusion Core' : 'Analyze Base Code'}
                       </button>
                    </div>
                  </div>
                </div>

                {/* Tool Modal Overlay in Fullscreen */}
                <AnimatePresence>
                  {showTools && (
                    <motion.div 
                      initial={{ opacity: 0, x: 200 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 200 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="absolute top-20 right-0 bottom-0 w-[440px] bg-[var(--bg-primary)] z-[50] border-l border-[var(--border)] shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                    >
                      <div className="h-full flex flex-col p-10 overflow-hidden">
                        <div className="flex items-center justify-between mb-10">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-[var(--border)]">
                                <Search size={20} className="text-accent" />
                             </div>
                             <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Logic Sandbox</h3>
                                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter font-mono">Stand-alone Env</p>
                             </div>
                          </div>
                          <button onClick={() => setShowTools(false)} className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-gray-500 transition-all"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <ToolPanel />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default FusionMasterNode;
