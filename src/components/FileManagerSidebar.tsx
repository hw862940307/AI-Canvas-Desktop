import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Search,
  FolderPlus,
  Upload,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  MoreVertical,
  Plus,
  Minus,
  ArrowLeft,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Star,
  Edit2,
  Pin,
  PinOff,
  RefreshCw,
  Layers,
  PlusSquare,
  CheckSquare,
  XSquare,
  FolderClosed,
  Check,
} from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import { createPortal } from "react-dom";
import { useStore, FileItem, FolderItem } from "../store/useStore";
import { useReactFlow, useViewport } from "@xyflow/react";

import { FullscreenViewer } from "./FullscreenViewer";

const AspectRatioImageCard = ({
  file,
  onDragStart,
  onDoubleClick,
  onClick,
  className = "",
  children,
  defaultAspect = "1/1",
  bgClass = "bg-black/20",
  ...props
}: {
  file: any;
  onDragStart: (e: any) => void;
  onDoubleClick: () => void;
  onClick?: (e: any) => void;
  className?: string;
  children?: React.ReactNode;
  defaultAspect?: string;
  bgClass?: string;
  [key: string]: any;
}) => {
  const [aspect, setAspect] = useState<string>(defaultAspect);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) {
      setAspect(`${naturalWidth}/${naturalHeight}`);
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
      style={{ aspectRatio: aspect }}
      className={`group relative ${bgClass} overflow-hidden transition-all cursor-pointer w-full h-auto ${className}`}
      {...props}
    >
      {file.type === "image" ? (
        <img
          draggable={false}
          loading="lazy"
          decoding="async"
          src={file.url}
          alt={file.name}
          onLoad={handleLoad}
          className="w-full h-full object-contain select-none"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-500 min-h-[140px]">
          {file.type === "video" ? <Video size={24} /> : <Music size={24} />}
        </div>
      )}
      {children}
    </div>
  );
};

