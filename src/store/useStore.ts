import { create } from "zustand";
import { persist, StateStorage, createJSONStorage } from "zustand/middleware";
import { useShallow } from 'zustand/react/shallow';
import { get, set as idbSet, del } from 'idb-keyval';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await idbSet(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};


export type NodeType =
  | "image"
  | "text"
  | "prompt-engine"
  | "image-gen"
  | "output"
  | "text-gen"
  | "image-source"
  | "text-source"
  | "logic-engine"
  | "translate-engine"
  | "fusion-master"
  | "spatial-view"
  | "comfy_web_bridge"
  | "double-box-transform";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: any[];
  feedback?: "like" | "dislike" | null;
}

export type MouseSize = "small" | "medium" | "large";
export type AppTheme = "dark" | "mist" | "light";
export type BarTexture = "transparent" | "frosted";
export type FontSize = "small" | "medium" | "large" | number;
export type UploadQuality = "standard" | "high" | "original";
export type MultiSelectMode = "longPress" | "click" | "disabled";

export interface ApiSettings {
  engine:
    | "gemini"
    | "openai"
    | "claude"
    | "doubao"
    | "qianwen"
    | "deepseek"
    | "custom";
  baseUrl: string;
  apiKey: string;
  modelId: string;
  isCustom: boolean;

  // Image generation
  imageEngine: "online" | "comfyui";
  imageModel:
    | "Nano Banana Pro"
    | "Nano Banana 2"
    | "chatgptimage2"
    | "SDXL"
    | "custom";
  comfyUrl: string;
}

export interface AppSettings {
  // General
  mouseSize: MouseSize;
  theme: AppTheme;
  themeColor: string;
  barTexture: BarTexture;
  inputFontSize: FontSize;
  nodeUiFontSize?: number;
  uploadQuality: UploadQuality;

  // Canvas & Alignment
  highlightAssociated: boolean;
  highlightColor: string;
  showConnections: boolean;
  snapToGuidelines: boolean;
  snapToGrid: boolean;
  multiSelectAlignmentMode: MultiSelectMode;
  alignmentSpacing: number;

  // File & Save
  projectPath: string;
  dataPath: string;
  outputPath: string;

  // API
  apiSettings: ApiSettings;
}

export interface FileItem {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "other";
  url: string;
  createdAt: number;
  size?: number;
  folderId?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  path?: string;
  parentId?: string;
  isOpen?: boolean;
}

