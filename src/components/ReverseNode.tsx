import React, { useState, useMemo, useRef } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { ScanSearch, Play, Loader2, Copy, Check, Maximize2, Minimize2, X, Upload, FileText } from 'lucide-react';
import { useStore, useNodeIncomingData } from '../store/useStore';
import { ScaleWrapper } from './ScaleWrapper';
import { motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { generateTextWithFallback } from '../lib/gemini';

const SINGLE_REVERSE_PROMPT = `只反推当前参考图本身，请分析构图、主体、人物、手部、场景、材质、光影、色彩、镜头和氛围，输出高还原正向提示词、反向提示词和生成注意事项。禁止写图中没有的元素。

如果图中有人物，必须触发人物微观反推层，详细描述性别表达、年龄感、脸型、发型发色、面部配饰、表情、服装结构、裤型、鞋子、配饰、身体姿态、重心、手臂 / 腿部动作、人物气质和人物与场景关系。

如果图中有手部，必须描述手型、手指姿态、指甲、握持 / 托举 / 触碰关系、接触阴影和遮挡关系。

最后输出：
1. 参考图结构分析
2. 正向提示词
3. 反向提示词
4. 生成注意事项`;

export function ReverseNode({ id, data, selected }: NodeProps) {
  const nodeData = data as any;
  const updateNodeData = useStore((s) => s.updateNodeData);
  const incomingData = useNodeIncomingData(id);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameworkInputRef = useRef<HTMLInputElement>(null);
  
  const incomingImages = useMemo(() => {
    return incomingData
      .filter(d => d && (d.imageUrl || d.url || d.images))
      .flatMap(d => d.images || [d.imageUrl || d.url])
      .filter(img => typeof img === 'string') as string[];
  }, [incomingData]);

  const sceneReference = nodeData.sceneReference || null;
  const outputText = nodeData.outputText || '';

  const handleRun = async () => {
    if (running) return;
    const hasAnyImage = !!sceneReference || incomingImages.length > 0;
    if (!hasAnyImage) return;

    setRunning(true);
    try {
      const contents: any[] = [];
      let instruction = "";
      
      if (nodeData.frameworkText) {
        instruction += `【你必须严格遵循的提示词框架/模板规则】\n下面是用户上传的最新的提示词模板，请深度分析并严格按照其描述格式、属性层次、指令规则、书写风格，来拆解并提取当前参考图的主体、场景、光影等核心元素，生成对应的专属高质量提示词：\n\n${nodeData.frameworkText}\n\n`;
      } else {
        instruction += SINGLE_REVERSE_PROMPT;
      }

      if (nodeData.userCommand) {
        instruction += `\n\n【用户具体的分析分析优化口令/修改要求】\n${nodeData.userCommand}\n`;
      }

      contents.push({ text: `System Instruction for Reverse Prompt Inversion Engine:\n${instruction}` });

      const allImgs = [];
      if (sceneReference) allImgs.push(sceneReference);
      allImgs.push(...incomingImages);

      for (const imgUrl of allImgs.slice(-3)) {
        if (imgUrl.startsWith('data:')) {
          contents.push({
            inlineData: {
              mimeType: "image/png",
              data: imgUrl.split(',')[1]
            }
          });
        }
      }

      const resultText = await generateTextWithFallback(contents, "You are an expert Stable Diffusion and Midjourney prompt engineer who builds precise formulas.");
      updateNodeData(id, { outputText: resultText });
    } catch (e) {
      console.error('Reverse analysis failed:', e);
      updateNodeData(id, { outputText: `执行失败: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("上传失败：文件大小不能超过 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      updateNodeData(id, { sceneReference: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFrameworkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("上传失败：文本文件大小不能超过 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      updateNodeData(id, { frameworkText: text, frameworkName: file.name });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const ReverseContent = (isPortal = false) => {
    const hasAnyImage = !!sceneReference || incomingImages.length > 0;

    return (
      <div className={`flex flex-col bg-[var(--bg-secondary)] border border-[var(--border)]  ${isPortal ? 'w-[90vw] h-[85vh] rounded-[32px] shadow-2xl' : 'flex-1 rounded-2xl'}`}>
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-black/40 shrink-0 react-flow__node-draghandle rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#103a45] to-[#154652] border border-[#33c9cc]/30 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden group">
              <ScanSearch size={20} className="text-[#33c9cc] z-10" />
            </div>
            <div>
              <h3 className="text-[1.1em] font-black text-white tracking-tight uppercase">提示词反推</h3>
              <div className="flex items-center gap-2">
                <span className="text-[0.65em] font-mono text-gray-400 tracking-widest uppercase">PROMPT REVERSE</span>
                <div className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-cyan-400 animate-pulse' : 'bg-cyan-900'} shadow-[0_0_5px_cyan]`} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsOverlayOpen(!isPortal)} className="p-2 text-gray-500 hover:text-white transition-all">
              {isPortal ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            {isPortal && (
              <button onClick={() => setIsOverlayOpen(false)} className="p-2 text-red-500/50 hover:text-red-500 ml-1">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className={`flex-1 flex flex-col gap-4 p-5 overflow-y-auto scrollbar-hide nodrag ${isPortal ? 'grid grid-cols-2' : ''}`}>
          
          <div className="aspect-[4/3] w-full max-w-sm mx-auto border border-dashed border-[var(--border)] rounded-2xl flex items-center justify-center bg-black/40 relative group/file overflow-hidden shrink-0">
             {sceneReference ? (
                <>
                  <img src={sceneReference} className="w-full h-full object-contain p-2" />
                  <button onClick={() => updateNodeData(id, { sceneReference: null })} className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-lg opacity-0 group-hover/file:opacity-100 transition-opacity"><X size={14}/></button>
                </>
             ) : (
               <div className="flex flex-col items-center gap-2 cursor-pointer opacity-50 hover:opacity-100 transition-opacity w-full h-full justify-center" onClick={() => fileInputRef.current?.click()}>
                 <Upload size={24} />
                 <span className="text-[0.75em] font-bold uppercase tracking-wider">REVERSE TARGET<br/><span className="text-[0.6em] font-normal text-gray-500">CLICK TO UPLOAD</span></span>
               </div>
             )}
             <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>

          <div className="flex flex-col gap-3 relative z-10 nodrag shrink-0">
             <div className="flex items-center justify-between bg-white/5 border border-[var(--border)] p-3 rounded-xl">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><FileText size={16}/></div>
                 <div className="flex flex-col">
                   <span className="text-[0.75em] font-bold text-white leading-tight">
                     {nodeData.frameworkName || '提示词框架脚本 (可选)'}
                   </span>
                   <span className="text-[0.65em] text-gray-500">{nodeData.frameworkName ? 'TXT / JSON' : '点击上传 .txt / .json'}</span>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 {nodeData.frameworkName && (
                   <button onClick={() => updateNodeData(id, { frameworkName: null, frameworkText: null })} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"><X size={14}/></button>
                 )}
                 <button onClick={() => frameworkInputRef.current?.click()} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[0.75em] font-bold transition-all border border-white/5">上传</button>
               </div>
               <input ref={frameworkInputRef} type="file" className="hidden" accept=".txt,.json" onChange={handleFrameworkUpload} />
             </div>

             <textarea 
               value={nodeData.userCommand || ''}
               onChange={e => updateNodeData(id, { userCommand: e.target.value })}
               placeholder="输入口令 (如: 根据提示词框架脚本分析这张照片直接生成提示词)"
               className="w-full bg-white/5 border border-[var(--border)] rounded-xl p-3 text-[0.75em] text-white placeholder:text-gray-600 outline-none focus:border-[#33c9cc] resize-none h-20 custom-scrollbar transition-colors"
             />
          </div>

          <div className="text-[0.75em] text-gray-500 font-mono bg-white/5 p-3 rounded-xl border border-[var(--border)] shrink-0">
             <span className="text-cyan-500 font-bold">INFO:</span> 将深度 analysis 单张图片的色调、构图和提示词逻辑，禁止臆造。如有框架脚本，将作为反推约束。
          </div>

          <button 
            onClick={handleRun}
            disabled={running || !hasAnyImage}
            className={`w-full h-12 shrink-0 rounded-xl font-black text-[0.85em] tracking-widest shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-white/10 uppercase ${
              running || !hasAnyImage
                ? 'bg-white/5 text-gray-600 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
            }`}
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? 'ANALYZING...' : 'RUN CORE ANALYSIS'}
          </button>
        </div>

        <div className={`relative group overflow-hidden border-t border-[var(--border)] bg-black/50 ${isPortal ? 'h-full' : 'flex-1 min-h-[200px]'}`}>
          {running && (
             <div className="absolute inset-0 z-10 bg-cyan-500/5 backdrop-blur-[2px] flex items-center justify-center">
                <div className="flex gap-2">
                   {[0, 1, 2].map(i => (
                     <motion.div 
                       key={i}
                       animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                       transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                       className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_cyan]"
                     />
                   ))}
                </div>
             </div>
          )}
          <textarea 
            className="w-full h-full bg-transparent p-4 text-[0.75em] text-[#33c9cc] font-mono leading-relaxed outline-none resize-none custom-scrollbar pr-10"
            value={outputText}
            readOnly
            placeholder="> Analysis engine standby..."
          />
          <button 
            onClick={handleCopy}
            disabled={!outputText}
            className="absolute top-3 right-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 disabled:hidden z-20"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <NodeResizer minWidth={320} minHeight={450} isVisible={selected} lineClassName="border-cyan-500/50" handleClassName="h-3 w-3 bg-white border-2 border-cyan-500 rounded-sm" keepAspectRatio={true} />
      <div className={`flex flex-col w-full h-full bg-[var(--bg-secondary)] rounded-2xl border-2 border-[var(--border)] shadow-2xl transition-all ${selected ? 'border-[#33c9cc] ring-4 ring-cyan-500/10' : ''}`}>
        <Handle type="target" position={Position.Left} className="!bg-green-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none"  />
        <Handle type="source" position={Position.Right} className="!bg-green-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none"  />

        <ScaleWrapper id={id} type="reverse">
          {ReverseContent(false)}
        </ScaleWrapper>
      </div>

      {isOverlayOpen && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-12 bg-black/85 backdrop-blur-3xl" onPointerDown={e => e.stopPropagation()}>
           <motion.div 
             initial={{ opacity: 0, scale: 0.9, y: 40 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.9, y: 40 }}
             className="w-full h-full max-w-4xl max-h-[85vh]"
           >
              {ReverseContent(true)}
           </motion.div>
           <div className="absolute inset-0 -z-10" onClick={() => setIsOverlayOpen(false)} />
        </div>,
        document.body
      )}
    </>
  );
}
