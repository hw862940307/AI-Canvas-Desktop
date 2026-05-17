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
} from "@xyflow/react";
import { useStore } from "./store/useStore";
import { ImageNode } from "./components/ImageNode";
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
  Images,
  ScanSearch,
  CloudLightning,
  History,
  Users,
  Share2,
  Coins,
  ChevronRight,
  Maximize2,
  Grid,
  Search,
  Paperclip,
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
  Copy,
  Undo2,
  Redo2,
  Box,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { TranslateEngineNode } from "./components/TranslateEngineNode";
import { LogicEngineNode } from "./components/LogicEngineNode";
import FusionMasterNode from "./components/FusionMasterNode";
import { SpatialViewNode } from "./components/SpatialViewNode";
import { AptWebToolNode } from "./components/AptWebToolNode";
import { IoImageListNode } from "./components/IoImageListNode";
import { DoubleBoxTransformNode } from "./components/DoubleBoxTransformNode";
import { ReverseNode } from "./components/ReverseNode";
import { MsGenNode } from "./components/MsGenNode";

// Gemini initialization logic removed here, handled by getGenAI utility

const nodeTypes = {
  image: ImageNode,
  text: TextNode,
  "image-gen": ImageGenNode,
  "text-gen": TextGenNode,
  "image-source": SourceImageNode,
  "text-source": SourceTextNode,
  "prompt-engine": PromptEngineNode,
  "logic-engine": LogicEngineNode,
  "translate-engine": TranslateEngineNode,
  "fusion-master": FusionMasterNode,
  "spatial-view": SpatialViewNode,
  "apt-web-tool": AptWebToolNode,
  "io-image-list": IoImageListNode,
  "double-box-transform": DoubleBoxTransformNode,
  reverse: ReverseNode,
  "ms-gen": MsGenNode,
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
          className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
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

function FlowInner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    clearCanvas,
    chatHistory,
    addChatMessage,
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
    updateNodeData,
  } = useStore();
  const {
    fitView,
    screenToFlowPosition,
    zoomIn,
    zoomOut,
    getZoom,
    setViewport,
    getViewport,
  } = useReactFlow();
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Filter edges based on showConnections setting
  const visibleEdges = useMemo(() => {
    if (!settings.showConnections) return [];
    return edges;
  }, [edges, settings.showConnections]);

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
  }, []);

  const handleAddNode = (type: any, x?: number, y?: number) => {
    if (x !== undefined && y !== undefined) {
      addNode(type, x, y);
    } else {
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      addNode(type, center.x - 150, center.y - 120);
    }
    setMenu(null);
  };

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
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
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key.toLowerCase() === "m") toggleMiniMap();
      if (e.key.toLowerCase() === "l") toggleGrid();
      if (e.key.toLowerCase() === "f") fitView();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        copySelectedNodes();
      }
      // ctrl+v logic removed here, handled by 'paste' event
    };

    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if focused on an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const text = clipboardData.getData("text");
      const items = clipboardData.items;

      // EXCLUSIVE logic: Check if we just copied nodes internally
      if (text === "__FLUX_NODES_DATA__") {
        pasteNodes();
        e.preventDefault();
        return;
      }

      // If not nodes, check for images
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault(); // Handle exclusively
            const reader = new FileReader();
            reader.onload = (event) => {
              const imageUrl = event.target?.result as string;

              // Load image to get original dimensions
              const img = new Image();
              img.onload = () => {
                const width = img.width;
                const height = img.height;

                // If an image-capable node is selected, update it
                const selectedNode = nodes.find((n) => n.selected);
                const imageNodes = [
                  "image",
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
                        name: file.name || "Pasted Image",
                        source: "clipboard",
                        size: file.size,
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
                    createNewImageNode(imageUrl, file.name, width, height);
                  }
                } else {
                  createNewImageNode(imageUrl, file.name, width, height);
                }
              };
              img.src = imageUrl;
            };
            reader.readAsDataURL(file);
            break; // Handle only one image at a time
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
      addNode("image", center.x - 150, center.y - 120, {
        imageUrl,
        name: name || "Pasted Image",
        originalWidth: width,
        originalHeight: height,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handlePaste);
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
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    const userMsg = inputText.trim();
    setInputText("");
    addChatMessage({ role: "user", content: userMsg });
    setIsTyping(true);

    try {
      const resultText = await generateTextWithFallback(userMsg);
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

      // Handle external file drop
      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        Array.from(files).forEach((file: File) => {
          if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const imageUrl = e.target?.result as string;
              addNode("image", position.x - 150, position.y - 120, {
                imageUrl,
                name: file.name,
              });
            };
            reader.readAsDataURL(file);
          }
        });
      }
    },
    [screenToFlowPosition, addNode],
  );

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
        {/* Top Header */}
        <header
          className={`h-16 border-b border-[var(--border)] flex items-center justify-between px-6 z-40 transition-all ${
            settings.barTexture === "frosted"
              ? "frosted-glass border-b-white/5"
              : "bg-[var(--bg-secondary)]"
          }`}
        >
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold tracking-wider text-gray-400 font-mono">
              NEXT VISION NODE PRO
            </h1>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                LIVE SYNC
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
              <TopBarButton
                icon={<Globe2 size={16} />}
                label="网页百宝箱"
                onClick={() => handleAddNode("apt-web-tool")}
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
          className={`flex-1 overflow-hidden relative group/canvas transition-all border-4 ${
            isCanvasDragging
              ? "border-blue-500/50 bg-blue-500/5"
              : "border-transparent"
          }`}
          style={{
            paddingLeft: (showFileManager ? fileManagerWidth : 0) + 72,
          }}
        >
          <ReactFlow
            nodes={highlightedNodes}
            edges={visibleEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={() => setIsConnecting(true)}
            onConnectEnd={() => setIsConnecting(false)}
            nodesDraggable={!isConnecting}
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
            className="bg-[var(--bg-primary)]"
            minZoom={0.05}
            maxZoom={4}
            panOnDrag={[1]}
            selectionOnDrag={true}
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
                    case "image":
                      return "#22c55e";
                    case "text":
                      return "#f59e0b";
                    default:
                      return "var(--border)";
                  }
                }}
                maskColor="rgba(0,0,0,0.5)"
              />
            )}

            <Panel position="bottom-left" className="m-6 flex flex-col gap-4">
              <div
                className={`flex items-center gap-2 p-1.5 border border-[var(--border)] rounded-2xl shadow-2xl transition-all ${
                  settings.barTexture === "frosted"
                    ? "frosted-glass border-white/5 shadow-black/20"
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
                <div className="w-px h-4 bg-[#333] mx-1" />
                <ZoomDisplay />
                <div className="w-px h-4 bg-[#333] mx-1" />
                <ToolbarButton
                  icon={<Trash2 size={18} />}
                  onClick={clearCanvas}
                  className="text-red-500 hover:bg-red-500/10"
                  title="清空画布"
                />
              </div>
            </Panel>

            <Panel position="bottom-right" className="m-6">
              <div
                className={`flex items-center gap-2 p-1 border border-[var(--border)] rounded-2xl shadow-2xl transition-all ${
                  settings.barTexture === "frosted"
                    ? "frosted-glass border-white/5 shadow-black/20"
                    : "bg-[var(--bg-tertiary)]"
                }`}
              >
                <button className="p-3 hover:bg-[var(--bg-tertiary)] rounded-xl text-[var(--text-secondary)] transition-all">
                  <Search size={20} />
                </button>
              </div>
            </Panel>

            {/* Context Menu */}
            {menu && (
              <Panel
                position="top-left"
                style={{ left: menu.screenX, top: menu.screenY }}
              >
                <div className="bg-[#1a1a1a]/95 backdrop-blur-xl border border-[#333] rounded-2xl shadow-2xl w-56 overflow-hidden py-2 z-[1000] animate-in fade-in zoom-in duration-100">
                  <ContextMenuGroup label="添加节点">
                    <ContextSubMenuItem label="生成节点">
                      <ContextMenuItem
                        label="生成文本"
                        onClick={() =>
                          handleAddNode("text-gen", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="生成图像"
                        onClick={() =>
                          handleAddNode("image-gen", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="推理：逻辑引擎"
                        onClick={() =>
                          handleAddNode("logic-engine", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="应用：翻译引擎"
                        onClick={() =>
                          handleAddNode("translate-engine", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="应用：Fusion Master"
                        onClick={() =>
                          handleAddNode("fusion-master", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="3D：空间视角"
                        onClick={() =>
                          handleAddNode("spatial-view", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="AI：网页百宝箱"
                        onClick={() =>
                          handleAddNode("apt-web-tool", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="IO：加载图像列表"
                        onClick={() =>
                          handleAddNode("io-image-list", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="分析：图片反推"
                        onClick={() => handleAddNode("reverse", menu.x, menu.y)}
                      />
                      <ContextMenuItem
                        label="变换：双框坐标转换"
                        onClick={() =>
                          handleAddNode("double-box-transform", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem label="生成视频" disabled />
                      <ContextMenuItem label="生成音频" disabled />
                      <ContextMenuItem label="360 全景图" disabled />
                    </ContextSubMenuItem>
                    <ContextSubMenuItem label="源节点">
                      <ContextMenuItem
                        label="源文本"
                        onClick={() =>
                          handleAddNode("text-source", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem
                        label="源图像"
                        onClick={() =>
                          handleAddNode("image-source", menu.x, menu.y)
                        }
                      />
                      <ContextMenuItem label="源视频" disabled />
                      <ContextMenuItem label="源音频" disabled />
                    </ContextSubMenuItem>
                  </ContextMenuGroup>
                  <div className="h-px bg-[#333] my-1 mx-2" />
                  <ContextMenuItem
                    label="粘贴"
                    sub="Ctrl V"
                    disabled
                    icon={<Copy size={12} />}
                  />
                  <ContextMenuItem
                    label="撤销"
                    sub="Ctrl Z"
                    disabled
                    icon={<Undo2 size={12} />}
                  />
                  <ContextMenuItem
                    label="重做"
                    sub="Ctrl Y"
                    disabled
                    icon={<Redo2 size={12} />}
                  />
                </div>
              </Panel>
            )}

            <AlignmentToolbar />
          </ReactFlow>
        </main>
      </div>

      {/* Right Assistant Panel */}
      <AnimatePresence>
        {showAssistant && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="w-[400px] bg-[var(--bg-secondary)] border-l border-[var(--border)] flex flex-col z-50 overflow-hidden shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
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
                <button className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)] transition-colors">
                  <Maximize2 size={16} />
                </button>
                <button
                  onClick={toggleAssistant}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar bg-[var(--bg-primary)]/50">
              {chatHistory.length === 0 ? (
                <>
                  <div className="flex flex-col gap-2 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
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
                    />
                    <SuggestionCard
                      icon={<Sparkles size={16} />}
                      title="优化提示词 DNA"
                    />
                    <SuggestionCard
                      icon={<Cloud size={16} />}
                      title="生成环境模拟"
                    />
                    <SuggestionCard
                      icon={<ImageIcon size={16} />}
                      title="批量节点管理"
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
                  {chatHistory.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-lg ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10 rounded-tr-none"
                            : "bg-[#1a1a1a] border border-[#333] text-gray-300 rounded-tl-none font-sans leading-relaxed"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl rounded-tl-none px-4 py-3 flex gap-1">
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
              className={`p-6 border-t border-[var(--border)] space-y-4 transition-all ${
                settings.barTexture === "frosted"
                  ? "frosted-glass border-t-white/5"
                  : "bg-[var(--bg-secondary)]"
              }`}
            >
              <div className="relative group">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
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
                  placeholder="描述想法，Gemini 1.5 为你护航..."
                  style={{
                    fontSize:
                      typeof settings.inputFontSize === "number"
                        ? `${settings.inputFontSize}px`
                        : undefined,
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isTyping}
                  className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg transition-all active:scale-90"
                >
                  {isTyping ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ArrowUp size={18} />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-4">
                  <button className="text-gray-500 hover:text-gray-300 transition-colors">
                    <Paperclip size={18} />
                  </button>
                  <button className="text-gray-500 hover:text-gray-300 transition-colors">
                    <Mic size={18} />
                  </button>
                </div>
                <div className="relative group/model">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">
                      {settings.apiSettings.engine} |{" "}
                      {settings.apiSettings.imageEngine}
                    </span>
                    <ChevronUp size={12} className="text-gray-500" />
                  </div>

                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl opacity-0 invisible group-hover/model:opacity-100 group-hover/model:visible transition-all z-50 overflow-hidden">
                    <div className="p-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                      <span className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2 py-1">
                        Text Models
                      </span>
                      <button
                        onClick={() =>
                          updateSettings({
                            apiSettings: {
                              ...settings.apiSettings,
                              isCustom: true,
                              engine: "gemini",
                              modelId: "gemini-1.5-flash",
                              baseUrl:
                                "https://generativelanguage.googleapis.com",
                            },
                          })
                        }
                        className="px-3 py-2 text-base text-gray-300 hover:bg-blue-600 hover:text-white rounded-lg text-left transition-colors"
                      >
                        Gemini 1.5
                      </button>
                      <button
                        onClick={() =>
                          updateSettings({
                            apiSettings: {
                              ...settings.apiSettings,
                              isCustom: true,
                              engine: "doubao",
                              modelId: "doubao-pro-32k",
                              baseUrl:
                                "https://ark.cn-beijing.volces.com/api/v3",
                            },
                          })
                        }
                        className="px-3 py-2 text-base text-gray-300 hover:bg-blue-600 hover:text-white rounded-lg text-left transition-colors"
                      >
                        Doubao Pro
                      </button>
                      <button
                        onClick={() =>
                          updateSettings({
                            apiSettings: {
                              ...settings.apiSettings,
                              isCustom: true,
                              engine: "qianwen",
                              modelId: "qwen-max",
                              baseUrl:
                                "https://dashscope.aliyuncs.com/compatible-mode/v1",
                            },
                          })
                        }
                        className="px-3 py-2 text-base text-gray-300 hover:bg-blue-600 hover:text-white rounded-lg text-left transition-colors"
                      >
                        Qwen Max
                      </button>
                      <button
                        onClick={() =>
                          updateSettings({
                            apiSettings: {
                              ...settings.apiSettings,
                              isCustom: true,
                              engine: "deepseek",
                              modelId: "deepseek-chat",
                              baseUrl: "https://api.deepseek.com",
                            },
                          })
                        }
                        className="px-3 py-2 text-base text-gray-300 hover:bg-blue-600 hover:text-white rounded-lg text-left transition-colors"
                      >
                        DeepSeek Chat
                      </button>
                      <div className="h-px bg-white/5 my-1 mx-2" />
                      <span className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2 py-1">
                        Image Generation
                      </span>
                      <button
                        onClick={() =>
                          updateSettings({
                            apiSettings: {
                              ...settings.apiSettings,
                              imageEngine: "online",
                              imageModel: "Nano Banana Pro",
                            },
                          })
                        }
                        className="px-3 py-2 text-base text-gray-300 hover:bg-emerald-600 hover:text-white rounded-lg text-left transition-colors"
                      >
                        Nano Banana Pro
                      </button>
                      <button
                        onClick={() =>
                          updateSettings({
                            apiSettings: {
                              ...settings.apiSettings,
                              imageEngine: "online",
                              imageModel: "chatgptimage2",
                            },
                          })
                        }
                        className="px-3 py-2 text-base text-gray-300 hover:bg-emerald-600 hover:text-white rounded-lg text-left transition-colors"
                      >
                        ChatGPT Image 2
                      </button>
                      <button
                        onClick={() =>
                          updateSettings({
                            apiSettings: {
                              ...settings.apiSettings,
                              imageEngine: "comfyui",
                            },
                          })
                        }
                        className="px-3 py-2 text-base text-gray-300 hover:bg-emerald-600 hover:text-white rounded-lg text-left transition-colors"
                      >
                        Local ComfyUI
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFileManager && <FileManagerSidebar />}
      </AnimatePresence>

      {/* Main Sidebar - FIXED LEFT */}
      <div className="fixed left-0 top-0 bottom-0 z-50">
        <SidebarWrapper onOpenSettings={onOpenSettings} />
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

          cursor:
            settings.mouseSize === "large"
              ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z'/%3E%3Cpath d='m13 13 6 6'/%3E%3C/svg%3E\"), auto"
              : settings.mouseSize === "small"
                ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z'/%3E%3Cpath d='m13 13 6 6'/%3E%3C/svg%3E\"), auto"
                : "default",
        }}
      >
        <FlowInner onOpenSettings={() => setShowSettings(true)} />

        <AnimatePresence>
          {showSettings && (
            <SettingsModal onClose={() => setShowSettings(false)} />
          )}
        </AnimatePresence>
      </div>
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}

function SidebarWrapper({ onOpenSettings }: { onOpenSettings: () => void }) {
  const {
    addNode,
    showAssistant,
    toggleAssistant,
    showFileManager,
    toggleFileManager,
    settings,
  } = useStore();
  const { screenToFlowPosition } = useReactFlow();
  const [active, setActive] = useState("image-gen");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const handleAddNode = (type: any) => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addNode(type, center.x - 150, center.y - 120);
    setActive(type);
  };

  return (
    <div
      className={`w-[72px] h-full border-r border-[var(--border)] flex flex-col items-center py-6 gap-8 z-50 transition-all pointer-events-auto ${
        settings.barTexture === "frosted"
          ? "frosted-glass border-r-white/5"
          : "bg-[var(--bg-secondary)]"
      }`}
    >
      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20 active:scale-95 transition-all cursor-pointer hover:rotate-3 font-black text-xl italic tracking-tighter">
        NV
      </div>

      <div
        ref={scrollRef}
        className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar py-2 w-full items-center"
      >
        <SidebarButton
          icon={<Plus size={22} />}
          onClick={() => handleAddNode("image-gen")}
          label="生成图像"
          active={active === "image-gen"}
        />
        <SidebarButton
          icon={<Sparkles size={22} />}
          onClick={() => handleAddNode("text-gen")}
          label="生成文本"
          active={active === "text-gen"}
        />
        <SidebarButton
          icon={<Brain size={22} />}
          onClick={() => handleAddNode("logic-engine")}
          label="逻辑引擎"
          active={active === "logic-engine"}
        />
        <SidebarButton
          icon={<Languages size={22} />}
          onClick={() => handleAddNode("translate-engine")}
          label="翻译引擎"
          active={active === "translate-engine"}
        />
        <SidebarButton
          icon={<LayoutGrid size={22} />}
          onClick={() => handleAddNode("fusion-master")}
          label="Fusion Master"
          active={active === "fusion-master"}
        />
        <SidebarButton
          icon={<Move3d size={22} />}
          onClick={() => handleAddNode("spatial-view")}
          label="3D 空间视角"
          active={active === "spatial-view"}
        />
        <SidebarButton
          icon={<ImageIcon size={22} />}
          onClick={() => handleAddNode("image-source")}
          label="源图像"
          active={active === "image-source"}
        />
        <SidebarButton
          icon={<Type size={22} />}
          onClick={() => handleAddNode("text-source")}
          label="源文本"
          active={active === "text-source"}
        />
        <SidebarButton
          icon={<FolderOpen size={22} />}
          onClick={toggleFileManager}
          label="资产库"
          active={showFileManager}
        />
        <SidebarButton
          icon={<MessageSquare size={22} />}
          onClick={toggleAssistant}
          label="AI 助手"
          active={showAssistant}
        />
      </div>

      <div className="flex flex-col gap-6 items-center">
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all group"
        >
          <FlowerIcon />
        </button>
        <div className="w-10 h-10 rounded-2xl overflow-hidden border border-[#333] hover:border-blue-500 transition-colors cursor-pointer group">
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
      <span className="group-hover:text-blue-400 transition-colors">
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
}: {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="group relative flex items-center justify-center">
      <button
        onClick={onClick}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${active ? "bg-blue-500/10 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)] border border-blue-500/30" : "text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]"}`}
      >
        {icon}
      </button>
      <div className="absolute left-16 px-2.5 py-1.5 bg-[#1a1a1a] border border-[#333] text-gray-300 text-base rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl">
        {label}
      </div>
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
      className={`p-2.5 rounded-xl transition-all ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "hover:bg-[#333] text-gray-400 hover:text-white"} ${className}`}
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
          : "text-gray-300 hover:bg-blue-600 hover:text-white"
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative group/sub"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="w-full flex items-center justify-between px-3 py-1.5 text-base text-gray-300 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer">
        <span>{label}</span>
        <ChevronRight size={12} />
      </div>
      {open && (
        <div className="absolute left-full top-0 ml-1 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl w-40 overflow-hidden py-1 z-[1001]">
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
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button className="flex flex-col gap-3 p-4 bg-[#1a1a1a] border border-[#333] rounded-2xl text-left hover:border-blue-500/30 hover:bg-[#222] transition-all group">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-blue-400 transition-colors">
        {icon}
      </div>
      <span className="text-base font-bold text-gray-400 group-hover:text-gray-200">
        {title}
      </span>
    </button>
  );
}
