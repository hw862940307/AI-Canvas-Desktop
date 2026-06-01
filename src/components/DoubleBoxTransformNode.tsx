import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import {
  Maximize2,
  Minimize2,
  Trash2,
  Copy,
  Check,
  Move,
  Box,
  Crosshair,
  Info,
  Type,
  FileJson,
  Upload,
  RefreshCw,
  Download,
  Settings,
  Eraser,
  SlidersHorizontal,
  Plus,
  Image as ImageIcon,
  Pencil,
} from "lucide-react";
import { useStore, useNodeIncomingData } from "../store/useStore";
import { motion, AnimatePresence } from "motion/react";
import { toPng } from "html-to-image";
import { AnnotationModal } from "./AnnotationModal";

interface BoxState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function DoubleBoxTransformNode({ id, data, selected }: NodeProps) {
  const nodeData = data as any;
  const { updateNodeData, getIncomingData, removeNode, settings } = useStore();
  const incomingData = useNodeIncomingData(id);

  const getFontSizeStyle = () => {
    return typeof settings.inputFontSize === "number"
      ? { fontSize: `${settings.inputFontSize}px` }
      : {};
  };
  const getFontSizeClass = () => {
    if (typeof settings.inputFontSize === "number") return "";
    if (settings.inputFontSize === "small") return "text-base";
    if (settings.inputFontSize === "large") return "text-lg";
    return "text-lg";
  };

  // Base dimensions
  const initialWidth = nodeData.width || 800;
  const initialHeight = nodeData.height || 600;
  const fontScale = (settings?.nodeUiFontSize ?? 14) / 14;
  const zoomScale = Math.max(0.4, initialWidth / 1000) * fontScale;

  // States
  const [imageUrl, setImageUrl] = useState<string | null>(nodeData.url || null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationNotes, setAnnotationNotes] = useState<string>(
    nodeData.annotationNotes || "",
  );

  // Styling States
  const [boxMode, setBoxMode] = useState<"outline" | "fill">(
    nodeData.boxMode || "outline",
  );
  const [boxOpacity, setBoxOpacity] = useState<number>(
    nodeData.boxOpacity || 40,
  );

  const [activeStylingTarget, setActiveStylingTarget] = useState<
    "blue" | "red"
  >("blue");

  const [blueLineWidth, setBlueLineWidth] = useState<number>(
    nodeData.blueLineWidth || nodeData.lineWidth || 2,
  );
  const [blueLineType, setBlueLineType] = useState<"solid" | "dashed">(
    nodeData.blueLineType || nodeData.lineType || "dashed",
  );
  const [blueDashGap, setBlueDashGap] = useState<number>(
    nodeData.blueDashGap || nodeData.dashGap || 5,
  );
  const [blueDashLength, setBlueDashLength] = useState<number>(
    nodeData.blueDashLength || nodeData.dashLength || 5,
  );

  const [redLineWidth, setRedLineWidth] = useState<number>(
    nodeData.redLineWidth || nodeData.lineWidth || 2,
  );
  const [redLineType, setRedLineType] = useState<"solid" | "dashed">(
    nodeData.redLineType || nodeData.lineType || "dashed",
  );
  const [redDashGap, setRedDashGap] = useState<number>(
    nodeData.redDashGap || nodeData.dashGap || 5,
  );
  const [redDashLength, setRedDashLength] = useState<number>(
    nodeData.redDashLength || nodeData.dashLength || 5,
  );

  const [arrowColor, setArrowColor] = useState<string>(
    nodeData.arrowColor || "#fbbf24",
  );
  const [arrowWidth, setArrowWidth] = useState<number>(
    nodeData.arrowWidth || 1.5,
  );
  const [arrowOpacity, setArrowOpacity] = useState<number>(
    nodeData.arrowOpacity || 100,
  );
  const [arrowLineType, setArrowLineType] = useState<"solid" | "dashed">(
    nodeData.arrowLineType || "solid",
  );
  const [arrowDashGap, setArrowDashGap] = useState<number>(
    nodeData.arrowDashGap || 5,
  );
  const [arrowDashLength, setArrowDashLength] = useState<number>(
    nodeData.arrowDashLength || 5,
  );
  const [arrowDisplayMode, setArrowDisplayMode] = useState<"LINE" | "OUTLINE">(
    nodeData.arrowDisplayMode || "LINE",
  );
  const [showSettings, setShowSettings] = useState(false);

  // Interaction Logic
  const [isEditing, setIsEditing] = useState(false);
  const [drawMode, setDrawMode] = useState<"blue" | "red" | null>(null);
  const [boxesVisible, setBoxesVisible] = useState<boolean>(
    nodeData.blueBox ? true : false,
  );
  const [blueBox, setBlueBox] = useState<BoxState>(
    nodeData.blueBox || { x: 0, y: 0, width: 0, height: 0 },
  );
  const [redBox, setRedBox] = useState<BoxState>(
    nodeData.redBox || { x: 0, y: 0, width: 0, height: 0 },
  );

