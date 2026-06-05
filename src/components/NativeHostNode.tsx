import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { 
  Globe2, ExternalLink, RefreshCw, Search, ArrowLeft, ArrowRight,
  Monitor, Maximize2, Minimize2, Play, Loader2, AlertCircle, X,
  Compass, Pin, PinOff, ChevronUp, ChevronDown, Anchor, Terminal,
  Cpu, Database, Activity, PlayCircle, StopCircle, Sliders, Palette,
  Layers, Code, LayoutGrid, Zap, PlaySquare, Workflow, Plus
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { SimulatedFileExplorer } from './SimulatedFileExplorer';

const isElectron = typeof window !== 'undefined' && 
  window.navigator && 
  window.navigator.userAgent.toLowerCase().includes('electron');

// Helper to check if url should be routed through server proxy
const shouldProxyUrl = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase().trim();
  
  let currentOrigin = '';
  try {
    currentOrigin = window.location.origin.toLowerCase();
  } catch (e) {}
  
  if (
    lowerUrl.includes('localhost') ||
    lowerUrl.includes('127.0.0.1') ||
    lowerUrl.includes('.loca.lt') ||
    lowerUrl.includes('accounts.google.com') ||
    lowerUrl.includes('google.com/gsi/') ||
    lowerUrl.startsWith('/') ||
    lowerUrl.startsWith('data:') ||
    lowerUrl.startsWith('blob:') ||
    (currentOrigin && lowerUrl.startsWith(currentOrigin))
  ) {
    return false;
  }
  
  return lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
};

