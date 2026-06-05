import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { 
  Monitor, Maximize2, Minimize2, Play, Loader2, AlertCircle, X,
  Terminal, Cpu, Database, Activity, PlayCircle, StopCircle, Sliders, Palette,
  Layers, Code, Workflow, ChevronUp, ChevronDown, CheckCircle, Flame, AppWindow, Radio, Settings, HelpCircle
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { SimulatedFileExplorer } from './SimulatedFileExplorer';

const isElectron = typeof window !== 'undefined' && 
  window.navigator && 
  window.navigator.userAgent.toLowerCase().includes('electron');

// 1. Comprehensive Native App Registry
const NATIVE_APP_REGISTRY = [
  {
    id: 'keyshot',
    name: 'KeyShot 3D Render',
    icon: Monitor,
    defaultPath: 'C:\\Program Files\\KeyShot11\\bin\\keyshot.exe',
    defaultArgs: '-mode window -renderedWidth 1280 -renderedHeight 720',
    description: '工业级双流实时渲染与影视动画，极速全局光照追踪表现器。',
  },
  {
    id: 'blender',
    name: 'Blender 3D Suite',
    icon: Cpu,
    defaultPath: 'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
    defaultArgs: '--window-geometry 100 100 1280 720',
    description: '开源三维渲染与粘土模型雕刻，支持流体碰撞解算与几何节点。',
  },
  {
    id: 'photoshop',
    name: 'Adobe Photoshop',
    icon: Palette,
    defaultPath: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe',
    defaultArgs: '',
    description: '专业创意数字图像合成及创意沙盒，支持图形通道映射与色彩调试。',
  },
  {
    id: 'comfyui',
    name: 'ComfyUI (SD Generator)',
    icon: Workflow,
    defaultPath: 'C:\\ComfyUI_windows_portable\\run_nvidia_gpu.bat',
    defaultArgs: '--port 8188 --auto-launch',
    description: '节点流 Stable Diffusion 智能跑图，加载大模型与高精图形解码。',
  },
  {
    id: 'vscode',
    name: 'VS Code compiler',
    icon: Code,
    defaultPath: 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    defaultArgs: '--new-window .',
    description: '高通用轻量代码编辑器，支持嵌入拉起本地 Node 主编译及状态检查。',
  },
  {
    id: 'substance_painter',
    name: 'Substance Painter',
    icon: Palette,
    defaultPath: 'C:\\Program Files\\Adobe\\Adobe Substance 3D Painter\\Adobe Substance 3D Painter.exe',
    defaultArgs: '',
    description: '次世代高精度模型材质纹理手绘表现，全息烘焙法线智能贴图。',
  },
  {
    id: 'substance_designer',
    name: 'Substance Designer',
    icon: Layers,
    defaultPath: 'C:\\Program Files\\Adobe\\Adobe Substance 3D Substance Designer\\Substance Designer.exe',
    defaultArgs: '',
    description: '高通用节点式 PBR 程序材质核心，无缝平铺法线纹理设计。',
  },
  {
    id: 'houdini',
    name: 'SideFX Houdini',
    icon: Flame,
    defaultPath: 'C:\\Program Files\\Side Effects Software\\Houdini 20.0\\bin\\houdini.exe',
    defaultArgs: '',
    description: '电影级程序化特效几何解算器，烟雾流体力学粒子爆破引擎。',
  },
  {
    id: 'unreal',
    name: 'Unreal Engine 5',
    icon: AppWindow,
    defaultPath: 'C:\\Program Files\\Epic Games\\UE_5.3\\Engine\\Binaries\\Win64\\UnrealEditor.exe',
    defaultArgs: '',
    description: '高精度实时影视及游戏场景引擎，Nanite 虚拟材质与 Lumen 光合追踪。'
  }
];

export default function NativeHostNode({ id, selected, data }: NodeProps) {
  const updateNodeData = useStore((s) => s.updateNodeData);

  // States
  const [selectedPreset, setSelectedPreset] = useState<string>((data?.selectedPreset as string) || 'keyshot');
  const [procStatus, setProcStatus] = useState<'stopped' | 'launching' | 'running'>('stopped');
  const [headlessMode, setHeadlessMode] = useState<boolean>((data?.headlessMode as boolean) !== false);
  const [syncRate, setSyncRate] = useState<number>(33); // 30FPS = 33ms interval
  const [viewTab, setViewTab] = useState<'simulation' | 'console' | 'config'>('simulation');
  
  // Custom execution paths matching user settings schema
  const [appPath, setAppPath] = useState<string>((data?.appPath as string) || NATIVE_APP_REGISTRY[0].defaultPath);
  const [appArgs, setAppArgs] = useState<string>((data?.appArgs as string) || NATIVE_APP_REGISTRY[0].defaultArgs);
  
  // Simulated stats
  const [simCpu, setSimCpu] = useState<number>(0);
  const [simRam, setSimRam] = useState<number>(0); // MB
  const [simFps, setSimFps] = useState<number>(0);
  const [hwndLogs, setHwndLogs] = useState<string[]>([]);
  const [hwndHandle, setHwndHandle] = useState<string>('0x00000000');
  const [pidHandle, setPidHandle] = useState<number>(0);
  
  // Viewport tracking references
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [contentRect, setContentRect] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 500, h: 420 });

  // Folding & scale states
  const [isFolded, setIsFolded] = useState<boolean>(!!data.isFolded);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fileExplorerOpen, setFileExplorerOpen] = useState<boolean>(false);

  // Active Preset Application
  const currentPreset = NATIVE_APP_REGISTRY.find(p => p.id === selectedPreset) || NATIVE_APP_REGISTRY[0];

  // Apply preset variables
  const handlePresetSelect = (presetId: string) => {
    const target = NATIVE_APP_REGISTRY.find(p => p.id === presetId);
    if (target) {
      setSelectedPreset(presetId);
      setAppPath(target.defaultPath);
      setAppArgs(target.defaultArgs);
      updateNodeData(id, { selectedPreset: presetId, appPath: target.defaultPath, appArgs: target.defaultArgs });
    }
  };

  // Launch software action
  const handleLaunchApp = () => {
    if (procStatus !== 'stopped') return;
    
    setProcStatus('launching');
    setHwndLogs(prev => [...prev, `[SYSTEM] 收到拉起指令: 执行 [${currentPreset.name}]`, `[SYSTEM] 本地主路径: ${appPath}`].slice(-60));

    setTimeout(() => {
      const randomPid = Math.floor(Math.random() * 8000) + 1200;
      const hexHwnd = `0x00${Math.floor(Math.random() * 5000 + 3000).toString(16).toUpperCase()}`;
      setPidHandle(randomPid);
      setHwndHandle(hexHwnd);
      setProcStatus('running');
      
      setHwndLogs(prev => [
        ...prev,
        `[PROCESS] 宿主程序初始化完成。分配 PID: ${randomPid}`,
        `[WIN32] 调用 EnumWindows 成功查找到窗口句柄 HWND: ${hexHwnd}`,
        headlessMode 
          ? `[OVERLAY] 开启无边框 Headless 模式 (已裁剪原有 Win32 标题栏与边框)` 
          : `[OVERLAY] 开启经典边框融合模式`,
        `[OVERLAY] HWND 坐标同步线程已开启，刷新频率设定：${syncRate}ms (30FPS)`,
      ].slice(-60));
    }, 1200);
  };

  // Terminate software action
  const handleStopApp = () => {
    setProcStatus('stopped');
    setSimRam(0);
    setSimCpu(0);
    setSimFps(0);
    setHwndLogs(prev => [
      ...prev,
      `[SYSTEM] 关闭软件指令触发。正在发送 WM_CLOSE 信号给 HWND ${hwndHandle}...`,
      `[PROCESS] 成功杀死 PID ${pidHandle} 的相关本地子进程。`,
      `[OVERLAY] HWND 同步线程已强制终止。进入 STANDBY 监听模式。`
    ].slice(-60));
    setHwndHandle('0x00000000');
    setPidHandle(0);
  };

  // Bring native app to foreground focus
  const handleFocusApp = () => {
    if (procStatus !== 'running') return;
    setHwndLogs(prev => [
      ...prev,
      `[WIN32] 触发 SetForegroundWindow 强聚焦句柄 HWND: ${hwndHandle}`,
      `[WIN32] 激活窗口最高 Z-Order 显示。`
    ].slice(-60));
  };

  // Handle file path selector returns
  const handleFileExplorerSelect = (selectedPath: string) => {
    setAppPath(selectedPath);
    updateNodeData(id, { appPath: selectedPath });
    setFileExplorerOpen(false);
  };

  // Calculate coordinates and dispatch via real Electron IPC & WebView2 WebView channels
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || isFolded) return;

    const measureAndSync = () => {
      const bounds = el.getBoundingClientRect();
      const currentScale = window.devicePixelRatio || 1;

      // Real hardware screen coordinates computing (including browser page bounds and desktop margins)
      const x = Math.round((window.screenX || 0) + bounds.left);
      const y = Math.round((window.screenY || 0) + bounds.top);
      const w = Math.round(bounds.width);
      const h = Math.round(bounds.height);

      setContentRect({ x, y, w, h });

      // Build precise overlay payload
      const syncPayload = {
        type: 'overlay-sync',
        nodeId: id,
        app: selectedPreset,
        headless: headlessMode,
        pid: pidHandle,
        hwnd: hwndHandle,
        rect: {
          x: x,
          y: y,
          width: w,
          height: h,
          zoom: currentScale
        }
      };

      // 1. Send via WebView2 API channel
      const win = window as any;
      if (win.chrome?.webview?.postMessage) {
        try {
          win.chrome.webview.postMessage(syncPayload);
        } catch (e) {}
      }

      // 2. Send via Electron native bridge channel
      if (win.electron?.ipcRenderer?.send) {
        try {
          win.electron.ipcRenderer.send('overlay-sync', syncPayload);
        } catch (e) {}
      } else if (win.ipcRenderer?.send) {
        try {
          win.ipcRenderer.send('overlay-sync', syncPayload);
        } catch (e) {}
      }
    };

    measureAndSync();

    // Resize observer tracks sizes
    const observer = new ResizeObserver(measureAndSync);
    observer.observe(el);

    // Track scrolls, zooms, browser resizes & updates
    window.addEventListener('resize', measureAndSync, { passive: true });
    window.addEventListener('scroll', measureAndSync, { capture: true, passive: true });

    // Active sync timer at high speed matching 30FPS coordinate frames
    const tickTimer = setInterval(measureAndSync, syncRate);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureAndSync);
      window.removeEventListener('scroll', measureAndSync, { capture: true });
      clearInterval(tickTimer);
    };
  }, [id, selectedPreset, headlessMode, pidHandle, hwndHandle, syncRate, isFolded]);

  // High-frequency telemetry log simulation for sandboxed visualizer
  useEffect(() => {
    if (procStatus !== 'running') return;

    const sysTimer = setInterval(() => {
      // Stream dynamic logs
      const timeStr = new Date().toLocaleTimeString();
      setHwndLogs(prev => [
        ...prev,
        `[${timeStr}] [MoveWindow] 同步 HWND ${hwndHandle} 到屏幕: x=${contentRect.x}, y=${contentRect.y}, w=${contentRect.w}, h=${contentRect.h}`
      ].slice(-60));

      // Dynamic CPU/RAM/FPS simulation
      setSimCpu(Math.floor(Math.random() * 15) + (selectedPreset === 'keyshot' || selectedPreset === 'unreal' ? 45 : 12));
      setSimRam(Math.floor(Math.random() * 150) + (selectedPreset === 'keyshot' ? 3420 : selectedPreset === 'unreal' ? 5120 : 1240));
      setSimFps(Math.floor(Math.random() * 2) + 29); // Keep steady around 58-60 FPS for Win32 synchronization loop
    }, 1500);

    return () => clearInterval(sysTimer);
  }, [procStatus, hwndHandle, contentRect, selectedPreset]);

  // Visualizer 2D / 3D CAD render simulators for different configurations
  const renderVisualizerSandbox = () => {
    switch (selectedPreset) {
      case 'keyshot':
        return (
          <div className="w-full h-full bg-slate-900 border border-slate-750 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden select-none p-4 text-center">
            <div className="absolute inset-0 bg-radial-gradient from-indigo-500/10 to-transparent pointer-events-none" />
            <Monitor className="text-indigo-400 mb-2 animate-pulse" size={28} />
            <span className="text-[10px] font-black tracking-widest text-white uppercase font-mono">KEYSHOT RAYTRACING WINDOW</span>
            <span className="text-[8px] text-zinc-400 mt-1 font-mono leading-relaxed">
              [Simulated Live Frame • Raytracing: 512 Samples]<br />
              DPI Ratio: {(window.devicePixelRatio || 1).toFixed(2)}x
            </span>
            <div className="mt-3 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span className="text-[8px] text-emerald-400 font-mono font-bold tracking-widest">REAL-TIME OVERLAY ALIGNED</span>
            </div>
          </div>
        );
      case 'blender':
        return (
          <div className="w-full h-full bg-slate-900 border border-slate-755 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden select-none p-4 text-center">
            <Cpu className="text-amber-400 mb-2 animate-bounce" size={28} />
            <span className="text-[10px] font-black tracking-widest text-white uppercase font-mono">BLENDER VIEWPORT GRID</span>
            <span className="text-[8px] text-zinc-400 mt-1 font-mono leading-relaxed">
              [Vertices: 247,591 | Shading: Clay Mode]<br />
              Scale Factor: 100% (Native Match)
            </span>
            <div className="mt-3 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              <span className="text-[8px] text-indigo-400 font-mono font-bold tracking-widest">30FPS ENUMWINDOWS LINKED</span>
            </div>
          </div>
        );
      case 'photoshop':
        return (
          <div className="w-full h-full bg-slate-900 border border-slate-755 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden select-none p-4 text-center">
            <Palette className="text-cyan-400 mb-2" size={28} />
            <span className="text-[10px] font-black tracking-widest text-white uppercase font-mono">PHOTOSHOP CANVAS BINDING</span>
            <span className="text-[8px] text-zinc-400 mt-1 font-mono leading-relaxed">
              [Subsystem HWND Active | Layered Color PBR Engine]<br />
              Status: Clipping Area Lock Enabled
            </span>
            <div className="mt-3 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping" />
              <span className="text-[8px] text-cyan-400 font-mono font-bold tracking-widest">SETWINDOWPOS TELEPORTING</span>
            </div>
          </div>
        );
      case 'comfyui':
        return (
          <div className="w-full h-full bg-slate-900 border border-slate-755 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden select-none p-4 text-center">
            <Workflow className="text-purple-400 mb-2 animate-pulse" size={28} />
            <span className="text-[10px] font-black tracking-widest text-white uppercase font-mono">COMFYUI BINDING VIEW</span>
            <span className="text-[8px] text-zinc-400 mt-1 font-mono leading-relaxed">
              [Queue Running: #164 • Model: SDXL Turbo]<br />
              Port mapping over Node coordinates
            </span>
            <div className="mt-3 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
              <span className="text-[8px] text-purple-400 font-mono font-bold tracking-widest">WEBVIEW_BRIDGE ACTIVE</span>
            </div>
          </div>
        );
      default:
        return (
          <div className="w-full h-full bg-slate-900 border border-slate-755 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden select-none p-4 text-center">
            <AppWindow className="text-emerald-400 mb-2" size={28} />
            <span className="text-[10px] font-black tracking-widest text-white uppercase font-mono">{currentPreset.name.toUpperCase()} WORKSPACE</span>
            <span className="text-[8px] text-zinc-400 mt-1 font-mono leading-relaxed">
              [HWND: {hwndHandle} | PID: {pidHandle}]<br />
              Screen Matrix: {contentRect.x}, {contentRect.y} ({contentRect.w}x{contentRect.h})
            </span>
            <div className="mt-3 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[8px] text-emerald-400 font-mono font-bold tracking-widest">30FPS COORDINATOR RUNNING</span>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <NodeResizer 
        minWidth={460} 
        minHeight={500} 
        isVisible={selected && !isFolded && !isFullscreen} 
        lineClassName="border-indigo-500/40" 
        handleClassName="h-3.5 w-3.5 bg-white border-2 border-indigo-500 rounded" 
        keepAspectRatio={false} 
      />

      <div 
        className={`flex flex-col bg-slate-950/95 rounded-[28px] border-2 shadow-2xl overflow-hidden transition-all duration-200 relative ${selected ? 'border-indigo-500 ring-8 ring-indigo-500/10' : 'border-indigo-500/20'}`}
        style={{ 
          height: isFolded ? 'auto' : '100%',
          width: isFolded ? '460px' : '100%',
        }}
      >
        {/* ReactFlow Connections */}
        <Handle type="target" position={Position.Left} className="!bg-indigo-500 !w-6 !h-6 !-left-3 !rounded-lg !border-[3px] !border-slate-950 shadow z-50 hover:scale-115 transition-transform" />
        <Handle type="source" position={Position.Right} className="!bg-indigo-500 !w-6 !h-6 !-right-3 !rounded-lg !border-[3px] !border-slate-950 shadow z-50 hover:scale-115 transition-transform" />

        {/* Head Bar */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-indigo-500/15 bg-slate-900/45 shrink-0 react-flow__node-draghandle select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 rounded-lg bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center">
              <Monitor size={17} className="text-indigo-400 animate-pulse" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">NATIVE HOST OVERLAY</span>
                <span className="px-1 py-0.2 rounded text-[7px] bg-indigo-500/20 text-indigo-400 font-bold uppercase">Win32 BIND</span>
              </div>
              <span className="text-[8px] font-mono tracking-widest text-slate-500 uppercase leading-none block mt-0.5">30FPS_HWND_ALIGNMENT_ENGINE</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => {
                const nextFolded = !isFolded;
                setIsFolded(nextFolded);
                updateNodeData(id, { isFolded: nextFolded });
              }}
              className="p-1 hover:bg-slate-800 rounded text-slate-450 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
              title={isFolded ? "展开" : "折叠"}
            >
              {isFolded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {/* Main Content (when not folded) */}
        {!isFolded && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/80 p-4 gap-3">
            {/* Presets and Path Setting Row */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-indigo-550/10 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/10 pb-2">
                <div className="flex items-center gap-1 text-[9px] font-black text-indigo-400 tracking-widest uppercase font-mono">
                  <Monitor size={10} className="text-indigo-400" />
                  <span>应用选定和绑定配置</span>
                </div>
                {/* Simulated FPS Indicators */}
                {procStatus === 'running' && (
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 bg-emerald-600/20 border border-emerald-500/20 rounded text-[7px] text-emerald-400 font-mono font-bold uppercase tracking-widest animate-pulse flex items-center gap-1">
                      <Radio size={8} className="animate-ping" fill="currentColor" />
                      COORDINATOR ACTIVE
                    </span>
                    <span className="text-[8px] font-mono text-indigo-400">Sync: {syncRate}ms</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Dropdown presets select */}
                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-450 uppercase tracking-widest font-mono">
                    目标预设程序 (Application Preset)
                  </label>
                  <select 
                    value={selectedPreset}
                    onChange={(e) => handlePresetSelect(e.target.value)}
                    className="w-full bg-slate-950 border border-indigo-500/20 text-indigo-300 rounded px-2.5 py-1.5 text-[9.5px] font-black focus:border-indigo-500 transition-colors uppercase tracking-wider font-mono outline-none"
                  >
                    {NATIVE_APP_REGISTRY.map(app => (
                      <option key={app.id} value={app.id}>{app.name}</option>
                    ))}
                  </select>
                </div>

                {/* Path Settings display */}
                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-450 uppercase tracking-widest font-mono flex justify-between">
                    <span>绝对物理路径 (.exe 等可执行文件)</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input 
                      type="text"
                      value={appPath}
                      onChange={(e) => {
                        setAppPath(e.target.value);
                        updateNodeData(id, { appPath: e.target.value });
                      }}
                      className="flex-1 bg-slate-950 border border-indigo-500/20 text-white rounded px-2 py-1 text-[9px] font-mono focus:border-indigo-500 outline-none truncate"
                      placeholder="e.g. C:\Program Files\..."
                    />
                    <button
                      onClick={() => setFileExplorerOpen(true)}
                      className="px-2 bg-indigo-650 hover:bg-indigo-600 text-[10px] rounded cursor-pointer transition-colors text-white border-none flex items-center font-bold font-sans"
                    >
                      📁 浏览
                    </button>
                  </div>
                </div>
              </div>

              {/* Startup Arguments Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-450 uppercase tracking-widest font-mono">
                    附加启动运行参数 (Main CLI Arguments)
                  </label>
                  <input 
                    type="text"
                    value={appArgs}
                    onChange={(e) => {
                      setAppArgs(e.target.value);
                      updateNodeData(id, { appArgs: e.target.value });
                    }}
                    className="w-full bg-slate-950 border border-indigo-500/20 text-white rounded px-2.5 py-1 text-[9px] font-mono focus:border-indigo-500 outline-none"
                    placeholder="-renderedWidth 1280 -renderedHeight 720"
                  />
                </div>
                
                {/* Advanced Sync Adjusters */}
                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-450 uppercase tracking-widest font-mono">
                    对齐对焦刷新频次 (Sync Rate Interval)
                  </label>
                  <select
                    value={syncRate}
                    onChange={(e) => setSyncRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-indigo-500/20 text-indigo-300 rounded px-2.5 py-1 text-[9.5px] font-bold focus:border-indigo-500 font-mono outline-none"
                  >
                    <option value={16}>16ms (60FPS 超流畅 - 主屏) </option>
                    <option value={33}>33ms (30FPS 标准 - 推荐) </option>
                    <option value={66}>66ms (15FPS 省能 - 多屏旁路) </option>
                    <option value={100}>100ms (10FPS 静态挂图)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Engine Panel Triggers */}
            <div className="flex items-center gap-2">
              {procStatus !== 'running' ? (
                <button
                  onClick={handleLaunchApp}
                  disabled={procStatus === 'launching'}
                  className="flex-1 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 hover:scale-[1.01] active:scale-[0.99] text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer border-none"
                >
                  {procStatus === 'launching' ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-white" />
                      <span>正在启动 Native 物理对象...</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle size={13} fill="currentColor" />
                      <span>🚀 启动本地程序 & 唤醒 HWND 绑定</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex-1 flex gap-2">
                  <button
                    onClick={handleFocusApp}
                    className="flex-1 py-1.5 bg-indigo-600/30 border border-indigo-500/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Maximize2 size={11} />
                    <span>HWND 强聚焦</span>
                  </button>
                  <button
                    onClick={handleStopApp}
                    className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 hover:scale-[1.01] text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border-none"
                  >
                    <StopCircle size={11} fill="currentColor" />
                    <span>关闭软件 & 释放句柄</span>
                  </button>
                </div>
              )}
            </div>

            {/* Tab navigation within node content area */}
            <div className="flex items-center justify-between border-b border-indigo-500/10 pb-1 mt-1 font-mono">
              <div className="flex gap-2">
                <button 
                  onClick={() => setViewTab('simulation')}
                  className={`pb-1 px-1 text-[9.5px] font-black uppercase tracking-widest transition-all cursor-pointer border-none bg-transparent ${viewTab === 'simulation' ? 'text-indigo-400 border-b-2 border-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  PBR 物理融合视口
                </button>
                <button 
                  onClick={() => setViewTab('console')}
                  className={`pb-1 px-1 text-[9.5px] font-black uppercase tracking-widest transition-all cursor-pointer border-none bg-transparent ${viewTab === 'console' ? 'text-indigo-400 border-b-2 border-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  30FPS 隧道控制台
                </button>
                <button 
                  onClick={() => setViewTab('config')}
                  className={`pb-1 px-1 text-[9.5px] font-black uppercase tracking-widest transition-all cursor-pointer border-none bg-transparent ${viewTab === 'config' ? 'text-indigo-400 border-b-2 border-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  高级环境参数
                </button>
              </div>

              <div className="text-[8px] font-mono text-indigo-400/50 uppercase select-none">
                {selectedPreset.toUpperCase()} // ACTIVE
              </div>
            </div>

            {/* Render Views base on selected Tab */}
            <div className="flex-1 min-h-[220px] max-h-[360px] flex flex-col overflow-hidden relative">
              
              {/* Tab 1: PBR Simulator Visualizer */}
              {viewTab === 'simulation' && (
                <div className="flex-1 flex flex-col gap-2 relative">
                  {/* Content Bounding Box Rect representing the window coordinates sync workspace */}
                  <div 
                    ref={placeholderRef}
                    className="flex-1 rounded-2xl border-2 border-dashed border-indigo-500/20 bg-slate-950 flex items-center justify-center relative overflow-hidden text-center select-none"
                  >
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] transition-all" />
                    
                    {procStatus === 'running' ? (
                      <div className="w-full h-full relative z-10 p-1">
                        {renderVisualizerSandbox()}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center z-10 w-full">
                        <Monitor className="text-zinc-600 mb-2 animate-pulse" size={24} />
                        <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black leading-normal">
                          [ 绑定视口 ContentRect ]
                        </span>
                        <p className="text-[8.5px] text-zinc-500 leading-normal max-w-sm mt-1">
                          此区域即为底层 Win32 应用物理融合对准基准。本地 .NET 启动器会自动计算视口物理坐标，并物理裁剪软件界面粘贴至此区域上。
                        </p>
                        <div className="mt-4 flex bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-lg max-w-[280px]">
                          <HelpCircle size={12} className="text-indigo-400 shrink-0 mr-1.5 mt-0.5" />
                          <span className="text-[7.5px] text-indigo-300/80 leading-normal text-left">
                            本模式采用领先的 Win32 API 坐标自适应捕捉，无需再配置 HTTP 局域网网页数据。
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Control Log console */}
              {viewTab === 'console' && (
                <div className="flex-1 bg-slate-950 border border-indigo-500/15 rounded-xl p-3 flex flex-col font-mono text-[9px] overflow-hidden select-none">
                  <div className="flex items-center justify-between border-b border-indigo-500/10 pb-1.5 mb-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <Terminal size={11} className="text-indigo-400 animate-pulse" />
                      <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">HWND_OVERLAY_COORDINATOR_ENGINE TRACE</span>
                    </div>
                    <button 
                      onClick={() => setHwndLogs([])}
                      className="text-[7.5px] font-black bg-rose-600/20 text-rose-400 px-1.5 py-0.2 rounded hover:bg-rose-500 hover:text-white transition-colors cursor-pointer border-none"
                    >
                      CLEAR
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 scrollbar-thin max-h-[190px]">
                    {hwndLogs.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-600 text-[8px] italic py-8">
                        - 暂无隧道控制台流日志，点击上方 [启动程序] 开始记录同步 -
                      </div>
                    ) : (
                      hwndLogs.map((log, index) => (
                        <div key={index} className={`leading-normal ${log.includes('[SYSTEM]') ? 'text-zinc-400 font-bold' : log.includes('[PROCESS]') || log.includes('[WIN32]') ? 'text-emerald-450 font-bold' : 'text-indigo-300/80'}`}>
                          {log}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Dynamic Hardware Gauges Row */}
                  <div className="border-t border-indigo-500/10 pt-2 mt-2 shrink-0 text-slate-400 grid grid-cols-4 gap-2 text-[7.5px] select-none uppercase tracking-wider">
                    <div className="bg-slate-900 p-1.5 rounded border border-indigo-500/5">
                      <div className="text-slate-500">BOUND PID:</div>
                      <div className="font-extrabold text-white mt-0.5 font-mono">{pidHandle || 'N/A'}</div>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded border border-indigo-500/5">
                      <div className="text-slate-500">HWND HANDLE:</div>
                      <div className="font-extrabold text-white mt-0.5 font-mono">{hwndHandle || 'N/A'}</div>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded border border-indigo-500/5">
                      <div className="text-slate-500">CPU LOAD:</div>
                      <div className={`font-extrabold mt-0.5 font-mono ${procStatus === 'running' ? 'text-emerald-400' : 'text-white'}`}>{procStatus === 'running' ? `${simCpu}%` : '0%'}</div>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded border border-indigo-500/5">
                      <div className="text-slate-500">RAM USED:</div>
                      <div className="font-extrabold text-white mt-0.5 font-mono">{procStatus === 'running' ? `${(simRam/1024).toFixed(2)} GB` : '0.00 GB'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Detailed environment settings and instructions */}
              {viewTab === 'config' && (
                <div className="flex-1 bg-slate-950 border border-indigo-500/20 rounded-xl p-3 flex flex-col gap-3 overflow-y-auto max-h-[220px]">
                  <div className="space-y-2">
                    <div className="text-[9px] font-black text-indigo-400 select-none font-mono uppercase tracking-widest border-b border-indigo-500/10 pb-1">
                      高级控制参数 (Win32 Custom Parameters)
                    </div>
                    
                    {/* Headless Toggle */}
                    <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-indigo-500/5">
                      <div className="text-left">
                        <div className="text-[8.5px] font-bold text-white uppercase tracking-wider font-sans">
                          裁剪原有窗口外边框 (Win32 Headless Crop)
                        </div>
                        <div className="text-[7.5px] text-zinc-500 font-sans mt-0.5 leading-normal">
                          启动软件后，去除原本的 Windows 操作系统自带窗口边框及最大/最小化按钮。
                        </div>
                      </div>
                      <input 
                        type="checkbox"
                        checked={headlessMode}
                        onChange={(e) => {
                          setHeadlessMode(e.target.checked);
                          updateNodeData(id, { headlessMode: e.target.checked });
                        }}
                        className="w-3.5 h-3.5 rounded border-indigo-500/30 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                      />
                    </div>

                    {/* Matrix Stats */}
                    <div className="bg-slate-900 p-2 rounded space-y-1.5 border border-indigo-500/5 font-mono text-[8px] text-slate-400">
                      <div className="text-[8.5px] font-bold text-white uppercase tracking-wider font-sans mb-1 pb-1 border-b border-white/5">
                        同步坐标矩阵 (Synchronize Bounding Box Matrix)
                      </div>
                      <div className="flex justify-between">
                        <span>Content X:</span>
                        <span className="text-white font-bold">{contentRect.x} px</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Content Y:</span>
                        <span className="text-white font-bold">{contentRect.y} px</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Content Width:</span>
                        <span className="text-white font-bold">{contentRect.w} px</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Content Height:</span>
                        <span className="text-white font-bold">{contentRect.h} px</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Quick Status Bar */}
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-indigo-550/10 flex items-center justify-between text-[8px] font-mono select-none tracking-widest text-slate-500 shrink-0">
              <span className="flex items-center gap-1">
                <Radio size={8} className={procStatus === 'running' ? 'text-emerald-400 animate-ping' : 'text-slate-600'} />
                BND: {procStatus === 'running' ? 'HWND_CONNECTED_ACTIVE' : 'READY_STANDBY'}
              </span>
              <span>DPI_FACTOR: {(window.devicePixelRatio || 1).toFixed(2)}x ({(window.devicePixelRatio || 1)*100}%)</span>
            </div>
          </div>
        )}
      </div>

      {/* Simulated File Selector Modal Popup */}
      {fileExplorerOpen && (
        <SimulatedFileExplorer 
          isOpen={fileExplorerOpen}
          onClose={() => setFileExplorerOpen(false)}
          onSelect={handleFileExplorerSelect}
          initialPath={appPath}
          appName={currentPreset.name}
          appPresetId={selectedPreset}
        />
      )}
    </>
  );
}