  const [activeBox, setActiveBox] = useState<"blue" | "red" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialBox, setInitialBox] = useState<BoxState | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const containerRectRef = useRef<DOMRect | null>(null);

  const [imgRatio, setImgRatio] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenInnerContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const incomingImageUrl = useMemo(() => {
    const firstImg = incomingData.find((d) => d && (d.url || d.imageUrl));
    return firstImg ? (firstImg.url || firstImg.imageUrl) as string : null;
  }, [incomingData]);

  // Sync data from incoming nodes
  useEffect(() => {
    if (incomingImageUrl && incomingImageUrl !== imageUrl) {
      console.log('DoubleBoxTransformNode: Setting incomingImageUrl', incomingImageUrl.substring(0, 50));
      setImageUrl(incomingImageUrl);
      updateNodeData(id, { url: incomingImageUrl });
    }
  }, [id, incomingImageUrl, imageUrl, updateNodeData]);

  // Reliable Image Loading for Aspect Ratio
  useEffect(() => {
    if (imageUrl) {
      console.log('DoubleBoxTransformNode: Loading image ratio');
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => {
        console.log('DoubleBoxTransformNode: Image loaded', img.naturalWidth, img.naturalHeight);
        setImgRatio(img.naturalWidth / img.naturalHeight);
      };
    } else {
      setImgRatio(null);
    }
  }, [imageUrl]);

  // Prompt Generation Logic (Full Engineering Final Version)
  const getPrompt = useCallback(() => {
    if (!boxesVisible || (blueBox.width === 0 && redBox.width === 0)) {
      return "【等待操作】\n请点击“开始框选”按钮来定义主体和目标区域。";
    }

    const sizeRelation =
      redBox.width * redBox.height > blueBox.width * blueBox.height
        ? "enlarge"
        : redBox.width * redBox.height < blueBox.width * blueBox.height
          ? "shrink"
          : "same_size";

    return `# 【DoubleBox_Object_Transform_Engineering_Final】
2.0_ENGINEERING_STABLE
适用项目：产品级高保真几何变换与环境融合
核心目标：蓝框识别主体，红框定义目标；执行像素级重构，确保源位无痕修补，地位自然融合。

【标准调用口令｜双框几何编辑节点】

当前任务为“双框物体几何编辑”。
蓝色框为源主体选择框（Source Selection Box），仅用于选择需要处理的主体对象；红色框为目标变换框（Target Transform Box），用于定义主体最终位置与目标尺寸范围。

请先在蓝色框内识别主体对象，生成主体蒙版，并计算主体紧致外接框 SUBJECT_TIGHT_BBOX。真正变换对象是 SUBJECT_TIGHT_BBOX 对应的主体图层，而不是蓝框留白。

根据红框坐标执行操作：
- 如果红框与蓝框重合但尺寸不同，执行原地等比缩放。
- 如果红框位置偏移，执行等比移动。
- 综合模式：将主体等比例缩放并移动到红框对齐中心。

默认规则：
- 缩放模式：proportional_contain（等比例适配，严禁拉伸或压扁）。
- 对齐方式：subject_center_to_target_center（中心点对齐）。
- 源位置处理：remove_and_inpaint（移除原主体并修补背景）。
- 最终清理：必须移除所有蓝框、红框、箭头、控制点、UI 控制栏和参数文字。

【标注注释内容】
${annotationNotes || "无附加标注说明"}

保护策略：
主体除整体尺寸和位置变化外，必须严格保持原始结构、比例、轮廓、材质、颜色、Logo、屏幕内容、透视角度完全不变。禁止重新设计主体或重绘。

【动态元数据】
- SOURCE_BOX: [x:${Math.round(blueBox.x)}, y:${Math.round(blueBox.y)}, w:${Math.round(blueBox.width)}, h:${Math.round(blueBox.height)}]
- TARGET_BOX: [x:${Math.round(redBox.x)}, y:${Math.round(redBox.y)}, w:${Math.round(redBox.width)}, h:${Math.round(redBox.height)}]
- TRANSFORM_MODE: edit_scale_and_move

最终目标：蓝框内识别出的主体按红框精准变换，源位置背景完美修补，目标位置自然融合，所有指示性 UI 元素彻底消失，图像干净如直拍。`;
  }, [blueBox, redBox, boxesVisible]);

  const prompt = React.useMemo(() => {
    if (isDragging || isResizing || isDrawing) {
      return "【实时同步中...】\n移动完成后将自动更新口令集元数据。";
    }
    return getPrompt();
  }, [
    boxesVisible,
    blueBox.x,
    blueBox.y,
    blueBox.width,
    blueBox.height,
    redBox.x,
    redBox.y,
    redBox.width,
    redBox.height,
    isDragging,
    isResizing,
    isDrawing,
  ]);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      updateNodeData(id, { url });
    }
  };

  const startNewSelection = () => {
    setBlueBox({ x: 0, y: 0, width: 0, height: 0 });
    setRedBox({ x: 0, y: 0, width: 0, height: 0 });
    setBoxesVisible(false);
    setDrawMode("blue");
    setIsEditing(true);
  };

  const toggleEditing = () => {
    if (isEditing) {
      setIsEditing(false);
      setDrawMode(null);
    } else {
      setIsEditing(true);
      if (!boxesVisible) {
        setDrawMode("blue");
      }
    }
  };

  // Drag, Resize & Custom Draw Handlers
  const onMouseDown = (
    e: React.MouseEvent,
    type?: "blue" | "red",
    action?: "drag" | "resize",
    handle?: string,
  ) => {
    e.stopPropagation();

    const targetRef = isFullscreen
      ? fullscreenInnerContainerRef
      : innerContainerRef;
    if (targetRef.current) {
      containerRectRef.current = targetRef.current.getBoundingClientRect();
    }

    if (drawMode) {
      // Drawing logic
      const rect = containerRectRef.current;
      if (!rect) return;
      const startX = ((e.clientX - rect.left) / rect.width) * 100;
      const startY = ((e.clientY - rect.top) / rect.height) * 100;

      setIsDrawing(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      const newBox = { x: startX, y: startY, width: 0, height: 0 };
      if (drawMode === "blue") setBlueBox(newBox);
      else setRedBox(newBox);
      return;
    }

    if (type && boxesVisible && isEditing) {
      setActiveBox(type);
      setActiveStylingTarget(type);
      setDragStart({ x: e.clientX, y: e.clientY });
      setInitialBox(type === "blue" ? blueBox : redBox);

      if (action === "drag") {
        setIsDragging(true);
      } else {
        setIsResizing(true);
        setResizeHandle(handle || null);
      }
    }
  };

  const rafRef = useRef<number | null>(null);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging && !isResizing && !isDrawing) return;

      if (rafRef.current) return; // Skip if a frame is already scheduled

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null; // Reset for next frame
        const rect = containerRectRef.current;
        if (!rect) return;

        if (isDrawing) {
          const currentX = ((e.clientX - rect.left) / rect.width) * 100;
          const currentY = ((e.clientY - rect.top) / rect.height) * 100;

          const initialX = ((dragStart.x - rect.left) / rect.width) * 100;
          const initialY = ((dragStart.y - rect.top) / rect.height) * 100;

          const x = Math.min(initialX, currentX);
          const y = Math.min(initialY, currentY);
          const w = Math.abs(currentX - initialX);
          const h = Math.abs(currentY - initialY);

          if (drawMode === "blue") setBlueBox({ x, y, width: w, height: h });
          else setRedBox({ x, y, width: w, height: h });
          return;
        }

        const dx = ((e.clientX - dragStart.x) / rect.width) * 100;
        const dy = ((e.clientY - dragStart.y) / rect.height) * 100;

        if (!initialBox) return;
        let nextBox = { ...initialBox };

        if (isDragging) {
          nextBox.x = Math.max(
            0,
            Math.min(100 - initialBox.width, initialBox.x + dx),
          );
          nextBox.y = Math.max(
            0,
            Math.min(100 - initialBox.height, initialBox.y + dy),
          );
        } else if (isResizing && resizeHandle) {
          if (resizeHandle.includes("e")) {
            nextBox.width = Math.max(
              0.1,
              Math.min(100 - initialBox.x, initialBox.width + dx),
            );
          }
          if (resizeHandle.includes("s")) {
            nextBox.height = Math.max(
              0.1,
              Math.min(100 - initialBox.y, initialBox.height + dy),
            );
          }
          if (resizeHandle.includes("w")) {
            const potentialWidth = initialBox.width - dx;
            if (potentialWidth >= 0.1 && initialBox.x + dx >= 0) {
              nextBox.width = potentialWidth;
              nextBox.x = initialBox.x + dx;
            }
          }
          if (resizeHandle.includes("n")) {
            const potentialHeight = initialBox.height - dy;
            if (potentialHeight >= 0.1 && initialBox.y + dy >= 0) {
              nextBox.height = potentialHeight;
              nextBox.y = initialBox.y + dy;
            }
          }
        }

        if (activeBox === "blue") setBlueBox(nextBox);
        else if (activeBox === "red") setRedBox(nextBox);
      });
    },
    [
      isDragging,
      isResizing,
      isDrawing,
      dragStart,
      initialBox,
      activeBox,
      resizeHandle,
      drawMode,
      isFullscreen,
    ],
  );

  const onMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      if (drawMode === "blue") {
        setDrawMode("red");
      } else if (drawMode === "red") {
        setDrawMode(null);
        setIsEditing(false);
        setBoxesVisible(true);
        updateNodeData(id, { blueBox, redBox });
      }
    }

    if (isDragging || isResizing) {
      updateNodeData(id, {
        blueBox,
        redBox,
        boxMode,
        blueLineWidth,
        blueLineType,
        blueDashGap,
        blueDashLength,
        redLineWidth,
        redLineType,
        redDashGap,
        redDashLength,
        boxOpacity,
        arrowColor,
        arrowWidth,
        arrowOpacity,
        arrowLineType,
        arrowDashGap,
        arrowDashLength,
        arrowDisplayMode,
      });
    }
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, [
    isDrawing,
    isDragging,
    isResizing,
    id,
    blueBox,
    redBox,
    updateNodeData,
    drawMode,
    boxMode,
    blueLineWidth,
    blueLineType,
    blueDashGap,
    blueDashLength,
    redLineWidth,
    redLineType,
    redDashGap,
    redDashLength,
    boxOpacity,
    arrowColor,
    arrowWidth,
    arrowOpacity,
    arrowLineType,
    arrowDashGap,
    arrowDashLength,
    arrowDisplayMode,
  ]);

  useEffect(() => {
    updateNodeData(id, {
      boxMode,
      blueLineWidth,
      blueLineType,
      blueDashGap,
      blueDashLength,
      redLineWidth,
      redLineType,
      redDashGap,
      redDashLength,
      boxOpacity,
      arrowColor,
      arrowWidth,
      arrowOpacity,
      arrowLineType,
      arrowDashGap,
      arrowDashLength,
      arrowDisplayMode,
    });
  }, [
    id,
    boxMode,
    blueLineWidth,
    blueLineType,
    blueDashGap,
    blueDashLength,
    redLineWidth,
    redLineType,
    redDashGap,
    redDashLength,
    boxOpacity,
    arrowColor,
    arrowWidth,
    arrowOpacity,
    arrowLineType,
    arrowDashGap,
    arrowDashLength,
    arrowDisplayMode,
    updateNodeData,
  ]);

  const handleDownload = async () => {
    const targetRef = isFullscreen
      ? fullscreenInnerContainerRef
      : innerContainerRef;
    if (!targetRef.current) return;
    try {
      const dataUrl = await toPng(targetRef.current, {
        backgroundColor: "#000",
        style: {
          borderRadius: "0",
        },
        filter: (node) => {
          const element = node as HTMLElement;
          return !element.classList?.contains("snapshot-hide");
        },
      });
      const link = document.createElement("a");
      link.download = `transform-master-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download image:", err);
    }
  };

  const clearSelection = () => {
    setBlueBox({ x: 0, y: 0, width: 0, height: 0 });
    setRedBox({ x: 0, y: 0, width: 0, height: 0 });
    setBoxesVisible(false);
    setDrawMode(null);
    setIsEditing(false);
    updateNodeData(id, { blueBox: null, redBox: null });
  };

  useEffect(() => {
    if (isDragging || isResizing || isDrawing) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, isResizing, isDrawing, onMouseMove, onMouseUp]);

  const renderBox = (type: "blue" | "red", box: BoxState) => {
    if (!boxesVisible && !isDrawing) return null;
    // During drawing, only show the box currently being drawn
    if (isDrawing && drawMode !== type) return null;
    // Don't show inactive boxes if they haven't been "finalized" yet
    if (!boxesVisible && drawMode === "red" && type === "blue") {
      // Actually, maybe we WANT to see the blue box while drawing the red box?
      // Usually yes, for reference.
    }
    const isBlue = type === "blue";
    const color = isBlue
      ? `rgba(59, 130, 246, ${boxMode === "fill" ? boxOpacity / 100 : 0.1})`
      : `rgba(239, 68, 68, ${boxMode === "fill" ? boxOpacity / 100 : 0.1})`;
    const currentLineWidth = isBlue ? blueLineWidth : redLineWidth;
    const currentLineType = isBlue ? blueLineType : redLineType;
    const currentDashLength = isBlue ? blueDashLength : redDashLength;
    const currentDashGap = isBlue ? blueDashGap : redDashGap;

    const borderColor = isBlue
      ? `rgba(59, 130, 246, ${boxOpacity / 100})`
      : `rgba(239, 68, 68, ${boxOpacity / 100})`;
    const label = isBlue ? "源物体蓝框" : "目标画布红框";

    const dashArray =
      currentLineType === "dashed"
        ? `${currentDashLength} ${currentDashGap}`
        : "none";

    return (
      <div
        className={`absolute shadow-lg flex items-center justify-center cursor-move group snapshot-hide ${activeStylingTarget === type ? "ring-4 ring-white/20" : ""}`}
        style={{
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
          backgroundColor: color,
          borderStyle: currentLineType === "dashed" ? "none" : "solid",
          borderWidth: currentLineType === "dashed" ? 0 : currentLineWidth,
          borderColor: borderColor,
          zIndex: isBlue ? 20 : 10,
        }}
        onMouseDown={(e) => onMouseDown(e, type, "drag")}
        onClick={(e) => {
          e.stopPropagation();
          setActiveStylingTarget(type);
        }}
      >
        {/* SVG Border for advanced dashed lines */}
        {currentLineType === "dashed" && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="none"
              stroke={borderColor}
              strokeWidth={currentLineWidth * 2}
              strokeDasharray={dashArray}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        <div
          className={`snapshot-hide flex flex-col items-center z-20 cursor-pointer pointer-events-auto hover:brightness-125 active:scale-95 transition-all`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setActiveStylingTarget(type);
            setShowSettings(true);
          }}
        >
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-white font-black uppercase tracking-widest shadow-2xl transition-all border ${activeStylingTarget === type ? "bg-indigo-600 border-white scale-110" : "bg-black/60 border-white/20 hover:border-white/40"}`}
            style={{ fontSize: 9 * zoomScale }}
          >
            {isBlue ? (
              <Box size={10 * zoomScale} />
            ) : (
              <Crosshair size={10 * zoomScale} />
            )}
            {label}
          </div>
          <p
            className={`text-sm font-mono mt-1 transition-opacity ${activeStylingTarget === type ? "text-white font-bold" : "text-white/60"}`}
            style={{ fontSize: 8 * zoomScale }}
          >
            {type === "blue" ? "SOURCE_OBJECT" : "TARGET_ANCHOR"}
          </p>
        </div>

        {/* Resize Handles */}
        {isEditing &&
          ["nw", "ne", "sw", "se", "n", "s", "e", "w"].map((h) => (
            <div
              key={h}
              className={`snapshot-hide absolute w-3 h-3 bg-white border border-${isBlue ? "blue" : "red"}-600 rounded-sm opacity-100 shadow-md ring-2 ring-black/20 z-[100] cursor-${h}-resize`}
              style={{
                top: h.includes("n")
                  ? -6
                  : h.includes("s")
                    ? "calc(100% - 6px)"
                    : "calc(50% - 6px)",
                left: h.includes("w")
                  ? -6
                  : h.includes("e")
                    ? "calc(100% - 6px)"
                    : "calc(50% - 6px)",
              }}
              onMouseDown={(e) => onMouseDown(e, type, "resize", h)}
            />
          ))}
      </div>
    );
  };

  const renderScalingArrow = () => {
    if (!boxesVisible || blueBox.width === 0 || redBox.width === 0) return null;

    // Define 4 corners for both boxes
    const blueCorners = [
      { x: blueBox.x, y: blueBox.y }, // nw
      { x: blueBox.x + blueBox.width, y: blueBox.y }, // ne
      { x: blueBox.x, y: blueBox.y + blueBox.height }, // sw
      { x: blueBox.x + blueBox.width, y: blueBox.y + blueBox.height }, // se
    ];

    const redCorners = [
      { x: redBox.x, y: redBox.y }, // nw
      { x: redBox.x + redBox.width, y: redBox.y }, // ne
      { x: redBox.x, y: redBox.y + redBox.height }, // sw
      { x: redBox.x + redBox.width, y: redBox.y + redBox.height }, // se
    ];

    // Find the pair of corners with the largest distance to make the arrow most prominent
    let maxDist = -1;
    let bestPair = { start: blueCorners[3], end: redCorners[3] }; // Default to SE corners

    blueCorners.forEach((bc, i) => {
      const rc = redCorners[i];
      const dist = Math.sqrt(
        Math.pow(rc.x - bc.x, 2) + Math.pow(rc.y - bc.y, 2),
      );
      if (dist > maxDist) {
        maxDist = dist;
        bestPair = { start: bc, end: rc };
      }
    });

    const { start, end } = bestPair;
    if (maxDist < 1) return null;

    // Calculate angle for text rotation or offset
    const isEnlarging = redBox.width > blueBox.width;
    const arrowDashArray =
      arrowLineType === "dashed"
        ? `${arrowDashLength} ${arrowDashGap}`
        : "none";

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-[15] overflow-visible snapshot-hide">
        <defs>
          <filter
            id={`glow-${id}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <marker
            id={`arrowhead-custom-${id}`}
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <path
              d="M 0 0 L 8 3 L 0 6 Z"
              fill={arrowColor}
              fillOpacity={arrowOpacity / 100}
            />
          </marker>
        </defs>

        {/* Glow path for visibility on any background */}
        {arrowDisplayMode === "LINE" ? (
          <>
            <line
              x1={`${start.x}%`}
              y1={`${start.y}%`}
              x2={`${end.x}%`}
              y2={`${end.y}%`}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth={arrowWidth + 2}
              strokeLinecap="round"
              strokeDasharray={arrowDashArray}
            />

            <motion.line
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: arrowOpacity / 100 }}
              x1={`${start.x}%`}
              y1={`${start.y}%`}
              x2={`${end.x}%`}
              y2={`${end.y}%`}
              stroke={arrowColor}
              strokeWidth={arrowWidth}
              markerEnd={`url(#arrowhead-custom-${id})`}
              strokeDasharray={arrowDashArray}
              className="drop-shadow-lg"
              style={{ filter: `url(#glow-${id})` }}
            />
          </>
        ) : (
          <motion.rect
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: arrowOpacity / 100, scale: 1 }}
            x={`${Math.min(start.x, end.x)}%`}
            y={`${Math.min(start.y, end.y)}%`}
            width={`${Math.abs(end.x - start.x)}%`}
            height={`${Math.abs(end.y - start.y)}%`}
            fill="none"
            stroke={arrowColor}
            strokeWidth={arrowWidth}
            strokeDasharray={arrowDashArray}
            className="drop-shadow-xl"
            style={{ filter: `url(#glow-${id})` }}
          />
        )}

        {/* Removed text labels for scaling direction */}
      </svg>
    );
  };

  return (
    <>
      <NodeResizer
        minWidth={400}
        minHeight={294}
        isVisible={selected}
        lineClassName="border-accent/50"
        handleClassName="h-3 w-3 bg-white border-2 border-accent rounded-sm"
        keepAspectRatio={true}
      />

      <div
        className={`flex flex-col w-full h-full bg-[var(--bg-secondary)] rounded-[32px] border-2 transition-all ${selected ? "border-accent ring-8 ring-accent/10" : "border-[var(--border)]"}`}
        style={{ ["--node-zoom" as any]: zoomScale }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-green-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none"
         />
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-green-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[var(--border)] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none"
         />

        {/* Header */}
        <div
          className="border-b border-[var(--border)] flex items-center justify-between bg-black/40 shrink-0 react-flow__node-draghandle rounded-t-2xl"
          style={{ padding: 20 * zoomScale }}
        >
          <div className="flex items-center" style={{ gap: 16 * zoomScale }}>
            <div
              className="bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ width: 48 * zoomScale, height: 48 * zoomScale }}
            >
              <Box size={24 * zoomScale} className="text-white" />
            </div>
            <div>
              <h3
                className="font-black text-white tracking-widest uppercase italic"
                style={{ fontSize: 14 * zoomScale }}
              >
                Transform_Master
              </h3>
              <div
                className="flex items-center font-mono text-gray-600 tracking-widest"
                style={{
                  gap: 8 * zoomScale,
                  fontSize: 10 * zoomScale,
                  marginTop: 2 * zoomScale,
                }}
              >
                <span>DB_OBJ_V1.0</span>
                <div className="w-1 h-1 rounded-full bg-indigo-500" />
                <span className="text-indigo-500/60 uppercase">
                  DoubleBox Prompt Engine
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center" style={{ gap: 12 * zoomScale }}>
            <button
              onClick={() => setIsAnnotating(true)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all flex items-center gap-2"
              title="标注模式"
            >
              <Pencil size={20 * zoomScale} />
              <span className="text-sm font-bold uppercase hidden md:inline">
                Annotate
              </span>
            </button>
            <button
              onClick={handleDownload}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white transition-all flex items-center gap-2 shadow-lg"
              title="Download Image"
            >
              <Download size={20 * zoomScale} />
              <span className="text-sm font-bold uppercase hidden md:inline">
                Download
              </span>
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all flex items-center gap-2"
              title="Fullscreen"
            >
              <Maximize2 size={20 * zoomScale} />
            </button>
            <button
              onClick={() => removeNode(id)}
              className="p-3 bg-red-500/10 hover:bg-red-500 rounded-2xl text-red-500 hover:text-white transition-all flex items-center gap-2"
              title="Delete Node"
            >
              <Trash2 size={20 * zoomScale} />
            </button>
          </div>
        </div>

        <div
          className="flex-1 flex flex-col p-6 overflow-hidden nodrag"
          style={{ gap: 20 * zoomScale }}
        >
          {/* Main Workspace */}
          <div
            ref={containerRef}
            className={`flex-1 relative bg-black rounded-[24px] overflow-hidden border border-[var(--border)] shadow-inner flex items-center justify-center ${drawMode ? "cursor-crosshair" : ""}`}
            onMouseDown={(e) => drawMode && onMouseDown(e)}
          >
            <div
              ref={innerContainerRef}
              className="relative mx-auto w-auto h-auto max-w-full max-h-full overflow-hidden shadow-2xl"
              style={{ aspectRatio: imgRatio || "auto" }}
            >
              {imageUrl ? (
                <img
                  draggable={false}
                  src={imageUrl}
                  alt=""
                  className="max-w-full max-h-full object-contain opacity-80 pointer-events-none select-none block"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-800 gap-4 opacity-40">
                  <ImageIcon size={48 * zoomScale} strokeWidth={1} />
                  <span className="text-sm font-black uppercase tracking-[0.4em]">
                    Awaiting Image Input
                  </span>
                </div>
              )}

              {/* Interactive Boxes */}
              {renderBox("red", redBox)}
              {renderBox("blue", blueBox)}
              {renderScalingArrow()}
            </div>

            {/* Drawing Feedback Overlay */}
            {drawMode && (
              <div className="absolute inset-0 bg-accent/5 pointer-events-none flex items-center justify-center">
                <div className="px-4 py-2 bg-black/80 rounded-full border border-[var(--border)] flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${drawMode === "blue" ? "bg-accent" : "bg-red-500"}`}
                  />
                  <span className="text-sm font-black text-white uppercase tracking-widest whitespace-nowrap">
                    {drawMode === "blue"
                      ? "Step 1: Draw Object Box"
                      : "Step 2: Draw Target Canvas"}
                  </span>
                </div>
              </div>
            )}

            {/* Grid Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-5">
              <div
                className="w-full h-full"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, white 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
            </div>

            {/* Styling Overlay Controls */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-6 left-6 z-[100] bg-black/90 backdrop-blur-xl border-2 border-indigo-500/30 rounded-3xl p-6 shadow-2xl w-[280px] max-h-[calc(100%-48px)] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <SlidersHorizontal
                        size={16}
                        className="text-indigo-400"
                      />
                      <span className="text-base font-black text-white uppercase tracking-widest">
                        Style Settings
                      </span>
                    </div>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="text-gray-300 hover:text-white transition-all bg-white/10 px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-widest border border-[var(--border)] hover:border-white/30"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <button
                          onClick={() => setActiveStylingTarget("blue")}
                          className={`py-3 rounded-xl text-sm font-black uppercase transition-all border-2 ${activeStylingTarget === "blue" ? "bg-accent/20 border-accent text-accent shadow-[0_0_15px_rgba(59,130,246,0.3)]" : "bg-white/5 border-[var(--border)] text-gray-500 hover:border-[var(--border)]"}`}
                        >
                          Source (Blue)
                        </button>
                        <button
                          onClick={() => setActiveStylingTarget("red")}
                          className={`py-3 rounded-xl text-sm font-black uppercase transition-all border-2 ${activeStylingTarget === "red" ? "bg-red-600/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]" : "bg-white/5 border-[var(--border)] text-gray-500 hover:border-[var(--border)]"}`}
                        >
                          Target (Red)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                        填充模式{" "}
                        <span>{boxMode === "fill" ? "填充" : "线框"}</span>
                      </label>
                      <div className="flex gap-2 p-1 bg-white/5 border border-[var(--border)] rounded-xl">
                        {[
                          { id: "outline", label: "纯线框" },
                          { id: "fill", label: "内填充" },
                        ].map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => setBoxMode(mode.id as any)}
                            className={`flex-1 py-1.5 rounded-lg text-sm font-black uppercase transition-all ${boxMode === mode.id ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:text-white"}`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                        线条类型{" "}
                        <span>
                          {(activeStylingTarget === "blue"
                            ? blueLineType
                            : redLineType) === "dashed"
                            ? "虚线"
                            : "实线"}
                        </span>
                      </label>
                      <div className="flex gap-2 p-1 bg-white/5 border border-[var(--border)] rounded-xl">
                        {[
                          { id: "solid", label: "实线" },
                          { id: "dashed", label: "虚线" },
                        ].map((type) => (
                          <button
                            key={type.id}
                            onClick={() => {
                              if (activeStylingTarget === "blue")
                                setBlueLineType(type.id as any);
                              else setRedLineType(type.id as any);
                            }}
                            className={`flex-1 py-1.5 rounded-lg text-sm font-black uppercase transition-all ${(activeStylingTarget === "blue" ? blueLineType : redLineType) === type.id ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:text-white"}`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(activeStylingTarget === "blue"
                      ? blueLineType
                      : redLineType) === "dashed" && (
                      <div className="space-y-3">
                        <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                          虚线间距{" "}
                          <span>
                            {activeStylingTarget === "blue"
                              ? `${blueDashLength}/${blueDashGap}`
                              : `${redDashLength}/${redDashGap}`}
                          </span>
                        </label>
                        <div className="flex flex-col gap-2">
                          <input
                            type="range"
                            min="1"
                            max="20"
                            step="1"
                            title="虚线长度"
                            value={
                              activeStylingTarget === "blue"
                                ? blueDashLength
                                : redDashLength
                            }
                            onChange={(e) => {
                              if (activeStylingTarget === "blue")
                                setBlueDashLength(Number(e.target.value));
                              else setRedDashLength(Number(e.target.value));
                            }}
                            className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                          />
                          <input
                            type="range"
                            min="1"
                            max="20"
                            step="1"
                            title="间距大小"
                            value={
                              activeStylingTarget === "blue"
                                ? blueDashGap
                                : redDashGap
                            }
                            onChange={(e) => {
                              if (activeStylingTarget === "blue")
                                setBlueDashGap(Number(e.target.value));
                              else setRedDashGap(Number(e.target.value));
                            }}
                            className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                        线条粗细{" "}
                        <span>
                          {activeStylingTarget === "blue"
                            ? blueLineWidth
                            : redLineWidth}
                          px
                        </span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="25"
                        step="1"
                        value={
                          activeStylingTarget === "blue"
                            ? blueLineWidth
                            : redLineWidth
                        }
                        onChange={(e) => {
                          if (activeStylingTarget === "blue")
                            setBlueLineWidth(Number(e.target.value));
                          else setRedLineWidth(Number(e.target.value));
                        }}
                        className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                        透明度 <span>{boxOpacity}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={boxOpacity}
                        onChange={(e) => setBoxOpacity(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="pt-4 border-t border-[var(--border)] space-y-4">
                      <h4 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em]">
                        箭头细节调整
                      </h4>

                      <div className="space-y-3">
                        <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                          箭头颜色{" "}
                          <span style={{ color: arrowColor }}>
                            {arrowColor}
                          </span>
                        </label>
                        <div className="flex gap-2">
                          {[
                            "#fbbf24",
                            "#3b82f6",
                            "#ef4444",
                            "#10b981",
                            "#ffffff",
                          ].map((color) => (
                            <button
                              key={color}
                              onClick={() => setArrowColor(color)}
                              className={`w-5 h-5 rounded-full border-2 transition-transform ${arrowColor === color ? "border-white scale-110" : "border-transparent"}`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                          箭头粗细 <span>{arrowWidth}px</span>
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="15"
                          step="1"
                          value={arrowWidth}
                          onChange={(e) =>
                            setArrowWidth(Number(e.target.value))
                          }
                          className="w-full accent-yellow-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                          箭头透明度 <span>{arrowOpacity}%</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={arrowOpacity}
                          onChange={(e) =>
                            setArrowOpacity(Number(e.target.value))
                          }
                          className="w-full accent-yellow-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                          箭头样式{" "}
                          <span>
                            {arrowDisplayMode === "OUTLINE"
                              ? "Wireframe"
                              : "Straight Line"}
                          </span>
                        </label>
                        <div className="flex gap-2 p-1 bg-white/5 border border-[var(--border)] rounded-xl">
                          {[
                            { id: "LINE", label: "Straight" },
                            { id: "OUTLINE", label: "Wireframe" },
                          ].map((mode) => (
                            <button
                              key={mode.id}
                              onClick={() =>
                                setArrowDisplayMode(mode.id as any)
                              }
                              className={`flex-1 py-1.5 rounded-lg text-sm font-black uppercase transition-all ${arrowDisplayMode === mode.id ? "bg-yellow-600 text-white shadow-[0_0_10px_rgba(251,191,36,0.2)]" : "text-gray-500 hover:text-white"}`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                          箭头线型{" "}
                          <span>
                            {arrowLineType === "dashed" ? "虚线" : "实线"}
                          </span>
                        </label>
                        <div className="flex gap-2 p-1 bg-white/5 border border-[var(--border)] rounded-xl">
                          {[
                            { id: "solid", label: "实线" },
                            { id: "dashed", label: "虚线" },
                          ].map((type) => (
                            <button
                              key={type.id}
                              onClick={() => setArrowLineType(type.id as any)}
                              className={`flex-1 py-1.5 rounded-lg text-sm font-black uppercase transition-all ${arrowLineType === type.id ? "bg-yellow-600 text-white" : "text-gray-500 hover:text-white"}`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {arrowLineType === "dashed" && (
                        <div className="space-y-3">
                          <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                            箭头虚线间距{" "}
                            <span>
                              {arrowDashLength}/{arrowDashGap}
                            </span>
                          </label>
                          <div className="flex flex-col gap-2">
                            <input
                              type="range"
                              min="1"
                              max="20"
                              step="1"
                              title="虚线长度"
                              value={arrowDashLength}
                              onChange={(e) =>
                                setArrowDashLength(Number(e.target.value))
                              }
                              className="w-full accent-yellow-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                            />
                            <input
                              type="range"
                              min="1"
                              max="20"
                              step="1"
                              title="间距大小"
                              value={arrowDashGap}
                              onChange={(e) =>
                                setArrowDashGap(Number(e.target.value))
                              }
                              className="w-full accent-yellow-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Stylers Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`absolute top-6 left-6 p-3 rounded-2xl transition-all shadow-xl backdrop-blur-md border border-[var(--border)] z-[50] ${showSettings ? "bg-indigo-600 text-white" : "bg-black/60 text-gray-400 hover:text-white"}`}
            >
              <SlidersHorizontal size={20 * zoomScale} />
            </button>
          </div>

          {/* Results Panel */}
          <div className="shrink-0 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <Type size={16 * zoomScale} />
                </div>
                <span
                  className="text-sm font-black text-white uppercase tracking-widest"
                  style={{ fontSize: 10 * zoomScale }}
                >
                  标准化提示词输出
                </span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleEditing}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${isEditing ? "bg-emerald-500 border-emerald-400 text-white shadow-lg" : "bg-white/5 border-[var(--border)] text-gray-400 hover:text-white"}`}
                >
                  {isEditing ? (
                    <Check size={12 * zoomScale} />
                  ) : (
                    <Move size={12 * zoomScale} />
                  )}
                  <span className="text-sm font-black uppercase tracking-tighter">
                    {isEditing ? "完成退出" : "进入编辑"}
                  </span>
                </button>
                {isEditing && (
                  <>
                    <button
                      onClick={startNewSelection}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-white/5 border-[var(--border)] text-gray-400 hover:text-white transition-all"
                    >
                      <Crosshair size={12 * zoomScale} />
                      <span className="text-sm font-black uppercase tracking-tighter">
                        重新选框
                      </span>
                    </button>
                    <button
                      onClick={clearSelection}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                    >
                      <Eraser size={12 * zoomScale} />
                      <span className="text-sm font-black uppercase tracking-tighter">
                        清空选框
                      </span>
                    </button>
                  </>
                )}
                <div className="w-px h-3 bg-white/10" />
                <button
                  onClick={() => {
                    setBlueBox({ x: 10, y: 10, width: 20, height: 20 });
                    setRedBox({ x: 40, y: 40, width: 20, height: 20 });
                    setBoxesVisible(true);
                    setDrawMode(null);
                    setIsEditing(false);
                  }}
                  className="text-gray-700 hover:text-white transition-colors"
                >
                  <RefreshCw size={14 * zoomScale} />
                </button>
              </div>
            </div>

            <div
              className="bg-black/60 border border-[var(--border)] rounded-[20px] relative group overflow-hidden"
              style={{ padding: 16 * zoomScale }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-black text-gray-600 uppercase tracking-widest italic">
                  DYNAMIC_PAYLOAD_V2
                </span>
                <span className="text-[10px] font-mono text-indigo-500 opacity-40">
                  UTF-8:ENCODED
                </span>
              </div>
              <div
                className="font-sans text-emerald-400/80 leading-relaxed text-left h-[100px] overflow-y-auto scrollbar-hide select-text"
                style={{ fontSize: 10 * zoomScale, whiteSpace: "pre-wrap" }}
              >
                {prompt}
              </div>

              <button
                onClick={handleCopy}
                className="absolute top-4 right-4 p-3 bg-white/5 hover:bg-white/10 rounded-xl text-emerald-500 hover:scale-110 active:scale-95 transition-all shadow-xl backdrop-blur-md border border-[var(--border)]"
              >
                {copied ? (
                  <Check size={16 * zoomScale} />
                ) : (
                  <Copy size={16 * zoomScale} />
                )}
              </button>
            </div>

            <div
              className="flex items-center gap-3 bg-white/[0.02] border border-[var(--border)] rounded-2xl p-4"
              style={{ padding: 12 * zoomScale }}
            >
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Info size={14 * zoomScale} className="text-indigo-400" />
              </div>
              <p
                className="text-sm text-gray-500 leading-relaxed font-sans"
                style={{ fontSize: 9 * zoomScale }}
              >
                蓝色框为
                <span className="text-accent font-bold px-1">
                  源物体选择框
                </span>
                ，用于锁定主体。红色框为
                <span className="text-red-400 font-bold px-1">目标变换框</span>
                ，定义最终位置与尺寸。
              </p>
            </div>
          </div>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {isAnnotating && imageUrl && (
            <AnnotationModal
              imageUrl={imageUrl}
              onClose={() => setIsAnnotating(false)}
              onSave={(newUrl) => {
                setImageUrl(newUrl);
                updateNodeData(id, { url: newUrl });
                setIsAnnotating(false);
              }}
            />
          )}

          {isFullscreen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] bg-[var(--bg-secondary)] flex flex-col p-8"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl">
                    <Box size={32} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-[0.2em] uppercase italic">
                      DoubleBox_Precision_Workstation
                    </h2>
                    <p className="text-base text-gray-600 font-mono tracking-widest mt-1">
                      ENGINE_STATUS: FULL_IMMERSION_MODE_ACTIVE
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleDownload}
                    className="px-8 h-16 bg-white overflow-hidden rounded-3xl text-black font-black uppercase tracking-widest flex items-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-2xl"
                  >
                    <Download size={24} />
                    Save Snapshot
                  </button>
                  <button
                    onClick={() => setIsFullscreen(false)}
                    className="w-16 h-16 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-3xl transition-all border border-red-500/20"
                  >
                    <Minimize2 size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex gap-12 overflow-hidden">
                <div
                  ref={fullscreenContainerRef}
                  className={`flex-1 relative bg-black rounded-[40px] overflow-hidden border border-[var(--border)] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex items-center justify-center ${drawMode ? "cursor-crosshair" : ""}`}
                  onMouseDown={(e) => drawMode && onMouseDown(e)}
                >
                  <div
                    ref={fullscreenInnerContainerRef}
                    className="relative mx-auto w-auto h-auto max-w-full max-h-full overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]"
                    style={{ aspectRatio: imgRatio || "auto" }}
                  >
                    {imageUrl && (
                      <img
                        draggable={false}
                        src={imageUrl}
                        alt=""
                        className="max-w-full max-h-full object-contain opacity-80 block"
                      />
                    )}
                    {renderBox("red", redBox)}
                    {renderBox("blue", blueBox)}
                    {renderScalingArrow()}
                  </div>
                  {drawMode && (
                    <div className="absolute inset-0 bg-accent/5 pointer-events-none flex items-center justify-center">
                      <div className="px-8 py-4 bg-black/80 rounded-full border border-[var(--border)] flex items-center gap-4">
                        <div
                          className={`w-4 h-4 rounded-full animate-pulse ${drawMode === "blue" ? "bg-accent" : "bg-red-500"}`}
                        />
                        <span className="text-lg font-black text-white uppercase tracking-widest whitespace-nowrap">
                          {drawMode === "blue"
                            ? "第一步：框选源物体"
                            : "第二步：框选目标位置"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Styling Overlay in Fullscreen */}
                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute bottom-10 left-10 z-[100] bg-black/95 backdrop-blur-2xl border-2 border-indigo-500/30 rounded-[40px] p-10 shadow-[0_50px_100_rgba(0,0,0,1)] w-[360px] max-h-[calc(100%-80px)] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                      >
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-4">
                            <SlidersHorizontal
                              size={24}
                              className="text-indigo-400"
                            />
                            <span className="text-lg font-black text-white uppercase tracking-[0.2em]">
                              Style Settings
                            </span>
                          </div>
                          <button
                            onClick={() => setShowSettings(false)}
                            className="text-gray-300 hover:text-white transition-all bg-white/10 px-4 py-1.5 rounded-xl text-base font-bold uppercase tracking-widest border border-[var(--border)] hover:border-white/30"
                          >
                            Close
                          </button>
                        </div>

                        <div className="space-y-8">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <button
                                onClick={() => setActiveStylingTarget("blue")}
                                className={`py-5 rounded-[24px] text-base font-black uppercase transition-all border-2 shadow-2xl ${activeStylingTarget === "blue" ? "bg-accent/20 border-accent text-accent shadow-[0_0_30px_rgba(59,130,246,0.2)] scale-105" : "bg-white/5 border-[var(--border)] text-gray-500 hover:border-[var(--border)]"}`}
                              >
                                Source Box (Blue)
                              </button>
                              <button
                                onClick={() => setActiveStylingTarget("red")}
                                className={`py-5 rounded-[24px] text-base font-black uppercase transition-all border-2 shadow-2xl ${activeStylingTarget === "red" ? "bg-red-600/20 border-red-500 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)] scale-105" : "bg-white/5 border-[var(--border)] text-gray-500 hover:border-[var(--border)]"}`}
                              >
                                Target Box (Red)
                              </button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                              Box Mode{" "}
                              <span>
                                {boxMode === "fill" ? "Fill" : "Outline"}
                              </span>
                            </label>
                            <div className="flex gap-4 p-2 bg-white/5 border border-[var(--border)] rounded-2xl">
                              {(["outline", "fill"] as const).map((mode) => (
                                <button
                                  key={mode}
                                  onClick={() => setBoxMode(mode)}
                                  className={`flex-1 py-3 rounded-xl text-base font-black uppercase transition-all ${boxMode === mode ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                                >
                                  {mode}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                              Stroke Type{" "}
                              <span>
                                {(activeStylingTarget === "blue"
                                  ? blueLineType
                                  : redLineType) === "dashed"
                                  ? "Dashed"
                                  : "Solid"}
                              </span>
                            </label>
                            <div className="flex gap-4 p-2 bg-white/5 border border-[var(--border)] rounded-2xl">
                              {(["solid", "dashed"] as const).map((type) => (
                                <button
                                  key={type}
                                  onClick={() => {
                                    if (activeStylingTarget === "blue")
                                      setBlueLineType(type);
                                    else setRedLineType(type);
                                  }}
                                  className={`flex-1 py-3 rounded-xl text-base font-black uppercase transition-all ${(activeStylingTarget === "blue" ? blueLineType : redLineType) === type ? "bg-indigo-600 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          {(activeStylingTarget === "blue"
                            ? blueLineType
                            : redLineType) === "dashed" && (
                            <div className="space-y-4">
                              <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                                Dash Length/Gap{" "}
                                <span>
                                  {activeStylingTarget === "blue"
                                    ? `${blueDashLength}/${blueDashGap}`
                                    : `${redDashLength}/${redDashGap}`}
                                </span>
                              </label>
                              <div className="space-y-4">
                                <input
                                  type="range"
                                  min="1"
                                  max="50"
                                  step="1"
                                  value={
                                    activeStylingTarget === "blue"
                                      ? blueDashLength
                                      : redDashLength
                                  }
                                  onChange={(e) => {
                                    if (activeStylingTarget === "blue")
                                      setBlueDashLength(Number(e.target.value));
                                    else
                                      setRedDashLength(Number(e.target.value));
                                  }}
                                  className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                />
                                <input
                                  type="range"
                                  min="1"
                                  max="50"
                                  step="1"
                                  value={
                                    activeStylingTarget === "blue"
                                      ? blueDashGap
                                      : redDashGap
                                  }
                                  onChange={(e) => {
                                    if (activeStylingTarget === "blue")
                                      setBlueDashGap(Number(e.target.value));
                                    else setRedDashGap(Number(e.target.value));
                                  }}
                                  className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                />
                              </div>
                            </div>
                          )}

                          <div className="space-y-4">
                            <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                              Stroke Width{" "}
                              <span>
                                {activeStylingTarget === "blue"
                                  ? blueLineWidth
                                  : redLineWidth}
                                px
                              </span>
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="25"
                              step="1"
                              value={
                                activeStylingTarget === "blue"
                                  ? blueLineWidth
                                  : redLineWidth
                              }
                              onChange={(e) => {
                                if (activeStylingTarget === "blue")
                                  setBlueLineWidth(Number(e.target.value));
                                else setRedLineWidth(Number(e.target.value));
                              }}
                              className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                            />
                          </div>

                          <div className="space-y-4">
                            <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                              Opacity <span>{boxOpacity}%</span>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={boxOpacity}
                              onChange={(e) =>
                                setBoxOpacity(Number(e.target.value))
                              }
                              className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                            />
                          </div>

                          <div className="pt-6 border-t border-[var(--border)] space-y-6">
                            <label className="text-sm font-black text-indigo-400 uppercase tracking-widest">
                              Scaling Arrow Style
                            </label>

                            <div className="space-y-4">
                              <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                                Arrow Color{" "}
                                <span style={{ color: arrowColor }}>
                                  {arrowColor}
                                </span>
                              </label>
                              <div className="flex gap-4">
                                {[
                                  "#fbbf24",
                                  "#3b82f6",
                                  "#ef4444",
                                  "#10b981",
                                  "#ffffff",
                                ].map((color) => (
                                  <button
                                    key={color}
                                    onClick={() => setArrowColor(color)}
                                    className={`w-8 h-8 rounded-2xl border-2 transition-all ${arrowColor === color ? "border-white scale-110" : "border-transparent"}`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                                Width <span>{arrowWidth}px</span>
                              </label>
                              <input
                                type="range"
                                min="1"
                                max="15"
                                step="1"
                                value={arrowWidth}
                                onChange={(e) =>
                                  setArrowWidth(Number(e.target.value))
                                }
                                className="w-full accent-yellow-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                              />
                            </div>

                            <div className="space-y-4">
                              <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                                Arrow Opacity <span>{arrowOpacity}%</span>
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={arrowOpacity}
                                onChange={(e) =>
                                  setArrowOpacity(Number(e.target.value))
                                }
                                className="w-full accent-yellow-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                              />
                            </div>

                            <div className="space-y-4">
                              <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                                Arrow Render Mode{" "}
                                <span>
                                  {arrowDisplayMode === "OUTLINE"
                                    ? "Wireframe"
                                    : "Straight Line"}
                                </span>
                              </label>
                              <div className="flex gap-4 p-2 bg-white/5 border border-[var(--border)] rounded-2xl">
                                {(["LINE", "OUTLINE"] as const).map((mode) => (
                                  <button
                                    key={mode}
                                    onClick={() => setArrowDisplayMode(mode)}
                                    className={`flex-1 py-3 rounded-xl text-base font-black uppercase transition-all ${arrowDisplayMode === mode ? "bg-yellow-600 text-white shadow-[0_0_15px_rgba(251,191,36,0.3)] scale-105" : "text-gray-500 hover:text-white"}`}
                                  >
                                    {mode === "LINE" ? "Straight" : "Wireframe"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                                Arrow Stroke Type{" "}
                                <span>
                                  {arrowLineType === "dashed"
                                    ? "Dashed"
                                    : "Solid"}
                                </span>
                              </label>
                              <div className="flex gap-4 p-2 bg-white/5 border border-[var(--border)] rounded-2xl">
                                {(["solid", "dashed"] as const).map((type) => (
                                  <button
                                    key={type}
                                    onClick={() => setArrowLineType(type)}
                                    className={`flex-1 py-3 rounded-xl text-base font-black uppercase transition-all ${arrowLineType === type ? "bg-yellow-600 text-white shadow-lg" : "text-gray-500 hover:text-white"}`}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {arrowLineType === "dashed" && (
                              <div className="space-y-4">
                                <label className="text-sm font-black text-gray-500 uppercase tracking-widest flex justify-between">
                                  Arrow Dash Length/Gap{" "}
                                  <span>
                                    {arrowDashLength}/{arrowDashGap}
                                  </span>
                                </label>
                                <div className="space-y-4">
                                  <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    step="1"
                                    value={arrowDashLength}
                                    onChange={(e) =>
                                      setArrowDashLength(Number(e.target.value))
                                    }
                                    className="w-full accent-yellow-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                  />
                                  <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    step="1"
                                    value={arrowDashGap}
                                    onChange={(e) =>
                                      setArrowDashGap(Number(e.target.value))
                                    }
                                    className="w-full accent-yellow-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Quick Stylers Button */}
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`absolute top-10 left-10 w-20 h-20 rounded-[30px] transition-all shadow-2xl backdrop-blur-xl border border-[var(--border)] z-[50] flex items-center justify-center ${showSettings ? "bg-indigo-600 text-white animate-pulse" : "bg-black/60 text-gray-400 hover:text-white hover:scale-110"}`}
                  >
                    <SlidersHorizontal size={32} />
                  </button>
                </div>

                <div className="flex-1 max-w-[450px] flex flex-col gap-8 h-full overflow-y-auto pr-4 scrollbar-hide">
                  <div className="p-10 bg-white/[0.03] border border-[var(--border)] rounded-[32px] flex flex-col gap-6 shadow-2xl shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <FileJson size={20} />
                        </div>
                        <h4 className="text-lg font-black text-white uppercase tracking-widest">
                          动态分析口令集
                        </h4>
                      </div>
                      {/* Point Selection Helper */}
                      <div className="flex items-center gap-2 px-2 py-1 bg-black/40 rounded-full border border-[var(--border)]">
                        <button
                          onClick={() => {
                            setActiveStylingTarget("blue");
                            setShowSettings(true);
                          }}
                          className={`w-6 h-6 rounded-full border transition-all ${activeStylingTarget === "blue" ? "bg-accent border-white" : "bg-blue-900/30 border-accent/30 hover:border-accent"}`}
                          title="选择蓝框"
                        />
                        <button
                          onClick={() => {
                            setActiveStylingTarget("red");
                            setShowSettings(true);
                          }}
                          className={`w-6 h-6 rounded-full border transition-all ${activeStylingTarget === "red" ? "bg-red-600 border-white" : "bg-red-900/30 border-red-500/30 hover:border-red-500"}`}
                          title="选择红框"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-black text-gray-500 uppercase tracking-widest">
                          标注注释 (Node Notes)
                        </label>
                        <span className="text-sm font-mono text-indigo-400/50 italic">
                          Engineering Final
                        </span>
                      </div>
                      <textarea
                        value={annotationNotes}
                        onChange={(e) => {
                          setAnnotationNotes(e.target.value);
                          updateNodeData(id, {
                            annotationNotes: e.target.value,
                          });
                        }}
                        placeholder="输入对此节点的标注注释..."
                        className={`w-full h-24 bg-black/40 border border-[var(--border)] rounded-2xl p-4 ${getFontSizeClass()} text-white/80 focus:outline-none focus:border-indigo-500/50 resize-none transition-all placeholder:text-gray-700 font-mono`}
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={toggleEditing}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-[20px] border transition-all ${isEditing ? "bg-emerald-500 border-emerald-400 text-white shadow-lg" : "bg-white/5 border-[var(--border)] text-gray-400 hover:text-white"}`}
                      >
                        {isEditing ? <Check size={18} /> : <Move size={18} />}
                        <span className="text-base font-black uppercase tracking-widest">
                          {isEditing ? "完成退出" : "进入编辑模式"}
                        </span>
                      </button>
                      {isEditing && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={startNewSelection}
                            className="w-12 h-12 flex items-center justify-center rounded-2xl border bg-white/5 border-[var(--border)] text-gray-400 hover:text-white transition-all"
                            title="重新开始第一步"
                          >
                            <Plus size={20} />
                          </button>
                          <button
                            onClick={clearSelection}
                            className="w-12 h-12 flex items-center justify-center rounded-2xl border bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                            title="清空并关闭选框"
                          >
                            <Eraser size={20} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="bg-black/60 rounded-3xl p-8 border border-[var(--border)] h-[300px] overflow-y-auto scrollbar-hide">
                      <pre className="text-base font-mono text-emerald-400/90 whitespace-pre-wrap select-text">
                        {prompt}
                      </pre>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[24px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-xl active:scale-[0.98] transition-all"
                    >
                      {copied ? (
                        <>
                          <Check size={20} /> 已复制
                        </>
                      ) : (
                        <>
                          <Copy size={20} /> 复制口令集
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-8 bg-white/[0.01] border border-[var(--border)] rounded-[32px]">
                    <h4 className="text-sm font-black text-gray-600 uppercase tracking-[0.3em] mb-6">
                      Execution Logic
                    </h4>
                    <div className="space-y-6">
                      {[
                        {
                          label: "Rel_X",
                          val:
                            redBox.width > 0
                              ? Math.round(
                                  ((blueBox.x - redBox.x) / redBox.width) *
                                    1000,
                                )
                              : 0,
                        },
                        {
                          label: "Rel_Y",
                          val:
                            redBox.height > 0
                              ? Math.round(
                                  ((blueBox.y - redBox.y) / redBox.height) *
                                    1000,
                                )
                              : 0,
                        },
                        {
                          label: "Rel_W",
                          val:
                            redBox.width > 0
                              ? Math.round(
                                  (blueBox.width / redBox.width) * 1000,
                                )
                              : 0,
                        },
                        {
                          label: "Rel_H",
                          val:
                            redBox.height > 0
                              ? Math.round(
                                  (blueBox.height / redBox.height) * 1000,
                                )
                              : 0,
                        },
                      ].map((stat, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm font-mono text-gray-500">
                            {stat.label}
                          </span>
                          <div className="flex-1 mx-4 h-px bg-white/5" />
                          <span className="text-lg font-mono text-indigo-400 font-black">
                            {stat.val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