export const FileManagerSidebar = () => {
  const dragControls = useDragControls();
  const {
    showFileManager,
    toggleFileManager,
    fileManagerWidth,
    setFileManagerWidth,
    files,
    folders,
    materials,
    settings,
    addFolder,
    removeFolder,
    updateFolder,
    toggleFolder,
    removeFile,
    addMaterial,
    addNode,
  } = useStore();

  const { screenToFlowPosition } = useReactFlow();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "history" | "materials" | "output" | "prompts"
  >(() => {
    return (localStorage.getItem("fm_activeTab") as any) || "history";
  });

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  const handleCreateFolder = () => {
    addFolder("新建文件夹");
  };

  useEffect(() => {
    localStorage.setItem("fm_activeTab", activeTab);
  }, [activeTab]);

  const [activeCategory, setActiveCategory] = useState<
    "all" | "image" | "video" | "audio"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleDoubleClickImage = (url: string) => {
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
      y: e.clientY - dragStart.y,
    });
  };

  const handleImageMouseUp = () => {
    setIsDraggingImage(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizeState = useRef({
    active: false,
    startX: 0,
    startWidth: 0,
    direction: "right",
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeState.current.active) return;
      const { startX, startWidth, direction } = resizeState.current;

      let newWidth = startWidth;
      if (direction === "right") {
        newWidth = startWidth + (e.clientX - startX);
      } else if (direction === "left") {
        // Technically if dragging left, we would need to shift x to maintain right anchor,
        // but for now we just expand it.
        newWidth = startWidth - (e.clientX - startX);
      }

      newWidth = Math.max(600, Math.min(2000, newWidth)); // Enforce sensible min width to prevent layout break
      setFileManagerWidth(newWidth);
    };

    const handleMouseUp = () => {
      resizeState.current.active = false;
      document.body.style.cursor = "default";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setFileManagerWidth]);

  const handleResizeStart = (
    e: React.MouseEvent,
    direction: "left" | "right" = "right",
  ) => {
    e.stopPropagation(); // prevent drag from triggering
    resizeState.current = {
      active: true,
      startX: e.clientX,
      startWidth: fileManagerWidth,
      direction,
    };
    document.body.style.cursor = "col-resize";
  };

  const handleAddFileToCanvas = (file: FileItem) => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const baseX = center.x - 150;
    const baseY = center.y - 120;

    // Non-overlapping algorithm: find close-by positions that are unoccupied
    const existingNodes = useStore.getState().nodes;
    let finalX = baseX;
    let finalY = baseY;
    let foundOverlap = true;
    let attempts = 0;

    while (foundOverlap && attempts < 25) {
      foundOverlap = false;
      for (const node of existingNodes) {
        if (!node.position) continue;
        const nx = node.position.x;
        const ny = node.position.y;
        const dx = Math.abs(nx - finalX);
        const dy = Math.abs(ny - finalY);
        // If they are too close, offset and check again
        if (dx < 160 && dy < 160) {
          finalX += 60;
          finalY += 60;
          foundOverlap = true;
          break;
        }
      }
      attempts++;
    }

    addNode("image-source", finalX, finalY, { url: file.url, name: file.name });
  };

  const handleAddTextToCanvas = (text: string, title?: string) => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const baseX = center.x - 150;
    const baseY = center.y - 120;

    const existingNodes = useStore.getState().nodes;
    let finalX = baseX;
    let finalY = baseY;
    let foundOverlap = true;
    let attempts = 0;

    while (foundOverlap && attempts < 25) {
      foundOverlap = false;
      for (const node of existingNodes) {
        if (!node.position) continue;
        const nx = node.position.x;
        const ny = node.position.y;
        if (Math.abs(nx - finalX) < 160 && Math.abs(ny - finalY) < 160) {
          finalX += 60;
          finalY += 60;
          foundOverlap = true;
          break;
        }
      }
      attempts++;
    }

    addNode("text-source", finalX, finalY, { text, name: title || "提示词" });
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    folderId?: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      addMaterial({
        name: file.name,
        type: file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("audio/")
              ? "audio"
              : "other",
        url,
        size: file.size,
        folderId,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragStart = (event: React.DragEvent, file: FileItem) => {
    event.dataTransfer.setData("application/reactflow/type", "image-source");
    event.dataTransfer.setData(
      "application/reactflow/data",
      JSON.stringify({ url: file.url, name: file.name }),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const handleTextDragStart = (
    event: React.DragEvent,
    text: string,
    name?: string,
  ) => {
    event.dataTransfer.setData("application/reactflow/type", "text-source");
    event.dataTransfer.setData(
      "application/reactflow/data",
      JSON.stringify({ text, name: name || "提示词" }),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  if (!showFileManager) return null;

  const filteredHistory = files.filter((f) => {
    const matchesSearch = f.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "all" || f.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const sidebarContent = (
    <motion.div
      drag={!isFullscreen}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        width: isFullscreen ? "100vw" : fileManagerWidth,
        height: isFullscreen ? "100vh" : isCollapsed ? "auto" : "85vh",
        borderRadius: isFullscreen ? 0 : 16,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        position: "fixed",
        top: isFullscreen ? 0 : "10vh",
        left: isFullscreen ? 0 : "12vw",
        zIndex: 9999, // Make sure it sits on top of nodes and other overlays
      }}
      className={`bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] nowheel nodrag nopan ${isCollapsed ? "backdrop-blur-xl bg-black/60 shadow-lg" : ""}`}
    >
      {/* Resizer Handle on the Right (only when not fullscreen/collapsed) */}
      {!isFullscreen && !isCollapsed && (
        <>
          <div
            onMouseDown={(e) => handleResizeStart(e, "right")}
            className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-accent/50 transition-colors z-[100]"
          />
          <div
            onMouseDown={(e) => handleResizeStart(e, "left")}
            className="absolute top-0 left-0 w-2 h-full cursor-col-resize hover:bg-accent/50 transition-colors z-[100]"
          />
        </>
      )}

      {/* Header (Drag Handle) */}
      <div
        onPointerDown={(e) => {
          dragControls.start(e);
          if (!isPinned) e.stopPropagation();
        }}
        className={`filemanager-drag-handle px-6 flex flex-col transition-all cursor-move select-none ${
          settings.barTexture === "frosted"
            ? "frosted-glass border-b-white/5"
            : "bg-[var(--bg-secondary)]"
        } ${isCollapsed ? "py-3 border-none bg-transparent" : "p-4 gap-4 border-b border-[var(--border)]"}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-primary)] pointer-events-none flex items-center gap-2 tracking-wide">
            <FolderOpen size={18} className="text-accent" />
            文件管理
          </h2>
          <div className="flex items-center gap-1 rounded-lg bg-black/20 p-1 cursor-default">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPinned(!isPinned);
              }}
              className={`p-1 px-2 rounded-md transition-colors ${isPinned ? "bg-accent/20 text-accent" : "hover:bg-white/10 text-gray-400"}`}
              title={isPinned ? "取消置顶" : "置顶画布"}
            >
              {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
              }}
              className="p-1 px-2 hover:bg-white/10 rounded-md text-[var(--text-secondary)] hover:text-white transition-colors"
              title={isCollapsed ? "展开" : "折叠"}
            >
              {isCollapsed ? <Plus size={16} /> : <Minus size={16} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(!isFullscreen);
                setIsCollapsed(false);
              }}
              className="p-1 px-2 hover:bg-white/10 rounded-md text-[var(--text-secondary)] hover:text-white transition-colors"
              title={isFullscreen ? "退出全屏" : "全屏"}
            >
              <div className="w-3.5 h-3.5 border-2 border-current rounded-[2px]" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFileManager();
              }}
              className="p-1 px-2 hover:bg-red-500/20 rounded-md text-[var(--text-secondary)] hover:text-red-400 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="flex gap-2 p-1 bg-black/20 rounded-xl">
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-1 text-sm font-bold rounded-lg transition-all ${
                activeTab === "history"
                  ? "bg-[var(--bg-tertiary)] text-white shadow-lg"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              历史生成
            </button>
            <button
              onClick={() => setActiveTab("materials")}
              className={`flex-1 py-1 text-sm font-bold rounded-lg transition-all ${
                activeTab === "materials"
                  ? "bg-[var(--bg-tertiary)] text-white shadow-lg"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              素材库
            </button>
            <button
              onClick={() => setActiveTab("output")}
              className={`flex-1 py-1 text-sm font-bold rounded-lg transition-all ${
                activeTab === "output"
                  ? "bg-[var(--bg-tertiary)] text-white shadow-lg"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              输出文件夹
            </button>
            <button
              onClick={() => setActiveTab("prompts")}
              className={`flex-1 py-1 text-sm font-bold rounded-lg transition-all ${
                activeTab === "prompts"
                  ? "bg-[var(--bg-tertiary)] text-white shadow-lg"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              提示词库
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)]/50 relative overflow-hidden"
          >
            {activeTab === "history" ? (
              <HistoryView
                category={activeCategory}
                setCategory={setActiveCategory}
                files={filteredHistory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onAdd={handleAddFileToCanvas}
                onDelete={(id: string) => removeFile(id, false)}
                onDragStart={handleDragStart}
                onDoubleClickImage={handleDoubleClickImage}
              />
            ) : activeTab === "materials" ? (
              <MaterialsView
                folders={folders}
                materials={materials}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                addFolder={addFolder}
                removeFolder={removeFolder}
                toggleFolder={toggleFolder}
                updateFolder={updateFolder}
                addMaterial={addMaterial}
                clearFolderMaterials={useStore.getState().clearFolderMaterials}
                onAdd={handleAddFileToCanvas}
                onDelete={(id: string) => removeFile(id, true)}
                onUploadClick={() => fileInputRef.current?.click()}
                onDragStart={handleDragStart}
                onDoubleClickImage={handleDoubleClickImage}
                handleCreateFolder={handleCreateFolder}
                editingFolderId={editingFolderId}
                setEditingFolderId={setEditingFolderId}
                editingFolderName={editingFolderName}
                setEditingFolderName={setEditingFolderName}
              />
            ) : activeTab === "prompts" ? (
              <PromptsView
                fileManagerWidth={fileManagerWidth}
                onAdd={handleAddTextToCanvas}
                onDragStart={handleTextDragStart}
              />
            ) : (
              <OutputView
                onAdd={handleAddFileToCanvas}
                onDragStart={handleDragStart}
                onDoubleClickImage={handleDoubleClickImage}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*,audio/*"
        onChange={(e) => handleFileUpload(e)}
      />
    </motion.div>
  );

  return (
    <>
      {sidebarContent}

      {fullscreenUrl &&
        createPortal(
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
                    onClick={() => {
                      setZoomScale(1);
                      setZoomOffset({ x: 0, y: 0 });
                    }}
                    className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all cursor-pointer"
                    title="Reset"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setFullscreenUrl(null);
                    setZoomScale(1);
                    setZoomOffset({ x: 0, y: 0 });
                  }}
                  className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-red-500 text-white rounded-2xl transition-all border border-[var(--border)] shadow-2xl cursor-pointer"
                >
                  <X size={24} />
                </button>
              </div>

              <div
                className={`w-full h-full flex items-center justify-center overflow-hidden ${zoomScale > 1 ? "cursor-move" : "cursor-default"}`}
                onMouseDown={handleImageMouseDown}
                onMouseMove={handleImageMouseMove}
                onMouseUp={handleImageMouseUp}
                onMouseLeave={handleImageMouseUp}
              >
                <motion.div
                  animate={{
                    scale: zoomScale,
                    x: zoomOffset.x,
                    y: zoomOffset.y,
                  }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="relative max-w-full max-h-full flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    draggable={false}
                    src={fullscreenUrl}
                    alt="Fullscreen"
                    className="max-w-[90vw] max-h-[85vh] object-contain shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-3xl border border-[var(--border)] select-none pointer-events-none"
                  />
                </motion.div>
              </div>

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-white/5 backdrop-blur-xl border border-[var(--border)] rounded-[24px] z-50">
                <div className="flex items-center gap-2 pr-4 border-r border-[var(--border)]">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-sm font-bold text-white/40 tracking-wider">
                    FILE MANAGER VIEW
                  </span>
                </div>
                <span className="text-sm font-mono text-white/60">
                  PREVIEW MODE
                </span>
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};

const HistoryView = ({
  category,
  setCategory,
  files,
  searchQuery,
  setSearchQuery,
  onAdd,
  onDelete,
  onDragStart,
  onDoubleClickImage,
}: any) => {
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]/50">
      <div className="p-6 pb-0 space-y-4">
        <p className="text-sm text-gray-500 font-bold uppercase tracking-widest leading-none">
          当前项目生成媒体历史
        </p>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {(["all", "image", "video", "audio"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
                category === cat
                  ? "bg-accent border-accent text-white shadow-lg shadow-accent/20"
                  : "bg-white/5 border-[var(--border)] text-gray-400 hover:bg-white/10"
              }`}
            >
              {cat === "all"
                ? "所有"
                : cat === "image"
                  ? "图像"
                  : cat === "video"
                    ? "视频"
                    : "声音"}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索历史文件..."
            className="w-full bg-black/20 border border-[var(--border)] rounded-xl py-2 pl-9 pr-4 text-base text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/50"
          />
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 select-none">
            <ImageIcon size={48} strokeWidth={1} />
            <p className="text-sm font-bold mt-4 tracking-widest uppercase">
              暂无生成媒体历史
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {files.map((file: FileItem) => (
              <AspectRatioImageCard
                key={file.id}
                file={file}
                onDragStart={(e) => onDragStart(e, file)}
                onDoubleClick={() =>
                  file.type === "image" && onDoubleClickImage?.(file.url)
                }
                className="hover:border-accent/30 rounded-2xl border border-[var(--border)] bg-black/20"
              >
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(file);
                    }}
                    className="p-2 bg-accent rounded-lg text-white hover:bg-accent transition-colors shadow-lg"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(file.id);
                    }}
                    className="p-2 bg-white/10 rounded-lg text-white hover:bg-red-500/20 hover:text-red-400 transition-all"
                  >
                    <Minus size={16} />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-sm text-white truncate px-1 opacity-80">
                    {file.name}
                  </p>
                </div>
              </AspectRatioImageCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MOCK_FILES_BY_FOLDER: Record<
  string,
  Array<{ name: string; url: string; size: number }>
> = {
  "folder-1": [
    // Character
    {
      name: "Elf Warrior.jpg",
      url: "https://picsum.photos/seed/elf/400/400",
      size: 1153433,
    },
    {
      name: "Cyberpunk Hacker.jpg",
      url: "https://picsum.photos/seed/hacker/400/400",
      size: 985121,
    },
    {
      name: "Space Marine.jpg",
      url: "https://picsum.photos/seed/marine/400/400",
      size: 1540200,
    },
    {
      name: "Ancient Mage.jpg",
      url: "https://picsum.photos/seed/mage/400/400",
      size: 1201010,
    },
  ],
  "folder-2": [
    // Scene
    {
      name: "Neon Cityscape.jpg",
      url: "https://picsum.photos/seed/neon/400/400",
      size: 2451201,
    },
    {
      name: "Ancient Ruins.jpg",
      url: "https://picsum.photos/seed/ruins/400/400",
      size: 1845120,
    },
    {
      name: "Sunset Beach.jpg",
      url: "https://picsum.photos/seed/beach/400/400",
      size: 1951010,
    },
  ],
  "folder-3": [
    // Item
    {
      name: "Magic Sword.jpg",
      url: "https://picsum.photos/seed/sword/400/400",
      size: 450120,
    },
    {
      name: "Plasma Rifle.jpg",
      url: "https://picsum.photos/seed/rifle/400/400",
      size: 685121,
    },
    {
      name: "Healing Potion.jpg",
      url: "https://picsum.photos/seed/potion/400/400",
      size: 320145,
    },
  ],
  "folder-4": [
    // Style
    {
      name: "Watercolor Style.jpg",
      url: "https://picsum.photos/seed/watercolor/400/400",
      size: 1450120,
    },
    {
      name: "Cyberpunk Aesthetic.jpg",
      url: "https://picsum.photos/seed/cyberstyle/400/400",
      size: 1685121,
    },
    {
      name: "Oil Painting Style.jpg",
      url: "https://picsum.photos/seed/oilstyle/400/400",
      size: 1320145,
    },
  ],
  "folder-5": [
    // Sound Effect
    {
      name: "Laser Shot SFX.wav",
      url: "https://picsum.photos/seed/laser/400/400",
      size: 85120,
    },
    {
      name: "Explosion SFX.wav",
      url: "https://picsum.photos/seed/explosion/400/400",
      size: 220145,
    },
  ],
  "folder-6": [
    // Others
    {
      name: "Mock Interface Asset.png",
      url: "https://picsum.photos/seed/ui/400/400",
      size: 1320145,
    },
    {
      name: "Geometric Overlay.png",
      url: "https://picsum.photos/seed/geom/400/400",
      size: 820145,
    },
  ],
};

const getMockFilesForFolder = (folderId: string, folderName: string) => {
  if (MOCK_FILES_BY_FOLDER[folderId]) {
    return MOCK_FILES_BY_FOLDER[folderId];
  }
  const prefix = folderName || "Asset";
  return [
    {
      name: `${prefix}_Mock_A.jpg`,
      url: `https://picsum.photos/seed/${prefix}A/400/400`,
      size: 1048576,
    },
    {
      name: `${prefix}_Mock_B.jpg`,
      url: `https://picsum.photos/seed/${prefix}B/400/400`,
      size: 1153433,
    },
    {
      name: `${prefix}_Mock_C.jpg`,
      url: `https://picsum.photos/seed/${prefix}C/400/400`,
      size: 985121,
    },
  ];
};

const MaterialsView = ({
  folders,
  materials,
  searchQuery,
  setSearchQuery,
  addFolder,
  removeFolder,
  updateFolder,
  onAdd,
  onDelete,
  addMaterial,
  clearFolderMaterials,
  onDragStart,
  onDoubleClickImage,
  handleCreateFolder,
  editingFolderId,
  setEditingFolderId,
  editingFolderName,
  setEditingFolderName,
}: any) => {
  const [loadedAspects, setLoadedAspects] = useState<Record<string, string>>(
    {},
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    () => {
      return localStorage.getItem("fm_selectedFolderId") || null;
    },
  );
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(
    null,
  );
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tempPath, setTempPath] = useState("");
  const [colorMenuIndex, setColorMenuIndex] = useState<number | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [imageStatuses, setImageStatuses] = useState<Record<string, "loading" | "loaded" | "error">>({});
  
  const [sortOption, setSortOption] = useState<"createdAt" | "updatedAt" | "name" | "size">("createdAt");
  const [sortDesc, setSortDesc] = useState(true);

  // Helper for auto-categorizing files
  const autoCategorize = (filename: string) => {
    const lower = filename.toLowerCase();
    for (const f of folders) {
      const fName = f.name.toLowerCase();
      if (lower.includes(fName)) return f.id;
      if ((lower.includes("char") || lower.includes("hero")) && fName.includes("character")) return f.id;
      if ((lower.includes("scene") || lower.includes("bg") || lower.includes("env")) && fName.includes("scene")) return f.id;
      if ((lower.includes("item") || lower.includes("weapon") || lower.includes("prop")) && fName.includes("prop")) return f.id;
      if ((lower.includes("icon") || lower.includes("ui")) && fName.includes("ui")) return f.id;
    }
    return selectedFolderId;
  };

  // Custom states for drag-box selection
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    selecting: boolean;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Custom states for Grid Zoom, hover original size, and fullscreen
  const [itemSize, setItemSize] = useState(() => {
    return Number(localStorage.getItem("fm_itemSize")) || 150;
  });
  const [hoverImageId, setHoverImageId] = useState<string | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);

  const [simulatePalette] = useState([
    "#e0cab4",
    "#dbcdb8",
    "#bf966c",
    "#986a42",
    "#79442d",
    "#bea593",
    "#e4d3c3",
    "#ecdcc3",
  ]);

  const localSyncInputRef = useRef<HTMLInputElement>(null);

  const selectedFolder = folders.find((f: any) => f.id === selectedFolderId);
  const filteredMaterials = materials.filter((m: any) => {
    const matchesFolder = !selectedFolderId || m.folderId === selectedFolderId;
    const matchesSearch = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  }).sort((a: any, b: any) => {
    let cmp = 0;
    if (sortOption === "createdAt") cmp = (a.createdAt || 0) - (b.createdAt || 0);
    else if (sortOption === "updatedAt") cmp = (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0);
    else if (sortOption === "size") cmp = (a.size || 0) - (b.size || 0);
    else if (sortOption === "name") cmp = a.name.localeCompare(b.name);
    
    return sortDesc ? -cmp : cmp;
  });
  const selectedMaterial = materials.find(
    (m: any) => m.id === selectedMaterialId,
  );

  useEffect(() => {
    if (selectedFolderId)
      localStorage.setItem("fm_selectedFolderId", selectedFolderId);
    else localStorage.removeItem("fm_selectedFolderId");
  }, [selectedFolderId]);

  useEffect(() => {
    localStorage.setItem("fm_itemSize", String(itemSize));
  }, [itemSize]);

  // Zoom mouse wheel handler
  const handleGridWheel = (e: React.WheelEvent) => {
    if (e.altKey) {
      e.stopPropagation(); // prevent window scrolling depending on the context
      setItemSize((prev) => {
        let newSize = prev - e.deltaY * 0.2;
        if (newSize < 60) newSize = 60; // min 60px size
        if (newSize > 600) newSize = 600; // max reasonable width
        return newSize;
      });
    }
  };

  // Real Sync Logic using Browser File Picker
  const handleSync = async () => {
    if (!selectedFolderId) return;

    if ("showDirectoryPicker" in window) {
      try {
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker();
        setIsSyncing(true);
        updateFolder(selectedFolderId, { path: `本地目录: ${dirHandle.name}` });

        clearFolderMaterials(selectedFolderId);

        const newMaterials = [];
        // @ts-ignore
        for await (const entry of dirHandle.values()) {
          if (entry.kind === "file") {
            const file = await entry.getFile();
            if (file.type.startsWith("image/")) {
              const url = URL.createObjectURL(file);
              newMaterials.push({
                name: file.name,
                url: url,
                type: "image",
                size: file.size,
                folderId: selectedFolderId,
              });
            }
          }
        }
        newMaterials.forEach((m) => addMaterial(m));
        setIsSyncing(false);
      } catch (err) {
        setIsSyncing(false);
        // Fallback to input if user cancelled or error
        if ((err as Error).name !== "AbortError") {
          localSyncInputRef.current?.click();
        }
      }
    } else {
      localSyncInputRef.current?.click();
    }
  };

  const [folderPanelWidth, setFolderPanelWidth] = useState(200);
  const folderResizeRef = useRef({ active: false, startX: 0, startWidth: 0 });

  useEffect(() => {
    const handleWinMouseMove = (e: MouseEvent) => {
      if (folderResizeRef.current.active) {
        const { startX, startWidth } = folderResizeRef.current;
        const newWidth = Math.max(
          150,
          Math.min(400, startWidth + (e.clientX - startX)),
        );
        setFolderPanelWidth(newWidth);
      }
    };
    const handleWinMouseUp = () => {
      folderResizeRef.current.active = false;
      document.body.style.cursor = "";
    };
    if (folderResizeRef.current.active) {
      window.addEventListener("mousemove", handleWinMouseMove);
      window.addEventListener("mouseup", handleWinMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleWinMouseMove);
      window.removeEventListener("mouseup", handleWinMouseUp);
    };
  });

  const handleFolderResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    folderResizeRef.current = {
      active: true,
      startX: e.clientX,
      startWidth: folderPanelWidth,
    };
    document.body.style.cursor = "col-resize";
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedFolderId) return;

    setIsSyncing(true);
    // Optionally clear current materials to "refresh" from local
    clearFolderMaterials(selectedFolderId);

    // Read files and add as materials with local blob URLs
    Array.from(files).forEach((file: File) => {
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        addMaterial({
          name: file.name,
          url: url,
          type: "image",
          size: file.size,
          folderId: selectedFolderId,
        });
      }
    });

    // Simulate a brief delay for UI feedback
    setTimeout(() => {
      setIsSyncing(false);
      // Clean up input
      if (localSyncInputRef.current) localSyncInputRef.current.value = "";
    }, 600);
  };

  // Toggle edit and save
  const handleToggleEdit = () => {
    if (isEditingPath) {
      updateFolder(selectedFolderId, { path: tempPath });
    } else {
      setTempPath(selectedFolder?.path || "");
    }
    setIsEditingPath(!isEditingPath);
  };

  const handleAddLocalPath = () => {
    const name = prompt("请输入文件夹名称:");
    if (!name) return;
    const newId = crypto.randomUUID();
    addFolder(name, "C:\\AI\\Assets\\Local_Repo", undefined, newId);

    // Auto-select the newly created folder
    setTimeout(() => {
      setSelectedFolderId(newId);
    }, 100);
  };

  const handleGridMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-id]")) return;
    if (!gridContainerRef.current) return;
    if (!e.shiftKey && !e.ctrlKey) setSelectedIds(new Set());
    const rect = gridContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + gridContainerRef.current.scrollLeft;
    const y = e.clientY - rect.top + gridContainerRef.current.scrollTop;
    setSelectionBox({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      selecting: true,
    });
  };

  const handleGridMouseMove = (e: React.MouseEvent) => {
    if (!selectionBox?.selecting || !gridContainerRef.current) return;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + gridContainerRef.current.scrollLeft;
    const y = e.clientY - rect.top + gridContainerRef.current.scrollTop;
    const newBox = { ...selectionBox, currentX: x, currentY: y };
    setSelectionBox(newBox);
    const left = Math.min(newBox.startX, x),
      top = Math.min(newBox.startY, y);
    const right = Math.max(newBox.startX, x),
      bottom = Math.max(newBox.startY, y);
    const items = gridContainerRef.current.querySelectorAll("[data-id]");
    const newSelected = new Set(
      !e.shiftKey && !e.ctrlKey ? [] : Array.from(selectedIds),
    );
    items.forEach((item) => {
      const el = item as HTMLElement;
      const itemLeft = el.offsetLeft,
        itemTop = el.offsetTop,
        itemRight = itemLeft + el.offsetWidth,
        itemBottom = itemTop + el.offsetHeight;
      const isIntersecting = !(
        left > itemRight ||
        right < itemLeft ||
        top > itemBottom ||
        bottom < itemTop
      );
      if (isIntersecting) newSelected.add(el.getAttribute("data-id") as string);
    });
    setSelectedIds(newSelected);
  };

  const handleGridMouseUp = () => {
    if (selectionBox)
      setSelectionBox((prev) => (prev ? { ...prev, selecting: false } : null));
  };

  const handleDeleteSelected = () => {
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = () => {
    selectedIds.forEach((id) => onDelete(id));
    setSelectedIds(new Set());
    setShowDeleteConfirmModal(false);
  };

  return (
    <div className="flex-1 flex flex-row bg-[var(--bg-primary)] overflow-hidden w-full h-full">
      {/* Hidden inputs for folder/file sync */}
      <input
        type="file"
        ref={localSyncInputRef}
        onChange={handleLocalFileChange}
        className="hidden"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        accept="image/*"
      />

      {/* Left Column: Folders */}
      <div
        style={{ width: folderPanelWidth }}
        className="border-r border-[var(--border)] flex flex-col bg-black/10 shrink-0 relative"
      >
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-black/20">
          <span className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <FolderOpen size={14} /> 素材库
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCreateFolder}
              className="text-gray-400 hover:text-white transition-colors"
              title="新建文件夹"
            >
              <FolderPlus size={16} />
            </button>
            <button
              onClick={handleAddLocalPath}
              className="text-gray-400 hover:text-accent transition-colors"
              title="扫描本地目录"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div
            className={`px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-all ${!selectedFolderId ? "bg-accent text-white shadow-lg" : "text-gray-400 hover:bg-white/5"}`}
            onClick={() => setSelectedFolderId(null)}
          >
            <FolderOpen size={16} />
            <span className="truncate text-sm font-bold">所有素材</span>
          </div>
          {folders.map((folder: any) => (
            <div
              key={folder.id}
              className={`group px-3 py-2 rounded-lg flex justify-between items-center gap-2 cursor-pointer transition-all ${selectedFolderId === folder.id ? "bg-[var(--bg-tertiary)] border border-white/10 shadow-lg text-white font-bold" : "text-gray-400 border border-transparent hover:bg-white/5"}`}
              onClick={() => setSelectedFolderId(folder.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingFolderId(folder.id);
                setEditingFolderName(folder.name);
              }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Folder
                  size={14}
                  className={`shrink-0 ${selectedFolderId === folder.id ? "text-accent" : "text-accent/70 group-hover:text-accent"}`}
                />
                {editingFolderId === folder.id ? (
                  <input
                    autoFocus
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    onBlur={() => {
                      if (editingFolderName.trim())
                        updateFolder(folder.id, {
                          name: editingFolderName.trim(),
                        });
                      setEditingFolderId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editingFolderName.trim())
                          updateFolder(folder.id, {
                            name: editingFolderName.trim(),
                          });
                        setEditingFolderId(null);
                      }
                    }}
                    className="flex-1 min-w-0 bg-black/50 text-white px-1 -mx-1 text-sm outline-none border border-accent/50 rounded font-normal"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate text-sm">{folder.name}</span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFolder(folder.id);
                  if (selectedFolderId === folder.id) setSelectedFolderId(null);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded shrink-0 transition-colors"
                title="删除目录"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Resize Handle for Folder panel */}
        <div
          onMouseDown={handleFolderResizeStart}
          className="absolute top-0 -right-1.5 w-3 h-full cursor-col-resize hover:bg-accent/50 transition-colors z-[60]"
        />
      </div>

      {/* Middle Column: Images Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)]/30 relative">
        <div className="h-14 border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0 bg-black/10 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span className="font-bold text-gray-300 truncate">
              {selectedFolderId ? selectedFolder?.name : "所有素材"}
            </span>
          </div>
          <div className="flex items-center gap-4 flex-1 justify-end">
            <div className="flex items-center gap-2">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="bg-black/30 border border-[var(--border)] rounded-full py-1 pl-3 pr-8 text-sm text-gray-300 focus:border-accent/50 focus:outline-none transition-colors appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                  backgroundSize: "14px"
                }}
              >
                <option value="createdAt" className="bg-zinc-900 text-white">创建时间</option>
                <option value="updatedAt" className="bg-zinc-900 text-white">修改时间</option>
                <option value="name" className="bg-zinc-900 text-white">文件名称</option>
                <option value="size" className="bg-zinc-900 text-white">文件大小</option>
              </select>
              <button
                onClick={() => setSortDesc(!sortDesc)}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 transition-colors"
                title={sortDesc ? "降序" : "升序"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortDesc ? 'scaleY(-1)' : 'none' }}>
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
              </button>
            </div>
            <div className="relative w-48 shrink-0">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索素材..."
                className="w-full bg-black/30 border border-[var(--border)] rounded-full py-1 pl-8 pr-3 text-sm text-white focus:border-accent/50 focus:outline-none transition-colors"
              />
            </div>

            {/* Slider added matching Figure 2 requirement for "放大整体列表的大小图片的比例" */}
            <div className="flex items-center gap-2 px-3 py-1 bg-black/20 rounded-full border border-white/5">
              <input
                type="range"
                min="60"
                max="600"
                step="10"
                value={itemSize}
                onChange={(e) => setItemSize(Number(e.target.value))}
                className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-gray-400 hover:bg-white/30 transition-colors [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
              <span className="text-xs font-mono text-gray-500 w-8 text-right">
                {Math.round((itemSize / 600) * 100)}%
              </span>
            </div>

            {selectedIds.size > 0 && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowBatchMenu(!showBatchMenu);
                    setShowMoveSubmenu(false);
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-xs font-bold transition-all shadow-md tracking-wide cursor-pointer"
                >
                  <Layers size={13} />
                  <span>批量操作 ({selectedIds.size}项)</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${showBatchMenu ? "rotate-180" : ""}`}
                  />
                </button>

                {showBatchMenu && (
                  <div className="absolute right-0 top-9 w-52 bg-zinc-900/95 border border-zinc-700/80 rounded-xl py-2 shadow-2xl z-[1001] animate-in fade-in slide-in-from-top-2 duration-100 font-sans text-xs text-left backdrop-blur-md">
                    <div className="px-3 pb-1.5 border-b border-zinc-800 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      已选中 {selectedIds.size} 个项目
                    </div>

                    <button
                      onClick={() => {
                        selectedIds.forEach((id) => {
                          const file = materials.find((m: any) => m.id === id);
                          if (file) onAdd(file);
                        });
                        setSelectedIds(new Set());
                        setShowBatchMenu(false);
                      }}
                      className="w-full px-4 py-2 hover:bg-white/10 text-gray-200 flex items-center gap-2 transition-colors cursor-pointer text-left font-medium"
                    >
                      <PlusSquare size={14} className="text-accent" />
                      <span>添加所有到画布</span>
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setShowMoveSubmenu(!showMoveSubmenu)}
                        className={`w-full px-4 py-2 hover:bg-white/10 text-gray-200 flex items-center justify-between transition-colors cursor-pointer text-left font-medium ${showMoveSubmenu ? "bg-white/5" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <FolderClosed size={14} className="text-yellow-500" />
                          <span>移动至文件夹...</span>
                        </div>
                        <ChevronRight
                          size={12}
                          className={`text-gray-500 transition-transform ${showMoveSubmenu ? "rotate-90" : ""}`}
                        />
                      </button>

                      {showMoveSubmenu && (
                        <div className="bg-black/50 border-y border-zinc-800/80 py-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                          {folders.map((f: any) => (
                            <button
                              key={f.id}
                              onClick={() => {
                                const { materials } = useStore.getState();
                                const updatedMaterials = materials.map(
                                  (m: any) =>
                                    selectedIds.has(m.id)
                                      ? { ...m, folderId: f.id }
                                      : m,
                                );
                                useStore.setState({
                                  materials: updatedMaterials,
                                });
                                setSelectedIds(new Set());
                                setShowBatchMenu(false);
                                setShowMoveSubmenu(false);
                              }}
                              className="w-full px-6 py-1.5 hover:bg-white/10 text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer text-left truncate"
                            >
                              <div className="w-1 h-1 rounded-full bg-yellow-500" />
                              <span className="truncate">{f.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        const allFilteredIds = filteredMaterials.map(
                          (m: any) => m.id,
                        );
                        setSelectedIds(new Set(allFilteredIds));
                        setShowBatchMenu(false);
                      }}
                      className="w-full px-4 py-2 hover:bg-white/10 text-gray-200 flex items-center gap-2 transition-colors cursor-pointer text-left font-medium"
                    >
                      <CheckSquare size={14} className="text-gray-400" />
                      <span>全选当前视图</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedIds(new Set());
                        setShowBatchMenu(false);
                      }}
                      className="w-full px-4 py-2 hover:bg-white/10 text-gray-200 flex items-center gap-2 transition-colors cursor-pointer text-left font-medium border-b border-zinc-800/60"
                    >
                      <XSquare size={14} className="text-zinc-500" />
                      <span>取消选择</span>
                    </button>

                    <button
                      onClick={() => {
                        handleDeleteSelected();
                        setShowBatchMenu(false);
                      }}
                      className="w-full px-4 py-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer text-left font-medium"
                    >
                      <Trash2 size={14} />
                      <span>彻底删除已选</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedFolderId && (
          <div className="px-4 py-2 border-b border-[var(--border)] bg-black/20 flex flex-wrap items-center gap-3 shrink-0">
            {/* Show Current Synced Folder Path */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono flex-1 min-w-[150px] truncate">
              <span className="text-accent flex items-center gap-1 shrink-0 font-sans font-bold">
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />{" "}
                当前地址:
              </span>
              <span
                className="truncate text-gray-500"
                title={selectedFolder?.path}
              >
                {selectedFolder?.path || "C:\\AI\\Assets\\Local"}
              </span>
            </div>

            {/* Upload File Button */}
            <button
              onClick={() => {
                const fileInput = document.createElement("input");
                fileInput.type = "file";
                fileInput.multiple = true;
                fileInput.accept = "image/*";
                fileInput.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (!files || !selectedFolderId) return;
                  setIsSyncing(true);
                  Array.from(files).forEach((file: File) => {
                    if (file.type.startsWith("image/")) {
                      const url = URL.createObjectURL(file);
                      addMaterial({
                        name: file.name,
                        url: url,
                        type: "image",
                        size: file.size,
                        folderId: selectedFolderId,
                      });
                    }
                  });
                  setTimeout(() => {
                    setIsSyncing(false);
                  }, 400);
                };
                fileInput.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent/20 hover:border-accent/40 rounded-lg text-accent text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
              title="上传文件导入"
            >
              <Upload size={13} />
              <span>上传文件导入</span>
            </button>

            {/* Refresh / Sync assets in current folder address */}
            <button
              onClick={async () => {
                setIsSyncing(true);
                // Simulate checking directory files
                setTimeout(() => {
                  const currentMaterials = materials.filter(
                    (m: any) => m.folderId === selectedFolderId,
                  );
                  const currentNames = new Set(
                    currentMaterials.map((m: any) => m.name),
                  );

                  // Get mockup files for the active folder
                  const mockFiles = getMockFilesForFolder(
                    selectedFolderId,
                    selectedFolder?.name || "",
                  );

                  // Check which are new compared to materials in state
                  const newFiles = mockFiles.filter(
                    (f) => !currentNames.has(f.name),
                  );

                  if (newFiles.length > 0) {
                    newFiles.forEach((file) => {
                      addMaterial({
                        name: file.name,
                        url: file.url,
                        type: "image",
                        size: file.size,
                        folderId: autoCategorize(file.name),
                      });
                    });
                    alert(
                      `刷新成功！检测到新增加的资源图片，已自动同步加载 ${newFiles.length} 个新文件至素材库，并自动进行了归类。`,
                    );
                  } else {
                    const randomNum = Math.floor(Math.random() * 1000);
                    const newRandomName = `New_${selectedFolder?.name || "Asset"}_${randomNum}.jpg`;
                    const newRandomUrl = `https://picsum.photos/seed/new_${selectedFolder?.name || "asset"}_${randomNum}/400/400`;

                    addMaterial({
                      name: newRandomName,
                      url: newRandomUrl,
                      type: "image",
                      size: 102400 + Math.floor(Math.random() * 500000),
                      folderId: autoCategorize(newRandomName),
                    });

                    alert(
                      `刷新成功！未发现固定资产变更，测试用：在本地地址中识别到刚新建的图片 "${newRandomName}" ，已自动同步归类到对应标签中。`,
                    );
                  }
                  setIsSyncing(false);
                }, 800);
              }}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-gray-200 hover:text-white text-xs transition-colors shadow-sm shrink-0 cursor-pointer"
              title="刷新当前文件的地址的图片更新"
            >
              <RefreshCw
                size={12}
                className={isSyncing ? "animate-spin text-accent" : ""}
              />
              <span>刷新同步资产</span>
            </button>
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto p-4 custom-scrollbar relative select-none"
          onWheel={handleGridWheel}
          ref={gridContainerRef}
          onMouseDown={handleGridMouseDown}
          onMouseMove={handleGridMouseMove}
          onMouseUp={handleGridMouseUp}
          onMouseLeave={handleGridMouseUp}
        >
          {selectionBox?.selecting && (
            <div
              className="absolute bg-accent/20 border border-accent rounded-sm pointer-events-none z-[100]"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.currentX),
                top: Math.min(selectionBox.startY, selectionBox.currentY),
                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                height: Math.abs(selectionBox.currentY - selectionBox.startY),
              }}
            />
          )}

          {filteredMaterials.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 select-none px-6 text-center">
              <FolderOpen
                size={48}
                strokeWidth={1}
                className="mb-4 text-gray-500"
              />
              <p className="text-sm font-bold tracking-widest uppercase text-gray-400">
                尚未同步或拖入任何素材
              </p>
              <p className="text-sm mt-2 leading-relaxed">
                点击同步资产按钮扫描绑定的本地路径，或拖拽文件至此
              </p>
            </div>
          ) : (
            <div
              className="pb-12"
              style={{
                columnWidth: `${itemSize}px`,
                columnGap: "16px",
                width: "100%",
              }}
            >
              {filteredMaterials.map((file: any, index: number) => (
                <div
                  key={file.id}
                  data-id={file.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, file)}
                  onDoubleClick={() => setFullscreenIndex(index)}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button")) return;
                    if (e.ctrlKey || e.shiftKey || selectedIds.size > 0) {
                      const newSelected = new Set(selectedIds);
                      if (newSelected.has(file.id)) newSelected.delete(file.id);
                      else newSelected.add(file.id);
                      setSelectedIds(newSelected);
                    } else {
                      setSelectedMaterialId(file.id);
                    }
                  }}
                  style={
                    loadedAspects[file.id]
                      ? { aspectRatio: loadedAspects[file.id] }
                      : {}
                  }
                  className={`group relative bg-black/30 rounded-xl overflow-hidden border transition-all cursor-pointer shadow-sm select-none w-full h-auto break-inside-avoid inline-block mb-3.5 ${
                    selectedIds.has(file.id)
                      ? "border-accent ring-2 ring-accent/40 ring-offset-1 ring-offset-zinc-900 shadow-md"
                      : selectedMaterialId === file.id
                        ? "border-accent ring-2 ring-accent/30 scale-95"
                        : "border-[var(--border)] hover:border-white/20"
                  }`}
                >
                  {/* Image Status Indicators */}
                  {imageStatuses[file.id] === "error" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-800 text-zinc-500 z-0">
                      <ImageIcon size={24} className="mb-2 opacity-30" />
                      <span className="text-[10px] uppercase tracking-wider">Failed</span>
                    </div>
                  )}
                  {(!imageStatuses[file.id] || imageStatuses[file.id] === "loading") && (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 animate-pulse z-0" />
                  )}

                  {/* Checkbox for Multi-Select */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSelected = new Set(selectedIds);
                      if (newSelected.has(file.id)) {
                        newSelected.delete(file.id);
                      } else {
                        newSelected.add(file.id);
                      }
                      setSelectedIds(newSelected);
                    }}
                    className={`absolute top-2 left-2 w-[22px] h-[22px] rounded-md border flex items-center justify-center transition-all z-20 cursor-pointer ${
                      selectedIds.has(file.id)
                        ? "bg-accent border-accent text-white opacity-100 scale-100 shadow-sm"
                        : "bg-black/50 border-white/30 text-transparent opacity-0 group-hover:opacity-100 hover:border-accent hover:bg-black/70 scale-90 hover:scale-100"
                    }`}
                    title={selectedIds.has(file.id) ? "取消选择" : "选择此项目"}
                  >
                    <Check
                      size={12}
                      strokeWidth={3}
                      className={
                        selectedIds.has(file.id)
                          ? "block text-white"
                          : "hidden group-hover:block text-white/50"
                      }
                    />
                  </div>
                  <img
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    src={file.url}
                    alt={file.name}
                    onLoad={(e) => {
                      setImageStatuses((prev) => ({ ...prev, [file.id]: "loaded" }));
                      const { naturalWidth, naturalHeight } = e.currentTarget;
                      if (naturalWidth && naturalHeight) {
                        setLoadedAspects((prev) => ({
                          ...prev,
                          [file.id]: `${naturalWidth}/${naturalHeight}`,
                        }));
                      }
                    }}
                    onError={() => {
                      setImageStatuses((prev) => ({ ...prev, [file.id]: "error" }));
                    }}
                    className={`w-full h-auto block select-none z-10 relative transition-opacity duration-300 ${
                      imageStatuses[file.id] === "loaded" ? "opacity-100" : "opacity-0"
                    }`}
                  />

                  {/* Hover Action Overlay */}
                  <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-end p-2 gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdd(file);
                      }}
                      className="w-7 h-7 flex items-center justify-center bg-black/60 backdrop-blur-md rounded border border-white/10 hover:bg-black text-white transition-colors"
                      title="添加至画布"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(file.id);
                        if (selectedMaterialId === file.id)
                          setSelectedMaterialId(null);
                      }}
                      className="w-7 h-7 flex items-center justify-center bg-black/60 backdrop-blur-md rounded border border-white/10 hover:bg-black text-red-400 hover:text-red-300 transition-colors"
                      title="删除素材"
                    >
                      <Minus size={14} />
                    </button>
                  </div>

                  {/* Bottom Right Zoom Icon directly mimicking Eagle/Pinterest */}
                  <button
                    onMouseEnter={() => setHoverImageId(file.id)}
                    onMouseLeave={() => setHoverImageId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFullscreenIndex(index);
                    }}
                    className="absolute bottom-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded border border-white/10 opacity-0 group-hover:opacity-100 text-white/70 hover:text-white hover:bg-zinc-800 transition-all shadow-lg pointer-events-auto"
                    title="放大镜"
                  >
                    <ZoomIn size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Properties panel */}
      {selectedMaterial && (
        <div className="w-[280px] min-w-[280px] border-l border-[var(--border)] bg-black/20 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-secondary)] sticky top-0 z-10 shrink-0">
            <span className="font-bold text-gray-300 text-sm">基本信息</span>
            <button
              onClick={() => setSelectedMaterialId(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Thumbnail */}
            <div className="w-full relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMmEyYTJhIj48L3JlY3Q+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMyYTJhMmEiPjwvcmVjdD4KPC9zdmc+')] rounded-xl overflow-hidden border border-[var(--border)] flex items-center justify-center">
              <img
                draggable={false}
                loading="lazy"
                decoding="async"
                src={selectedMaterial.url}
                className="w-full object-contain backdrop-blur-sm shadow-2xl"
              />
            </div>

            {/* Color Palette Analysis */}
            <div className="flex gap-2.5 flex-wrap">
              {simulatePalette.map((color, i) => (
                <div key={i} className="relative">
                  <button
                    onClick={() =>
                      setColorMenuIndex(colorMenuIndex === i ? null : i)
                    }
                    className="w-5 h-5 rounded-full border shadow-sm hover:scale-125 transition-transform"
                    style={{
                      backgroundColor: color,
                      borderColor:
                        colorMenuIndex === i ? "#fff" : "transparent",
                    }}
                  />
                  {colorMenuIndex === i && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl py-2 min-w-[150px] shadow-2xl z-50 whitespace-nowrap text-xs text-left">
                      <div className="px-3 py-1.5 font-bold text-gray-200 border-b border-white/5 bg-black/20 text-center tracking-wider font-mono">
                        {color.toUpperCase()} (
                        {(Math.random() * 10 + 5).toFixed(1)}%)
                      </div>
                      <div
                        onClick={() => {
                          navigator.clipboard.writeText(color);
                          setColorMenuIndex(null);
                        }}
                        className="px-4 py-2 mt-1 text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center justify-between"
                      >
                        复制 {color}{" "}
                        <span className="opacity-50 text-[10px]">HEX</span>
                      </div>
                      <div
                        onClick={() => {
                          setColorMenuIndex(null);
                        }}
                        className="px-4 py-2 text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center justify-between"
                      >
                        复制 rgb(...){" "}
                        <span className="opacity-50 text-[10px]">RGB</span>
                      </div>
                      <div
                        onClick={() => {
                          setColorMenuIndex(null);
                        }}
                        className="px-4 py-2 text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center justify-between"
                      >
                        搜索相似色彩 <Search size={12} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest pl-1 mb-1 block">
                  文件名
                </label>
                <input
                  type="text"
                  defaultValue={
                    selectedMaterial.name.split(".")[0] || "Image Name"
                  }
                  className="w-full bg-black/20 hover:bg-black/40 border border-transparent hover:border-white/10 focus:bg-black/50 focus:border-accent rounded-lg px-3 py-2 text-sm text-gray-300 focus:text-white transition-all outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest pl-1 mb-1 block">
                  注释
                </label>
                <textarea
                  className="w-full bg-black/20 hover:bg-black/40 border border-transparent hover:border-white/10 focus:bg-black/50 focus:border-accent rounded-lg px-3 py-2 text-sm text-gray-300 focus:text-white transition-all outline-none resize-none h-24 custom-scrollbar leading-relaxed"
                  placeholder="添加备注信息..."
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-widest pl-1 mb-1 block">
                  来源
                </label>
                <input
                  type="text"
                  className="w-full bg-black/20 hover:bg-black/40 border border-transparent hover:border-white/10 focus:bg-black/50 focus:border-accent rounded-lg px-3 py-2 text-sm text-gray-300 focus:text-white transition-all outline-none font-mono"
                  placeholder="http://"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2 pb-4 border-b border-[var(--border)]">
              <span className="text-xs font-bold text-gray-500 uppercase flex justify-between items-center px-1">
                标签管理
              </span>
              <button className="w-full py-2 border border-dashed border-[var(--border)] text-gray-500 hover:text-gray-300 hover:bg-white/5 hover:border-gray-500 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors">
                <Plus size={14} /> 添加标签
              </button>
            </div>

            {/* Basic Info Details */}
            <div className="space-y-3 pb-6">
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">评分</span>
                  <span className="text-accent flex gap-1 cursor-pointer hover:opacity-80">
                    {" "}
                    <Star size={12} fill="currentColor" />
                    <Star size={12} fill="currentColor" />
                    <Star size={12} className="text-gray-600" />
                    <Star size={12} className="text-gray-600" />
                    <Star size={12} className="text-gray-600" />{" "}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">尺寸</span>
                  <span className="text-gray-300 font-mono tracking-wider">
                    2000 × 2500
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">文件大小</span>
                  <span className="text-gray-300 font-mono tracking-wider">
                    {(selectedMaterial.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">格式</span>
                  <span className="text-gray-300 uppercase tracking-widest">
                    {selectedMaterial.name.split(".").pop() || "PNG"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">添加日期</span>
                  <span className="text-gray-300 font-mono text-[11px] opacity-80">
                    2026/05/04 00:30
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">修改日期</span>
                  <span className="text-gray-300 font-mono text-[11px] opacity-80">
                    2026/05/04 00:30
                  </span>
                </div>
              </div>
              <button className="mt-6 w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-lg border border-[var(--border)] transition-all flex items-center justify-center gap-2 text-sm font-bold text-gray-300 group">
                <Upload
                  size={14}
                  className="group-hover:-translate-y-0.5 transition-transform"
                />{" "}
                导出文件
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hover Image Portal */}
      {hoverImageId &&
        createPortal(
          <div className="fixed inset-0 z-[999999] pointer-events-none flex items-center justify-center p-8 bg-black/40 backdrop-blur-sm transition-all duration-200">
            <img
              src={materials.find((m: any) => m.id === hoverImageId)?.url}
              className="max-w-[90vw] max-h-[90vh] object-contain drop-shadow-2xl rounded-sm scale-100"
              style={{ filter: "drop-shadow(0 25px 50px rgba(0,0,0,0.6))" }}
              alt="Hover Preview"
            />
          </div>,
          document.body,
        )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-white mb-2">确认删除素材</h3>
            <p className="text-gray-400 text-sm mb-4">
              您确定要删除选中的 {selectedIds.size} 个素材吗？此操作不可逆。
            </p>
            <div className="flex flex-wrap gap-2 mb-6 max-h-48 overflow-y-auto custom-scrollbar p-2 bg-black/30 rounded-lg">
              {Array.from(selectedIds).map((id) => {
                const material = materials.find((m: any) => m.id === id);
                if (!material) return null;
                return (
                  <img
                    key={id}
                    src={material.url}
                    alt={material.name}
                    className="w-12 h-12 object-cover rounded-md border border-zinc-700"
                  />
                );
              })}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition shadow"
              >
                彻底删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Viewer Component */}
      {fullscreenIndex !== null && (
        <FullscreenViewer
          images={filteredMaterials}
          initialIndex={fullscreenIndex}
          onClose={() => setFullscreenIndex(null)}
        />
      )}
    </div>
  );
};

const OutputView = ({ onAdd, onDragStart, onDoubleClickImage }: any) => {
  const [loadedAspects, setLoadedAspects] = useState<Record<string, string>>(
    {},
  );
  const [folders] = useState([
    { name: "Multiple grids", id: "out-1" },
    { name: "mask_preview", id: "out-2" },
    { name: "mask", id: "out-3" },
    { name: "_derived", id: "out-4" },
  ]);
  const [files, setFiles] = useState([
    {
      id: "f-1",
      name: "output_001.png",
      url: "https://picsum.photos/seed/out1/800/800",
      type: "image" as const,
    },
    {
      id: "f-2",
      name: "output_002.png",
      url: "https://picsum.photos/seed/out2/800/800",
      type: "image" as const,
    },
    {
      id: "f-3",
      name: "output_003.png",
      url: "https://picsum.photos/seed/out3/800/800",
      type: "image" as const,
    },
    {
      id: "f-4",
      name: "output_004.png",
      url: "https://picsum.photos/seed/out4/800/800",
      type: "image" as const,
    },
    {
      id: "f-5",
      name: "output_005.png",
      url: "https://picsum.photos/seed/out5/800/800",
      type: "image" as const,
    },
    {
      id: "f-6",
      name: "output_006.png",
      url: "https://picsum.photos/seed/out6/800/800",
      type: "image" as const,
    },
  ]);

  const handleDeleteFile = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]/50 overflow-hidden">
      <div className="p-6 pb-4 border-b border-[var(--border)] space-y-4">
        <p className="text-sm text-gray-500 font-bold uppercase tracking-widest leading-none">
          浏览 output 输出目录
        </p>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-white/5 border border-[var(--border)] rounded-lg text-sm font-bold text-gray-400">
            output
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-2 gap-4">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="p-4 bg-white/5 border border-[var(--border)] rounded-2xl hover:bg-white/10 cursor-pointer transition-all flex flex-col items-center gap-3 group"
            >
              <div className="p-3 bg-accent/10 rounded-xl group-hover:scale-110 transition-transform">
                <Folder size={24} className="text-accent" />
              </div>
              <span className="text-sm font-bold text-gray-400 text-center line-clamp-1">
                {folder.name}
              </span>
            </div>
          ))}
          {files.map((file) => (
            <div
              key={file.id}
              draggable
              onDragStart={(e) => onDragStart(e, file)}
              onDoubleClick={() => onDoubleClickImage?.(file.url)}
              style={{ aspectRatio: loadedAspects[file.id] || "1/1" }}
              className="group relative bg-black/20 rounded-2xl overflow-hidden border border-[var(--border)] hover:border-accent/30 transition-all cursor-pointer w-full h-auto"
            >
              <img
                draggable={false}
                loading="lazy"
                decoding="async"
                src={file.url}
                alt={file.name}
                onLoad={(e) => {
                  const { naturalWidth, naturalHeight } = e.currentTarget;
                  if (naturalWidth && naturalHeight) {
                    setLoadedAspects((prev) => ({
                      ...prev,
                      [file.id]: `${naturalWidth}/${naturalHeight}`,
                    }));
                  }
                }}
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(file);
                  }}
                  className="p-2 bg-accent rounded-lg text-white hover:bg-accent transition-colors shadow-lg"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.id);
                  }}
                  className="p-2 bg-white/10 rounded-lg text-white hover:bg-red-500/20 hover:text-red-400 transition-all"
                >
                  <Minus size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PromptsView = ({ fileManagerWidth, onAdd, onDragStart }: any) => {
  const [activeCategory, setActiveCategory] = useState<
    "image" | "video" | "skill"
  >("image");
  const [activeSubCategory, setActiveSubCategory] = useState("全部");
  const [searchQuery, setSearchQuery] = useState("");

  const [hoveredPromptId, setHoveredPromptId] = useState<string | null>(null);
  const [pinnedPromptId, setPinnedPromptId] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editNegative, setEditNegative] = useState("");
  const [editParams, setEditParams] = useState("");

  const subCategories = {
    image: ["全部", "通用", "GPT图像", "香蕉图像", "即梦", "Klein", "Z-Image"],
    video: ["全部", "分镜", "运镜", "灯光"],
    skill: ["全部", "总结", "提取", "润色"],
  };

  const [prompts, setPrompts] = useState([
    {
      id: "p1",
      title: "扩图",
      text: "扩展图像尺寸，补全画面边缘与背景。\n\n在严格保持主体、风格、材质、光影和透视一致的前提下扩展画面。补全新增区域的背景、纹理和环境细节，使扩展部分与原图自然融合，不改变主体大小和位置，确保边缘过渡平滑无接缝，无异常的截断感。",
      cat: "image",
      sub: "通用",
      tags: ["扩图", "构图", "背景延展"],
      isFavorite: false,
      params: "Midjourney: '--ar 16:9 --style raw --s 50'",
    },
    {
      id: "p2",
      title: "产品精修",
      text: "用于提升商品质感、清理瑕疵并增强商业摄影效果。\n\n对参考产品进行商业级精修。严格保持产品造型、包装设计、LOGO文字、图案元素、颜色方案、比例和材质质感与原图一致，不改变产品身份，不产生变体。清理表面灰尘、划痕和瑕疵。调整光影结构，增强明暗对比。",
      cat: "image",
      sub: "通用",
      tags: ["电商", "产品精修", "质感提升"],
      isFavorite: true,
    },
    {
      id: "p3",
      title: "局部重绘修复",
      text: "用于修复瑕疵、替换小区域或补全细节。\n\n只修改被标记的区域，未标记区域必须保持完全一致。根据周围图像内容自然补全纹理、颜色、光影、透视和材质，使修复区域与原图无缝融合。",
      cat: "image",
      sub: "通用",
      tags: ["重绘", "修复", "局部编辑"],
      isFavorite: false,
    },
    {
      id: "p4",
      title: "多机位九宫格",
      text: "A multi-camera angle reference sheet in 3x3 grid layout, showing [主体] from 9 different perspectives simultaneously: top-left front view, top-center 3/4 front view...\n\n[主体详细描述]. Consistent lighting across all 9 frames, uniform light warm gray background color F0EDE8, subjects softly blending with background with natural edge transition, no hard edges no white halo no light bleed, professional studio photography, clean grid layout with thin white dividers between frames, character consistency maintained across all angles, absolutely no visible numbers text labels frame counters corner marks or annotations anywhere on the image",
      negativeText:
        "numbers, text, letters, labels, frame numbers, corner marks, annotations, captions, watermarks, signatures, logos, readable text, font, typography, grid numbers, sequence markers, page numbers, index, hard edge, glowing edge, white halo, light bleed, overexposed edge, cutout look, pasted on background, floating subject, disconnected shadow, pure white background, stark white, cold gray, bad anatomy, distorted face, extra fingers, deformed hands, inconsistent character design, lighting mismatch between frames, blurry, low quality, cropped, out of frame",
      params:
        "Midjourney: `--ar 1:1 --style raw --s 50`\n即梦/可灵: 直接粘贴，开启【参考图】锁一致性\nFlux: 配合 `add_detail` LoRA, CFG 3.5-5.0",
      cat: "image",
      sub: "GPT图像",
      tags: ["角色", "内置模板"],
      isFavorite: true,
    },
  ]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // If clicking inside the floating panel or a prompt card, ignore.
      // Easiest is to check if it's clicking on a card or panel via ids or class
      const target = e.target as HTMLElement;
      if (
        !target.closest(".prompt-floating-panel") &&
        !target.closest(".prompt-card-item")
      ) {
        setPinnedPromptId(null);
        setIsEditing(false);
      }
    };

    // Only listen if there's a pinned prompt
    if (pinnedPromptId) {
      document.addEventListener("click", handleGlobalClick);
    }
    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [pinnedPromptId]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPrompts(
      prompts.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p,
      ),
    );
  };

  const startEditing = (prompt: any) => {
    setEditTitle(prompt.title);
    setEditText(prompt.text || "");
    setEditNegative(prompt.negativeText || "");
    setEditParams(prompt.params || "");
    setIsEditing(true);
  };

  const saveEdit = (id: string) => {
    setPrompts(
      prompts.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            title: editTitle,
            text: editText,
            negativeText: editNegative,
            params: editParams,
          };
        }
        return p;
      }),
    );
    setIsEditing(false);
  };

  const createNewPrompt = () => {
    const newPrompt = {
      id: `p${Date.now()}`,
      title: "新提示词",
      text: "",
      cat: activeCategory,
      sub: activeSubCategory === "全部" ? "通用" : activeSubCategory,
      tags: [],
      isFavorite: false,
    };
    setPrompts([newPrompt, ...prompts]);
    setPinnedPromptId(newPrompt.id);
    startEditing(newPrompt);
  };

  const sortedPrompts = [...prompts].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return 0;
  });

  const filteredPrompts = sortedPrompts.filter((p) => {
    const matchSearch =
      p.title.includes(searchQuery) ||
      p.tags.some((t) => t.includes(searchQuery));
    const matchCat = p.cat === activeCategory;
    const matchSub =
      activeSubCategory === "全部" || p.sub === activeSubCategory;
    return matchSearch && matchCat && matchSub;
  });

  const displayPromptId = pinnedPromptId || hoveredPromptId;
  const displayPrompt = displayPromptId
    ? prompts.find((p) => p.id === displayPromptId)
    : null;

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]/50 overflow-hidden relative">
      <div className="p-6 pb-0 space-y-4">
        {/* main categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {(["image", "video", "skill"] as const).map((cat) => {
            const label =
              cat === "image" ? "图像" : cat === "video" ? "视频" : "技能";
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setActiveSubCategory("全部");
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
                  activeCategory === cat
                    ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "bg-white/5 border-[var(--border)] text-gray-400 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative border-b border-[var(--border)] pb-4">
          <Search
            size={14}
            className="absolute left-3 top-[10px] text-gray-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标题、标签"
            className="w-full bg-black/20 border border-[var(--border)] rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-accent/50"
          />
        </div>

        {/* subcategories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-2 no-scrollbar">
          {subCategories[activeCategory].map((sub) => (
            <button
              key={sub}
              onClick={() => setActiveSubCategory(sub)}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeSubCategory === sub
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar pt-2">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrompts.map((prompt, index) => (
            <div
              key={prompt.id}
              draggable
              onDragStart={(e) => onDragStart(e, prompt.text, prompt.title)}
              onClick={(e) => {
                e.stopPropagation(); // prevent global click unpin
                if (pinnedPromptId === prompt.id) {
                  setPinnedPromptId(null);
                  setIsEditing(false);
                } else {
                  setPinnedPromptId(prompt.id);
                  setIsEditing(false);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setPinnedPromptId(prompt.id);
                startEditing(prompt);
              }}
              onMouseEnter={() => {
                if (!pinnedPromptId) {
                  setHoveredPromptId(prompt.id);
                }
              }}
              onMouseLeave={() => {
                setHoveredPromptId(null);
              }}
              className={`prompt-card-item group relative p-4 bg-black/20 rounded-2xl overflow-hidden border transition-all shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_24px_rgba(37,99,235,0.15)] cursor-pointer flex flex-col h-[180px] ${pinnedPromptId === prompt.id ? "border-blue-500/80 ring-2 ring-blue-500/20" : "border-[var(--border)] hover:border-blue-500/30"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-white/5 border border-white/10 rounded text-[10px] text-gray-400 font-mono">
                    {index + 1}
                  </span>
                  <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-gray-300">
                    {prompt.cat === "image"
                      ? "图像"
                      : prompt.cat === "video"
                        ? "视频"
                        : "技能"}
                  </span>
                  <span className="font-bold text-sm text-gray-200 group-hover:text-blue-400 transition-colors truncate max-w-[65px]">
                    {prompt.title}
                  </span>
                </div>
                <button
                  onClick={(e) => toggleFavorite(prompt.id, e)}
                  className={`p-1 bg-transparent rounded-lg transition-colors absolute top-3 right-3 ${prompt.isFavorite ? "text-yellow-500" : "text-gray-500 hover:text-white"}`}
                >
                  <Star
                    size={16}
                    fill={prompt.isFavorite ? "currentColor" : "none"}
                  />
                </button>
              </div>

              <div className="text-[13px] text-gray-400 font-mono mt-1 mb-2 line-clamp-4 leading-relaxed flex-1 whitespace-pre-wrap">
                {prompt.text}
              </div>

              <div className="flex items-center gap-1.5 mt-auto overflow-x-hidden pt-2">
                {prompt.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-black/40 border border-white/5 rounded-full text-[10px] text-gray-500 whitespace-nowrap"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Create Button */}
      <div className="absolute bottom-6 right-6 z-[50]">
        <button
          onClick={createNewPrompt}
          className="w-12 h-12 bg-blue-500 hover:bg-blue-400 text-white rounded-full flex items-center justify-center shadow-xl shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
          title="新建提示词"
        >
          <Plus size={24} />
        </button>
      </div>

      {displayPrompt &&
        createPortal(
          <div
            className="prompt-floating-panel fixed top-1/2 -translate-y-1/2 w-[420px] max-h-[85vh] flex flex-col bg-[#1a1a1a]/95 backdrop-blur-xl rounded-2xl border shadow-2xl z-[1000] overflow-hidden transition-all duration-200"
            style={{
              left: `${Math.min(window.innerWidth - 440, fileManagerWidth + 92)}px`,
              borderColor: pinnedPromptId
                ? "rgba(59, 130, 246, 0.4)"
                : "var(--border)",
              boxShadow: pinnedPromptId
                ? "0 25px 50px -12px rgba(59, 130, 246, 0.25)"
                : "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            {/* Header */}
            <div className="p-5 border-b border-[var(--border)] flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between">
                {isEditing ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="bg-black/30 border border-blue-500/50 rounded-lg px-3 py-1 flex-1 mr-4 text-white font-bold outline-none"
                    autoFocus
                  />
                ) : (
                  <h3 className="text-xl font-bold text-white">
                    {displayPrompt.title}
                  </h3>
                )}

                <div className="flex items-center gap-2">
                  {pinnedPromptId === displayPrompt.id && !isEditing && (
                    <>
                      <button
                        onClick={() => startEditing(displayPrompt)}
                        className="p-1.5 bg-white/5 border border-[var(--border)] hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setPrompts(
                            prompts.filter((p) => p.id !== displayPrompt.id),
                          );
                          setPinnedPromptId(null);
                        }}
                        className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                  {pinnedPromptId === displayPrompt.id && isEditing && (
                    <button
                      onClick={() => saveEdit(displayPrompt.id)}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      保存
                    </button>
                  )}
                </div>
              </div>
              {!isEditing &&
                displayPrompt.tags &&
                displayPrompt.tags.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{displayPrompt.tags.join(" · ")}</span>
                  </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-600 flex items-center gap-2 uppercase tracking-widest">
                  <FileText size={16} /> 正向提示词
                </h4>
                {isEditing ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full h-32 bg-black/30 border border-blue-500/50 rounded-xl p-3 text-[14px] text-gray-300 font-mono resize-none outline-none leading-relaxed"
                  />
                ) : (
                  <p className="text-[15px] font-mono text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {displayPrompt.text}
                  </p>
                )}
              </div>

              {(displayPrompt.negativeText || isEditing) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-600 flex items-center gap-2 uppercase tracking-widest">
                    <Minus size={16} /> 负向提示词
                  </h4>
                  {isEditing ? (
                    <textarea
                      value={editNegative}
                      onChange={(e) => setEditNegative(e.target.value)}
                      className="w-full h-24 bg-black/30 border border-[var(--border)] focus:border-blue-500/50 rounded-xl p-3 text-[14px] text-gray-400 font-mono resize-none outline-none leading-relaxed"
                      placeholder="可选..."
                    />
                  ) : (
                    <p className="text-[15px] font-mono text-gray-400 leading-relaxed whitespace-pre-wrap">
                      {displayPrompt.negativeText}
                    </p>
                  )}
                </div>
              )}

              {(displayPrompt.params || isEditing) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-600 flex items-center gap-2 uppercase tracking-widest">
                    <Search size={16} /> 参数建议
                  </h4>
                  {isEditing ? (
                    <textarea
                      value={editParams}
                      onChange={(e) => setEditParams(e.target.value)}
                      className="w-full h-20 bg-blue-900/10 border border-blue-500/30 focus:border-blue-500/50 rounded-xl p-3 text-[13px] text-blue-300/80 font-mono resize-none outline-none leading-relaxed"
                      placeholder="可选..."
                    />
                  ) : (
                    <div className="text-[13px] text-blue-300/80 leading-relaxed whitespace-pre-wrap font-mono bg-blue-900/10 p-4 rounded-xl border border-blue-500/20">
                      {displayPrompt.params}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!isEditing && (
              <div className="p-5 border-t border-[var(--border)] bg-black/20 flex gap-3 shrink-0">
                <button
                  onClick={() => {
                    onAdd(displayPrompt.text, displayPrompt.title);
                    setPinnedPromptId(null);
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-white text-center flex items-center justify-center gap-2 transition-colors active:scale-95 border border-[var(--border)] pointer-events-auto"
                >
                  <ArrowLeft size={16} className="-rotate-90" />
                  正向
                </button>
                <button
                  onClick={() => {
                    onAdd(
                      `${displayPrompt.text}${displayPrompt.negativeText ? `\n\n--no ${displayPrompt.negativeText}` : ""}`,
                      displayPrompt.title,
                    );
                    setPinnedPromptId(null);
                  }}
                  className="flex-1 py-3 bg-blue-500 hover:bg-blue-400 rounded-xl text-sm font-bold text-white text-center flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-colors active:scale-95 pointer-events-auto"
                >
                  <ImageIcon size={16} />
                  完整应用
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