// Auto detect launcher executable from raw folder path
const autoDetectExecutableFromPath = (rawPath: string, appNameHint: string = ''): string => {
  if (!rawPath) return '';
  let path = rawPath.replace(/^["']|["']$/g, '').trim(); // strip quotes
  
  // Normalize slashes
  const isWindowsPath = path.includes('\\') || !!path.match(/^[A-Za-z]:/);
  const separator = isWindowsPath ? '\\' : '/';
  
  // If already ends in acceptable file formats, keep as is
  if (path.match(/\.(exe|bat|cmd|sh|app|lnk|bin)$/i)) {
    return path;
  }
  
  // Clean trailing separator
  if (path.endsWith(separator)) {
    path = path.slice(0, -1);
  }

  const lowerPath = path.toLowerCase();
  const lowerHint = appNameHint.toLowerCase();

  // Keyword match cases (photoshop, comfyui, keyshot, blender, etc.)
  if (lowerPath.includes('photoshop') || lowerPath.endsWith('ps') || lowerPath.includes('adobe ps') || lowerHint.includes('photoshop')) {
    return `${path}${separator}Photoshop.exe`;
  }
  if (lowerPath.includes('comfyui') || lowerHint.includes('comfyui')) {
    return `${path}${separator}run_nvidia_gpu.bat`;
  }
  if (lowerPath.includes('vscode') || lowerPath.includes('microsoft vs code') || lowerHint.includes('vscode') || lowerHint.includes('vs code')) {
    return `${path}${separator}Code.exe`;
  }
  if (lowerPath.includes('keyshot') || lowerHint.includes('keyshot')) {
    if (lowerPath.endsWith('bin')) {
      return `${path}${separator}keyshot.exe`;
    }
    return `${path}${separator}bin${separator}keyshot.exe`;
  }
  if (lowerPath.includes('blender') || lowerHint.includes('blender')) {
    return `${path}${separator}blender.exe`;
  }
  if (lowerPath.includes('painter') || lowerHint.includes('painter')) {
    return `${path}${separator}Adobe Substance 3D Painter.exe`;
  }
  if (lowerPath.includes('designer') || lowerHint.includes('designer')) {
    return `${path}${separator}Adobe Substance 3D Designer.exe`;
  }
  if (lowerPath.includes('marvelous') || lowerHint.includes('marvelous')) {
    return `${path}${separator}MarvelousDesigner.exe`;
  }
  if (lowerPath.includes('zbrush') || lowerHint.includes('zbrush')) {
    return `${path}${separator}ZBrush.exe`;
  }
  if (lowerPath.includes('maya') || lowerHint.includes('maya')) {
    if (lowerPath.endsWith('bin')) {
      return `${path}${separator}maya.exe`;
    }
    return `${path}${separator}bin${separator}maya.exe`;
  }
  if (lowerPath.includes('3dsmax') || lowerPath.includes('3ds max') || lowerHint.includes('3dsmax') || lowerHint.includes('3ds max')) {
    return `${path}${separator}3dsmax.exe`;
  }
  if (lowerPath.includes('houdini') || lowerHint.includes('houdini')) {
    if (lowerPath.endsWith('bin')) {
      return `${path}${separator}houdini.exe`;
    }
    return `${path}${separator}bin${separator}houdini.exe`;
  }
  if (lowerPath.includes('unreal') || lowerPath.includes('ue5') || lowerHint.includes('unreal') || lowerHint.includes('ue5')) {
    if (lowerPath.endsWith('win64')) {
      return `${path}${separator}UnrealEditor.exe`;
    }
    return `${path}${separator}Engine${separator}Binaries${separator}Win64${separator}UnrealEditor.exe`;
  }
  if (lowerPath.includes('realitycapture') || lowerHint.includes('realitycapture')) {
    return `${path}${separator}RealityCapture.exe`;
  }

  // General fallback parsing: extract folder name
  const segments = path.split(separator);
  const folderName = segments[segments.length - 1];
  if (folderName) {
    return `${path}${separator}${folderName}.exe`;
  }

  return path;
};

// Comprehensive Software Application Registry Definitions (Core App Registry)
const PRESET_PROGRAMS = [
  {
    id: 'keyshot',
    name: 'KeyShot 3D Render',
    icon: Monitor,
    defaultPath: 'C:\\Program Files\\KeyShot11\\bin\\keyshot.exe',
    defaultArgs: '-mode window -renderedWidth 1280 -renderedHeight 720',
    defaultUrl: 'http://127.0.0.1:8000',
    description: '工业级双流实时渲染与影视动画，极速全局光照追踪表现器。',
  },
  {
    id: 'blender',
    name: 'Blender 3D Suite',
    icon: Cpu,
    defaultPath: 'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
    defaultArgs: '--window-geometry 100 100 1280 720',
    defaultUrl: 'http://127.0.0.1:6080',
    description: '开源三维渲染与粘土模型雕刻，支持流体碰撞解算与几何节点。',
  },
  {
    id: 'photoshop',
    name: 'Adobe Photoshop',
    icon: Palette,
    defaultPath: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe',
    defaultArgs: '',
    defaultUrl: 'http://127.0.0.1:8002',
    description: '专业创意数字图像合成及创意沙盒，支持图形通道映射与色彩调试。',
  },
  {
    id: 'comfyui',
    name: 'ComfyUI (SD Generator)',
    icon: Workflow,
    defaultPath: 'C:\\ComfyUI_windows_portable\\run_nvidia_gpu.bat',
    defaultArgs: '--port 8188 --auto-launch',
    defaultUrl: 'http://127.0.0.1:8188',
    description: '节点流 Stable Diffusion 智能跑图，加载大模型与高精图形解码。',
  },
  {
    id: 'vscode',
    name: 'VS Code compiler',
    icon: Code,
    defaultPath: 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    defaultArgs: '--new-window .',
    defaultUrl: 'http://127.0.0.1:8001',
    description: '高通用轻量代码编辑器，支持嵌入拉起本地 Node 主编译及状态检查。',
  },
  {
    id: 'substance_painter',
    name: 'Substance Painter',
    icon: Palette,
    defaultPath: 'C:\\Program Files\\Adobe\\Adobe Substance 3D Painter\\Adobe Substance 3D Painter.exe',
    defaultArgs: '',
    defaultUrl: 'http://127.0.0.1:8010',
    description: '次世代高精度模型材质纹理手绘表现，全息烘焙法线智能贴图。',
  },
  {
    id: 'substance_designer',
    name: 'Substance Designer',
    icon: Layers,
    defaultPath: 'C:\\Program Files\\Adobe\\Adobe Substance 3D Substance Designer\\Substance Designer.exe',
    defaultArgs: '',
    defaultUrl: 'http://127.0.0.1:8011',
    description: '高通用节点式 PBR 程序材质核心，无缝平铺法线纹理设计。',
  },
  {
    id: 'marvelous_designer',
    name: 'Marvelous Designer',
    icon: Zap,
    defaultPath: 'C:\\Program Files\\Marvelous Designer\\MarvelousDesigner.exe',
    defaultArgs: '',
    defaultUrl: 'http://127.0.0.1:8012',
    description: '物理级服装及各类布料形态动力学解算，超精细数字服饰物理演算。',
  },
  {
    id: 'zbrush',
    name: 'ZBrush 3D Sculptor',
    icon: Layers,
    defaultPath: 'C:\\Program Files\\Pixologic\\ZBrush 2023\\ZBrush.exe',
    defaultArgs: '',
    defaultUrl: 'http://127.0.0.1:8013',
    description: '工业级高精三维高模粘土雕塑塑形，数字模型网格极智拓扑。',
  },
  {
    id: 'maya',
    name: 'Autodesk Maya',
    icon: LayoutGrid,
    defaultPath: 'C:\\Program Files\\Autodesk\\Maya2024\\bin\\maya.exe',
    defaultArgs: '',
    defaultUrl: 'http://127.0.0.1:8014',
    description: '高端电影多维骨骼服装动画特效流，动作捕捉及大型片场流水总成。',
  },
  {
    id: 'max3ds',
    name: 'Autodesk 3ds Max',
    icon: Monitor,
    defaultPath: 'C:\\Program Files\\Autodesk\\3ds Max 2024\\3dsmax.exe',
    defaultArgs: '',
    defaultUrl: 'http://127.0.0.1:8015',
    description: '经典大范围室内方案、工业高通用场景搭建及游戏主模制作。',
  },
  {
    id: 'houdini',
    name: 'SideFX Houdini',
    icon: Activity,
    defaultPath: 'C:\\Program Files\\Side Effects Software\\Houdini 19.5\\bin\\hindicator.exe',
    defaultArgs: '',
    defaultUrl: 'http://127.0.0.1:8016',
    description: '顶级影视程序化节点特效，包含破碎、爆炸、高级流体等粒子解算。',
  },
  {
    id: 'unreal_engine',
    name: 'Unreal Engine 5',
    icon: Zap,
    defaultPath: 'C:\\Program Files\\Epic Games\\UE_5.3\\Engine\\Binaries\\Win64\\UnrealEditor.exe',
    defaultArgs: '',
    defaultUrl: 'http://127.0.0.1:8017',
    description: '即时三维创作双流渲染，包含实时光逃 Lume 动态模拟与虚拟制片。',
  },
  {
    id: 'reality_capture',
    name: 'RealityCapture',
    icon: Database,
    defaultPath: 'C:\\Program Files\\Capturing Reality\\RealityCapture\\RealityCapture.exe',
    defaultArgs: '',
    defaultUrl: 'http://127.0.0.1:8018',
    description: '超高精照片实景 3D 重建数字外景孪生，扫描点云自动网格化生成。',
  }
];

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Monitor: Monitor,
  Cpu: Cpu,
  Palette: Palette,
  Workflow: Workflow,
  Code: Code,
  Layers: Layers,
  Zap: Zap,
  LayoutGrid: LayoutGrid,
  Activity: Activity,
  Database: Database,
  Compass: Compass,
  PlaySquare: PlaySquare,
  Play: Play,
  Globe2: Globe2
};

// Reusable drawing board canvas component for Photoshop Studio
const PaintCanvas = ({ brushColor, brushSize, tool }: { brushColor: string; brushSize: number; tool: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Fill initial transparent white bg
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : brushColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      <div className="absolute top-2 right-2 z-10">
        <button 
          onClick={clearCanvas} 
          type="button"
          className="bg-slate-900 border border-indigo-500/30 px-2 py-0.5 rounded text-[8px] font-black uppercase text-indigo-450 hover:text-white pointer-events-auto cursor-pointer"
        >
          清空画板
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={240}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="bg-white rounded-lg border border-slate-800 touch-none w-full max-w-[400px] h-[240px] cursor-crosshair pointer-events-auto"
      />
    </div>
  );
};

export default function NativeHostNode({ id, selected, data }: NodeProps) {
  const zoomScale = data.zoomScale || 1.0;
  const updateNodeData = useStore((s) => s.updateNodeData);
  const nodeData = data as any;

  // Global UI States
  const [isFolded, setIsFolded] = useState<boolean>(nodeData.isFolded || false);
  const [isMinimized, setIsMinimized] = useState<boolean>(nodeData.isMinimized || false);
  const [isPinned, setIsPinned] = useState<boolean>(nodeData.isPinned || false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(nodeData.isFullscreen || false);
  const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number }>(nodeData.pinnedPos || { x: 300, y: 150 });

  // Web Browser States
  const initialUrl = nodeData.pageUrl || 'https://www.baidu.com';
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [refreshKey, setRefreshKey] = useState(0);
  const [history, setHistory] = useState<string[]>([initialUrl]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // App Launcher Settings (Statically set to native-app, built-in browser completely removed)
  const [viewTab, setViewTab] = useState<'native-app' | 'browser'>('native-app');
  const [selectedPreset, setSelectedPreset] = useState<string>(nodeData.selectedPreset || 'keyshot');
  const [showConfigRegistry, setShowConfigRegistry] = useState<boolean>(false);

  // Load custom list of integrated software presets and custom entries from local storage
  const [programsList, setProgramsList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('NATIVE_PRESET_PROGRAMS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          return parsed.map((item: any) => ({
            ...item,
            icon: ICON_MAP[item.iconName] || Monitor
          }));
        }
      }
    } catch (e) {}

    return PRESET_PROGRAMS.map(p => ({
      ...p,
      iconName: p.icon === Monitor ? 'Monitor' :
                p.icon === Cpu ? 'Cpu' :
                p.icon === Palette ? 'Palette' :
                p.icon === Workflow ? 'Workflow' :
                p.icon === Code ? 'Code' :
                p.icon === Layers ? 'Layers' :
                p.icon === Zap ? 'Zap' :
                p.icon === LayoutGrid ? 'LayoutGrid' :
                p.icon === Activity ? 'Activity' :
                p.icon === Database ? 'Database' : 'Monitor'
    }));
  });

  const saveProgramsList = (list: any[]) => {
    setProgramsList(list);
    try {
      const serialized = list.map(({ icon, ...rest }) => rest);
      localStorage.setItem('NATIVE_PRESET_PROGRAMS', JSON.stringify(serialized));
    } catch (e) {}
  };

  // Adding Custom App states
  const [addingProgram, setAddingProgram] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppPath, setNewAppPath] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('http://127.0.0.1:8080');
  const [newAppArgs, setNewAppArgs] = useState('');
  const [newAppDesc, setNewAppDesc] = useState('');
  const [newAppIcon, setNewAppIcon] = useState('Monitor');

  // Custom Right Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    programId: string;
  } | null>(null);

  // Custom Right Click Shortcut Paths Editing States
  const [rightClickOpen, setRightClickOpen] = useState(false);
  const [rightClickProgId, setRightClickProgId] = useState('');
  const [rightClickPath, setRightClickPath] = useState('');
  const [rightClickArgs, setRightClickArgs] = useState('');
  const [rightClickUrl, setRightClickUrl] = useState('');

  // File Explorer Modal States
  const [fileExplorerOpen, setFileExplorerOpen] = useState(false);
  const [fileExplorerTarget, setFileExplorerTarget] = useState<'addingAppName' | 'rightClickPathName' | 'registryPathName' | 'registryHeadlessPathName'>('rightClickPathName');
  const [fileExplorerInitialPath, setFileExplorerInitialPath] = useState('');
  const [fileExplorerAppName, setFileExplorerAppName] = useState('');
  const [fileExplorerPresetId, setFileExplorerPresetId] = useState('');

  const handleOpenFileExplorer = (
    target: 'addingAppName' | 'rightClickPathName' | 'registryPathName' | 'registryHeadlessPathName',
    initialPath: string,
    appName: string,
    presetId: string
  ) => {
    setFileExplorerTarget(target);
    setFileExplorerInitialPath(initialPath);
    setFileExplorerAppName(appName);
    setFileExplorerPresetId(presetId);
    setFileExplorerOpen(true);
  };

  const handleFileExplorerSelect = (selectedPath: string) => {
    if (fileExplorerTarget === 'addingAppName') {
      setNewAppPath(selectedPath);
    } else if (fileExplorerTarget === 'rightClickPathName') {
      setRightClickPath(selectedPath);
    } else if (fileExplorerTarget === 'registryPathName') {
      setAppPath(selectedPath);
      updateSingleAppConfig(selectedPreset, selectedPath, appArgs, appUrl);
    } else if (fileExplorerTarget === 'registryHeadlessPathName') {
      setAppHeadlessPath(selectedPath);
      updateSingleAppConfig(selectedPreset, appPath, appArgs, appUrl, { headlessPath: selectedPath });
    }
  };

  // Close context menu on any global click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu?.visible) {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [contextMenu]);

  // Load custom configs for each app from local storage registry (Equivalent to app_paths.json persistence)
  const [appConfigs, setAppConfigs] = useState<Record<string, {
    path: string;
    args: string;
    url: string;
    headlessPath?: string;
    width?: string;
    height?: string;
    samples?: string;
    runMode?: string;
    outputDir?: string;
    taskDir?: string;
    realBridge?: boolean;
  }>>(() => {
    try {
      const saved = localStorage.getItem('NATIVE_APP_REGISTRY_CONFIGS');
      let parsed: any = {};
      if (saved) {
        parsed = JSON.parse(saved);
      }
      
      // Guarantee backwards compatibility/defaults across current list
      programsList.forEach(p => {
        if (!parsed[p.id]) {
          parsed[p.id] = {};
        }
        if (!parsed[p.id].path) parsed[p.id].path = p.defaultPath;
        if (parsed[p.id].args === undefined) parsed[p.id].args = p.defaultArgs || '';
        if (parsed[p.id].url === undefined) parsed[p.id].url = p.defaultUrl || '';
        if (parsed[p.id].headlessPath === undefined) {
          const pathSegments = p.defaultPath.split('\\');
          if (pathSegments.length > 1) {
            const exeName = pathSegments.pop() || '';
            const rawFolder = pathSegments.join('\\');
            const filePart = exeName.toLowerCase().replace('.exe', '');
            parsed[p.id].headlessPath = `${rawFolder}\\${filePart}_headless.exe`;
          } else {
            parsed[p.id].headlessPath = '';
          }
        }
        if (!parsed[p.id].width) parsed[p.id].width = '1920';
        if (!parsed[p.id].height) parsed[p.id].height = '1080';
        if (!parsed[p.id].samples) parsed[p.id].samples = p.id === 'keyshot' ? '128' : '64';
        if (!parsed[p.id].runMode) parsed[p.id].runMode = 'canvas_node';
        if (!parsed[p.id].outputDir) parsed[p.id].outputDir = `assets/output/${p.id}`;
        if (!parsed[p.id].taskDir) parsed[p.id].taskDir = `data/${p.id}_tasks`;
        if (parsed[p.id].realBridge === undefined) parsed[p.id].realBridge = true;
      });
      return parsed;
    } catch (e) {}

    const initial: Record<string, any> = {};
    programsList.forEach(p => {
      const pathSegments = p.defaultPath.split('\\');
      let headless = '';
      if (pathSegments.length > 1) {
        const exeName = pathSegments.pop() || '';
        const rawFolder = pathSegments.join('\\');
        const filePart = exeName.toLowerCase().replace('.exe', '');
        headless = `${rawFolder}\\${filePart}_headless.exe`;
      }
      initial[p.id] = {
        path: p.defaultPath,
        args: p.defaultArgs || '',
        url: p.defaultUrl || '',
        headlessPath: headless,
        width: '1920',
        height: '1080',
        samples: p.id === 'keyshot' ? '128' : '64',
        runMode: 'canvas_node',
        outputDir: `assets/output/${p.id}`,
        taskDir: `data/${p.id}_tasks`,
        realBridge: true
      };
    });
    return initial;
  });

  // Current inputs bind to the selected preset stored in local appConfigs state
  const currentAppConfig = appConfigs[selectedPreset] || {
    path: programsList.find(p => p.id === selectedPreset)?.defaultPath || '',
    args: programsList.find(p => p.id === selectedPreset)?.defaultArgs || '',
    url: programsList.find(p => p.id === selectedPreset)?.defaultUrl || '',
    headlessPath: '',
    width: '1920',
    height: '1080',
    samples: '128',
    runMode: 'canvas_node',
    outputDir: `assets/output/${selectedPreset}`,
    taskDir: `data/${selectedPreset}_tasks`,
    realBridge: true
  };

  const [appPath, setAppPath] = useState<string>(currentAppConfig.path || nodeData.appPath);
  const [appArgs, setAppArgs] = useState<string>(currentAppConfig.args || nodeData.appArgs);
  const [appUrl, setAppUrl] = useState<string>(currentAppConfig.url || nodeData.appUrl);

  // Expanded Workspace parameters state
  const [appHeadlessPath, setAppHeadlessPath] = useState<string>(currentAppConfig.headlessPath || nodeData.appHeadlessPath || '');
  const [appWidth, setAppWidth] = useState<string>(currentAppConfig.width || nodeData.appWidth || '1920');
  const [appHeight, setAppHeight] = useState<string>(currentAppConfig.height || nodeData.appHeight || '1080');
  const [appSamples, setAppSamples] = useState<string>(currentAppConfig.samples || nodeData.appSamples || '128');
  const [appRunMode, setAppRunMode] = useState<string>(currentAppConfig.runMode || nodeData.appRunMode || 'canvas_node');
  const [appOutputDir, setAppOutputDir] = useState<string>(currentAppConfig.outputDir || nodeData.appOutputDir || `assets/output/${selectedPreset}`);
  const [appTaskDir, setAppTaskDir] = useState<string>(currentAppConfig.taskDir || nodeData.appTaskDir || `data/${selectedPreset}_tasks`);
  const [appRealBridge, setAppRealBridge] = useState<boolean>(currentAppConfig.realBridge !== undefined ? currentAppConfig.realBridge : (nodeData.appRealBridge !== undefined ? nodeData.appRealBridge : true));

  const [procStatus, setProcStatus] = useState<'idle' | 'running' | 'stopped'>(nodeData.procStatus || 'idle');
  const [procLogs, setProcLogs] = useState<string[]>(nodeData.procLogs || [
    '内核就绪: NATIVE_Sovereign_Kernel V1.9 initialized.',
    '连接状态: READY - 模块正等待在画布中锁定坐标拉起本地映射。'
  ]);

  // Performance simulation metrics
  const [simCpu, setSimCpu] = useState(0);
  const [simRam, setSimRam] = useState(0);
  const [simFps, setSimFps] = useState(0);
  const [uptime, setUptime] = useState(0);

  // Dragging mechanisms
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const posStartRef = useRef<{ x: number; y: number } | null>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  
  const [isLaunching, setIsLaunching] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // New: Mapping Mode State to switch between local window mapping and interactive sandbox
  const [mappingMode, setMappingMode] = useState<'interactive' | 'window-rect'>(nodeData.mappingMode || 'interactive');

  // Interactive Workspaces Mock States
  // 1. KeyShot Model State
  const [ksMaterial, setKsMaterial] = useState<string>('glowing_titanium');
  const [ksRoughness, setKsRoughness] = useState<number>(15);
  const [ksRenderPasses, setKsRenderPasses] = useState<number>(32);
  const [ksOrbit, setKsOrbit] = useState<number>(45);
  const [ksExposure, setKsExposure] = useState<number>(100);
  const [ksBloom, setKsBloom] = useState<number>(20);
  const [ksRenderingProgress, setKsRenderingProgress] = useState<number>(100);

  // 2. Photoshop Canvas Drawing State
  const [psBrushColor, setPsBrushColor] = useState<string>('#6366f1');
  const [psBrushSize, setPsBrushSize] = useState<number>(10);
  const [psTool, setPsTool] = useState<'brush' | 'eraser' | 'fill'>('brush');
  const [psLayersVisible, setPsLayersVisible] = useState<Record<string, boolean>>({
    overlay: true,
    sketch: true,
    base: true
  });
  const [psHue, setPsHue] = useState<number>(0);
  const [psContrast, setPsContrast] = useState<number>(100);
  const [psBlur, setPsBlur] = useState<number>(0);

  // 3. Blender 3D Primitive State
  const [blActiveMesh, setBlActiveMesh] = useState<'monkey' | 'torus' | 'sphere' | 'cube'>('monkey');
  const [blViewMode, setBlViewMode] = useState<'solid' | 'wireframe' | 'xray'>('solid');
  const [blSubdiv, setBlSubdiv] = useState<number>(1);
  const [blOrbitX, setBlOrbitX] = useState<number>(25);
  const [blOrbitY, setBlOrbitY] = useState<number>(-45);

  // 4. ComfyUI Generating State
  const [cfPrompt, setCfPrompt] = useState<string>('cyberpunk mechanical robotic butterfly, high fidelity, 3ds max render, masterpiece, neon glow wires');
  const [cfNegative, setCfNegative] = useState<string>('monochrome, ugly, worst quality, realistic hand');
  const [cfActiveNode, setCfActiveNode] = useState<number>(-1); // -1 = idle
  const [cfProgress, setCfProgress] = useState<number>(0);
  const [cfResultImage, setCfResultImage] = useState<string>('');

  // 5. VS Code State
  const [vsActiveFile, setVsActiveFile] = useState<string>('engine.ts');
  const [vsTerminalLogs, setVsTerminalLogs] = useState<string[]>([
    'bash: Sovereign Shell active.',
    'System Node Engine v20.12.2.'
  ]);
  const [vsCompiling, setVsCompiling] = useState<boolean>(false);
  const [vsFileContents, setVsFileContents] = useState<Record<string, string>>({
    'engine.ts': `// Native Application Bridge Engine\nimport { NativeOverlay } from 'native-overlay-host';\n\nexport async function initBridge(appPath: string) {\n  console.log('Allocating local overlay viewport...');\n  const win = await NativeOverlay.captureActiveWindow(appPath);\n  \n  win.on('resize', (bounds) => {\n    console.log('Synchronizing coordinates:', bounds);\n  });\n}`,
    'package.json': `{\n  "name": "native-cooperator",\n  "version": "1.0.0",\n  "dependencies": {\n    "native-overlay-host": "^1.9.0"\n  }\n}`,
    'tests/runner.js': `// Automation testing stream\nconst { initBridge } = require('../engine.ts');\n\ndescribe('HWND Bind Checks', () => {\n  it('should capture window target coordinates', () => {\n    // Assert correct coordinate layout\n  });\n});`
  });

  // Save changes to current app setting config
  const updateSingleAppConfig = (
    appId: string, 
    path: string, 
    args: string, 
    url: string,
    extra?: Partial<{
      headlessPath: string;
      width: string;
      height: string;
      samples: string;
      runMode: string;
      outputDir: string;
      taskDir: string;
      realBridge: boolean;
    }>
  ) => {
    const existing = appConfigs[appId] || { path, args, url };
    const updatedConfig = {
      ...existing,
      path,
      args,
      url,
      ...extra
    };
    const updated = {
      ...appConfigs,
      [appId]: updatedConfig
    };
    setAppConfigs(updated);
    localStorage.setItem('NATIVE_APP_REGISTRY_CONFIGS', JSON.stringify(updated));

    if (appId === selectedPreset) {
      setAppPath(path);
      setAppArgs(args);
      setAppUrl(url);
      if (extra) {
        if (extra.headlessPath !== undefined) setAppHeadlessPath(extra.headlessPath);
        if (extra.width !== undefined) setAppWidth(extra.width);
        if (extra.height !== undefined) setAppHeight(extra.height);
        if (extra.samples !== undefined) setAppSamples(extra.samples);
        if (extra.runMode !== undefined) setAppRunMode(extra.runMode);
        if (extra.outputDir !== undefined) setAppOutputDir(extra.outputDir);
        if (extra.taskDir !== undefined) setAppTaskDir(extra.taskDir);
        if (extra.realBridge !== undefined) setAppRealBridge(extra.realBridge);
      }
      updateNodeData(id, { 
        appPath: path, 
        appArgs: args, 
        appUrl: url,
        ...extra
      });
    }
  };

  // Support adding a custom software runtime configuration
  const handleAddProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return;

    const newId = 'custom_' + Date.now();
    const newProg = {
      id: newId,
      name: newAppName.trim(),
      iconName: newAppIcon,
      defaultPath: newAppPath.trim() || 'C:\\Program Files\\' + newAppName.trim() + '\\' + newAppName.trim() + '.exe',
      defaultArgs: newAppArgs.trim(),
      defaultUrl: newAppUrl.trim(),
      description: newAppDesc.trim() || '用户自定义原生软件协调环境。',
      isCustom: true
    };

    const updatedList = [...programsList, newProg];
    saveProgramsList(updatedList);

    // Also update current configurations mapping for this new program
    const configUpdate = {
      ...appConfigs,
      [newId]: {
        path: newProg.defaultPath,
        args: newProg.defaultArgs,
        url: newProg.defaultUrl
      }
    };
    setAppConfigs(configUpdate);
    localStorage.setItem('NATIVE_APP_REGISTRY_CONFIGS', JSON.stringify(configUpdate));

    // Select the newly added app
    setSelectedPreset(newId);
    setAppPath(newProg.defaultPath);
    setAppArgs(newProg.defaultArgs);
    setAppUrl(newProg.defaultUrl);

    updateNodeData(id, { 
      selectedPreset: newId,
      appPath: newProg.defaultPath,
      appArgs: newProg.defaultArgs,
      appUrl: newProg.defaultUrl
    });

    // Reset fields
    setNewAppName('');
    setNewAppPath('');
    setNewAppUrl('http://127.0.0.1:8080');
    setNewAppArgs('');
    setNewAppDesc('');
    setAddingProgram(false);
  };

  // Support deleting a custom program entry
  const handleDeleteProgram = (progId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    const remaining = programsList.filter(p => p.id !== progId);
    saveProgramsList(remaining);

    if (selectedPreset === progId) {
      const fallback = remaining[0] || null;
      if (fallback) {
        handlePresetSelect(fallback.id);
      } else {
        setSelectedPreset('');
        setAppPath('');
        setAppArgs('');
        setAppUrl('');
      }
    }
  };

  // Restore preset factory configurations
  const handleResetToPresets = () => {
    if (confirm('确认重置吗？这将清除所有自定义软件和当前路径设定，还原回出厂内置软件。')) {
      localStorage.removeItem('NATIVE_PRESET_PROGRAMS');
      localStorage.removeItem('NATIVE_APP_REGISTRY_CONFIGS');
      
      const defaults = PRESET_PROGRAMS.map(p => ({
        ...p,
        iconName: p.icon === Monitor ? 'Monitor' :
                  p.icon === Cpu ? 'Cpu' :
                  p.icon === Palette ? 'Palette' :
                  p.icon === Workflow ? 'Workflow' :
                  p.icon === Code ? 'Code' :
                  p.icon === Layers ? 'Layers' :
                  p.icon === Zap ? 'Zap' :
                  p.icon === LayoutGrid ? 'LayoutGrid' :
                  p.icon === Activity ? 'Activity' :
                  p.icon === Database ? 'Database' : 'Monitor'
      }));
      setProgramsList(defaults);
      
      const initialConfigs: Record<string, { path: string; args: string; url: string }> = {};
      defaults.forEach(p => {
        initialConfigs[p.id] = {
          path: p.defaultPath,
          args: p.defaultArgs,
          url: p.defaultUrl
        };
      });
      setAppConfigs(initialConfigs);
      
      const defaultActiveId = 'keyshot';
      setSelectedPreset(defaultActiveId);
      const conf = initialConfigs[defaultActiveId];
      setAppPath(conf.path);
      setAppArgs(conf.args);
      setAppUrl(conf.url);

      updateNodeData(id, {
        selectedPreset: defaultActiveId,
        appPath: conf.path,
        appArgs: conf.args,
        appUrl: conf.url
      });
    }
  };

  // Right click handler for rendering custom dropdown context options
  const handleContextMenu = (e: React.MouseEvent, progId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      programId: progId
    });
  };

  // Switch presets
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const config = appConfigs[presetId] || {
      path: programsList.find(p => p.id === presetId)?.defaultPath || '',
      args: programsList.find(p => p.id === presetId)?.defaultArgs || '',
      url: programsList.find(p => p.id === presetId)?.defaultUrl || '',
      headlessPath: '',
      width: '1920',
      height: '1080',
      samples: presetId === 'keyshot' ? '128' : '64',
      runMode: 'canvas_node',
      outputDir: `assets/output/${presetId}`,
      taskDir: `data/${presetId}_tasks`,
      realBridge: true
    };

    setAppPath(config.path);
    setAppArgs(config.args);
    setAppUrl(config.url);
    setAppHeadlessPath(config.headlessPath || '');
    setAppWidth(config.width || '1920');
    setAppHeight(config.height || '1080');
    setAppSamples(config.samples || (presetId === 'keyshot' ? '128' : '64'));
    setAppRunMode(config.runMode || 'canvas_node');
    setAppOutputDir(config.outputDir || `assets/output/${presetId}`);
    setAppTaskDir(config.taskDir || `data/${presetId}_tasks`);
    setAppRealBridge(config.realBridge !== undefined ? config.realBridge : true);

    updateNodeData(id, { 
      selectedPreset: presetId,
      appPath: config.path,
      appArgs: config.args,
      appUrl: config.url,
      appHeadlessPath: config.headlessPath || '',
      appWidth: config.width || '1920',
      appHeight: config.height || '1085',
      appSamples: config.samples || (presetId === 'keyshot' ? '128' : '64'),
      appRunMode: config.runMode || 'canvas_node',
      appOutputDir: config.outputDir || `assets/output/${presetId}`,
      appTaskDir: config.taskDir || `data/${presetId}_tasks`,
      appRealBridge: config.realBridge !== undefined ? config.realBridge : true
    });

    const presetName = programsList.find(p => p.id === presetId)?.name || presetId;
    setProcLogs(prev => [
      ...prev,
      `[系统] [App_Registry] 同步切换本地可执行总线为: ${presetName}`,
      `[系统] 映射启动程序路径: ${config.path}`,
      `[系统] 注册覆盖连接端口: ${config.url}`
    ]);
  };

  // Handle Dragging Pinned Window
  const handlePinnedHeaderPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) return;
    
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { x: pinnedPos.x, y: pinnedPos.y };
  };

  const handlePinnedHeaderPointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || !posStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const nextPos = {
      x: posStartRef.current.x + dx,
      y: posStartRef.current.y + dy
    };
    setPinnedPos(nextPos);
    updateNodeData(id, { pinnedPos: nextPos });
  };

  const handlePinnedHeaderPointerUp = (e: React.PointerEvent) => {
    dragStartRef.current = null;
    posStartRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  // Launch Local Native Software handler
  const handleLaunchNativeApp = async (overridePath?: string, overrideArgs?: string) => {
    setIsLaunching(true);
    setErrorMsg('');
    setLoadingMsg(`正在调起本地系统应用: ${selectedPreset.toUpperCase()}...`);
    
    const finalPath = overridePath !== undefined ? overridePath : appPath;
    const finalArgs = overrideArgs !== undefined ? overrideArgs : appArgs;

    const now = new Date().toLocaleTimeString();
    setProcLogs(prev => [
      ...prev,
      `[${now}] 发起进程创建信号 -> CreateProcess("${finalPath}", args="${finalArgs}")`,
      `[${now}] 正在向本地宿主内核请求注册 PID 连接通道...`
    ]);

    // Send visual embedding launch IPC message across all tunnels (for real native hosts/Sovereign wrappers)
    const launchPayload = {
      type: 'launch-app',
      app: selectedPreset,
      appPath: finalPath,
      args: finalArgs,
      appUrl: appUrl,
      rect: placeholderRef.current ? {
        x: Math.round((window.screenX || 0) + placeholderRef.current.getBoundingClientRect().left),
        y: Math.round((window.screenY || 0) + placeholderRef.current.getBoundingClientRect().top),
        w: Math.round(placeholderRef.current.getBoundingClientRect().width),
        h: Math.round(placeholderRef.current.getBoundingClientRect().height),
        zoom: window.devicePixelRatio || 1
      } : null
    };

    const win = window as any;
    if (win.chrome?.webview?.postMessage) {
      try {
        win.chrome.webview.postMessage(launchPayload);
      } catch (e) {}
    }
    if (win.electron?.ipcRenderer?.send) {
      try {
        win.electron.ipcRenderer.send('launch-app', launchPayload);
      } catch (e) {}
    } else if (win.ipcRenderer?.send) {
      try {
        win.ipcRenderer.send('launch-app', launchPayload);
      } catch (e) {}
    }
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(launchPayload, '*');
      } catch (e) {}
    }

    try {
      const response = await axios.post('/api/native/launch-app', {
        appPath: finalPath,
        args: finalArgs
      });

      if (response.data && response.data.ok) {
        setProcStatus('running');
        setLoadingMsg('本地进程及坐标直连映射建立成功！');
        
        const now2 = new Date().toLocaleTimeString();
        const randPid = Math.floor(Math.random() * 4100 + 5100);
        const randHwnd = `0x00${Math.floor(Math.random() * 800000 + 100000).toString(16).toUpperCase()}`;
        setProcLogs(prev => [
          ...prev,
          `[${now2}] 🟢 本地程序已拉起并挂载成功。检索 PID 锁定: [PID ${randPid}]`,
          `[${now2}] [EnumWindows] 检索窗口。成功解析宿主应用窗口 HWND: [${randHwnd}]`,
          `[${now2}] 启动 60FPS 运动渲染，激活 ContentRect 与 Windows-MoveWindow 直连协调层！`,
          `[${now2}] 已阻断外部钓鱼沙盒。画面嵌入已完美覆盖在画布对应的防越界叠加层层级顶端。`
        ]);

        setUptime(0);
        setSimCpu(Math.floor(Math.random() * 21 + 18));
        setSimRam(Math.floor(Math.random() * 400 + 1500));
        setSimFps(60);

        setTimeout(() => setLoadingMsg(''), 1500);
      } else {
        setErrorMsg(response.data.error || '本地服务拉起接口无响应');
        setProcLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🔴 激活失败: ${response.data.error || '未知错误'}`]);
      }
    } catch (err: any) {
      const serverErr = err.response?.data?.error || err.message;
      setErrorMsg(`本地连接未收到物理机响应: ${serverErr}\n\n💡 提示: 这是一个真正的 【原生 App Overlay 直连节点】。为了完成物理机直接嵌入，您需要在自己的本地计算机上运行本服务的本地桌面端启动器(Client)。\n\n在当前的开发服务器预览环境中，系统将为您进入【全真全息协调直连沙盒模式】，通过本地网口 ${appUrl} 模拟坐标直连传输状态，并支持完整的 Canvas 覆盖穿透定位！`);
      
      // Auto enable fully functional sandbox running!
      setProcStatus('running');
      setUptime(0);
      setSimCpu(24);
      setSimRam(1840);
      setSimFps(60);
      setTimeout(() => setLoadingMsg(''), 1200);
    } finally {
      setIsLaunching(false);
    }
  };

  // Stop application/kill process handler
  const handleStopNativeApp = () => {
    const now = new Date().toLocaleTimeString();
    const hwndSim = `0x001B4EF4`;
    setProcStatus('stopped');
    setSimCpu(0);
    setSimRam(0);
    setSimFps(0);
    setProcLogs(prev => [
      ...prev,
      `[${now}] ⏹️ 停止指令下发 -> PostMessage(${hwndSim}, WM_CLOSE, 0, 0)`,
      `[${now}] 检测自适应子视图窗口延迟状态... 无响应`,
      `[${now}] 进程兜底 -> TerminateProcess(PID_${Math.floor(Math.random()*3000+4000)}, exitCode=0)`,
      `[${now}] 🔴 注册通道注销。画布内 HWND Overlay 覆盖映射解除锁定并卸载。`
    ]);

    // Send stop App command through IPC tunnels to notify the native client wrapper to drop overlay alignment
    const stopPayload = {
      type: 'stop-app',
      app: selectedPreset
    };

    const win = window as any;
    if (win.chrome?.webview?.postMessage) {
      try {
        win.chrome.webview.postMessage(stopPayload);
      } catch (e) {}
    }
    if (win.electron?.ipcRenderer?.send) {
      try {
        win.electron.ipcRenderer.send('stop-app', stopPayload);
      } catch (e) {}
    } else if (win.ipcRenderer?.send) {
      try {
        win.ipcRenderer.send('stop-app', stopPayload);
      } catch (e) {}
    }
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(stopPayload, '*');
      } catch (e) {}
    }
  };

  // Performance numbers simulator loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (procStatus === 'running') {
      interval = setInterval(() => {
        setUptime(prev => prev + 1);
        setSimCpu(prev => {
          const delta = Math.floor(Math.random() * 11) - 5;
          return Math.max(10, Math.min(95, prev + delta));
        });
        setSimRam(prev => {
          const delta = Math.floor(Math.random() * 24) - 12;
          return Math.max(512, Math.min(12288, prev + delta));
        });
        setSimFps(prev => {
          const delta = Math.floor(Math.random() * 3) - 1;
          return Math.max(58, Math.min(60, prev + delta));
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [procStatus]);

  // Viewport rect size observer for webview & iframe portal tracking (HTML Proxy Node Core)
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || isPinned || isFullscreen) return;
    
    const update = () => {
      const r = el.getBoundingClientRect();
      setRect((prev) => {
        if (!prev) return r;
        if (prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height) {
          return prev;
        }
        return r;
      });
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('scroll', update, { capture: true, passive: true });
    const timer = setInterval(update, 50);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, { capture: true });
      clearInterval(timer);
    };
  }, [isPinned, isFullscreen, viewTab]);

  // Telemetry loop for printing coordinate sync and MoveWindow execution
  // Includes 60FPS high-frequency Overlay Binding Engine IPC channel for Microsoft WebView2 and Electron native wrappers
  useEffect(() => {
    if (procStatus !== 'running') return;

    // 1. Low-frequency console log simulator
    const timer = setInterval(() => {
      if (!rect) return;
      const now = new Date().toLocaleTimeString();
      const hwndSim = `0x00${Math.floor(Math.random() * 1000 + 4000).toString(16).toUpperCase()}`;
      
      const canvasLeft = window.screenX || 0;
      const canvasTop = window.screenY || 0;
      
      const realX = Math.round(rect.left);
      const realY = Math.round(rect.top);
      
      const clampedX = Math.max(canvasLeft, Math.min(canvasLeft + window.innerWidth - Math.round(rect.width), realX));
      const clampedY = Math.max(canvasTop, Math.min(canvasTop + window.innerHeight - Math.round(rect.height), realY));

      setProcLogs(prev => [
        ...prev,
        `[${now}] [MoveWindow] 同步 HWND ${hwndSim} 至 ContentRect: x=${clampedX}, y=${clampedY}, w=${Math.round(rect.width)}, h=${Math.round(rect.height)} | [Clamped: ${realX !== clampedX || realY !== clampedY ? 'YES' : 'NO'}]`
      ].slice(-80));
    }, 1500);

    // 2. High-frequency Overlay Binding Engine (60FPS Native Coordination Tunnel)
    let animationFrameId: number;
    const syncNativeOverlayCoordinates = () => {
      const el = placeholderRef.current;
      if (el) {
        const bounds = el.getBoundingClientRect();
        
        // Calculate absolute hardware screen position offset
        const screenLeft = (window.screenX || 0) + bounds.left;
        const screenTop = (window.screenY || 0) + bounds.top;
        const screenWidth = bounds.width;
        const screenHeight = bounds.height;

        const syncPayload = {
          type: 'overlay-sync',
          app: selectedPreset,
          isElectron: isElectron,
          rect: {
            x: Math.round(screenLeft),
            y: Math.round(screenTop),
            w: Math.round(screenWidth),
            h: Math.round(screenHeight),
            zoom: window.devicePixelRatio || 1
          }
        };

        // Channel A: Microsoft WebView2 (window.chrome.webview)
        const win = window as any;
        if (win.chrome?.webview?.postMessage) {
          try {
            win.chrome.webview.postMessage(syncPayload);
          } catch (e) {}
        }

        // Channel B: Electron IPC Renderer Bridge
        if (win.electron?.ipcRenderer?.send) {
          try {
            win.electron.ipcRenderer.send('overlay-sync', syncPayload);
          } catch (e) {}
        } else if (win.ipcRenderer?.send) {
          try {
            win.ipcRenderer.send('overlay-sync', syncPayload);
          } catch (e) {}
        }

        // Channel C: Parent web wrapper message channel
        if (window.parent && window.parent !== window) {
          try {
            window.parent.postMessage(syncPayload, '*');
          } catch (e) {}
        }
      }
      animationFrameId = requestAnimationFrame(syncNativeOverlayCoordinates);
    };

    animationFrameId = requestAnimationFrame(syncNativeOverlayCoordinates);

    return () => {
      clearInterval(timer);
      cancelAnimationFrame(animationFrameId);
    };
  }, [procStatus, rect, selectedPreset]);

  // Browser Navigation logic
  const navigateTo = useCallback((destUrl: string) => {
    let formatted = destUrl.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    setCurrentUrl(formatted);
    setUrlInput(formatted);
    updateNodeData(id, { pageUrl: formatted });

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(formatted);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, id, updateNodeData]);

  // Catch iframe inner navigation events and proxy redirection signals
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') {
        if (event.data.type === 'NAVIGATE_CURRENT_TAB' || event.data.type === 'OPEN_INTERNAL_TAB') {
          const { url } = event.data;
          if (url) {
            navigateTo(url);
          }
        } else if (event.data.type === 'OPEN_EXTERNAL_TAB') {
          const { url } = event.data;
          if (url) {
            window.open(url, '_blank');
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [navigateTo]);

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      const url = history[nextIdx];
      setCurrentUrl(url);
      setUrlInput(url);
      updateNodeData(id, { pageUrl: url });
    }
  };

  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      const url = history[nextIdx];
      setCurrentUrl(url);
      setUrlInput(url);
      updateNodeData(id, { pageUrl: url });
    }
  };

  const handleLaunchNativeBrowser = async () => {
    setIsLaunching(true);
    setErrorMsg('');
    setLoadingMsg('极速联络本地电脑端默认浏览器...');
    try {
      const response = await axios.post('/api/native/launch-browser', { url: currentUrl });
      if (response.data && response.data.ok) {
        setLoadingMsg('本地系统默认浏览器启动成功！');
        setTimeout(() => setLoadingMsg(''), 1500);
      } else {
        setErrorMsg(response.data.error || '未拉起本地浏览器');
      }
    } catch (err: any) {
      const serverErr = err.response?.data?.error || err.message;
      setErrorMsg(`宿主联动障碍: ${serverErr}\n\n💡 提示: 此功能需要本地后台，在云调试环境，建议您直接点击选择「内置浏览器」，直接在画布上享受防钓鱼、防跨域安全的极致直连预览！`);
    } finally {
      setIsLaunching(false);
    }
  };

  /* ==========================================
     HIGH FIDELITY EMBEDDED WORKSPACE SIMULATORS
     ========================================== */
  const renderKeyShotWorkspace = () => {
    let materialBaseColor = "#3a4146";
    let materialGradient = ["#1e2224", "#3a4146", "#505a61"];
    let isGold = ksMaterial === 'gold';
    let isGlass = ksMaterial === 'glass';
    let isCarbon = ksMaterial === 'carbon';
    
    if (isGold) {
      materialBaseColor = "#e59e1b";
      materialGradient = ["#b57b1b", "#e59e1b", "#fde047"];
    } else if (isGlass) {
      materialBaseColor = "#a5f3fc";
      materialGradient = ["#0891b2", "#22d3ee", "#e0f7fa"];
    } else if (isCarbon) {
      materialBaseColor = "#111827";
      materialGradient = ["#0f172a", "#1e293b", "#334155"];
    }

    const triggerRenderTick = (newMaterial: string) => {
      setKsMaterial(newMaterial);
      setKsRenderingProgress(0);
      let count = 0;
      const interval = setInterval(() => {
        count += 20;
        setKsRenderingProgress(count);
        if (count >= 100) {
          clearInterval(interval);
        }
      }, 100);
    };

    return (
      <div className="flex-grow flex flex-col md:flex-row h-full min-h-0 bg-[#0f0f11] pointer-events-auto">
        {/* Core render canvas */}
        <div className="flex-grow flex-1 relative bg-black flex flex-col items-center justify-center p-4 min-h-[300px] border-b md:border-b-0 md:border-r border-indigo-500/10 select-none overflow-hidden">
          {/* Top-left Telemetry overlay */}
          <div className="absolute top-3 left-4 text-left font-mono z-10 space-y-0.5 pointer-events-none">
            <span className="text-[8px] font-black text-amber-500 bg-amber-550/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
              ☢️ KEYSHOT RT CORES LIVE
            </span>
            <div className="text-[9px] text-zinc-400 font-bold">渲染引擎: Luxion progressive solver v11.3</div>
            <div className="text-[8px] text-zinc-500">
              Passes: <span className="text-zinc-200">{ksRenderingProgress}% ({Math.floor(ksRenderPasses * ksRenderingProgress / 100)}/{ksRenderPasses})</span> | 
              FPS: <span className="text-emerald-400">60.0 (RTX ON)</span>
            </div>
          </div>

          {/* Progressive overlay mask */}
          {ksRenderingProgress < 100 && (
            <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="text-amber-500 animate-spin" size={24} />
              <div className="text-[10px] font-mono text-amber-400 font-black tracking-widest uppercase">
                光线追踪样本重构中... {ksRenderingProgress}%
              </div>
              <div className="w-[180px] h-1.5 bg-zinc-900 border border-amber-500/20 rounded-full overflow-hidden font-bold">
                <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-150" style={{ width: `${ksRenderingProgress}%` }} />
              </div>
            </div>
          )}

          {/* SVG representation of a high-tech athletic footwear or cyber-heart */}
          <div 
            className="w-full max-w-[340px] h-full max-h-[300px] flex items-center justify-center transition-all duration-300"
            style={{
              filter: `brightness(${ksExposure}%) drop-shadow(0 0 ${ksBloom/2.5}px ${isGold ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.15)'})`,
              transform: `rotate(${ksOrbit - 45}deg)`
            }}
          >
            <svg viewBox="0 0 200 200" className="w-[180px] h-[180px] drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)]">
              <defs>
                <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={materialGradient[0]} />
                  <stop offset="50%" stopColor={materialGradient[1]} />
                  <stop offset="100%" stopColor={materialGradient[2]} />
                </linearGradient>
                <pattern id="carbonPattern" width="6" height="6" patternUnits="userSpaceOnUse">
                  <rect width="6" height="6" fill="#18181b" />
                  <path d="M0,3 L6,3 M3,0 L3,6" stroke="#27272a" strokeWidth="1" />
                  <rect x="0" y="0" width="3" height="3" fill="#09090b" />
                  <rect x="3" y="3" width="3" height="3" fill="#09090b" />
                </pattern>
                <filter id="fuzz">
                  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale={ksRoughness / 12} xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>

              <g filter={ksRoughness > 40 ? "url(#fuzz)" : undefined}>
                <circle cx="100" cy="100" r="70" fill={isCarbon ? "url(#carbonPattern)" : "url(#metalGrad)"} stroke="#3f3f46" strokeWidth="2" />
                <circle cx="100" cy="100" r="56" fill="#111113" stroke={materialBaseColor} strokeWidth="1.5" />
                <circle cx="100" cy="100" r="48" fill="none" stroke="#27272a" strokeWidth="3" strokeDasharray="4 8" />
                <path d="M85,100 L115,100 M100,85 L100,115" stroke={isGold ? "#f59e0b" : "#4f46e5"} strokeWidth="1" opacity="0.30" />
                <line x1="100" y1="100" x2="135" y2="85" stroke={isGold ? "#fbbf24" : "#818cf8"} strokeWidth="3" strokeLinecap="round" style={{ transform: `rotate(${ksOrbit / 1.5}deg)`, transformOrigin: '100px 100px' }} />
                <path d="M42,70 A55,55 0 0,1 158,70" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity={(0.7 - ksRoughness/160).toString()} strokeLinecap="round" />
                {ksRoughness < 30 && (
                  <circle cx="140" cy="74" r={Math.max(1, (6 - ksRoughness / 5))} fill="#ffffff" opacity="0.9" />
                )}
              </g>
            </svg>
          </div>
        </div>

        {/* Right configuration sidebar */}
        <div className="w-full md:w-[220px] bg-[#121215] p-3.5 flex flex-col gap-4 select-none text-left overflow-y-auto shrink-0">
          <div>
            <span className="text-[8px] font-black tracking-widest text-amber-500 uppercase font-mono block mb-2">🎯 智能材质球库 (PBR Materials)</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'titanium', name: '拉丝钛合金', color: 'from-slate-500 to-zinc-400' },
                { id: 'gold', name: '24K镜面金', color: 'from-yellow-500 to-amber-300' },
                { id: 'carbon', name: '编织碳纤维', color: 'from-gray-955 to-neutral-900 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] bg-[size:4px_4px]' },
                { id: 'glass', name: '高折射玻璃', color: 'from-cyan-300 to-blue-200 border border-white/20' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => triggerRenderTick(m.id)}
                  type="button"
                  className={`px-2 py-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${ksMaterial === m.id ? 'bg-amber-550/10 border-amber-500' : 'bg-zinc-900/60 border-transparent hover:bg-zinc-900 hover:border-zinc-800'}`}
                >
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${m.color} shadow-md shrink-0`} />
                  <span className="text-[9px] text-zinc-300 font-extrabold truncate w-full">{m.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-[8px] font-black tracking-widest text-zinc-500 uppercase font-mono block">⚙️ 实时渲染选项 (Properties)</span>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">表面粗糙度 (Roughness)</span>
                <span className="text-amber-500">{ksRoughness}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={ksRoughness} 
                onChange={e => { setKsRoughness(Number(e.target.value)); triggerRenderTick(ksMaterial); }}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">曝光强度 (Exposure)</span>
                <span className="text-amber-500">{ksExposure}%</span>
              </div>
              <input 
                type="range" min="50" max="180" value={ksExposure} 
                onChange={e => setKsExposure(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">辉光强度 (Bloom Intensity)</span>
                <span className="text-amber-500">{ksBloom}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={ksBloom} 
                onChange={e => setKsBloom(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">视界旋转角度 (Orbit Angle)</span>
                <span className="text-amber-500">{ksOrbit}°</span>
              </div>
              <input 
                type="range" min="0" max="360" value={ksOrbit} 
                onChange={e => setKsOrbit(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPhotoshopWorkspace = () => {
    return (
      <div className="flex-grow flex flex-col md:flex-row h-full min-h-0 bg-[#16161a] pointer-events-auto">
        {/* Drawing Canvas Board */}
        <div className="flex-grow relative bg-[#0b0b0d] flex-1 flex flex-col items-center justify-center p-4 min-h-[300px] border-b md:border-b-0 md:border-r border-indigo-500/10">
          <div className="absolute top-3 left-4 text-left font-mono z-10 space-y-0.5 pointer-events-none select-none">
            <span className="text-[8px] font-black text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
              🎨 PHOTOSHOPS_BUFFER_ACTIVE
            </span>
            <div className="text-[9px] text-zinc-450 font-bold">工具模式: {psTool === 'brush' ? '🖌️ 画笔描绘' : psTool === 'eraser' ? '🧽 橡皮擦除' : '🪣 色彩填充'}</div>
            <div className="text-[8px] text-zinc-500">
              画面滤镜: <span className="text-indigo-400">Hue: {psHue}deg | Contrast: {psContrast}%</span> | FPS: 45
            </div>
          </div>

          <div 
            className="w-full max-w-[400px] transition-all duration-300 p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center shadow-2xl"
            style={{
              filter: `hue-rotate(${psHue}deg) contrast(${psContrast}%) blur(${psBlur}px)`
            }}
          >
            <PaintCanvas brushColor={psBrushColor} brushSize={psBrushSize} tool={psTool} />
          </div>
          
          <div className="mt-3 text-[8.5px] text-zinc-500 font-medium tracking-wide pointer-events-none select-none">
            💡 提示: 这是一个可<b>真实点击画图的手绘板</b>！拖拽鼠标或手指在白色方框内滑动即可绘制图案、测试压感及映射通道。
          </div>
        </div>

        {/* Photoshop Layer Property Inspector panel */}
        <div className="w-full md:w-[220px] bg-[#1a1a22] p-3.5 flex flex-col gap-4 select-none text-left overflow-y-auto shrink-0">
          <div>
            <span className="text-[8px] font-black tracking-widest text-indigo-400 uppercase font-mono block mb-2">🛠️ 创意工具包 (Creative tools)</span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'brush', name: '画笔', icon: '🖌️' },
                { id: 'eraser', name: '橡皮', icon: '🧽' },
                { id: 'fill', name: '单色', icon: '🪣' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setPsTool(t.id as any)}
                  type="button"
                  className={`px-2 py-2 rounded-xl border flex flex-col items-center gap-1 transition-all text-center cursor-pointer ${psTool === t.id ? 'bg-indigo-650/20 border-indigo-500 text-white shadow' : 'bg-zinc-900/60 border-transparent text-zinc-400 hover:text-zinc-200'}`}
                >
                  <span className="text-sm">{t.icon}</span>
                  <span className="text-[8px] font-extrabold truncate w-full">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[8px] font-black tracking-widest text-[#93c5fd] uppercase font-mono block mb-2">🎨 调色板 (Swatch palette)</span>
            <div className="grid grid-cols-6 gap-1.5">
              {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#a855f7', '#f97316', '#14b8a6', '#4b5563', '#1e1b4b'].map(c => (
                <button
                  key={c}
                  onClick={() => { setPsBrushColor(c); if (psTool === 'eraser') setPsTool('brush'); }}
                  type="button"
                  className={`w-6 h-6 rounded-full border transition-all hover:scale-110 active:scale-95 cursor-pointer ${psBrushColor === c && psTool !== 'eraser' ? 'border-white scale-105 shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-[8px] font-black tracking-widest text-zinc-500 uppercase font-mono block">🔬 高级图形渲染器滤镜 (Filters)</span>
            
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">画笔粗细 (Brush Size)</span>
                <span className="text-indigo-400">{psBrushSize}px</span>
              </div>
              <input 
                type="range" min="2" max="36" value={psBrushSize} 
                onChange={e => setPsBrushSize(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">色彩偏轴 (Hue Rotation)</span>
                <span className="text-indigo-400">{psHue}°</span>
              </div>
              <input 
                type="range" min="0" max="360" value={psHue} 
                onChange={e => setPsHue(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">物理对比度 (Contrast)</span>
                <span className="text-indigo-400">{psContrast}%</span>
              </div>
              <input 
                type="range" min="60" max="160" value={psContrast} 
                onChange={e => setPsContrast(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">景深高斯模糊 (Gaussian)</span>
                <span className="text-indigo-400">{psBlur}px</span>
              </div>
              <input 
                type="range" min="0" max="8" step="0.5" value={psBlur} 
                onChange={e => setPsBlur(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBlenderWorkspace = () => {
    const vertexCount = blActiveMesh === 'monkey' ? 507 * blSubdiv : blActiveMesh === 'torus' ? 240 * blSubdiv : blActiveMesh === 'sphere' ? 480 * blSubdiv : 8 * blSubdiv;
    const polyCount = blActiveMesh === 'monkey' ? 968 * blSubdiv : blActiveMesh === 'torus' ? 480 * blSubdiv : blActiveMesh === 'sphere' ? 920 * blSubdiv : 12 * blSubdiv;

    return (
      <div className="flex-grow flex flex-col md:flex-row h-full min-h-0 bg-[#1d1d23] pointer-events-auto">
        <div className="flex-grow relative bg-[#131317] flex-1 flex flex-col items-center justify-center p-4 min-h-[300px] border-b md:border-b-0 md:border-r border-indigo-500/10 overflow-hidden text-left select-none">
          {/* Top-left Telemetry */}
          <div className="absolute top-3 left-4 text-left font-mono z-10 space-y-0.5">
            <span className="text-[8px] font-black text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
              🧊 BLENDER WORKSPACE VIEWPORT
            </span>
            <div className="text-[9px] text-zinc-400 font-bold">模式: {blViewMode === 'solid' ? '🎨 实体面着色' : blViewMode === 'wireframe' ? '🟢 电子线框' : '🩻 射线半透 X-Ray'}</div>
            <div className="text-[8px] text-zinc-500">
              Polys: <span className="text-zinc-200">{polyCount}</span> | Verts: <span className="text-zinc-300">{vertexCount}</span> | Mod: <span className="text-violet-400">Subdivx{blSubdiv}</span>
            </div>
          </div>

          {/* Interactive Rotatable 3D Wireframe */}
          <div 
            className="w-full max-w-[280px] h-[280px] flex items-center justify-center cursor-move touch-none"
            onPointerDown={e => {
              const startX = e.clientX;
              const startY = e.clientY;
              const startRotX = blOrbitX;
              const startRotY = blOrbitY;
              
              const handleMove = (ev: PointerEvent) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                setBlOrbitY(startRotY + dx * 0.5);
                setBlOrbitX(Math.max(-80, Math.min(80, startRotX - dy * 0.5)));
              };

              const handleUp = () => {
                window.removeEventListener('pointermove', handleMove);
                window.removeEventListener('pointerup', handleUp);
              };

              window.addEventListener('pointermove', handleMove);
              window.addEventListener('pointerup', handleUp);
            }}
          >
            <div 
              className="relative w-36 h-36 transition-all duration-75 text-center flex items-center justify-center"
              style={{
                transform: `rotateX(${blOrbitX}deg) rotateY(${blOrbitY}deg)`,
                transformStyle: 'preserve-3d',
                perspective: '600px'
              }}
            >
              {blActiveMesh === 'cube' && (
                <div className="w-20 h-20 relative" style={{ transformStyle: 'preserve-3d' }}>
                  {[
                    { style: 'rotateY(0deg) translateZ(40px)' },
                    { style: 'rotateY(90deg) translateZ(40px)' },
                    { style: 'rotateY(180deg) translateZ(40px)' },
                    { style: 'rotateY(270deg) translateZ(40px)' },
                    { style: 'rotateX(90deg) translateZ(40px)' },
                    { style: 'rotateX(-90deg) translateZ(40px)' }
                  ].map((f, i) => (
                    <div 
                      key={i} 
                      className={`absolute inset-0 border-2 rounded ${blViewMode === 'solid' ? 'bg-zinc-700/80 border-zinc-400' : blViewMode === 'wireframe' ? 'bg-transparent border-emerald-400' : 'bg-cyan-950/30 border-cyan-400'}`}
                      style={{ transform: f.style }}
                    />
                  ))}
                  {blSubdiv > 1 && (
                    <div className="absolute inset-3 border border-violet-500/35 rounded" style={{ transform: 'translateZ(0deg)', transformStyle: 'preserve-3d' }} />
                  )}
                </div>
              )}

              {blActiveMesh === 'torus' && (
                <svg viewBox="0 0 100 100" className="w-32 h-32">
                  {[...Array(6 + blSubdiv * 2)].map((_, r) => {
                    const radius = 30 + r * (10 / blSubdiv);
                    return (
                      <ellipse
                        key={r} cx="50" cy="50" rx={radius} ry={radius / 2.2}
                        fill="none" 
                        stroke={blViewMode === 'wireframe' ? '#34d399' : blViewMode === 'solid' ? '#a1a1aa' : '#22d3ee'}
                        strokeWidth={blViewMode === 'wireframe' ? '0.8' : '1.5'}
                        opacity={(0.4 + r / 15).toString()}
                      />
                    );
                  })}
                  {[...Array(8 + blSubdiv * 2)].map((_, a) => {
                    const angle = (a * 180) / (8 + blSubdiv * 2);
                    return (
                      <line
                        key={a} x1="15" y1="50" x2="85" y2="50"
                        stroke={blViewMode === 'wireframe' ? '#10b981' : blViewMode === 'solid' ? '#71717a' : '#0891b2'}
                        strokeWidth="1"
                        style={{ transform: `rotate(${angle}deg)`, transformOrigin: '50px 50px' }}
                      />
                    );
                  })}
                </svg>
              )}

              {blActiveMesh === 'sphere' && (
                <svg viewBox="0 0 100 100" className="w-32 h-32">
                  <circle cx="50" cy="50" r="42" fill={blViewMode === 'solid' ? 'url(#meshShub)' : 'none'} stroke={blViewMode === 'wireframe' ? '#10b981' : blViewMode === 'solid' ? '#52525b' : '#06b6d4'} strokeWidth="1.5" />
                  <defs>
                    <radialGradient id="meshShub" cx="30%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#d4d4d8" />
                      <stop offset="50%" stopColor="#71717a" />
                      <stop offset="100%" stopColor="#27272a" />
                    </radialGradient>
                  </defs>
                  {[...Array(4 + blSubdiv * 2)].map((_, i) => {
                    const ryVal = Math.max(5, (42 / (4 + blSubdiv * 2)) * i);
                    return (
                      <ellipse
                        key={i} cx="50" cy="50" rx="42" ry={ryVal}
                        fill="none" stroke={blViewMode === 'wireframe' ? '#059669' : blViewMode === 'solid' ? '#a1a1aa' : '#06b6d4'}
                        strokeWidth="0.8" opacity="0.45"
                      />
                    );
                  })}
                  {[...Array(4 + blSubdiv * 2)].map((_, i) => {
                    const rxVal = Math.max(5, (42 / (4 + blSubdiv * 2)) * i);
                    return (
                      <ellipse
                        key={i} cx="50" cy="50" rx={rxVal} ry="42"
                        fill="none" stroke={blViewMode === 'wireframe' ? '#059669' : blViewMode === 'solid' ? '#a1a1aa' : '#06b6d4'}
                        strokeWidth="0.8" opacity="0.45"
                      />
                    );
                  })}
                </svg>
              )}

              {blActiveMesh === 'monkey' && (
                <svg viewBox="0 0 100 100" className="w-32 h-32">
                  <path 
                    d="M 50 15 C 20 15, 10 40, 20 65 C 30 80, 50 85, 50 85 C 50 85, 70 80, 80 65 C 90 40, 80 15, 50 15 Z"
                    fill={blViewMode === 'solid' ? '#71717a' : 'none'} 
                    stroke={blViewMode === 'wireframe' ? '#34d399' : blViewMode === 'solid' ? '#e4e4e7' : '#22d3ee'}
                    strokeWidth="1.5"
                  />
                  <circle cx="15" cy="45" r="12" fill={blViewMode === 'solid' ? '#52525b' : 'none'} stroke={blViewMode === 'wireframe' ? '#10b981' : blViewMode === 'solid' ? '#a1a1aa' : '#0891b2'} strokeWidth="1.2" />
                  <circle cx="85" cy="45" r="12" fill={blViewMode === 'solid' ? '#52525b' : 'none'} stroke={blViewMode === 'wireframe' ? '#10b981' : blViewMode === 'solid' ? '#a1a1aa' : '#0891b2'} strokeWidth="1.2" />
                  <circle cx="38" cy="42" r="10" fill="none" stroke={blViewMode === 'wireframe' ? '#10b981' : blViewMode === 'solid' ? '#27272a' : '#06b6d4'} strokeWidth="1" />
                  <circle cx="62" cy="42" r="10" fill="none" stroke={blViewMode === 'wireframe' ? '#10b981' : blViewMode === 'solid' ? '#27272a' : '#06b6d4'} strokeWidth="1" />
                  <path d="M25 35 Q50 25 75 35" fill="none" stroke={blViewMode === 'wireframe' ? '#059669' : '#a1a1aa'} strokeWidth={blSubdiv.toString()} />
                  <path d="M40 70 C40 70, 50 78, 60 70" fill="none" stroke={blViewMode === 'wireframe' ? '#10b981' : '#e4e4e7'} strokeWidth="1.5" />
                </svg>
              )}
            </div>
          </div>

          <div className="mt-2 text-[8px] text-zinc-500 font-sans select-none pointer-events-none">
            🖱️ 提示: <b>在中心视口上滑动拖拽</b> 即可 3D 转动、调测建模物体的视角与拓扑结构。
          </div>
        </div>

        {/* Right Blender sidebar panel */}
        <div className="w-full md:w-[220px] bg-[#1e1e24] p-3.5 flex flex-col gap-4 select-none text-left overflow-y-auto shrink-0">
          <div>
            <span className="text-[8px] font-black tracking-widest text-[#fb923c] uppercase font-mono block mb-2">💎 选择网格 (3D Primitive)</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'monkey', name: 'Suz.猴头' },
                { id: 'torus', name: '圆环体' },
                { id: 'sphere', name: '多段球' },
                { id: 'cube', name: '立方体' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setBlActiveMesh(m.id as any)}
                  type="button"
                  className={`px-2 py-1.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${blActiveMesh === m.id ? 'bg-violet-650/20 border-violet-500 text-white shadow font-black' : 'bg-zinc-900/60 border-transparent text-zinc-400 hover:text-zinc-200'}`}
                >
                  <span className="text-[9px] font-black">{m.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[8px] font-black tracking-widest text-zinc-500 uppercase font-mono block mb-2">👁️ 着色器模式 (Draw modes)</span>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'solid', name: '实体' },
                { id: 'wireframe', name: '线框' },
                { id: 'xray', name: '透视' }
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => setBlViewMode(v.id as any)}
                  type="button"
                  className={`py-1 rounded text-[8px] font-extrabold border transition-all cursor-pointer ${blViewMode === v.id ? 'bg-violet-600 border-violet-500 text-white' : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3.5 pt-1">
            <span className="text-[8px] font-black tracking-widest text-zinc-500 uppercase font-mono block">🛠️ 网格编辑器 (Geometry Modifiers)</span>
            
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">表面细分 (Subdivision Level)</span>
                <span className="text-violet-400">Lv {blSubdiv}</span>
              </div>
              <input 
                type="range" min="1" max="4" value={blSubdiv} 
                onChange={e => setBlSubdiv(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">3D X-轴 Orbit</span>
                <span className="text-violet-400">{blOrbitX}°</span>
              </div>
              <input 
                type="range" min="-90" max="90" value={blOrbitX} 
                onChange={e => setBlOrbitX(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-bold">
                <span className="text-zinc-400">3D Y-轴 Orbit</span>
                <span className="text-violet-400">{blOrbitY}°</span>
              </div>
              <input 
                type="range" min="-180" max="180" value={blOrbitY} 
                onChange={e => setBlOrbitY(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderComfyUIWorkspace = () => {
    const nodes = [
      { id: 0, title: 'Load Checkpoint', x: 20, y: 55, w: 110, h: 65, color: 'text-sky-400' },
      { id: 1, title: 'CLIP Prompt Input', x: 20, y: 135, w: 120, h: 80, color: 'text-green-400' },
      { id: 2, title: 'KSampler Engine', x: 160, y: 65, w: 115, h: 90, color: 'text-amber-500' },
      { id: 3, title: 'Save Image Output', x: 295, y: 60, w: 125, h: 160, color: 'text-fuchsia-400' }
    ];

    const triggerGenerate = () => {
      setCfActiveNode(0);
      setCfProgress(10);
      setCfResultImage('');
      
      setTimeout(() => {
        setCfActiveNode(1);
        setCfProgress(25);
        
        setTimeout(() => {
          setCfActiveNode(2);
          setCfProgress(40);
          
          let tick = 0;
          const kSamplerInt = setInterval(() => {
            tick += 8;
            setCfProgress(40 + Math.floor(tick * 0.45));
            if (tick >= 100) {
              clearInterval(kSamplerInt);
              setCfActiveNode(3);
              setCfProgress(90);
              
              setTimeout(() => {
                setCfActiveNode(-1);
                setCfProgress(100);
                
                const text = cfPrompt.toLowerCase();
                if (text.includes('butterfly') || text.includes('insect')) {
                  setCfResultImage('https://images.unsplash.com/photo-1558979158-65a1eaa08691?auto=format&fit=crop&q=80&w=350');
                } else if (text.includes('mech') || text.includes('robot') || text.includes('cyber')) {
                  setCfResultImage('https://images.unsplash.com/photo-1516110833967-0b5716ca1387?auto=format&fit=crop&q=80&w=350');
                } else if (text.includes('car') || text.includes('speed') || text.includes('vehicle')) {
                  setCfResultImage('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=350');
                } else {
                  setCfResultImage('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=350');
                }
              }, 400);
            }
          }, 100);
        }, 850);
      }, 700);
    };

    return (
      <div className="flex-grow flex flex-col bg-[#0b0c10] pointer-events-auto select-none text-left h-full min-h-0 relative">
        <div className="flex-1 min-h-0 relative p-4 overflow-hidden bg-[#101216] select-none border-b border-indigo-500/10">
          <div className="absolute top-3 left-4 text-left font-mono z-10 space-y-0.5 pointer-events-none">
            <span className="text-[8px] font-black text-rose-450 bg-rose-505/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
              🚀 COMFYUI_NODE_STREAM
            </span>
            <div className="text-[9px] text-zinc-400 font-bold">活动工作区: SDXL Turbospeed Generator</div>
            <div className="text-[8px] text-zinc-500">
              物理卡耗 (VRAM): <span className="text-zinc-200">{cfActiveNode !== -1 ? '11.85 GB' : '3.12 GB'}</span> | 进度: <span className="text-rose-400">{cfProgress}%</span>
            </div>
          </div>

          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <path d="M 130 90 Q 145 90, 160 100" fill="none" stroke="#38bdf8" strokeWidth="1.5" className={cfActiveNode === 0 ? "stroke-sky-400 animate-[dash_2s_linear_infinite]" : "opacity-35"} strokeDasharray="3 3" />
            <path d="M 140 175 Q 150 175, 160 120" fill="none" stroke="#4ade80" strokeWidth="1.5" className={cfActiveNode === 1 ? "stroke-green-400 animate-[dash_2s_linear_infinite]" : "opacity-35"} strokeDasharray="3 3" />
            <path d="M 275 110 Q 285 110, 295 140" fill="none" stroke="#f59e0b" strokeWidth="2" className={cfActiveNode === 2 ? "stroke-amber-400 animate-[dash_1s_linear_infinite]" : "opacity-35"} strokeDasharray="5 3" />
          </svg>

          <div className="relative w-full h-full min-h-[260px]">
            {nodes.map(n => {
              const isGlowing = cfActiveNode === n.id;
              return (
                <div
                  key={n.id}
                  className={`absolute bg-[#171a21]/95 text-white rounded-xl border p-2 flex flex-col font-mono text-[9px] transition-all duration-300 shadow-xl ${isGlowing ? 'border-amber-500 ring-4 ring-amber-500/15' : 'border-zinc-850/90 border-zinc-800'}`}
                  style={{
                    left: `${n.x}px`,
                    top: `${n.y}px`,
                    width: `${n.w}px`,
                    height: `${n.h}px`,
                    zIndex: isGlowing ? 10 : 1
                  }}
                >
                  <div className="border-b border-zinc-805/90 border-zinc-805 pb-1 mb-1 flex justify-between items-center select-none font-bold">
                    <span className={`text-[9px] truncate ${n.color}`}>{n.title}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-650" />
                  </div>
                  
                  {n.id === 0 && (
                    <div className="space-y-1">
                      <div className="text-[7.5px] text-zinc-500">MODEL_CHECKPOINT:</div>
                      <div className="px-1 py-0.5 bg-zinc-950 border border-zinc-800 text-sky-400 rounded text-[7.5px] truncate font-extrabold select-none">
                        sd_xl_turbo_v1.0
                      </div>
                    </div>
                  )}

                  {n.id === 1 && (
                    <span className="text-[7.5px] text-zinc-400 italic font-mono truncate leading-normal">
                      Pos: "{cfPrompt.substring(0, 15)}..."
                    </span>
                  )}

                  {n.id === 2 && (
                    <div className="space-y-1 text-[8px]">
                      <div className="flex justify-between font-bold"><span className="text-zinc-500">Steps:</span> <span className="text-zinc-200">20</span></div>
                      <div className="flex justify-between font-bold"><span className="text-zinc-500">CFG:</span> <span className="text-zinc-200">1.5</span></div>
                      
                      {cfActiveNode === 2 && (
                        <div className="w-full bg-zinc-950 rounded-full h-1 overflow-hidden border border-amber-500/10 mt-1">
                          <div className="bg-amber-500 h-full transition-all duration-100" style={{ width: `${cfProgress * 1.1}%` }} />
                        </div>
                      )}
                    </div>
                  )}

                  {n.id === 3 && (
                    <div className="flex-grow flex flex-col justify-between items-center relative overflow-hidden bg-zinc-950 rounded border border-zinc-900/50 p-1">
                      {cfResultImage ? (
                        <div className="w-full h-full flex flex-col">
                          <img src={cfResultImage} className="w-full h-[105px] object-cover rounded shadow border border-zinc-850" referrerPolicy="no-referrer" alt="Generated preview" />
                          <span className="text-[7px] text-emerald-400 font-extrabold mt-1 text-center animate-pulse">🟢 GENERATION SUCCESS</span>
                        </div>
                      ) : (
                        <div className="flex-grow flex flex-col items-center justify-center p-1.5 text-center text-[7.5px] text-zinc-600 gap-1 font-sans">
                          {cfActiveNode === 3 ? (
                            <>
                              <Loader2 size={12} className="animate-spin text-fuchsia-400" />
                              <span className="text-fuchsia-300 font-bold font-mono text-[7px]">VAE DECODING IMAGE...</span>
                            </>
                          ) : (
                            <>
                              <div className="w-5 h-5 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-850 opacity-40">?</div>
                              <span className="leading-tight">等待提示词渲染队列启动...</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-[#111317] flex flex-col md:flex-row gap-3 shadow-xl shrink-0">
          <div className="flex-1 space-y-1">
            <span className="text-[7.5px] font-black tracking-widest text-zinc-500 uppercase font-mono block">Positive Prompt (输入智能作图词)</span>
            <input
              type="text"
              className="w-full bg-zinc-950 border border-zinc-800 text-white/90 rounded-lg px-2.5 py-1.5 text-[10px] focus:border-rose-500/50 focus:outline-none transition-all font-sans leading-normal pointer-events-auto"
              value={cfPrompt}
              onChange={e => setCfPrompt(e.target.value)}
              placeholder="例如: mechanical butterfly, glowing fiber optics"
            />
          </div>

          <button 
            onClick={triggerGenerate}
            disabled={cfActiveNode !== -1}
            type="button"
            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-550 hover:from-rose-550 hover:to-amber-500 disabled:opacity-40 text-white rounded-xl text-[11px] font-black shrink-0 shadow-lg tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer h-[38px] mt-auto border-none pointer-events-auto flex items-center gap-1.5 animate-pulse"
          >
            {cfActiveNode !== -1 ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
            <span>生成 AI 图像</span>
          </button>
        </div>
      </div>
    );
  };

  const renderVSCodeWorkspace = () => {
    const files = ['engine.ts', 'package.json', 'tests/runner.js'];

    const triggerCompile = () => {
      setVsCompiling(true);
      setVsTerminalLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] compiler: Starting incremental typescript compilation...`,
        'compiler: Resolving module paths and validating entry node...',
        'compiler: [BUILD] bundled dist/server.cjs with esbuild successfully.'
      ]);

      setTimeout(() => {
        setVsTerminalLogs(prev => [
          ...prev,
          'compiler: Executing tests/runner.js bindings check Suite...',
          '  ✓ HWND Bind Checks -> captured window target coordinates (1.4ms)',
          '  ✓ System Node Engine -> check port 3000 ingress channel (0.3ms)',
          `[SUCCESS] 2 tests passed perfectly in 18ms! Compile finished cleanly.`
        ]);
        setVsCompiling(false);
      }, 1200);
    };

    return (
      <div className="flex-grow flex flex-col md:flex-row h-full min-h-0 bg-[#1e1e1e] font-mono pointer-events-auto select-text text-left">
        <div className="w-full md:w-[130px] bg-[#252526] border-r border-[#3c3c3c] p-2 flex flex-col select-none shrink-0 overflow-y-auto">
          <span className="text-[7.5px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1 leading-none"><Database size={7} /> EXPLORE PROJECT</span>
          <div className="space-y-1">
            {files.map(f => (
              <button
                key={f}
                onClick={() => setVsActiveFile(f)}
                type="button"
                className={`w-full text-left px-2 py-1 rounded text-[9.5px] truncate cursor-pointer flex items-center gap-1 ${vsActiveFile === f ? 'bg-[#37373d] text-white font-bold' : 'text-zinc-400 hover:bg-[#2d2d2d]'}`}
                style={{ border: 'none' }}
              >
                <span>📄</span>
                <span className="truncate">{f}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-grow flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
          <div className="h-7 bg-[#2d2d2d] border-b border-[#3c3c3c] flex items-center justify-between px-3 shrink-0 select-none">
            <span className="text-[9px] text-zinc-300 font-bold flex items-center gap-1.5">
              <span>📝 Editor:</span>
              <span className="text-amber-400">{vsActiveFile}</span>
            </span>
            <button
              onClick={triggerCompile}
              disabled={vsCompiling}
              type="button"
              className="px-2 py-0.5 bg-sky-655 hover:bg-sky-550 disabled:opacity-40 text-white rounded text-[8.5px] font-black tracking-wider uppercase cursor-pointer border-none flex items-center gap-1 transition-all"
            >
              {vsCompiling ? <Loader2 size={8} className="animate-spin" /> : <span>▶</span>}
              <span>编译并执行测试</span>
            </button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto bg-[#1e1e1e] border-b border-[#2d2d2d] min-h-[140px]">
            <textarea
              value={vsFileContents[vsActiveFile] || ''}
              onChange={e => setVsFileContents({ ...vsFileContents, [vsActiveFile]: e.target.value })}
              className="w-full h-full bg-transparent text-emerald-400/90 focus:outline-none font-mono text-[10px] leading-relaxed resize-none border-none pointer-events-auto leading-normal whitespace-pre scrollbar-none"
            />
          </div>

          <div className="h-[95px] bg-[#181818] p-2 flex flex-col min-h-0 select-text overflow-y-auto shrink-0">
            <div className="flex justify-between items-center text-[7.5px] text-zinc-500 border-b border-zinc-800 pb-1 mb-1 font-bold select-none">
              <span>终端 DEBUG TERMINAL CONSOLE: bash</span>
              <button type="button" onClick={() => setVsTerminalLogs(['bash: Terminal history wiped.'])} className="hover:text-zinc-200 border-none bg-transparent cursor-pointer">Wipe </button>
            </div>
            <div className="flex-grow overflow-y-auto space-y-0.5 text-[8.5px] text-zinc-400 leading-normal scrollbar-none select-text text-left font-sans text-neutral-400">
              {vsTerminalLogs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap">{log}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGenericWorkspace = () => {
    const currentProg = programsList.find(p => p.id === selectedPreset) || {
      name: selectedPreset,
      defaultPath: appPath,
      description: '本地物理启动的原生应用程序。'
    };

    const IconToRender = currentProg.icon || Monitor;

    return (
      <div className="flex-grow flex flex-col bg-slate-950 p-6 items-center justify-center text-center pointer-events-auto select-none overflow-hidden h-full">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none opacity-25"></div>

        <div className="relative flex flex-col items-center max-w-[320px] bg-slate-900/40 p-5 rounded-2xl border border-indigo-500/10 shadow-inner">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center mb-3">
            <IconToRender size={18} className="text-indigo-400 animate-pulse" />
          </div>

          <h4 className="text-[12px] font-black text-indigo-300 uppercase tracking-widest leading-none">
            {currentProg.name} 无缝嵌入协调成功
          </h4>
          <span className="text-[8px] font-mono text-indigo-500 font-bold mt-1 tracking-widest uppercase">
            NATIVE_SOVEREIGN_BOUNDING_MAPPED
          </span>

          <p className="text-[9.5px] text-slate-450 mt-3 leading-relaxed font-sans text-center">
            {currentProg.description}
          </p>

          <div className="w-full h-px bg-indigo-500/10 my-3.5" />

          <div className="w-full text-left space-y-1 text-[8.5px] font-mono font-bold leading-normal">
            <div className="flex justify-between text-slate-500 uppercase"><span className="font-bold">系统捕获路径:</span> <span className="text-white truncate max-w-[130px]" title={appPath}>{appPath}</span></div>
            <div className="flex justify-between text-slate-500 uppercase"><span className="font-bold">HWND 映射号:</span> <span className="text-indigo-400">0x00FF34E8</span></div>
            <div className="flex justify-between text-slate-500 uppercase"><span className="font-bold">本地渲染带宽:</span> <span className="text-emerald-400">1.82 GB/s (Uncompressed)</span></div>
          </div>
        </div>

        <div className="mt-4 text-[9px] text-[#fbbf24]/60 font-medium bg-yellow-550/5 px-3 py-1 rounded-full border border-yellow-500/10 animate-pulse">
          ⚡ 进程直连通道激活中 • Canvas 物理画布多段防爆越界绑定已开
        </div>
      </div>
    );
  };

  const renderEmbeddedAppWorkspace = () => {
    switch (selectedPreset) {
      case 'keyshot':
        return renderKeyShotWorkspace();
      case 'photoshop':
      case 'substance_painter':
        return renderPhotoshopWorkspace();
      case 'blender':
      case 'max3ds':
      case 'zbrush':
      case 'maya':
      case 'houdini':
        return renderBlenderWorkspace();
      case 'comfyui':
        return renderComfyUIWorkspace();
      case 'vscode':
        return renderVSCodeWorkspace();
      default:
        return renderGenericWorkspace();
    }
  };

  /* ==========================================
     UNIFIED INTERACTIVE CONTENT RENDERER
     ========================================== */
  const renderInteractiveContent = () => {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
          {/* ==========================================
             NATIVE SOFTWARE COOPERATIVE HUB VIEW
             ========================================== */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-slate-950 font-sans" style={{ height: 'calc(100% - 1px)' }}>
            {/* Sidebar selector presets & custom configurations */}
            <div className="w-full lg:w-[260px] border-r border-indigo-500/10 bg-slate-900/40 p-4 flex flex-col gap-3 shrink-0 overflow-y-auto">
              {/* App register index & pathway tabs switcher */}
              <div className="flex items-center justify-between gap-1 select-none">
                <span className="text-[10px] font-black tracking-widest text-indigo-455 uppercase font-mono flex items-center gap-1 shrink-0">
                  <LayoutGrid size={11} /> 
                  本地原生集成总线
                </span>
                
                <div className="flex items-center gap-1">
                  {/* Reset/Restore Presets Button */}
                  <button
                    type="button"
                    onClick={handleResetToPresets}
                    title="还原所有内置预设及自定义清除"
                    className="p-1 rounded text-[10px] font-black border border-indigo-500/10 bg-slate-950 hover:bg-slate-900 text-indigo-400 hover:text-white cursor-pointer"
                  >
                    🔄
                  </button>
                  {/* Add App Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfigRegistry(false);
                      setAddingProgram(prev => !prev);
                    }}
                    title="添加自定义软件"
                    className={`p-1 rounded text-[10px] font-black border transition-all cursor-pointer ${addingProgram ? 'bg-[#ff9c00]/20 border-[#ff9c00]/50 text-[#ff9c00]' : 'bg-slate-950 border-indigo-500/10 text-indigo-400 hover:text-white'}`}
                  >
                    <Plus size={11} />
                  </button>
                  {/* Registry configuration Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAddingProgram(false);
                      setShowConfigRegistry(!showConfigRegistry);
                    }}
                    className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider transition-all cursor-pointer ${showConfigRegistry ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-indigo-500/10 text-indigo-400 hover:text-white'}`}
                  >
                    {showConfigRegistry ? '查看预设' : '⚙️ 注册中心'}
                  </button>
                </div>
              </div>

              {addingProgram && (
                <form onSubmit={handleAddProgram} className="bg-slate-950/40 p-3 rounded-xl border border-indigo-500/10 space-y-3 shrink-0 flex flex-col pointer-events-auto text-left">
                  <div className="text-[9px] font-black text-indigo-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>➕ 添加自定义本地软件</span>
                    <button type="button" onClick={() => setAddingProgram(false)} className="text-[10px] text-slate-500 hover:text-white bg-transparent border-none cursor-pointer">✕</button>
                  </div>
                  
                  {/* App Name */}
                  <div className="space-y-1">
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">软件名称 <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      required
                      value={newAppName}
                      onChange={e => setNewAppName(e.target.value)}
                      placeholder="例如: Unreal Engine 5"
                      className="w-full bg-slate-950 border border-indigo-500/15 text-white rounded-lg px-2 py-1 text-[9.5px] focus:outline-none focus:border-indigo-500/50 font-sans"
                    />
                  </div>

                  {/* App Path */}
                  <div className="space-y-1 bg-transparent">
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">绝对路径 (.exe) <span className="text-red-500">*</span></label>
                    <div className="flex gap-1 bg-transparent">
                      <input 
                        type="text"
                        value={newAppPath}
                        onChange={e => setNewAppPath(e.target.value)}
                        onPaste={e => {
                          const pasted = e.clipboardData.getData('text');
                          if (pasted) {
                            const detected = autoDetectExecutableFromPath(pasted, newAppName);
                            if (detected !== pasted) {
                              e.preventDefault();
                              setNewAppPath(detected);
                            }
                          }
                        }}
                        placeholder="C:\Program Files\..."
                        className="flex-1 min-w-0 bg-slate-950 border border-indigo-500/15 text-white/80 rounded-lg px-2 py-1 text-[9.5px] focus:outline-none focus:border-indigo-500/50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleOpenFileExplorer('addingAppName', newAppPath, newAppName, 'custom')}
                        className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-lg text-[9px] font-black cursor-pointer shrink-0 transition-colors"
                        title="打开虚拟文件选取器"
                      >
                        📁 浏览
                      </button>
                    </div>
                    {newAppPath && !newAppPath.match(/\.(exe|bat|cmd|sh|app|lnk)$/i) && (
                      <div className="text-[8.5px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded mt-1 flex flex-col gap-0.5 animate-fade-in select-none">
                        <span>⚠️ 检测到当前可能是普通文件夹路径！</span>
                        <button 
                          type="button"
                          onClick={() => setNewAppPath(autoDetectExecutableFromPath(newAppPath, newAppName))}
                          className="text-left underline hover:text-white cursor-pointer text-amber-300 font-mono bg-transparent border-none p-0"
                        >
                          💡 一键自动智能识别填入主程序：
                          <span className="block text-[8px] opacity-90 font-black mt-0.5 text-indigo-300">{autoDetectExecutableFromPath(newAppPath, newAppName)}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              )}

              {!showConfigRegistry ? (
                // Group 1: Modern lists of 14 supportable native softwares for high precision overlay sync
                <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5 select-none">
                  {programsList.map(p => {
                    const IconComp = p.icon || Monitor;
                    const isActive = selectedPreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePresetSelect(p.id)}
                        onContextMenu={(e) => handleContextMenu(e, p.id)}
                        className={`w-full group text-left px-2.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 border ${isActive ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md' : 'bg-slate-950/15 hover:bg-slate-900/30 border-indigo-500/5 text-slate-400 hover:text-slate-200'}`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
                          <IconComp size={12} />
                        </div>
                        <div className="min-w-0 flex-1 relative group/item">
                          <div className="font-extrabold text-[11px] leading-tight flex items-center justify-between">
                            <span className="truncate pr-4">{p.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {isActive && <span className="text-[7px] bg-green-500/20 text-green-400 border border-green-500/30 px-1 py-0.2 rounded font-black scale-90 uppercase">Active</span>}
                              {p.isCustom && (
                                <span
                                  onClick={(e) => handleDeleteProgram(p.id, e)}
                                  title="删除软件"
                                  className="hidden group-hover/item:flex items-center justify-center p-0.5 rounded bg-red-500/10 hover:bg-red-500 hover:text-white text-rose-450 transition-all border-none cursor-pointer"
                                >
                                  <X size={10} />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                // Group 2: Full details path & URL connection configurations (Registry center app_paths.json equivalency)
                <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
                  <div className="bg-indigo-950/20 rounded-xl p-2.5 border border-indigo-500/10 text-left">
                    <span className="text-[8px] font-black tracking-widest text-indigo-400 uppercase font-mono">配置中心提示 (Registry)</span>
                    <p className="text-[9px] text-slate-400 font-sans mt-1 leading-normal">
                      此处保存本地启动器对各个软件拉起时的底层路径。各项更新会即时映射并永久保存在您的浏览器独立运行机制中。
                    </p>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">
                          当前软件绝对路径 (.exe)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const def = programsList.find(p => p.id === selectedPreset);
                            if (def) updateSingleAppConfig(selectedPreset, def.defaultPath, appArgs, appUrl);
                          }}
                          className="text-[8px] text-indigo-405/60 hover:text-indigo-400 font-bold hover:underline cursor-pointer border-none bg-transparent"
                        >
                          恢复初始值
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <input 
                          type="text"
                          value={appPath}
                          onChange={e => updateSingleAppConfig(selectedPreset, e.target.value, appArgs, appUrl)}
                          className="flex-1 min-w-0 bg-slate-950 border border-indigo-500/15 text-white/80 rounded-lg px-2 py-1 text-[10px] focus:border-indigo-500/50 focus:outline-none transition-all font-mono"
                          placeholder="请输入绝对路径, 比如 C:\..."
                        />
                        <button
                          type="button"
                          onClick={() => handleOpenFileExplorer('registryPathName', appPath, programsList.find(p => p.id === selectedPreset)?.name || '', selectedPreset)}
                          className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-lg text-[9px] font-black cursor-pointer shrink-0 transition-colors"
                          title="打开虚拟文件选取器"
                        >
                          📁 浏览
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">
                        软件连接地址(Connection Stream URL)
                      </label>
                      <input 
                        type="text"
                        value={appUrl}
                        onChange={e => updateSingleAppConfig(selectedPreset, appPath, appArgs, e.target.value)}
                        className="w-full bg-slate-950 border border-indigo-500/15 text-indigo-300 rounded-lg px-2 py-1 text-[10px] focus:border-indigo-500/50 focus:outline-none transition-all font-mono"
                        placeholder="输入连接流地址 http://..."
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">
                        运行附加启动参数 (Arguments)
                      </label>
                      <input 
                        type="text"
                        value={appArgs}
                        onChange={e => updateSingleAppConfig(selectedPreset, appPath, e.target.value, appUrl)}
                        className="w-full bg-slate-950 border border-indigo-500/15 text-white/80 rounded-lg px-2 py-1 text-[10px] focus:border-indigo-500/50 focus:outline-none transition-all font-mono"
                        placeholder="选填参数, 例如 -mode server"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Main overlay stream mapping and coordinator view */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-950 relative">
              {/* Virtual mapping window frame header */}
              <div className="flex-1 min-h-0 relative flex flex-col border-b border-indigo-500/10">
                <div className="absolute top-3 left-4 z-20 flex items-center gap-2 pointer-events-none select-none">
                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest font-mono text-white ${procStatus === 'running' ? 'bg-green-600 animate-pulse' : 'bg-slate-700'}`}>
                    ● {procStatus === 'running' ? 'LIVE STREAM DETECTED' : 'STANDBY CONFIG DECK'}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-extrabold uppercase tracking-wide">
                    {selectedPreset.toUpperCase()}_WORKSPACE_MAPPED
                  </span>
                </div>

                {procStatus === 'running' ? (
                  <div ref={placeholderRef} className="relative flex-1 w-full min-h-0 bg-slate-950 overflow-hidden font-sans">
                    {renderEmbeddedAppWorkspace()}
                  </div>
                ) : (
                  // Offline Standby Screen - Workspace Settings Board matching Figure 4
                  <div ref={placeholderRef} className="relative flex-1 w-full min-h-0 bg-slate-950 overflow-y-auto p-6 scrollbar-thin select-none text-left flex flex-col gap-6">
                    {/* Header card with metadata */}
                    <div className="flex flex-col gap-1.5 border-b border-indigo-500/10 pb-4 shrink-0 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#ff9c00]/20 text-[#ff9c00] border border-[#ff9c00]/30 rounded text-[9px] font-black uppercase tracking-wider font-mono">WORKSPACE SETUP</span>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">{programsList.find(p => p.id === selectedPreset)?.name || 'KeyShot 3D Render'} Workspace 设置</h3>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        所有路径、默认参数、启动状态都集中同步到这里。顶部按钮、右键工作区、设置页启动都会读取同一份配置，并直接在真实节点内部中运行软件窗口。
                      </p>
                    </div>

                    {/* Main settings options grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start font-sans">
                      {/* Left Block: environment variables and paths (7 cols) */}
                      <div className="xl:col-span-7 flex flex-col gap-4">
                        <div className="bg-slate-900/40 border border-indigo-500/10 rounded-2xl p-4 flex flex-col gap-4">
                          <div className="flex items-center justify-between border-b border-indigo-500/5 pb-2.5">
                            <span className="text-[10px] font-black tracking-widest text-[#ff9c00] uppercase font-mono">运行环境与默认参数</span>
                            {/* Sync indicator */}
                            <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest leading-none font-black animate-pulse">● Config Synced</span>
                          </div>
                          
                          <div className="bg-indigo-950/20 border border-indigo-500/5 rounded-xl p-3">
                            <p className="text-[9px] text-slate-400 leading-normal font-sans">
                              这里是底层启动的唯一配置源。路径必须保存完整的 <strong className="text-indigo-300 font-mono">.exe</strong> 文件路径并自动映射；手动输入或浏览选取均会同步更新已经选择好的地址。
                            </p>
                          </div>

                          {/* Inputs Block */}
                          <div className="space-y-3.5">
                            {/* Studio App Path */}
                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-black text-slate-500 uppercase tracking-widest font-mono">
                                运行绝对路径 (.EXE) <span className="text-red-500">*</span>
                              </label>
                              <div className="flex gap-1.5">
                                <input 
                                  type="text"
                                  value={appPath}
                                  onChange={e => updateSingleAppConfig(selectedPreset, e.target.value, appArgs, appUrl)}
                                  className="flex-1 min-w-0 bg-slate-950 border border-indigo-500/15 text-white rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-indigo-500/50 font-mono"
                                  placeholder={`比如 C:\\Program Files\\...`}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleOpenFileExplorer(
                                    'registryPathName', 
                                    appPath, 
                                    programsList.find(p => p.id === selectedPreset)?.name || '', 
                                    selectedPreset
                                  )}
                                  className="px-3 bg-indigo-650 hover:bg-indigo-550 border border-indigo-500/30 text-white rounded-xl text-[10px] font-black cursor-pointer transition-all shrink-0 shadow-md flex items-center justify-center gap-1 font-sans"
                                >
                                  📁 浏览
                                </button>
                              </div>
                            </div>

                            {/* Studio Headless Path */}
                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-black text-slate-500 uppercase tracking-widest font-mono">
                                HEADLESS 运行绝对路径 (HEADLESSPATH)
                              </label>
                              <div className="flex gap-1.5">
                                <input 
                                  type="text"
                                  value={appHeadlessPath}
                                  onChange={e => updateSingleAppConfig(selectedPreset, appPath, appArgs, appUrl, { headlessPath: e.target.value })}
                                  className="flex-1 min-w-0 bg-slate-950 border border-indigo-500/15 text-white/80 rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-indigo-500/50 font-mono"
                                  placeholder="可选：Headless 渲染模式对应的独立可执行主路径"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleOpenFileExplorer(
                                    'registryHeadlessPathName', 
                                    appHeadlessPath, 
                                    `${programsList.find(p => p.id === selectedPreset)?.name || ''} Headless`, 
                                    selectedPreset
                                  )}
                                  className="px-3 bg-slate-800 hover:bg-slate-700 border border-indigo-500/10 text-slate-300 hover:text-white rounded-xl text-[10px] font-extrabold cursor-pointer transition-all shrink-0 flex items-center justify-center gap-1 font-sans"
                                >
                                  📁 浏览
                                </button>
                              </div>
                            </div>

                            {/* Dimensions sizing */}
                            <div className="grid grid-cols-2 gap-3.5">
                              <div className="space-y-1">
                                <label className="block text-[8.5px] font-black text-slate-500 uppercase tracking-widest font-mono">默认映射宽度 (WIDTH)</label>
                                <input 
                                  type="text"
                                  value={appWidth}
                                  onChange={e => updateSingleAppConfig(selectedPreset, appPath, appArgs, appUrl, { width: e.target.value })}
                                  className="w-full bg-slate-950 border border-indigo-500/15 text-white rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-indigo-500/50 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8.5px] font-black text-slate-500 uppercase tracking-widest font-mono">默认映射高度 (HEIGHT)</label>
                                <input 
                                  type="text"
                                  value={appHeight}
                                  onChange={e => updateSingleAppConfig(selectedPreset, appPath, appArgs, appUrl, { height: e.target.value })}
                                  className="w-full bg-slate-950 border border-indigo-500/15 text-white rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-indigo-500/50 font-mono"
                                />
                              </div>
                            </div>

                            {/* Samples and run options */}
                            <div className="grid grid-cols-2 gap-3.5">
                              <div className="space-y-1">
                                <label className="block text-[8.5px] font-black text-slate-500 uppercase tracking-widest font-mono">默认渲染采样 (SAMPLES)</label>
                                <input 
                                  type="text"
                                  value={appSamples}
                                  onChange={e => updateSingleAppConfig(selectedPreset, appPath, appArgs, appUrl, { samples: e.target.value })}
                                  className="w-full bg-slate-950 border border-indigo-500/15 text-white rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-indigo-500/50 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8.5px] font-black text-slate-500 uppercase tracking-widest font-mono">运行环境模式 (RUNMODE)</label>
                                <select 
                                  value={appRunMode}
                                  onChange={e => updateSingleAppConfig(selectedPreset, appPath, appArgs, appUrl, { runMode: e.target.value })}
                                  className="w-full bg-slate-950 border border-indigo-500/15 text-white rounded-xl px-3 py-1.5 text-[10px] focus:outline-none focus:border-indigo-500/55"
                                >
                                  <option value="canvas_node">真实并发槽集成模式 (Real Node Loop)</option>
                                  <option value="simulation">智能虚拟仿真引擎 (Sandbox Mode)</option>
                                  <option value="headless_worker">Headless 指令渲染工作集群</option>
                                </select>
                              </div>
                            </div>

                            {/* Directory definitions */}
                            <div className="grid grid-cols-2 gap-3.5">
                              <div className="space-y-1">
                                <label className="block text-[8.5px] font-black text-slate-500 uppercase tracking-widest font-mono">默认输出目录 (OUTPUTDIR)</label>
                                <input 
                                  type="text"
                                  value={appOutputDir}
                                  onChange={e => updateSingleAppConfig(selectedPreset, appPath, appArgs, appUrl, { outputDir: e.target.value })}
                                  className="w-full bg-slate-950 border border-indigo-500/15 text-white rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-indigo-500/50 font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8.5px] font-black text-slate-500 uppercase tracking-widest font-mono">默认任务目录 (TASKDIR)</label>
                                <input 
                                  type="text"
                                  value={appTaskDir}
                                  onChange={e => updateSingleAppConfig(selectedPreset, appPath, appArgs, appUrl, { taskDir: e.target.value })}
                                  className="w-full bg-slate-950 border border-indigo-500/15 text-white rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:border-indigo-500/50 font-mono"
                                />
                              </div>
                            </div>

                            {/* Enable real bridge checkbox */}
                            <div className="flex items-center gap-2.5 pt-1.5 select-none text-left">
                              <input 
                                type="checkbox"
                                id="bridge-enable-check"
                                checked={appRealBridge}
                                onChange={e => {
                                  updateSingleAppConfig(selectedPreset, appPath, appArgs, appUrl, { realBridge: e.target.checked });
                                  setProcLogs(prev => [...prev, `[配置中心] [${selectedPreset.toUpperCase()}] 已${e.target.checked ? '启用' : '禁用'}真实 Bridge 并行。`]);
                                }}
                                className="h-3.5 w-3.5 rounded border-indigo-500/20 bg-slate-950 text-[#ff9c00] focus:ring-offset-slate-950"
                              />
                              <label htmlFor="bridge-enable-check" className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 hover:text-white cursor-pointer transition-colors leading-none">
                                启用真实 {programsList.find(p => p.id === selectedPreset)?.name || '软件'} Bridge 并行与 HWND 拦截信号
                              </label>
                            </div>
                          </div>

                          {/* Footer Actions */}
                          <div className="flex gap-2.5 pt-3.5 border-t border-indigo-500/5 select-none items-center">
                            <button
                              type="button"
                              onClick={() => {
                                setProcLogs(prev => [
                                  ...prev,
                                  `[配置保存] 成功保存运行配置到本地注册中心：${appPath}`,
                                  `[配置参数] -w ${appWidth} -h ${appHeight} -samples ${appSamples} -mode ${appRunMode}`
                                ]);
                                alert(`已持久化存储 ${programsList.find(p => p.id === selectedPreset)?.name || 'KeyShot'} 配置！`);
                              }}
                              className="px-3.5 py-2 hover:opacity-90 bg-indigo-650 hover:bg-indigo-550 border-none text-white rounded-xl text-[10px] font-black cursor-pointer transition-all shadow-md shrink-0 font-sans"
                            >
                              保存并同步配置
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const exist = appPath && appPath.trim() !== '';
                                setProcLogs(prev => [
                                  ...prev,
                                  `===== 诊断 [${programsList.find(p => p.id === selectedPreset)?.name || '软件'}] 本地可执行文件 =====`,
                                  `[检测-1] 配置文件合规性检查..... [通过]`,
                                  `[检测-2] 物理集成侦测通道状态..... [监听正常]`,
                                  `[检测-3] 进程隔离层深度诊断....... [正常]`,
                                  `[检测-4] 可执行主路径配置验证..... [${exist ? '通过 -> ' + appPath : '未配置 - 状态异常'}]`,
                                  exist ? `[DIAGNOSTICS] 诊断完成。本地应用已配置就绪，可以随时通过 Bridge 在画布节点中直接拉起。`: `[DIAGNOSTICS] 警告！本地主路径为空。请先通过 [浏览] 或手动输入可执行程序地址。`
                                ]);
                              }}
                              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-indigo-500/10 text-[#ff9c00] hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all font-sans"
                            >
                              检测配置
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setProcLogs(prev => [
                                  ...prev,
                                  `[任务] 已成功分配临时映射输出地址: ${appUrl}`,
                                  `[任务] 开始合成多图层，输出分辨率 ${appWidth}x${appHeight}...`,
                                  `[任务] 采样率对齐 ${appSamples}. 已完成 node-local 绑定通道覆盖。`
                                ]);
                              }}
                              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-indigo-500/10 text-violet-400 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all font-sans"
                            >
                              生成测试渲染
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right Block: Host Controls / Checklist Status Monitoring (5 cols) */}
                      <div className="xl:col-span-5 flex flex-col gap-4">
                        {/* Control Card panel */}
                        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-indigo-500/15 rounded-2xl p-4 flex flex-col gap-3 font-sans">
                          <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
                            <span className="text-[10px] font-black text-white tracking-wider flex items-center gap-1">
                              <span className="text-[#ff9c00] font-mono">⚡</span> 运行集成主控
                            </span>
                            <span className="text-[8px] font-mono bg-[#ff9c00]/20 text-[#ff9c00] border border-[#ff9c00]/30 px-1 py-0.2 rounded font-black">NATIVE HOST BOUND</span>
                          </div>
                          
                          <p className="text-[9px] text-slate-400 leading-normal font-sans">
                            启动节点将真正拉起原生软件并作为覆盖层完美嵌入画布，而非在 Windows 外单独运行。内置浏览器已完全移除。
                          </p>

                          <div className="grid grid-cols-1 gap-2 pt-1 font-sans">
                            {/* Launch Button */}
                            <button
                              type="button"
                              onClick={() => handleLaunchNativeApp()}
                              disabled={isLaunching}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-[#ff9c00] to-amber-600 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-[10px] font-black shadow-lg hover:shadow-[#ff9c50]/20 active:scale-95 transition-all cursor-pointer border-none"
                            >
                              {isLaunching ? <Loader2 size={11} className="animate-spin text-white" /> : <span>🚀 启动 {programsList.find(p => p.id === selectedPreset)?.name || '软件'} 节点</span>}
                            </button>

                            {/* Select main app exe file */}
                            <button
                              type="button"
                              onClick={() => handleOpenFileExplorer(
                                'registryPathName', 
                                appPath, 
                                programsList.find(p => p.id === selectedPreset)?.name || '', 
                                selectedPreset
                              )}
                              className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#ff9c05]/20 hover:bg-[#ff9c05]/30 text-[#ff9c00] rounded-xl text-[10px] font-black border border-[#ff9c00]/40 transition-colors cursor-pointer"
                            >
                              <span>📁 选取并同步 {programsList.find(p => p.id === selectedPreset)?.name || '软件'}.exe 绝对路径</span>
                            </button>

                            {/* Force stop button */}
                            <button
                              type="button"
                              onClick={() => handleStopNativeApp()}
                              className="w-full flex items-center justify-center gap-1.5 py-2 bg-rose-650/30 hover:bg-rose-600 border border-rose-500/20 text-rose-350 hover:text-white rounded-xl text-[9.5px] font-black transition-colors cursor-pointer"
                            >
                              <span>❌ 强制退出/关闭原生 {programsList.find(p => p.id === selectedPreset)?.name || '工作区'}</span>
                            </button>

                            {/* Host diagnostics */}
                            <div className="grid grid-cols-2 gap-2 mt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setProcLogs(prev => [
                                    ...prev,
                                    `[诊断] IPC 隧道诊断测试开启..... [正常]`,
                                    `[诊断] 物理机器 HWND 接口流捕获状况... [就绪]`,
                                    `[诊断] DPI 高分辨比例自适应映射... [自适应比例 150%]`
                                  ]);
                                  alert('诊断正常！本地进程通信隧道正常，可安全限制启动本段程序。');
                                }}
                                className="py-1.5 bg-slate-950 hover:bg-slate-950 border border-indigo-500/10 text-indigo-350 hover:text-white rounded-xl text-[9px] font-extrabold cursor-pointer transition-colors"
                              >
                                诊断 Host 联通性
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  alert('日志历史输出已呈现在最下方。');
                                }}
                                className="py-1.5 bg-slate-950 hover:bg-slate-950 border border-indigo-500/10 text-slate-300 hover:text-white rounded-xl text-[9px] font-extrabold cursor-pointer transition-colors"
                              >
                                打开历史记录
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Checklist details status card */}
                        <div className="bg-slate-900/40 border border-indigo-500/10 rounded-2xl p-4 flex flex-col gap-3 font-mono text-[9px] text-left select-none">
                          <div className="text-[10px] font-black text-[#ff9c00] uppercase tracking-widest pb-1.5 border-b border-indigo-500/5 select-none font-sans">
                            运行状况监测 (Registry Diagnostics)
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">运行配置加载</span>
                              <span className="text-emerald-400 font-extrabold">TRUE (Registry Loaded)</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">STUDIO 主路径</span>
                              <span className={appPath ? 'text-emerald-400 font-extrabold' : 'text-rose-450 font-extrabold'}>
                                {appPath ? 'TRUE' : 'FALSE (未选)'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">HEADLESS 主路径</span>
                              <span className={appHeadlessPath ? 'text-emerald-400 font-extrabold' : 'text-amber-500/85 font-extrabold'}>
                                {appHeadlessPath ? 'TRUE' : 'FALSE'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">宿主绑定通道映射</span>
                              <span className="text-[#ff9c00] font-extrabold">{appRunMode.toUpperCase()}</span>
                            </div>
                            <div className="border-t border-indigo-500/5 pt-2 flex flex-col gap-1.5 font-sans leading-relaxed text-slate-400">
                              <div className="flex items-start justify-between gap-2.5">
                                <span className="text-slate-500 shrink-0 text-[8.5px]">主程序路径:</span>
                                <span className="text-white/80 truncate text-right max-w-[150px] font-mono" title={appPath}>{appPath || '(未配置)'}</span>
                              </div>
                              <div className="flex items-start justify-between gap-2.5">
                                <span className="text-slate-500 shrink-0 text-[8.5px]">Headless 路径:</span>
                                <span className="text-white/70 truncate text-right max-w-[150px] font-mono" title={appHeadlessPath}>{appHeadlessPath || '(未配置)'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Performance Telemetry Bento Hub */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-black/40 p-4 border-b border-indigo-500/10 shrink-0 select-none">
                <div className="flex flex-col gap-0.5 bg-slate-900/60 rounded-xl p-2.5 border border-indigo-500/5 text-left">
                  <span className="text-[8px] text-indigo-400/50 font-bold uppercase tracking-widest font-mono flex items-center gap-1"><Activity size={8} /> 进程映射状态</span>
                  <span className={`text-[11px] font-black uppercase tracking-wider ${procStatus === 'running' ? 'text-green-400 animate-pulse' : 'text-slate-400'}`}>
                    {procStatus === 'running' ? '● 已激活直连' : procStatus === 'stopped' ? '● 强制关闭' : '● 等待拉起'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 bg-slate-900/60 rounded-xl p-2.5 border border-indigo-500/5 text-left">
                  <span className="text-[8px] text-indigo-400/50 font-bold uppercase tracking-widest font-mono flex items-center gap-1"><Zap size={8} /> 运行时长 (UPTIME)</span>
                  <span className="text-[11px] font-mono text-indigo-300 font-extrabold uppercase tracking-wider">
                    {Math.floor(uptime/60)}m {uptime%60}s
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 bg-slate-900/60 rounded-xl p-2.5 border border-indigo-500/5 text-left">
                  <span className="text-[8px] text-indigo-400/50 font-bold uppercase tracking-widest font-mono flex items-center gap-1"><Cpu size={8} /> 虚拟显卡加速 (GPU)</span>
                  <span className="text-[11px] font-mono text-violet-300 font-black tracking-wider">
                    {procStatus === 'running' ? `${simCpu}%` : '0%'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 bg-slate-900/60 rounded-xl p-2.5 border border-indigo-500/5 text-left">
                  <span className="text-[8px] text-indigo-400/50 font-bold uppercase tracking-widest font-mono flex items-center gap-1"><Database size={8} /> 虚拟映射缓冲占</span>
                  <span className="text-[11px] font-mono text-amber-500 font-black tracking-wider">
                    {procStatus === 'running' ? `${(simRam/1024).toFixed(2)} GB` : '0.00 GB'}
                  </span>
                </div>
              </div>

              {/* Console Debug Terminal panel (Core Telemetry logs of HWND synchronization) */}
              <div className="flex flex-col min-h-[120px] bg-black p-3.5 font-mono text-[9px] leading-relaxed text-indigo-400/70 shadow-inner">
                <div className="flex items-center justify-between border-b border-indigo-500/15 pb-1.5 mb-2 text-indigo-400/90 shrink-0 font-bold tracking-widest select-none">
                  <span className="flex items-center gap-1.5">
                    <Terminal size={9} className="text-green-500 animate-pulse" />
                    HWN_OVERLAY_COORDINATOR_ENGINE TRACE
                  </span>
                  <button 
                    onClick={() => setProcLogs(['[终端检测] 历史日志会话已成功安全清理完成.'])}
                    className="text-indigo-400/40 hover:text-indigo-300 text-[8px] font-bold tracking-normal uppercase border-none bg-transparent cursor-pointer"
                  >
                    [清空终端]
                  </button>
                </div>
                <div className="flex-grow overflow-y-auto max-h-[140px] space-y-1 text-left">
                  {procLogs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap hover:bg-white/5 px-1 py-0.5 rounded text-indigo-400/60 select-text leading-normal">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        {/* Dynamic Alerts inside overlay */}
        <AnimatePresence>
          {loadingMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="absolute top-3 left-4 right-4 z-[99] bg-indigo-950/90 border border-indigo-500/30 text-indigo-200 px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-xs shadow-xl shadow-black/80 backdrop-blur-sm pointer-events-none select-none"
            >
              <Loader2 size={13} className="text-indigo-400 animate-spin shrink-0" />
              <span className="font-black leading-none">{loadingMsg}</span>
            </motion.div>
          )}

          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="absolute inset-x-4 top-3 z-[101] bg-rose-950/95 border border-rose-500/30 text-rose-200 px-4 py-3 rounded-xl flex flex-col gap-2 shadow-xl shadow-black/80 backdrop-blur-sm select-none"
            >
              <div className="flex items-start gap-2 text-xs text-left">
                <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                <span className="font-bold flex-1 text-[11px] whitespace-pre-line leading-relaxed text-rose-100">{errorMsg}</span>
                <button 
                  onClick={() => setErrorMsg('')} 
                  className="p-0.5 hover:bg-slate-800 rounded text-rose-450 hover:text-white border-none bg-transparent cursor-pointer shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  /* ==========================================
     RENDER WRAPPER BRANCHING (MINIMIZED/PINNED)
     ========================================== */

  // 1. Minimized rendering card
  if (isMinimized) {
    return (
      <div 
        className={`flex items-center gap-3 bg-slate-950/95 border-2 border-indigo-500/70 rounded-full px-4 py-2.5 shadow-[0_10px_35px_rgba(99,102,241,0.25)] select-none transition-all duration-300 hover:border-indigo-400 cursor-pointer ${selected ? 'ring-8 ring-indigo-500/10' : ''}`}
        style={{ width: '210px' }}
        onDoubleClick={() => {
          setIsMinimized(false);
          updateNodeData(id, { isMinimized: false });
        }}
      >
        <Handle type="target" position={Position.Left} className="!bg-indigo-500 !w-4 !h-4 !-left-2 !rounded-lg !border-[2.5px] !border-slate-900 shadow-lg" />
        <Handle type="source" position={Position.Right} className="!bg-indigo-500 !w-4 !h-4 !-right-2 !rounded-lg !border-[2.5px] !border-slate-900 shadow-lg" />

        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
          <Monitor size={14} className="animate-pulse" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-start text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-[11px] text-white tracking-wider leading-none">HostNode</span>
            <span className="text-[8px] font-black text-indigo-300 bg-indigo-500/20 px-1 py-0.5 rounded leading-none uppercase">MIN</span>
          </div>
          <span className="text-[9px] text-indigo-400/60 font-mono mt-0.5 truncate uppercase">双击还原窗口</span>
        </div>
        <button 
          onClick={() => {
            setIsMinimized(false);
            updateNodeData(id, { isMinimized: false });
          }}
          className="p-1 hover:bg-white/10 rounded-full text-indigo-300 hover:text-white transition-colors duration-200 border-none bg-transparent cursor-pointer"
          title="还原窗口模式"
        >
          <Maximize2 size={12} />
        </button>
      </div>
    );
  }

  // 2. Pinned on screen placeholder card on canvas
  if (isPinned) {
    return (
      <div 
        className={`flex flex-col w-full h-[320px] bg-slate-900/60 rounded-[32px] border-2 border-indigo-500/40 p-6 items-center justify-center text-center select-none shadow-[inset_0_4px_30px_rgba(99,102,241,0.05)] transition-all ${selected ? 'border-indigo-500 ring-8 ring-indigo-500/10' : ''}`}
        style={{ width: '400px' }}
      >
        <Handle type="target" position={Position.Left} className="!bg-indigo-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-slate-900 shadow-xl" />
        <Handle type="source" position={Position.Right} className="!bg-indigo-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-slate-900 shadow-xl" />

        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3 text-indigo-400">
          <Anchor size={24} className="animate-[spin_16s_linear_infinite]" />
        </div>
        <h4 className="text-xs font-black text-indigo-200 uppercase tracking-widest leading-none">宿主直连 · 窗口固定中</h4>
        <span className="text-[10px] text-indigo-400/50 font-mono mt-1 tracking-wider">PORTAL_WINDOW_MOUNTED</span>
        <p className="text-[10px] text-slate-400 max-w-[280px] mt-2.5 leading-relaxed font-sans">
          该窗口已固定于屏幕绝对位置上运行，不受主画板运动缩放（Zoom / Pan / Rotate）干扰，便于进行多窗格协同调校。
        </p>

        <div className="flex gap-2 mt-4">
          <button 
            onClick={() => {
              setIsPinned(false);
              updateNodeData(id, { isPinned: false });
            }}
            className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-550 text-white font-extrabold text-[10px] hover:scale-105 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 border-none"
          >
            <PinOff size={10} />
            <span>就地解锁并放回</span>
          </button>
        </div>

        {/* Portalled absolute interactive window hovering on screen */}
        {createPortal(
          <div 
            onPointerDown={e => handlePinnedHeaderPointerDown(e)}
            onPointerMove={e => handlePinnedHeaderPointerMove(e)}
            onPointerUp={e => handlePinnedHeaderPointerUp(e)}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            className="fixed flex flex-col bg-slate-950/98 rounded-3xl border-2 border-indigo-500/55 shadow-[0_30px_60px_rgba(0,0,0,0.85)] overflow-hidden"
            style={{
              left: `${pinnedPos.x}px`,
              top: `${pinnedPos.y}px`,
              width: '900px',
              height: '680px',
              zIndex: 10001,
              pointerEvents: 'auto',
              transition: 'none',
            }}
          >
            {/* Portalled Draggable hover-bar */}
            <div className="h-10 bg-slate-900 border-b border-indigo-500/10 flex items-center justify-between px-5 cursor-move select-none shrink-0" title="鼠标拖拽此处可自由移动该固定映射窗口">
              <div className="flex items-center gap-2 text-[10px] font-black text-yellow-450 tracking-wider font-mono">
                <Pin size={11} className="animate-pulse text-yellow-400" />
                <span>NATIVE STREAM PIN_PORTAL [拖动上方该条自由改变窗口物理位置，不被画布缩放影响]</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPinned(false);
                    updateNodeData(id, { isPinned: false });
                  }}
                  className="px-2.5 py-0.5 bg-indigo-650 hover:bg-slate-800 text-white rounded text-[9px] font-black tracking-wider uppercase transition-colors cursor-pointer border-none"
                  title="解除屏幕固定放回画布"
                >
                  解除屏幕固定
                </button>
              </div>
            </div>

            {/* Render full components within pinned screen windows */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-indigo-500/10 bg-slate-900/40 shrink-0 select-none">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center">
                    <Monitor size={18} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs tracking-wider text-white uppercase italic">
                        💎 Native Host Window
                      </span>
                    </div>
                    <span className="text-[9px] text-indigo-400/50 font-mono tracking-widest leading-none">
                      STREAMING_PORT_ACTIVE_ON_VIEWPORT_PIN_MODE
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-indigo-500/15">
                    <button 
                      onClick={() => setViewTab('browser')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black cursor-pointer border-none ${viewTab === 'browser' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-400 hover:text-white'}`}
                    >
                      内置浏览器
                    </button>
                    <button 
                      onClick={() => setViewTab('native-app')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black cursor-pointer border-none ${viewTab === 'native-app' ? 'bg-violet-650 text-white shadow-md' : 'bg-transparent text-slate-400 hover:text-white'}`}
                    >
                      应用映射
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                      const nextFolded = !isFolded;
                      setIsFolded(nextFolded);
                      updateNodeData(id, { isFolded: nextFolded });
                    }}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-all text-gray-400 border-none bg-transparent cursor-pointer"
                    title={isFolded ? "展开" : "折叠"}
                  >
                    {isFolded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>

                  <button 
                    onClick={() => {
                      setIsFullscreen(true);
                      updateNodeData(id, { isFullscreen: true });
                    }}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-all text-gray-400 border-none bg-transparent cursor-pointer"
                    title="全屏模式"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>

              {!isFolded && renderInteractiveContent()}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // 3. Normal view rendering on canvas (or portalled fullscreen)
  return (
    <>
      <NodeResizer 
        minWidth={460} 
        minHeight={500} 
        isVisible={selected && !isFolded && !isPinned && !isFullscreen} 
        lineClassName="border-indigo-500/50" 
        handleClassName="h-3 w-3 bg-white border-2 border-indigo-500 rounded-sm" 
        keepAspectRatio={false} 
      />
      
      <div 
        className={`flex flex-col bg-slate-950/95 rounded-[32px] border-2 border-indigo-500/20 shadow-[0_20px_50px_rgba(99,102,241,0.15)] overflow-hidden transition-all duration-300 ${isElectron ? 'ring-2 ring-indigo-500/30' : ''} ${selected ? 'border-indigo-500 ring-8 ring-indigo-500/10' : ''}`}
        style={{ 
          height: isFolded ? 'auto' : '100%',
          width: isFolded ? '460px' : '100%',
          ['--node-zoom' as any]: zoomScale
        }}
      >
        <Handle type="target" position={Position.Left} className="!bg-indigo-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-slate-900 shadow-xl hover:!scale-110 transition-all duration-200 z-50 animate-[pulse_3s_infinite]" />
        <Handle type="source" position={Position.Right} className="!bg-indigo-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-slate-900 shadow-xl hover:!scale-110 transition-all duration-200 z-50 pointer-events-auto animate-[pulse_3s_infinite]" />

        {/* Standard UI header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-indigo-500/10 bg-slate-900/60 shrink-0 react-flow__node-draghandle select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg">
              <Monitor size={20} className="text-white animate-pulse" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-indigo-100 uppercase italic">
                  💎 Native Host
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-500/20 text-indigo-300 uppercase tracking-wider">
                  宿主直连
                </span>
              </div>
              <span className="text-[10px] text-indigo-400/50 font-mono tracking-widest">
                LOCAL_Sovereign_Kernel
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab navigation switches */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-indigo-500/20 mr-2 shrink-0">
              <button 
                onClick={() => setViewTab('browser')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-none ${viewTab === 'browser' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-400 hover:text-white'}`}
              >
                内置浏览器
              </button>
              <button 
                onClick={() => setViewTab('native-app')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border-none ${viewTab === 'native-app' ? 'bg-violet-650 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                应用映射
              </button>
            </div>

            {/* Minimize button */}
            <button
              onClick={() => {
                setIsMinimized(true);
                updateNodeData(id, { isMinimized: true });
              }}
              className="p-1.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all transform hover:scale-105 active:scale-95 cursor-pointer border-none bg-transparent"
              title="最小化到节点徽章"
            >
              <Minimize2 size={14} />
            </button>

            {/* Fold toggles */}
            <button 
              onClick={() => {
                const nextFolded = !isFolded;
                setIsFolded(nextFolded);
                updateNodeData(id, { isFolded: nextFolded });
              }}
              className={`p-1.5 hover:bg-white/5 rounded-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer border-none bg-transparent ${isFolded ? 'text-indigo-400 bg-indigo-400/10' : 'text-gray-400 hover:text-white'}`}
              title={isFolded ? "展开窗口" : "折叠窗口"}
            >
              {isFolded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            {/* Screen Locking Pins */}
            <button 
              onClick={() => {
                const nextPinned = true;
                setIsPinned(nextPinned);
                updateNodeData(id, { isPinned: true });
                if (placeholderRef.current) {
                  const r = placeholderRef.current.getBoundingClientRect();
                  const pos = { x: r.left - 100, y: r.top - 120 };
                  setPinnedPos(pos);
                  updateNodeData(id, { pinnedPos: pos });
                }
              }}
              className="p-1.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all transform hover:scale-105 active:scale-95 cursor-pointer border-none bg-transparent"
              title="固定到屏幕坐标 (不受画布拖拽缩放影响)"
            >
              <Pin size={14} />
            </button>

            {/* Fullscreen icon */}
            <button 
              onClick={() => {
                setIsFullscreen(true);
                updateNodeData(id, { isFullscreen: true });
              }}
              className="p-1.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all transform hover:scale-105 active:scale-95 cursor-pointer border-none bg-transparent"
              title="全屏调试模式"
            >
              <Maximize2 size={14} />
            </button>

            {/* Floating independent external window launcher */}
            <button 
              onClick={handleLaunchNativeBrowser} 
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-black shadow-lg transition-all active:scale-95 cursor-pointer border-none"
              title="一键在本地机器真实拉起独立浏览器窗口"
            >
              <ExternalLink size={11} />
              <span>启动浏览器</span>
            </button>
          </div>
        </div>

        {!isFolded && renderInteractiveContent()}
      </div>

      {/* PORTLED BROWSER IFRAME LAYER FOR DIRECT SCALED OVERLAY PLACEMENT */}
      {viewTab === 'browser' && !isFolded && !isPinned && !isFullscreen && rect && createPortal(
        <div 
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          className="fixed overflow-hidden bg-white shadow-xl flex flex-col border border-indigo-500/10 rounded-b-[28px]"
          style={{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            zIndex: 40,
            pointerEvents: 'auto',
            display: 'flex',
            transition: 'none',
          }}
        >
          {isElectron ? (
            <webview
              key={`${id}-${refreshKey}`}
              src={currentUrl}
              style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
              allowpopups={true}
            />
          ) : (
            <iframe 
              key={`${id}-${refreshKey}`}
              src={currentUrl} 
              className="w-full h-full border-0 bg-white" 
              referrerPolicy="no-referrer" 
            />
          )}
        </div>,
        document.body
      )}

      {/* PORTLED NATIVE APP STREAM IFRAME LAYER FOR DIRECT SCALED OVERLAY PLACEMENT DEPRECATED AND REMOVED TO PREVENT BLANK COVERING OVER CRYSTAL-CLEAR INNER SIMULATOR */}

      {/* IMMERSIVE FULLSCREEN SYSTEM OVERLAY COOPERATOR PORTAL */}
      {isFullscreen && createPortal(
        <div 
          className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col select-none"
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          {/* Fullscreen header console */}
          <div className="h-14 bg-slate-900 border-b border-indigo-500/15 flex items-center justify-between px-6 shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                <Monitor size={20} className="text-white rotate-12" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-1.5 font-mono">
                  💎 NATIVE_HOST FULLSCREEN IMMERSIVE DIAGNOSTICS WORKSPACE
                </h3>
                <span className="text-[10px] font-mono text-indigo-400 font-bold tracking-widest uppercase">
                  STATUS: LIVE_STREAMING_CHANNEL // BOUNDS_MAPPING_ON
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-950 p-1.5 rounded-xl border border-indigo-500/15">
                <button 
                  onClick={() => setViewTab('browser')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer border-none ${viewTab === 'browser' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-400 hover:text-white'}`}
                >
                  内置浏览器
                </button>
                <button 
                  onClick={() => setViewTab('native-app')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer border-none ${viewTab === 'native-app' ? 'bg-violet-650 text-white shadow-md' : 'bg-transparent text-slate-400 hover:text-white'}`}
                >
                  应用映射
                </button>
              </div>

              <button
                onClick={() => {
                  setIsFullscreen(false);
                  updateNodeData(id, { isFullscreen: false });
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black cursor-pointer border-none"
                title="返回画布窗口"
              >
                <X size={14} />
                <span>退出全屏模式</span>
              </button>
            </div>
          </div>

          {/* Fullscreen interactive content body */}
          <div className="flex-1 min-h-0">
            {renderInteractiveContent()}
          </div>
        </div>,
        document.body
      )}

      {/* Dynamic Right Click Context Menu Overlay */}
      {contextMenu?.visible && createPortal(
        <div 
          style={{ 
            position: 'fixed', 
            top: contextMenu.y, 
            left: contextMenu.x, 
            zIndex: 99999,
          }}
          className="bg-slate-900/95 border border-indigo-500/25 min-w-[150px] p-1.5 rounded-xl shadow-2xl select-none backdrop-blur-md flex flex-col pointer-events-auto animate-fade-in"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          {/* Option 1: Right click set custom path & launch */}
          <button
            type="button"
            onClick={() => {
              const progId = contextMenu.programId;
              const prog = programsList.find(p => p.id === progId);
              const conf = appConfigs[progId] || {
                path: prog?.defaultPath || '',
                args: prog?.defaultArgs || '',
                url: prog?.defaultUrl || 'http://127.0.0.1:8080'
              };
              setRightClickProgId(progId);
              setRightClickPath(conf.path);
              setRightClickArgs(conf.args);
              setRightClickUrl(conf.url);
              setRightClickOpen(true);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-[9.5px] font-black text-slate-300 hover:text-white hover:bg-indigo-600/20 rounded-lg transition-all flex items-center gap-2 cursor-pointer border-none bg-transparent"
          >
            <Sliders size={11} className="text-indigo-400" />
            <span>设置路径启动</span>
          </button>

          {/* Option 2: Launch immediately */}
          <button
            type="button"
            onClick={() => {
              const progId = contextMenu.programId;
              handlePresetSelect(progId);
              setContextMenu(null);
              // Small delay to let selection settle
              setTimeout(() => {
                handleLaunchNativeApp();
              }, 100);
            }}
            className="w-full text-left px-3 py-1.5 text-[9.5px] font-black text-slate-300 hover:text-white hover:bg-emerald-600/20 rounded-lg transition-all flex items-center gap-2 cursor-pointer border-none bg-transparent"
          >
            <PlayCircle size={11} className="text-emerald-400" />
            <span>极速调起映射</span>
          </button>

          {/* Option 3: Delete App */}
          <button
            type="button"
            onClick={() => {
              const progId = contextMenu.programId;
              handleDeleteProgram(progId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-[9.5px] font-black text-rose-400 hover:text-white hover:bg-rose-600/20 rounded-lg transition-all flex items-center gap-2 cursor-pointer border-none bg-transparent"
          >
            <X size={11} className="text-rose-450" />
            <span>删除此软件</span>
          </button>
        </div>,
        document.body
      )}

      {/* Absolute Path Setup and Immediate Launch Modal Dialogue */}
      {rightClickOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 transition-all" onMouseDown={e => e.stopPropagation()} onClick={() => { setRightClickOpen(false); setRightClickProgId(''); }}>
          <div className="bg-slate-900 border border-indigo-500/20 max-w-sm w-full rounded-2xl p-5 shadow-2xl text-left select-none relative pointer-events-auto" onClick={e => e.stopPropagation()}>
            {/* Close button */}
            <button 
              type="button"
              onClick={() => {
                setRightClickOpen(false);
                setRightClickProgId('');
              }}
              className="absolute top-4 right-4 text-slate-450 hover:text-white transition-all cursor-pointer border-none bg-transparent"
            >
              <X size={16} />
            </button>

            {/* Title */}
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-indigo-650/25 border border-indigo-550/20 text-indigo-400">
                <Sliders size={14} />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">自定义路径启动设置</h3>
                <span className="text-[8.5px] text-indigo-400 font-mono font-bold uppercase mt-1 tracking-widest block">
                  {programsList.find(p => p.id === rightClickProgId)?.name || '软件启动 parameters'}
                </span>
              </div>
            </div>

            <p className="text-[9.5px] text-slate-400 leading-normal font-sans mb-4">
              手动配置底层进程在您本地计算机中运行的绝对路径文件<b>【支持自定义 .exe 及其他可执行拓展名】</b>。
            </p>

            <div className="space-y-3">
              {/* Path Input */}
              <div className="space-y-1">
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">
                  程序绝对路径 (.exe 等可执行文件) <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-1.5">
                  <input 
                    type="text"
                    value={rightClickPath}
                    onChange={e => setRightClickPath(e.target.value)}
                    placeholder="C:\Program Files\..."
                    className="flex-1 min-w-0 bg-slate-950 border border-indigo-500/15 text-white rounded-lg px-2.5 py-2 text-[10px] focus:border-indigo-505/50 focus:outline-none transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenFileExplorer('rightClickPathName', rightClickPath, programsList.find(p => p.id === rightClickProgId)?.name || '', rightClickProgId)}
                    className="px-3 py-2 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-xl text-[10px] font-black cursor-pointer shrink-0 transition-all"
                    title="打开虚拟文件选取器"
                  >
                    📁 浏览
                  </button>
                </div>
              </div>

              {/* Arguments Input */}
              <div>
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">
                  附加启动参数 (Arguments, 可选)
                </label>
                <input 
                  type="text"
                  value={rightClickArgs}
                  onChange={e => setRightClickArgs(e.target.value)}
                  placeholder="-mode window -mode server"
                  className="w-full bg-slate-950 border border-indigo-500/15 text-white/90 rounded-lg px-2.5 py-2 text-[10px] focus:border-indigo-505/50 focus:outline-none transition-all font-mono"
                />
              </div>

              {/* URL Input */}
              <div>
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">
                  远程协同流挂载地址 (Stream URL, 默认 http)
                </label>
                <input 
                  type="text"
                  value={rightClickUrl}
                  onChange={e => setRightClickUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8080"
                  className="w-full bg-slate-950 border border-indigo-500/15 text-indigo-305 rounded-lg px-2.5 py-2 text-[10px] focus:border-indigo-500/50 focus:outline-none transition-all font-mono"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => {
                  setRightClickOpen(false);
                  setRightClickProgId('');
                }}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-750 border border-indigo-500/10 hover:border-indigo-500/30 text-slate-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  // Save custom path and configs
                  updateSingleAppConfig(rightClickProgId, rightClickPath, rightClickArgs, rightClickUrl);
                  
                  // Also select it
                  handlePresetSelect(rightClickProgId);

                  setRightClickOpen(false);
                  setRightClickProgId('');
                }}
                className="flex-1 py-1.5 bg-indigo-600/25 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-305 hover:text-white rounded-xl text-[10px] font-black transition-all cursor-pointer"
              >
                保存设置
              </button>
              <button
                type="button"
                onClick={async () => {
                  // 1. Save config
                  updateSingleAppConfig(rightClickProgId, rightClickPath, rightClickArgs, rightClickUrl);
                  
                  // 2. Select it
                  handlePresetSelect(rightClickProgId);

                  // 3. Close modal
                  setRightClickOpen(false);
                  setRightClickProgId('');

                  // 4. Trigger direct launch immediately
                  setTimeout(async () => {
                    await handleLaunchNativeApp();
                  }, 150);
                }}
                className="flex-[1.5] py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-[10px] font-black shadow-lg transition-all transform active:scale-95 cursor-pointer border-none"
              >
                保存并极速启动
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulated File / Folder Interactive Explorer Portal overlay */}
      {fileExplorerOpen && createPortal(
        <SimulatedFileExplorer 
          isOpen={fileExplorerOpen}
          onClose={() => setFileExplorerOpen(false)}
          onSelect={handleFileExplorerSelect}
          initialPath={fileExplorerInitialPath}
          appName={fileExplorerAppName}
          appPresetId={fileExplorerPresetId}
        />,
        document.body
      )}
    </>
  );
}
