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
  barTexture: BarTexture;
  inputFontSize: FontSize;
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
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: NodeType, x?: number, y?: number, data?: any) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  removeNode: (nodeId: string) => void;
  copySelectedNodes: () => void;
  pasteNodes: (position?: { x: number; y: number }) => void;
  getIncomingData: (nodeId: string) => any[];
  clearCanvas: () => void;
  addChatMessage: (message: ChatMessage) => void;
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
        barTexture: "frosted",
        inputFontSize: "medium",
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
      onNodesChange: (changes: NodeChange[]) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
      },
      onEdgesChange: (changes: EdgeChange[]) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },
      onConnect: (connection: Connection) => {
        set({
          edges: addEdge(connection, get().edges),
        });
      },
      addNode: (type, x = 100, y = 100, data = {}) => {
        const newNode: Node = {
          id: generateId(),
          type,
          position: { x, y },
          data: { ...data },
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
        set({
          nodes: get().nodes.filter((node) => node.id !== nodeId),
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
        set({ nodes: [], edges: [] });
      },
      addChatMessage: (message) => {
        set({ chatHistory: [...get().chatHistory, message] });
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
          set({ copiedNodes: selectedNodes });
          // Write a marker to clipboard to indicate nodes were copied last
          try {
            navigator.clipboard.writeText("__FLUX_NODES_DATA__");
          } catch (err) {
            console.warn("Failed to write node marker to clipboard", err);
          }
        }
      },
      pasteNodes: (position) => {
        const { copiedNodes, nodes } = get();
        if (copiedNodes.length === 0) return;

        // Calculate the bounding box of copied nodes to offset them relative to the paste position if provided
        const minX = Math.min(...copiedNodes.map((n) => n.position.x));
        const minY = Math.min(...copiedNodes.map((n) => n.position.y));

        const newNodes = copiedNodes.map((node) => ({
          ...node,
          id: generateId(),
          selected: true,
          position: position
            ? {
                x: position.x + (node.position.x - minX),
                y: position.y + (node.position.y - minY),
              }
            : { x: node.position.x + 40, y: node.position.y + 40 },
        }));

        // Deselect current nodes and select new ones
        const updatedNodes = nodes
          .map((n) => ({ ...n, selected: false }))
          .concat(newNodes);
        set({ nodes: updatedNodes });
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