export interface AppState {
  nodes: Node[];
  edges: Edge[];
  chatHistory: ChatMessage[];
  isGridVisible: boolean;
  isMiniMapVisible: boolean;
  showAssistant: boolean;
  showFileManager: boolean;
  fileManagerWidth: number;
  files: FileItem[];
  folders: FolderItem[];
  materials: FileItem[];
  settings: AppSettings;
  copiedNodes: Node[];
  copiedEdges: Edge[];
  undoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  redoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: NodeType, x?: number, y?: number, data?: any, customId?: string) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  removeNode: (nodeId: string) => void;
  copySelectedNodes: () => void;
  pasteNodes: (position?: { x: number; y: number }) => void;
  getIncomingData: (nodeId: string) => any[];
  clearCanvas: () => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatHistory: (history: ChatMessage[]) => void;
  toggleGrid: () => void;
  toggleMiniMap: () => void;
  toggleAssistant: () => void;
  toggleFileManager: () => void;
  setFileManagerWidth: (width: number) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addFile: (file: Omit<FileItem, "id" | "createdAt">) => void;
  addMaterial: (material: Omit<FileItem, "id" | "createdAt">) => void;
  clearFolderMaterials: (folderId: string) => void;
  addFolder: (
    name: string,
    path?: string,
    parentId?: string,
    id?: string,
  ) => void;
  removeFile: (id: string, isMaterial?: boolean) => void;
  removeFolder: (id: string) => void;
  updateFolder: (id: string, updates: Partial<FolderItem>) => void;
  toggleFolder: (id: string) => void;
  groupSelectedNodes: (name?: string) => void;
  ungroupNode: (groupNodeId: string) => void;
  setNodes: (nodes: Node[]) => void;
}

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      chatHistory: [],
      copiedEdges: [],
      undoStack: [],
      redoStack: [],
      isGridVisible: true,
      isMiniMapVisible: true,
      showAssistant: true,
      showFileManager: false,
      fileManagerWidth: 320,
      files: [
        {
          id: "1",
          name: "Portrait of a cat",
          type: "image",
          url: "https://picsum.photos/seed/cat/800/800",
          createdAt: Date.now() - 3600000,
        },
        {
          id: "2",
          name: "Cyberpunk City",
          type: "image",
          url: "https://picsum.photos/seed/city/800/800",
          createdAt: Date.now() - 7200000,
        },
        {
          id: "3",
          name: "Mountain Sunset",
          type: "image",
          url: "https://picsum.photos/seed/mountain/800/800",
          createdAt: Date.now() - 10800000,
        },
      ],
      folders: [
        {
          id: "folder-1",
          name: "Character",
          path: "C:\\AI\\Assets\\Characters",
        },
        { id: "folder-2", name: "Scene", path: "C:\\AI\\Assets\\Scenes" },
        { id: "folder-3", name: "Item", path: "C:\\AI\\Assets\\Items" },
        { id: "folder-4", name: "Style", path: "C:\\AI\\Assets\\Styles" },
        {
          id: "folder-5",
          name: "Sound Effect",
          path: "C:\\AI\\Assets\\Sounds",
        },
        { id: "folder-6", name: "Others", path: "C:\\AI\\Assets\\Misc" },
      ],
      materials: [
        {
          id: "m1",
          name: "Hero Character",
          type: "image",
          url: "https://picsum.photos/seed/hero/400/400",
          createdAt: Date.now(),
          folderId: "folder-1",
        },
        {
          id: "m2",
          name: "Dark Forest",
          type: "image",
          url: "https://picsum.photos/seed/forest/400/400",
          createdAt: Date.now(),
          folderId: "folder-2",
        },
      ],
      settings: {
        mouseSize: "medium",
        theme: "dark",
        themeColor: "#3b82f6",
        barTexture: "frosted",
        inputFontSize: "medium",
        nodeUiFontSize: 14,
        uploadQuality: "standard",
        highlightAssociated: true,
        highlightColor: "#3b82f6",
        showConnections: true,
        snapToGuidelines: true,
        snapToGrid: false,
        multiSelectAlignmentMode: "click",
        alignmentSpacing: 40,
        projectPath:
          "F:\\BaiduNetdiskDownload\\无限画布\\AI CanvasPro\\Data\\projects",
        dataPath:
          "F:\\BaiduNetdiskDownload\\无限画布\\AI CanvasPro\\Data\\data",
        outputPath:
          "F:\\BaiduNetdiskDownload\\无限画布\\AI CanvasPro\\Data\\output",
        apiSettings: {
          engine: "gemini",
          baseUrl: "https://generativelanguage.googleapis.com",
          apiKey: "",
          modelId: "gemini-1.5-flash",
          isCustom: false,
          imageEngine: "online",
          imageModel: "Nano Banana Pro",
          comfyUrl: "http://127.0.0.1:8188",
        },
      },
      takeSnapshot: () => {
        const { nodes, edges, undoStack } = get();
        const nodesSnapshot = JSON.parse(JSON.stringify(nodes));
        const edgesSnapshot = JSON.parse(JSON.stringify(edges));
        set({
          undoStack: [...undoStack, { nodes: nodesSnapshot, edges: edgesSnapshot }].slice(-50),
          redoStack: [],
        });
      },
      undo: () => {
        const { undoStack, redoStack, nodes, edges } = get();
        if (undoStack.length === 0) return;
        const previous = undoStack[undoStack.length - 1];
        const newUndoStack = undoStack.slice(0, -1);
        const nodesSnapshot = JSON.parse(JSON.stringify(nodes));
        const edgesSnapshot = JSON.parse(JSON.stringify(edges));
        set({
          nodes: previous.nodes,
          edges: previous.edges,
          undoStack: newUndoStack,
          redoStack: [...redoStack, { nodes: nodesSnapshot, edges: edgesSnapshot }].slice(-50),
        });
      },
      redo: () => {
        const { undoStack, redoStack, nodes, edges } = get();
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        const newRedoStack = redoStack.slice(0, -1);
        const nodesSnapshot = JSON.parse(JSON.stringify(nodes));
        const edgesSnapshot = JSON.parse(JSON.stringify(edges));
        set({
          nodes: next.nodes,
          edges: next.edges,
          undoStack: [...undoStack, { nodes: nodesSnapshot, edges: edgesSnapshot }].slice(-50),
          redoStack: newRedoStack,
        });
      },
      onNodesChange: (changes: NodeChange[]) => {
        const hasRemoval = changes.some((c) => c.type === "remove");
        if (hasRemoval) {
          get().takeSnapshot();
        }
        
        let updatedNodes = get().nodes;
        const removals = changes.filter(c => c.type === "remove") as Array<{ type: "remove"; id: string }>;
        
        if (removals.length > 0) {
          removals.forEach(change => {
            const removedNode = get().nodes.find(n => n.id === change.id);
            if (removedNode && (removedNode.type === "group-node" || removedNode.type === "group")) {
              // Convert child node coordinates back to absolute space
              updatedNodes = updatedNodes.map(node => {
                if (node.parentId === change.id) {
                  return {
                    ...node,
                    parentId: undefined,
                    position: {
                      x: removedNode.position.x + node.position.x,
                      y: removedNode.position.y + node.position.y,
                    },
                  };
                }
                return node;
              });
            }
          });
        }

        set({
          nodes: applyNodeChanges(changes, updatedNodes),
        });
      },
      onEdgesChange: (changes: EdgeChange[]) => {
        const hasRemoval = changes.some((c) => c.type === "remove");
        if (hasRemoval) {
          get().takeSnapshot();
        }
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },
      onConnect: (connection: Connection) => {
        get().takeSnapshot();
        set({
          edges: addEdge(connection, get().edges),
        });
      },
      addNode: (type, x = 100, y = 100, data = {}, customId?: string) => {
        get().takeSnapshot();
        const style: any = {};
        if (data && data.style) {
          Object.assign(style, data.style);
          delete data.style;
        } else {
          if (data && data.initialWidth) {
            style.width = data.initialWidth;
            delete data.initialWidth;
          }
          if (data && data.initialHeight) {
            style.height = data.initialHeight;
            delete data.initialHeight;
          }
        }
        const newNode: Node = {
          id: customId || generateId(),
          type,
          position: { x, y },
          data: { ...data },
          style: Object.keys(style).length > 0 ? style : undefined,
        };
        set({ nodes: [...get().nodes, newNode] });
      },
      updateNodeData: (nodeId, data) => {
        set({
          nodes: get().nodes.map((node) => {
            if (node.id === nodeId) {
              return { ...node, data: { ...node.data, ...data } };
            }
            return node;
          }),
        });
      },
      removeNode: (nodeId) => {
        get().takeSnapshot();
        const removedNode = get().nodes.find((n) => n.id === nodeId);
        let updatedNodes = get().nodes.filter((node) => node.id !== nodeId);
        
        if (removedNode && (removedNode.type === "group-node" || removedNode.type === "group")) {
          // Convert child node coordinates back to absolute space
          updatedNodes = updatedNodes.map((node) => {
            if (node.parentId === nodeId) {
              return {
                ...node,
                parentId: undefined,
                position: {
                  x: removedNode.position.x + node.position.x,
                  y: removedNode.position.y + node.position.y,
                },
              };
            }
            return node;
          });
        }

        set({
          nodes: updatedNodes,
          edges: get().edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId,
          ),
        });
      },
      getIncomingData: (nodeId: string) => {
        const { nodes, edges } = get();
        const incomingEdges = edges.filter((e) => e.target === nodeId);
        const incomingData = incomingEdges.map((e) => {
          const sourceNode = nodes.find((n) => n.id === e.source);
          return sourceNode?.data;
        });
        return incomingData;
      },
      clearCanvas: () => {
        get().takeSnapshot();
        set({ nodes: [], edges: [] });
      },
      addChatMessage: (message) => {
        set({ chatHistory: [...get().chatHistory, message] });
      },
      setChatHistory: (history) => {
        set({ chatHistory: history });
      },
      toggleGrid: () => set({ isGridVisible: !get().isGridVisible }),
      toggleMiniMap: () => set({ isMiniMapVisible: !get().isMiniMapVisible }),
      toggleAssistant: () => set({ showAssistant: !get().showAssistant }),
      toggleFileManager: () => set({ showFileManager: !get().showFileManager }),
      setFileManagerWidth: (width: number) => set({ fileManagerWidth: width }),
      updateSettings: (newSettings) => {
        set({
          settings: { ...get().settings, ...newSettings },
        });
      },
      copiedNodes: [],
      copySelectedNodes: () => {
        const selectedNodes = get().nodes.filter((node) => node.selected);
        if (selectedNodes.length > 0) {
          const selectedNodeIds = selectedNodes.map((n) => n.id);
          const relatedEdges = get().edges.filter(
            (edge) => selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)
          );
          set({
            copiedNodes: selectedNodes,
            copiedEdges: relatedEdges,
          });
          // Write a marker to clipboard to indicate nodes were copied last
          try {
            navigator.clipboard.writeText("__FLUX_NODES_DATA__");
          } catch (err) {
            console.warn("Failed to write node marker to clipboard", err);
          }
        }
      },
      pasteNodes: (position) => {
        const { copiedNodes, copiedEdges, nodes, edges } = get();
        if (copiedNodes.length === 0) return;

        get().takeSnapshot();

        // Calculate the bounding box of copied nodes to offset them relative to the paste position if provided
        const minX = Math.min(...copiedNodes.map((n) => n.position.x));
        const minY = Math.min(...copiedNodes.map((n) => n.position.y));

        const idMap: Record<string, string> = {};

        const newNodes = copiedNodes.map((node) => {
          const newId = generateId();
          idMap[node.id] = newId;
          return {
            ...node,
            id: newId,
            selected: true,
            position: position
              ? {
                  x: position.x + (node.position.x - minX),
                  y: position.y + (node.position.y - minY),
                }
              : { x: node.position.x + 40, y: node.position.y + 40 },
          };
        });

        // Map copied edges to the new node IDs
        const newEdges = (copiedEdges || []).map((edge) => {
          return {
            ...edge,
            id: generateId(),
            source: idMap[edge.source] || edge.source,
            target: idMap[edge.target] || edge.target,
          };
        });

        // Deselect current nodes and select new ones
        const updatedNodes = nodes
          .map((n) => ({ ...n, selected: false }))
          .concat(newNodes);

        const updatedEdges = edges.concat(newEdges);

        set({ nodes: updatedNodes, edges: updatedEdges });
      },
      addFile: (file) => {
        const newFile: FileItem = {
          ...file,
          id: generateId(),
          createdAt: Date.now(),
        };
        set({ files: [newFile, ...get().files] });
      },
      addMaterial: (material) => {
        const newMaterial: FileItem = {
          ...material,
          id: generateId(),
          createdAt: Date.now(),
        };
        set({ materials: [newMaterial, ...get().materials] });
      },
      clearFolderMaterials: (folderId) => {
        set({
          materials: get().materials.filter((m) => m.folderId !== folderId),
        });
      },
      addFolder: (name, path, parentId, id) => {
        const newFolder: FolderItem = {
          id: id || generateId(),
          name,
          path,
          parentId,
          isOpen: false,
        };
        set({ folders: [...get().folders, newFolder] });
      },
      removeFile: (id, isMaterial) => {
        if (isMaterial) {
          set({ materials: get().materials.filter((f) => f.id !== id) });
        } else {
          set({ files: get().files.filter((f) => f.id !== id) });
        }
      },
      removeFolder: (id) => {
        set({
          folders: get().folders.filter((f) => f.id !== id),
          materials: get().materials.filter((m) => m.folderId !== id),
        });
      },
      toggleFolder: (id) => {
        set({
          folders: get().folders.map((f) =>
            f.id === id ? { ...f, isOpen: !f.isOpen } : f,
          ),
        });
      },
      updateFolder: (id, updates) => {
        set({
          folders: get().folders.map((f) =>
            f.id === id ? { ...f, ...updates } : f,
          ),
        });
      },
      groupSelectedNodes: (name?: string) => {
        const { nodes } = get();
        // Only group selected nodes that are NOT group-nodes
        const selectedNodes = nodes.filter((node) => node.selected && node.type !== "group-node");
        if (selectedNodes.length === 0) return;

        get().takeSnapshot();

        const getNodeDimensions = (node: any) => {
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
            case "text-source":
              return { width: 300, height: 350 };
            case "reverse":
              return { width: 320, height: 450 };
            case "double-box-transform":
              return { width: 680, height: 500 };
            case "translate-engine":
            case "logic-engine":
              return { width: 400, height: 500 };
            default:
              return { width: 300, height: 400 };
          }
        };

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        selectedNodes.forEach((node) => {
          const { width, height } = getNodeDimensions(node);
          let absX = node.position.x;
          let absY = node.position.y;
          if (node.parentId) {
            const parent = nodes.find((n) => n.id === node.parentId);
            if (parent) {
              absX += parent.position.x;
              absY += parent.position.y;
            }
          }
          minX = Math.min(minX, absX);
          minY = Math.min(minY, absY);
          maxX = Math.max(maxX, absX + width);
          maxY = Math.max(maxY, absY + height);
        });

        const groupNodeId = "group-" + generateId();
        const offsetX = 45;
        const offsetY = 70;
        
        const groupWidth = (maxX - minX) + 90;
        const groupHeight = (maxY - minY) + 115;
        
        const groupPosition = { x: minX - offsetX, y: minY - offsetY };

        const groupNode: Node = {
          id: groupNodeId,
          type: "group-node",
          position: groupPosition,
          style: {
            width: groupWidth,
            height: groupHeight,
          },
          data: {
            label: name || "G",
          },
        };

        const updatedNodes = get().nodes.map((node) => {
          const isSelectedTarget = selectedNodes.some(sn => sn.id === node.id);
          if (isSelectedTarget) {
            let absX = node.position.x;
            let absY = node.position.y;
            if (node.parentId) {
              const parent = nodes.find((n) => n.id === node.parentId);
              if (parent) {
                absX += parent.position.x;
                absY += parent.position.y;
              }
            }

            return {
              ...node,
              parentId: groupNodeId,
              position: {
                x: absX - groupPosition.x,
                y: absY - groupPosition.y,
              },
              selected: false,
            };
          }
          return node;
        });

        set({
          nodes: [groupNode, ...updatedNodes],
        });
      },
      ungroupNode: (groupNodeId: string) => {
        const { nodes } = get();
        const groupNode = nodes.find((n) => n.id === groupNodeId);
        if (!groupNode) return;

        get().takeSnapshot();

        const updatedNodes = nodes
          .filter((n) => n.id !== groupNodeId)
          .map((node) => {
            if (node.parentId === groupNodeId) {
              return {
                ...node,
                parentId: undefined,
                position: {
                  x: groupNode.position.x + node.position.x,
                  y: groupNode.position.y + node.position.y,
                },
              };
            }
            return node;
          });

        set({ nodes: updatedNodes });
      },
      setNodes: (nodes) => {
        set({ nodes });
      },
    }),
    {
      name: "fusion-flow-storage",
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        settings: state.settings,
        files: state.files,
        materials: state.materials,
        folders: state.folders,
      }),
    },
  ),
);

export const useNodeIncomingData = (nodeId: string) => {
  return useStore(useShallow((state) => {
    const incomingEdges = state.edges.filter((e) => e.target === nodeId);
    return incomingEdges.map(
      (e) => state.nodes.find((n) => n.id === e.source)?.data,
    );
  }));
};
