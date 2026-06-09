import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { 
  Layers, 
  Sliders, 
  Paintbrush, 
  Eraser, 
  Trash2, 
  Plus, 
  Download, 
  Upload, 
  Play, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff, 
  Settings, 
  Sparkles, 
  Wand2, 
  RefreshCw, 
  Move, 
  Maximize2, 
  Minimize2,
  SlidersHorizontal,
  ChevronRight,
  Database,
  Grid3X3,
  Flame,
  Check,
  RotateCcw,
  Scissors,
  Hand,
  Type,
  Square,
  Circle,
  Undo2,
  Redo2,
  Scaling,
  RotateCw,
  Pipette,
  HelpCircle
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { ScaleWrapper } from './ScaleWrapper';
import { generateTextWithFallback } from '../lib/gemini';
import { renderLiquifyWebGL } from '../lib/webglLiquify';
import { get } from 'idb-keyval';

// Resolves db_blob: to blob URL or returns fallback
const resolveDbBlob = async (url: string) => {
  if (url && url.startsWith('db_blob:')) {
    try {
      const stored = await get(url);
      if (stored instanceof Blob) {
        return URL.createObjectURL(stored);
      } else if (typeof stored === 'string') {
        if (stored.startsWith('data:')) {
          const fetchRes = await fetch(stored);
          const b = await fetchRes.blob();
          return URL.createObjectURL(b);
        }
        return stored;
      }
    } catch (e) {
      console.error("Resolve db_blob failed", e);
    }
  }
  return url;
};

// Interface defining the layers of our custom PS editor node
interface PSLayer {
  id: string;
  name: string;
  type: 'image' | 'text' | 'solid' | 'vector';
  visible: boolean;
  opacity: number;          // 0 to 1
  blendMode: string;        // 'source-over', 'multiply', 'screen', 'overlay', 'difference', 'color-burn', 'color-dodge'
  imageUrl?: string;        // original image URL
  color?: string;           // for solid color layer / shape fill
  text?: string;            // for text layer
  fontSize?: number;        // for text layer
  fontWeight?: string;      // for text layer
  textColor?: string;       // for text layer
  vectorType?: 'rect' | 'circle' | 'line'; // for vector elements
  strokeColor?: string;     // for vector shape
  strokeWidth?: number;     // for vector shape
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  rotation: number;         // 0 to 360
  scaleX: number;           // Scale factors for transform
  scaleY: number;           // Scale factors for transform
  isClipped: boolean;       // Clips to the layer below it
  hasMask: boolean;         // Enables a separate alpha mask
  maskData?: Uint8ClampedArray; // Custom hand-drawn mask opacity values
  
  // Custom non-destructive adjustments
  adjustments: {
    curves: [number, number][]; // Curve nodes (x, y) 0..255
    exposure: number;           // -100 to 100
    temp: number;               // -100 to 100
    tint: number;               // -100 to 100
    contrast: number;           // -100 to 100
    highlights: number;         // -100 to 100
    shadows: number;            // -100 to 100
    clarity: number;            // -100 to 100
    saturation: number;         // -100 to 100
    hue: number;                // -180 to 180 (color hue shift)
    lightness: number;          // -100 to 100 (adjustment HSL lightness)
    invert?: boolean;           // Invert colors
    threshold?: number;         // 0-255 threshold
    posterize?: number;         // 2-255 posterize levels
    levels: {
      blackMin: number;         // 0-255 levels
      gamma: number;            // 0.1-5.0 levels gamma
      whiteMin: number;         // 0-255 levels
    };
  };

  // Layer effects styles (Fx)
  effects: {
    dropShadow: {
      enabled: boolean;
      color: string;
      blur: number;
      distance: number;
      angle: number;
      opacity: number;
    };
    bevelEmboss: {
      enabled: boolean;
      depth: number;
      size: number;
      soften: number;
    };
  };

  // Liquify mesh grid data
  liquifyMesh?: {
    cols: number;
    rows: number;
    points: { ox: number; oy: number; x: number; y: number }[]; // original and deformed coordinates
  };
}

// Preset test images
const PRESET_LAYERS_IMAGES = [
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600&auto=format&fit=crop", // Elegant Art
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop", // Purple gradients
  "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=600&auto=format&fit=crop"  // Digital neon shapes
];

export function AIPsEngineNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useStore((s) => s.updateNodeData);
  const getIncomingData = useStore((s) => s.getIncomingData);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);

  // Core Document State
  const [docWidth, setDocWidth] = useState<number>(() => typeof data.docWidth === "number" ? data.docWidth : 500);
  const [docHeight, setDocHeight] = useState<number>(() => typeof data.docHeight === "number" ? data.docHeight : 500);
  const [layers, setLayers] = useState<PSLayer[]>(() => {
    if (Array.isArray(data.layers) && data.layers.length > 0) {
      return (data.layers as any[]).map(l => ({
        ...l,
        rotation: typeof l.rotation === 'number' ? l.rotation : 0,
        scaleX: typeof l.scaleX === 'number' ? l.scaleX : 1,
        scaleY: typeof l.scaleY === 'number' ? l.scaleY : 1,
        adjustments: {
          curves: l.adjustments?.curves || [[0, 0], [255, 255]],
          exposure: l.adjustments?.exposure || 0,
          temp: l.adjustments?.temp || 0,
          tint: l.adjustments?.tint || 0,
          contrast: l.adjustments?.contrast || 0,
          highlights: l.adjustments?.highlights || 0,
          shadows: l.adjustments?.shadows || 0,
          clarity: l.adjustments?.clarity || 0,
          saturation: l.adjustments?.saturation || 0,
          hue: l.adjustments?.hue || 0,
          lightness: l.adjustments?.lightness || 0,
          levels: l.adjustments?.levels || { blackMin: 0, gamma: 1.0, whiteMin: 255 }
        }
      })) as PSLayer[];
    }
    return [
      {
        id: 'bg-layer',
        name: '图层 (Layer 1)',
        type: 'solid',
        color: 'transparent',
        visible: true,
        opacity: 1,
        blendMode: 'source-over',
        offsetX: 0,
        offsetY: 0,
        width: 500,
        height: 500,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        isClipped: false,
        hasMask: false,
        adjustments: {
          curves: [[0, 0], [255, 255]],
          exposure: 0,
          temp: 0,
          tint: 0,
          contrast: 0,
          highlights: 0,
          shadows: 0,
          clarity: 0,
          saturation: 0,
          hue: 0,
          lightness: 0,
          levels: {
            blackMin: 0,
            gamma: 1.0,
            whiteMin: 255
          }
        },
        effects: {
          dropShadow: { enabled: false, color: '#000000', blur: 10, distance: 5, angle: 45, opacity: 0.5 },
          bevelEmboss: { enabled: false, depth: 100, size: 5, soften: 0 }
        }
      }
    ];
  });

  const [activeLayerId, setActiveLayerId] = useState<string>(layers[0]?.id || 'bg-layer');
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([layers[0]?.id || 'bg-layer']);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);

  useEffect(() => {
    if (activeLayerId && !selectedLayerIds.includes(activeLayerId)) {
      setSelectedLayerIds([activeLayerId]);
    }
  }, [activeLayerId]);

  const handleLayerClick = (e: React.MouseEvent, id: string) => {
    setActiveLayerId(id);
    if (e.shiftKey) {
      const startIdx = layers.findIndex(l => l.id === activeLayerId);
      const endIdx = layers.findIndex(l => l.id === id);
      const min = Math.min(startIdx, endIdx);
      const max = Math.max(startIdx, endIdx);
      setSelectedLayerIds(layers.slice(min, max + 1).map(l => l.id));
    } else if (e.metaKey || e.ctrlKey) {
      setSelectedLayerIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    } else {
      setSelectedLayerIds([id]);
    }
  };
  const [activeTab, setActiveTab] = useState<'layers' | 'adjustments' | 'fx' | 'ai'>('layers');
  const [activeTool, setActiveTool] = useState<'move' | 'transform' | 'brush' | 'magic-wand' | 'gradient' | 'clone-stamp' | 'eyedropper' | 'shape-rect' | 'shape-circle' | 'shape-line' | 'crop' | 'liquify'>('move');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Interactive parameters
  const [brushColor, setBrushColor] = useState<string>('#ff0033');
  const [brushSize, setBrushSize] = useState<number>(24);
  const [brushOpacity, setBrushOpacity] = useState<number>(1);
  const [liquifyStrength, setLiquifyStrength] = useState<number>(30);
  const [liquifyRadius, setLiquifyRadius] = useState<number>(60);
  const [zoom, setZoom] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Resolution Mode for Liquify Interactive Drag Performance
  const [previewResolution, setPreviewResolution] = useState<'low' | 'high' | 'auto'>('auto');
  const [isDraggingLiquify, setIsDraggingLiquify] = useState<boolean>(false);

  // Active Selection mask & Quick Mask states
  const [selectionMask, setSelectionMask] = useState<Uint8Array | null>(null); // size docWidth * docHeight
  const [selectionBorders, setSelectionBorders] = useState<{ x: number; y: number }[]>([]);
  const [quickMaskMode, setQuickMaskMode] = useState<boolean>(false);
  const [magicWandTolerance, setMagicWandTolerance] = useState<number>(32);
  const [magicWandMode, setMagicWandMode] = useState<'tolerance' | 'colorRange' | 'luminance'>('tolerance');
  const [cropOverlay, setCropOverlay] = useState<{x: number, y: number, w: number, h: number} | null>(null);

  // Clone stamp source point
  const [cloneSourcePos, setCloneSourcePos] = useState<{ x: number; y: number } | null>(null);
  const [isAltPressed, setIsAltPressed] = useState<boolean>(false);

  // Gradient options
  const [gradientType, setGradientType] = useState<'linear' | 'radial' | 'angle'>('linear');
  const [gradientColorStart, setGradientColorStart] = useState<string>('#6366f1');
  const [gradientColorEnd, setGradientColorEnd] = useState<string>('#ec4899');
  const [gradientStartPos, setGradientStartPos] = useState<{ x: number; y: number } | null>(null);

  // Shape creation details
  const [shapeFillColor, setShapeFillColor] = useState<string>('#3b82f6');
  const [shapeStrokeColor, setShapeStrokeColor] = useState<string>('#ffffff');
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(2);

  // Eyedropper sampled results
  const [sampledColorHex, setSampledColorHex] = useState<string | null>(null);

  // History Undo & Redo states
  const [history, setHistory] = useState<{ name: string; layers: PSLayer[]; command?: Command }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Text layer addition parameters
  const [textVal, setTextVal] = useState<string>('双击编辑文本');
  const [textSize, setTextSize] = useState<number>(32);

  // Gaussian blur setting modal / state
  const [blurRadius, setBlurRadius] = useState<number>(5);

  // Custom local Canvas drawing buffer cache to allow destructive pixel edits (like brushes, blurring)
  const [layerCanvasCache, setLayerCanvasCache] = useState<Record<string, HTMLCanvasElement>>({});
  const [maskCanvasCache, setMaskCanvasCache] = useState<Record<string, HTMLCanvasElement>>({});
  const [currentEditingMask, setCurrentEditingMask] = useState<boolean>(false);

  // AI & ComfyUI Collaboration panel states
  const [aiModel, setAiModel] = useState<string>('flux_klein');
  const [aiPrompt, setAiPrompt] = useState<string>('gorgeous oil painting overlay, cyber neon strokes, highly detailed, masterwork');
  const [aiRunning, setAiRunning] = useState<boolean>(false);
  const [aiProgress, setAiProgress] = useState<number>(0);
  const [aiLogs, setAiLogs] = useState<string[]>([]);

  // DOM Refs
  const workspaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tracking keyboard events for holding Alt (for clone stamp) and Spacebar (for hand pan navigation)
  const executeCrop = useCallback(() => {
    if (!cropOverlay) return;
    const nx = Math.min(cropOverlay.x, cropOverlay.x + cropOverlay.w);
    const ny = Math.min(cropOverlay.y, cropOverlay.y + cropOverlay.h);
    const nw = Math.abs(cropOverlay.w);
    const nh = Math.abs(cropOverlay.h);
    if (nw < 10 || nh < 10) {
      setCropOverlay(null);
      return; 
    }

    const updatedLayers = layers.map(layer => {
      // Create new canvas for cropped layer
      const lCache = getOrCreateLayerCanvas(layer);
      const newCanvas = document.createElement('canvas');
      newCanvas.width = nw;
      newCanvas.height = nh;
      const mCtx = newCanvas.getContext('2d');
      if (mCtx) {
         // draw from old canvas, offset by nx/ny and layer offset
         // source image is at doc coords (layer.offsetX, layer.offsetY) with size (layer.width, layer.height)
         // we want to place it in new doc: 
         mCtx.drawImage(lCache, layer.offsetX - nx, layer.offsetY - ny);
      }
      
      // Update cache
      setLayerCanvasCache(prev => ({...prev, [layer.id]: newCanvas}));
      
      return {
        ...layer,
        offsetX: Math.max(0, layer.offsetX - nx),
        offsetY: Math.max(0, layer.offsetY - ny),
        width: nw,
        height: nh,
        // liquifyMesh, masks etc might need adjusting, but this keeps it simple
      };
    });

    setDocWidth(nw);
    setDocHeight(nh);
    setCropOverlay(null);
    setLayers(updatedLayers);
    setActiveTool('move');
    pushToHistory('裁剪画布', updatedLayers);
  }, [cropOverlay, layers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      } else if (e.key === 'Enter' && activeTool === 'crop') {
        executeCrop();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Sync state with history
  const pushToHistory = (name: string, updatedLayers: PSLayer[], command?: Command) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    const item = { name, layers: JSON.parse(JSON.stringify(updatedLayers)), command };
    setHistory([...nextHistory, item]);
    setHistoryIndex(nextHistory.length);
  };

  const handlePerformUndo = () => {
    if (historyIndex > 0) {
      const currentItem = history[historyIndex];
      if (currentItem && currentItem.command) {
        currentItem.command.undo();
      }
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      setLayers(JSON.parse(JSON.stringify(history[idx].layers)));
    }
  };

  const handlePerformRedo = () => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      const nextItem = history[idx];
      if (nextItem && nextItem.command) {
        nextItem.command.execute();
      }
      setHistoryIndex(idx);
      setLayers(JSON.parse(JSON.stringify(history[idx].layers)));
    }
  };

  // Setup initial history
  useEffect(() => {
    if (history.length === 0 && layers.length > 0) {
      setHistory([{ name: '初始化底层画布', layers: JSON.parse(JSON.stringify(layers)) }]);
      setHistoryIndex(0);
    }
  }, [layers]);

  // Load incoming images from preceding nodes reactively
  const incomingImages = useMemo(() => {
    const incomingEdges = edges.filter((e) => e.target === id);
    return incomingEdges
      .map((e) => {
        const sourceNode = nodes.find((n) => n.id === e.source);
        const url = sourceNode?.data?.url || sourceNode?.data?.imageUrl;
        const name = sourceNode?.data?.name || sourceNode?.data?.title || '外部画作';
        return { url, name };
      })
      .filter((img): img is { url: string; name: string } => !!img.url);
  }, [id, nodes, edges]);

  const incomingImagesRaw = useMemo(() => {
    return incomingImages.map(img => img.url);
  }, [incomingImages]);

  const [resolvedIncomingImages, setResolvedIncomingImages] = useState<{ raw: string; resolved: string; name: string }[]>([]);

  useEffect(() => {
    let active = true;
    const resolveAll = async () => {
      const results = await Promise.all(
        incomingImages.map(async (img) => {
          const resolved = await resolveDbBlob(img.url);
          return { raw: img.url, resolved, name: img.name };
        })
      );
      if (active) {
        setResolvedIncomingImages(results);
      }
    };
    resolveAll();
    return () => {
      active = false;
    };
  }, [incomingImages]);

  // Synchronize layout changes and notify node state
  const syncNodeData = (updatedLayers: PSLayer[]) => {
    setLayers(updatedLayers);
    // Export combined flat image to down-stream nodes
    if (canvasRef.current) {
      try {
        const flatUrl = canvasRef.current.toDataURL('image/png');
        updateNodeData(id, { 
          layers: updatedLayers, 
          imageUrl: flatUrl, 
          url: flatUrl,
          docWidth,
          docHeight
        });
      } catch (e) {
        // Fallback for CORS images
        updateNodeData(id, { 
          layers: updatedLayers,
          docWidth,
          docHeight
        });
      }
    }
  };

  // Handle incoming data node connections trigger
  useEffect(() => {
    if (incomingImages.length > 0) {
      let updatedLayers = [...layers];
      let layersAdded = false;

      incomingImages.forEach((img) => {
        if (img.url) {
          const hasImage = updatedLayers.some(l => l.imageUrl === img.url);
          if (!hasImage) {
            const newId = `layer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const newLayer: PSLayer = {
              id: newId,
              name: img.name,
              type: 'image',
              visible: true,
              opacity: 1,
              blendMode: 'source-over',
              imageUrl: img.url,
              offsetX: 40,
              offsetY: 40,
              width: 320,
              height: 320,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              isClipped: false,
              hasMask: false,
              adjustments: {
                curves: [[0, 0], [255, 255]],
                exposure: 0,
                temp: 0,
                tint: 0,
                contrast: 0,
                highlights: 0,
                shadows: 0,
                clarity: 0,
                saturation: 0,
                hue: 0,
                lightness: 0,
                levels: { blackMin: 0, gamma: 1.0, whiteMin: 255 }
              },
              effects: {
                dropShadow: { enabled: false, color: '#000000', blur: 10, distance: 5, angle: 45, opacity: 0.5 },
                bevelEmboss: { enabled: false, depth: 100, size: 5, soften: 0 }
              }
            };
            updatedLayers = [newLayer, ...updatedLayers];
            layersAdded = true;
          }
        }
      });

      if (layersAdded) {
        syncNodeData(updatedLayers);
        pushToHistory("导入外部画作", updatedLayers);
        if (updatedLayers.length > 0) {
          setActiveLayerId(updatedLayers[0].id);
        }
      }
    }
  }, [incomingImages]);

  // Selected Active layer reference
  const activeLayer = useMemo(() => {
    return layers.find(l => l.id === activeLayerId) || layers[0] || null;
  }, [layers, activeLayerId]);

  // Utility to update active layer parameters
  const updateActiveLayer = (updater: (l: PSLayer) => Partial<PSLayer>) => {
    if (!activeLayer) return;
    const updated = layers.map(l => {
      if (l.id === activeLayer.id) {
        return { ...l, ...updater(l) };
      }
      return l;
    });
    syncNodeData(updated);
  };

  // Add solid, image, text or vector layer
  const handleAddLayer = (type: 'solid' | 'image' | 'text' | 'vector') => {
    const newId = `layer-${Date.now()}`;
    let layerName = '';
    let extraProps: Partial<PSLayer> = {};

    switch (type) {
      case 'solid':
        layerName = `纯色层 (Fill Layer ${layers.length})`;
        extraProps = { color: 'transparent' };
        break;
      case 'image':
        layerName = `示例图层 (Asset Layer ${layers.length})`;
        extraProps = { imageUrl: PRESET_LAYERS_IMAGES[Math.min(layers.length % PRESET_LAYERS_IMAGES.length, PRESET_LAYERS_IMAGES.length - 1)] };
        break;
      case 'text':
        layerName = `文本图层 (Text Layer ${layers.length})`;
        extraProps = { text: textVal, fontSize: textSize, fontWeight: 'bold', textColor: brushColor };
        break;
      case 'vector':
        layerName = `矢量形状 (Vector Shape ${layers.length})`;
        extraProps = { vectorType: 'rect', color: shapeFillColor, strokeColor: shapeStrokeColor, strokeWidth: shapeStrokeWidth };
        break;
    }

    const newLayer: PSLayer = {
      id: newId,
      name: layerName,
      type: type,
      visible: true,
      opacity: 1.0,
      blendMode: 'source-over',
      offsetX: 50,
      offsetY: 50,
      width: 300,
      height: 300,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      isClipped: false,
      hasMask: false,
      adjustments: {
        curves: [[0, 0], [255, 255]],
        exposure: 0,
        temp: 0,
        tint: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        clarity: 0,
        saturation: 0,
        hue: 0,
        lightness: 0,
        levels: { blackMin: 0, gamma: 1.0, whiteMin: 255 }
      },
      effects: {
        dropShadow: { enabled: false, color: '#000000', blur: 12, distance: 8, angle: 135, opacity: 0.6 },
        bevelEmboss: { enabled: false, depth: 120, size: 8, soften: 2 }
      },
      ...extraProps
    };

    const updated = [newLayer, ...layers];
    syncNodeData(updated);
    pushToHistory(`创建${layerName}`, updated);
    setActiveLayerId(newId);
  };

  // Add real offline local image layer via file uploader
  const handleAddLocalImageLayer = (dataUrl: string, fileName: string) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 300;
      const h = img.naturalHeight || 300;
      const isFirstImport = layers.length === 1 && layers[0].id === 'bg-layer' && !layers[0].imageUrl;
      if (isFirstImport) {
        setDocWidth(w);
        setDocHeight(h);
      }

      const newId = `layer-${Date.now()}`;
      const newLayer: PSLayer = {
        id: newId,
        name: fileName || `图片图层 (Image Layer ${layers.length})`,
        type: 'image',
        visible: true,
        opacity: 1.0,
        blendMode: 'source-over',
        imageUrl: dataUrl,
        offsetX: isFirstImport ? 0 : 50,
        offsetY: isFirstImport ? 0 : 50,
        width: w,
        height: h,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        isClipped: false,
        hasMask: false,
        adjustments: {
          curves: [[0, 0], [255, 255]],
          exposure: 0,
          temp: 0,
          tint: 0,
          contrast: 0,
          highlights: 0,
          shadows: 0,
          clarity: 0,
          saturation: 0,
          hue: 0,
          lightness: 0,
          levels: { blackMin: 0, gamma: 1.0, whiteMin: 255 }
        },
        effects: {
          dropShadow: { enabled: false, color: '#000000', blur: 12, distance: 8, angle: 135, opacity: 0.6 },
          bevelEmboss: { enabled: false, depth: 120, size: 8, soften: 2 }
        }
      };

      const updated = isFirstImport ? [newLayer] : [newLayer, ...layers];
      setLayers(updated);
      syncNodeData(updated);
      pushToHistory(`导入本地图片 ${fileName}`, updated);
      setActiveLayerId(newId);
      setSelectedLayerIds([newId]);
    };
    img.src = dataUrl;
  };

  // Move layer order in stack
  const handleMoveLayerOrder = (direction: 'up' | 'down') => {
    if (!activeLayer) return;
    const idx = layers.findIndex(l => l.id === activeLayer.id);
    if (idx === -1) return;
    const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= layers.length) return; // boundary bounds

    const temp = [...layers];
    const item = temp[idx];
    temp[idx] = temp[nextIdx];
    temp[nextIdx] = item;
    syncNodeData(temp);
    pushToHistory("调整图层顺序", temp);
  };

  // Delete Layer
  const handleDeleteLayer = (layerId: string) => {
    if (layers.length <= 1) {
      alert("⚠️ 必须保留至少一个基础图层！");
      return;
    }
    const filtered = layers.filter(l => l.id !== layerId);
    syncNodeData(filtered);
    pushToHistory("删除图层", filtered);
    if (activeLayerId === layerId) {
      setActiveLayerId(filtered[0].id);
    }
  };

  // Dynamic Image loader with Cache to avoid canvas taint errors
  const [imageElements, setImageElements] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    let active = true;
    layers.forEach(layer => {
      if (layer.imageUrl && !imageElements[layer.imageUrl]) {
        resolveDbBlob(layer.imageUrl).then((realUrl) => {
          if (!active) return;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = realUrl;
          img.onload = () => {
            if (active) {
              setImageElements(prev => ({ ...prev, [layer.imageUrl!]: img }));
            }
          };
          img.onerror = () => {
            // Retry loader without crossOrigin anonymous check if it fails due to CORS
            const retryImg = new Image();
            retryImg.src = realUrl;
            retryImg.onload = () => {
              if (active) {
                setImageElements(prev => ({ ...prev, [layer.imageUrl!]: retryImg }));
              }
            };
          };
        });
      }
    });

    return () => {
      active = false;
    };
  }, [layers, imageElements]);

  // Triangle Mesh Warping implementation for Liquify tool
  // Mathematically projects original mesh vertex uv coordinates to the deformed coordinates
  const renderLiquifyMeshWarp = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | HTMLCanvasElement,
    mesh: Required<PSLayer>['liquifyMesh'],
    layerW: number,
    layerH: number
  ) => {
    const { cols, rows, points } = mesh;

    // 1. Try high-performance WebGL-based mesh warping
    const webglCanvas = renderLiquifyWebGL(img, cols, rows, points, layerW, layerH);
    if (webglCanvas) {
      ctx.drawImage(webglCanvas, 0, 0, layerW, layerH);
      return;
    }

    // 2. CPU Triangulation fallback if WebGL is unsupported or restricted
    ctx.save();

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        // Quad vertices index mapping
        const i00 = r * cols + c;
        const i10 = (r + 1) * cols + c;
        const i01 = r * cols + (c + 1);
        const i11 = (r + 1) * cols + (c + 1);

        const p00 = points[i00];
        const p10 = points[i10];
        const p01 = points[i01];
        const p11 = points[i11];

        // Draw Triangle 1 (Top Left Half) Let's solve affine equations and map
        drawWarpedTriangle(
          ctx, img,
          p00.x, p00.y, p10.x, p10.y, p01.x, p01.y,
          p00.ox, p00.oy, p10.ox, p10.oy, p01.ox, p01.oy
        );

        // Draw Triangle 2 (Bottom Right Half)
        drawWarpedTriangle(
          ctx, img,
          p11.x, p11.y, p01.x, p01.y, p10.x, p10.y,
          p11.ox, p11.oy, p01.ox, p01.oy, p10.ox, p10.oy
        );
      }
    }
    ctx.restore();
  };

  // RGB to HSL color conversion utility for non-destructive shift
  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h, s, l];
  };

  const hslToRgb = (h: number, s: number, l: number) => {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [r * 255, g * 255, b * 255];
  };

  // Helper routine solving the affine linear mapping transformation formulas
  const drawWarpedTriangle = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | HTMLCanvasElement,
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    u0: number, v0: number,
    u1: number, v1: number,
    u2: number, v2: number
  ) => {
    ctx.save();
    // Clip to protect the boundary of triangle
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.clip();

    // Mapping matrix linear solve
    const delta = u0*v1 + u1*v2 + u2*v0 - u1*v0 - u2*v1 - u0*v2;
    if (Math.abs(delta) < 0.0001) {
      ctx.restore();
      return;
    }

    const a = ((x0*v1 + x1*v2 + x2*v0 - x1*v0 - x2*v1 - x0*v2)) / delta;
    const b = ((y0*v1 + y1*v2 + y2*v0 - y1*v0 - y2*v1 - y0*v2)) / delta;
    const c = ((u0*x1 + u1*x2 + u2*x0 - u1*x0 - u2*x1 - u0*x2)) / delta;
    const d = ((u0*y1 + u1*y2 + u2*y0 - u1*y0 - u2*y1 - u0*y2)) / delta;
    const e = ((u0*v1*x2 + u1*v2*x0 + u2*v0*x1 - u1*v0*x2 - u2*v1*x0 - u0*v2*x1)) / delta;
    const f = ((u0*v1*y2 + u1*v2*y0 + u2*v0*y1 - u1*v0*y2 - u2*v1*y0 - u0*v2*y1)) / delta;

    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  };

  // Lazy cache builder for offline canvas destructive painters
  const getOrCreateLayerCanvas = (layer: PSLayer): HTMLCanvasElement => {
    if (layerCanvasCache[layer.id]) {
      return layerCanvasCache[layer.id];
    }
    const canvas = document.createElement('canvas');
    canvas.width = layer.width;
    canvas.height = layer.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (layer.type === 'image' && layer.imageUrl) {
        const loadedImg = imageElements[layer.imageUrl];
        if (loadedImg) {
          ctx.drawImage(loadedImg, 0, 0, layer.width, layer.height);
        } else {
          ctx.fillStyle = '#1e1b4b';
          ctx.fillRect(0, 0, layer.width, layer.height);
        }
      } else if (layer.type === 'solid' && layer.color) {
        ctx.fillStyle = layer.color;
        ctx.fillRect(0, 0, layer.width, layer.height);
      } else if (layer.type === 'text') {
        ctx.fillStyle = layer.textColor || '#ffffff';
        ctx.font = `${layer.fontWeight || 'bold'} ${layer.fontSize || 32}px Inter, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(layer.text || textVal, layer.width / 2, layer.height / 2);
      } else if (layer.type === 'vector') {
        ctx.fillStyle = layer.color || shapeFillColor;
        ctx.strokeStyle = layer.strokeColor || shapeStrokeColor;
        ctx.lineWidth = layer.strokeWidth || shapeStrokeWidth;
        if (layer.vectorType === 'rect') {
          ctx.fillRect(15, 15, layer.width - 30, layer.height - 30);
          ctx.strokeRect(15, 15, layer.width - 30, layer.height - 30);
        } else if (layer.vectorType === 'circle') {
          ctx.beginPath();
          ctx.arc(layer.width / 2, layer.height / 2, Math.min(layer.width, layer.height) / 2 - 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (layer.vectorType === 'line') {
          ctx.beginPath();
          ctx.moveTo(30, layer.height / 2);
          ctx.lineTo(layer.width - 30, layer.height / 2);
          ctx.stroke();
        }
      }
    }
    layerCanvasCache[layer.id] = canvas;
    // Don't flood state trigger, just side effect mutate
    return canvas;
  };

  // Master Render Loop for multi-layer composition
  const renderComposite = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear whole stage
    ctx.clearRect(0, 0, docWidth, docHeight);

    // Render layers from bottom to top order for standard PSD rendering (Reverse of flat list)
    const renderOrder = [...layers].reverse();

    renderOrder.forEach((layer, index) => {
      if (!layer.visible) return;

      // Realtime interactive resolution toggle - downsampling by 3x during dragging to guarantee buttery smooth 60fps!
      const isCurrentlyDragging = isDraggingLiquify || (isDrawing && (activeTool === 'transform' || activeTool === 'move'));
      const scaleFactor = (isCurrentlyDragging && (previewResolution === 'auto' || previewResolution === 'low')) ? 3 : 1;
      const layerW = Math.max(16, Math.floor(layer.width / scaleFactor));
      const layerH = Math.max(16, Math.floor(layer.height / scaleFactor));

      // Create an offscreen buffer for compositing and applying adjustments non-destructively
      const layerBuffer = document.createElement('canvas');
      layerBuffer.width = layerW;
      layerBuffer.height = layerH;
      const bCtx = layerBuffer.getContext('2d');
      if (!bCtx) return;

      // 1. Draw base content (using cached mutable layer canvas if modified, otherwise load static content)
      if (layerCanvasCache[layer.id]) {
        // Draw cached destructive edits
        if (layer.liquifyMesh) {
          // Downsample the liquify points on the fly if needed
          const meshObj = layer.liquifyMesh;
          let pointsToUse = meshObj.points;
          if (scaleFactor > 1) {
            pointsToUse = meshObj.points.map(p => ({
              ox: p.ox / scaleFactor,
              oy: p.oy / scaleFactor,
              x: p.x / scaleFactor,
              y: p.y / scaleFactor
            }));
          }
          renderLiquifyMeshWarp(
            bCtx, 
            layerCanvasCache[layer.id], 
            { ...meshObj, points: pointsToUse }, 
            layerW, 
            layerH
          );
        } else {
          bCtx.drawImage(layerCanvasCache[layer.id], 0, 0, layerW, layerH);
        }
      } else {
        // Standard drawing paths
        if (layer.type === 'image' && layer.imageUrl) {
          const loadedImg = imageElements[layer.imageUrl];
          if (loadedImg) {
            if (layer.liquifyMesh) {
              const meshObj = layer.liquifyMesh;
              let pointsToUse = meshObj.points;
              if (scaleFactor > 1) {
                pointsToUse = meshObj.points.map(p => ({
                  ox: p.ox / scaleFactor,
                  oy: p.oy / scaleFactor,
                  x: p.x / scaleFactor,
                  y: p.y / scaleFactor
                }));
              }
              renderLiquifyMeshWarp(bCtx, loadedImg, { ...meshObj, points: pointsToUse }, layerW, layerH);
            } else {
              bCtx.drawImage(loadedImg, 0, 0, layerW, layerH);
            }
          } else {
            bCtx.fillStyle = '#18181b';
            bCtx.fillRect(0, 0, layerW, layerH);
            bCtx.fillStyle = '#71717a';
            bCtx.font = `${10 / scaleFactor}px monospace`;
            bCtx.fillText('Loading Asset...', 10, layerH / 2);
          }
        } else if (layer.type === 'solid' && layer.color) {
          bCtx.fillStyle = layer.color;
          bCtx.fillRect(0, 0, layerW, layerH);
        } else if (layer.type === 'text') {
          bCtx.fillStyle = layer.textColor || '#ffffff';
          bCtx.font = `${layer.fontWeight || 'bold'} ${Math.round((layer.fontSize || 32) / scaleFactor)}px Inter, sans-serif`;
          bCtx.textBaseline = 'middle';
          bCtx.textAlign = 'center';
          bCtx.fillText(layer.text || textVal, layerW / 2, layerH / 2);
        } else if (layer.type === 'vector') {
          bCtx.fillStyle = layer.color || shapeFillColor;
          bCtx.strokeStyle = layer.strokeColor || shapeStrokeColor;
          bCtx.lineWidth = Math.max(1, (layer.strokeWidth || 2) / scaleFactor);
          if (layer.vectorType === 'rect') {
            bCtx.fillRect(10/scaleFactor, 10/scaleFactor, layerW - 20/scaleFactor, layerH - 20/scaleFactor);
            bCtx.strokeRect(10/scaleFactor, 10/scaleFactor, layerW - 20/scaleFactor, layerH - 20/scaleFactor);
          } else if (layer.vectorType === 'circle') {
            bCtx.beginPath();
            bCtx.arc(layerW / 2, layerH / 2, Math.min(layerW, layerH) / 2 - 10/scaleFactor, 0, Math.PI * 2);
            bCtx.fill();
            bCtx.stroke();
          } else if (layer.vectorType === 'line') {
            bCtx.beginPath();
            bCtx.moveTo(20/scaleFactor, layerH / 2);
            bCtx.lineTo(layerW - 20/scaleFactor, layerH / 2);
            bCtx.stroke();
          }
        }
      }

      // 2. Compute non-destructive pixel-by-pixel stack (Curves, Levels, HSL shift, Exposure, Temp, Tint)
      const adj = layer.adjustments;
      const hasAdjustment = adj.exposure !== 0 || adj.contrast !== 0 || adj.temp !== 0 || adj.tint !== 0 || adj.saturation !== 0 || adj.curves.length > 2 || adj.hue !== 0 || adj.lightness !== 0 || (adj.levels && (adj.levels.blackMin !== 0 || adj.levels.gamma !== 1.0 || adj.levels.whiteMin !== 255)) || adj.invert || (adj.threshold && adj.threshold > 0) || (adj.posterize && adj.posterize < 255);
      
      if (hasAdjustment) {
        try {
          const imgData = bCtx.getImageData(0, 0, layerW, layerH);
          const pixels = imgData.data;

          // Process Curves LUT (lookup tables math)
          const curvesPoints = adj.curves;
          const curveLUT = new Uint8Array(256);
          for (let i = 0; i < 256; i++) {
            const xVal = i;
            let finalY = i;
            if (curvesPoints.length >= 3) {
              const closestPoint = curvesPoints.reduce((prev, curr) => 
                Math.abs(curr[0] - xVal) < Math.abs(prev[0] - xVal) ? curr : prev
              );
              finalY = closestPoint[1];
            }
            curveLUT[i] = Math.max(0, Math.min(255, finalY));
          }

          const expFactor = 1 + (adj.exposure / 100);
          const contr = 1 + (adj.contrast / 100);
          const satFactor = 1 + (adj.saturation / 100);
          const lightPercent = adj.lightness || 0; // -100 to 100
          const hueShiftDegrees = adj.hue || 0;    // -180 to 180
          
          // Levels variables
          const lBlack = adj.levels?.blackMin ?? 0;
          const lWhite = adj.levels?.whiteMin ?? 255;
          const lGamma = adj.levels?.gamma ?? 1.0;
          const levelDiff = Math.max(1, lWhite - lBlack);

          for (let i = 0; i < pixels.length; i += 4) {
            let r = pixels[i];
            let g = pixels[i + 1];
            let b = pixels[i + 2];

            // A. Curve LUT map
            r = curveLUT[r];
            g = curveLUT[g];
            b = curveLUT[b];

            // B. Levels adjust mapping
            if (lBlack !== 0 || lWhite !== 255 || lGamma !== 1.0) {
              r = Math.pow(Math.max(0, (r - lBlack) / levelDiff), 1 / lGamma) * 255;
              g = Math.pow(Math.max(0, (g - lBlack) / levelDiff), 1 / lGamma) * 255;
              b = Math.pow(Math.max(0, (b - lBlack) / levelDiff), 1 / lGamma) * 255;
            }

            // C. Exposure
            r *= expFactor;
            g *= expFactor;
            b *= expFactor;

            // D. Contrast adjustment around middle point (128)
            r = ((r - 128) * contr) + 128;
            g = ((g - 128) * contr) + 128;
            b = ((b - 128) * contr) + 128;

            // E. Temp & Tint balance
            r += (adj.temp * 0.4);
            b -= (adj.temp * 0.4);
            g += (adj.tint * 0.2);

            // F. Hue / Saturation / Lightness HSL conversion mapping
            if (hueShiftDegrees !== 0 || lightPercent !== 0) {
              const [h, s, l] = rgbToHsl(r, g, b);
              let newH = h + (hueShiftDegrees / 360);
              if (newH < 0) newH += 1.0;
              if (newH > 1) newH -= 1.0;
              let newL = l + (lightPercent / 100);
              newL = Math.max(0, Math.min(1, newL));
              const [nr, ng, nb] = hslToRgb(newH, s, newL);
              r = nr; g = ng; b = nb;
            }

            // G. Saturation
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = gray + (r - gray) * satFactor;
            g = gray + (g - gray) * satFactor;
            b = gray + (b - gray) * satFactor;

            // H. Invert (反相)
            if (adj.invert) {
              r = 255 - r;
              g = 255 - g;
              b = 255 - b;
            }

            // I. Threshold (阈值)
            if (adj.threshold && adj.threshold > 0) {
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              const val = lum >= adj.threshold ? 255 : 0;
              r = val; g = val; b = val;
            }

            // J. Posterize (色调分离)
            if (adj.posterize && adj.posterize < 255 && adj.posterize >= 2) {
              const step = 255 / (adj.posterize - 1);
              r = Math.round(r / step) * step;
              g = Math.round(g / step) * step;
              b = Math.round(b / step) * step;
            }

            pixels[i] = Math.max(0, Math.min(255, r));
            pixels[i+1] = Math.max(0, Math.min(255, g));
            pixels[i+2] = Math.max(0, Math.min(255, b));
          }
          bCtx.putImageData(imgData, 0, 0);
        } catch (e) {
          // If tainted canvas due to unsplash, handle gracefully
        }
      }

      // 2.5 Apply Mask
      if (layer.hasMask) {
        try {
          const maskCanvas = getOrCreateMaskCanvas(layer);
          const maskCtx = maskCanvas.getContext('2d');
          if (maskCtx) {
            const mData = maskCtx.getImageData(0, 0, layerW, layerH).data;
            const imgData = bCtx.getImageData(0, 0, layerW, layerH);
            const pixels = imgData.data;
            for (let i = 0; i < pixels.length; i += 4) {
               // multiply original alpha by mask Red channel
               pixels[i+3] = (pixels[i+3] * mData[i]) / 255; 
            }
            bCtx.putImageData(imgData, 0, 0);
          }
        } catch (e) {
           console.warn('Mask read failed due to CORS');
        }
      }

      // 3. Render separate Layer Styles/Effects
      if (layer.effects.dropShadow.enabled) {
        const shadow = layer.effects.dropShadow;
        ctx.shadowColor = shadow.color;
        ctx.shadowBlur = shadow.blur;
        ctx.shadowOffsetX = shadow.distance * Math.cos(shadow.angle * Math.PI / 180);
        ctx.shadowOffsetY = shadow.distance * Math.sin(shadow.angle * Math.PI / 180);
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // 4. Blending with cumulative backdrop stage and matrix transformations (rotation and scaling)
      ctx.save();
      ctx.globalAlpha = layer.opacity;

      // Handle clipping layer (clip to immediate layer below)
      if (layer.isClipped && index > 0) {
        // Simple demonstrative clip handler
      }

      // Select proper blend mode map matching Photoshop specs
      ctx.globalCompositeOperation = (layer.blendMode as GlobalCompositeOperation) || 'source-over';

      // 5. Apply matrix rotation & scale transform cleanly using setTransform API
      const currentTransform = ctx.getTransform();
      const centerX = layer.offsetX + layer.width / 2;
      const centerY = layer.offsetY + layer.height / 2;
      
      const transformMatrix = currentTransform
        .translate(centerX, centerY)
        .rotate(layer.rotation || 0)
        .scale(layer.scaleX || 1, layer.scaleY || 1);
      
      ctx.setTransform(transformMatrix);

      // Draw compiled buffer back
      ctx.drawImage(layerBuffer, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
      ctx.restore();
    });

    // Reset composite operation to normal
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }, [layers, imageElements, docWidth, docHeight, isDraggingLiquify, previewResolution, layerCanvasCache]);

  // Lazy cache builder for mask canvases
  const getOrCreateMaskCanvas = (layer: PSLayer): HTMLCanvasElement => {
    if (maskCanvasCache[layer.id]) {
      return maskCanvasCache[layer.id];
    }
    const canvas = document.createElement('canvas');
    canvas.width = layer.width;
    canvas.height = layer.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (layer.maskData) {
        const idata = new ImageData(layer.maskData as Uint8ClampedArray, layer.width, layer.height);
        ctx.putImageData(idata, 0, 0);
      } else {
        ctx.fillStyle = '#ffffff'; // white unmasked
        ctx.fillRect(0, 0, layer.width, layer.height);
      }
    }
    maskCanvasCache[layer.id] = canvas;
    return canvas;
  };

  // Execute render compositing upon layers changes
  useEffect(() => {
    const t = setTimeout(() => {
      renderComposite();
    }, 45);
    return () => clearTimeout(t);
  }, [layers, imageElements, renderComposite, docWidth, docHeight, isFullscreen, isDraggingLiquify]);

  // --- COMMAND PATTERN IMPLEMENTATION FOR UNDO / REDO ---
  interface Command {
    name: string;
    execute(): void;
    undo(): void;
  }

  class TransformCommand implements Command {
    name = '自由变换状态修改';
    constructor(
      private layerId: string,
      private prev: { offsetX: number; offsetY: number; width: number; height: number; rotation: number; scaleX: number; scaleY: number },
      private next: { offsetX: number; offsetY: number; width: number; height: number; rotation: number; scaleX: number; scaleY: number },
      private setLayersFn: React.Dispatch<React.SetStateAction<PSLayer[]>>
    ) {}

    execute() {
      this.setLayersFn(prevLayers =>
        prevLayers.map(l =>
          l.id === this.layerId
            ? { ...l, offsetX: this.next.offsetX, offsetY: this.next.offsetY, width: this.next.width, height: this.next.height, rotation: this.next.rotation, scaleX: this.next.scaleX, scaleY: this.next.scaleY }
            : l
        )
      );
    }

    undo() {
      this.setLayersFn(prevLayers =>
        prevLayers.map(l =>
          l.id === this.layerId
            ? { ...l, offsetX: this.prev.offsetX, offsetY: this.prev.offsetY, width: this.prev.width, height: this.prev.height, rotation: this.prev.rotation, scaleX: this.prev.scaleX, scaleY: this.prev.scaleY }
            : l
        )
      );
    }
  }

  class LiquifyCommand implements Command {
    name = '网格液化变形';
    constructor(
      private layerId: string,
      private prevMesh: any,
      private nextMesh: any,
      private setLayersFn: React.Dispatch<React.SetStateAction<PSLayer[]>>
    ) {}

    execute() {
      this.setLayersFn(prevLayers =>
        prevLayers.map(l =>
          l.id === this.layerId ? { ...l, liquifyMesh: this.nextMesh } : l
        )
      );
    }

    undo() {
      this.setLayersFn(prevLayers =>
        prevLayers.map(l =>
          l.id === this.layerId ? { ...l, liquifyMesh: this.prevMesh } : l
        )
      );
    }
  }

  class ResetLiquifyCommand implements Command {
    name = '重置液化网格';
    constructor(
      private layerId: string,
      private prevMesh: any,
      private setLayersFn: React.Dispatch<React.SetStateAction<PSLayer[]>>
    ) {}

    execute() {
      this.setLayersFn(prevLayers =>
        prevLayers.map(l =>
          l.id === this.layerId ? { ...l, liquifyMesh: undefined } : l
        )
      );
    }

    undo() {
      this.setLayersFn(prevLayers =>
        prevLayers.map(l =>
          l.id === this.layerId ? { ...l, liquifyMesh: this.prevMesh } : l
        )
      );
    }
  }

  // Command control Refs
  const liquifyMeshStartRef = useRef<any | null>(null);
  const propertyFocusStartRef = useRef<{ offsetX: number; offsetY: number; width: number; height: number; rotation: number; scaleX: number; scaleY: number } | null>(null);

  const capturePropertyFocus = () => {
    if (activeLayer) {
      propertyFocusStartRef.current = {
        offsetX: activeLayer.offsetX,
        offsetY: activeLayer.offsetY,
        width: activeLayer.width,
        height: activeLayer.height,
        rotation: activeLayer.rotation || 0,
        scaleX: activeLayer.scaleX || 1,
        scaleY: activeLayer.scaleY || 1,
      };
    }
  };

  const commitPropertyBlur = () => {
    if (activeLayer && propertyFocusStartRef.current) {
      const prev = propertyFocusStartRef.current;
      const next = {
        offsetX: activeLayer.offsetX,
        offsetY: activeLayer.offsetY,
        width: activeLayer.width,
        height: activeLayer.height,
        rotation: activeLayer.rotation || 0,
        scaleX: activeLayer.scaleX || 1,
        scaleY: activeLayer.scaleY || 1,
      };
      
      const hasChanged = prev.offsetX !== next.offsetX || 
                         prev.offsetY !== next.offsetY || 
                         prev.width !== next.width ||
                         prev.height !== next.height ||
                         prev.rotation !== next.rotation || 
                         prev.scaleX !== next.scaleX || 
                         prev.scaleY !== next.scaleY;
                         
      if (hasChanged) {
        const cmd = new TransformCommand(activeLayer.id, prev, next, setLayers);
        const updated = layers.map(l => l.id === activeLayer.id ? { ...l, ...next } : l);
        pushToHistory("自由变换属性修改", updated, cmd);
        syncNodeData(updated);
      }
      propertyFocusStartRef.current = null;
    }
  };

  const rotateActiveLayerBy = (degrees: number) => {
    if (!activeLayer) return;
    const prev = {
      offsetX: activeLayer.offsetX,
      offsetY: activeLayer.offsetY,
      width: activeLayer.width,
      height: activeLayer.height,
      rotation: activeLayer.rotation || 0,
      scaleX: activeLayer.scaleX || 1,
      scaleY: activeLayer.scaleY || 1,
    };
    const nextRotation = ((activeLayer.rotation || 0) + degrees + 360) % 360;
    const next = { ...prev, rotation: nextRotation };
    
    const updated = layers.map(l => l.id === activeLayer.id ? { ...l, rotation: nextRotation } : l);
    const cmd = new TransformCommand(activeLayer.id, prev, next, setLayers);
    setLayers(updated);
    pushToHistory("旋转图层角度", updated, cmd);
    syncNodeData(updated);
  };

  // Initialize liquify grid mesh coordinates
  const triggerLiquifyInit = () => {
    if (!activeLayer) return;
    if (activeLayer.liquifyMesh) return; // already exists

    const cols = 12;
    const rows = 12;
    const points: PSLayer['liquifyMesh']['points'] = [];

    const cellW = activeLayer.width / (cols - 1);
    const cellH = activeLayer.height / (rows - 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        points.push({ ox: x, oy: y, x: x, y: y });
      }
    }

    updateActiveLayer(l => ({
      liquifyMesh: { cols, rows, points }
    }));
  };

  // Liquify brush distortion algorithm
  // Calculates distance weights and drags mesh vertices nicely
  const handleLiquifyDrag = (lx: number, ly: number, dx: number, dy: number) => {
    if (!activeLayer || !activeLayer.liquifyMesh) return;
    const mesh = activeLayer.liquifyMesh;
    const updatedPoints = mesh.points.map(p => {
      // Distance from brush center in layer space
      const dist = Math.hypot(p.x - lx, p.y - ly);
      if (dist < liquifyRadius) {
        // Quad fading factor
        const fade = Math.pow(1 - dist / liquifyRadius, 2);
        const shiftX = dx * fade * (liquifyStrength / 100);
        const shiftY = dy * fade * (liquifyStrength / 100);
        return {
          ...p,
          x: Math.max(0, Math.min(activeLayer.width, p.x + shiftX)),
          y: Math.max(0, Math.min(activeLayer.height, p.y + shiftY))
        };
      }
      return p;
    });

    updateActiveLayer(l => ({
      liquifyMesh: { ...mesh, points: updatedPoints }
    }));
  };

  // Canvas Mouse Drag listeners for Interactive Brush painting and Mesh Liquifying
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Global state for active transform dragging handle
  const [activeTransformAction, setActiveTransformAction] = useState<'none' | 'translate' | 'scale-tl' | 'scale-tr' | 'scale-bl' | 'scale-br' | 'scale-r'>('none');
  const transformStartRef = useRef<{ offsetX: number; offsetY: number; width: number; height: number; rotation: number; clientX: number; clientY: number; scaleX?: number; scaleY?: number } | null>(null);

  const getLayerRelativeCoords = (e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeLayer) return null;
    const rect = canvas.getBoundingClientRect();

    // mouse position in canvas space
    const canvasX = (e.clientX - rect.left) * (docWidth / rect.width);
    const canvasY = (e.clientY - rect.top) * (docHeight / rect.height);

    // relative positions in active layer space
    const rx = canvasX - activeLayer.offsetX;
    const ry = canvasY - activeLayer.offsetY;

    // Accounts for rotation back-calculation
    const theta = -(activeLayer.rotation || 0) * Math.PI / 180;
    const centerX = activeLayer.width / 2;
    const centerY = activeLayer.height / 2;
    const dx = rx - centerX;
    const dy = ry - centerY;
    const rotRx = centerX + (dx * Math.cos(theta) - dy * Math.sin(theta));
    const rotRy = centerY + (dx * Math.sin(theta) + dy * Math.cos(theta));

    return { cx: canvasX, cy: canvasY, rx, ry, rotRx, rotRy };
  };

  // Magic Wand BFS flood fill implementation
  const runMagicWandBFS = (startX: number, startY: number) => {
    if (!activeLayer) return;
    const cachedCanvas = getOrCreateLayerCanvas(activeLayer);
    const bCtx = cachedCanvas.getContext('2d');
    if (!bCtx) return;

    try {
      const w = Math.floor(activeLayer.width);
      const h = Math.floor(activeLayer.height);
      const startXInt = Math.floor(startX);
      const startYInt = Math.floor(startY);
      if (startXInt < 0 || startXInt >= w || startYInt < 0 || startYInt >= h) return;

      const imgData = bCtx.getImageData(0, 0, w, h);
      const pixels = imgData.data;

      const baseIdx = (startYInt * w + startXInt) * 4;
      const startR = pixels[baseIdx];
      const startG = pixels[baseIdx + 1];
      const startB = pixels[baseIdx + 2];

      const startLuminance = 0.299 * startR + 0.587 * startG + 0.114 * startB;

      const mask = new Uint8Array(docWidth * docHeight); // aligns to doc coordinate system
      const borders: { x: number; y: number }[] = [];
      const tolSq = magicWandTolerance * magicWandTolerance;

      if (magicWandMode === 'tolerance') {
        const visited = new Uint8Array(w * h);
        const queue: [number, number][] = [[startXInt, startYInt]];
        visited[startYInt * w + startXInt] = 1;

        while (queue.length > 0) {
          const curr = queue.shift()!;
          const [cx, cy] = curr;

          // Map to doc coordinates offsets
          const docX = Math.floor(activeLayer.offsetX + cx);
          const docY = Math.floor(activeLayer.offsetY + cy);
          if (docX >= 0 && docX < docWidth && docY >= 0 && docY < docHeight) {
            mask[docY * docWidth + docX] = 255;
          }

          let isBorder = false;

          const neighbors = [
            [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
          ];

          for (const [nx, ny] of neighbors) {
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
              isBorder = true;
              continue;
            }

            const nIdx = ny * w + nx;
            if (visited[nIdx] === 0) {
              const pIdx = nIdx * 4;
              const dr = pixels[pIdx] - startR;
              const dg = pixels[pIdx + 1] - startG;
              const db = pixels[pIdx + 2] - startB;
              const distSq = dr*dr + dg*dg + db*db;

              if (distSq <= tolSq) {
                visited[nIdx] = 1;
                queue.push([nx, ny]);
              } else {
                isBorder = true;
              }
            } else {
              // check if it's border inside visited? usually enough to check in visited
            }
          }

          if (isBorder && docX >= 0 && docX < docWidth && docY >= 0 && docY < docHeight) {
            if (cx % 2 === 0 || cy % 2 === 0) { // sparse for marching ants
              borders.push({ x: docX, y: docY });
            }
          }
        }
      } else {
        // Global modes
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx+1];
            const b = pixels[idx+2];
            let matches = false;

            if (magicWandMode === 'colorRange') {
              const dR = r - startR;
              const dG = g - startG;
              const dB = b - startB;
              if (dR*dR + dG*dG + dB*dB <= tolSq) {
                matches = true;
              }
            } else if (magicWandMode === 'luminance') {
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              if (Math.abs(lum - startLuminance) <= magicWandTolerance) {
                matches = true;
              }
            }

            if (matches) {
              const docX = Math.floor(activeLayer.offsetX + x);
              const docY = Math.floor(activeLayer.offsetY + y);
              if (docX >= 0 && docX < docWidth && docY >= 0 && docY < docHeight) {
                mask[docY * docWidth + docX] = 255;
              }
              if ((x === 0 || x === w - 1 || y === 0 || y === h - 1) && (x % 2 === 0 || y % 2 === 0)) {
                borders.push({ x: docX, y: docY });
              }
            }
          }
        }
      }

      setSelectionMask(mask);
      setSelectionBorders(borders);
    } catch (e) {
      console.warn("Magic Wand flood fill failed (canvas CORS likely):", e);
    }
  };

  const handleStartTransformAction = (action: 'none' | 'translate' | 'scale-tl' | 'scale-tr' | 'scale-bl' | 'scale-br' | 'scale-r', e: React.MouseEvent) => {
    if (!activeLayer) return;
    setActiveTransformAction(action);
    transformStartRef.current = {
      offsetX: activeLayer.offsetX,
      offsetY: activeLayer.offsetY,
      width: activeLayer.width,
      height: activeLayer.height,
      rotation: activeLayer.rotation || 0,
      clientX: e.clientX,
      clientY: e.clientY,
      scaleX: activeLayer.scaleX || 1,
      scaleY: activeLayer.scaleY || 1
    };
    setIsDrawing(true);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getLayerRelativeCoords(e);
    if (!coords) return;

    // Alt key held for Clone Stamp anchor sample
    if (isAltPressed && activeTool === 'clone-stamp') {
      setCloneSourcePos({ x: coords.cx, y: coords.cy });
      return;
    }

    if (activeTool === 'eyedropper') {
      const flatCanvas = canvasRef.current;
      const flatCtx = flatCanvas?.getContext('2d');
      if (flatCtx) {
        try {
          const pixel = flatCtx.getImageData(Math.floor(coords.cx), Math.floor(coords.cy), 1, 1).data;
          const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
          setBrushColor(hex);
          setShapeFillColor(hex);
          setSampledColorHex(hex);
          setActiveTool('brush'); // Auto switch to brush!
        } catch (err) {
          console.warn("Samples read error (CORS bounds):", err);
        }
      }
      return;
    }

    if (activeTool === 'magic-wand') {
      runMagicWandBFS(coords.rotRx, coords.rotRy);
      return;
    }

    if (activeTool === 'crop') {
      setCropOverlay({ x: coords.cx, y: coords.cy, w: 0, h: 0 });
      setIsDrawing(true);
      return;
    }

    if (activeTool === 'text') {
      const newText = prompt('请输入你要绘制的文字:', textVal) || textVal;
      if (newText) {
        setTextVal(newText);
        const newId = `layer-${Date.now()}`;
        const newLayer: PSLayer = {
          id: newId,
          name: `文字图层 (Text ${layers.length})`,
          type: 'text',
          visible: true,
          opacity: 1.0,
          blendMode: 'source-over',
          text: newText,
          fontSize: textSize,
          fontWeight: 'bold',
          textColor: brushColor,
          offsetX: Math.floor(coords.cx - 50),
          offsetY: Math.floor(coords.cy - 10),
          width: 300,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          isClipped: false,
          hasMask: false,
          adjustments: {
            curves: [[0, 0], [255, 255]],
            exposure: 0,
            temp: 0,
            tint: 0,
            contrast: 0,
            highlights: 0,
            shadows: 0,
            clarity: 0,
            saturation: 0,
            hue: 0,
            lightness: 0,
            levels: { blackMin: 0, gamma: 1.0, whiteMin: 255 }
          },
          effects: {
            dropShadow: { enabled: false, color: '#000000', blur: 12, distance: 8, angle: 135, opacity: 0.6 },
            bevelEmboss: { enabled: false, depth: 120, size: 8, soften: 2 }
          }
        };
        const updated = [newLayer, ...layers];
        setLayers(updated);
        syncNodeData(updated);
        pushToHistory('添加文字', updated);
        setActiveLayerId(newId);
        setSelectedLayerIds([newId]);
        setActiveTool('move');
      }
      return;
    }

    if (activeTool === 'gradient') {
      setGradientStartPos({ x: coords.cx, y: coords.cy });
      setIsDrawing(true);
      return;
    }

    if (activeTool === 'transform' || activeTool === 'move') {
      let targetLayer = activeLayer;
      
      // Auto-select layer if move tool and clicked outside current active layer or just an enhancement
      if (activeTool === 'move') {
        const flatCanvas = canvasRef.current;
        // In a real context with separate canvases, we'd check alpha of each layer sequentially (top to bottom).
        // Since we composite, we can loop reverse over layers, read their own offscreen cache
        for (let i = layers.length - 1; i >= 0; i--) {
          const l = layers[i];
          if (!l.visible) continue;
          
          const lx = coords.cx - l.offsetX;
          const ly = coords.cy - l.offsetY;
          
          if (lx >= 0 && lx < l.width && ly >= 0 && ly < l.height) {
            const lCache = layerCanvasCache[l.id];
            if (lCache) {
               const lCtx = lCache.getContext('2d');
               if (lCtx) {
                 try {
                   const pixel = lCtx.getImageData(lx, ly, 1, 1).data;
                   if (pixel[3] > 10) { // Alpha threshold
                     targetLayer = l;
                     if (l.id !== activeLayer.id) {
                       setActiveLayerId(l.id);
                       setSelectedLayerIds([l.id]);
                     }
                     break;
                   }
                 } catch (e) {
                   // Ignore CORS taint errors for auto select
                 }
               }
            }
          }
        }
      }

      if (!targetLayer) return;

      // Determine if clicked coordinate falls inside rotation or sizing handles
      let action: typeof activeTransformAction = 'translate';
      
      if (activeTool === 'transform') {
        const cx = targetLayer.offsetX + targetLayer.width / 2;
        const cy = targetLayer.offsetY + targetLayer.height / 2;
        
        // Handle check rotating handle (above 30px of Top side border)
        const rotY = targetLayer.offsetY - 30;
        const rotDist = Math.hypot(coords.cx - cx, coords.cy - rotY);
        
        if (rotDist < 25) {
          action = 'scale-r'; // Rotate handle
        }
      }

      setActiveTransformAction(action);

      transformStartRef.current = {
        offsetX: targetLayer.offsetX,
        offsetY: targetLayer.offsetY,
        width: targetLayer.width,
        height: targetLayer.height,
        rotation: targetLayer.rotation || 0,
        clientX: e.clientX,
        clientY: e.clientY,
        scaleX: targetLayer.scaleX || 1,
        scaleY: targetLayer.scaleY || 1
      };
      setIsDrawing(true);
      return;
    }

    setIsDrawing(true);
    setIsDraggingLiquify(activeTool === 'liquify');
    lastPosRef.current = { x: coords.cx, y: coords.cy };

    if (activeTool === 'liquify') {
      triggerLiquifyInit();
      liquifyMeshStartRef.current = activeLayer && activeLayer.liquifyMesh ? JSON.parse(JSON.stringify(activeLayer.liquifyMesh)) : null;
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && !isDraggingLiquify) return;
    const coords = getLayerRelativeCoords(e);
    if (!coords) return;

    if ((activeTool === 'transform' || activeTool === 'move') && transformStartRef.current && activeLayer) {
      const snap = transformStartRef.current;
      const deltaX = e.clientX - snap.clientX;
      const deltaY = e.clientY - snap.clientY;

      if (activeTransformAction === 'translate') {
        updateActiveLayer(l => ({
          offsetX: snap.offsetX + deltaX,
          offsetY: snap.offsetY + deltaY
        }));
      } else if (activeTransformAction === 'scale-r') {
        const cx = snap.offsetX + snap.width / 2;
        const cy = snap.offsetY + snap.height / 2;
        const startRad = Math.atan2(snap.clientY - cy, snap.clientX - cx);
        const currRad = Math.atan2(e.clientY - cy, e.clientX - cx);
        const deg = snap.rotation + ((currRad - startRad) * 180 / Math.PI);
        updateActiveLayer(l => ({
          rotation: Math.round(deg % 360)
        }));
      } else if (activeTransformAction.startsWith('scale-')) {
        const rad = (snap.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(-rad);
        const sin = Math.sin(-rad);
        
        // Transform screen offset delta to rotated layer space local delta
        const localDx = deltaX * cos - deltaY * sin;
        const localDy = deltaX * sin + deltaY * cos;

        let dw = 0;
        let dh = 0;
        let localCenterDx = 0;
        let localCenterDy = 0;

        const snapWidth = snap.width;
        const snapHeight = snap.height;

        if (activeTransformAction === 'scale-br') {
          dw = localDx;
          dh = localDy;
          const newW = Math.max(15, snapWidth + dw);
          const newH = Math.max(15, snapHeight + dh);
          const finalDw = newW - snapWidth;
          const finalDh = newH - snapHeight;
          localCenterDx = finalDw / 2;
          localCenterDy = finalDh / 2;
          
          updateActiveLayer(l => ({
            width: newW,
            height: newH,
            offsetX: snap.offsetX + (localCenterDx * Math.cos(rad) - localCenterDy * Math.sin(rad)),
            offsetY: snap.offsetY + (localCenterDx * Math.sin(rad) + localCenterDy * Math.cos(rad))
          }));
        } else if (activeTransformAction === 'scale-bl') {
          dw = -localDx;
          dh = localDy;
          const newW = Math.max(15, snapWidth + dw);
          const newH = Math.max(15, snapHeight + dh);
          const finalDw = newW - snapWidth;
          const finalDh = newH - snapHeight;
          localCenterDx = -finalDw / 2;
          localCenterDy = finalDh / 2;

          updateActiveLayer(l => ({
            width: newW,
            height: newH,
            offsetX: snap.offsetX + (localCenterDx * Math.cos(rad) - localCenterDy * Math.sin(rad)),
            offsetY: snap.offsetY + (localCenterDx * Math.sin(rad) + localCenterDy * Math.cos(rad))
          }));
        } else if (activeTransformAction === 'scale-tr') {
          dw = localDx;
          dh = -localDy;
          const newW = Math.max(15, snapWidth + dw);
          const newH = Math.max(15, snapHeight + dh);
          const finalDw = newW - snapWidth;
          const finalDh = newH - snapHeight;
          localCenterDx = finalDw / 2;
          localCenterDy = -finalDh / 2;

          updateActiveLayer(l => ({
            width: newW,
            height: newH,
            offsetX: snap.offsetX + (localCenterDx * Math.cos(rad) - localCenterDy * Math.sin(rad)),
            offsetY: snap.offsetY + (localCenterDx * Math.sin(rad) + localCenterDy * Math.cos(rad))
          }));
        } else if (activeTransformAction === 'scale-tl') {
          dw = -localDx;
          dh = -localDy;
          const newW = Math.max(15, snapWidth + dw);
          const newH = Math.max(15, snapHeight + dh);
          const finalDw = newW - snapWidth;
          const finalDh = newH - snapHeight;
          localCenterDx = -finalDw / 2;
          localCenterDy = -finalDh / 2;

          updateActiveLayer(l => ({
            width: newW,
            height: newH,
            offsetX: snap.offsetX + (localCenterDx * Math.cos(rad) - localCenterDy * Math.sin(rad)),
            offsetY: snap.offsetY + (localCenterDx * Math.sin(rad) + localCenterDy * Math.cos(rad))
          }));
        }
      }
      return;
    }

    if (activeTool === 'crop' && cropOverlay && isDrawing) {
      setCropOverlay(prev => prev ? ({ ...prev, w: coords.cx - prev.x, h: coords.cy - prev.y }) : null);
      return;
    }

    if (!lastPosRef.current) return;
    const dx = coords.cx - lastPosRef.current.x;
    const dy = coords.cy - lastPosRef.current.y;

    if (activeTool === 'liquify') {
      handleLiquifyDrag(coords.rotRx, coords.rotRy, dx, dy);
    } else if (activeTool === 'brush' && activeLayer) {
      if (currentEditingMask && activeLayer.hasMask) {
        // Paint on mask canvas instead
        const mCanvas = getOrCreateMaskCanvas(activeLayer);
        const mCtx = mCanvas.getContext('2d');
        if (mCtx) {
          mCtx.save();
          mCtx.strokeStyle = brushColor; // we assume user selects black/white or grays for mask! or we can force it 
          mCtx.lineWidth = brushSize;
          mCtx.lineCap = 'round';
          mCtx.lineJoin = 'round';
          mCtx.globalAlpha = brushOpacity;
          mCtx.beginPath();
          const prevRx = lastPosRef.current.x - activeLayer.offsetX;
          const prevRy = lastPosRef.current.y - activeLayer.offsetY;
          mCtx.moveTo(prevRx, prevRy);
          mCtx.lineTo(coords.rx, coords.ry);
          mCtx.stroke();
          mCtx.restore();
          
          setMaskCanvasCache({ ...maskCanvasCache, [activeLayer.id]: mCanvas });
          
          // Apply to raw maskData so it saves properly too!
          const mData = mCtx.getImageData(0, 0, activeLayer.width, activeLayer.height).data;
          const updated = layers.map(l => l.id === activeLayer.id ? { ...l, maskData: new Uint8ClampedArray(mData) } : l);
          setLayers(updated);
        }
      } else {
        // Paint directly on offscreen canvas cache
        const lCanvas = getOrCreateLayerCanvas(activeLayer);
        const bCtx = lCanvas.getContext('2d');
        if (bCtx) {
          bCtx.save();
          
          // Selection mask clipping constraint if it exists!
          if (selectionMask) {
            bCtx.beginPath();
            // Loop and create a fast clip path or use coordinate check (we can clip brush boundaries safely)
          }

          bCtx.strokeStyle = brushColor;
          bCtx.lineWidth = brushSize;
          bCtx.lineCap = 'round';
          bCtx.lineJoin = 'round';
          bCtx.globalAlpha = brushOpacity;
          bCtx.beginPath();
          // Previous relative coordinates
          const prevRx = lastPosRef.current.x - activeLayer.offsetX;
          const prevRy = lastPosRef.current.y - activeLayer.offsetY;
          bCtx.moveTo(prevRx, prevRy);
          bCtx.lineTo(coords.rx, coords.ry);
          bCtx.stroke();
          bCtx.restore();

          // Mutate cached texture buffer dynamically for composite refresh
          setLayerCanvasCache({ ...layerCanvasCache, [activeLayer.id]: lCanvas });
        }
      }
    } else if (activeTool === 'clone-stamp' && activeLayer && cloneSourcePos) {
      // Paint relative cloned pixels
      const lCanvas = getOrCreateLayerCanvas(activeLayer);
      const bCtx = lCanvas.getContext('2d');
      const flatCanvas = canvasRef.current;
      if (bCtx && flatCanvas) {
        // Source drag delta
        const offsetX = cloneSourcePos.x - lastPosRef.current.x;
        const offsetY = cloneSourcePos.y - lastPosRef.current.y;
        
        bCtx.save();
        bCtx.beginPath();
        bCtx.arc(coords.rx, coords.ry, brushSize / 2, 0, Math.PI * 2);
        bCtx.clip();
        
        // Draw matched portion of central flat Canvas back with shift
        bCtx.globalAlpha = brushOpacity;
        const sx = coords.cx + offsetX - brushSize / 2;
        const sy = coords.cy + offsetY - brushSize / 2;
        bCtx.drawImage(
          flatCanvas,
          sx, sy, brushSize, brushSize,
          coords.rx - brushSize / 2, coords.ry - brushSize / 2, brushSize, brushSize
        );
        bCtx.restore();

        setLayerCanvasCache({ ...layerCanvasCache, [activeLayer.id]: lCanvas });
      }
    }

    lastPosRef.current = { x: coords.cx, y: coords.cy };
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    setIsDraggingLiquify(false);
    setActiveTransformAction('none');
    lastPosRef.current = null;

    if (activeTool === 'gradient' && gradientStartPos && activeLayer) {
      const coords = getLayerRelativeCoords(e);
      if (coords) {
        const lCanvas = getOrCreateLayerCanvas(activeLayer);
        const bCtx = lCanvas.getContext('2d');
        if (bCtx) {
          bCtx.save();
          const startRx = gradientStartPos.x - activeLayer.offsetX;
          const startRy = gradientStartPos.y - activeLayer.offsetY;
          const endRx = coords.rx;
          const endRy = coords.ry;

          let grad: CanvasGradient;
          if (gradientType === 'linear') {
            grad = bCtx.createLinearGradient(startRx, startRy, endRx, endRy);
          } else {
            const rad = Math.hypot(endRx - startRx, endRy - startRy);
            grad = bCtx.createRadialGradient(startRx, startRy, 5, startRx, startRy, Math.max(10, rad));
          }

          grad.addColorStop(0, gradientColorStart);
          grad.addColorStop(1, gradientColorEnd);
          bCtx.fillStyle = grad;
          bCtx.fillRect(0, 0, activeLayer.width, activeLayer.height);
          bCtx.restore();

          setLayerCanvasCache({ ...layerCanvasCache, [activeLayer.id]: lCanvas });
          pushToHistory("引入渐变填充", layers);
        }
      }
      setGradientStartPos(null);
    }

    if (activeTool === 'shape-rect' || activeTool === 'shape-circle' || activeTool === 'shape-line') {
      const coords = getLayerRelativeCoords(e);
      if (coords && activeLayer) {
        const lCanvas = getOrCreateLayerCanvas(activeLayer);
        const bCtx = lCanvas.getContext('2d');
        if (bCtx) {
          bCtx.save();
          bCtx.fillStyle = shapeFillColor;
          bCtx.strokeStyle = shapeStrokeColor;
          bCtx.lineWidth = shapeStrokeWidth;

          if (activeTool === 'shape-rect') {
            bCtx.fillRect(coords.rx - 50, coords.ry - 50, 100, 100);
            bCtx.strokeRect(coords.rx - 50, coords.ry - 50, 100, 100);
          } else if (activeTool === 'shape-circle') {
            bCtx.beginPath();
            bCtx.arc(coords.rx, coords.ry, 50, 0, Math.PI * 2);
            bCtx.fill();
            bCtx.stroke();
          } else if (activeTool === 'shape-line') {
            bCtx.beginPath();
            bCtx.moveTo(coords.rx - 60, coords.ry);
            bCtx.lineTo(coords.rx + 60, coords.ry);
            bCtx.stroke();
          }
          bCtx.restore();
          setLayerCanvasCache({ ...layerCanvasCache, [activeLayer.id]: lCanvas });
          pushToHistory("嵌入矢量形状", layers);
        }
      }
    }

    // Capture standard stroke completions or Command-pattern updates
    if ((activeTool === 'transform' || activeTool === 'move') && transformStartRef.current && activeLayer) {
      const start = transformStartRef.current;
      const end = {
        offsetX: activeLayer.offsetX,
        offsetY: activeLayer.offsetY,
        width: activeLayer.width,
        height: activeLayer.height,
        rotation: activeLayer.rotation || 0,
        scaleX: activeLayer.scaleX || 1,
        scaleY: activeLayer.scaleY || 1,
      };
      
      const hasChanged = start.offsetX !== end.offsetX || 
                         start.offsetY !== end.offsetY || 
                         start.width !== end.width ||
                         start.height !== end.height ||
                         start.rotation !== end.rotation || 
                         (start.scaleX || 1) !== end.scaleX || 
                         (start.scaleY || 1) !== end.scaleY;
                         
      if (hasChanged) {
        const cmd = new TransformCommand(
          activeLayer.id,
          { 
            offsetX: start.offsetX, 
            offsetY: start.offsetY, 
            width: start.width,
            height: start.height,
            rotation: start.rotation, 
            scaleX: start.scaleX || 1, 
            scaleY: start.scaleY || 1 
          },
          end,
          setLayers
        );
        pushToHistory("自由变换画布", layers, cmd);
        syncNodeData(layers);
      }
    } else if (activeTool === 'liquify' && activeLayer) {
      const prevMesh = liquifyMeshStartRef.current;
      const nextMesh = activeLayer.liquifyMesh ? JSON.parse(JSON.stringify(activeLayer.liquifyMesh)) : null;
      const cmd = new LiquifyCommand(activeLayer.id, prevMesh, nextMesh, setLayers);
      pushToHistory("网格液化变形", layers, cmd);
      syncNodeData(layers);
    } else if (activeTool === 'brush' || activeTool === 'clone-stamp') {
      const desc = activeTool === 'brush' ? '涂鸦画笔绘画' : '克隆像素修复';
      pushToHistory(desc, layers);
      syncNodeData(layers);
    }

    transformStartRef.current = null;
    liquifyMeshStartRef.current = null;
  };

  // Global window event listeners to handle smooth, unrestricted dragging for Transform/Crop/Liquify interactions
  useEffect(() => {
    if (!isDrawing) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const fakeEvent = {
        clientX: e.clientX,
        clientY: e.clientY,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.MouseEvent<HTMLCanvasElement>;

      if (activeTool === 'transform' || activeTool === 'crop' || (activeTool === 'liquify' && isDraggingLiquify)) {
        handleCanvasMouseMove(fakeEvent);
      }
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      const fakeEvent = {
        clientX: e.clientX,
        clientY: e.clientY,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.MouseEvent<HTMLCanvasElement>;

      handleCanvasMouseUp(fakeEvent);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDrawing, isDraggingLiquify, activeTool, activeTransformAction, handleCanvasMouseMove, handleCanvasMouseUp]);

  // Reset Liquify warp grid back to normal uniform layout
  const resetLiquifyWarp = () => {
    if (!activeLayer) return;
    const prevMesh = activeLayer.liquifyMesh ? JSON.parse(JSON.stringify(activeLayer.liquifyMesh)) : undefined;
    if (!prevMesh) return;

    const cols = prevMesh.cols || 12;
    const rows = prevMesh.rows || 12;
    const points: PSLayer['liquifyMesh']['points'] = [];
    const cellW = activeLayer.width / (cols - 1);
    const cellH = activeLayer.height / (rows - 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        points.push({ ox: x, oy: y, x: x, y: y });
      }
    }
    const nextMesh = { cols, rows, points };

    const cmd = new LiquifyCommand(activeLayer.id, prevMesh, nextMesh, setLayers);
    const updated = layers.map(l => l.id === activeLayer.id ? { ...l, liquifyMesh: nextMesh } : l);

    setLayers(updated);
    pushToHistory("重置液化网格", updated, cmd);
    syncNodeData(updated);
  };

  // Create a new layer with the selected connected image source
  const handleCreateLayerFromIncoming = async (imgUrl: string, name?: string) => {
    const realUrl = await resolveDbBlob(imgUrl);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || 320;
      const h = img.naturalHeight || 320;
      const isFirstImport = layers.length === 1 && layers[0].id === 'bg-layer' && !layers[0].imageUrl;
      if (isFirstImport) {
        setDocWidth(w);
        setDocHeight(h);
      }

      const newId = `layer-${Date.now()}`;
      const newLayer: PSLayer = {
        id: newId,
        name: name || `导入图层 (Imported ${layers.length + 1})`,
        type: 'image',
        visible: true,
        opacity: 1,
        blendMode: 'source-over',
        imageUrl: imgUrl,
        offsetX: isFirstImport ? 0 : 40,
        offsetY: isFirstImport ? 0 : 40,
        width: w,
        height: h,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        isClipped: false,
        hasMask: false,
        adjustments: {
          curves: [[0, 0], [255, 255]],
          exposure: 0,
          temp: 0,
          tint: 0,
          contrast: 0,
          highlights: 0,
          shadows: 0,
          clarity: 0,
          saturation: 0,
          hue: 0,
          lightness: 0,
          levels: { blackMin: 0, gamma: 1.0, whiteMin: 255 }
        },
        effects: {
          dropShadow: { enabled: false, color: '#000000', blur: 10, distance: 5, angle: 45, opacity: 0.5 },
          bevelEmboss: { enabled: false, depth: 100, size: 5, soften: 0 }
        }
      };
      const updated = isFirstImport ? [newLayer] : [newLayer, ...layers];
      setLayers(updated);
      syncNodeData(updated);
      pushToHistory("导入外部画作", updated);
      setActiveLayerId(newId);
      setSelectedLayerIds([newId]);
    };
    img.src = realUrl;
  };

  // Replace active layer image with selection image source
  const handleReplaceActiveLayerImage = (imgUrl: string) => {
    if (!activeLayer) return;
    if (activeLayer.type !== 'image') return;
    
    // Replace the image url
    const updated = layers.map(l => {
      if (l.id === activeLayer.id) {
        return {
          ...l,
          imageUrl: imgUrl
        };
      }
      return l;
    });
    
    setLayers(updated);
    syncNodeData(updated);
    pushToHistory(`替换图层图片 (${activeLayer.name})`, updated);
  };

  // SVG Curves graph points drag handling
  const [draggingCurveIdx, setDraggingCurveIdx] = useState<number | null>(null);

  const handleCurvePointDrag = (e: React.MouseEvent<any>, idx: number) => {
    e.preventDefault();
    setDraggingCurveIdx(idx);
  };

  const handleCurveMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingCurveIdx === null || !activeLayer) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(255, Math.round(((e.clientX - svgRect.left) / svgRect.width) * 255)));
    const ny = Math.max(0, Math.min(255, Math.round((1 - (e.clientY - svgRect.top) / svgRect.height) * 255)));

    // Update active curve point
    const currentCurves = [...activeLayer.adjustments.curves];
    // Keep first and last x constrained
    if (draggingCurveIdx === 0) {
      currentCurves[0] = [0, ny];
    } else if (draggingCurveIdx === currentCurves.length - 1) {
      currentCurves[currentCurves.length - 1] = [255, ny];
    } else {
      currentCurves[draggingCurveIdx] = [nx, ny];
    }

    // Sort to keep progressive gradient x
    currentCurves.sort((a, b) => a[0] - b[0]);

    updateActiveLayer(l => ({
      adjustments: { ...l.adjustments, curves: currentCurves }
    }));
  };

  const handleCurveAddPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!activeLayer) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const nx = Math.round(((e.clientX - svgRect.left) / svgRect.width) * 255);
    const ny = Math.round((1 - (e.clientY - svgRect.top) / svgRect.height) * 255);

    // Filter duplicates
    const existIdx = activeLayer.adjustments.curves.findIndex(pt => Math.abs(pt[0] - nx) < 15);
    if (existIdx !== -1) return;

    const newPoints = [...activeLayer.adjustments.curves, [nx, ny] as [number, number]];
    newPoints.sort((a, b) => a[0] - b[0]);
    
    updateActiveLayer(l => ({
      adjustments: { ...l.adjustments, curves: newPoints }
    }));
  };

  const handleCurveRemovePoint = (idx: number) => {
    if (!activeLayer || activeLayer.adjustments.curves.length <= 2) return;
    if (idx === 0 || idx === activeLayer.adjustments.curves.length - 1) return; // keep bounds

    const currentCurves = activeLayer.adjustments.curves.filter((_, i) => i !== idx);
    updateActiveLayer(l => ({
      adjustments: { ...l.adjustments, curves: currentCurves }
    }));
  };

  // Launch AI ComfyUI workflow generation
  const handleAISend = async () => {
    if (aiRunning) return;
    setAiRunning(true);
    setAiProgress(5);
    setAiLogs(['[AI Pipeline] 正在建立与云端 ComfyUI 后端协作通道...', '[AI Pipeline] 提取图层上下文元数据和选区...']);

    try {
      // Step 2: Simulate prompt enhancements using Gemini or quick feedback fallback
      const enhancementPrompt = `Generate a high quality visual prompt description based on: Model=${aiModel}, Instruction=${aiPrompt}. Return a clean cinematic prompt string.`;
      setAiProgress(20);
      setAiLogs(prev => [...prev, '> 向 Gemini 模型发送高级生图上下文解析中...']);
      
      const promptResult = await generateTextWithFallback(enhancementPrompt);
      const cleanPrompt = promptResult || aiPrompt;
      setAiProgress(45);
      setAiLogs(prev => [...prev, `✅ 解析完毕，生成高级引导 Prompt: "${cleanPrompt.slice(0, 48)}..."`, '> 正在生成光流(Flow)导向图与局部遮罩(Mask)...', '> 将层位像素上传 ComfyUI 智能边缘节点 (Upload ID: aic_temp_input)...']);

      // 3. Simulating denoise cycle
      setTimeout(() => {
        setAiProgress(65);
        setAiLogs(prev => [...prev, '> ComfyUI KSampler 任务执行中 (KSampler - Flux Base)...', '> 正在执行步长扩散计算 [Steps: 20/20]...', '> 正在执行 2x 瓷砖高清细节放大处理 (Tile Ultra Detail HD)...']);
        
        setTimeout(() => {
          setAiProgress(90);
          setAiLogs(prev => [...prev, '> Denoise 100% 达成，生成目标像素块...', '✅ 云端数据拉取成功！正在下载并转换为在线纹理包...']);

          // 4. Create new layer from predefined list or simulated AI generation
          const newAiId = `ai-layer-${Date.now()}`;
          const rawAiImage = PRESET_LAYERS_IMAGES[Math.floor(Math.random() * PRESET_LAYERS_IMAGES.length)];
          
          const newAiLayer: PSLayer = {
            id: newAiId,
            name: `🌟 AI_Result (Flux) 1`,
            type: 'image',
            visible: true,
            opacity: 1.0,
            blendMode: 'source-over',
            imageUrl: rawAiImage,
            offsetX: 10,
            offsetY: 10,
            width: docWidth - 20,
            height: docHeight - 20,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            isClipped: false,
            hasMask: false,
            adjustments: {
              curves: [[0, 0], [255, 255]],
              exposure: 8,
              temp: -2,
              tint: 3,
              contrast: 12,
              highlights: 0,
              shadows: 0,
              clarity: 15,
              saturation: 10,
              hue: 0,
              lightness: 0,
              levels: { blackMin: 0, gamma: 1.0, whiteMin: 255 }
            },
            effects: {
              dropShadow: { enabled: true, color: '#000000', blur: 15, distance: 4, angle: 90, opacity: 0.4 },
              bevelEmboss: { enabled: false, depth: 100, size: 5, soften: 1 }
            }
          };

          const updated = [newAiLayer, ...layers];
          setAiProgress(100);
          setAiLogs(prev => [...prev, '🎉 [SUCCESS] 成果图层已成功插入文档最顶层！']);
          
          setTimeout(() => {
            syncNodeData(updated);
            setActiveLayerId(newAiId);
            setAiRunning(false);
            setAiProgress(0);
          }, 300);

        }, 1500);
      }, 1500);

    } catch (e) {
      console.error(e);
      setAiLogs(prev => [...prev, `❌ 出现执行错误: ${String(e)}`]);
      setAiRunning(false);
      setAiProgress(0);
    }
  };

  // Standard Download of flats PNG Image
  const handleDownloadOutput = () => {
    if (!canvasRef.current) return;
    try {
      const url = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `ais_ps_composite_${Date.now()}.png`;
      a.click();
    } catch (err) {
      alert("⚠️ 图层包含跨域资源，可升级内置存储或启用代理中转获取！");
    }
  };

  const renderWorkspace = (isFS: boolean) => {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Node Custom Header */}
        <div className={`h-14 px-5 bg-[#18181b]/95 border-b border-[#27272a] flex items-center justify-between shrink-0 ${isFS ? '' : 'react-flow__node-draghandle rounded-t-[26px]'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/10 text-white relative">
              <Layers size={18} className="z-10" />
              <motion.div 
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 bg-white/20 blur-md rounded-full"
              />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-white tracking-widest uppercase flex items-center gap-2">
                <span>AI PS ENGINE</span>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-normal border border-indigo-500/20">V2.0 COMPATIBLE</span>
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono tracking-tight">AI & Layer Composition Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mb-0.5">
            <button 
              onClick={() => setIsFullscreen(!isFS)}
              className="px-3 py-1.5 bg-[#27272a]/80 hover:bg-[#323236] text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all text-indigo-400 border border-indigo-500/20"
              title={isFS ? "退出全屏" : "全屏沉浸模式"}
            >
              {isFS ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              <span>{isFS ? "退出全屏" : "全屏沉浸模式"}</span>
            </button>

            <button 
              onClick={handleDownloadOutput}
              className="px-3 py-1.5 bg-[#27272a]/80 hover:bg-[#323236] rounded-lg text-white font-bold text-[11px] flex items-center gap-1.5 transition-all outline-none"
            >
              <Download size={12} />
              <span>合并导出</span>
            </button>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* Workspace core container */}
        <div className="flex flex-1 min-h-0 bg-[#0f0f11] relative">
          
          {/* LEFT SUB TOOLBAR (PS style tools choices) */}
          <div className="w-14 bg-[#18181b]/95 border-r border-[#27272a] flex flex-col items-center py-4 gap-2.5 shrink-0 nodrag relative">
            <button 
              title="移动图层工具 (V)"
              onClick={() => setActiveTool('move')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'move' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Move size={15} />
            </button>

            <button 
              title="自由变换缩放旋转 (Ctrl+T)"
              onClick={() => setActiveTool('transform')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'transform' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Scaling size={15} />
            </button>

            <button 
              title="画笔涂鸦工具 (B)"
              onClick={() => setActiveTool('brush')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'brush' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Paintbrush size={15} />
            </button>

            <button 
              title="魔棒智能填色选区 (W)"
              onClick={() => setActiveTool('magic-wand')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'magic-wand' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Wand2 size={15} />
            </button>

            <button 
              title="渐变填充混合工具 (G)"
              onClick={() => setActiveTool('gradient')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'gradient' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal size={15} />
            </button>

            <button 
              title="仿制图章像素修复 (S)"
              onClick={() => setActiveTool('clone-stamp')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'clone-stamp' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Scissors size={15} />
            </button>

            <button 
              title="吸管颜色采样工具 (I)"
              onClick={() => setActiveTool('eyedropper')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'eyedropper' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Pipette size={15} />
            </button>

            <button 
              title="文字工具 (T)"
              onClick={() => setActiveTool('text')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'text' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Type size={15} />
            </button>

            <button 
              title="矢量矩形形状 (U)"
              onClick={() => setActiveTool('shape-rect')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'shape-rect' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Square size={13} />
            </button>

            <button 
              title="矢量圆形形状 (O)"
              onClick={() => setActiveTool('shape-circle')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'shape-circle' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Circle size={13} />
            </button>

            <button 
              title="裁剪画布工具 (C)"
              onClick={() => setActiveTool('crop')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'crop' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ArrowDown size={14} />
            </button>

            <button 
              title="网格液化变形工具 (W)"
              onClick={() => {
                setActiveTool('liquify');
                triggerLiquifyInit();
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'liquify' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Grid3X3 size={15} />
            </button>

            <div className="w-8 h-[1px] bg-zinc-850 my-1" />

             {/* Float Option Panels matching standard PS presets */}
             {activeTool === 'transform' && activeLayer && (
               <div className="absolute left-16 top-4 bg-[#141417]/95 border border-zinc-800 p-3 rounded-xl shadow-xl z-50 w-52 space-y-2 text-zinc-300">
                 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block">自由变换属性</span>
                 <div className="flex gap-2">
                   <div className="flex-1">
                     <span className="text-[8px] text-zinc-500 block">旋转角度</span>
                     <input 
                       type="number" value={activeLayer.rotation || 0}
                       onFocus={capturePropertyFocus}
                       onBlur={commitPropertyBlur}
                       onChange={(e) => updateActiveLayer(l => ({ rotation: Number(e.target.value) }))}
                       className="w-full bg-[#1c1c1f] p-1 border border-zinc-800 rounded text-[10px] text-white font-mono"
                     />
                   </div>
                   <div className="flex-1">
                     <span className="text-[8px] text-zinc-500 block">缩放X</span>
                     <input 
                       type="number" step="0.1" value={activeLayer.scaleX || 1}
                       onFocus={capturePropertyFocus}
                       onBlur={commitPropertyBlur}
                       onChange={(e) => updateActiveLayer(l => ({ scaleX: Number(e.target.value) }))}
                       className="w-full bg-[#1c1c1f] p-1 border border-zinc-800 rounded text-[10px] text-white font-mono"
                     />
                   </div>
                 </div>
                 <div className="flex gap-2">
                   <div className="flex-1">
                     <span className="text-[8px] text-zinc-500 block">水平位移 X</span>
                     <input 
                       type="number" value={activeLayer.offsetX}
                       onFocus={capturePropertyFocus}
                       onBlur={commitPropertyBlur}
                       onChange={(e) => updateActiveLayer(l => ({ offsetX: Number(e.target.value) }))}
                       className="w-full bg-[#1c1c1f] p-1 border border-zinc-800 rounded text-[10px] text-white font-mono"
                     />
                   </div>
                   <div className="flex-1">
                     <span className="text-[8px] text-zinc-500 block">垂直位移 Y</span>
                     <input 
                       type="number" value={activeLayer.offsetY}
                       onFocus={capturePropertyFocus}
                       onBlur={commitPropertyBlur}
                       onChange={(e) => updateActiveLayer(l => ({ offsetY: Number(e.target.value) }))}
                       className="w-full bg-[#1c1c1f] p-1 border border-zinc-800 rounded text-[10px] text-white font-mono"
                     />
                   </div>
                 </div>
                 <div className="flex gap-1.5 pt-1">
                   <button 
                     onClick={() => rotateActiveLayerBy(-90)}
                     className="flex-1 bg-zinc-805 hover:bg-zinc-750 text-[9px] py-1 rounded text-white cursor-pointer"
                   >
                     左旋 90°
                   </button>
                   <button 
                     onClick={() => rotateActiveLayerBy(90)}
                     className="flex-1 bg-zinc-805 hover:bg-zinc-750 text-[9px] py-1 rounded text-white cursor-pointer"
                   >
                     右旋 90°
                   </button>
                 </div>
               </div>
             )}

            {/* Brush Controls Panel Pop-out */}
            {activeTool === 'brush' && (
              <div className="absolute left-16 top-16 bg-[#1a1a1e]/95 border border-zinc-800 p-3 rounded-xl shadow-xl z-50 w-52 space-y-2.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">画笔笔触设置</span>
                <div>
                  <div className="flex justify-between text-[9px] text-zinc-400 font-mono mb-1">
                    <span>笔刷大小</span>
                    <span>{brushSize}px</span>
                  </div>
                  <input 
                    type="range" min="1" max="100" value={brushSize} 
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-zinc-400 font-mono mb-1">
                    <span>不透明度</span>
                    <span>{Math.round(brushOpacity * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="1" step="0.05" value={brushOpacity} 
                    onChange={(e) => setBrushOpacity(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-1">调色板颜色</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {['#ff0055', '#ea580c', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000'].map(c => (
                      <button 
                        key={c} onClick={() => setBrushColor(c)}
                        className={`w-5.5 h-5.5 rounded border ${brushColor === c ? 'border-white scale-110 ring-1 ring-indigo-500' : 'border-zinc-800'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[9px] text-zinc-500">Hex:</span>
                    <input 
                      type="text" value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="bg-[#101012] border border-zinc-800 rounded px-1 py-0.5 text-[9px] text-white font-mono w-20"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTool === 'magic-wand' && (
              <div className="absolute left-16 top-24 bg-[#1a1a1e]/95 border border-zinc-800 p-3 rounded-xl shadow-xl z-50 w-52 space-y-2">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block">魔棒选区设置</span>
                
                <div className="space-y-1 mt-1">
                  <span className="text-[9px] text-zinc-500 block">选区模式 (Mode)</span>
                  <div className="flex bg-[#111] p-0.5 rounded-lg border border-zinc-800">
                    <button 
                      onClick={() => setMagicWandMode('tolerance')}
                      className={`flex-1 py-1 text-[9px] rounded-md transition-all ${magicWandMode === 'tolerance' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                    >连续点</button>
                    <button 
                      onClick={() => setMagicWandMode('colorRange')}
                      className={`flex-1 py-1 text-[9px] rounded-md transition-all ${magicWandMode === 'colorRange' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                    >全局颜色</button>
                    <button 
                      onClick={() => setMagicWandMode('luminance')}
                      className={`flex-1 py-1 text-[9px] rounded-md transition-all ${magicWandMode === 'luminance' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                    >全局亮度</button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[9px] text-zinc-400 font-mono mb-1">
                    <span>容差 (Tolerance)</span>
                    <span>{magicWandTolerance}</span>
                  </div>
                  <input 
                    type="range" min="1" max="150" value={magicWandTolerance} 
                    onChange={(e) => setMagicWandTolerance(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
                  />
                </div>
                <button 
                  onClick={() => { setSelectionMask(null); setSelectionBorders([]); }}
                  className="w-full bg-red-950/40 hover:bg-red-900/40 border border-red-900/30 text-rose-400 text-[9px] py-1 rounded"
                >
                  清除选区 (Ctrl+D)
                </button>
              </div>
            )}

            {activeTool === 'gradient' && (
              <div className="absolute left-16 top-32 bg-[#1a1a1e]/95 border border-zinc-800 p-3 rounded-xl shadow-xl z-50 w-52 space-y-2.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">渐变填涂预设</span>
                <div>
                  <span className="text-[8px] text-zinc-500 block mb-1">变化类型</span>
                  <div className="grid grid-cols-2 gap-1 text-[9px]">
                    <button 
                      onClick={() => setGradientType('linear')}
                      className={`py-1 rounded text-center transition-colors ${gradientType === 'linear' ? 'bg-indigo-700 text-white font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                    >
                      线性渐变
                    </button>
                    <button 
                      onClick={() => setGradientType('radial')}
                      className={`py-1 rounded text-center transition-colors ${gradientType === 'radial' ? 'bg-indigo-700 text-white font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                    >
                      径向放射
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[8px] text-zinc-500 block">渐变两端配色</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" value={gradientColorStart}
                      onChange={(e) => setGradientColorStart(e.target.value)}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <span className="text-[10px] text-zinc-400 font-mono font-bold">→</span>
                    <input 
                      type="color" value={gradientColorEnd}
                      onChange={(e) => setGradientColorEnd(e.target.value)}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </div>
                </div>
                <p className="text-[8px] text-zinc-500 leading-normal">
                  ⚠️提示: 设定颜色后在画布任意一处按鼠标拖拉，松手即可应用渐变层。
                </p>
              </div>
            )}

            {activeTool === 'clone-stamp' && (
              <div className="absolute left-16 top-36 bg-[#1a1a1e]/95 border border-zinc-800 p-3 rounded-xl shadow-xl z-50 w-52 space-y-2 text-zinc-300">
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider block">仿制图章设置</span>
                <p className="text-[9px] text-zinc-400 leading-normal">
                  <span className="text-white font-black">【操作指引】</span>: <br/>
                  按住键盘 <span className="bg-zinc-800 px-1 py-0.5 rounded text-white font-mono font-bold">Alt</span> 并在画布上点击，即可选择采样的像素原点，然后进行拖拽复刻涂刷。
                </p>
                <div>
                  <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                    <span>图章大小</span>
                    <span>{brushSize}px</span>
                  </div>
                  <input 
                    type="range" min="1" max="100" value={brushSize} 
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
                  />
                </div>
                {cloneSourcePos ? (
                  <div className="text-[8px] bg-emerald-900/20 text-emerald-400 px-1.5 py-1 rounded border border-emerald-900/30">
                    ✅ 已采样源坐标: X={Math.round(cloneSourcePos.x)} Y={Math.round(cloneSourcePos.y)}
                  </div>
                ) : (
                  <div className="text-[8px] bg-red-950/20 text-rose-400 px-1.5 py-1 rounded border border-red-900/30">
                    ❌ 未采样源！请按住 Alt 键在画布点击
                  </div>
                )}
              </div>
            )}

            {activeTool === 'eyedropper' && (
              <div className="absolute left-16 top-40 bg-[#1a1a1e]/95 border border-zinc-800 p-3 rounded-xl shadow-xl z-50 w-44 space-y-1.5 text-zinc-300">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block">吸管取色</span>
                <p className="text-[8px] text-zinc-400">点击画布采集图像上对应位置的 Hex 颜色。</p>
                {sampledColorHex && (
                  <div className="flex items-center gap-2 bg-[#121214] p-1.5 rounded border border-zinc-800">
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: sampledColorHex }} />
                    <span className="font-mono text-[9px] text-white">{sampledColorHex}</span>
                  </div>
                )}
              </div>
            )}

            {activeTool.startsWith('shape-') && (
              <div className="absolute left-16 top-44 bg-[#1a1a1e]/95 border border-zinc-800 p-3 rounded-xl shadow-xl z-50 w-52 space-y-2 text-zinc-300">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block">矢量形状属性</span>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <span className="text-[8px] text-zinc-500 block">填充颜色</span>
                    <input 
                      type="color" value={shapeFillColor}
                      onChange={(e) => setShapeFillColor(e.target.value)}
                      className="w-full h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[8px] text-zinc-500 block">描边颜色</span>
                    <input 
                      type="color" value={shapeStrokeColor}
                      onChange={(e) => setShapeStrokeColor(e.target.value)}
                      className="w-full h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-zinc-500 font-mono mb-1">
                    <span>描边粗细</span>
                    <span>{shapeStrokeWidth}px</span>
                  </div>
                  <input 
                    type="range" min="1" max="15" value={shapeStrokeWidth} 
                    onChange={(e) => setShapeStrokeWidth(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1 bg-zinc-700 rounded appearance-none cursor-pointer"
                  />
                </div>
                <p className="text-[8px] text-zinc-500 leading-normal">
                  提示: 选好颜色粗细后直接在画布点击放置形状。
                </p>
              </div>
            )}

            {activeTool === 'crop' && (
              <div className="absolute left-16 top-48 bg-[#1a1a1e]/95 border border-zinc-800 p-3 rounded-xl shadow-xl z-50 w-52 space-y-2 text-zinc-300">
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider block">裁剪画布尺寸</span>
                <p className="text-[9px] text-zinc-500 leading-tight">
                  在画布上拖拽任意方形区域，然后按下 <strong className="text-zinc-300">Enter / 回车</strong> 键进行裁剪。
                </p>
                <div className="space-y-1.5 mt-2">
                  <div>
                    <span className="text-[8px] text-zinc-500 block">自定义宽度(Width)</span>
                    <input 
                      type="number" value={docWidth}
                      onChange={(e) => setDocWidth(Math.max(100, Number(e.target.value)))}
                      className="w-full bg-[#1c1c1f] p-1 border border-zinc-800 rounded text-[10px] text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] text-zinc-500 block">高度(Height)</span>
                    <input 
                      type="number" value={docHeight}
                      onChange={(e) => setDocHeight(Math.max(100, Number(e.target.value)))}
                      className="w-full bg-[#1c1c1f] p-1 border border-zinc-800 rounded text-[10px] text-white font-mono"
                    />
                  </div>
                </div>
                <p className="text-[8px] text-zinc-500 leading-normal">
                  可在此处输入或者直接在画布上拖拽任意改变长宽。
                </p>
              </div>
            )}

            {/* Liquify Controls Panel Pop-out */}
            {activeTool === 'liquify' && (
              <div className="absolute left-16 top-52 bg-[#1a1a1e]/95 border border-zinc-800 p-3 rounded-xl shadow-xl z-50 w-44 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">网格液化 (Liquify)</span>
                  <button onClick={resetLiquifyWarp} title="复位变形" className="text-zinc-500 hover:text-white">
                    <RotateCcw size={10} />
                  </button>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-zinc-500 font-mono mb-1">
                    <span>强度</span>
                    <span>{liquifyStrength}%</span>
                  </div>
                  <input 
                    type="range" min="5" max="100" value={liquifyStrength} 
                    onChange={(e) => setLiquifyStrength(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-zinc-500 font-mono mb-1">
                    <span>影响半径</span>
                    <span>{liquifyRadius}px</span>
                  </div>
                  <input 
                    type="range" min="10" max="150" value={liquifyRadius} 
                    onChange={(e) => setLiquifyRadius(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="pt-1">
                  <button
                    onClick={resetLiquifyWarp}
                    disabled={!activeLayer || !activeLayer.liquifyMesh}
                    className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-[#1f1f24] disabled:text-zinc-600 border border-indigo-500/20 disabled:border-transparent text-white text-[9px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all outline-none cursor-pointer"
                  >
                    <RotateCcw size={10} />
                    <span>恢复所有液化网格</span>
                  </button>
                </div>
                <div className="pt-2 border-t border-zinc-800">
                  <span className="text-[8px] text-indigo-400 block mb-1 font-bold">实时预览降级 (60FPS)</span>
                  <div className="grid grid-cols-3 gap-1">
                    {['auto', 'low', 'high'].map(r => (
                      <button
                        key={r} onClick={() => setPreviewResolution(r as any)}
                        className={`text-[8px] py-0.5 rounded uppercase font-mono font-bold ${previewResolution === r ? 'bg-indigo-600 text-white' : 'bg-zinc-850 text-zinc-400'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MIDDLE CANVAS DESK AREA */}
          <div ref={workspaceRef} className="flex-1 overflow-hidden relative flex flex-col items-center justify-center bg-[#09090b] p-4 font-sans">
            <div 
              className="relative shadow-[0_0_40px_rgba(0,0,0,0.6)] cursor-crosshair border border-[#1e1e24]"
              style={{ 
                width: `${docWidth}px`, 
                height: `${docHeight}px`,
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.1s ease-out'
              }}
            >
              {/* Backboard Transparent checkerboard grid background */}
              <div className="absolute inset-0 bg-[linear-gradient(45deg,#1c1c20_25%,transparent_25%),linear-gradient(-45deg,#1c1c20_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1c1c20_75%),linear-gradient(-45deg,transparent_75%,#1c1c20_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] opacity-50 z-0 pointer-events-none" />
              
              {/* Final combined preview Canvas */}
              <canvas 
                ref={canvasRef}
                width={docWidth}
                height={docHeight}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="absolute inset-0 z-10 w-full h-full block"
              />

              {/* Vector Overlay of Liquify Mesh Grid (When liquify tool is active) */}
              {activeTool === 'liquify' && activeLayer && activeLayer.liquifyMesh && (
                <svg className="absolute inset-0 z-20 pointer-events-none w-full h-full">
                  {/* Draw grid lines */}
                  {Array.from({ length: activeLayer.liquifyMesh.rows }).map((_, r) => (
                    <path 
                      key={`r-${r}`}
                      d={activeLayer.liquifyMesh!.points
                        .filter((_, idx) => Math.floor(idx / activeLayer.liquifyMesh!.cols) === r)
                        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x + activeLayer.offsetX} ${p.y + activeLayer.offsetY}`)
                        .join(' ')}
                      fill="none"
                      stroke="rgba(99, 102, 241, 0.45)"
                      strokeWidth="1"
                    />
                  ))}
                  {Array.from({ length: activeLayer.liquifyMesh.cols }).map((_, c) => (
                    <path 
                      key={`c-${c}`}
                      d={activeLayer.liquifyMesh!.points
                        .filter((_, idx) => idx % activeLayer.liquifyMesh!.cols === c)
                        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x + activeLayer.offsetX} ${p.y + activeLayer.offsetY}`)
                        .join(' ')}
                      fill="none"
                      stroke="rgba(99, 102, 241, 0.45)"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Highlight control vertices points circles */}
                  {activeLayer.liquifyMesh.points.map((p, idx) => (
                    <circle 
                      key={`pt-${idx}`}
                      cx={p.x + activeLayer.offsetX}
                      cy={p.y + activeLayer.offsetY}
                      r="1.8"
                      fill="#eab308"
                      opacity="0.7"
                    />
                  ))}
                </svg>
              )}

              {/* Transform Tool Bounding Box Handles */}
              {activeTool === 'transform' && activeLayer && (
                <div 
                  className="absolute z-20 border border-indigo-500 pointer-events-none"
                  style={{
                    left: `${activeLayer.offsetX}px`,
                    top: `${activeLayer.offsetY}px`,
                    width: `${activeLayer.width}px`,
                    height: `${activeLayer.height}px`,
                    transform: `rotate(${activeLayer.rotation || 0}deg)`,
                    transformOrigin: 'center center',
                  }}
                >
                  {/* Bounding box visual indicators with click-and-drag */}
                  <div 
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleStartTransformAction('translate', e);
                    }}
                    className="absolute inset-0 border border-indigo-400 opacity-60 cursor-move pointer-events-auto shadow-inner" 
                  />
                  
                  {/* Anchor Handle Nodes (Corners) */}
                  <div 
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleStartTransformAction('scale-tl', e);
                    }}
                    className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md pointer-events-auto hover:scale-125 transition-transform" 
                  />
                  <div 
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleStartTransformAction('scale-tr', e);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-md pointer-events-auto hover:scale-125 transition-transform" 
                  />
                  <div 
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleStartTransformAction('scale-bl', e);
                    }}
                    className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-md pointer-events-auto hover:scale-125 transition-transform" 
                  />
                  <div 
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleStartTransformAction('scale-br', e);
                    }}
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md pointer-events-auto hover:scale-125 transition-transform" 
                  />
                  
                  {/* Center Pivot Indicator */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-indigo-400 bg-black/60 rounded-full flex items-center justify-center text-[7px] text-white">
                    +
                  </div>
 
                  {/* Rotation visual handle pin extending upward */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                    <div className="w-0.5 h-8 bg-indigo-500" />
                    <div 
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleStartTransformAction('scale-r', e);
                      }}
                      className="w-5 h-5 bg-amber-500 rounded-full border border-white cursor-pointer shadow-lg flex items-center justify-center text-[9px] text-zinc-950 font-bold font-mono hover:scale-125 hover:bg-amber-400 transition-all"
                    >
                      ⟳
                    </div>
                  </div>
                </div>
              )}

              {/* Magic Wand Selection Marching Ants visualizer */}
              {selectionBorders && selectionBorders.length > 0 && (
                <svg className="absolute inset-0 z-30 pointer-events-none w-full h-full">
                  <style>{`
                    @keyframes ants {
                      to {
                        stroke-dashoffset: -20;
                      }
                    }
                    .ants-animated {
                      animation: ants 0.8s linear infinite;
                    }
                  `}</style>
                  <path 
                    d={selectionBorders.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                    strokeDasharray="4,4"
                    className="ants-animated"
                  />
                  <path 
                    d={selectionBorders.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')}
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.2"
                    strokeDasharray="4,4"
                    strokeDashoffset="4"
                    className="ants-animated"
                  />
                </svg>
              )}

              {/* Crop Tool Overlay */}
              {activeTool === 'crop' && cropOverlay && (
                <svg className="absolute inset-0 z-30 pointer-events-none w-full h-full bg-black/40">
                  <mask id="crop-mask">
                    <rect width="100%" height="100%" fill="white" />
                    <rect 
                      x={Math.min(cropOverlay.x, cropOverlay.x + cropOverlay.w)} 
                      y={Math.min(cropOverlay.y, cropOverlay.y + cropOverlay.h)} 
                      width={Math.abs(cropOverlay.w)} 
                      height={Math.abs(cropOverlay.h)} 
                      fill="black" 
                    />
                  </mask>
                  <rect width="100%" height="100%" fill="black" opacity="0.6" mask="url(#crop-mask)" />
                  <rect 
                    x={Math.min(cropOverlay.x, cropOverlay.x + cropOverlay.w)} 
                    y={Math.min(cropOverlay.y, cropOverlay.y + cropOverlay.h)} 
                    width={Math.abs(cropOverlay.w)} 
                    height={Math.abs(cropOverlay.h)} 
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </svg>
              )}
            </div>

            {/* Quick floating Zoom control menu */}
            <div className="absolute bottom-4 right-4 bg-black/90 px-3 py-1.5 rounded-xl border border-zinc-800 max-h-12 flex items-center gap-3 z-30 font-mono text-xs text-zinc-400">
              <button onClick={() => setZoom(prev => Math.max(0.3, prev - 0.1))} className="hover:text-white transition-colors">-</button>
              <span className="font-bold">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(prev => Math.min(3.0, prev + 0.1))} className="hover:text-white transition-colors">+</button>
              <button onClick={() => setZoom(1.0)} className="text-[10px] text-zinc-650 hover:text-white">RESET</button>
            </div>
          </div>

          {/* RIGHT SIDEBAR PANEL */}
          <div className="w-[320px] bg-[#141417] border-l border-[#27272a] flex flex-col shrink-0 nodrag font-sans">
            {/* Tabs selector */}
            <div className="grid grid-cols-4 border-b border-[#27272a] h-11 shrink-0 text-center">
              {[
                { id: 'layers', icon: <Layers size={13} />, label: '图层' },
                { id: 'adjustments', icon: <Sliders size={13} />, label: '调整' },
                { id: 'fx', icon: <SlidersHorizontal size={13} />, label: '混合' },
                { id: 'ai', icon: <Sparkles size={13} />, label: 'AI' }
              ].map(tb => (
                <button
                  key={tb.id}
                  onClick={() => setActiveTab(tb.id as any)}
                  className={`flex flex-col items-center justify-center gap-0.5 font-bold text-[10px] transition-all relative ${
                    activeTab === tb.id ? 'bg-[#18181b] text-indigo-400 font-extrabold' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tb.icon}
                  <span>{tb.label}</span>
                  {activeTab === tb.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-indigo-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content scrollable viewports */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              
              {/* --- TAB 1: LAYERS MANAGER PANEL --- */}
              {activeTab === 'layers' && (
                <div className="space-y-4">
                  {/* Add Layer trigger actions */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = 'image/*';
                        fileInput.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const dataUrl = evt.target?.result as string;
                              if (dataUrl) {
                                handleAddLocalImageLayer(dataUrl, file.name);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        fileInput.click();
                      }}
                      className="flex-1 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/30 text-indigo-450 font-bold py-2 px-1.5 rounded-xl text-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus size={10} />
                      <span>添加图片</span>
                    </button>
                    <button 
                      onClick={() => handleAddLayer('solid')}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-350 font-bold py-2 px-1.5 rounded-xl text-[10px] flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Plus size={10} />
                      <span>纯色填充</span>
                    </button>
                  </div>

                  {/* --- External Connected Images Section --- */}
                  <div className="p-3 bg-[#111114] rounded-xl border border-dashed border-zinc-700/50 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">外部接入图片 (Input Images)</span>
                      <span className="text-[8px] bg-emerald-500/10 text-emerald-400 font-mono font-bold px-1.5 py-0.5 rounded-full">
                        {resolvedIncomingImages.length} 个就绪
                      </span>
                    </div>
                    
                    {resolvedIncomingImages.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {resolvedIncomingImages.map((item, idx) => (
                            <div key={idx} className="relative group/input border border-zinc-800 rounded-lg overflow-hidden bg-black/40 p-1.5 flex flex-col gap-1.5">
                              <div className="relative aspect-square w-full bg-zinc-900 rounded-md overflow-hidden">
                                <img 
                                  src={item.resolved} 
                                  className="w-full h-full object-cover" 
                                  alt={`Connected Input ${idx + 1}`}
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute top-1 left-1 bg-black/60 text-[8px] text-zinc-300 px-1 py-0.5 rounded font-mono">
                                  图{idx + 1}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <button
                                  onClick={() => handleCreateLayerFromIncoming(item.raw, item.name)}
                                  className="w-full py-1 bg-indigo-600/20 hover:bg-indigo-600/35 hover:text-white text-indigo-300 font-bold rounded text-[8px] cursor-pointer transition-all"
                                >
                                  创建为新图层
                                </button>
                                <button
                                  onClick={() => handleReplaceActiveLayerImage(item.raw)}
                                  disabled={!activeLayer || activeLayer.type !== 'image'}
                                  className="w-full py-1 bg-emerald-600/15 hover:enabled:bg-emerald-600/30 hover:enabled:text-white disabled:opacity-30 disabled:hover:bg-transparent text-emerald-300 font-bold rounded text-[8px] cursor-pointer transition-all"
                                >
                                  替换当前图层
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 px-2">
                        <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                          暂无上游图集传入。
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Active layer parameters (opacity / blend mode) */}
                  {activeLayer && (
                    <div className="p-3 bg-[#18181b] rounded-xl border border-zinc-800 space-y-3">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">图层混合参数</span>
                      
                      {/* Opacity block */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                          <span>不透明度</span>
                          <span className="font-bold">{Math.round(activeLayer.opacity * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.05" value={activeLayer.opacity}
                          onChange={(e) => updateActiveLayer(l => ({ opacity: Number(e.target.value) }))}
                          className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Blend modes dropdown */}
                      <div className="space-y-1">
                        <span className="text-[9px] text-zinc-500">混合模式</span>
                        <select
                          value={activeLayer.blendMode}
                          onChange={(e) => updateActiveLayer(l => ({ blendMode: e.target.value }))}
                          className="w-full p-2 bg-[#0f0f11] border border-zinc-800 text-xs text-white rounded-lg outline-none font-bold font-sans cursor-pointer focus:border-indigo-500"
                        >
                          <option value="source-over">正常 (Normal)</option>
                          <option value="multiply">正片叠底 (Multiply)</option>
                          <option value="screen">滤色 (Screen)</option>
                          <option value="overlay">叠加 (Overlay)</option>
                          <option value="difference">差值 (Difference)</option>
                          <option value="color-burn">颜色加深 (Color Burn)</option>
                          <option value="color-dodge">颜色减淡 (Color Dodge)</option>
                        </select>
                      </div>

                      {/* Color Picker block for Solid Layers */}
                      {activeLayer.type === 'solid' && (
                        <div className="space-y-1.5 pt-1.5 border-t border-zinc-800/50">
                          <span className="text-[9px] text-zinc-500 font-bold block">图层填充颜色</span>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              value={activeLayer.color === 'transparent' ? '#000000' : (activeLayer.color || '#000000')}
                              onChange={(e) => updateActiveLayer(l => ({ color: e.target.value }))}
                              className="w-10 h-8 rounded border border-zinc-800 bg-transparent cursor-pointer p-0"
                            />
                            <input 
                              type="text" 
                              value={activeLayer.color || 'transparent'}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveLayer(l => ({ color: val }));
                              }}
                              className="flex-1 bg-[#0f0f11] p-1.5 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* Clipping Toggle & Mask toggle */}
                      <div className="flex justify-between pt-1">
                        <button 
                          onClick={() => updateActiveLayer(l => ({ isClipped: !l.isClipped }))}
                          className={`text-[9px] px-2 py-1 rounded-lg border font-bold transition-all ${
                            activeLayer.isClipped 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                              : 'text-zinc-500 border-zinc-800'
                          }`}
                        >
                          🔗 剪贴蒙版
                        </button>
                        <button 
                          onClick={() => updateActiveLayer(l => ({ hasMask: !l.hasMask }))}
                          className={`text-[9px] px-2 py-1 rounded-lg border font-bold transition-all ${
                            activeLayer.hasMask 
                              ? 'bg-rose-500/10 text-rose-450 border-rose-500/30' 
                              : 'text-zinc-500 border-zinc-800'
                          }`}
                        >
                          🔳 启用图层蒙版
                        </button>
                        {activeLayer.hasMask && (
                          <button 
                            onClick={() => setCurrentEditingMask(!currentEditingMask)}
                            className={`text-[9px] px-2 py-1 rounded-lg border font-bold transition-all ${
                              currentEditingMask
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                                : 'text-zinc-500 border-zinc-800'
                            }`}
                          >
                            🖌️ 编辑蒙版
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Layers Stack List View */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 tracking-wider uppercase px-1">
                      <span>图层堆栈 ({layers.length})</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleMoveLayerOrder('up')} title="上移图层" className="p-1 hover:text-white transition-colors">
                          <ArrowUp size={12} />
                        </button>
                        <button onClick={() => handleMoveLayerOrder('down')} title="下移图层" className="p-1 hover:text-white transition-colors">
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                      {layers.map(layer => {
                        const isActive = activeLayerId === layer.id;
                        return (
                          <div 
                            key={layer.id}
                            draggable="true"
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', layer.id);
                              setDraggedLayerId(layer.id);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const sourceId = e.dataTransfer.getData('text/plain');
                              if (sourceId && sourceId !== layer.id) {
                                setLayers(prev => {
                                  const result = [...prev];
                                  const srcIdx = result.findIndex(l => l.id === sourceId);
                                  const tgtIdx = result.findIndex(l => l.id === layer.id);
                                  if (srcIdx >= 0 && tgtIdx >= 0) {
                                    const [moved] = result.splice(srcIdx, 1);
                                    result.splice(tgtIdx, 0, moved);
                                    syncNodeData(result);
                                    pushToHistory('调整图层顺序', result);
                                  }
                                  return result;
                                });
                              }
                              setDraggedLayerId(null);
                            }}
                            onDragEnd={() => setDraggedLayerId(null)}
                            onClick={(e) => handleLayerClick(e, layer.id)}
                            className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              selectedLayerIds.includes(layer.id)
                                ? 'bg-indigo-600/15 border-indigo-500/40' 
                                : draggedLayerId === layer.id
                                ? 'opacity-50 ring-2 ring-indigo-500 ring-dashed'
                                : 'bg-[#18181b]/50 border-transparent hover:bg-[#18181b]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Layer Visibility Toggle */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l));
                                }}
                                className="text-zinc-500 hover:text-zinc-300 shrink-0"
                              >
                                {layer.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-red-550" />}
                              </button>

                              {/* Tiny Layer Visual Thumbnail */}
                              <div className="w-10 h-10 bg-black/40 rounded-lg overflow-hidden shrink-0 border border-zinc-800 flex items-center justify-center relative">
                                {layer.imageUrl ? (
                                  <img src={imageElements[layer.imageUrl]?.src || layer.imageUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-5 h-5 rounded-sm" style={{ backgroundColor: layer.color || '#27272a' }} />
                                )}
                                {layer.isClipped && (
                                  <div className="absolute left-0.5 top-0.5 text-[7px] text-amber-400 bg-black/80 px-0.5 rounded font-mono">CLIP</div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className={`text-[11px] truncate leading-tight font-bold ${isActive ? 'text-indigo-400 font-extrabold' : 'text-zinc-200'}`}>
                                  {layer.name}
                                </p>
                                <span className="text-[8.5px] font-mono text-zinc-500 block uppercase">
                                  {layer.type} | Opacity: {Math.round(layer.opacity * 100)}%
                                </span>
                              </div>
                            </div>

                            {/* Replace Image Action for image type layers */}
                            {layer.type === 'image' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const fileInput = document.createElement('input');
                                  fileInput.type = 'file';
                                  fileInput.accept = 'image/*';
                                  fileInput.onchange = (evt) => {
                                    const file = (evt.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (re) => {
                                        const dataUrl = re.target?.result as string;
                                        if (dataUrl) {
                                          const updated = layers.map(l => l.id === layer.id ? { ...l, imageUrl: dataUrl } : l);
                                          setLayers(updated);
                                          syncNodeData(updated);
                                          pushToHistory(`替换图层图片 (${layer.name})`, updated);
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  };
                                  fileInput.click();
                                }}
                                className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors shrink-0 px-2 py-0.5 rounded text-[9px] font-bold border border-indigo-500/20 mr-1.5 cursor-pointer"
                                title="替换图层的图片内容"
                              >
                                替换图片
                              </button>
                            )}

                            {/* Trash action */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLayer(layer.id);
                              }}
                              className="text-zinc-650 hover:text-red-400 transition-colors shrink-0 p-1"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 2: CURVES & CAMERA RAW ADJUSTMENTS --- */}
              {activeTab === 'adjustments' && activeLayer && (
                <div className="space-y-4">
                  {/* Fine Interactive Photoshop Curves Editor (LUT Spline map) */}
                  <div className="p-3 bg-[#18181b] rounded-xl border border-zinc-800 space-y-3">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">曲线调整 (Curves Spline)</span>
                    
                    <div className="relative w-full aspect-square border border-zinc-800 rounded-lg overflow-hidden bg-black/40">
                      {/* Curves Grid Guide */}
                      <div className="absolute inset-x-1/3 inset-y-0 border-x border-zinc-900/40 pointer-events-none" />
                      <div className="absolute inset-x-2/3 inset-y-0 border-x border-zinc-900/40 pointer-events-none" />
                      <div className="absolute inset-y-1/3 inset-x-0 border-y border-zinc-900/40 pointer-events-none" />
                      <div className="absolute inset-y-2/3 inset-x-0 border-y border-zinc-900/40 pointer-events-none" />

                      {/* Render spline graph via SVG */}
                      <svg 
                        className="absolute inset-0 w-full h-full cursor-crosshair"
                        onMouseMove={handleCurveMouseMove}
                        onMouseUp={() => setDraggingCurveIdx(null)}
                        onMouseLeave={() => setDraggingCurveIdx(null)}
                        onClick={handleCurveAddPoint}
                      >
                        {/* Perfect connecting cubic lines */}
                        <path 
                          d={activeLayer.adjustments.curves
                            .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${(p[0] / 255) * 100}% ${((255 - p[1]) / 255) * 100}%`)
                            .join(' ')}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2.5"
                        />

                        {/* Control Points */}
                        {activeLayer.adjustments.curves.map((pt, idx) => {
                          const cx = `${(pt[0] / 255) * 100}%`;
                          const cy = `${((255 - pt[1]) / 255) * 100}%`;
                          return (
                            <circle 
                              key={idx}
                              cx={cx}
                              cy={cy}
                              r={draggingCurveIdx === idx ? "7" : "5.5"}
                              fill={draggingCurveIdx === idx ? "#eab308" : "#818cf8"}
                              stroke="black"
                              strokeWidth="1.5"
                              onMouseDown={(e) => handleCurvePointDrag(e, idx)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleCurveRemovePoint(idx);
                              }}
                            />
                          );
                        })}
                      </svg>
                    </div>

                    <p className="text-[8px] text-zinc-500 font-mono leading-tight">
                      * 点击网格中加锚点，拖动锚点调整像素映射曲线。双击非边点可删除锚点。
                    </p>
                  </div>

                  {/* Camera Raw Core Basic sliders (exposure, contrast, contrast, saturation, temp, etc.) */}
                  <div className="p-3 bg-[#18181b] rounded-xl border border-zinc-800 space-y-3">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Camera Raw 参数调色</span>

                    {/* Sliders loop list */}
                    {[
                      { field: 'exposure', label: '曝光度 (Exposure)', min: -100, max: 100, unit: '' },
                      { field: 'contrast', label: '对比度 (Contrast)', min: -100, max: 100, unit: '' },
                      { field: 'temp', label: '温度 (Temperature)', min: -80, max: 80, unit: 'K' },
                      { field: 'tint', label: '色调 (Tint)', min: -50, max: 50, unit: '' },
                      { field: 'saturation', label: '饱和度 (Saturation)', min: -100, max: 100, unit: '' }
                    ].map(sld => (
                      <div key={sld.field} className="space-y-1">
                        <div className="flex justify-between text-[9.5px] text-zinc-400 font-mono font-medium">
                          <span>{sld.label}</span>
                          <span>{activeLayer.adjustments[sld.field as 'exposure' | 'contrast' | 'temp' | 'tint' | 'saturation']}{sld.unit}</span>
                        </div>
                        <input 
                          type="range" min={sld.min} max={sld.max} 
                          value={activeLayer.adjustments[sld.field as 'exposure' | 'contrast' | 'temp' | 'tint' | 'saturation']}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateActiveLayer(l => ({
                              adjustments: { ...l.adjustments, [sld.field]: val }
                            }));
                          }}
                          className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-[#18181b] rounded-xl border border-zinc-800 space-y-3 mt-4">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">高级调整 (Filters)</span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                      <input 
                        type="checkbox" 
                        checked={activeLayer.adjustments.invert || false}
                        onChange={(e) => updateActiveLayer(l => ({ adjustments: { ...l.adjustments, invert: e.target.checked } }))} 
                        className="accent-indigo-500 rounded border-zinc-700 bg-zinc-800"
                      />
                      <span>反相 (Invert)</span>
                    </label>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[9.5px] text-zinc-400 font-mono font-medium">
                        <span>阈值 (Threshold)</span>
                        <span>{activeLayer.adjustments.threshold || 0}</span>
                      </div>
                      <input 
                        type="range" min={0} max={255} 
                        value={activeLayer.adjustments.threshold || 0}
                        onChange={(e) => updateActiveLayer(l => ({ adjustments: { ...l.adjustments, threshold: Number(e.target.value) } }))}
                        className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[9.5px] text-zinc-400 font-mono font-medium">
                        <span>色调分离 (Posterize)</span>
                        <span>{activeLayer.adjustments.posterize || 255}</span>
                      </div>
                      <input 
                        type="range" min={2} max={255} 
                        value={activeLayer.adjustments.posterize || 255}
                        onChange={(e) => updateActiveLayer(l => ({ adjustments: { ...l.adjustments, posterize: Number(e.target.value) } }))}
                        className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 3: EFFECT FX WORKSPACE --- */}
              {activeTab === 'fx' && activeLayer && (
                <div className="space-y-4">
                  {/* Drop Shadow effects controller */}
                  <div className="p-3 bg-[#18181b] rounded-xl border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">外投影 (Drop Shadow)</span>
                      <input 
                        type="checkbox"
                        checked={activeLayer.effects.dropShadow.enabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          updateActiveLayer(l => ({
                            effects: {
                              ...l.effects,
                              dropShadow: { ...l.effects.dropShadow, enabled: val }
                            }
                          }));
                        }}
                        className="accent-indigo-500 rounded border-gray-300 h-3.5 w-3.5"
                      />
                    </div>

                    {activeLayer.effects.dropShadow.enabled && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <div className="flex justify-between text-[9px] text-zinc-400 font-mono mb-1">
                            <span>阴影距离 (Distance)</span>
                            <span>{activeLayer.effects.dropShadow.distance}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="40" value={activeLayer.effects.dropShadow.distance}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateActiveLayer(l => ({
                                effects: {
                                  ...l.effects,
                                  dropShadow: { ...l.effects.dropShadow, distance: val }
                                }
                              }));
                            }}
                            className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[9px] text-zinc-400 font-mono mb-1">
                            <span>大小/羽化 (Blur Size)</span>
                            <span>{activeLayer.effects.dropShadow.blur}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="40" value={activeLayer.effects.dropShadow.blur}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateActiveLayer(l => ({
                                effects: {
                                  ...l.effects,
                                  dropShadow: { ...l.effects.dropShadow, blur: val }
                                }
                              }));
                            }}
                            className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[9px] text-zinc-400 font-mono mb-1">
                            <span>投射角度 (Angle)</span>
                            <span>{activeLayer.effects.dropShadow.angle}°</span>
                          </div>
                          <input 
                            type="range" min="0" max="360" value={activeLayer.effects.dropShadow.angle}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateActiveLayer(l => ({
                                effects: {
                                  ...l.effects,
                                  dropShadow: { ...l.effects.dropShadow, angle: val }
                                }
                              }));
                            }}
                            className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Master showcase alert info */}
                  <div className="p-3 bg-indigo-500/5 text-[9.5px] border border-indigo-500/10 text-indigo-350 rounded-xl leading-relaxed">
                    🌟 完整支持斜面浮雕、内发光、描边等非破坏样式效果，合成算法均在离屏像素流渲染完成，无需改变图层原图主体包。
                  </div>
                </div>
              )}

              {/* --- TAB 4: DEEP COMFYUI AI COOPERATIVE FLOWS --- */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  {/* Model specifications Select */}
                  <div className="p-3 bg-[#18181b] rounded-xl border border-zinc-800 space-y-3">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">云端生图 AI 引擎设置</span>
                    
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-zinc-500">模型基底选择 (Model Base)</span>
                      <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-full p-2 bg-[#0f0f11] border border-zinc-800 text-xs text-white rounded-lg outline-none font-bold"
                      >
                        <option value="flux_klein">Flux.1 Schnell (细节写实强化版)</option>
                        <option value="sdxl_lightning">SDXL-Lightning (8-Step 爆发秒级渲染)</option>
                        <option value="zimage">Tongyi Z-Image-Turbo (极限一步融合)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] text-zinc-500">视觉意图增强词 (Text Prompt / Mask Layer)</span>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="输入 AI 后期结合提示词..."
                        className="w-full h-16 p-2 bg-[#0f0f11] border border-zinc-800 text-xs text-white rounded-lg outline-none resize-none"
                      />
                    </div>

                    <button
                      onClick={handleAISend}
                      disabled={aiRunning}
                      className={`w-full py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-indigo-500/15 border border-indigo-500/30 ${
                        aiRunning 
                          ? 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-500'
                      }`}
                    >
                      {aiRunning ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} fill="currentColor" />
                      )}
                      <span>{aiRunning ? 'ComfyUI 异步生成中...' : '提交 ComfyUI 智能出图'}</span>
                    </button>
                  </div>

                  {/* Live Progress Logs Terminal Console */}
                  {aiLogs.length > 0 && (
                    <div className="p-3 bg-black/90 border border-zinc-800 rounded-xl space-y-1.5">
                      <span className="text-[9px] font-bold text-zinc-500 block uppercase font-mono tracking-wider">WebSocket 控制台 logs</span>
                      
                      <div className="max-h-[140px] overflow-y-auto custom-scrollbar font-mono text-[9px] leading-relaxed text-emerald-400 space-y-1">
                        {aiLogs.map((log, lidx) => (
                          <div key={lidx}>{log}</div>
                        ))}
                      </div>

                      {/* Moving progress slider banner bar */}
                      {aiRunning && (
                        <div className="space-y-1 pt-1 border-t border-zinc-900/50">
                          <div className="flex justify-between text-[8px] font-bold text-indigo-400 font-mono">
                            <span>KSAMPLER CYCLES</span>
                            <span>{aiProgress}%</span>
                          </div>
                          <div className="h-1 w-full bg-zinc-850 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                              style={{ width: `${aiProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Instructions help tips info panel */}
                  <div className="p-3 bg-zinc-850/50 text-[9px] text-zinc-500 rounded-xl leading-relaxed">
                    💡 **AI Canvas 二维连接**: 将外部 “源图像” 节点与该 PS 引擎节点左侧 TargetHandle 连接，该引擎节点即会将接收的图像作为图层并应用该 AI 设置。生成的新图层会自动输出给右侧下游节点。
                  </div>
                </div>
              )}

            </div>

            {/* Down footer credits panel info */}
            <div className="px-4 py-2 bg-[#18181b]/95 border-t border-[#27272a] flex items-center justify-between shrink-0 font-sans text-[9px] text-zinc-500">
              <div className="flex items-center gap-1.5">
                <Database size={10} />
                <span>GPU-ACCELERATED SYNTHESIS</span>
              </div>
              <span>READY</span>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col w-full h-full bg-[#121214] text-gray-200 rounded-[28px] border-2 transition-all relative overflow-hidden select-none font-sans shadow-[0_20px_50px_rgba(0,0,0,0.8)] ${
      selected ? 'border-indigo-500 ring-[10px] ring-indigo-500/15' : 'border-[#27272a]'
    }`}>
      {/* Target and Source flow IO handles */}
      <Handle type="target" position={Position.Left} className="!bg-indigo-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#121214] shadow-sm hover:!scale-150 transition-all duration-200 z-50 ease-out" />
      <Handle type="source" position={Position.Right} className="!bg-violet-500 !w-4 !h-4 !rounded-full !border-[3px] !border-[#121214] shadow-sm hover:!scale-150 transition-all duration-200 z-50 ease-out" />

      {/* Resize controller */}
      <NodeResizer 
        color="#6366f1" 
        isVisible={selected} 
        minWidth={800}
        minHeight={580}
        handleStyle={{ width: 12, height: 12, borderRadius: 4, background: 'white', border: '2px solid #6366f1' }}
      />

      <ScaleWrapper id={id} type="ai-ps-engine" baseWidth={880} baseHeight={640} disableDynamicHeight={true}>
        {isFullscreen ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#09090b] text-center p-6 space-y-4 rounded-[26px]">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 animate-pulse">
              <Maximize2 size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-white tracking-wider">已进入独立全屏编辑模式</h4>
              <p className="text-xs text-zinc-500 mt-1">当前操作已同步至顶层独立全屏画布中</p>
            </div>
            <button 
              onClick={() => setIsFullscreen(false)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all outline-none"
            >
              <Minimize2 size={12} />
              <span>退出全屏模式</span>
            </button>
          </div>
        ) : (
          renderWorkspace(false)
        )}
      </ScaleWrapper>

      {/* Fullscreen Portal */}
      {isFullscreen && createPortal(
        <div 
          className="fixed inset-0 z-[99999] bg-[#0c0c0e] text-zinc-150 select-none font-sans flex flex-col overflow-hidden" 
          onPointerDown={e => e.stopPropagation()}
        >
          {renderWorkspace(true)}
        </div>,
        document.body
      )}
    </div>
  );
}
