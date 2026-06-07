import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { get } from 'idb-keyval';

const ImageGenRefThumbnail = ({ url, className, alt }: { url: string; className?: string; alt?: string }) => {
  const [resolvedUrl, setResolvedUrl] = useState('');

  useEffect(() => {
    let active = true;
    let localBlobUrl = '';

    const resolve = async () => {
      if (!url) {
        setResolvedUrl('');
        return;
      }
      if (url.startsWith('db_blob:')) {
        try {
          const stored = await get(url);
          if (!active) return;
          if (stored instanceof Blob) {
            localBlobUrl = URL.createObjectURL(stored);
            setResolvedUrl(localBlobUrl);
          } else {
            setResolvedUrl('');
          }
        } catch (e) {
          console.error("Failed to load db_blob in image gen thumbnail", e);
          if (active) setResolvedUrl('');
        }
      } else {
        if (active) setResolvedUrl(url);
      }
    };
    resolve();

    return () => {
      active = false;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [url]);

  return (
    <img 
      src={resolvedUrl || url} 
      alt={alt} 
      className={className} 
    />
  );
};
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  Sliders,
  Check,
  Play,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Pencil
} from 'lucide-react';
import { useStore, useNodeIncomingData } from '../store/useStore';
import { downloadImage } from '../lib/download';
import { ScaleWrapper } from './ScaleWrapper';
import { getOrExtractWorkflowFields, normalizeWorkflowToPrompt } from './SettingsModal';
import { AnnotationModal } from './AnnotationModal';

const SIZE_OPTIONS = {
  square: [
    ['1024x1024', '1k'],
    ['2048x2048', '2k'],
    ['3840x2160', '4k']
  ],
  portrait: [
    ['1024x1536', '1k'],
    ['1360x2048', '2k'],
    ['2352x3520', '4k']
  ],
  portrait43: [
    ['1008x1344', '1k'],
    ['1536x2048', '2k'],
    ['2448x3264', '4k']
  ],
  landscape43: [
    ['1344x1008', '1k'],
    ['2048x1536', '2k'],
    ['3264x2448', '4k']
  ],
  landscape: [
    ['1536x1024', '1k'],
    ['2048x1360', '2k'],
    ['3520x2352', '4k']
  ],
  story: [
    ['720x1280', '1k'],
    ['1152x2048', '2k'],
    ['2160x3840', '4k']
  ],
  wide: [
    ['1280x720', '1k'],
    ['2048x1152', '2k'],
    ['3840x2160', '4k']
  ]
};

const RES_LONG_SIDE: Record<string, number> = { '1k': 1536, '2k': 2048, '4k': 3840 };
const RES_PIXEL_LIMIT: Record<string, number> = { '1k': 1572864, '2k': 4194304, '4k': 8294400 };

// Brand custom SVG icons fully compliant with mockup styles
const OpenAIIcon = ({ size = 13, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);

const BananaSparkleIcon = ({ size = 13, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <g fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </g>
  </svg>
);

const RunningHubIcon = ({ size = 13, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M11.5 5h-5.4c-1.1 0-1.8.8-2 1.8l-2.4 9.1c-.2 1 .3 1.8 1.4 1.8h4.5l.8-2.9H5.5L7 10h4.2c.8 0 1.2-.4 1.4-1.2l.6-2.3c.2-.8-.2-1.5-1.7-1.5z M18.5 5h-5.2c-.8 0-1.1.4-1.3 1.1l-3.3 12.5h3.9l1.2-4.5h4.1c1.8 0 3-.9 3.4-2.4.4-1.5-.1-3-.9-4-.8-1.5-2.2-2.7-5-2.7zm-.6 5H15l.8-3.1h2.9c.8 0 1.1.4 1 1-.1.6-.5 1.1-1.2 2.1z" />
  </svg>
);

const JimengIcon = ({ size = 13, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M12 2c.08 3.52 1.95 6.45 5.8 7.37c-3.85.92-5.72 3.85-5.8 7.37c-.08-3.52-1.95-6.45-5.8-7.37c3.85-.92 5.72-3.85 5.8-7.37z" />
  </svg>
);

const ComfyUIIcon = ({ size = 13, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c2.8 0 5.3-.15 7.15-1.92l-1.41-1.41C16.32 20.09 14.32 20 12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8c2.4 0 4.32.1 5.74 1.33l1.41-1.41C17.3 2.15 14.8 2 12 2zm0 6c-2.21 0-4 1.79-4 4s1.79 4 4 4c1.1 0 2.1-.45 2.83-1.17l-1.41-1.41C12.98 13.8 12.52 14 12 14c-1.1 0-2-.9-2-2s.9-2 2-2c.52 0 .98.2 1.42.59l1.41-1.41C14.1 8.45 13.1 8 12 8z" />
  </svg>
);

const ENGINE_TABS = [
  { id: 'gpt', name: 'GPT图像', icon: OpenAIIcon },
  { id: 'banana', name: '香蕉图像', icon: BananaSparkleIcon },
  { id: 'runninghub', name: 'RunningHub', icon: RunningHubIcon },
  { id: 'jimeng', name: '即梦', icon: JimengIcon },
  { id: 'comfyui', name: 'ComfyUI', icon: ComfyUIIcon },
  { id: 'modelscope', name: 'ModelScope', icon: Images },
];

export const ImageGenNode = ({ id, data, selected }: { id: string; data: any; selected?: boolean }) => {
  const [loading, setLoading] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [annotatingUrl, setAnnotatingUrl] = useState<{ url: string, idx: number } | null>(null);

  const handleImageDoubleClick = (url: string) => {
    setFullscreenUrl(url);
    setZoomScale(1);
    setZoomOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(zoomScale + delta, 0.5), 5);
    setZoomScale(newScale);
  };

  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    setIsDraggingImage(true);
    setDragStart({ x: e.clientX - zoomOffset.x, y: e.clientY - zoomOffset.y });
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingImage) return;
    setZoomOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleImageMouseUp = () => {
    setIsDraggingImage(false);
  };
  
  const updateNodeData = useStore((s) => s.updateNodeData);
  const removeNode = useStore((s) => s.removeNode);
  const settings = useStore((s) => s.settings);
  const addFile = useStore((s) => s.addFile);
  const updateSettings = useStore((s) => s.updateSettings);
  const addNode = useStore((s) => s.addNode);
  const incomingData = useNodeIncomingData(id);

  // General States mapped to Node Data to ensure persistence
  const [activeTab, setActiveTab] = useState<string>(data.activeTab || 'gpt');
  const [prompt, setPrompt] = useState<string>(data.prompt || '');
  const [isComposing, setIsComposing] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>(data.images || (data.imageUrl ? [data.imageUrl] : []));

  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const comfyParamsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedUpdatePrompt = (val: string) => {
    if (promptTimeoutRef.current) {
      clearTimeout(promptTimeoutRef.current);
    }
    promptTimeoutRef.current = setTimeout(() => {
      handleUpdateField('prompt', val);
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (promptTimeoutRef.current) {
        clearTimeout(promptTimeoutRef.current);
      }
      if (comfyParamsTimeoutRef.current) {
        clearTimeout(comfyParamsTimeoutRef.current);
      }
    };
  }, []);

  // Dynamic Real-time Generation Timer state and effect
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  useEffect(() => {
    let timer: any;
    if (loading) {
      setGenerationTime(0);
      timer = setInterval(() => {
        setGenerationTime(prev => (prev === null ? 1 : prev + 1));
      }, 1000);
    } else {
      if (timer) clearInterval(timer);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [loading]);

  useEffect(() => {
    if (previewUrls.length === 0 && !loading) {
      setGenerationTime(null);
    }
  }, [previewUrls, loading]);

  // --- OpenAI / GPT Tab Specific States ---
  const [gptProvider, setGptProvider] = useState<string>(data.gptProvider || 'OpenAI');
  const [gptModel, setGptModel] = useState<string>(data.gptModel || 'gpt-image-2');
  const [gptRatio, setGptRatio] = useState<string>(data.gptRatio || '自动');
  const [gptSize, setGptSize] = useState<string>(data.gptSize || '默认');
  const [gptQuality, setGptQuality] = useState<string>(data.gptQuality || 'auto');
  const [gptBatch, setGptBatch] = useState<number>(data.gptBatch || 1);
  const [gptAsync, setGptAsync] = useState<boolean>(data.gptAsync !== undefined ? data.gptAsync : true);
  const [gptOpMode, setGptOpMode] = useState<'generations' | 'edits'>(data.gptOpMode || 'generations');
  const [gptFormat, setGptFormat] = useState<string>(data.gptFormat || 'jpeg');
  const [gptBackground, setGptBackground] = useState<string>(data.gptBackground || 'auto');
  const [gptModeration, setGptModeration] = useState<string>(data.gptModeration || 'auto');

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
  const [comfyParams, setComfyParams] = useState<Record<string, any>>(data.comfyParams || {});
  const [showComfyParams, setShowComfyParams] = useState<boolean>(data.showComfyParams !== false);

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

  const handleUpdateComfyParam = (key: string, value: any) => {
    const updated = { ...comfyParams, [key]: value };
    setComfyParams(updated);
    
    if (comfyParamsTimeoutRef.current) {
      clearTimeout(comfyParamsTimeoutRef.current);
    }
    comfyParamsTimeoutRef.current = setTimeout(() => {
      handleUpdateField('comfyParams', updated);
    }, 250);
  };

  const handleToggleComfyParams = (e: React.MouseEvent) => {
    e.stopPropagation();
    const val = !showComfyParams;
    setShowComfyParams(val);
    handleUpdateField('showComfyParams', val);
  };

  // --- 即梦 / Jimeng Tab Specific States ---
  const [jmModel, setJmModel] = useState<string>(data.jmModel || 'doubao-seedream-5-0-260128');
  const [jmMode, setJmMode] = useState<string>(data.jmMode || '单图');
  const [jmResolution, setJmResolution] = useState<string>(data.jmResolution || '2K');
  const [jmRatio, setJmRatio] = useState<string>(data.jmRatio || '1:1');
  const [jmBatch, setJmBatch] = useState<number>(data.jmBatch || 1);

  // --- ModelScope Tab Specific States ---
  const [msModel, setMsModel] = useState<string>(data.msModel || 'Tongyi-MAI/Z-Image-Turbo');
  const [msRatio, setMsRatio] = useState<string>(data.msRatio || '1:1');
  const [msResolution, setMsResolution] = useState<string>(data.msResolution || '1K');
  const [msCustomWidth, setMsCustomWidth] = useState<string>(data.msCustomWidth || '');
  const [msCustomHeight, setMsCustomHeight] = useState<string>(data.msCustomHeight || '');
  const [msCustomRatioWidth, setMsCustomRatioWidth] = useState<string>(data.msCustomRatioWidth || '');
  const [msCustomRatioHeight, setMsCustomRatioHeight] = useState<string>(data.msCustomRatioHeight || '');
  const [msBatch, setMsBatch] = useState<number>(data.msBatch || 1);
  const [msAsync, setMsAsync] = useState<boolean>(data.msAsync !== undefined ? data.msAsync : false);

  // --- ModelScope LoRA States adapted for model selection ---
  const [msLoraEnabled, setMsLoraEnabled] = useState<boolean>(data.msLoraEnabled !== undefined ? data.msLoraEnabled : false);
  const [msSelectedLoraId, setMsSelectedLoraId] = useState<string>(data.msSelectedLoraId || '');
  const [msLoraWeight, setMsLoraWeight] = useState<number>(data.msLoraWeight !== undefined ? data.msLoraWeight : 0.8);

  // Memoize active ModelScope image model pool synced from global settings
  const msModelsAvailable = useMemo(() => {
    const saved = settings.apiSettings.modelscopeImageModels || [];
    if (saved.length > 0) return saved;
    return [
      "Tongyi-MAI/Z-Image-Turbo",
      "Qwen/Qwen-Image-2512",
      "Qwen/Qwen-Image-Edit-2511",
      "black-forest-labs/FLUX.2-klein-9B"
    ];
  }, [settings.apiSettings.modelscopeImageModels]);

  // Synchronize choice to local model scope node config
  useEffect(() => {
    if (msModelsAvailable.length > 0 && !msModelsAvailable.includes(msModel)) {
      setMsModel(msModelsAvailable[0]);
      updateNodeData(id, { msModel: msModelsAvailable[0] });
    }
  }, [msModelsAvailable]);

  // Matching LoRAs list from global settings
  const matchingLoras = useMemo(() => {
    const loras = settings.apiSettings.modelscopeLoras || [];
    return loras.filter((lora: any) => lora.modelId === msModel && lora.id);
  }, [settings.apiSettings.modelscopeLoras, msModel]);

  // Synchronize active matching LoRA on model change
  useEffect(() => {
    if (matchingLoras.length > 0) {
      const currentExists = matchingLoras.some((l: any) => l.id === msSelectedLoraId);
      if (!currentExists) {
        setMsSelectedLoraId(matchingLoras[0].id);
        const wVal = matchingLoras[0].weight !== undefined ? matchingLoras[0].weight : 0.8;
        setMsLoraWeight(wVal);
        updateNodeData(id, { 
          msSelectedLoraId: matchingLoras[0].id, 
          msLoraWeight: wVal 
        });
      }
    } else {
      setMsSelectedLoraId('');
      updateNodeData(id, { msSelectedLoraId: '' });
    }
  }, [matchingLoras]);

  // Sync state with store save
  const handleUpdateField = (key: string, val: any) => {
    updateNodeData(id, { [key]: val });
  };

  const getMsCurrentSize = () => {
    const resLower = msResolution.toLowerCase();
    if (resLower === 'custom') {
      const w = parseInt(msCustomWidth);
      const h = parseInt(msCustomHeight);
      return (w > 0 && h > 0) ? `${w}x${h}` : '1024x1024';
    }
    
    if (msRatio === '自动' || msRatio === 'auto' || !msRatio) {
      return resLower === '2k' ? '2048x2048' : resLower === '4k' ? '3840x3840' : '1024x1024';
    }

    if (msRatio === 'custom') {
      const rw = Number(msCustomRatioWidth);
      const rh = Number(msCustomRatioHeight);
      if (rw > 0 && rh > 0) {
        const parsed = rw / rh;
        const resKey = resLower === '2k' ? '2k' : resLower === '4k' ? '4k' : '1k';
        const longSide = RES_LONG_SIDE[resKey] || 1024;
        const pixelLimit = RES_PIXEL_LIMIT[resKey] || (longSide * longSide);
        const rawWidth = parsed >= 1 ? longSide : Math.min(longSide * parsed, Math.sqrt(pixelLimit * parsed));
        const rawHeight = parsed >= 1 ? Math.min(longSide / parsed, Math.sqrt(pixelLimit / parsed)) : longSide;
        const width = Math.floor(rawWidth / 16) * 16;
        const height = Math.floor(rawHeight / 16) * 16;
        return `${Math.max(64, width)}x${Math.max(64, height)}`;
      }
      return '1024x1024';
    }

    let mappedRatio = msRatio;
    if (msRatio === '1:1') mappedRatio = 'square';
    else if (msRatio === '16:9') mappedRatio = 'wide';
    else if (msRatio === '9:16') mappedRatio = 'story';
    else if (msRatio === '4:3') mappedRatio = 'landscape43';
    else if (msRatio === '3:4') mappedRatio = 'portrait43';
    else if (msRatio === '3:2') mappedRatio = 'landscape';
    else if (msRatio === '2:3') mappedRatio = 'portrait';

    const options = (SIZE_OPTIONS as any)[mappedRatio] || SIZE_OPTIONS.square;
    const resKey = resLower === '2k' ? '2k' : resLower === '4k' ? '4k' : '1k';
    const match = options.find(([, label]: any) => label === resKey) || options[0];
    return match ? match[0] : '1024x1024';
  };

  const handleMsFitToImage = () => {
    if (incomingImages.length > 0) {
      const firstImgUrl = incomingImages[0];
      const img = new Image();
      img.onload = () => {
        const wVal = String(img.naturalWidth || 1024);
        const hVal = String(img.naturalHeight || 1024);
        setMsCustomWidth(wVal);
        setMsCustomHeight(hVal);
        setMsResolution('custom');
        setMsRatio('自动');
        updateNodeData(id, {
          msCustomWidth: wVal,
          msCustomHeight: hVal,
          msResolution: 'custom',
          msRatio: '自动'
        });
      };
      img.src = firstImgUrl;
    }
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

  // --- Mention/Reference Image Dropdown States & Logics with caret/cursor alignment ---
  const [showRefDropdown, setShowRefDropdown] = useState(false);
  const [dropdownActiveIdx, setDropdownActiveIdx] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const selectionStartRef = useRef<number>(0);

  // Active clicked tag state to track which tag is explicitly highlighted and active for switching
  const [activeClickedTag, setActiveClickedTag] = useState<{
    start: number;
    end: number;
    imageIndex: number;
    text: string;
  } | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRefDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const parsedPromptInfo = useMemo(() => {
    if (!prompt) return { imageIndexes: [], text: '' };
    
    const imageIndexes: number[] = [];
    const regex = /(@(?:图片|参考图)\s*(\d+))/g;
    let match;
    while ((match = regex.exec(prompt)) !== null) {
      const idx = parseInt(match[2]) - 1;
      if (!imageIndexes.includes(idx)) {
        imageIndexes.push(idx);
      }
    }
    
    return {
      imageIndexes,
      text: prompt
    };
  }, [prompt]);

  const getActiveMentionRange = useCallback((promptStr: string, index: number) => {
    if (!promptStr) return null;
    const regex = /(@(?:图片|参考图)\s*(\d+))/g;
    let match;
    while ((match = regex.exec(promptStr)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (index >= start && index <= end) {
        return {
          start,
          end,
          text: match[0],
          imageIndex: parseInt(match[2]) - 1
        };
      }
    }
    return null;
  }, []);

  const updateCursorIndex = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      selectionStartRef.current = start;
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);
    debouncedUpdatePrompt(val);
    
    // Check if the typed character just before cursor is '@'
    const selStart = e.target.selectionStart;
    const typedUpToCursor = val.slice(0, selStart);
    if (typedUpToCursor.endsWith('@')) {
      setShowRefDropdown(true);
      setActiveClickedTag(null);
      setDropdownActiveIdx(0);
    }
    
    // Sync backdrop scroll on next frame
    setTimeout(() => {
      if (backdropRef.current && textareaRef.current) {
        backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      }
      updateCursorIndex();
    }, 0);
  };

  const handleTextareaBlur = () => {
    if (promptTimeoutRef.current) {
      clearTimeout(promptTimeoutRef.current);
    }
    if (prompt !== data.prompt) {
      handleUpdateField('prompt', prompt);
    }
  };

  const handleTextareaClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      // Find if we clicked on any tag in the prompt
      const regex = /(@(?:图片|参考图)\s*(\d+))/g;
      let match;
      while ((match = regex.exec(prompt)) !== null) {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
        
        // If the click falls inside the tag range
        if (start >= matchStart && start <= matchEnd) {
          e.preventDefault();
          
          const clickedTag = {
            start: matchStart,
            end: matchEnd,
            imageIndex: parseInt(match[2]) - 1,
            text: match[0]
          };

          setActiveClickedTag(clickedTag);
          setShowRefDropdown(true);
          setDropdownActiveIdx(clickedTag.imageIndex);

          // Select the entire tag text so it supports instant overwrite & visual highlight
          textarea.setSelectionRange(matchStart, matchEnd);
          
          selectionStartRef.current = matchStart;
          return;
        }
      }
    }
    
    // Clicking elsewhere clears the active clicked tag and closes the selector
    setActiveClickedTag(null);
    setShowRefDropdown(false);
  };

  const handleTextareaSelect = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;
    let changed = false;

    // Clear active clicked tag if selection moved away from it
    if (activeClickedTag) {
      if (start !== activeClickedTag.start || end !== activeClickedTag.end) {
        setActiveClickedTag(null);
        setShowRefDropdown(false);
      }
    }

    // Caret safety - snap cursor to prevent entering inside the tags
    const regex = /(@(?:图片|参考图)\s*\d+)/g;
    let match;
    while ((match = regex.exec(prompt)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;

      if (start === end) {
        if (start > matchStart && start < matchEnd) {
          const toStart = start - matchStart;
          const toEnd = matchEnd - start;
          const snapPos = toStart < toEnd ? matchStart : matchEnd;
          
          start = snapPos;
          end = snapPos;
          changed = true;
        }
      } else {
        if (start > matchStart && start < matchEnd) {
          start = matchStart;
          changed = true;
        }
        if (end > matchStart && end < matchEnd) {
          end = matchEnd;
          changed = true;
        }
      }
    }

    if (changed) {
      textarea.setSelectionRange(start, end);
    }

    selectionStartRef.current = start;
  };

  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleSelectRefImage = (index: number) => {
    const tag = `@图片${index + 1}`;
    
    let finalPrompt = '';
    let newCursorPos = 0;
    
    if (activeClickedTag) {
      // Replace existing mention
      const left = prompt.slice(0, activeClickedTag.start);
      const right = prompt.slice(activeClickedTag.end);
      finalPrompt = `${left}${tag}${right}`;
      newCursorPos = activeClickedTag.start + tag.length;
    } else {
      const currentCursor = selectionStartRef.current;
      const leftText = prompt.slice(0, currentCursor);
      const rightText = prompt.slice(currentCursor);
      
      if (leftText.endsWith('@')) {
        const left = leftText.slice(0, -1);
        const spaceBefore = (left.length > 0 && !left.endsWith(' ')) ? ' ' : '';
        const spaceAfter = (rightText.length > 0 && !rightText.startsWith(' ')) ? ' ' : '';
        const insertText = `${spaceBefore}${tag}${spaceAfter}`;
        finalPrompt = `${left}${insertText}${rightText}`;
        newCursorPos = left.length + insertText.length;
      } else {
        const spaceBefore = (leftText.length > 0 && !leftText.endsWith(' ')) ? ' ' : '';
        const spaceAfter = (rightText.length > 0 && !rightText.startsWith(' ')) ? ' ' : '';
        const insertText = `${spaceBefore}${tag}${spaceAfter}`;
        finalPrompt = `${leftText}${insertText}${rightText}`;
        newCursorPos = currentCursor + insertText.length;
      }
    }
    
    setPrompt(finalPrompt);
    handleUpdateField('prompt', finalPrompt);
    setShowRefDropdown(false);
    setActiveClickedTag(null);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        selectionStartRef.current = newCursorPos;
      }
    }, 50);
  };

  const handleThumbnailClick = (index: number) => {
    const tag = `@图片${index + 1}`;
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s)${escapedTag}(?:\\s|$)`, 'g');
    
    if (regex.test(prompt)) {
      // It exists - toggle OFF by removing it
      let finalPrompt = prompt.replace(regex, ' ').replace(/\s+/g, ' ').trim();
      setPrompt(finalPrompt);
      handleUpdateField('prompt', finalPrompt);
    } else {
      // It doesn't exist - toggle ON by inserting it at caret position
      const currentCursor = textareaRef.current?.selectionStart ?? prompt.length;
      const left = prompt.slice(0, currentCursor);
      const right = prompt.slice(currentCursor);
      
      const spaceBefore = (left.length > 0 && !left.endsWith(' ')) ? ' ' : '';
      const spaceAfter = (right.length > 0 && !right.startsWith(' ')) ? ' ' : '';
      const insertText = `${spaceBefore}${tag}${spaceAfter}`;
      const finalPrompt = `${left}${insertText}${right}`;
      
      setPrompt(finalPrompt);
      handleUpdateField('prompt', finalPrompt);
      
      const newCursorPos = currentCursor + insertText.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          selectionStartRef.current = newCursorPos;
        }
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // 1. Arrow key navigation & Enter confirm for reference image dropdown helper
    if (showRefDropdown && incomingImages.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDropdownActiveIdx(prev => (prev + 1) % incomingImages.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDropdownActiveIdx(prev => (prev - 1 + incomingImages.length) % incomingImages.length);
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectRefImage(dropdownActiveIdx);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowRefDropdown(false);
        setActiveClickedTag(null);
        return;
      }
    }

    // 2. Prevent caret selection from typing INSIDE any tag block
    const tagBlockRegex = /(@(?:图片|参考图)\s*\d+)/g;
    let tagBlockMatch;
    while ((tagBlockMatch = tagBlockRegex.exec(prompt)) !== null) {
      const matchStart = tagBlockMatch.index;
      const matchEnd = matchStart + tagBlockMatch[0].length;
      if (start === end && start > matchStart && start < matchEnd) {
        const isControlOrMovementKey = [
          'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
          'Home', 'End', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'
        ].includes(e.key);
        
        if (!isControlOrMovementKey) {
          e.preventDefault();
          const toStart = start - matchStart;
          const toEnd = matchEnd - start;
          const snapPos = toStart < toEnd ? matchStart : matchEnd;
          textarea.setSelectionRange(snapPos, snapPos);
          selectionStartRef.current = snapPos;
          return;
        }
      }
    }

    // Active clicked tag overrides inside handleKeyDown
    if (activeClickedTag) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const left = prompt.slice(0, activeClickedTag.start);
        const right = prompt.slice(activeClickedTag.end);
        const finalPrompt = left + right;

        setPrompt(finalPrompt);
        handleUpdateField('prompt', finalPrompt);
        setActiveClickedTag(null);
        setShowRefDropdown(false);

        const newPos = activeClickedTag.start;
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPos, newPos);
            selectionStartRef.current = newPos;
          }
        }, 0);
        return;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Escape') {
        setActiveClickedTag(null);
        setShowRefDropdown(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setActiveClickedTag(null);
        setShowRefDropdown(false);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const left = prompt.slice(0, activeClickedTag.start);
        const right = prompt.slice(activeClickedTag.end);
        const finalPrompt = left + e.key + right;

        setPrompt(finalPrompt);
        handleUpdateField('prompt', finalPrompt);
        setActiveClickedTag(null);
        setShowRefDropdown(false);

        const newPos = activeClickedTag.start + e.key.length;
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPos, newPos);
            selectionStartRef.current = newPos;
          }
        }, 0);
        return;
      }
    }

    // Handle Backspace
    if (e.key === 'Backspace' && start === end) {
      const regex = /(@(?:图片|参考图)\s*\d+)/g;
      let match;
      while ((match = regex.exec(prompt)) !== null) {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
        if (start === matchEnd) {
          e.preventDefault();
          const left = prompt.slice(0, matchStart);
          const right = prompt.slice(matchEnd);
          const finalPrompt = left + right;

          setPrompt(finalPrompt);
          handleUpdateField('prompt', finalPrompt);

          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(matchStart, matchStart);
              selectionStartRef.current = matchStart;
            }
          }, 0);
          return;
        }
      }
    }

    // Handle Delete key
    if (e.key === 'Delete' && start === end) {
      const regex = /(@(?:图片|参考图)\s*\d+)/g;
      let match;
      while ((match = regex.exec(prompt)) !== null) {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;
        if (start === matchStart) {
          e.preventDefault();
          const left = prompt.slice(0, matchStart);
          const right = prompt.slice(matchEnd);
          const finalPrompt = left + right;

          setPrompt(finalPrompt);
          handleUpdateField('prompt', finalPrompt);

          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(matchStart, matchStart);
              selectionStartRef.current = matchStart;
            }
          }, 0);
          return;
        }
      }
    }
  };

  const renderHighlightedPrompt = () => {
    if (!prompt) return null;
    
    const regex = /(@(?:图片|参考图)\s*\d+)/g;
    const parts = prompt.split(regex);
    
    const matches: string[] = prompt.match(regex) || [];
    let matchIdx = 0;
    let accumulatedLength = 0;
    
    return parts.map((part, index) => {
      const partLength = part.length;
      const startIdx = accumulatedLength;
      const endIdx = accumulatedLength + partLength;
      accumulatedLength = endIdx;
      
      const isMatch = matches[matchIdx] === part;
      if (isMatch) {
        matchIdx++;
        const isActive = !!activeClickedTag && (startIdx === activeClickedTag.start && endIdx === activeClickedTag.end);
        
        const tagNumMatch = part.match(/\d+/);
        const imageIndex = tagNumMatch ? parseInt(tagNumMatch[0]) - 1 : 0;

        return (
          <span 
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              
              const clickedTag = {
                start: startIdx,
                end: endIdx,
                imageIndex: imageIndex,
                text: part
              };
              
              setActiveClickedTag(clickedTag);
              setShowRefDropdown(true);
              setDropdownActiveIdx(imageIndex);
              
              if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(startIdx, endIdx);
                selectionStartRef.current = startIdx;
              }
            }}
            className={`inline font-sans font-bold px-1 py-0.5 rounded border tracking-normal select-none transition-all cursor-pointer pointer-events-auto hover:bg-indigo-500/25 ${
              isActive 
                ? 'bg-indigo-650/40 border-indigo-400 text-indigo-300 ring-2 ring-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.4)]' 
                : 'bg-indigo-600/20 border-indigo-500/20 text-indigo-400 hover:border-indigo-400 hover:text-indigo-300'
            }`}
          >
            {part}
          </span>
        );
      } else {
        return (
          <span key={index} className="text-zinc-200">
            {part}
          </span>
        );
      }
    });
  };

  const [launching, setLaunching] = useState(false);

  const handleLaunchComfyUI = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 1. Get current ComfyUI configuration or default
    const comfyUrl = settings.apiSettings.comfyUrl || 'http://127.0.0.1:8188';
    
    // 2. Add new comfy web node dynamically next to the current node
    try {
      const nodes = useStore.getState().nodes;
      const currentNode = nodes.find(n => n.id === id);
      const posX = currentNode ? currentNode.position.x + 500 : 200;
      const posY = currentNode ? currentNode.position.y : 200;
      
      addNode("apt-web-tool", posX, posY, {
        initialWidth: 1000,
        initialHeight: 750,
        viewMode: 'comfy',
        comfyUrl: comfyUrl,
        tabs: [
          { id: 'comfy-auto', title: 'ComfyUI Link', url: comfyUrl }
        ],
        activeTabId: 'comfy-auto',
        status: `正在连接 ComfyUI 终端: ${comfyUrl}`
      });
    } catch (err) {
      console.error("Failed to dynamically add ComfyUI web node:", err);
    }

    // 3. Try to start local .bat Launcher in parallel if configured
    const batPath = settings.apiSettings.comfyLauncherPath || '';
    if (!batPath) {
      // Do not block or throw alert error, since ComfyUI might already be manually running on port 8188 (as in image 3)
      return;
    }

    if (launching) return;
    setLaunching(true);
    try {
      const response = await fetch('/api/comfy/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launcherPath: batPath })
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        console.log("ComfyUI launched via script:", data.message);
      } else {
        alert(`启动器启动失败：\n${data.error || '未知错误'}\n请确保您的本地 ComfyUI 服务已处于开启工作状态。`);
      }
    } catch (err: any) {
      console.error("Launcher service API error:", err);
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
    setExecutionError(null);
    
    try {
      const apiSettings = settings.apiSettings;

      // Extract options according to active tab
      let engine: any = apiSettings.engine || 'openai';
      let selectedModel = gptModel;
      let batchSize = gptBatch;
      let resolution = gptRatio;
      let quality = gptQuality;

      if (activeTab === 'gpt') {
        engine = 'openai';
      } else if (activeTab === 'banana') {
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
      } else if (activeTab === 'modelscope') {
        engine = 'modelscope';
        selectedModel = msModel;
        batchSize = msBatch;
        resolution = getMsCurrentSize();
        quality = msResolution;
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

        const activeWfDetails = (settings.apiSettings.comfyWorkflowsDetails || []).find(
          wf => wf.name === comfyWorkflow
        );

        let finalWorkflowPayload: any = null;
        let outputNodeId = "9"; // default standard output fallback

        if (activeWfDetails) {
          try {
            const rawJson = JSON.parse(activeWfDetails.content || '{}');
            const promptObj = normalizeWorkflowToPrompt(rawJson);
            
            // Overwrite exposed inputs using our local state (comfyParams)
            const fieldsObj = getOrExtractWorkflowFields(activeWfDetails);
            fieldsObj.forEach((f: any) => {
              const paramKey = `${f.nodeId}-${f.fieldKey}`;
              const val = comfyParams[paramKey] !== undefined ? comfyParams[paramKey] : f.fieldValue;

              if (promptObj[f.nodeId] && promptObj[f.nodeId].inputs) {
                let typedVal = val;
                if (typeof f.fieldValue === 'number' && typeof val === 'string') {
                  typedVal = val === '' ? f.fieldValue : Number(val);
                } else if (f.fieldValue === true || f.fieldValue === false) {
                  typedVal = val === 'true' || val === true;
                }
                
                if (f.classType === 'WanvasExpose') {
                  const origInputVal = rawJson[f.nodeId]?.inputs?.[f.fieldKey];
                  if (Array.isArray(origInputVal)) {
                    const linkedNodeId = origInputVal[0]?.toString();
                    if (linkedNodeId && promptObj[linkedNodeId] && promptObj[linkedNodeId].inputs) {
                      promptObj[linkedNodeId].inputs.value = typedVal;
                    }
                  } else {
                    promptObj[f.nodeId].inputs[f.fieldKey] = typedVal;
                  }
                } else {
                  promptObj[f.nodeId].inputs[f.fieldKey] = typedVal;
                }
              }
            });

            // Bind positive prompt text to target CLIPTextEncode automatically
            Object.keys(promptObj).forEach((nodeId) => {
              const node = promptObj[nodeId];
              if (node && node.class_type === 'CLIPTextEncode') {
                const textOverride = comfyParams[`${nodeId}-text`];
                if (textOverride === undefined) {
                  const currentText = node.inputs?.text || '';
                  const lowerText = currentText.toLowerCase();
                  const looksNegative = lowerText.includes('negative') ||
                                        lowerText.includes('worst') ||
                                        lowerText.includes('critical') ||
                                        lowerText.includes('bad hands') ||
                                        lowerText.includes('bad anatomy') ||
                                        lowerText.includes('canvas_gen_neg');
                  if (!looksNegative) {
                    node.inputs.text = finalPrompt;
                  }
                }
              }
            });

            // Auto localize SaveImage or PreviewImage output node ID
            Object.keys(promptObj).forEach((nodeId) => {
              const node = promptObj[nodeId];
              if (node && (node.class_type === 'SaveImage' || node.class_type === 'PreviewImage')) {
                outputNodeId = nodeId;
              }
            });

            finalWorkflowPayload = { prompt: promptObj };
          } catch (err) {
            console.error("解析或渲染 ComfyUI 动态参数模板失败，退回默认，错误信息: ", err);
          }
        }

        if (!finalWorkflowPayload) {
          finalWorkflowPayload = {
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
          outputNodeId = "9";
        }

        let promptId = '';
        let usedProxyForLocal = false;
        if (!isLocal) {
          // Remote/Proxy route via Express server
          const res = await fetch(`/api/comfy/run-workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: comfyUrl,
              workflow: finalWorkflowPayload.prompt,
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
          try {
            const res = await fetch(`${comfyUrl.replace(/\/$/, '')}/prompt`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(finalWorkflowPayload)
            });
            if (!res.ok) throw new Error('CORS or offline');
            const resData = await res.json();
            promptId = resData.prompt_id;
          } catch (localErr) {
            console.warn("ComfyUI 本地直接请求失败，尝试通过服务端代理进行中转...", localErr);
            // Fallback to Express proxy route
            const res = await fetch(`/api/comfy/run-workflow`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: comfyUrl,
                workflow: finalWorkflowPayload.prompt,
                client_id: `client_${Math.random().toString(36).substring(2, 10)}`
              })
            });
            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(`ComfyUI 本地与代理通道同时连接失败。\n1. 请检查 ComfyUI 是否已在本机正常运行并打开 8188 端口。\n2. 详细代理错误: ${errorText || res.statusText}`);
            }
            const resData = await res.json();
            promptId = resData.prompt_id;
            usedProxyForLocal = true;
          }
        }
        
        const newUrls: string[] = [];
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          let historyData;
          
          if (!isLocal || usedProxyForLocal) {
            const historyRes = await fetch(`/api/comfy/history/${promptId}?url=${encodeURIComponent(comfyUrl)}`);
            historyData = await historyRes.json();
          } else {
            const historyRes = await fetch(`${comfyUrl.replace(/\/$/, '')}/history/${promptId}`);
            historyData = await historyRes.json();
          }
          
          if (historyData[promptId]) {
            const outputs = historyData[promptId].outputs;
            if (outputs && outputs[outputNodeId] && outputs[outputNodeId].images.length > 0) {
              outputs[outputNodeId].images.forEach((img: any) => {
                if (!isLocal || usedProxyForLocal) {
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
        let imgApiKey = apiSettings.apiKey;
        let imgBaseUrl = apiSettings.baseUrl;
        let loraConfig = null;
        
        if (activeTab === 'modelscope') {
          imgApiKey = apiSettings.modelscopeApiKey || '';
          imgBaseUrl = apiSettings.modelscopeBaseUrl || 'https://api-inference.modelscope.cn/v1';
          if (msLoraEnabled && msSelectedLoraId) {
            const foundLora = matchingLoras.find((l: any) => l.id === msSelectedLoraId);
            loraConfig = {
              enabled: true,
              modelId: msSelectedLoraId,
              weight: msLoraWeight,
              triggerWord: foundLora?.triggerWord || '',
              version: foundLora?.version || 'v1.0'
            };
          } else {
            loraConfig = null;
          }
        } else if (activeTab === 'gpt') {
          // Explicitly resolve OpenAI profile/credentials for GPT Image tab
          const openaiProf = (apiSettings.profiles || []).find((p: any) => p.id === 'openai');
          if (openaiProf) {
            imgApiKey = openaiProf.apiKey || imgApiKey;
            imgBaseUrl = openaiProf.baseUrl || imgBaseUrl;
          }
        } else if (activeTab === 'banana') {
          // Explicitly resolve Gemini profile/credentials for Banana Image tab
          const geminiProf = (apiSettings.profiles || []).find((p: any) => p.id === 'gemini');
          if (geminiProf) {
            imgApiKey = geminiProf.apiKey || imgApiKey;
            imgBaseUrl = geminiProf.baseUrl || imgBaseUrl;
          }
        } else if (apiSettings.profiles && apiSettings.activeProfileId) {
          const activeProf = (apiSettings.profiles as any[]).find((p: any) => p.id === apiSettings.activeProfileId);
          if (activeProf) {
            imgApiKey = activeProf.apiKey || imgApiKey;
            imgBaseUrl = activeProf.baseUrl || imgBaseUrl;
          }
        } else {
          const imgEngineConfig = (apiSettings as any).engineConfigs?.[engine];
          imgApiKey = imgEngineConfig?.apiKey || imgApiKey;
          imgBaseUrl = imgEngineConfig?.baseUrl || imgBaseUrl;
        }

        const response = await fetch('/api/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engine,
            baseUrl: imgBaseUrl,
            apiKey: imgApiKey,
            modelId: selectedModel,
            prompt: finalPrompt,
            n: batchSize,
            size: resolution,
            quality,
            lora: loraConfig,
            msAsync: activeTab === 'modelscope' ? msAsync : false,
            opMode: activeTab === 'gpt' ? gptOpMode : 'generations',
            images: activeTab === 'gpt' ? incomingImages : [],
            format: activeTab === 'gpt' ? gptFormat : undefined,
            background: activeTab === 'gpt' ? gptBackground : undefined,
            moderation: activeTab === 'gpt' ? gptModeration : undefined
          })
        });

        const responseText = await response.text();
        let data: any = {};
        try {
          data = JSON.parse(responseText);
        } catch (jsonErr) {
          console.error('Failed to parse image API response JSON:', responseText);
          if (responseText.toLowerCase().includes('<!doctypehtml') || responseText.toLowerCase().includes('<html') || responseText.toLowerCase().includes('<!doctype html')) {
            throw new Error('服务器超时或网关拦截错误 (504 Gateway Timeout)。\n请在右侧侧栏的「设置 (Settings)」中确认您输入的 API 密钥及接口地址是否正确，或是检查网络状况。');
          } else {
            throw new Error(`无法解析服务器返回内容 (Invalid JSON): ${responseText.substring(0, 150)}...`);
          }
        }

        if (!response.ok) {
          throw new Error(data.error || `接口请求失败 (HTTP ${response.status})`);
        }

        const newUrls = data.urls || (data.imageUrl ? [data.imageUrl] : []);

        if (newUrls.length === 0) throw new Error('No image URLs returned from API');

        setPreviewUrls(newUrls);
        updateNodeData(id, { images: newUrls, imageUrl: newUrls[0], prompt, model: selectedModel, resolution, batch: batchSize, activeTab });
        newUrls.forEach((url, idx) => addFile({ name: `${selectedModel} (${idx + 1}) - ${new Date().toLocaleTimeString()}`, type: 'image', url: url }));
      }

    } catch (error: any) {
      console.error('Generation failed:', error);
      let errMsg = '';
      if (activeTab === 'comfyui') {
        const comfyUrl = settings.apiSettings.comfyUrl || 'http://127.0.0.1:8188';
        const isLocal = comfyUrl.includes('127.0.0.1') || comfyUrl.includes('localhost') || comfyUrl.includes('192.168.') || comfyUrl.includes('10.');
        if (isLocal) {
          errMsg = `ComfyUI 本地图片生成失败：\n${error.message || '未知错误'}\n\n💡 诊断建议：\n1. 请确认您的本地 ComfyUI 服务已正常打开运行，且监听了 8188 端口。\n2. 跨域拦截: 请在本地命令行启动 ComfyUI 时附带 "--allow-cors" 参数以支持跨域访问。\n3. HTTPS 限制: 在侧栏“设置”中，点击「在浏览器中打开」，弹出的新页面可能会拦截不安全内容，可以在浏览器地址栏左侧的“网站设置”中，将“不安全内容”设为“允许”。`;
        } else {
          errMsg = `ComfyUI 远程图片生成失败：\n${error.message || '未知错误'}\n\n💡 诊断建议：\n1. 请检查您的 ComfyUI 远程服务地址 (URL) 输入是否完全正确。\n2. 如果使用了公网代理（如 ngrok 等），请确保代理隧道处于 ACTIVE 在线状态，并且服务端已被正确映射启动。`;
        }
      } else {
        errMsg = `图片生成失败: ${error.message || '未知错误'}`;
      }
      setExecutionError(errMsg);
      try {
        alert(errMsg);
      } catch (alertErr) {
        console.warn('alert dialog blocked by iframe sandbox:', alertErr);
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
    else if (activeTab === 'modelscope') {
      if (msRatio === 'custom') {
        const rw = Number(msCustomRatioWidth);
        const rh = Number(msCustomRatioHeight);
        if (rw > 0 && rh > 0) return `${rw}/${rh}`;
      }
      if (msResolution.toLowerCase() === 'custom') {
        const w = Number(msCustomWidth);
        const h = Number(msCustomHeight);
        if (w > 0 && h > 0) return `${w}/${h}`;
      }
      ratioStr = msRatio;
    }
    
    if (!ratioStr || ratioStr === '自动' || ratioStr === 'auto') {
      return '1/1';
    }
    return ratioStr.replace(':', '/');
  };
  const containerAspect = getContainerAspect();

  const renderTabs = () => {
    return (
      <div className="flex bg-[#0f0f11]/70 p-1 rounded-2xl gap-1 mb-4 border border-white/5 shadow-inner nodrag items-center justify-between">
        {ENGINE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const IconComp = tab.icon;
          
          return (
            <button
              key={tab.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id); handleUpdateField('activeTab', tab.id); }}
              className={`flex items-center justify-center gap-1.5 py-1.5 h-8 rounded-xl transition-all duration-300 ease-out cursor-pointer font-bold select-none text-[12px] ${
                isActive 
                  ? 'bg-zinc-100 text-black shadow-lg scale-[1.02] flex-auto px-3' 
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5 flex-1 px-1'
              }`}
              style={{
                flexBasis: isActive ? 'auto' : '0px',
                minWidth: isActive ? 'auto' : '32px'
              }}
              title={tab.name}
            >
              <IconComp size={14} className={isActive ? 'text-black flex-shrink-0' : 'text-zinc-400 flex-shrink-0'} />
              {isActive && (
                <span className="text-[11px] font-sans tracking-wide font-semibold whitespace-nowrap animate-fade-in">
                  {tab.name}
                </span>
              )}
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
            {/* Real-time Dynamic Operations Mode Toggles */}
            <div className="col-span-2 flex gap-1.5 p-1 bg-[#121214]/65 border border-white/5 rounded-2xl">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setGptOpMode('generations'); handleUpdateField('gptOpMode', 'generations'); }}
                className={`flex-1 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                  gptOpMode === 'generations' 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/40 font-extrabold' 
                    : 'bg-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>图像生成 /generations</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setGptOpMode('edits'); handleUpdateField('gptOpMode', 'edits'); }}
                className={`flex-1 py-1.5 text-[10px] font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                  gptOpMode === 'edits' 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/40 font-extrabold' 
                    : 'bg-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>图像编辑 /edits</span>
              </button>
            </div>

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
                <option value="gpt-image-2:stable">gpt-image-2:stable (高成功率)</option>
                <option value="gpt-image-2:nitro">gpt-image-2:nitro (高功速)</option>
                <option value="gpt-image-2:floor">gpt-image-2:floor (低价格)</option>
                <option value="dall-e-3">dall-e-3</option>
                <option value="dall-e-2">dall-e-2</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">比例 / 分辨率</span>
              <select 
                value={gptRatio} 
                onChange={(e) => { e.stopPropagation(); setGptRatio(e.target.value); handleUpdateField('gptRatio', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="自动">自动 (Auto)</option>
                <option value="1024x1024">1024×1024</option>
                <option value="1536x1024">1536×1024 (3:2)</option>
                <option value="1024x1536">1024×1536 (2:3)</option>
                <option value="2048x2048">2048×2048 (1:1)</option>
                <option value="2048x1152">2048×1152 (16:9)</option>
                <option value="3840x2160">3840×2160 (Screen)</option>
                <option value="2160x3840">2160×3840 (Portrait)</option>
                <option value="1:1">1:1 (DALL-E 3)</option>
                <option value="3:4">3:4</option>
                <option value="4:3">4:3</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">质量 (Quality)</span>
              <select 
                value={gptQuality} 
                onChange={(e) => { e.stopPropagation(); setGptQuality(e.target.value); handleUpdateField('gptQuality', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="auto">auto (自动)</option>
                <option value="high">high (精细画质)</option>
                <option value="medium">medium (中等品质)</option>
                <option value="low">low (低品质极速)</option>
                <option value="standard">standard</option>
                <option value="hd">hd</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider">输出格式 (Format)</span>
              <select 
                value={gptFormat} 
                onChange={(e) => { e.stopPropagation(); setGptFormat(e.target.value); handleUpdateField('gptFormat', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                <option value="jpeg">jpeg</option>
                <option value="png">png</option>
                <option value="webp">webp</option>
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

            {/* Render extra edits options when 'edits' operation mode selected */}
            {gptOpMode === 'edits' && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-gray-500 font-bold uppercase tracking-wider">背景模式 (Background)</span>
                  <select 
                    value={gptBackground} 
                    onChange={(e) => { e.stopPropagation(); setGptBackground(e.target.value); handleUpdateField('gptBackground', e.target.value); }}
                    className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
                  >
                    <option value="auto">auto (自动)</option>
                    <option value="white">white (白背景)</option>
                    <option value="black">black (黑背景)</option>
                    <option value="transparent">transparent (保持原图)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-gray-500 font-bold uppercase tracking-wider">审核屏蔽 (Moderation)</span>
                  <select 
                    value={gptModeration} 
                    onChange={(e) => { e.stopPropagation(); setGptModeration(e.target.value); handleUpdateField('gptModeration', e.target.value); }}
                    className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
                  >
                    <option value="auto">auto (默认防屏蔽)</option>
                    <option value="off">off (关闭审核)</option>
                    <option value="strict">strict (严格审核)</option>
                  </select>
                </div>

                {incomingImages.length === 0 && (
                  <div className="col-span-2 text-indigo-400 bg-indigo-950/20 px-3 py-2.5 rounded-xl border border-indigo-500/10 leading-normal text-[9.5px]">
                    💡 提示: 您当前处于「图像编辑/融合」模式。请连接两个或多个图片节点来传递参考素材。您可以输入文字指示（例如：“合并到一起”）并执行合并画图。
                  </div>
                )}
              </>
            )}

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
      case 'comfyui': {
        const activeWfDetails = (settings.apiSettings.comfyWorkflowsDetails || []).find(
          wf => wf.name === comfyWorkflow
        );
        const isParamsEnabled = activeWfDetails && activeWfDetails.enableParams === true;
        const fields = activeWfDetails ? getOrExtractWorkflowFields(activeWfDetails) : [];
        const exposedFields = fields.filter((f: any) => f.enabled !== false);

        return (
          <div className="flex flex-col gap-3.5 mb-4 text-[11px] bg-black/10 p-3.5 rounded-2xl border border-white/5 nodrag">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 font-extrabold uppercase tracking-wider text-[10px]">服务地址与端口</span>
                <span className="text-zinc-600 font-mono text-[9px] cursor-pointer hover:text-zinc-400 select-none" onClick={() => {
                  updateSettings({
                    apiSettings: {
                      ...settings.apiSettings,
                      comfyUrl: 'http://127.0.0.1:8188'
                    }
                  });
                }} title="重置为默认 8188">默认端口</span>
              </div>
              <input 
                type="text"
                value={settings.apiSettings.comfyUrl || 'http://127.0.0.1:8188'}
                onChange={(e) => {
                  e.stopPropagation();
                  updateSettings({
                    apiSettings: {
                      ...settings.apiSettings,
                      comfyUrl: e.target.value
                    }
                  });
                }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 outline-none w-full h-8 text-[11px]"
                placeholder="http://127.0.0.1:8188"
              />
            </div>
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

            {/* Dynamic Local Param Panels */}
            {isParamsEnabled && exposedFields.length > 0 ? (
              <div className="mt-1 border border-white/5 bg-[#121214]/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={handleToggleComfyParams}
                  className="w-full px-3 py-2 flex items-center justify-between text-zinc-350 hover:text-white bg-[#1a1a20]/40 select-none cursor-pointer border-none outline-none font-bold"
                >
                  <div className="flex items-center gap-1.5 font-bold text-zinc-300">
                    <Sliders size={11} className="text-zinc-500" />
                    <span>工作流参数调节 ({exposedFields.length})</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-350 font-mono">
                    {showComfyParams ? '收起' : '展开'}
                  </span>
                </button>
                
                {showComfyParams && (
                  <div className="p-3 space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar bg-black/10 divide-y divide-white/[0.04]">
                    {exposedFields.map((f: any) => {
                      const paramKey = `${f.nodeId}-${f.fieldKey}`;
                      const currentVal = comfyParams[paramKey] !== undefined ? comfyParams[paramKey] : f.fieldValue;
                      
                      const isSteps = f.fieldKey.toLowerCase() === 'steps';
                      const isCfg = f.fieldKey.toLowerCase() === 'cfg';
                      const isDenoise = f.fieldKey.toLowerCase() === 'denoise';
                      const isSeed = f.fieldKey.toLowerCase() === 'seed';
                      const isSampler = f.fieldKey.toLowerCase() === 'sampler_name';
                      const isScheduler = f.fieldKey.toLowerCase() === 'scheduler';
                      const isText = f.fieldKey.toLowerCase() === 'text';

                      // Determine actual form control types
                      const resolvedType = f.type || (
                        isSteps || isCfg || isDenoise ? 'slider' :
                        isSeed ? 'number' :
                        isSampler || isScheduler ? 'dropdown' :
                        isText ? 'textarea' : 'text'
                      );

                      return (
                        <div key={paramKey} className="pt-2.5 first:pt-0 text-left">
                          {resolvedType === 'slider' && (
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-zinc-400 font-bold">{f.label || `Node ${f.nodeId} - ${f.fieldKey}`}</span>
                                <span className="text-indigo-400 font-mono font-bold bg-[#1d1d22] px-1.5 py-0.2 rounded border border-white/5">{currentVal}</span>
                              </div>
                              <input
                                type="range"
                                min={f.min !== undefined ? f.min : (isDenoise ? 0.0 : 1)}
                                max={f.max !== undefined ? f.max : (isCfg ? 20.0 : isDenoise ? 1.0 : 100)}
                                step={f.step !== undefined ? f.step : (isDenoise ? 0.05 : isCfg ? 0.5 : 1)}
                                value={currentVal !== undefined ? currentVal : (isDenoise ? 1.0 : isCfg ? 8.0 : 20)}
                                onChange={(e) => handleUpdateComfyParam(paramKey, parseFloat(e.target.value))}
                                className="w-full accent-indigo-500 bg-zinc-805 h-1 rounded outline-none cursor-pointer"
                              />
                            </div>
                          )}

                          {resolvedType === 'number' && (
                            <div className="flex flex-col gap-1">
                              <span className="text-zinc-400 text-[10px] font-bold">{f.label || `Node ${f.nodeId} - ${f.fieldKey}`}</span>
                              <div className="flex gap-1.5 items-center">
                                <input
                                  type="number"
                                  value={currentVal !== undefined ? currentVal : ''}
                                  onChange={(e) => handleUpdateComfyParam(paramKey, e.target.value === '' ? '' : parseFloat(e.target.value))}
                                  className="flex-1 px-2.2 py-1 bg-[#0e0e11] border border-white/5 rounded-lg text-zinc-300 font-mono text-[9px] outline-none"
                                />
                                {(f.random_enabled !== false || isSeed) && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateComfyParam(paramKey, Math.floor(Math.random() * 9999999999))}
                                    className="px-2 py-1 bg-indigo-650 hover:bg-indigo-550 border border-white/5 text-white rounded-md text-[9px] font-bold shrink-0 cursor-pointer transition-colors"
                                  >
                                    🎲 随机
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {resolvedType === 'dropdown' && (
                            <div className="flex flex-col gap-1">
                              <span className="text-zinc-400 text-[10px] font-bold">{f.label || `Node ${f.nodeId} - ${f.fieldKey}`}</span>
                              <select
                                value={currentVal || ''}
                                onChange={(e) => handleUpdateComfyParam(paramKey, e.target.value)}
                                className="px-2 py-1 bg-[#0e0e11] border border-white/5 rounded-lg text-zinc-300 outline-none text-[10px] w-full cursor-pointer font-sans"
                              >
                                {f.options && f.options.length > 0 ? (
                                  f.options.map((opt: any) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))
                                ) : isScheduler ? (
                                  ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'].map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))
                                ) : (
                                  ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'lms', 'dpmpp_2s_ancestral', 'dpmpp_sde', 'dpmpp_2m', 'dpmpp_2m_sde', 'uni_pc'].map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))
                                )}
                              </select>
                            </div>
                          )}

                          {resolvedType === 'textarea' && (
                            <div className="flex flex-col gap-1">
                              <span className="text-zinc-400 text-[10px] font-bold">{f.label || `Node ${f.nodeId} - ${f.fieldKey}`}</span>
                              <textarea
                                value={currentVal || ''}
                                onChange={(e) => handleUpdateComfyParam(paramKey, e.target.value)}
                                rows={2.5}
                                className="w-full px-2 py-1.5 bg-[#0e0e11] border border-white/5 rounded-lg text-zinc-305 font-sans text-[10px] resize-none outline-none focus:border-indigo-550"
                                placeholder="..."
                              />
                            </div>
                          )}

                          {resolvedType === 'boolean' && (
                            <div className="flex items-center justify-between py-1">
                              <span className="text-zinc-400 text-[10px] font-bold">{f.label || `Node ${f.nodeId} - ${f.fieldKey}`}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateComfyParam(paramKey, !currentVal)}
                                className={`w-8 h-4 rounded-full p-0.5 transition-all outline-none flex items-center cursor-pointer border-none ${currentVal ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                              >
                                <div className={`w-3 h-3 rounded-full bg-white transition-all transform ${currentVal ? 'translate-x-4' : 'translate-x-0'}`} />
                              </button>
                            </div>
                          )}

                          {(resolvedType === 'image' || resolvedType === 'video' || resolvedType === 'audio') && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-zinc-400 text-[10px] font-bold">{f.label || `Node ${f.nodeId} - ${f.fieldKey}`}</span>
                              <div className="flex flex-col gap-2 p-2.5 bg-[#0a0a0f] border border-white/5 rounded-xl text-[9.5px]">
                                <div className="flex items-center justify-between gap-1 select-none text-zinc-500">
                                  <span className="truncate max-w-[130px] font-mono" title={currentVal || ''}>{currentVal ? `📂 ${currentVal}` : '未选择文件'}</span>
                                  {currentVal && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateComfyParam(paramKey, '')}
                                      className="text-red-400 hover:text-red-300 font-bold px-1 rounded hover:bg-white/5 border-none bg-transparent"
                                    >
                                      清除
                                    </button>
                                  )}
                                </div>

                                <div className="relative">
                                  <input
                                    type="file"
                                    accept={resolvedType === 'image' ? 'image/*' : resolvedType === 'video' ? 'video/*' : 'audio/*'}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;

                                      try {
                                        const comfyUrl = settings.apiSettings.comfyUrl || 'http://127.0.0.1:8188';
                                        
                                        const formData = new FormData();
                                        formData.append('image', file);
                                        formData.append('url', comfyUrl);

                                        const response = await fetch('/api/comfy/upload-image', {
                                          method: 'POST',
                                          body: formData
                                        });
                                        const data = await response.json();
                                        if (data.name) {
                                          handleUpdateComfyParam(paramKey, data.name);
                                          alert('🎉 文件已成功同步上传至 ComfyUI 宿主机中！');
                                        } else {
                                          handleUpdateComfyParam(paramKey, file.name);
                                          alert('✨ 本地路径暂定! 已代入文件名作为输入。');
                                        }
                                      } catch (err) {
                                        console.error(err);
                                        handleUpdateComfyParam(paramKey, file.name);
                                      }
                                    }}
                                    className="hidden"
                                    id={`file-param-${paramKey}`}
                                  />
                                  <label
                                    htmlFor={`file-param-${paramKey}`}
                                    className="w-full flex items-center justify-center py-1.5 bg-indigo-650/20 hover:bg-indigo-650/40 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/30 rounded-lg text-[9px] font-bold cursor-pointer transition-all select-none"
                                  >
                                    选择 / 上传{resolvedType === 'image' ? '照片' : resolvedType === 'video' ? '视频' : '音频'}
                                  </label>
                                </div>
                              </div>
                            </div>
                          )}

                          {resolvedType === 'text' && (
                            <div className="flex flex-col gap-1">
                              <span className="text-zinc-400 text-[10px] font-bold">{f.label || `Node ${f.nodeId} - ${f.fieldKey}`}</span>
                              <input
                                type="text"
                                value={currentVal ?? ''}
                                onChange={(e) => handleUpdateComfyParam(paramKey, e.target.value)}
                                className="w-full px-2 py-1.5 bg-[#0e0e11] border border-white/5 rounded-lg text-zinc-300 font-mono text-[10px] outline-none focus:border-indigo-550"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeWfDetails && (comfyWorkflow !== '请先在设置中选择文件夹') ? (
              <div className="mt-1 border border-white/5 bg-[#121214]/20 p-3 rounded-xl flex items-center justify-between gap-3 text-left">
                <div className="space-y-0.5 flex-1">
                  <span className="text-zinc-350 font-bold block text-[10px]">工作流本地调参已关闭</span>
                  <span className="text-[9px] text-zinc-500 leading-normal block">
                    调参遥控模块已就绪。请在此处或侧栏「设置 - ComfyUI」中为此工作流开启“调试控制”，即可实时调节参数。
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const updatedDetails = (settings.apiSettings.comfyWorkflowsDetails || []).map(item => {
                      if (item.id === activeWfDetails.id) {
                        return { ...item, enableParams: true };
                      }
                      return item;
                    });
                    updateSettings({
                      apiSettings: {
                        ...settings.apiSettings,
                        comfyWorkflowsDetails: updatedDetails
                      }
                    });
                  }}
                  className="px-2 py-1.5 shrink-0 bg-indigo-600/10 hover:bg-indigo-600/20 active:bg-indigo-600/30 border border-indigo-505/20 hover:border-indigo-500/30 text-indigo-400 rounded-md font-bold text-[9px] select-none transition-all cursor-pointer outline-none"
                >
                  一键开启
                </button>
              </div>
            ) : null}
            
            <div className="text-[10px] font-mono text-zinc-500 mt-1.5 flex items-center gap-2 bg-black/15 px-3 py-2 rounded-xl border border-white/5 select-none text-left">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span>服务地址: {settings.apiSettings.comfyUrl || 'http://127.0.0.1:8188'}</span>
            </div>
          </div>
        );
      }
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
      case 'modelscope':
        return (
          <div className="grid grid-cols-2 gap-3 mb-4 text-[11px] nodrag">
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">ModelScope 选择模型</span>
              <select 
                value={msModel} 
                onChange={(e) => { e.stopPropagation(); setMsModel(e.target.value); handleUpdateField('msModel', e.target.value); }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px]"
              >
                {msModelsAvailable.map((m: string) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {(() => {
                const isDashScopeProxied = msModel.toLowerCase().includes('tongyi') || msModel.toLowerCase().includes('qwen') || msModel.toLowerCase().includes('wanx');
                if (isDashScopeProxied) {
                  return (
                    <div className="text-red-400 bg-red-950/20 px-2.5 py-2 rounded-xl border border-red-500/10 mt-1 leading-normal text-[10px]">
                      ⚠️ <strong>阿里托管模型：</strong>魔搭网关暂不支持极简 Token 轮询托管模型任务（轮询常伴随 500 报错）。如果使用普通魔搭 Key，<strong>强烈推荐切换为下方的 FLUX.2-klein-9B</strong>，或更换为 sk- 开头的阿里云 DashScope 官方密钥。
                    </div>
                  );
                } else {
                  return (
                    <div className="text-emerald-400 bg-emerald-950/20 px-2.5 py-2 rounded-xl border border-emerald-500/10 mt-1 leading-normal text-[10px]">
                      ✨ <strong>魔搭原生模型：</strong>支持原生魔搭 Token 高速同步取得图片，无需异步轮询，高稳定性，<strong>极力推荐！</strong>
                    </div>
                  );
                }
              })()}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">比例</span>
              <select 
                value={msRatio} 
                disabled={msResolution === 'custom'}
                onChange={(e) => { 
                  e.stopPropagation(); 
                  const val = e.target.value;
                  setMsRatio(val); 
                  handleUpdateField('msRatio', val); 
                  if (val === 'custom') {
                    // Set default custom ratio if empty
                    if (!msCustomRatioWidth) { setMsCustomRatioWidth('16'); handleUpdateField('msCustomRatioWidth', '16'); }
                    if (!msCustomRatioHeight) { setMsCustomRatioHeight('9'); handleUpdateField('msCustomRatioHeight', '9'); }
                  }
                }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px] disabled:opacity-50"
              >
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="3:2">3:2</option>
                <option value="2:3">2:3</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
                <option value="custom">自定义比例</option>
                <option value="自动">自动 (Auto)</option>
              </select>
              {msRatio === 'custom' && (
                <div className="flex items-center gap-1 mt-1 animate-fadeIn">
                  <input 
                    type="number" 
                    min="1" 
                    placeholder="宽"
                    value={msCustomRatioWidth}
                    onChange={(e) => { e.stopPropagation(); setMsCustomRatioWidth(e.target.value); handleUpdateField('msCustomRatioWidth', e.target.value); }}
                    className="w-1/2 px-2 py-1 text-[11px] bg-[#121214]/80 border border-white/10 rounded-lg text-white font-mono h-7 outline-none focus:border-indigo-500"
                  />
                  <span className="text-zinc-650">:</span>
                  <input 
                    type="number" 
                    min="1" 
                    placeholder="高"
                    value={msCustomRatioHeight}
                    onChange={(e) => { e.stopPropagation(); setMsCustomRatioHeight(e.target.value); handleUpdateField('msCustomRatioHeight', e.target.value); }}
                    className="w-1/2 px-2 py-1 text-[11px] bg-[#121214]/80 border border-white/10 rounded-lg text-white font-mono h-7 outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">分辨率</span>
              <select 
                value={msResolution} 
                disabled={msRatio === 'custom'}
                onChange={(e) => { 
                  e.stopPropagation(); 
                  const val = e.target.value;
                  setMsResolution(val); 
                  handleUpdateField('msResolution', val); 
                  if (val === 'custom') {
                    if (!msCustomWidth) { setMsCustomWidth('1024'); handleUpdateField('msCustomWidth', '1024'); }
                    if (!msCustomHeight) { setMsCustomHeight('1024'); handleUpdateField('msCustomHeight', '1024'); }
                  }
                }}
                className="px-3 py-2 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none w-full cursor-pointer h-9 text-[11px] disabled:opacity-50"
              >
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
                <option value="custom">自定义尺寸</option>
                <option value="512x512">512x512</option>
                <option value="768x768">768x768</option>
              </select>
              {msResolution === 'custom' && (
                <div className="flex items-center gap-1 mt-1 animate-fadeIn">
                  <input 
                    type="number" 
                    min="64"
                    step="64"
                    placeholder="宽"
                    value={msCustomWidth}
                    onChange={(e) => { e.stopPropagation(); setMsCustomWidth(e.target.value); handleUpdateField('msCustomWidth', e.target.value); }}
                    className="w-[38%] px-1.5 py-1 text-[11px] bg-[#121214]/80 border border-white/10 rounded-lg text-white font-mono h-7 outline-none focus:border-indigo-500"
                  />
                  <span className="text-zinc-650">x</span>
                  <input 
                    type="number" 
                    min="64"
                    step="64"
                    placeholder="高"
                    value={msCustomHeight}
                    onChange={(e) => { e.stopPropagation(); setMsCustomHeight(e.target.value); handleUpdateField('msCustomHeight', e.target.value); }}
                    className="w-[38%] px-1.5 py-1 text-[11px] bg-[#121214]/80 border border-white/10 rounded-lg text-white font-mono h-7 outline-none focus:border-indigo-500"
                  />
                  <button 
                    type="button"
                    disabled={incomingImages.length === 0}
                    onClick={(e) => { e.stopPropagation(); handleMsFitToImage(); }}
                    className="px-1.5 bg-indigo-600 hover:bg-indigo-550 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white rounded-md text-[9px] font-bold text-center h-7 outline-none border-none cursor-pointer flex-1 flex items-center justify-center truncate"
                    title="自动适配输入参考图的长宽像素值"
                  >
                    适配
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 col-span-2 mt-1">
              <div className="flex justify-between items-center bg-black/25 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-gray-400 font-extrabold text-[10px]">异步轮询 (Async)</span>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMsAsync(!msAsync); handleUpdateField('msAsync', !msAsync); }}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer border-none ${msAsync ? 'bg-red-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${msAsync ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Model-Adaptive LoRA Block */}
            <div className="col-span-2 bg-red-500/5 border border-red-500/10 rounded-xl p-2.5 mt-1 font-sans space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-[10px] text-red-500 flex items-center gap-1">
                  <span>🧬 适配 LoRA 插件</span>
                  {matchingLoras.length > 0 && (
                    <span className="bg-red-500/10 text-red-400 text-[8px] px-1 rounded-full font-mono">
                      {matchingLoras.length}
                    </span>
                  )}
                </span>
                
                {matchingLoras.length > 0 && (
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setMsLoraEnabled(!msLoraEnabled); 
                      handleUpdateField('msLoraEnabled', !msLoraEnabled); 
                    }}
                    className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer border-none flex items-center ${msLoraEnabled ? 'bg-red-650' : 'bg-zinc-700'}`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${msLoraEnabled ? 'translate-x-3' : 'translate-x-0'}`} />
                  </button>
                )}
              </div>

              {matchingLoras.length > 0 ? (
                <>
                  {/* Select active LoRA if multiple exist */}
                  {matchingLoras.length > 1 ? (
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">选择可用 LoRA</span>
                      <select
                        value={msSelectedLoraId}
                        disabled={!msLoraEnabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          const val = e.target.value;
                          setMsSelectedLoraId(val);
                          handleUpdateField('msSelectedLoraId', val);
                          const targetObj = matchingLoras.find(l => l.id === val);
                          if (targetObj) {
                            setMsLoraWeight(targetObj.weight || 0.8);
                            handleUpdateField('msLoraWeight', targetObj.weight || 0.8);
                          }
                        }}
                        className="px-2 py-1 bg-zinc-900 border border-white/5 rounded-lg text-zinc-300 font-mono text-[9.5px] disabled:opacity-50 h-7"
                      >
                        {matchingLoras.map((lora) => (
                          <option key={lora.id} value={lora.id}>
                            {lora.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="text-[9.5px] text-zinc-400 font-mono truncate">
                      自动适配: <span className="text-zinc-200">{msSelectedLoraId}</span>
                    </div>
                  )}

                  {msLoraEnabled && (
                    <div className="space-y-1 mt-1 animate-fadeIn">
                      <div className="flex justify-between text-[9px] text-zinc-500 font-bold">
                        <span>调整融合权重</span>
                        <span className="text-red-400 font-mono font-bold">{msLoraWeight.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.05"
                        value={msLoraWeight}
                        onChange={(e) => {
                          e.stopPropagation();
                          const val = parseFloat(e.target.value);
                          setMsLoraWeight(val);
                          handleUpdateField('msLoraWeight', val);
                        }}
                        className="w-full accent-red-500 h-1 cursor-pointer"
                      />
                      
                      {matchingLoras.find(l => l.id === msSelectedLoraId)?.triggerWord && (
                        <div className="text-[9px] text-zinc-400">
                          触发词: <span className="text-red-450 font-extrabold">{matchingLoras.find(l => l.id === msSelectedLoraId)?.triggerWord}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[9.5px] text-zinc-500 italic py-1 border border-dashed border-white/5 rounded-lg text-center bg-black/10">
                  ⚠️ 未检索到当前模型的适配 LoRA。可在设置中配置绑定。
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
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
            {generationTime !== null && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-black tracking-wide shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>已用时间: {generationTime} 秒</span>
              </div>
            )}
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

        <style>{`
          @keyframes scan {
            0% { top: 0%; opacity: 0.3; }
            50% { top: 100%; opacity: 1; }
            100% { top: 0%; opacity: 0.3; }
          }
          @keyframes progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>

        {/* Generated Image Preview Grid Area */}
        <div className={`p-4 min-h-[220px] max-h-[350px] flex items-center justify-center relative border-b border-[var(--border)] overflow-hidden ${
          settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-[var(--bg-primary)]/40'
        }`}>
          {previewUrls.length > 0 ? (
            <div className={`grid gap-4 w-full h-full relative z-10 ${
              previewUrls.length === 1 ? 'grid-cols-1 font-bold' :
              previewUrls.length === 2 ? 'grid-cols-2' :
              previewUrls.length === 4 ? 'grid-cols-2' : 'grid-cols-1'
            }`}>
              {previewUrls.map((url, idx) => (
                <div 
                  key={idx} 
                  style={{ aspectRatio: containerAspect }} 
                  onDoubleClick={() => handleImageDoubleClick(url)}
                  className="w-full h-full max-h-[310px] flex items-center justify-center overflow-hidden border border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)] relative group/prev hover:border-zinc-500 transition-all shadow-md shrink-0 cursor-pointer"
                >
                  <img draggable={false} src={url} alt={`Generated ${idx}`} className="w-full h-full object-contain select-none p-1 bg-black/10" />
                  
                  {/* Deletion, Redo, Annotation Floating Hover Buttons */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/prev:opacity-100 transition-all duration-150 flex items-center justify-center gap-3">
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAnnotatingUrl({ url, idx }); }}
                      className="p-2 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer pointer-events-auto flex items-center justify-center"
                      title="标注与编辑"
                    >
                      <Pencil size={14} className="text-zinc-100" />
                    </button>
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
              ))}
            </div>
          ) : loading ? (
            /* Loop Sweep Scanning Glow & Dynamic State Prompting Placeholder */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center select-none bg-gradient-to-b from-indigo-500/5 to-purple-500/5 p-6 animate-pulse overflow-hidden">
              {/* Loop Scanning light animation line */}
              <div 
                style={{
                  background: 'linear-gradient(90deg, transparent, var(--accent, #6366f1), transparent)',
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.8)',
                  animation: 'scan 2.5s ease-in-out infinite',
                }}
                className="absolute left-0 w-full h-[3px]" 
              />
              
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center relative overflow-hidden">
                {/* Embedded sweep light effect inside the ring */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-indigo-500/10 to-transparent rotate-45 scale-150 animate-[spin_3s_linear_infinite]" />
                <Sparkles size={28} className="text-indigo-400 animate-bounce" />
              </div>

              <div className="flex flex-col items-center gap-1.5 z-10">
                <span className="text-xs font-black text-indigo-400 tracking-widest font-sans uppercase">
                  AI 正在生图绘画中...
                </span>
                <p className="text-[10px] text-indigo-300/60 max-w-[220px] font-mono leading-relaxed">
                  请稍后，AI 正在为您全力生成像素画布。
                </p>
                {/* Dynamic Status Progress bar */}
                <div className="w-36 h-[3px] bg-zinc-800/85 rounded-full mt-2.5 overflow-hidden border border-white/5 relative">
                  <div 
                    style={{ animation: 'progress 1.8s ease-in-out infinite' }}
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 w-full origin-left-right" 
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Standby State */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500 select-none p-6">
              <div className="w-14 h-14 rounded-full bg-zinc-800/20 border border-white/5 flex items-center justify-center text-zinc-600 shadow-inner">
                <Sparkles size={24} className="stroke-[1.5] text-zinc-600" />
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-xs font-bold text-zinc-400 tracking-wider font-sans">
                  等待图像生成
                </span>
                <p className="text-[10px] text-zinc-500 max-w-[220px] leading-relaxed">
                  在下方输入提示词并选择模型后，点击生成按钮开始
                </p>
              </div>
            </div>
          )}

          {isDragOver && (
            <div className="absolute inset-0 bg-accent/10 backdrop-blur-[2px] pointer-events-none z-[100] flex items-center justify-center">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                <Plus size={32} className="text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Configurations, Connected Images & Controls Area */}
        <div className={`p-5 transition-all rounded-b-3xl relative z-20 ${
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
                {incomingImages.map((url, index) => {
                  const isSelected = parsedPromptInfo.imageIndexes.includes(index);
                  return (
                    <div 
                      key={index} 
                      onClick={() => handleThumbnailClick(index)}
                      className="flex flex-col items-center gap-1.5 shrink-0 group/ref relative cursor-pointer select-none transition-all"
                    >
                      <div className={`w-14 h-14 rounded-xl overflow-hidden border transition-all flex items-center justify-center relative shadow-sm ${
                        isSelected 
                          ? 'border-red-550 ring-2 ring-red-500/35 scale-105 bg-red-500/5' 
                          : 'border-white/10 bg-[#121214] hover:border-white/20'
                      }`}>
                        <ImageGenRefThumbnail url={url} alt={`Ref ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/ref:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-black uppercase bg-red-500 text-white px-1.5 py-0.5 rounded-md shadow-lg">
                            @ {index + 1}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold transition-colors ${
                        isSelected ? 'text-red-400 font-extrabold' : 'text-zinc-500 group-hover/ref:text-zinc-400'
                      }`}>
                        图片 {index + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Interactive Input Textarea Area */}
          <div className="relative mb-4 nodrag animate-fadeIn" ref={dropdownRef}>
            {/* The Dropdown Menu shown in Image 3 */}
            {showRefDropdown && incomingImages.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-full bg-[#16161a] border border-white/10 rounded-2xl p-2 flex flex-col gap-1 shadow-2xl z-50 max-h-[220px] overflow-y-auto custom-scrollbar">
                {incomingImages.map((url, idx) => {
                  const isHighlighted = idx === dropdownActiveIdx;
                  const isSelected = activeClickedTag 
                    ? activeClickedTag.imageIndex === idx 
                    : prompt.includes(`@图片${idx + 1}`) || prompt.includes(`@参考图${idx + 1}`);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectRefImage(idx)}
                      onMouseEnter={() => setDropdownActiveIdx(idx)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer text-left border-none w-full ${
                        isHighlighted 
                          ? 'bg-indigo-650/40 text-indigo-400 font-extrabold ring-1 ring-indigo-500/30' 
                          : isSelected 
                            ? 'bg-indigo-650/15 text-indigo-400 font-extrabold' 
                            : 'bg-transparent text-zinc-350 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <ImageGenRefThumbnail 
                        url={url} 
                        alt={`Pic ${idx + 1}`} 
                        className={`w-7 h-7 rounded-lg object-cover bg-black/20 border ${isHighlighted || isSelected ? 'border-accent/40' : 'border-white/5'}`} 
                      />
                      <span className={`text-xs font-bold ${isHighlighted || isSelected ? 'text-indigo-400' : ''}`}>
                        图片{idx + 1} {isSelected && '(已选)'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* The beautifully synchronized rich mention field */}
            <div className="relative w-full min-h-[110px] bg-[#121214]/60 border border-white/5 rounded-2xl focus-within:border-indigo-500/50 transition-all overflow-hidden cursor-text">
              {/* Backdrop rendering layered at bottom (z-10) with pointer-events-none and select-none */}
              <div 
                ref={backdropRef}
                className={`absolute inset-0 p-4 font-sans text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words text-transparent pointer-events-none select-none overflow-y-auto custom-scrollbar z-10 ${getFontSizeClass()}`}
                style={{
                  ...getFontSizeStyle(),
                  maxHeight: '100%'
                }}
              >
                {renderHighlightedPrompt()}
              </div>
              
              {/* Actual interactive `<textarea>` on top (z-20) with synchronized caret and IME composition support */}
              <textarea
                ref={textareaRef}
                style={{
                  ...getFontSizeStyle(),
                  caretColor: '#818cf8', // Indigo focus blinking caret
                  color: (isComposing || !prompt) ? 'var(--text-primary)' : 'transparent',
                  WebkitTextFillColor: (isComposing || !prompt) ? 'var(--text-primary)' : 'transparent',
                  background: 'transparent',
                }}
                value={prompt}
                onChange={handleTextareaChange}
                onBlur={handleTextareaBlur}
                onClick={handleTextareaClick}
                onSelect={handleTextareaSelect}
                onKeyUp={handleTextareaSelect}
                onScroll={handleTextareaScroll}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(e: any) => {
                  setIsComposing(false);
                  handleTextareaChange(e);
                }}
                className={`absolute inset-0 w-full h-full p-4 font-sans text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words bg-transparent border-none outline-none ring-0 resize-none focus:outline-none focus:ring-0 focus:border-none z-20 custom-scrollbar ${activeClickedTag ? 'selection:bg-transparent' : 'selection:bg-indigo-500/20'} ${getFontSizeClass()}`}
                placeholder="描述你想要生成的内容，输入 @ 可引用已连接的参考图..."
              />
            </div>
          </div>
          
          {/* 4.5 Visually display error message inside the Node UI to keep UX pristine */}
          {executionError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-[11px] p-3 rounded-xl flex items-start gap-2 mb-4 select-text nodrag max-h-[140px] overflow-y-auto custom-scrollbar">
              <span className="text-red-400 mt-0.5">⚠️</span>
              <div className="flex-1 leading-relaxed">
                <span className="font-bold">生成失败:</span> {executionError}
              </div>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setExecutionError(null); }} 
                className="text-red-400/60 hover:text-red-300 text-[10px] bg-transparent border-none p-0 cursor-pointer self-start ml-1"
              >
                ✕
              </button>
            </div>
          )}

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
        className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!bg-green-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#222] shadow-sm hover:!scale-150 hover:!border-white transition-all duration-200 z-50 ease-out"  
      />
    </div>

    {fullscreenUrl && createPortal(
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={handleWheel}
          className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 overflow-hidden"
        >
          <div className="absolute top-6 right-6 flex items-center gap-3 z-100">
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md rounded-2xl border border-[var(--border)] p-1.5 px-3">
              <button 
                onClick={() => setZoomScale(Math.max(zoomScale - 0.2, 0.5))}
                className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all cursor-pointer"
              >
                <ZoomOut size={20} />
              </button>
              <span className="text-white/80 font-mono text-lg min-w-[60px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <button 
                onClick={() => setZoomScale(Math.min(zoomScale + 0.2, 5))}
                className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all cursor-pointer"
              >
                <ZoomIn size={20} />
              </button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button 
                onClick={() => { setZoomScale(1); setZoomOffset({ x: 0, y: 0 }); }}
                className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all cursor-pointer"
                title="Reset"
              >
                <RotateCcw size={18} />
              </button>
            </div>

            <button 
              onClick={() => { setFullscreenUrl(null); setZoomScale(1); setZoomOffset({ x: 0, y: 0 }); }} 
              className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-red-500 text-white rounded-2xl transition-all border border-[var(--border)] shadow-2xl cursor-pointer"
            >
              <X size={24} />
            </button>
          </div>

          <div 
            className={`w-full h-full flex items-center justify-center overflow-hidden ${zoomScale > 1 ? 'cursor-move' : 'cursor-default'}`}
            onMouseDown={handleImageMouseDown}
            onMouseMove={handleImageMouseMove}
            onMouseUp={handleImageMouseUp}
            onMouseLeave={handleImageMouseUp}
          >
            <motion.div 
              animate={{ 
                scale: zoomScale,
                x: zoomOffset.x,
                y: zoomOffset.y
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img draggable={false} 
                src={fullscreenUrl} 
                alt="Fullscreen" 
                className="max-w-[90vw] max-h-[85vh] object-contain shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-3xl border border-[var(--border)] select-none pointer-events-none" 
              />
            </motion.div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl border border-[var(--border)] rounded-[24px] z-50">
             <div className="flex items-center gap-2 pr-4 border-r border-[var(--border)]">
               <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
               <span className="text-sm font-bold text-white/40 tracking-wider">GENERATED PREVIEW</span>
             </div>
             <span className="text-sm font-mono text-white/60">
               PREVIEW MODE
             </span>
          </div>
        </motion.div>
      </AnimatePresence>,
      document.body
    )}

    {annotatingUrl && (
      <AnnotationModal
        imageUrl={annotatingUrl.url}
        onClose={() => setAnnotatingUrl(null)}
        onSave={(newUrl) => {
          const newUrls = [...previewUrls];
          newUrls[annotatingUrl.idx] = newUrl;
          updateNodeData(id, { images: newUrls });
          setAnnotatingUrl(null);
        }}
      />
    )}
  </>
  );
};
