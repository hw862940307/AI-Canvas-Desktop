import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  useOnViewportChange,
  SelectionMode,
  Node,
} from "@xyflow/react";
import { useStore, getFreshWf4Content } from "./store/useStore";
import { get, set as idbSet } from "idb-keyval";
import { TextNode } from "./components/TextNode";
import { ImageGenNode } from "./components/ImageGenNode";
import { TextGenNode } from "./components/TextGenNode";
import { SourceTextNode } from "./components/SourceTextNode";
import { SourceImageNode } from "./components/SourceImageNode";
import { PromptEngineNode } from "./components/PromptEngineNode";
import { FileManagerSidebar } from "./components/FileManagerSidebar";
import { AlignmentToolbar } from "./components/AlignmentToolbar";
import { generateTextWithFallback } from "./lib/gemini";
import {
  Plus,
  Image as ImageIcon,
  Type,
  Sparkles,
  Cpu,
  Palette,
  Trash2,
  Brain,
  Languages,
  Maximize,
  Download,
  FolderOpen,
  LayoutGrid,
  MessageSquare,
  Move3d,
  Globe2,
  Monitor,
  Images,
  ScanSearch,
  CloudLightning,
  History,
  Users,
  Share2,
  Coins,
  ChevronRight,
  Maximize2,
  Minimize2,
  Grid,
  Search,
  Paperclip,
  FileText,
  Mic,
  ArrowUp,
  X,
  Compass,
  Cloud,
  ChevronDown,
  Loader2,
  Settings,
  ChevronUp,
  Map as MapIcon,
  Keyboard,
  Copy,
  Undo2,
  Redo2,
  Box,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  MoreHorizontal,
  Check,
  LogOut,
  Pin,
  PinOff,
  Minus,
  ChevronLeft,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Database,
  Camera,
  FileJson,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { TranslateEngineNode } from "./components/TranslateEngineNode";
import { LogicEngineNode } from "./components/LogicEngineNode";
import FusionMasterNode from "./components/FusionMasterNode";
import { SpatialViewNode } from "./components/SpatialViewNode";
import { WebPreviewPanel } from "./components/AptWebToolNode";
import { ComfyuiPortNode } from "./components/ComfyuiPortNode";
import { WebScrapeNode, WebScreenshotNode, WebToTextNode } from "./components/WebActionNodes";
import NativeHostNode from "./components/NativeHostNode";
import { IoImageListNode } from "./components/IoImageListNode";
import { DoubleBoxTransformNode } from "./components/DoubleBoxTransformNode";
import { ReverseNode } from "./components/ReverseNode";
import { MsGenNode } from "./components/MsGenNode";
import { GroupNode } from "./components/GroupNode";
import { AIPsEngineNode } from "./components/AIPsEngineNode";

// Gemini initialization logic removed here, handled by getGenAI utility

const nodeTypes = {
  text: React.memo(TextNode),
  "image-gen": React.memo(ImageGenNode),
  "text-gen": React.memo(TextGenNode),
  "image-source": React.memo(SourceImageNode),
  "text-source": React.memo(SourceTextNode),
  "prompt-engine": React.memo(PromptEngineNode),
  "logic-engine": React.memo(LogicEngineNode),
  "translate-engine": React.memo(TranslateEngineNode),
  "fusion-master": React.memo(FusionMasterNode),
  "spatial-view": React.memo(SpatialViewNode),
  "comfyui-node": React.memo(ComfyuiPortNode),
  "web-scrape": React.memo(WebScrapeNode),
  "web-screenshot": React.memo(WebScreenshotNode),
  "web-to-text": React.memo(WebToTextNode),
  "native-host": React.memo(NativeHostNode),
  "io-image-list": React.memo(IoImageListNode),
  "double-box-transform": React.memo(DoubleBoxTransformNode),
  reverse: React.memo(ReverseNode),
  "ms-gen": React.memo(MsGenNode),
  "group-node": React.memo(GroupNode),
  "ai-ps-engine": React.memo(AIPsEngineNode),
};

function ZoomDisplay() {
  const [zoomLevel, setZoomLevel] = useState(1);
  useOnViewportChange({
    onChange: (viewport) => {
      setZoomLevel(viewport.zoom);
    },
  });

  return (
    <div className="flex items-center gap-3 px-3">
      <span className="text-sm font-bold text-gray-500 w-8">Zoom</span>
      <div className="w-24 h-1 bg-[#333] rounded-full relative overflow-hidden group/slider cursor-pointer">
        <div
          className="absolute left-0 top-0 h-full bg-accent transition-all duration-300"
          style={{
            width: `${Math.min(100, Math.max(0, ((zoomLevel - 0.05) / 3.95) * 100))}%`,
          }}
        />
      </div>
      <span className="text-sm font-bold text-gray-300">
        {(zoomLevel * 100).toFixed(0)}%
      </span>
    </div>
  );
}

const getNodeDimensions = (node: any) => {
  if (node.style?.width && node.style?.height) {
    const w = typeof node.style.width === "number" ? node.style.width : parseInt(node.style.width);
    const h = typeof node.style.height === "number" ? node.style.height : parseInt(node.style.height);
    if (!isNaN(w) && !isNaN(h)) {
      return { width: w, height: h };
    }
  }
  if (node.measured?.width && node.measured?.height) {
    return { width: node.measured.width, height: node.measured.height };
  }
  const type = node.type;
  switch (type) {
    case "fusion-master":
      return { width: 720, height: 950 };
    case "image-gen":
      return { width: 400, height: 600 };
    case "text-gen":
      return { width: 400, height: 500 };
    case "image-source":
      return { width: 300, height: 350 };
    case "text-source":
      return { width: 300, height: 350 };
    case "reverse":
      return { width: 320, height: 450 };
    case "double-box-transform":
      return { width: 680, height: 500 };
    case "ai-ps-engine":
      return { width: 880, height: 640 };
    case "translate-engine":
    case "logic-engine":
      return { width: 400, height: 500 };
    case "group-node":
      return {
        width: typeof node.style?.width === 'number' ? node.style.width : 500,
        height: typeof node.style?.height === 'number' ? node.style.height : 400,
      };
    default:
      return { width: 300, height: 400 };
  }
};

function FlowInner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExited, setIsExited] = useState(false);

  const [isLeftSidebarHovered, setIsLeftSidebarHovered] = useState(false);
  const isTopHeaderHovered = useStore(s => s.isTopVisible);
  const setIsTopHeaderHovered = useStore(s => s.setIsTopVisible);
  const [isBottomHovered, setIsBottomHovered] = useState(false);
  const [isBottomPinned, setIsBottomPinned] = useState(true);
  const [isAssistantHovered, setIsAssistantHovered] = useState(false);

  // Z Zoom Mode States
  const [isZMode, setIsZMode] = useState(false);
  const [isZDragging, setIsZDragging] = useState(false);
  const [activeZButton, setActiveZButton] = useState<number | null>(null);
  const [currentSlideDirection, setCurrentSlideDirection] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });

  const zDragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const zLastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zDragStartViewerScaleRef = useRef<number>(1);
  const zDragStartCanvasZoomRef = useRef<number>(1);
  const zKeyPressTimeRef = useRef<number>(0);
  const isZModeBeforeDownRef = useRef<boolean>(false);
  const zDragButtonRef = useRef<number>(-1);

  const {
    nodes,
    setNodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    clearCanvas,
    chatHistory,
    addChatMessage,
    setChatHistory,
    isGridVisible,
    isMiniMapVisible,
    toggleGrid,
    toggleMiniMap,
    showAssistant,
    toggleAssistant,
    showFileManager,
    toggleFileManager,
    fileManagerWidth,
    settings,
    updateSettings,
    copySelectedNodes,
    pasteNodes,
    copiedNodes,
    undo,
    redo,
    undoStack,
    redoStack,
    takeSnapshot,
    updateNodeData,
    files,
    groupSelectedNodes,
    ungroupNode,
  } = useStore();

  // Overwrite stale cached default settings in localStorage with latest full 30-node "Flux2+Klein单图编辑" preset configuration on startup
  useEffect(() => {
    if (settings && settings.apiSettings && settings.apiSettings.comfyWorkflowsDetails) {
      const details = settings.apiSettings.comfyWorkflowsDetails;
      const wf4 = details.find((w: any) => w.id === 'wf-4');
      if (wf4 && (!wf4.content || wf4.content.length < 5000)) {
        console.log("Healing workflow cache for 'Flux2+Klein单图编辑.json'...");
        const updatedDetails = details.map((w: any) => {
          if (w.id === 'wf-4') {
            return {
              ...w,
              size: "36 KB",
              content: getFreshWf4Content()
            };
          }
          return w;
        });
        updateSettings({
          apiSettings: {
            ...settings.apiSettings,
            comfyWorkflowsDetails: updatedDetails
          }
        });
      }
    }
  }, [settings, updateSettings]);

  // Sync history files with backend physical storage on startup
  useEffect(() => {
    fetch('/api/history-files')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          useStore.setState({ files: data });
        }
      })
      .catch(err => console.error('Failed to sync history files:', err));
  }, []);

  const mainContainerRef = useRef<HTMLDivElement>(null);
  
  // Custom High-Fidelity Fullscreen Image Viewer States
  const [viewerNodeId, setViewerNodeId] = useState<string | null>(null);
  const [viewerZoomScale, setViewerZoomScale] = useState(1);
  const [viewerZoomOffset, setViewerZoomOffset] = useState({ x: 0, y: 0 });
  const [viewerRotation, setViewerRotation] = useState(0);
  const [viewerShowMinimap, setViewerShowMinimap] = useState(true);
  const [viewerShowFilmstrip, setViewerShowFilmstrip] = useState(true);

  useEffect(() => {
    const handleOpenViewer = (e: any) => {
      const { nodeId } = e.detail;
      if (nodeId) {
        setViewerNodeId(nodeId);
        setViewerZoomScale(1);
        setViewerZoomOffset({ x: 0, y: 0 });
        setViewerRotation(0);
      }
    };
    window.addEventListener('open-image-viewer', handleOpenViewer as any);
    return () => {
      window.removeEventListener('open-image-viewer', handleOpenViewer as any);
    };
  }, []);

  const [cuttingPoints, setCuttingPoints] = useState<Array<{ x: number; y: number }>>([]);

  // All image-source nodes in the canvas
  const canvasImageNodes = useMemo(() => {
    return nodes.filter((n: any) => n.type === 'image-source' && n.data?.url);
  }, [nodes]);

  const activeViewerIndex = useMemo(() => {
    if (!viewerNodeId) return -1;
    return canvasImageNodes.findIndex((n: any) => n.id === viewerNodeId);
  }, [canvasImageNodes, viewerNodeId]);

  const activeViewerNode = useMemo<any>(() => {
    if (activeViewerIndex === -1) return null;
    return canvasImageNodes[activeViewerIndex];
  }, [canvasImageNodes, activeViewerIndex]);

  const goViewerPrev = useCallback(() => {
    if (canvasImageNodes.length <= 1) return;
    const prevIndex = (activeViewerIndex - 1 + canvasImageNodes.length) % canvasImageNodes.length;
    setViewerNodeId(canvasImageNodes[prevIndex].id);
    setViewerZoomScale(1);
    setViewerZoomOffset({ x: 0, y: 0 });
    setViewerRotation(0);
  }, [canvasImageNodes, activeViewerIndex]);

  const goViewerNext = useCallback(() => {
    if (canvasImageNodes.length <= 1) return;
    const nextIndex = (activeViewerIndex + 1) % canvasImageNodes.length;
    setViewerNodeId(canvasImageNodes[nextIndex].id);
    setViewerZoomScale(1);
    setViewerZoomOffset({ x: 0, y: 0 });
    setViewerRotation(0);
  }, [canvasImageNodes, activeViewerIndex]);

  const deleteViewerNode = useCallback(() => {
    if (!activeViewerNode) return;
    const nodeIdToDelete = activeViewerNode.id;
    
    // Select the next available image node first to keep lightbox persistent
    if (canvasImageNodes.length > 1) {
      const nextIndex = (activeViewerIndex + 1) % canvasImageNodes.length;
      setViewerNodeId(canvasImageNodes[nextIndex].id);
    } else {
      setViewerNodeId(null);
    }
    
    // Trigger delete in store
    setNodes(nodes.filter((n: any) => n.id !== nodeIdToDelete));
  }, [activeViewerNode, canvasImageNodes, activeViewerIndex, nodes, setNodes]);

  // Support key bindings inside viewer
  useEffect(() => {
    if (!viewerNodeId) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goViewerPrev();
      } else if (e.key === 'ArrowRight') {
        goViewerNext();
      } else if (e.key === 'Escape') {
        setViewerNodeId(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewerNodeId, goViewerPrev, goViewerNext]);
  const [isCutting, setIsCutting] = useState(false);

  const onEdgesChangeRef = useRef(onEdgesChange);
  useEffect(() => {
    onEdgesChangeRef.current = onEdgesChange;
  }, [onEdgesChange]);

  useEffect(() => {
    const mainEl = mainContainerRef.current;
    if (!mainEl) return;

    let localIsCutting = false;
    let activePoints: Array<{ x: number; y: number }> = [];
    let lastCutTime = 0;

    const handleMouseDown = (e: MouseEvent) => {
      // 2 is Right-Click
      if (e.button === 2 && e.altKey) {
        e.preventDefault();
        e.stopPropagation();

        localIsCutting = true;
        setIsCutting(true);

        const rect = mainEl.getBoundingClientRect();
        const firstPoint = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        activePoints = [firstPoint];
        setCuttingPoints([firstPoint]);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!localIsCutting) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = mainEl.getBoundingClientRect();
      const currentPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      activePoints.push(currentPoint);
      setCuttingPoints([...activePoints]);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (localIsCutting) {
        e.preventDefault();
        e.stopPropagation();

        // Perform visual intersection analysis in a single batch on mouse release
        const rect = mainEl.getBoundingClientRect();
        const detectedEdgeIds = new Set<string>();

        for (let i = 0; i < activePoints.length - 1; i++) {
          const p1 = activePoints[i];
          const p2 = activePoints[i + 1];
          const x1 = p1.x + rect.left;
          const y1 = p1.y + rect.top;
          const x2 = p2.x + rect.left;
          const y2 = p2.y + rect.top;

          const dx = x2 - x1;
          const dy = y2 - y1;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const steps = Math.ceil(distance / 4); // check every 4px for high accuracy

          for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 0 : s / steps;
            const ix = x1 + dx * t;
            const iy = y1 + dy * t;

            if (document.elementsFromPoint) {
              const elements = document.elementsFromPoint(ix, iy);
              for (const el of elements) {
                const edgeContainer = el.closest(".react-flow__edge");
                if (edgeContainer) {
                  const edgeId = edgeContainer.getAttribute("data-id");
                  if (edgeId) {
                    detectedEdgeIds.add(edgeId);
                  }
                }
              }
            }
          }
        }

        if (detectedEdgeIds.size > 0) {
          const edgeChanges = Array.from(detectedEdgeIds).map((id) => ({
            id,
            type: "remove" as const,
          }));
          onEdgesChangeRef.current(edgeChanges);
        }

        localIsCutting = false;
        setIsCutting(false);
        activePoints = [];
        setCuttingPoints([]);
        lastCutTime = Date.now();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (e.altKey || localIsCutting || (Date.now() - lastCutTime < 150)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    mainEl.addEventListener("mousedown", handleMouseDown, { capture: true });
    window.addEventListener("mousemove", handleMouseMove, { capture: true });
    window.addEventListener("mouseup", handleMouseUp, { capture: true });
    mainEl.addEventListener("contextmenu", handleContextMenu, { capture: true });

    return () => {
      mainEl.removeEventListener("mousedown", handleMouseDown, { capture: true });
      window.removeEventListener("mousemove", handleMouseMove, { capture: true });
      window.removeEventListener("mouseup", handleMouseUp, { capture: true });
      mainEl.removeEventListener("contextmenu", handleContextMenu, { capture: true });
    };
  }, []);

  const {
    fitView,
    screenToFlowPosition,
    zoomIn,
    zoomOut,
    getZoom,
    setViewport,
    getViewport,
  } = useReactFlow();

  if (isExited) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#0d0d0f] font-sans text-center px-6">
        <div className="flex flex-col items-center gap-6 max-w-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-accent via-accent to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-accent/20 mb-2 animate-pulse font-black text-2xl italic tracking-tighter">
            NV
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">工作区已安全关闭</h1>
            <p className="text-xs text-gray-400 mt-2 tracking-wide leading-relaxed">
              您所有修改已妥善保存至本地存储。
              <br />
              现在可以安全地关闭此窗口，或者点击下方按钮重新唤醒画布。
            </p>
          </div>
          <button
            onClick={() => setIsExited(false)}
            className="w-full py-3 px-6 rounded-xl bg-accent hover:opacity-90 text-white font-bold text-xs transition-all shadow-lg active:scale-95 border-none cursor-pointer"
          >
            重新唤醒工作流画布
          </button>
        </div>
      </div>
    );
  }

  const [activeOp, setActiveOp] = useState<'move' | 'scale' | null>(null);
  const [showHotkeyGuide, setShowHotkeyGuide] = useState(true);
  const activeOpRef = useRef<'move' | 'scale' | null>(null);
  const globalMousePosRef = useRef({ x: 0, y: 0 });
  const nodesBackupRef = useRef<Node[]>([]);
  const startMousePosRef = useRef({ x: 0, y: 0 });
  const initialNodesRef = useRef<Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    style: any;
  }>>([]);
  const scaleFactorRef = useRef(1.0);

  // Global absolute mouse tracking to instantly know coordinates on keypress
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      globalMousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleGlobalMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, []);

  // Quick operations listener (G for Move / S for Scale)
  useEffect(() => {
    activeOpRef.current = activeOp;
    if (!activeOp) return;

    const commitOp = () => {
      setActiveOp(null);
      activeOpRef.current = null;
    };

    const cancelOp = () => {
      if (nodesBackupRef.current.length > 0) {
        setNodes(nodesBackupRef.current);
      }
      setActiveOp(null);
      activeOpRef.current = null;
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (activeOpRef.current !== 'move') return;
      const zoom = getZoom();
      const dx = (e.clientX - startMousePosRef.current.x) / zoom;
      const dy = (e.clientY - startMousePosRef.current.y) / zoom;

      const updated = nodes.map(n => {
        const init = initialNodesRef.current.find(item => item.id === n.id);
        if (init) {
          return {
            ...n,
            position: { x: init.x + dx, y: init.y + dy }
          };
        }
        return n;
      });
      setNodes(updated);
    };

    const handleWindowWheel = (e: WheelEvent) => {
      if (activeOpRef.current !== 'scale') return;
      e.preventDefault();
      e.stopPropagation();

      scaleFactorRef.current += e.deltaY * -0.0015;
      scaleFactorRef.current = Math.max(0.1, Math.min(6.0, scaleFactorRef.current));
      const k = scaleFactorRef.current;

      const updated = nodes.map(n => {
        const init = initialNodesRef.current.find(item => item.id === n.id);
        if (init) {
          const w = Math.round(Math.max(80, init.width * k));
          const h = Math.round(Math.max(80, init.height * k));
          const newX = init.x + (init.width - w) / 2;
          const newY = init.y + (init.height - h) / 2;
          return {
            ...n,
            position: { x: newX, y: newY },
            width: w,
            height: h,
            style: {
              ...init.style,
              width: w,
              height: h
            }
          };
        }
        return n;
      });
      setNodes(updated);
    };

    const handleWindowClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      commitOp();
    };

    const handleWindowContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cancelOp();
    };

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelOp();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        commitOp();
      } else if (e.key.toLowerCase() === "g" && activeOpRef.current === "move") {
        e.preventDefault();
        e.stopPropagation();
        commitOp();
      } else if ((e.key.toLowerCase() === "s" || e.key.toLowerCase() === "r") && activeOpRef.current === "scale") {
        e.preventDefault();
        e.stopPropagation();
        commitOp();
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove, { passive: true });
    window.addEventListener("wheel", handleWindowWheel, { passive: false });
    window.addEventListener("click", handleWindowClick, { capture: true });
    window.addEventListener("contextmenu", handleWindowContextMenu, { capture: true });
    window.addEventListener("keydown", handleWindowKeyDown, { capture: true });

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("wheel", handleWindowWheel);
      window.removeEventListener("click", handleWindowClick, { capture: true });
      window.removeEventListener("contextmenu", handleWindowContextMenu, { capture: true });
      window.removeEventListener("keydown", handleWindowKeyDown, { capture: true });
    };
  }, [activeOp, nodes, getZoom, setNodes]);

  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    screenX: number;
    screenY: number;
    connectingHandle?: any;
  } | null>(null);
  const [connectingHandle, setConnectingHandle] = useState<any | null>(null);
  const connectionMade = useRef(false);
  const [inputText, setInputText] = useState("");
  const [showModelPopup, setShowModelPopup] = useState(false);
  const [assistantModelSearch, setAssistantModelSearch] = useState("");

  const chatModelsList = useMemo(() => {
    const activeId = settings.apiSettings.activeProfileId || settings.apiSettings.engine || 'gemini';
    
    if (activeId === 'modelscope') {
      const msModels = settings.apiSettings.modelscopeChatModels || [];
      const defaultMsModels = [
        "Qwen/Qwen3-235B-A22B",
        "Qwen/Qwen3-VL-235B-A22B-Instruct",
        "MiniMax/MiniMax-M2.7:MiniMax",
        "Qwen/QVQ-72B-Preview",
        "Qwen/Qwen3.5-122B-A10B",
        "Qwen/Qwen3.5-27B",
        "Qwen/Qwen3.5-35B-A3B"
      ];
      return Array.from(new Set([
        ...(settings.apiSettings.modelscopeSelectedChatModel ? [settings.apiSettings.modelscopeSelectedChatModel] : []),
        ...msModels,
        ...defaultMsModels
      ]));
    }

    const profilesList = settings.apiSettings.profiles || [];
    const activeProf = profilesList.find((p: any) => p.id === activeId) || { id: "gemini", engine: "gemini", models: [], modelId: "gemini-2.5-flash" };
    const savedModels = activeProf.models || [];
    
    const imageKeywords = ['flux', 'stable-diffusion', 'sdxl', 'image', 'canvas', 'cv_tinynas', 'diffusion', 'instant-style', 'synthetic', 'banana', 'wan-video', 'seedream', 'imagine', 'midjourney', 'mj-', 'dall-e', 'dalle', 'imagen', 'sd3', 'sd-3', 'sd15', 'sd-1.5', 'sd1.5', 'kolors', 'recraft', 'ideogram', 'cogview', 'stable-video-diffusion', 'svd', 'runway', 'luma', 'sora', 'hunyuan', 'playground', 'adobe', 'firefly', 'lumina', 'pixart', 'wan', 'kling', 'drawing', 'paint', 'sketch', 'illustration', 'art', 'video', 't2v', 'i2v', 'v2v', 'animate', 'animated', 'animator'];

    const filteredPulled = savedModels.filter((m: string) => 
      !imageKeywords.some(kw => m.toLowerCase().includes(kw))
    );

    const defaultChatModels = [
      "gemini-2.5-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-3.1-flash-image-preview",
      "gpt-4o-mini",
      "gpt-4o",
      "o1-mini",
      "gpt-5.4-pro",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "deepseek-chat",
      "deepseek-reasoner",
      "doubao-pro-32k",
      "doubao-pro-128k",
      "doubao-lite-32k",
      "qwen-max",
      "qwen-plus",
      "qwen-turbo"
    ];

    const activeEngine = activeProf.engine?.toLowerCase();
    const relevantDefaults = defaultChatModels.filter(m => {
      if (activeEngine === 'gemini') return m.startsWith('gemini');
      if (activeEngine === 'openai') return m.startsWith('gpt-') || m.startsWith('o1-');
      if (activeEngine === 'claude') return m.startsWith('claude');
      if (activeEngine === 'deepseek') return m.startsWith('deepseek');
      if (activeEngine === 'doubao') return m.startsWith('doubao');
      if (activeEngine === 'qianwen' || activeEngine === 'qianwen') return m.startsWith('qwen');
      return true;
    });

    return Array.from(new Set([
      ...(activeProf.modelId ? [activeProf.modelId] : []),
      ...filteredPulled,
      ...relevantDefaults
    ]));
  }, [settings.apiSettings, settings.apiSettings.profiles]);

  const handlePlatformChange = (platformId: string) => {
    if (platformId === 'modelscope') {
      updateSettings({
        apiSettings: {
          ...settings.apiSettings,
          activeProfileId: 'modelscope',
          engine: 'modelscope'
        }
      });
    } else {
      const rawProfiles = settings.apiSettings.profiles || [];
      const prof = rawProfiles.find((p: any) => p.id === platformId);
      if (prof) {
        updateSettings({
          apiSettings: {
            ...settings.apiSettings,
            isCustom: true,
            engine: prof.engine,
            baseUrl: prof.baseUrl,
            apiKey: prof.apiKey,
            modelId: prof.modelId,
            activeProfileId: prof.id,
          },
        });
      }
    }
  };

  const handleModelSelect = (modelId: string) => {
    const activeId = settings.apiSettings.activeProfileId || settings.apiSettings.engine || 'gemini';
    if (activeId === 'modelscope') {
      updateSettings({
        apiSettings: {
          ...settings.apiSettings,
          modelscopeSelectedChatModel: modelId,
        }
      });
    } else {
      const updatedProfiles = (settings.apiSettings.profiles || []).map((p: any) => {
        if (p.id === activeId) {
          return { ...p, modelId: modelId };
        }
        return p;
      });
      updateSettings({
        apiSettings: {
          ...settings.apiSettings,
          profiles: updatedProfiles,
          modelId: modelId,
        }
      });
    }
  };

  const [isAssistantMaximized, setIsAssistantMaximized] = useState(false);
  const [isAssistantMinimized, setIsAssistantMinimized] = useState(false);
  const [isAssistantPinned, setIsAssistantPinned] = useState(true);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const uploadMenuRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [copiedMessageIdx, setCopiedMessageIdx] = useState<number | null>(null);
  const [selectiveCopyMsg, setSelectiveCopyMsg] = useState<{ index: number; content: string } | null>(null);
  const [chunkCopiedId, setChunkCopiedId] = useState<string | null>(null);
  const [chatNotification, setChatNotification] = useState<string | null>(null);

  // Filter edges based on showConnections setting
  const visibleEdges = useMemo(() => {
    if (!settings.showConnections) return [];
    return edges;
  }, [edges, settings.showConnections]);

  const getSegments = (text: string) => {
    const segments: Array<{ id: string; type: "code" | "text"; content: string; lang?: string }> = [];
    if (!text) return segments;

    const parts = text.split(/(```[\s\S]*?```)/g);
    let idCounter = 0;
    parts.forEach((part) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const match = part.match(/^```(\w+)?\n([\s\S]*?)```$/);
        idCounter++;
        if (match) {
          segments.push({
            id: `chunk-code-${idCounter}`,
            type: "code",
            lang: match[1] || "code",
            content: match[2].trim(),
          });
        } else {
          segments.push({
            id: `chunk-code-${idCounter}`,
            type: "code",
            content: part.replace(/```/g, "").trim(),
          });
        }
      } else {
        const paragraphs = part.split(/\n\s*\n/);
        paragraphs.forEach((p) => {
          const trimmed = p.trim();
          if (trimmed) {
            idCounter++;
            segments.push({
              id: `chunk-text-${idCounter}`,
              type: "text",
              content: trimmed,
            });
          }
        });
      }
    });
    return segments;
  };

  // Highlight associated nodes logic
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const highlightedNodes = useMemo(() => {
    if (!settings.highlightAssociated || !selectedNodeId) return nodes;

    const associatedIds = new Set<string>([selectedNodeId]);
    edges.forEach((edge) => {
      if (edge.source === selectedNodeId) associatedIds.add(edge.target);
      if (edge.target === selectedNodeId) associatedIds.add(edge.source);
    });

    return nodes.map((node) => {
      const isAssociated = associatedIds.has(node.id);
      const targetShadow = `0 0 20px ${settings.highlightColor}44`;

      if (isAssociated) {
        if (node.style?.boxShadow === targetShadow) return node; // Skip recreation
        return {
          ...node,
          style: {
            ...node.style,
            opacity: 1,
            boxShadow: targetShadow,
            borderColor: settings.highlightColor,
            borderWidth: "2px",
          },
        };
      }

      if (node.style?.opacity === 0.4 && !("boxShadow" in (node.style || {}))) return node; // Skip recreation if already clean

      // Clean up any existing highlight styles for non-associated nodes
      const cleanStyle = { ...node.style, opacity: 0.4 };
      delete cleanStyle.boxShadow;
      delete cleanStyle.borderColor;
      delete cleanStyle.borderWidth;

      return {
        ...node,
        style: cleanStyle,
      };
    });
  }, [
    nodes,
    edges,
    selectedNodeId,
    settings.highlightAssociated,
    settings.highlightColor,
  ]);

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setMenu(null);
    setSelectedNodeId(null);
    const state = useStore.getState();
    if (state.showWebPreview) {
      state.toggleWebPreview();
    }
  }, []);

  const handleAddNode = (type: any, x?: number, y?: number) => {
    takeSnapshot();
    const customId = Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    
    // Calculate initial scale factor based on current zoom level
    const zoom = getZoom();
    const scaleFactor = Math.max(0.5, Math.min(2.5, 1 / zoom));
    
    let baseW = 400;
    let baseH = 400;
    if (type === "spatial-view") { baseW = 960; baseH = 540; }
    else if (type === "fusion-master") { baseW = 720; baseH = 960; }
    else if (type === "double-box-transform") { baseW = 800; baseH = 600; }
    else if (type === "apt-web-tool") { baseW = 1000; baseH = 750; }
    else if (type === "native-host") { baseW = 1000; baseH = 750; }
    else if (type === "io-image-list") { baseW = 450; baseH = 600; }
    else if (type === "ai-ps-engine") { baseW = 880; baseH = 640; }
    else if (type === "image-gen" || type === "text-gen" || type === "translate-engine" || type === "logic-engine" || type === "prompt-engine" || type === "ms-gen" || type === "reverse") {
      baseW = 450;
      baseH = 600;
    }
    else if (type === "image-source") { baseW = 300; baseH = 350; }
    else if (type === "group-node") { baseW = 800; baseH = 600; }
    
    const initialWidth = Math.round(baseW * scaleFactor);
    const initialHeight = Math.round(baseH * scaleFactor);

    let posX = x;
    let posY = y;
    if (posX === undefined || posY === undefined) {
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      posX = center.x - (initialWidth / 2);
      posY = center.y - (initialHeight / 2);
    }
    
    // Pass the initial dimensions directly to addNode data
    addNode(type, posX, posY, { 
      initialWidth, 
      initialHeight 
    }, customId);

    // If we have a connectingHandle from drag connection, automatically wire the edge!
    if (menu?.connectingHandle) {
      const { nodeId, handleId, handleType } = menu.connectingHandle;
      if (handleType === 'source') {
        onConnect({
          source: nodeId,
          sourceHandle: handleId,
          target: customId,
          targetHandle: 'Left',
        });
      } else if (handleType === 'target') {
        onConnect({
          source: customId,
          sourceHandle: 'Right',
          target: nodeId,
          targetHandle: handleId,
        });
      }
    }

    setMenu(null);
  };

  const onConnectExtended = useCallback(
    (connection: any) => {
      connectionMade.current = true;
      onConnect(connection);
    },
    [onConnect]
  );

  const onConnectStartExtended = useCallback(
    (_: any, params: any) => {
      setIsConnecting(true);
      connectionMade.current = false;
      if (params) {
        setConnectingHandle({
          nodeId: params.nodeId,
          handleId: params.handleId,
          handleType: params.handleType,
        });
      }
    },
    []
  );

  const onConnectEndExtended = useCallback(
    (event: any) => {
      setIsConnecting(false);
      const handle = connectingHandle;
      
      setTimeout(() => {
        if (!connectionMade.current && handle) {
          const targetIsPane = event.target.classList.contains('react-flow__pane') || event.target.closest('.react-flow__pane');
          if (targetIsPane) {
            const clientX = event.clientX !== undefined ? event.clientX : (event.changedTouches?.[0]?.clientX);
            const clientY = event.clientY !== undefined ? event.clientY : (event.changedTouches?.[0]?.clientY);
            
            if (clientX !== undefined && clientY !== undefined) {
              const position = screenToFlowPosition({ x: clientX, y: clientY });
              setMenu({
                x: position.x,
                y: position.y,
                screenX: clientX,
                screenY: clientY,
                connectingHandle: handle
              });
            }
          }
        }
        setConnectingHandle(null);
      }, 80);
    },
    [connectingHandle, screenToFlowPosition]
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (event.altKey) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setMenu({
        x: position.x,
        y: position.y,
        screenX: event.clientX,
        screenY: event.clientY,
      });
    },
    [screenToFlowPosition],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputElement = (target: any) => {
        if (!target) return false;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        ) {
          return true;
        }
        if (target.isContentEditable) return true;
        if (typeof target.closest === 'function') {
          return !!target.closest('input, textarea, select, [contenteditable="true"], .nodrag, .node-input-contain');
        }
        return false;
      };

      if (isInputElement(e.target)) return;

      // Early return if active op is running
      if (activeOpRef.current !== null) return;

      if (e.key.toLowerCase() === "m") toggleMiniMap();
      if (e.key.toLowerCase() === "l") toggleGrid();
      if (e.key.toLowerCase() === "k") {
        setShowHotkeyGuide((prev) => !prev);
      }
      
      if (e.key.toLowerCase() === "f") {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length > 0) {
          fitView({
            nodes: selected,
            duration: 800,
            padding: 0.2,
          });
        } else {
          fitView({
            duration: 800,
            padding: 0.1,
          });
        }
      }

      // Plain G key triggers G-move (Move Mode)
      if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length > 0) {
          e.preventDefault();
          takeSnapshot();
          nodesBackupRef.current = JSON.parse(JSON.stringify(nodes));
          startMousePosRef.current = { ...globalMousePosRef.current };
          initialNodesRef.current = selected.map((n) => {
            const dims = getNodeDimensions(n);
            return {
              id: n.id,
              x: n.position.x,
              y: n.position.y,
              width: dims.width,
              height: dims.height,
              style: n.style ? { ...n.style } : {},
            };
          });
          setActiveOp("move");
          activeOpRef.current = "move";
          return;
        }
      }

      // Plain S or R key triggers scale (Scale Mode)
      if ((e.key.toLowerCase() === "s" || e.key.toLowerCase() === "r") && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length > 0) {
          e.preventDefault();
          takeSnapshot();
          nodesBackupRef.current = JSON.parse(JSON.stringify(nodes));
          scaleFactorRef.current = 1.0;
          initialNodesRef.current = selected.map((n) => {
            const dims = getNodeDimensions(n);
            return {
              id: n.id,
              x: n.position.x,
              y: n.position.y,
              width: dims.width,
              height: dims.height,
              style: n.style ? { ...n.style } : {},
            };
          });
          setActiveOp("scale");
          activeOpRef.current = "scale";
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        groupSelectedNodes("G");
      }

      if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        const selectedParents = new Set<string>();
        nodes.forEach((n) => {
          if (n.selected) {
            if (n.type === "group-node") {
              selectedParents.add(n.id);
            } else if (n.parentId) {
              selectedParents.add(n.parentId);
            }
          }
        });
        selectedParents.forEach((pid) => ungroupNode(pid));
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        copySelectedNodes();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if focused on an input or textarea
      const isInputElement = (target: any) => {
        if (!target) return false;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        ) {
          return true;
        }
        if (target.isContentEditable) return true;
        if (typeof target.closest === 'function') {
          return !!target.closest('input, textarea, select, [contenteditable="true"], .nodrag, .node-input-contain');
        }
        return false;
      };

      if (isInputElement(e.target)) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const text = clipboardData.getData("text")?.trim();
      const items = clipboardData.items;

      // EXCLUSIVE logic: Check if we just copied nodes internally
      if (text === "__FLUX_NODES_DATA__") {
        pasteNodes();
        e.preventDefault();
        return;
      }

      let imageHandled = false;

      // Helper to check if URL is a likely image
      const isImgUrl = (url: string) => {
        if (!url) return false;
        if (url.startsWith("data:image/")) return true;
        return /\.(jpeg|jpg|gif|png|webp|svg|bmp|tiff|ico|apng)(\?.*)?$/i.test(url) || 
               url.includes("images") || 
               url.includes("img") || 
               url.includes("avatar") || 
               url.startsWith("blob:");
      };

      const handleImageSrc = (imageUrl: string, name: string) => {
        const img = new Image();
        img.onload = () => {
          const width = img.width;
          const height = img.height;

          // If an image-capable node is selected, update it
          const selectedNode = nodes.find((n) => n.selected);
          const imageNodes = [
            "image-source",
            "image-gen",
            "reverse",
            "ms-gen",
            "double-box-transform",
          ];

          if (selectedNode) {
            if (selectedNode.type === "io-image-list") {
              const currentImages =
                (selectedNode.data.images as any[]) || [];
              const newImages = [
                ...currentImages,
                {
                  url: imageUrl,
                  name: name || "Pasted Image",
                  source: "clipboard",
                  width,
                  height,
                },
              ];
              updateNodeData(selectedNode.id, { images: newImages });
            } else if (imageNodes.includes(selectedNode.type as string)) {
              updateNodeData(selectedNode.id, {
                imageUrl,
                url: imageUrl, // Support for nodes using .url like SourceImageNode
                originalWidth: width,
                originalHeight: height,
              });
            } else {
              // Fallback: create new image node
              createNewImageNode(imageUrl, name, width, height);
            }
          } else {
            createNewImageNode(imageUrl, name, width, height);
          }
        };
        img.src = imageUrl;
      };

      // 1. If we have image file items in clipboard, handle them first
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            imageHandled = true;
            const reader = new FileReader();
            reader.onload = (event) => {
              const imageUrl = event.target?.result as string;
              handleImageSrc(imageUrl, file.name || "Pasted Image");
            };
            reader.readAsDataURL(file);
            break; // Handle only one image at a time
          }
        }
      }

      // 2. If not handled as file, check if text content is an image URL
      if (!imageHandled && text && isImgUrl(text)) {
        e.preventDefault();
        imageHandled = true;
        handleImageSrc(text, "Pasted Image URL");
      }

      // 3. If not handled, check if we pasted HTML containing an <img> tag (common when copying from web pages)
      if (!imageHandled) {
        const htmlText = clipboardData.getData("text/html");
        if (htmlText) {
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, "text/html");
            const imgEl = doc.querySelector("img");
            if (imgEl && imgEl.src && isImgUrl(imgEl.src)) {
              e.preventDefault();
              imageHandled = true;
              handleImageSrc(imgEl.src, "Pasted Web Image");
            }
          } catch (err) {
            console.error("Failed to parse clipboard html for images", err);
          }
        }
      }
    };

    const createNewImageNode = (
      imageUrl: string,
      name?: string,
      width?: number,
      height?: number,
    ) => {
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      addNode("image-source", center.x - 150, center.y - 120, {
        url: imageUrl,
        name: name || "Pasted Image",
        originalWidth: width,
        originalHeight: height,
      });
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'APT_DRAG_IMAGE_START') {
        (window as any).__draggedImageFromIframe = data.url;
      } else if (data && data.type === 'APT_DRAG_IMAGE_END') {
        setTimeout(() => {
          delete (window as any).__draggedImageFromIframe;
        }, 1000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("message", handleMessage);
    };
  }, [
    toggleMiniMap,
    toggleGrid,
    fitView,
    copySelectedNodes,
    pasteNodes,
    nodes,
    addNode,
    updateNodeData,
    screenToFlowPosition,
    groupSelectedNodes,
    ungroupNode,
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if ((!inputText.trim() && attachedFiles.length === 0) || isTyping) return;

    const userMsg = inputText.trim();
    const currentAttachments = [...attachedFiles];
    setInputText("");
    setAttachedFiles([]);
    
    addChatMessage({ 
      role: "user", 
      content: userMsg,
      attachments: currentAttachments.map(att => ({
        name: att.name,
        type: att.type,
        size: att.size,
        base64: att.base64,
        text: att.text
      }))
    } as any);
    setIsTyping(true);

    try {
      const resultText = await generateTextWithFallback(
        userMsg, 
        undefined, 
        currentAttachments, 
        webSearchEnabled
      );
      addChatMessage({
        role: "assistant",
        content: resultText || "我不太明白。",
      });
    } catch (err) {
      console.error(err);
      addChatMessage({
        role: "assistant",
        content:
          "抱歉，我现在无法回答。请检查网络和 API 设置。 (" +
          (err instanceof Error ? err.message : String(err)) +
          ")",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopyMessage = async (index: number, content: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedMessageIdx(index);
      showChatNotification("已成功复制全文到剪贴板！");
      setTimeout(() => {
        setCopiedMessageIdx(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const showChatNotification = (msg: string) => {
    setChatNotification(msg);
    setTimeout(() => {
      setChatNotification(null);
    }, 2500);
  };

  // Tracking state and refs for Ctrl + Right Click arrangement drag gesture
  const latestNodesRef = useRef(nodes);
  const latestSettingsRef = useRef(settings);
  const latestSetNodesRef = useRef(setNodes);
  const latestTakeSnapshotRef = useRef(takeSnapshot);
  const latestShowChatNotificationRef = useRef(showChatNotification);

  useEffect(() => {
    latestNodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    latestSetNodesRef.current = setNodes;
  }, [setNodes]);

  useEffect(() => {
    latestTakeSnapshotRef.current = takeSnapshot;
  }, [takeSnapshot]);

  useEffect(() => {
    latestShowChatNotificationRef.current = showChatNotification;
  }, [showChatNotification]);

  useEffect(() => {
    const mainEl = mainContainerRef.current;
    if (!mainEl) return;

    let isArranging = false;
    let startX = 0;
    let startY = 0;
    let hasTriggered = false;

    const handleMouseDown = (e: MouseEvent) => {
      // e.button === 2 is Right-Click
      if (e.button === 2 && e.ctrlKey) {
        const selected = latestNodesRef.current.filter((n: any) => n.selected);
        if (selected.length >= 2) {
          e.preventDefault();
          e.stopPropagation();

          isArranging = true;
          startX = e.clientX;
          startY = e.clientY;
          hasTriggered = false;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isArranging || hasTriggered) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const threshold = 25; // threshold of movement pixels

      if (distance > threshold) {
        e.preventDefault();
        e.stopPropagation();

        const selectedNodes = latestNodesRef.current.filter((n: any) => n.selected);
        if (selectedNodes.length >= 2) {
          const type = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
          
          if (latestTakeSnapshotRef.current) {
            latestTakeSnapshotRef.current();
          }

          // Sort nodes
          const sorted = [...selectedNodes].sort((a, b) => 
            type === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
          );

          const spacing = latestSettingsRef.current.alignmentSpacing || 40;
          const currentNodesState = latestNodesRef.current;

          // First node determines starting coordinates
          const firstNodeId = sorted[0].id;
          const startNodeInNds = currentNodesState.find(node => node.id === firstNodeId);
          const startXPos = startNodeInNds ? startNodeInNds.position.x : sorted[0].position.x;
          const startYPos = startNodeInNds ? startNodeInNds.position.y : sorted[0].position.y;

          let currentPos = type === 'horizontal' ? startXPos : startYPos;
          const targetFixed = type === 'horizontal' ? startYPos : startXPos;

          // Precompute starting positions and target final positions
          const startPositions: { [id: string]: { x: number; y: number } } = {};
          const targetPositions: { [id: string]: { x: number; y: number } } = {};

          sorted.forEach((n, idx) => {
            const actualNode = currentNodesState.find(node => node.id === n.id);
            if (!actualNode) return;

            startPositions[n.id] = {
              x: actualNode.position.x,
              y: actualNode.position.y
            };

            if (idx === 0) {
              targetPositions[n.id] = {
                x: type === 'horizontal' ? actualNode.position.x : targetFixed,
                y: type === 'vertical' ? actualNode.position.y : targetFixed
              };
              currentPos += type === 'horizontal' ? (actualNode.measured?.width || actualNode.width || 200) + spacing : (actualNode.measured?.height || actualNode.height || 200) + spacing;
            } else {
              const newPos = currentPos;
              targetPositions[n.id] = {
                x: type === 'horizontal' ? newPos : targetFixed,
                y: type === 'vertical' ? newPos : targetFixed
              };
              currentPos += type === 'horizontal' ? (actualNode.measured?.width || actualNode.width || 200) + spacing : (actualNode.measured?.height || actualNode.height || 200) + spacing;
            }
          });

          // Animation control loop
          const startTime = performance.now();
          const duration = 350; // Smooth 350ms transition

          const animateTransition = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Cubic easeInOut easing function
            const ease = progress < 0.5 
              ? 4 * progress * progress * progress 
              : (progress - 1) * (2 * progress - 2) * (2 * progress - 2) + 1;

            const currentNodes = useStore.getState().nodes;
            const updatedNodes = currentNodes.map(n => {
              const start = startPositions[n.id];
              const target = targetPositions[n.id];
              if (start && target) {
                return {
                  ...n,
                  position: {
                    x: start.x + (target.x - start.x) * ease,
                    y: start.y + (target.y - start.y) * ease
                  }
                };
              }
              return n;
            });
            latestSetNodesRef.current(updatedNodes);

            if (progress < 1) {
              requestAnimationFrame(animateTransition);
            }
          };

          requestAnimationFrame(animateTransition);

          if (latestShowChatNotificationRef.current) {
            latestShowChatNotificationRef.current(`已调整：框选节点已${type === 'horizontal' ? '横向' : '垂直'}渐变排列`);
          }
        }

        hasTriggered = true;
        isArranging = false;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isArranging) {
        if (e.button === 2) {
          e.preventDefault();
          e.stopPropagation();
        }
        isArranging = false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (e.ctrlKey) {
        const selected = latestNodesRef.current.filter((n: any) => n.selected);
        if (selected.length >= 2) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    mainEl.addEventListener("mousedown", handleMouseDown, { capture: true });
    window.addEventListener("mousemove", handleMouseMove, { capture: true });
    window.addEventListener("mouseup", handleMouseUp, { capture: true });
    mainEl.addEventListener("contextmenu", handleContextMenu, { capture: true });

    return () => {
      mainEl.removeEventListener("mousedown", handleMouseDown, { capture: true });
      window.removeEventListener("mousemove", handleMouseMove, { capture: true });
      window.removeEventListener("mouseup", handleMouseUp, { capture: true });
      mainEl.removeEventListener("contextmenu", handleContextMenu, { capture: true });
    };
  }, []);

  const handleRateMessage = (index: number, rateType: "like" | "dislike") => {
    const nextHistory = [...chatHistory];
    const currentMsg = nextHistory[index];
    if (currentMsg) {
      const currentFeedback = currentMsg.feedback;
      if (currentFeedback === rateType) {
        currentMsg.feedback = null;
        showChatNotification("已取消反馈");
      } else {
        currentMsg.feedback = rateType;
        showChatNotification(rateType === "like" ? "感谢您的赞同！" : "感谢反馈，我们会持续改进。");
      }
      setChatHistory(nextHistory);
    }
  };

  const handleRegenerateMessage = async (index: number) => {
    if (isTyping) return;

    let precedingUserMsgIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (chatHistory[i]?.role === "user") {
        precedingUserMsgIndex = i;
        break;
      }
    }

    if (precedingUserMsgIndex === -1) {
      showChatNotification("无法找到对应的原始用户指令，无法重新生成。");
      return;
    }

    const userMsgObj = chatHistory[precedingUserMsgIndex];
    const userMsgText = userMsgObj.content;
    const userAttachments = userMsgObj.attachments || [];

    setIsTyping(true);

    const nextHistory = [...chatHistory];
    nextHistory[index] = {
      role: "assistant",
      content: "",
    };
    setChatHistory(nextHistory);

    try {
      const resultText = await generateTextWithFallback(
        userMsgText,
        undefined,
        userAttachments,
        webSearchEnabled
      );

      const updatedHistory = [...chatHistory];
      updatedHistory[index] = {
        role: "assistant",
        content: resultText || "我不太明白。",
        feedback: null
      };
      setChatHistory(updatedHistory);
    } catch (err) {
      console.error(err);
      const updatedHistory = [...chatHistory];
      updatedHistory[index] = {
        role: "assistant",
        content:
          "抱歉，重新生成失败。请检查网络。 (" +
          (err instanceof Error ? err.message : String(err)) +
          ")",
      };
      setChatHistory(updatedHistory);
    } finally {
      setIsTyping(false);
    }
  };

  const handleChatFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith("image/");
      const reader = new FileReader();

      if (isImage) {
        reader.onload = (event) => {
          setAttachedFiles((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(7),
              name: file.name,
              type: file.type,
              size: file.size,
              base64: event.target?.result as string,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (event) => {
          setAttachedFiles((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(7),
              name: file.name,
              type: file.type || "text/plain",
              size: file.size,
              text: event.target?.result as string,
            },
          ]);
        };
        reader.readAsText(file);
      }
    });

    e.target.value = "";
    setShowUploadMenu(false);
  };

  const handleAddRecentFile = (item: any) => {
    if (attachedFiles.find((f) => f.name === item.name)) return;
    
    setAttachedFiles((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        name: item.name,
        type: item.type === "image" ? "image/png" : "text/plain",
        size: item.size || 0,
        base64: item.type === "image" ? item.url : undefined,
        text: item.type !== "image" ? `[Workspace File: ${item.name}]` : undefined,
      },
    ]);
    setShowRecentFiles(false);
    setShowUploadMenu(false);
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("您的浏览器不支持语音输入 (Speech Recognition)。请使用 Google Chrome、Microsoft Edge 或 Safari 浏览器。");
      return;
    }

    if (isListening) {
      setIsListening(false);
    } else {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputText(prev => prev + (prev && !prev.endsWith(" ") ? " " : "") + transcript);
          }
        };

        recognition.start();
      } catch (e) {
        console.error(e);
        setIsListening(false);
      }
    }
  };

  // Dedicated useEffect to track active hold of Z/z
  useEffect(() => {
    const isInputElement = (target: any) => {
      if (!target) return false;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return true;
      }
      if (target.isContentEditable) return true;
      if (typeof target.closest === 'function') {
        return !!target.closest('input, textarea, select, [contenteditable="true"], .nodrag, .node-input-contain');
      }
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputElement(e.target)) {
        return;
      }

      if (e.key.toLowerCase() === 'z') {
        if (e.repeat) return;
        setIsZMode(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isInputElement(e.target)) {
        return;
      }

      if (e.key.toLowerCase() === 'z') {
        setIsZMode(false);
      }
    };

    const handleBlur = () => {
      setIsZMode(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Capture drag-zooming on the canvas or fullscreen viewer when inside Z mode
  useEffect(() => {
    if (!isZMode) {
      setIsZDragging(false);
      setActiveZButton(null);
      zDragButtonRef.current = -1;
      return;
    }

    const handleMouseMoveGlobal = (e: MouseEvent) => {
      setMouseCoords({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMoveGlobal);

    const handleMouseDown = (e: MouseEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).closest('button') ||
        (e.target as HTMLElement).closest('input') ||
        (e.target as HTMLElement).closest('select') ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.button !== 0 && e.button !== 2) return;

      e.preventDefault();
      e.stopPropagation();

      setIsZDragging(true);
      setActiveZButton(e.button);
      zDragButtonRef.current = e.button;
      zDragStartPosRef.current = { x: e.clientX, y: e.clientY };
      zLastMousePosRef.current = { x: e.clientX, y: e.clientY };
      zDragStartViewerScaleRef.current = viewerZoomScale;
      
      try {
        const flowZoom = getZoom();
        zDragStartCanvasZoomRef.current = flowZoom;
      } catch (err) {
        zDragStartCanvasZoomRef.current = 1;
      }

      setCurrentSlideDirection('none');
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!zDragStartPosRef.current) return;

      const dx = e.clientX - zLastMousePosRef.current.x;
      const dy = e.clientY - zLastMousePosRef.current.y;
      zLastMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (dx === 0) return;

      // Silkiness factor (Photoshop match)
      const speedFactor = 0.003;

      if (viewerNodeId) {
        setViewerZoomScale(prev => {
          let nextZoom = prev;
          if (zDragButtonRef.current === 0) {
            // 左滑(dx < 0) = 放大, 右滑(dx > 0) = 缩小
            nextZoom = prev * (1 - dx * speedFactor);
          }
          return Math.min(Math.max(nextZoom, 0.1), 20);
        });
      } else {
        try {
          const viewport = getViewport();
          const rect = mainContainerRef.current?.getBoundingClientRect();
          const cx = e.clientX;
          const cy = e.clientY;

          const flowX = (cx - (rect ? rect.left : 0) - viewport.x) / viewport.zoom;
          const flowY = (cy - (rect ? rect.top : 0) - viewport.y) / viewport.zoom;

          let nextZoom = viewport.zoom;
          if (zDragButtonRef.current === 0) {
            // 左滑(dx < 0) = 放大, 右滑(dx > 0) = 缩小
            nextZoom = viewport.zoom * (1 - dx * speedFactor);
          }
          nextZoom = Math.min(Math.max(nextZoom, 0.05), 4);

          const nextX = cx - (rect ? rect.left : 0) - flowX * nextZoom;
          const nextY = cy - (rect ? rect.top : 0) - flowY * nextZoom;

          setViewport({ x: nextX, y: nextY, zoom: nextZoom });
        } catch (err) {
          console.error("Canvas Zoom adjustment error:", err);
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsZDragging(false);
      setActiveZButton(null);
      zDragButtonRef.current = -1;
      zDragStartPosRef.current = null;
      setCurrentSlideDirection('none');
    };

    // Suppress active system right-click context menu while Z key is held
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [isZMode, viewerNodeId, getViewport, setViewport, getZoom, viewerZoomScale]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow/type");
      const dataStr = event.dataTransfer.getData("application/reactflow/data");

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Handle internal drag and drop from sidebar
      if (type && dataStr) {
        const data = JSON.parse(dataStr);
        addNode(type as any, position.x - 150, position.y - 120, data);
        return;
      }

      // 1. Check if we have an image dragged from iframe (recorded via message listener)
      const draggedFromIframe = (window as any).__draggedImageFromIframe;
      if (draggedFromIframe) {
        const img = new Image();
        img.onload = () => {
          addNode("image-source", position.x - 150, position.y - 120, {
            url: draggedFromIframe,
            name: "Dragged Web Image",
            originalWidth: img.width,
            originalHeight: img.height,
          });
        };
        img.src = draggedFromIframe;
        // Clean up
        delete (window as any).__draggedImageFromIframe;
        return;
      }

      // Helper to check if URL is a likely image
      const isImgUrl = (url: string) => {
        if (!url) return false;
        if (url.startsWith("data:image/")) return true;
        return /\.(jpeg|jpg|gif|png|webp|svg|bmp|tiff|ico|apng)(\?.*)?$/i.test(url) || 
               url.includes("images") || 
               url.includes("img") || 
               url.includes("avatar") || 
               url.startsWith("blob:");
      };

      // 2. Try to read dropped image URLs from external tabs/browser drag-and-drop
      const uriList = event.dataTransfer.getData("text/uri-list");
      const htmlText = event.dataTransfer.getData("text/html");
      const plainText = event.dataTransfer.getData("text/plain");

      let possibleImageUrl = "";
      let droppedName = "Dropped Image";

      if (uriList) {
        possibleImageUrl = uriList.split("\n")[0].trim();
      } else if (plainText && (plainText.startsWith("http://") || plainText.startsWith("https://") || plainText.startsWith("data:image/"))) {
        possibleImageUrl = plainText.trim();
      } else if (htmlText) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlText, "text/html");
          const img = doc.querySelector("img");
          if (img && img.src) {
            possibleImageUrl = img.src;
            droppedName = img.alt || "Dropped Image";
          }
        } catch (e) {
          console.error("Failed to parse html during drop", e);
        }
      }

      if (possibleImageUrl && isImgUrl(possibleImageUrl)) {
        const img = new Image();
        img.onload = () => {
          addNode("image-source", position.x - 150, position.y - 120, {
            url: possibleImageUrl,
            name: droppedName,
            originalWidth: img.width,
            originalHeight: img.height,
          });
        };
        img.src = possibleImageUrl;
        return;
      }

      // 3. Handle external file drop
      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        const imageFiles = Array.from(files).filter((file: File) => file.type.startsWith("image/"));
        if (imageFiles.length > 0) {
          const colSpacing = 440;
          const rowSpacing = 640;
          const maxCols = 10;
          
          imageFiles.forEach((file: File, index: number) => {
            const col = index % maxCols;
            const row = Math.floor(index / maxCols);
            
            const x = position.x + col * colSpacing;
            const y = position.y + row * rowSpacing;

            const nodeId = "node_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
            const dbCacheKey = `db_blob:${nodeId}`;
            
            // Asynchronously persist the original Blob in IndexedDB without lagging the rendering thread
            idbSet(dbCacheKey, file).catch(err => {
              console.error("Failed to store drop file into IDB", err);
            });

            // Fast, synchronous, allocation-free object URL to inspect image dimensions
            const tempUrl = URL.createObjectURL(file);
            const img = new Image();
            
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2) + "M";
            const ext = file.name.split('.').pop()?.toUpperCase() || "JPEG";

            img.onload = () => {
              const ratio = img.width / img.height;
              const displayWidth = Math.min(img.width, 320);
              const displayHeight = Math.round(displayWidth / ratio);

              addNode("image-source", x, y, {
                url: dbCacheKey,
                name: file.name,
                originalWidth: img.width,
                originalHeight: img.height,
                aspectRatio: ratio,
                width: displayWidth,
                height: displayHeight,
                fileSize: sizeMB,
                fileType: ext,
                style: {
                  width: displayWidth,
                  height: displayHeight
                }
              }, nodeId);
              
              URL.revokeObjectURL(tempUrl);
            };
            img.onerror = () => {
              // Graceful fallback of standard sizes if dimensions fail to read
              addNode("image-source", x, y, {
                url: dbCacheKey,
                name: file.name,
                originalWidth: 400,
                originalHeight: 300,
                aspectRatio: 1.33,
                width: 320,
                height: 240,
                fileSize: sizeMB,
                fileType: ext,
                style: {
                  width: 320,
                  height: 240
                }
              }, nodeId);
              URL.revokeObjectURL(tempUrl);
            };
            img.src = tempUrl;
          });
        }
        const isTextFile = (file: File) => {
          const type = file.type;
          const name = file.name.toLowerCase();
          return type.startsWith("text/") || 
                 type === "application/json" ||
                 name.endsWith(".txt") || 
                 name.endsWith(".md") ||
                 name.endsWith(".json") ||
                 name.endsWith(".csv") ||
                 name.endsWith(".xml") ||
                 name.endsWith(".log") ||
                 name.endsWith(".yaml") ||
                 name.endsWith(".yml") ||
                 name.endsWith(".html") ||
                 name.endsWith(".js") ||
                 name.endsWith(".ts") ||
                 name.endsWith(".jsx") ||
                 name.endsWith(".tsx") ||
                 name.endsWith(".css");
        };

        const textFiles = Array.from(files).filter(isTextFile);
        if (textFiles.length > 0) {
          const processTextFiles = async () => {
            for (let index = 0; index < textFiles.length; index++) {
              try {
                const file = textFiles[index];
                const textContent = await file.text();
                if (textContent) {
                  const rowSpacing = 200;
                  const yOffset = index * rowSpacing;
                  addNode("text-source", position.x - 150, position.y - 120 + yOffset, {
                    text: textContent,
                    name: file.name
                  });
                  // Add a small delay to avoid freezing UI and allow React to batch render
                  await new Promise(res => setTimeout(res, 50));
                }
              } catch (err) {
                console.error("Failed to read text file", err);
              }
            }
          };
          processTextFiles();
        }
      } else if (plainText && !isImgUrl(plainText.trim())) {
        addNode("text-source", position.x - 150, position.y - 120, {
          text: plainText,
          name: "源文本"
        });
      }
    },
    [screenToFlowPosition, addNode],
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Ignore paste if user is typing in an input field
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement as HTMLElement).isContentEditable
      ) {
        return;
      }

      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        const position = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        addNode("text-source", position.x - 150, position.y - 120, { text, name: "源文本" });
      }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [screenToFlowPosition, addNode]);

  const [isCanvasDragging, setIsCanvasDragging] = useState(false);
  const dragCounter = useRef(0);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounter.current++;
    setIsCanvasDragging(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsCanvasDragging(false);
    }
  }, []);

  const onDropExtended = useCallback(
    (event: React.DragEvent) => {
      dragCounter.current = 0;
      setIsCanvasDragging(false);
      onDrop(event);
    },
    [onDrop],
  );

  return (
    <>


      {/* Main Workspace */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Top Hover Sensor */}
        <div 
          onMouseEnter={() => setIsTopHeaderHovered(true)}
          className="fixed top-0 left-0 right-0 h-3 z-40 pointer-events-auto"
        />

        {/* Top Header */}
        <header
          onMouseEnter={() => setIsTopHeaderHovered(true)}
          onMouseLeave={() => setIsTopHeaderHovered(false)}
          className={`fixed top-0 left-0 right-0 h-16 border-b border-[var(--border)] flex items-center justify-between px-6 z-40 transition-all duration-300 ease-in-out ${
            isTopHeaderHovered
              ? "translate-y-0 opacity-100 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
              : "translate-y-[-100%] opacity-0 pointer-events-none"
          } ${
            settings.barTexture === "frosted"
              ? "frosted-glass border-b-white/5"
              : "bg-[var(--bg-secondary)]"
          }`}
        >
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold tracking-wider text-gray-400 font-mono">
              NEXT VISION NODE PRO
            </h1>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-[var(--border)] rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                LIVE SYNC
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 p-1 bg-white/5 border border-[var(--border)] rounded-xl">
              <TopBarButton
                icon={<Globe2 size={16} />}
                label="网页预览节点"
                onClick={() => useStore.getState().toggleWebPreview()}
              />
              <TopBarButton
                icon={<Monitor size={16} />}
                label="ComfyUI 端口"
                onClick={() => handleAddNode("comfyui-node")}
              />
              <TopBarButton
                icon={<Monitor size={16} />}
                label="Native Host"
                onClick={() => handleAddNode("native-host")}
              />
              <TopBarButton
                icon={<Images size={16} />}
                label="图像列表"
                onClick={() => handleAddNode("io-image-list")}
              />
              <div className="w-px h-4 bg-white/10 mx-1" />
              <TopBarButton
                icon={<ScanSearch size={16} />}
                label="图片反推"
                onClick={() => handleAddNode("reverse")}
              />
              <div className="w-px h-4 bg-white/10 mx-1" />
              <TopBarButton
                icon={<Box size={16} />}
                label="双框转换"
                onClick={() => handleAddNode("double-box-transform")}
              />
            </div>
          </div>
        </header>

        {/* Canvas Area */}
        <main
          ref={mainContainerRef}
          className={`flex-1 overflow-hidden relative group/canvas transition-all border-4 ${
            isCanvasDragging
              ? "border-accent/50 bg-accent/5"
              : "border-transparent"
          }`}
        >
          <ReactFlow
            nodes={highlightedNodes}
            edges={visibleEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnectExtended}
            onConnectStart={onConnectStartExtended}
            onConnectEnd={onConnectEndExtended}
            onNodeDragStart={() => takeSnapshot()}
            onSelectionDragStart={() => takeSnapshot()}
            nodesDraggable={isZMode ? false : (!isConnecting && activeOp === null)}
            nodeTypes={nodeTypes}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={onPaneClick}
            onNodeClick={onNodeClick}
            onDrop={onDropExtended}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            fitView
            snapToGrid={settings.snapToGrid}
            snapGrid={[24, 24]}
            className={`bg-[var(--bg-primary)] ${
              isZMode 
                ? activeZButton === 0 
                  ? '!cursor-zoom-out' 
                  : '!cursor-zoom-in' 
                : ''
            }`}
            minZoom={0.05}
            maxZoom={4}
            panOnDrag={isZMode ? false : (activeOp === null ? [1] : false)}
            zoomOnScroll={isZMode ? false : (activeOp === null)}
            zoomOnPinch={isZMode ? false : (activeOp === null)}
            zoomOnDoubleClick={isZMode ? false : (activeOp === null)}
            selectionOnDrag={isZMode ? false : true}
            selectionMode={SelectionMode.Partial}
            connectionRadius={60}
            connectOnClick={true}
            connectionLineStyle={{ strokeWidth: 4, stroke: "#38bdf8" }}
            defaultEdgeOptions={{
              style: { strokeWidth: 3, stroke: "#94a3b8" },
              type: "bezier",
            }}
          >
            {isGridVisible && (
              <Background
                color="var(--border)"
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1}
              />
            )}

            {isMiniMapVisible && (
              <MiniMap
                zoomable
                pannable
                className="!bg-[var(--bg-secondary)] !border-[var(--border)] !rounded-2xl !overflow-hidden !m-6 !shadow-2xl !w-[200px] !h-[120px]"
                nodeColor={(node) => {
                  switch (node.type) {
                    case "image-gen":
                      return "var(--accent)";
                    case "prompt-engine":
                      return "#a855f7";
                    case "image-source":
                      return "#22c55e";
                    case "text-source":
                    case "text-gen":
                    case "text":
                      return "#f59e0b";
                    default:
                      return "var(--border)";
                  }
                }}
                maskColor="rgba(0,0,0,0.5)"
              />
            )}

            {/* Bottom Hover Sensor */}
            <div 
              onMouseEnter={() => setIsBottomHovered(true)}
              className="fixed bottom-0 left-0 right-0 h-10 z-30 pointer-events-auto"
            />

            <Panel position="bottom-left" className="m-6 flex flex-col gap-4">
              <div
                onMouseEnter={() => setIsBottomHovered(true)}
                onMouseLeave={() => setIsBottomHovered(false)}
                className={`flex items-center gap-2 p-1.5 border border-[var(--border)] rounded-2xl shadow-2xl transition-all duration-300 ease-in-out ${
                  (isBottomHovered || isBottomPinned)
                    ? "translate-y-0 opacity-100 pointer-events-auto shadow-black/50"
                    : "translate-y-[150%] opacity-0 pointer-events-none"
                } ${
                  settings.barTexture === "frosted"
                    ? "frosted-glass border-[var(--border)] shadow-black/20"
                    : "bg-[var(--bg-tertiary)]"
                }`}
              >
                <ToolbarButton
                  icon={<MapIcon size={18} />}
                  onClick={toggleMiniMap}
                  active={isMiniMapVisible}
                  title="开启/关闭小地图 (M)"
                />
                <ToolbarButton
                  icon={<Grid size={18} />}
                  onClick={toggleGrid}
                  active={isGridVisible}
                  title="开启/关闭背景网格 (L)"
                />
                <ToolbarButton
                  icon={<Maximize2 size={18} />}
                  onClick={() => fitView()}
                  title="适应画布 (F)"
                />
                <ToolbarButton
                  icon={<Keyboard size={18} />}
                  onClick={() => setShowHotkeyGuide((v) => !v)}
                  active={showHotkeyGuide}
                  title="快捷键提示 HUD (K)"
                />
                <div className="w-px h-4 bg-[#333] mx-1" />
                <ZoomDisplay />
                <div className="w-px h-4 bg-[#333] mx-1" />
                <ToolbarButton
                  icon={<Pin size={18} />}
                  onClick={() => setIsBottomPinned(!isBottomPinned)}
                  active={isBottomPinned}
                  className={isBottomPinned ? "text-[#5cb0ff] hover:bg-[#5cb0ff]/10" : "text-gray-400 hover:bg-gray-400/10"}
                  title={isBottomPinned ? "取消固定底部栏" : "固定底部栏"}
                />
              </div>
            </Panel>

            <Panel position="bottom-right" className="m-6">
              <div
                onMouseEnter={() => setIsBottomHovered(true)}
                onMouseLeave={() => setIsBottomHovered(false)}
                className={`flex items-center gap-2 p-1 border border-[var(--border)] rounded-2xl shadow-2xl transition-all duration-300 ease-in-out ${
                  (isBottomHovered || isBottomPinned)
                    ? "translate-y-0 opacity-100 pointer-events-auto shadow-black/50"
                    : "translate-y-[150%] opacity-0 pointer-events-none"
                } ${
                  settings.barTexture === "frosted"
                    ? "frosted-glass border-[var(--border)] shadow-black/20"
                    : "bg-[var(--bg-tertiary)]"
                }`}
              >
                <button className="p-3 hover:bg-[var(--bg-tertiary)] rounded-xl text-[var(--text-secondary)] transition-all">
                  <Search size={20} />
                </button>
              </div>
            </Panel>

            <Panel position="bottom-center" className="mb-6 z-[99] pointer-events-auto">
              <div
                onMouseEnter={() => setIsBottomHovered(true)}
                onMouseLeave={() => setIsBottomHovered(false)}
                className={`transition-all duration-300 ease-in-out ${
                  (isBottomHovered || isBottomPinned)
                    ? "translate-y-0 opacity-100"
                    : "translate-y-[150%] opacity-0 pointer-events-none"
                }`}
              >
                <AnimatePresence mode="wait">
                {activeOp ? (
                  <motion.div
                    key="active-op"
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 px-6 py-3 bg-[#0a0a0a]/95 backdrop-blur-md border border-accent/40 rounded-full shadow-2xl select-none"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                    <span className="text-xs font-bold text-gray-200 uppercase tracking-widest font-sans flex items-center gap-2">
                      {activeOp === "move" ? (
                        <>
                          <span className="text-accent font-black">MOVE ACTIVE</span>
                          <span className="text-gray-500">|</span>
                          <span className="text-gray-400">Glide mouse to move selected nodes</span>
                        </>
                      ) : (
                        <>
                          <span className="text-accent font-black">SCALE ACTIVE</span>
                          <span className="text-gray-500">|</span>
                          <span className="text-gray-400">Scroll wheel to scale selected nodes</span>
                        </>
                      )}
                      <span className="text-gray-500 font-normal text-xs ml-2">
                        (Left-Click / Apply, Right-Click / Cancel)
                      </span>
                    </span>
                  </motion.div>
                ) : showHotkeyGuide ? (
                  <motion.div
                    key="hotkey-guide"
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-4 px-5 py-2.5 bg-black/95 backdrop-blur-md border border-[var(--border)] rounded-full shadow-2xl select-none"
                  >
                    <span className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider pr-4 border-r border-[#333]">
                      <Keyboard size={14} className="text-accent" />
                      快捷操作
                    </span>
                    
                    <div className="flex items-center gap-4 text-xs font-semibold text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded font-mono text-[10px] text-white">G</kbd>
                        <span className="text-gray-400 font-normal">移动此节点</span>
                      </div>
                      <span className="text-gray-600">/</span>
                      <div className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded font-mono text-[10px] text-white">S</kbd>
                        <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded font-mono text-[10px] text-white">R</kbd>
                        <span className="text-gray-400 font-normal">等比放缩</span>
                      </div>
                      <span className="text-gray-600">/</span>
                      <div className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded font-mono text-[10px] text-white">Alt + 右键划线</kbd>
                        <span className="text-gray-400 font-normal">切刀删线</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowHotkeyGuide(false)}
                      className="p-1 hover:bg-white/5 text-gray-500 hover:text-white rounded-full transition-all"
                      title="隐藏快捷指示 (K)"
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              </div>
            </Panel>

            {/* Context Menu */}
            {menu && (
              <Panel
                position="top-left"
                style={{ left: menu.screenX, top: menu.screenY }}
              >
                <div className="bg-[var(--bg-tertiary)]/95 backdrop-blur-xl border border-[var(--border)] rounded-2xl shadow-2xl w-56 py-2 z-[1000] animate-in fade-in zoom-in duration-100">
                  <ContextMenuGroup label="添加节点">
                    <ContextSubMenuItem label="生成节点" icon={<Sparkles size={12} />}>
                      <ContextMenuItem
                        label="生成图像"
                        icon={<ImageIcon size={12} />}
                        onClick={() =>
                          handleAddNode("image-gen", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="生成文本"
                        icon={<Sparkles size={12} />}
                        onClick={() =>
                          handleAddNode("text-gen", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="逻辑引擎"
                        icon={<Brain size={12} />}
                        onClick={() =>
                          handleAddNode("logic-engine", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="翻译引擎"
                        icon={<Languages size={12} />}
                        onClick={() =>
                          handleAddNode("translate-engine", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="Fusion Master"
                        icon={<LayoutGrid size={12} />}
                        onClick={() =>
                          handleAddNode("fusion-master", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="3D 空间视角"
                        icon={<Move3d size={12} />}
                        onClick={() =>
                          handleAddNode("spatial-view", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="AI 增强型 PS 引擎"
                        icon={<Layers size={12} />}
                        onClick={() =>
                          handleAddNode("ai-ps-engine", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem label="生成视频" disabled />
                      <ContextMenuItem label="生成音频" disabled />
                      <ContextMenuItem label="360 全景图" disabled />
                    </ContextSubMenuItem>
                    <ContextSubMenuItem label="源节点" icon={<FolderOpen size={12} />}>
                      <ContextMenuItem
                        label="源文本"
                        icon={<Type size={12} />}
                        onClick={() =>
                          handleAddNode("text-source", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="源图像"
                        icon={<ImageIcon size={12} />}
                        onClick={() =>
                          handleAddNode("image-source", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="网页预览节点"
                        icon={<Globe2 size={12} />}
                        onClick={() =>
                          handleAddNode("apt-web-tool", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="ComfyUI 端口"
                        icon={<Monitor size={12} />}
                        onClick={() =>
                          handleAddNode("comfyui-node", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="网页采集节点"
                        icon={<Database size={12} />}
                        onClick={() => handleAddNode("web-scrape", menu.x, menu.y)}
                      />
                      <ContextMenuItem
                        label="网页截图节点"
                        icon={<Camera size={12} />}
                        onClick={() => handleAddNode("web-screenshot", menu.x, menu.y)}
                      />
                      <ContextMenuItem
                        label="网页转文本节点"
                        icon={<FileJson size={12} />}
                        onClick={() => handleAddNode("web-to-text", menu.x, menu.y)}
                      />
                      <ContextMenuItem
                        label="Native Host - 本地宿主"
                        icon={<Monitor size={12} />}
                        onClick={() =>
                          handleAddNode("native-host", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="加载图像列表"
                        icon={<Images size={12} />}
                        onClick={() =>
                          handleAddNode("io-image-list", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="图片反推"
                        icon={<ScanSearch size={12} />}
                        onClick={() => handleAddNode("reverse", menu.x, menu.y)}
                      />
                      <ContextMenuItem
                        label="双框坐标转换"
                        icon={<Box size={12} />}
                        onClick={() =>
                          handleAddNode("double-box-transform", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem label="源视频" disabled />
                      <ContextMenuItem label="源音频" disabled />
                    </ContextSubMenuItem>
                  </ContextMenuGroup>
                  <div className="h-px bg-[#333] my-1 mx-2" />
                  <ContextMenuItem
                    label="复制"
                    sub="Ctrl C"
                    disabled={!nodes.some((n) => n.selected)}
                    onClick={() => {
                      copySelectedNodes();
                      setMenu(null);
                    }}
                    icon={<Copy size={12} />}
                  />
                  <ContextMenuItem
                    label="粘贴"
                    sub="Ctrl V"
                    disabled={copiedNodes.length === 0}
                    onClick={() => {
                      pasteNodes({ x: menu.x, y: menu.y });
                      setMenu(null);
                    }}
                    icon={<Copy size={12} />}
                  />
                  <ContextMenuItem
                    label="撤销"
                    sub="Ctrl Z"
                    disabled={undoStack.length === 0}
                    onClick={() => {
                      undo();
                      setMenu(null);
                    }}
                    icon={<Undo2 size={12} />}
                  />
                  <ContextMenuItem
                    label="重做"
                    sub="Ctrl Y"
                    disabled={redoStack.length === 0}
                    onClick={() => {
                      redo();
                      setMenu(null);
                    }}
                    icon={<Redo2 size={12} />}
                  />
                </div>
              </Panel>
            )}

            <AlignmentToolbar />
          </ReactFlow>

          {/* Cutting Overlay SVG (Alt + Drag Right-Click) */}
          {cuttingPoints.length > 1 && (
            <svg className="absolute inset-0 pointer-events-none z-[9999]">
              {/* Dark subtle shadow/backing stroke to maximize readability over light node contents and images */}
              <path
                d={`M ${cuttingPoints[0].x} ${cuttingPoints[0].y} ` + cuttingPoints.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")}
                fill="none"
                stroke="rgba(0, 0, 0, 0.4)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* High-fidelity glowing white core stroke representing the laser-like blade cut path */}
              <path
                d={`M ${cuttingPoints[0].x} ${cuttingPoints[0].y} ` + cuttingPoints.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")}
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: "drop-shadow(0 0 1px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 4px rgba(255, 255, 255, 0.6))",
                }}
              />
            </svg>
          )}
        </main>
      </div>

      {/* Right Assistant Panel */}
      <AnimatePresence>
        {showAssistant && (
          isAssistantMinimized ? (
            <motion.div
              drag
              dragMomentum={false}
              dragElastic={0.08}
              onDoubleClick={() => setIsAssistantMinimized(false)}
              initial={{ opacity: 0, scale: 0.8, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 100 }}
              className="fixed bottom-24 right-8 z-[9999] p-3 pl-4 bg-[var(--bg-secondary)] border border-[var(--accent)] hover:border-[var(--accent)]/80 text-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.65)] flex items-center gap-3 cursor-grab active:cursor-grabbing backdrop-blur-md select-none group border-glow transition-all duration-200"
              style={{ touchAction: "none" }}
            >
              <div className="relative pointer-events-none">
                <div className="w-10 h-10 rounded-xl bg-[linear-gradient(135deg,var(--accent),#818cf8)] flex items-center justify-center text-white shadow-lg shadow-accent/20">
                  <Sparkles size={18} className="animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-[var(--bg-secondary)] animate-bounce" />
              </div>
              <div className="flex flex-col text-left pointer-events-none">
                <span className="text-[11px] font-black text-gray-200 uppercase tracking-widest leading-none mb-1">
                  AI ASSISTANT
                </span>
                <span className="text-[9px] text-gray-400 font-medium">
                  已最小化 · 双击展开
                </span>
              </div>
              <div className="flex items-center gap-1.5 ml-2 border-l border-[var(--border)] pl-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAssistantMinimized(false);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
                  title="展开助手"
                >
                  <Maximize2 size={13} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAssistant();
                  }}
                  className="p-1.5 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                  title="关闭"
                >
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Right Assistant Hover Sensor */}
              <div 
                onMouseEnter={() => setIsAssistantHovered(true)}
                className={`fixed right-0 top-0 bottom-0 w-3 z-40 pointer-events-auto ${(isAssistantMaximized || isAssistantPinned) ? "hidden" : ""}`}
              />
              <motion.div
                onMouseEnter={() => setIsAssistantHovered(true)}
                onMouseLeave={() => setIsAssistantHovered(false)}
                initial={{ x: 400, width: "400px" }}
                animate={{ 
                  x: (isAssistantMaximized || isAssistantPinned || isTextareaFocused || inputText.trim() !== '') ? 0 : (isAssistantHovered ? 0 : 400),
                  width: isAssistantMaximized ? "100vw" : "400px"
                }}
                exit={{ x: 400 }}
                transition={{ type: "tween", duration: 0.3 }}
                className="fixed right-0 top-0 bottom-0 bg-[var(--bg-secondary)] border-l border-[var(--border)] flex flex-col z-50 overflow-hidden shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
              >
              <div
                className={`p-6 flex items-center justify-between border-b border-[var(--border)] transition-all ${
                  settings.barTexture === "frosted"
                    ? "frosted-glass border-b-white/5"
                    : "bg-[var(--bg-secondary)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                  <span className="text-base font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase">
                    NEXT GEN ASSISTANT
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAssistantPinned(!isAssistantPinned)}
                    className={`p-2 rounded-lg transition-colors ${
                      isAssistantPinned 
                        ? "text-[var(--accent)] hover:bg-[var(--accent)]/10" 
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    }`}
                    title={isAssistantPinned ? "启用悬浮自动隐藏" : "固定住助手 (常驻)"}
                  >
                    {isAssistantPinned ? <Pin size={16} className="fill-[var(--accent)]/15" /> : <PinOff size={16} />}
                  </button>
                  <button
                    onClick={() => {
                      setIsAssistantMinimized(true);
                      setIsAssistantMaximized(false);
                    }}
                    className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] transition-colors"
                    title="最小化悬浮到画布"
                  >
                    <Minus size={16} />
                  </button>
                  <button 
                    onClick={() => setIsAssistantMaximized(!isAssistantMaximized)}
                    className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] transition-colors"
                    title={isAssistantMaximized ? "侧边栏模式" : "全屏模式"}
                  >
                    {isAssistantMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button
                    onClick={() => {
                      toggleAssistant();
                      setIsAssistantMaximized(false);
                      setIsAssistantMinimized(false);
                    }}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                    title="关闭助手"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar bg-[var(--bg-primary)]/50 relative">
              {/* Elegant floating feedback notification toast */}
              <AnimatePresence>
                {chatNotification && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--bg-tertiary)] border border-[var(--accent)] text-white font-bold rounded-xl px-4 py-2 text-xs flex items-center gap-2 shadow-2xl z-[90] pointer-events-none whitespace-nowrap"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                    <span>{chatNotification}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {chatHistory.length === 0 ? (
                <>
                  <div className="flex flex-col gap-2 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20">
                        <Sparkles size={16} />
                      </div>
                      <span className="text-lg font-bold text-gray-300">
                        Creator Mode Active
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-white mt-2 leading-tight">
                      你好胡伟，
                      <br />
                      今天我们创造什么？
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <SuggestionCard
                      icon={<Compass size={16} />}
                      title="寻找创作灵感"
                      onClick={() => setInputText("寻找创作灵感")}
                    />
                    <SuggestionCard
                      icon={<Sparkles size={16} />}
                      title="优化提示词 DNA"
                      onClick={() => setInputText("优化提示词 DNA")}
                    />
                    <SuggestionCard
                      icon={<Cloud size={16} />}
                      title="生成环境模拟"
                      onClick={() => setInputText("生成环境模拟")}
                    />
                    <SuggestionCard
                      icon={<ImageIcon size={16} />}
                      title="批量节点管理"
                      onClick={() => setInputText("批量节点管理")}
                    />
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-50 py-12">
                    <MessageSquare size={48} strokeWidth={1} />
                    <span className="text-sm font-bold mt-4 tracking-[0.3em] uppercase">
                      Ready for instruction
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  {chatHistory.map((msg: any, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-lg flex flex-col gap-2 ${
                          msg.role === "user"
                            ? "bg-accent text-white shadow-lg shadow-accent/10 rounded-tr-none"
                            : "bg-[var(--bg-tertiary)] border border-[var(--border)] text-gray-300 rounded-tl-none font-sans leading-relaxed"
                        }`}
                      >
                        {/* Inline attachments inside chat bubbles */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className={`flex flex-wrap gap-2 mb-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.attachments.map((att: any, aIdx: number) => (
                              <div
                                key={aIdx}
                                className={`flex items-center gap-2 p-2 rounded-xl text-xs leading-tight max-w-[180px] border ${
                                  msg.role === 'user'
                                    ? 'bg-white/10 border-white/5 text-white'
                                    : 'bg-white/5 border-[var(--border)] text-gray-300'
                                }`}
                              >
                                {att.type?.startsWith('image/') ? (
                                  <img src={att.base64} className="w-8 h-8 object-cover rounded-lg bg-black/40" alt={att.name} />
                                ) : (
                                  <div className="w-8 h-8 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
                                    <FileText size={14} />
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0 text-left">
                                  <span className="font-bold truncate text-[11px] block text-white leading-none mb-0.5">{att.name}</span>
                                  <span className="text-[9px] text-gray-400 uppercase tracking-wider block">
                                    {att.type?.split('/')?.[1] || 'txt'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="whitespace-pre-line">{msg.content}</div>

                        {/* Copy & Feedback action bar for assistant messages */}
                        {msg.role === "assistant" && msg.content && (
                          <div className="flex items-center gap-3.5 mt-2.5 pt-2 border-t border-[var(--border)] text-gray-400 justify-start w-full nodrag select-none">
                            <button
                              onClick={() => handleRateMessage(idx, "like")}
                              className={`p-1 rounded transition-colors ${
                                msg.feedback === "like" ? "text-green-400" : "text-gray-500 hover:text-white"
                              }`}
                              title="对回答满意"
                            >
                              <ThumbsUp size={14} className={msg.feedback === "like" ? "fill-green-400/20" : ""} />
                            </button>

                            <button
                              onClick={() => handleRateMessage(idx, "dislike")}
                              className={`p-1 rounded transition-colors ${
                                msg.feedback === "dislike" ? "text-red-400" : "text-gray-500 hover:text-white"
                              }`}
                              title="对回答不满意"
                            >
                              <ThumbsDown size={14} className={msg.feedback === "dislike" ? "fill-red-400/20" : ""} />
                            </button>

                            <button
                              onClick={() => handleRegenerateMessage(idx)}
                              disabled={isTyping}
                              className="p-1 rounded text-gray-500 hover:text-white transition-colors disabled:opacity-40"
                              title="重新生成"
                            >
                              <RotateCw size={14} className={isTyping ? "animate-spin" : ""} />
                            </button>

                            <button
                              onClick={() => handleCopyMessage(idx, msg.content)}
                              className="p-1 rounded text-gray-500 hover:text-white transition-colors flex items-center gap-1"
                              title="复制全文"
                            >
                              {copiedMessageIdx === idx ? (
                                <>
                                  <Check size={14} className="text-green-400 animate-pulse" />
                                  <span className="text-[10px] text-green-400 font-bold">已复制</span>
                                </>
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>

                            <button
                              onClick={() => setSelectiveCopyMsg({ index: idx, content: msg.content })}
                              className="p-1 rounded text-gray-500 hover:text-white transition-colors"
                              title="选择性复制..."
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl rounded-tl-none px-4 py-3 flex gap-1">
                        <div
                          className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            <div
              className={`p-6 border-t border-[var(--border)] space-y-4 transition-all relative ${
                settings.barTexture === "frosted"
                  ? "frosted-glass border-t-white/5"
                  : "bg-[var(--bg-secondary)]"
              }`}
            >
              {/* Draft File Attachment Previews */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2 max-h-36 overflow-y-auto custom-scrollbar nodrag">
                  {attachedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-2 pr-1 text-xs text-white max-w-[185px] shrink-0 hover:bg-white/10 transition-all relative"
                    >
                      {file.type?.startsWith("image/") ? (
                        <img
                          src={file.base64}
                          alt={file.name}
                          className="w-10 h-10 object-cover rounded-lg bg-black/40"
                        />
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
                          <FileText size={18} />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0 pr-4">
                        <span className="font-bold truncate text-gray-200 block text-[11px] leading-tight max-w-[110px]">
                          {file.name}
                        </span>
                        <span className="text-[9px] text-gray-400 uppercase tracking-wider block mt-0.5">
                          {file.type?.split("/")[1] || "txt"} ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        onClick={() => setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id))}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors absolute right-1 top-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative group">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onFocus={() => setIsTextareaFocused(true)}
                  onBlur={() => setIsTextareaFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className={`w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl p-4 pr-12 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50 resize-none min-h-[100px] placeholder:text-[var(--text-secondary)]/50 group-hover:border-[var(--border)] transition-all ${
                    typeof settings.inputFontSize === "number"
                      ? ""
                      : settings.inputFontSize === "large"
                        ? "text-lg"
                        : settings.inputFontSize === "small"
                          ? "text-sm"
                          : "text-lg"
                  }`}
                  placeholder={isListening ? "正在聆听语音输入..." : "描述想法，Gemini 1.5 为你护航..."}
                  style={{
                    fontSize:
                      typeof settings.inputFontSize === "number"
                        ? `${settings.inputFontSize}px`
                        : undefined,
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={(!inputText.trim() && attachedFiles.length === 0) || isTyping}
                  className="absolute right-3 bottom-3 p-2 bg-accent hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg transition-all active:scale-90"
                >
                  {isTyping ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ArrowUp size={18} />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between px-1 relative">
                <div className="flex items-center gap-4 relative z-50">
                  {/* Paperclip upload button with Popover Menu */}
                  <div className="relative">
                    <button 
                      onClick={() => {
                        setShowUploadMenu(!showUploadMenu);
                        setShowRecentFiles(false);
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        showUploadMenu ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <Paperclip size={18} />
                    </button>

                    {/* Popover/Menu customized exactly like Image 2 */}
                    <AnimatePresence>
                      {showUploadMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full left-0 mb-2 w-64 bg-[var(--bg-tertiary)] border border-[var(--border)] shadow-2xl rounded-2xl z-50 overflow-hidden nodrag p-2"
                        >
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => chatFileInputRef.current?.click()}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-xl text-left text-xs font-bold text-gray-200 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Paperclip size={16} className="text-gray-400" />
                                <span>添加照片和文件</span>
                              </div>
                              <span className="text-[10px] font-mono text-gray-500">Ctrl + U</span>
                            </button>

                            <button
                              onClick={() => setShowRecentFiles(!showRecentFiles)}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-xl text-left text-xs font-bold text-gray-200 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <FolderOpen size={16} className="text-gray-400" />
                                <span>近期文件</span>
                              </div>
                              <ChevronRight size={14} className={`text-gray-500 transition-transform ${showRecentFiles ? 'rotate-90' : ''}`} />
                            </button>

                            {/* Recent workspace files listing */}
                            {showRecentFiles && (
                              <div className="mt-1 pl-2 pr-1 py-1 max-h-40 overflow-y-auto custom-scrollbar border-t border-white/5 flex flex-col gap-1 bg-black/20 rounded-lg">
                                {files && files.length > 0 ? (
                                  files.slice(0, 5).map((fileItem: any) => (
                                    <button
                                      key={fileItem.id}
                                      onClick={() => handleAddRecentFile(fileItem)}
                                      className="w-full text-left p-1.5 rounded-lg hover:bg-white/5 flex items-center gap-2 text-[11px] text-gray-400 hover:text-white transition-colors"
                                    >
                                      {fileItem.type === "image" ? (
                                        <img src={fileItem.url} alt="" className="w-5 h-5 object-cover rounded-md" />
                                      ) : (
                                        <FileText size={12} className="text-blue-400" />
                                      )}
                                      <span className="truncate flex-1 font-mono">{fileItem.name}</span>
                                    </button>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-gray-600 p-2 text-center">暂无近期文件</span>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <input 
                      ref={chatFileInputRef} 
                      type="file" 
                      multiple 
                      className="hidden" 
                      onChange={handleChatFileUpload} 
                    />
                  </div>

                  {/* Microphone with Listening feedback */}
                  <button 
                    onClick={toggleSpeechRecognition}
                    className={`p-1.5 rounded-lg transition-transform relative ${
                      isListening 
                        ? 'bg-red-500/20 text-red-400 scale-110 shadow-[0_0_12px_rgba(239,68,68,0.4)]' 
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <Mic size={18} />
                    {isListening && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-400 rounded-full animate-ping" />
                    )}
                  </button>

                  {/* Complete Grounding Search button */}
                  <button 
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    title="联网谷歌搜索 (Google Search Grounding)"
                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      webSearchEnabled 
                        ? 'bg-[var(--accent)]/20 text-[var(--accent)] font-bold border border-[var(--accent)]/30 px-2' 
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <Search size={18} />
                    {webSearchEnabled && <span className="text-[10px]">联网开启</span>}
                  </button>
                </div>
                <div className="relative">
                  <div 
                    onClick={() => setShowModelPopup(!showModelPopup)}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-white/5 rounded-xl border border-[var(--border)] hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">
                      {(() => {
                        const activeId = settings.apiSettings.activeProfileId || settings.apiSettings.engine || 'gemini';
                        if (activeId === 'modelscope') {
                          return `ModelScope | ${settings.apiSettings.modelscopeSelectedChatModel || 'Default'}`;
                        }
                        const profilesList = settings.apiSettings.profiles || [];
                        const activeProf = profilesList.find((p: any) => p.id === activeId);
                        const profileName = activeProf ? activeProf.name : (settings.apiSettings.engine || '').toUpperCase();
                        const modelName = activeProf ? activeProf.modelId : (settings.apiSettings.modelId || '');
                        return `${profileName} | ${modelName}`;
                      })()}
                    </span>
                    <ChevronUp size={12} className="text-gray-500" />
                  </div>

                  <AnimatePresence>
                    {showModelPopup && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full right-0 mb-2 w-72 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 overflow-hidden p-3 flex flex-col gap-3"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            模型平台 / 服务商
                          </span>
                          <select
                            value={settings.apiSettings.activeProfileId || settings.apiSettings.engine || 'gemini'}
                            onChange={(e) => handlePlatformChange(e.target.value)}
                            className="w-full px-3 py-1.5 bg-[#121214]/60 border border-white/5 rounded-xl text-zinc-300 font-medium focus:border-indigo-500 hover:border-zinc-700 outline-none cursor-pointer text-xs"
                          >
                            {(settings.apiSettings.profiles && settings.apiSettings.profiles.length > 0) ? (
                              settings.apiSettings.profiles.map((p: any) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="gemini">Gemini 官方</option>
                                <option value="openai">OpenAI 官方</option>
                                <option value="claude">Claude 官方</option>
                                <option value="deepseek">DeepSeek 官方</option>
                                <option value="doubao">火山引擎 (豆包)</option>
                                <option value="qianwen">通义千问</option>
                              </>
                            )}
                            <option value="modelscope">ModelScope 平台</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            具体模型选择 (Chat / LLM)
                          </span>
                          <input
                            type="text"
                            value={assistantModelSearch}
                            onChange={(e) => setAssistantModelSearch(e.target.value)}
                            placeholder="🔍 检索过滤模型..."
                            className="w-full px-2.5 py-1.5 bg-black/40 border border-white/5 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 mb-1"
                          />
                          <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto custom-scrollbar bg-black/20 p-1.5 rounded-xl border border-white/5">
                            {(() => {
                              const filtered = chatModelsList.filter((model) => 
                                model.toLowerCase().includes(assistantModelSearch.toLowerCase())
                              );
                              const displayed = filtered.slice(0, 40);
                              
                              return (
                                <>
                                  {displayed.map((model) => {
                                    const activeId = settings.apiSettings.activeProfileId || settings.apiSettings.engine || 'gemini';
                                    const currentSelected = activeId === 'modelscope'
                                      ? settings.apiSettings.modelscopeSelectedChatModel
                                      : (() => {
                                          const prof = (settings.apiSettings.profiles || []).find((p: any) => p.id === activeId);
                                          return prof ? prof.modelId : settings.apiSettings.modelId;
                                        })();
                                    const isSelected = currentSelected === model;
                                    return (
                                      <button
                                        key={model}
                                        onClick={() => {
                                          handleModelSelect(model);
                                          setShowModelPopup(false);
                                          setAssistantModelSearch("");
                                        }}
                                        className={`w-full px-2.5 py-1.5 text-left rounded-lg text-xs font-semibold transition-all ${
                                          isSelected 
                                            ? "bg-indigo-600 text-white font-extrabold shadow-md"
                                            : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                        }`}
                                      >
                                        {model}
                                      </button>
                                    );
                                  })}
                                  {filtered.length > 40 && (
                                    <span className="text-[9px] text-zinc-500 text-center block py-1 font-mono">
                                      已截断显示前 40 个，输入关键词精准检索
                                    </span>
                                  )}
                                  {filtered.length === 0 && (
                                    <span className="text-[10px] text-zinc-500 text-center block py-3 font-mono">
                                      没有找到匹配的模型
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="h-px bg-white/5 my-0.5" />
                        
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            绘画引擎 / 生图
                          </span>
                          <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto">
                            <button
                              onClick={() => {
                                updateSettings({
                                  apiSettings: {
                                    ...settings.apiSettings,
                                    imageEngine: "online",
                                    imageModel: "Nano Banana Pro",
                                  },
                                });
                                setShowModelPopup(false);
                              }}
                              className={`px-2.5 py-1.5 text-left rounded-lg text-xs transition-colors ${
                                settings.apiSettings.imageEngine === "online" && settings.apiSettings.imageModel === "Nano Banana Pro"
                                  ? "bg-emerald-600 text-white font-bold"
                                  : "text-gray-300 hover:bg-white/5"
                              }`}
                            >
                              Nano Banana Pro
                            </button>
                            <button
                              onClick={() => {
                                updateSettings({
                                  apiSettings: {
                                    ...settings.apiSettings,
                                    imageEngine: "online",
                                    imageModel: "chatgptimage2",
                                  },
                                });
                                setShowModelPopup(false);
                              }}
                              className={`px-2.5 py-1.5 text-left rounded-lg text-xs transition-colors ${
                                settings.apiSettings.imageEngine === "online" && settings.apiSettings.imageModel === "chatgptimage2"
                                  ? "bg-emerald-600 text-white font-bold"
                                  : "text-gray-300 hover:bg-white/5"
                              }`}
                            >
                              ChatGPT Image 2
                            </button>
                            <button
                              onClick={() => {
                                updateSettings({
                                  apiSettings: {
                                    ...settings.apiSettings,
                                    imageEngine: "comfyui",
                                  },
                                });
                                setShowModelPopup(false);
                              }}
                              className={`px-2.5 py-1.5 text-left rounded-lg text-xs transition-colors ${
                                settings.apiSettings.imageEngine === "comfyui"
                                  ? "bg-emerald-600 text-white font-bold"
                                  : "text-gray-300 hover:bg-white/5"
                              }`}
                            >
                              Local ComfyUI
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
          </>
          )
        )}
      </AnimatePresence>

      {/* File Manager Sidebar */}
      {showFileManager && <FileManagerSidebar />}

      {/* Global High-Fidelity Fullscreen Image Viewer Modal */}
      <AnimatePresence>
        {viewerNodeId && activeViewerNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={(e) => {
              const delta = e.deltaY > 0 ? -0.15 : 0.15;
              setViewerZoomScale(Math.min(Math.max(viewerZoomScale + delta, 0.45), 6));
            }}
            className="fixed inset-0 z-[10000] bg-[#09090b]/98 flex flex-col justify-between overflow-hidden text-zinc-300 font-sans select-none"
          >
            {/* Top Bar */}
            <div className="w-full h-16 flex items-center justify-between px-6 bg-[#0c0c0e]/90 border-b border-zinc-900/80 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <ImageIcon size={18} className="text-sky-500" />
                <span className="text-sm font-semibold text-zinc-100 truncate max-w-[300px]">
                  {activeViewerNode.data?.name || "画布图像"}
                </span>
              </div>
              
              <button 
                onClick={() => setViewerNodeId(null)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-red-500/90 hover:border-red-500 shadow-lg cursor-pointer transition-all duration-150"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Interactive Viewing Stage */}
            <div 
              className={`w-full flex-1 relative flex items-center justify-center overflow-hidden bg-[#09090b] ${
                isZMode 
                  ? activeZButton === 0 
                    ? 'cursor-zoom-out' 
                    : 'cursor-zoom-in' 
                  : 'cursor-grab active:cursor-grabbing'
              }`}
              onMouseDown={(e) => {
                if (isZMode) return;
                if ((e.target as HTMLElement).closest('button')) return;
                
                const startX = e.clientX - viewerZoomOffset.x;
                const startY = e.clientY - viewerZoomOffset.y;
                const downX = e.clientX;
                const downY = e.clientY;
                const downTime = Date.now();
                
                const handleMouseMove = (mmE: MouseEvent) => {
                  setViewerZoomOffset({
                    x: mmE.clientX - startX,
                    y: mmE.clientY - startY
                  });
                };
                
                const handleMouseUp = (muE: MouseEvent) => {
                  window.removeEventListener('mousemove', handleMouseMove);
                  window.removeEventListener('mouseup', handleMouseUp);
                  
                  const dist = Math.sqrt(Math.pow(muE.clientX - downX, 2) + Math.pow(muE.clientY - downY, 2));
                  const duration = Date.now() - downTime;
                  
                  if (dist < 5 && duration < 250) {
                    setViewerZoomScale(prev => Math.min(prev + 0.5, 6));
                  }
                };
                
                window.addEventListener('mousemove', handleMouseMove);
                window.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <ViewerImageLoader 
                url={activeViewerNode.data?.url} 
                nodeId={activeViewerNode.id} 
                rotation={viewerRotation} 
                zoomScale={viewerZoomScale} 
                zoomOffset={viewerZoomOffset}
              />

              {/* Big Float Left Chevron Button */}
              {canvasImageNodes.length > 1 && (
                <button 
                  onClick={goViewerPrev}
                  className="absolute left-6 w-12 h-12 flex items-center justify-center rounded-full bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer z-50 group shadow-lg"
                >
                  <ChevronLeft size={24} />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3.5 hidden group-hover:block bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-200 rounded border border-zinc-850 whitespace-nowrap shadow-xl">
                    上一张(←)
                  </div>
                </button>
              )}

              {/* Big Float Right Chevron Button */}
              {canvasImageNodes.length > 1 && (
                <button 
                  onClick={goViewerNext}
                  className="absolute right-6 w-12 h-12 flex items-center justify-center rounded-full bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer z-50 group shadow-lg"
                >
                  <ChevronRight size={24} />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3.5 hidden group-hover:block bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-200 rounded border border-zinc-850 whitespace-nowrap shadow-xl">
                    下一张(→)
                  </div>
                </button>
              )}
            </div>

            {/* Minimap (鸟瞰图) overlay */}
            <AnimatePresence>
              {viewerShowMinimap && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute bottom-28 right-6 w-48 bg-[#0e0e11]/95 border border-zinc-800 rounded-xl p-3 flex flex-col shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-[10005]"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-900 mb-2">
                    <span className="text-[11px] font-bold text-zinc-400 tracking-wider">鸟瞰图</span>
                    <button 
                      onClick={() => setViewerShowMinimap(false)}
                      className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <div 
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      
                      const rect = e.currentTarget.getBoundingClientRect();
                      const centerX = rect.left + rect.width / 2;
                      const centerY = rect.top + rect.height / 2;
                      
                      const initialRelX = e.clientX - centerX;
                      const initialRelY = e.clientY - centerY;
                      
                      const scaleMultiplier = 18;
                      const startOffset = {
                        x: initialRelX * scaleMultiplier,
                        y: initialRelY * scaleMultiplier
                      };
                      setViewerZoomOffset(startOffset);
                      
                      const clickX = e.clientX;
                      const clickY = e.clientY;
                      
                      const handleMouseMove = (mmE: MouseEvent) => {
                        const dX = mmE.clientX - clickX;
                        const dY = mmE.clientY - clickY;
                        
                        setViewerZoomOffset({
                          x: startOffset.x + dX * scaleMultiplier,
                          y: startOffset.y + dY * scaleMultiplier
                        });
                      };
                      
                      const handleMouseUp = () => {
                        window.removeEventListener('mousemove', handleMouseMove);
                        window.removeEventListener('mouseup', handleMouseUp);
                      };
                      
                      window.addEventListener('mousemove', handleMouseMove);
                      window.addEventListener('mouseup', handleMouseUp);
                    }}
                    className="w-full h-24 relative rounded bg-zinc-950 flex items-center justify-center overflow-hidden border border-zinc-900 cursor-crosshair select-none"
                  >
                    <ViewerMinimapPreview url={activeViewerNode.data?.url || ""} />
                    {/* Highlight viewport area rectangle */}
                    <div 
                      style={{
                        width: `${Math.max(15, Math.min(100, 100 / viewerZoomScale))}%`,
                        height: `${Math.max(15, Math.min(100, 100 / viewerZoomScale))}%`,
                        transform: `translate(${viewerZoomOffset.x / 18}px, ${viewerZoomOffset.y / 18}px)`
                      }}
                      className="absolute border border-sky-500 bg-sky-500/10 pointer-events-none shadow-md"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Panel */}
            <div className="w-full flex flex-col items-center gap-3 pb-6 bg-[#0c0c0e]/95 border-t border-zinc-900 backdrop-blur-md pt-3 z-50">
              
              {/* Filmstrip Bar */}
              {viewerShowFilmstrip && (
                <div className="w-full max-w-5xl px-8 flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                  {canvasImageNodes.map((node: any) => (
                    <ViewerThumbnail 
                      key={node.id} 
                      url={node.data?.url} 
                      isSelected={node.id === viewerNodeId} 
                      onClick={() => {
                        setViewerNodeId(node.id);
                        setViewerZoomScale(1);
                        setViewerZoomOffset({ x: 0, y: 0 });
                        setViewerRotation(0);
                      }}
                    />
                  ))}
                  {canvasImageNodes.length > 20 && (
                    <div className="shrink-0 text-xs text-zinc-500 font-medium px-4 select-none">
                      查看更多
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Control Toolbar */}
              <div className="w-full max-w-5xl px-8 flex items-center justify-between mt-1 select-none">
                {/* File size & metrics */}
                <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                  <span>{activeViewerNode.data?.fileSize || "1.42M"}</span>
                  <span>
                    {activeViewerNode.data?.originalWidth 
                      ? `${activeViewerNode.data.originalWidth}*${activeViewerNode.data.originalHeight}像素` 
                      : "1920*1080像素"}
                  </span>
                  <span className="bg-zinc-900 border border-zinc-800 rounded px-1.5 text-[10px] text-zinc-400 font-bold uppercase font-sans">
                    {activeViewerNode.data?.fileType || "JPEG"}
                  </span>
                </div>

                {/* Toolbar buttons */}
                <div className="bg-[#151518]/95 backdrop-blur-md border border-zinc-800/85 rounded-full py-1.5 px-6 flex items-center gap-3 shadow-2xl">
                  {/* Prev */}
                  <button 
                    onClick={goViewerPrev}
                    disabled={canvasImageNodes.length <= 1}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent group relative transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 hidden group-hover:block bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-zinc-150 rounded border border-zinc-800 shadow-xl whitespace-nowrap">
                      上一张(←)
                    </div>
                  </button>

                  {/* Navigator Indicator */}
                  <span className="text-zinc-300 font-mono text-[13px] tracking-wider px-1">
                    {activeViewerIndex + 1}/{canvasImageNodes.length}
                  </span>

                  {/* Next */}
                  <button 
                    onClick={goViewerNext}
                    disabled={canvasImageNodes.length <= 1}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent group relative transition-colors cursor-pointer"
                  >
                    <ChevronRight size={16} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 hidden group-hover:block bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-zinc-150 rounded border border-zinc-800 shadow-xl whitespace-nowrap">
                      下一张(→)
                    </div>
                  </button>

                  <div className="w-px h-4 bg-zinc-800 mx-0.5" />

                  {/* Reset view: 1:1 text button to match Fig 3/4 precisely */}
                  <button 
                    onClick={() => { setViewerZoomScale(1); setViewerZoomOffset({ x: 0, y: 0 }); }}
                    className="px-2 py-0.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white text-xs font-extrabold font-mono transition-colors border border-zinc-850 cursor-pointer"
                    title="重置视图 (1:1)"
                  >
                    1:1
                  </button>

                  {/* Zoom Percent */}
                  <button 
                    onClick={() => { setViewerZoomScale(1); setViewerZoomOffset({ x: 0, y: 0 }); }}
                    className="text-zinc-400 hover:text-sky-400 font-mono text-xs font-bold px-1 min-w-[42px] text-center"
                    title="还原比例"
                  >
                    {Math.round(viewerZoomScale * 100)}%
                  </button>

                  {/* Zoom In */}
                  <button 
                    onClick={() => setViewerZoomScale(Math.min(viewerZoomScale + 0.15, 6))}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="放大"
                  >
                    <ZoomIn size={14} />
                  </button>

                  {/* Zoom Out */}
                  <button 
                    onClick={() => setViewerZoomScale(Math.max(viewerZoomScale - 0.15, 0.45))}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="缩小"
                  >
                    <ZoomOut size={14} />
                  </button>

                  <div className="w-px h-4 bg-zinc-800 mx-0.5" />

                  {/* Rotate Left */}
                  <button 
                    onClick={() => setViewerRotation((prev) => (prev - 90) % 360)}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="逆时针旋转"
                  >
                    <RotateCcw size={14} className="-scale-x-100" />
                  </button>

                  {/* Rotate Right */}
                  <button 
                    onClick={() => setViewerRotation((prev) => (prev + 90) % 360)}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="顺时针旋转"
                  >
                    <RotateCw size={14} />
                  </button>

                  {/* Delete Item from canvas */}
                  <button 
                    onClick={deleteViewerNode}
                    className="p-1.5 hover:bg-red-950 hover:text-red-400 rounded-lg text-zinc-400 transition-all cursor-pointer"
                    title="删除并在画布移出"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Right side controls switcher */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setViewerShowFilmstrip(!viewerShowFilmstrip)}
                    className={`p-2 rounded-xl transition-all border flex items-center justify-center cursor-pointer shadow-md ${
                      viewerShowFilmstrip 
                        ? 'bg-sky-600 border-sky-550 text-white' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                    title={viewerShowFilmstrip ? "隐藏缩略图栏" : "显示缩略图栏"}
                  >
                    <Grid size={16} />
                  </button>

                  <button 
                    onClick={() => setViewerShowMinimap(!viewerShowMinimap)}
                    className={`p-2 rounded-xl transition-all border flex items-center justify-center cursor-pointer shadow-md ${
                      viewerShowMinimap 
                        ? 'bg-sky-600 border-sky-550 text-white' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                    title="鸟瞰图切换"
                  >
                    <ScanSearch size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selective Copy Modal */}
      <AnimatePresence>
        {selectiveCopyMsg && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectiveCopyMsg(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-2xl rounded-2xl p-6 overflow-hidden max-h-[85vh] flex flex-col nodrag"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Copy size={16} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white leading-tight">选择性复制</h3>
                    <p className="text-xs text-gray-400">分段复制指定文本块，可直接编辑后整段提取</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectiveCopyMsg(null)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4 text-left">
                {/* Editable Sandbox area */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">快捷选择与编辑区 (Sandbox Editor)</label>
                  <div className="relative group">
                    <textarea
                      value={selectiveCopyMsg.content}
                      onChange={(e) => setSelectiveCopyMsg({ ...selectiveCopyMsg, content: e.target.value })}
                      className="w-full h-36 bg-black/40 border border-[var(--border)] rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:border-accent/40 font-sans resize-y custom-scrollbar leading-relaxed"
                      placeholder="编辑或直接划词复制..."
                    />
                    <button
                      onClick={async () => {
                        try {
                          if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(selectiveCopyMsg.content);
                          } else {
                            const t = document.createElement("textarea");
                            t.value = selectiveCopyMsg.content;
                            document.body.appendChild(t);
                            t.select();
                            document.execCommand("copy");
                            document.body.removeChild(t);
                          }
                          setChunkCopiedId("full-editor");
                          showChatNotification("已成功复制编辑区文本！");
                          setTimeout(() => setChunkCopiedId(null), 1500);
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="absolute right-3.5 bottom-3.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-bold shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      {chunkCopiedId === "full-editor" ? (
                        <>
                          <Check size={12} className="text-white" />
                          <span>已拷贝</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} className="text-white" />
                          <span>一键拷贝此编辑区</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Segmented paragraphs copy list */}
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block">
                    智能分段检测 ({getSegments(selectiveCopyMsg.content).length} 个块)
                  </label>
                  <div className="flex flex-col gap-2.5">
                    {getSegments(selectiveCopyMsg.content).map((segment) => {
                      const isCode = segment.type === "code";
                      return (
                        <div
                          key={segment.id}
                          className={`group/chunk border rounded-xl p-3.5 transition-all relative flex flex-col gap-2 ${
                            isCode 
                              ? "bg-black/30 border-blue-500/15" 
                              : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                          }`}
                        >
                          {/* Segment indicator */}
                          <div className="flex items-center justify-between text-[10px] text-gray-500 select-none">
                            <span className="font-mono bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              {isCode ? `CODE [${segment.lang || "generic"}]` : "段落 PARAGRAPH"}
                            </span>
                            <button
                              onClick={async () => {
                                try {
                                  if (navigator.clipboard && navigator.clipboard.writeText) {
                                    await navigator.clipboard.writeText(segment.content);
                                  } else {
                                    const t = document.createElement("textarea");
                                    t.value = segment.content;
                                    document.body.appendChild(t);
                                    t.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(t);
                                  }
                                  setChunkCopiedId(segment.id);
                                  showChatNotification("分段已复制！");
                                  setTimeout(() => setChunkCopiedId(null), 1500);
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="opacity-60 hover:opacity-100 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md text-[10px] text-gray-300 font-bold flex items-center gap-1 transition-all"
                            >
                              {chunkCopiedId === segment.id ? (
                                <>
                                  <Check size={10} className="text-green-400" />
                                  <span className="text-green-400 text-[9px] font-bold">已复制</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={10} />
                                  <span>单独复制</span>
                                </>
                              )}
                            </button>
                          </div>
                          
                          <div className={`text-xs leading-relaxed select-text font-sans ${isCode ? "font-mono text-gray-300 bg-black/20 p-2.5 rounded-lg border border-white/5" : "text-gray-300"}`}>
                            {segment.content}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)] mt-4">
                <button
                  onClick={() => setSelectiveCopyMsg(null)}
                  className="px-4 py-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  关闭窗口
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(selectiveCopyMsg.content);
                      }
                      setChunkCopiedId("global-action");
                      showChatNotification("全部文本复制成功！");
                      setTimeout(() => {
                        setChunkCopiedId(null);
                        setSelectiveCopyMsg(null);
                      }, 1000);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-accent to-accent/90 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-xl shadow-accent/10 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {chunkCopiedId === "global-action" ? (
                    <>
                      <Check size={12} className="text-white animate-bounce" />
                      <span>复制成功</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} className="text-white" />
                      <span>直接复制整段</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modals */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowClearConfirm(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#18181b] border border-[#27272a] rounded-2xl p-6 w-full max-w-sm shadow-2xl z-10 flex flex-col gap-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="flex flex-col gap-1 text-center items-center">
                <h3 className="text-lg font-bold text-white">确定清空画布吗？</h3>
                <p className="text-xs text-gray-400">此操作将清空画布上所有的节点和连接线，并且不可撤销。</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-medium text-xs transition-colors border-none cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearCanvas();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-650 hover:bg-red-600 text-white font-medium text-xs transition-colors border-none cursor-pointer"
                >
                  确认清空
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowExitConfirm(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#18181b] border border-[#27272a] rounded-2xl p-6 w-full max-w-sm shadow-2xl z-10 flex flex-col gap-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
                <LogOut size={24} />
              </div>
              <div className="flex flex-col gap-1 text-center items-center">
                <h3 className="text-lg font-bold text-white">确定退出系统？</h3>
                <p className="text-xs text-gray-400">系统已自动为您保存所有数据和画布。您随时可以重新进入。</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-gray-350 font-medium text-xs transition-colors border-none cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExitConfirm(false);
                    setIsExited(true);
                    try {
                      window.close();
                    } catch (_) {}
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white font-medium text-xs transition-colors border-none cursor-pointer"
                >
                  安全退出
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Left Sidebar Hover Sensor */}
      <div 
        onMouseEnter={() => setIsLeftSidebarHovered(true)}
        className="fixed left-0 top-0 bottom-0 w-3 z-45 pointer-events-auto"
      />

      {/* Main Sidebar - FIXED LEFT */}
      <div 
        onMouseEnter={() => setIsLeftSidebarHovered(true)}
        onMouseLeave={() => setIsLeftSidebarHovered(false)}
        className={`fixed left-0 top-0 bottom-0 z-50 transition-all duration-300 ease-in-out pointer-events-auto ${
          isLeftSidebarHovered 
            ? "translate-x-0 opacity-100 shadow-[10px_0_30px_rgba(0,0,0,0.5)]" 
            : "translate-x-[-100%] opacity-0 pointer-events-none"
        }`}
      >
        <SidebarWrapper 
          onOpenSettings={onOpenSettings} 
          onTriggerClear={() => setShowClearConfirm(true)}
          onTriggerExit={() => setShowExitConfirm(true)}
          isLeftSidebarHovered={isLeftSidebarHovered}
        />
      </div>

      {/* Grid view/canvas already handles main area */}
    </>
  );
}

import { SettingsModal } from "./components/SettingsModal";

// ... existing code ...

import { ErrorBoundary } from "react-error-boundary";

function fallbackRender({ error, resetErrorBoundary }: any) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-red-900/20 text-white p-8 overflow-auto z-50 fixed inset-0">
      <h2 className="text-2xl font-bold text-red-500 mb-4">React App Crashed</h2>
      <pre className="text-sm bg-black/50 p-4 rounded-xl leading-relaxed whitespace-pre-wrap max-w-4xl text-red-300 font-mono">
        {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      <button onClick={resetErrorBoundary} className="mt-6 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold">
        Attempt Recovery
      </button>
    </div>
  );
}


export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const { settings } = useStore();

  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);

    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  return (
    <ErrorBoundary fallbackRender={fallbackRender}>
      <ReactFlowProvider>
        <div
          className={`h-screen w-screen flex overflow-hidden font-sans select-none transition-all duration-300 theme-${settings.theme} bg-[var(--bg-primary)] text-[var(--text-primary)]`}
          style={{
            '--accent': settings.themeColor,
          cursor:
            settings.mouseSize === "large"
              ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z'/%3E%3Cpath d='m13 13 6 6'/%3E%3C/svg%3E\"), auto"
              : settings.mouseSize === "small"
                ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z'/%3E%3Cpath d='m13 13 6 6'/%3E%3C/svg%3E\"), auto"
                : "default",
        } as React.CSSProperties}
      >
        <FlowInner onOpenSettings={() => setShowSettings(true)} />

        <AnimatePresence>
          <WebPreviewPanel />
          {showSettings && (
            <SettingsModal onClose={() => setShowSettings(false)} />
          )}
        </AnimatePresence>
      </div>
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}

function SidebarWrapper({ 
  onOpenSettings,
  onTriggerClear,
  onTriggerExit,
  isLeftSidebarHovered = false,
}: { 
  onOpenSettings: () => void;
  onTriggerClear: () => void;
  onTriggerExit: () => void;
  isLeftSidebarHovered?: boolean;
}) {
  const {
    addNode,
    showAssistant,
    toggleAssistant,
    showFileManager,
    toggleFileManager,
    settings,
  } = useStore();
  const { screenToFlowPosition, getZoom } = useReactFlow();
  const [active, setActive] = useState("image-gen");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const isHovered = isLeftSidebarHovered;

  const handleAddNode = (type: any) => {
    const zoom = getZoom();
    const scaleFactor = Math.max(0.5, Math.min(2.5, 1 / zoom));
    
    let baseW = 320;
    let baseH = 400;
    if (type === "spatial-view") { baseW = 640; baseH = 500; }
    else if (type === "fusion-master") { baseW = 720; baseH = 950; }
    else if (type === "double-box-transform") { baseW = 680; baseH = 500; }
    else if (type === "apt-web-tool") { baseW = 500; baseH = 500; }
    else if (type === "native-host") { baseW = 500; baseH = 500; }
    else if (type === "io-image-list") { baseW = 300; baseH = 400; }
    else if (type === "ai-ps-engine") { baseW = 880; baseH = 640; }
    else if (type === "image-source") { baseW = 300; baseH = 350; }
    
    const initialWidth = Math.round(baseW * scaleFactor);
    const initialHeight = Math.round(baseH * scaleFactor);

    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addNode(type, center.x - (initialWidth / 2), center.y - (initialHeight / 2), {
      initialWidth,
      initialHeight
    });
    setActive(type);
  };

  return (
    <div
      className={`h-full border-r border-[var(--border)] flex flex-col items-center py-6 gap-8 z-50 transition-all duration-300 ease-in-out pointer-events-auto ${
        isHovered ? "w-[240px]" : "w-[72px]"
      } ${
        settings.barTexture === "frosted"
          ? "frosted-glass border-r-white/5"
          : "bg-[var(--bg-secondary)]"
      }`}
    >
      <div className={`w-full flex items-center transition-all duration-200 ${isHovered ? 'px-6 gap-3.5 justify-start' : 'justify-center'} shrink-0 h-12`}>
        <div className="w-12 h-12 bg-gradient-to-br from-accent via-accent to-purple-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-accent/20 active:scale-95 transition-all cursor-pointer hover:rotate-3 font-black text-xl italic tracking-tighter">
          NV
        </div>
        {isHovered && (
          <div className="flex flex-col select-none transition-opacity duration-300">
            <span className="text-white font-black tracking-widest text-[13px] leading-none uppercase">WORKFLOW</span>
            <span className="text-[10px] text-gray-500 font-bold tracking-wider leading-none mt-1">CANVAS PRO</span>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className={`flex-1 flex flex-col gap-4 overflow-y-auto overflow-x-hidden scrollbar-hide py-2 w-full transition-all duration-200 ${
          isHovered ? 'items-start' : 'items-center'
        }`}
      >
        <SidebarButton
          icon={<Plus size={22} />}
          onClick={() => handleAddNode("image-gen")}
          label="生成图像"
          active={active === "image-gen"}
          expanded={isHovered}
        />
        <SidebarButton
          icon={<Sparkles size={22} />}
          onClick={() => handleAddNode("text-gen")}
          label="生成文本"
          active={active === "text-gen"}
          expanded={isHovered}
        />
        <SidebarButton
          icon={<Brain size={22} />}
          onClick={() => handleAddNode("logic-engine")}
          label="逻辑引擎"
          active={active === "logic-engine"}
          expanded={isHovered}
        />
        <SidebarButton
          icon={<Languages size={22} />}
          onClick={() => handleAddNode("translate-engine")}
          label="翻译引擎"
          active={active === "translate-engine"}
          expanded={isHovered}
        />
        <SidebarButton
          icon={<LayoutGrid size={22} />}
          onClick={() => handleAddNode("fusion-master")}
          label="Fusion Master"
          active={active === "fusion-master"}
          expanded={isHovered}
        />
        <SidebarButton
          icon={<Move3d size={22} />}
          onClick={() => handleAddNode("spatial-view")}
          label="3D 空间视角"
          active={active === "spatial-view"}
          expanded={isHovered}
        />
        <SidebarButton
          icon={<Layers size={22} />}
          onClick={() => handleAddNode("ai-ps-engine")}
          label="AI PS 引擎"
          active={active === "ai-ps-engine"}
          expanded={isHovered}
        />
        <SidebarButton
          icon={<ImageIcon size={22} />}
          onClick={() => handleAddNode("image-source")}
          label="源图像"
          active={active === "image-source"}
          expanded={isHovered}
        />
        <SidebarButton
          icon={<Type size={22} />}
          onClick={() => handleAddNode("text-source")}
          label="源文本"
          active={active === "text-source"}
          expanded={isHovered}
        />
        <SidebarButton
          icon={<FolderOpen size={22} />}
          onClick={toggleFileManager}
          label="资产库"
          active={showFileManager}
          expanded={isHovered}
        />
        <SidebarButton
          icon={<MessageSquare size={22} />}
          onClick={toggleAssistant}
          label="AI 助手"
          active={showAssistant}
          expanded={isHovered}
        />

        {/* Separator line inside sidebar */}
        <div className="w-[85%] self-center border-t border-[var(--border)] shrink-0 opacity-40 my-1" />

        <SidebarButton
          icon={<Trash2 size={20} />}
          onClick={onTriggerClear}
          label="清空画布"
          active={false}
          expanded={isHovered}
          hoverClass="text-red-400/80 hover:text-red-400 hover:bg-red-500/10"
        />
        <SidebarButton
          icon={<LogOut size={20} />}
          onClick={onTriggerExit}
          label="安全退出"
          active={false}
          expanded={isHovered}
          hoverClass="text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/10"
        />
      </div>

      <div className={`flex ${isHovered ? 'flex-row w-full px-5 justify-between' : 'flex-col'} items-center gap-6 shrink-0`}>
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all group shrink-0"
        >
          <FlowerIcon />
        </button>
        <div className="w-10 h-10 rounded-2xl overflow-hidden border border-[var(--border)] hover:border-accent transition-colors cursor-pointer group shrink-0">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
            alt="User"
          />
        </div>
      </div>
    </div>
  );
}

function FlowerIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-transform group-hover:rotate-45 duration-500 cursor-pointer"
    >
      <path
        d="M12 2C10.8954 2 10 2.89543 10 4C10 5.10457 10.8954 6 12 6C13.1046 6 14 5.10457 14 4C14 2.89543 13.1046 2 12 2Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
      <path
        d="M12 18C10.8954 18 10 18.8954 10 20C10 21.1046 10.8954 22 12 22C13.1046 22 14 21.1046 14 20C14 18.8954 13.1046 18 12 18Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
      <path
        d="M4 12C2.89543 12 2 12.8954 2 14C2 15.1046 2.89543 16 4 16C5.10457 16 6 15.1046 6 14C6 12.8954 5.10457 12 4 12Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
      <path
        d="M20 12C18.8954 12 18 12.8954 18 14C18 15.1046 18.8954 16 20 16C21.1046 16 22 15.1046 22 14C22 12.8954 21.1046 12 20 12Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
      <path
        d="M6.34315 6.34315C5.5621 6.34315 4.92893 6.97631 4.92893 7.75736C4.92893 8.53841 5.5621 9.17157 6.34315 9.17157C7.12419 9.17157 7.75736 8.53841 7.75736 7.75736C7.75736 6.97631 7.12419 6.34315 6.34315 6.34315Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
      <path
        d="M17.6569 17.6569C16.8758 17.6569 16.2426 18.29 16.2426 19.0711C16.2426 19.8521 16.8758 20.4853 17.6569 20.4853C18.4379 20.4853 19.0711 19.8521 19.0711 19.0711C19.0711 18.29 18.4379 17.6569 17.6569 17.6569Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
      <path
        d="M6.34315 17.6569C5.5621 17.6569 4.92893 18.29 4.92893 19.0711C4.92893 19.8521 5.5621 20.4853 6.34315 20.4853C7.12419 20.4853 7.75736 19.8521 7.75736 19.0711C7.75736 18.29 7.12419 17.6569 6.34315 17.6569Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
      <path
        d="M17.6569 6.34315C16.8758 6.34315 16.2426 6.97631 16.2426 7.75736C16.2426 8.53841 16.8758 9.17157 17.6569 9.17157C18.4379 9.17157 19.0711 8.53841 19.0711 7.75736C19.0711 6.97631 18.4379 6.34315 17.6569 6.34315Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function TopBarButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all active:scale-95 group shrink-0"
    >
      <span className="group-hover:text-accent transition-colors">
        {icon}
      </span>
      <span className="text-sm font-bold uppercase tracking-widest">
        {label}
      </span>
    </button>
  );
}

function SidebarButton({
  icon,
  onClick,
  label,
  active = false,
  expanded = false,
  hoverClass = "",
}: {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  expanded?: boolean;
  hoverClass?: string;
}) {
  return (
    <div className="group w-full px-3 flex justify-center relative select-none">
      <button
        type="button"
        onClick={onClick}
        className={`h-12 rounded-2xl flex items-center transition-all duration-200 active:scale-95 ${
          expanded 
            ? "w-full px-4 gap-4 justify-start text-left" 
            : "w-12 justify-center"
        } ${
          active 
            ? "bg-accent/10 text-accent shadow-[0_0_15px_rgba(59,130,246,0.15)] border border-accent/20" 
            : hoverClass || "text-gray-400 hover:text-white hover:bg-[var(--bg-tertiary)]"
        }`}
      >
        <div className="shrink-0 flex items-center justify-center w-5 h-5">
          {icon}
        </div>
        {expanded && (
          <span className="text-[13px] font-semibold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis select-none">
            {label}
          </span>
        )}
      </button>

      {/* Tooltip only shown when NOT expanded */}
      {!expanded && (
        <div className="absolute left-16 px-2.5 py-1.5 bg-[#18181b] border border-[#27272a] text-gray-300 text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl">
          {label}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  onClick,
  className = "",
  title,
  active = false,
}: {
  icon: React.ReactNode;
  onClick?: () => void;
  className?: string;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2.5 rounded-xl transition-all ${active ? "bg-accent text-white shadow-lg shadow-accent/20" : "hover:bg-[var(--border)] text-gray-400 hover:text-white"} ${className}`}
    >
      {icon}
    </button>
  );
}

function ContextMenuItem({
  label,
  onClick,
  sub,
  disabled = false,
  icon,
}: {
  label: string;
  onClick?: () => void;
  sub?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && onClick) onClick();
      }}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-3 py-2 text-base text-left transition-colors ${
        disabled
          ? "text-gray-600 cursor-not-allowed"
          : "text-gray-300 hover:bg-accent hover:text-white"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="opacity-60">{icon}</span>}
        <span>{label}</span>
      </div>
      {sub && <span className="text-sm opacity-40">{sub}</span>}
    </button>
  );
}

function ContextSubMenuItem({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative group/sub"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="w-full flex items-center justify-between px-3 py-1.5 text-base text-gray-300 hover:bg-accent hover:text-white transition-colors cursor-pointer">
        <div className="flex items-center gap-2">
          {icon && <span className="opacity-60">{icon}</span>}
          <span>{label}</span>
        </div>
        <ChevronRight size={12} />
      </div>
      {open && (
        <div className="absolute left-full top-0 ml-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl shadow-2xl min-w-[200px] w-auto whitespace-nowrap py-1 z-[1001] animate-in fade-in slide-in-from-left-2 duration-100">
          {children}
        </div>
      )}
    </div>
  );
}

function ContextMenuGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-3 py-1 text-sm font-bold text-gray-500 uppercase tracking-widest">
        {label}
      </div>
      {children}
    </div>
  );
}

function SuggestionCard({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col gap-3 p-4 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl text-left hover:border-accent/30 hover:bg-[var(--border)] transition-all group"
    >
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-accent transition-colors">
        {icon}
      </div>
      <span className="text-base font-bold text-gray-400 group-hover:text-gray-200">
        {title}
      </span>
    </button>
  );
}

const ViewerThumbnail = ({ url, isSelected, onClick }: { url: string; isSelected: boolean; onClick: () => void }) => {
  const [resolvedUrl, setResolvedUrl] = useState('');
  
  useEffect(() => {
    let active = true;
    let localBlobUrl = '';
    
    const resolve = async () => {
      if (!url) return;
      if (url.startsWith('db_blob:')) {
        try {
          const stored = await get(url);
          if (!active) return;
          if (stored instanceof Blob) {
            localBlobUrl = URL.createObjectURL(stored);
            setResolvedUrl(localBlobUrl);
          }
        } catch (e) {
          console.error(e);
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
    <button 
      onClick={onClick}
      className={`relative shrink-0 w-16 h-12 rounded-lg bg-zinc-900 border-2 overflow-hidden transition-all duration-150 ${
        isSelected ? "border-sky-500 ring-2 ring-sky-500/20 scale-105" : "border-zinc-700 hover:border-zinc-500"
      }`}
    >
      {resolvedUrl ? (
        <img src={resolvedUrl} alt="Thumb" className="w-full h-full object-cover pointer-events-none select-none" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-650 bg-zinc-950">
          <ImageIcon size={14} />
        </div>
      )}
    </button>
  );
};

const ViewerImageLoader = ({ url, nodeId, rotation, zoomScale, zoomOffset, onMouseDown }: { url: string; nodeId: string; rotation: number; zoomScale: number; zoomOffset: { x: number; y: number }; onMouseDown?: (e: React.MouseEvent) => void }) => {
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
          console.error("Failed to load db_blob in viewer", e);
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
  }, [url, nodeId]);
  
  return (
    <motion.div
      animate={{ 
        scale: zoomScale,
        x: zoomOffset.x,
        y: zoomOffset.y,
        rotate: rotation
      }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="relative max-w-full max-h-full flex items-center justify-center"
      onMouseDown={onMouseDown}
    >
      <img 
        draggable={false}
        src={resolvedUrl || url} 
        alt="Active zoomed canvas media target"
        className="max-w-[85vw] max-h-[72vh] object-contain shadow-[0_0_80px_rgba(0,0,0,0.85)] rounded-2xl border border-white/5 select-none pointer-events-none transition-shadow"
      />
    </motion.div>
  );
};

const ViewerMinimapPreview = ({ url }: { url: string }) => {
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
          console.error("Failed to load db_blob in minimap preview", e);
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
      alt="mini preview"
      className="max-w-full max-h-full object-contain filter brightness-90"
    />
  );
};
