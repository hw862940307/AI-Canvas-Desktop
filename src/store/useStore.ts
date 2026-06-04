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
  | "apt-web-tool"
  | "io-image-list"
  | "reverse"
  | "ms-gen"
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

  // New fields
  universalProvider?: string;
  rhEnterpriseKey?: string;
  rhConsumerKey?: string;
  rhAppId?: string;
  rhApps?: Array<{ id: string; name: string }>;
  jimengApiKey?: string;
  comfyLauncherPath?: string;
  comfyWorkflowPath?: string;
  comfyWorkflows?: string[];
  comfyInstances?: string[];
  comfyWorkflowsDetails?: Array<{
    id: string;
    name: string;
    size?: string;
    date?: string;
    content?: string;
    isCustom?: boolean;
    enableParams?: boolean;
    exposedFields?: Array<{
      nodeId: string;
      classType: string;
      fieldKey: string;
      fieldValue: any;
      enabled: boolean;
      label?: string;
      type?: string;
      min?: number;
      max?: number;
      step?: number;
      options?: string[];
      random_enabled?: boolean;
    }>;
  }>;
  profiles?: Array<{
    id: string;
    name: string;
    engine: "gemini" | "openai" | "claude" | "doubao" | "qianwen" | "deepseek" | "custom";
    baseUrl: string;
    apiKey: string;
    modelId: string;
  }>;
  activeProfileId?: string;
  // ModelScope specific fields
  modelscopeApiKey?: string;
  modelscopeBaseUrl?: string;
  modelscopeModelUrl?: string;
  modelscopeImageModels?: string[];
  modelscopeChatModels?: string[];
  modelscopeSelectedImageModel?: string;
  modelscopeSelectedChatModel?: string;
  modelscopeLoraEnabled?: boolean;
  modelscopeLoraModelId?: string;
  modelscopeLoraWeight?: number;
  modelscopeLoraTriggerWord?: string;
  modelscopeLoraVersion?: string;
  modelscopeLoras?: Array<{ id: string; modelId: string; weight: number; triggerWord?: string; version?: string }>;
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

export const getFreshWf4Content = (): string => {
  return `{
  "81": {
    "inputs": {
      "image": "29391d7fb549df10b1eec3de27791ca7.jpg"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "加载图像"
    }
  },
  "104": {
    "inputs": {
      "unet_name": [
        "461",
        0
      ],
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "UNET加载器"
    }
  },
  "105": {
    "inputs": {
      "vae_name": "flux2-vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "VAE加载器"
    }
  },
  "111": {
    "inputs": {
      "clip_name": "qwen_3_8b_fp8mixed.safetensors",
      "type": "flux2",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "CLIP加载器"
    }
  },
  "168": {
    "inputs": {
      "instruction": ""
    },
    "class_type": "Flux2KleinModelConfig_EditUtils",
    "_meta": {
      "title": "EditUtils: Flux2Klein Model Config lrzjason"
    }
  },
  "170": {
    "inputs": {
      "prompt": [
        "362",
        0
      ],
      "clip": [
        "111",
        0
      ],
      "vae": [
        "105",
        0
      ],
      "model_config": [
        "168",
        0
      ],
      "configs": [
        "397",
        0
      ]
    },
    "class_type": "EditTextEncode_EditUtils",
    "_meta": {
      "title": "EditUtils: EditTextEncode lrzjason"
    }
  },
  "171": {
    "inputs": {
      "min_size": 1344,
      "max_size": 1536,
      "image": [
        "452",
        0
      ]
    },
    "class_type": "AdaptiveLongestEdge_EditUtils",
    "_meta": {
      "title": "EditUtils: Adaptive Longest Edge lrzjason"
    }
  },
  "362": {
    "inputs": {
      "value": [
        "453",
        0
      ]
    },
    "class_type": "PrimitiveStringMultiline",
    "_meta": {
      "title": "字符串（多行）"
    }
  },
  "375": {
    "inputs": {
      "custom_output": [
        "170",
        2
      ]
    },
    "class_type": "Flux2KleinOutputExtractor_EditUtils",
    "_meta": {
      "title": "EditUtils: Flux2Klein Output Extractor lrzjason"
    }
  },
  "378": {
    "inputs": {
      "pad_info": [
        "375",
        0
      ],
      "image": [
        "170",
        3
      ]
    },
    "class_type": "CropWithPadInfo_EditUtils",
    "_meta": {
      "title": "EditUtils: Crop With Pad Info lrzjason"
    }
  },
  "397": {
    "inputs": {
      "to_ref": true,
      "ref_main_image": true,
      "ref_longest_edge": [
        "171",
        0
      ],
      "ref_crop": "pad",
      "ref_upscale": "lanczos",
      "image": [
        "452",
        0
      ]
    },
    "class_type": "Flux2KleinConfigPreparer_EditUtils",
    "_meta": {
      "title": "EditUtils: Flux2Klein Config Preparer lrzjason"
    }
  },
  "414": {
    "inputs": {
      "lora_name": [
        "462",
        0
      ],
      "strength_model": [
        "455",
        0
      ],
      "model": [
        "104",
        0
      ]
    },
    "class_type": "LoraLoaderModelOnly",
    "_meta": {
      "title": "LoRA加载器(仅模型)"
    }
  },
  "422": {
    "inputs": {
      "conditioning": [
        "170",
        0
      ]
    },
    "class_type": "ConditioningZeroOut",
    "_meta": {
      "title": "条件零化"
    }
  },
  "436": {
    "inputs": {
      "pad_info": [
        "375",
        0
      ],
      "image": [
        "451",
        0
      ]
    },
    "class_type": "CropWithPadInfo_EditUtils",
    "_meta": {
      "title": "EditUtils: Crop With Pad Info lrzjason"
    }
  },
  "445": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": [
        "436",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  },
  "448": {
    "inputs": {
      "seed": [
        "464",
        0
      ],
      "steps": 4,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "simple",
      "denoise": 1,
      "model": [
        "414",
        0
      ],
      "positive": [
        "170",
        0
      ],
      "negative": [
        "422",
        0
      ],
      "latent_image": [
        "450",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "K采样器"
    }
  },
  "449": {
    "inputs": {
      "image": [
        "170",
        3
      ]
    },
    "class_type": "GetImageSize",
    "_meta": {
      "title": "获取图像尺寸"
    }
  },
  "450": {
    "inputs": {
      "width": [
        "449",
        0
      ],
      "height": [
        "449",
        1
      ],
      "batch_size": 1
    },
    "class_type": "EmptyFlux2LatentImage",
    "_meta": {
      "title": "空Latent图像（Flux2）"
    }
  },
  "451": {
    "inputs": {
      "samples": [
        "448",
        0
      ],
      "vae": [
        "105",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE解码"
    }
  },
  "452": {
    "inputs": {
      "hint": "图片",
      "options": "",
      "image_index": 1,
      "order": 0,
      "value": [
        "81",
        0
      ]
    },
    "class_type": "WanvasExpose",
    "_meta": {
      "title": "参考图"
    }
  },
  "453": {
    "inputs": {
      "hint": "自动",
      "options": "",
      "image_index": 1,
      "order": 4,
      "value": [
        "454",
        0
      ]
    },
    "class_type": "WanvasExpose",
    "_meta": {
      "title": "提示词"
    }
  },
  "454": {
    "inputs": {
      "value": ""
    },
    "class_type": "PrimitiveStringMultiline",
    "_meta": {
      "title": "字符串（多行）"
    }
  },
  "455": {
    "inputs": {
      "hint": "自动",
      "options": "",
      "image_index": 1,
      "order": 3,
      "value": [
        "456",
        0
      ]
    },
    "class_type": "WanvasExpose",
    "_meta": {
      "title": "LoRA强度"
    }
  },
  "456": {
    "inputs": {
      "value": 0.8
    },
    "class_type": "easy float",
    "_meta": {
      "title": "浮点数"
    }
  },
  "459": {
    "inputs": {
      "anything": [
        "436",
        0
      ]
    },
    "class_type": "easy cleanGpuUsed",
    "_meta": {
      "title": "清理GPU占用"
    }
  },
  "460": {
    "inputs": {
      "rgthree_comparer": {
        "images": [
          {
            "name": "A",
            "selected": true,
            "url": "/api/view?filename=rgthree.compare._temp_mqccs_00003_.png&type=temp&subfolder=&rand=0.847930553691964"
          },
          {
            "name": "B",
            "selected": true,
            "url": "/api/view?filename=rgthree.compare._temp_mqccs_00004_.png&type=temp&subfolder=&rand=0.9423600929456976"
          }
        ]
      },
      "image_a": [
        "436",
        0
      ],
      "image_b": [
        "81",
        0
      ]
    },
    "class_type": "Image Comparer (rgthree)",
    "_meta": {
      "title": "图像对比"
    }
  },
  "461": {
    "inputs": {
      "hint": "模型",
      "options": "flux-2-klein-9b-fp8.safetensors\\nFlux2-Klein-9B-True-v2-fp8mixed.safetensors",
      "image_index": 1,
      "order": 1
    },
    "class_type": "WanvasExpose",
    "_meta": {
      "title": "模型"
    }
  },
  "462": {
    "inputs": {
      "hint": "枚举",
      "options": "f2k_9B_lcs_consist_20260415.safetensors\\nF2K_9b-图像融合fusion2250.safetensors\\nFlux2-Klein-9B-一致性V2.safetensors",
      "image_index": 1,
      "order": 2
    },
    "class_type": "WanvasExpose",
    "_meta": {
      "title": "LoRA（超强一致性请用默认lora）"
    }
  },
  "464": {
    "inputs": {
      "hint": "随机整数",
      "options": "",
      "image_index": 1,
      "order": 5,
      "value": [
        "466",
        0
      ]
    },
    "class_type": "WanvasExpose",
    "_meta": {
      "title": "随机值"
    }
  },
  "466": {
    "inputs": {
      "value": 906789853459692
    },
    "class_type": "PrimitiveInt",
    "_meta": {
      "title": "整数"
    }
  }
}`;
};

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
          profiles: [
            { id: "gemini", name: "Gemini 官方", engine: "gemini", baseUrl: "https://generativelanguage.googleapis.com", apiKey: "", modelId: "gemini-2.5-flash" },
            { id: "openai", name: "OpenAI 官方", engine: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", modelId: "gpt-4o-mini" },
            { id: "claude", name: "Claude 官方", engine: "claude", baseUrl: "https://api.openai.com/v1", apiKey: "", modelId: "claude-3-5-sonnet-20241022" },
            { id: "deepseek", name: "DeepSeek 官方", engine: "deepseek", baseUrl: "https://api.deepseek.com", apiKey: "", modelId: "deepseek-chat" },
            { id: "doubao", name: "火山引擎 (豆包)", engine: "doubao", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", apiKey: "", modelId: "doubao-pro-32k" },
            { id: "qianwen", name: "通义千问", engine: "qianwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", apiKey: "", modelId: "qwen-max" }
          ],
          activeProfileId: "gemini",
          imageEngine: "online",
          imageModel: "Nano Banana Pro",
          comfyUrl: "http://127.0.0.1:8188",
          universalProvider: "OpenAI",
          rhEnterpriseKey: "",
          rhConsumerKey: "",
          rhAppId: "暂无AI应用",
          rhApps: [
            { id: "text-2-image-v2", name: "全能文生图 V2" },
            { id: "style-ref-v1", name: "风格参考设计" },
            { id: "all-in-one-image", name: "全能图片生成器" }
          ],
          jimengApiKey: "",
          modelscopeApiKey: "",
          modelscopeBaseUrl: "https://api-inference.modelscope.cn/v1",
          modelscopeModelUrl: "https://api-inference.modelscope.cn/v1/models",
          modelscopeImageModels: [
            "Tongyi-MAI/Z-Image-Turbo",
            "Qwen/Qwen-Image-2512",
            "Qwen/Qwen-Image-Edit-2511",
            "black-forest-labs/FLUX.2-klein-9B"
          ],
          modelscopeChatModels: [
            "Qwen/Qwen3-235B-A22B",
            "Qwen/Qwen3-VL-235B-A22B-Instruct",
            "MiniMax/MiniMax-M2.7:MiniMax"
          ],
          modelscopeSelectedImageModel: "Tongyi-MAI/Z-Image-Turbo",
          modelscopeSelectedChatModel: "Qwen/Qwen3-235B-A22B",
          modelscopeLoraEnabled: false,
          modelscopeLoraModelId: "",
          modelscopeLoraWeight: 0.8,
          modelscopeLoraTriggerWord: "",
          modelscopeLoraVersion: "v1.0",
          modelscopeLoras: [
            { id: "Daniel8152/film", modelId: "Qwen/Qwen-Image-2512", weight: 0.8 },
            { id: "Daniel8152/Qwen-Image-2512-Film", modelId: "Tongyi-MAI/Z-Image-Turbo", weight: 0.8 },
            { id: "Daniel8152/Klein-enhance", modelId: "black-forest-labs/FLUX.2-klein-9B", weight: 0.8 }
          ],
          comfyLauncherPath: "E:\\BaiduNetdiskDownload\\ComfyUI-aki-v2\\ComfyUI\\启动网卡-启动.bat",
          comfyWorkflowPath: "E:\\ComfyUI_Workflows\\workflows",
          comfyWorkflows: [
            "▶▶F2K-一致性图像细化+编辑.json",
            "Flux2+Klein【产品移除】.json",
            "Flux2+Klein+超强多功能工作流(2).json",
            "Flux2+Klein单图编辑.json",
            "flux2-klein-材质替换-材质渲染.json",
            "Flux2-klein移除流V5版本2026年1月18日(1).json",
            "Klein-一致性 (3).json",
            "Klein-一致性.json",
            "YZ金鱼-InfiniteTalk超自然数字人对口型单人-v1.json",
            "YZ金鱼-Qwen-image超真实生图&图像反推.json",
            "提取线稿——Klein.json",
            "提示词反推.json",
            "自定义测试节点.json"
          ],
          comfyWorkflowsDetails: [
            {
              id: "wf-1",
              name: "▶▶F2K-一致性图像细化+编辑.json",
              size: "34 KB",
              date: "2026/04/14 13:18",
              isCustom: false,
              content: `{\n  "3": {\n    "class_type": "KSampler",\n    "inputs": {\n      "seed": 86321946,\n      "steps": 25,\n      "cfg": 7.5,\n      "sampler_name": "dpmpp_2m_sde",\n      "scheduler": "karras",\n      "denoise": 0.35,\n      "model": ["4", 0],\n      "positive": ["6", 0],\n      "negative": ["7", 0],\n      "latent_image": ["10", 0]\n    }\n  },\n  "4": {\n    "class_type": "CheckpointLoaderSimple",\n    "inputs": {\n      "ckpt_name": "F2K_Realistic_Concept_v2.safetensors"\n    }\n  },\n  "6": {\n    "class_type": "CLIPTextEncode",\n    "inputs": {\n      "text": "a photorealistic cyberpunk female, 8k resolution, highly detailed, photorealistic",\n      "clip": ["4", 1]\n    }\n  },\n  "7": {\n    "class_type": "CLIPTextEncode",\n    "inputs": {\n      "text": "ugly, deformed, lowres, blurry, bad anatomy, disfigured, poor lighting",\n      "clip": ["4", 1]\n    }\n  },\n  "10": {\n    "class_type": "VAEEncodeForInpaint",\n    "inputs": {\n      "pixels": ["12", 0],\n      "mask": ["13", 0],\n      "grow_mask_by": 6,\n      "vae": ["4", 2]\n    }\n  },\n  "12": {\n    "class_type": "LoadImage",\n    "inputs": {\n      "image": "input_raw_face.png"\n    }\n  },\n  "13": {\n    "class_type": "LoadImage",\n    "inputs": {\n      "image": "face_mask.png"\n    }\n  },\n  "15": {\n    "class_type": "VAEDecode",\n    "inputs": {\n      "samples": ["3", 0],\n      "vae": ["4", 2]\n    }\n  },\n  "16": {\n    "class_type": "SaveImage",\n    "inputs": {\n      "filename_prefix": "F2K_Consistency_Out",\n      "images": ["15", 0]\n    }\n  }\n}`
            },
            {
              id: "wf-2",
              name: "Flux2+Klein【产品移除】.json",
              size: "33 KB",
              date: "2026/04/09 09:46",
              isCustom: false,
              content: `{\n  "8": {\n    "class_type": "KSampler",\n    "inputs": {\n      "seed": 523196412,\n      "steps": 20,\n      "cfg": 1.0,\n      "sampler_name": "uni_pc",\n      "scheduler": "normal",\n      "denoise": 1.0,\n      "model": ["12", 0],\n      "positive": ["13", 0],\n      "negative": ["14", 0],\n      "latent_image": ["15", 0]\n    }\n  },\n  "12": {\n    "class_type": "UNETLoader",\n    "inputs": {\n      "unet_name": "flux1-schnell.safetensors"\n    }\n  },\n  "13": {\n    "class_type": "CLIPTextEncodeFlux",\n    "inputs": {\n      "clip_l": "product photography, modern kitchen counter, clean look",\n      "t5xxl": "product photography of an empty modern wooden shelf, absolute perfection, clean background, high resolution",\n      "guidance": 3.5,\n      "clip": ["16", 0]\n    }\n  },\n  "14": {\n    "class_type": "CLIPTextEncode",\n    "inputs": {\n      "text": "blurry, low quality, noise, people, text, watermark",\n      "clip": ["16", 0]\n    }\n  },\n  "15": {\n    "class_type": "VAEEncodeForInpaint",\n    "inputs": {\n      "pixels": ["17", 0],\n      "mask": ["18", 0],\n      "grow_mask_by": 6,\n      "vae": ["19", 0]\n    }\n  },\n  "16": {\n    "class_type": "CLIPLoader",\n    "inputs": {\n      "clip_name": "t5xxl_fp16.safetensors"\n    }\n  },\n  "17": {\n    "class_type": "LoadImage",\n    "inputs": {\n      "image": "original_product.png"\n    }\n  },\n  "18": {\n    "class_type": "LoadImage",\n    "inputs": {\n      "image": "product_mask.png"\n    }\n  },\n  "19": {\n    "class_type": "VAELoader",\n    "inputs": {\n      "vae_name": "ae.safetensors"\n    }\n  },\n  "20": {\n    "class_type": "VAEDecode",\n    "inputs": {\n      "samples": ["8", 0],\n      "vae": ["19", 0]\n    }\n  },\n  "21": {\n    "class_type": "SaveImage",\n    "inputs": {\n      "filename_prefix": "Flux_Product_Removed",\n      "images": ["20", 0]\n    }\n  }\n}`
            },
            {
              id: "wf-3",
              name: "Flux2+Klein+超强多功能工作流(2).json",
              size: "59 KB",
              date: "2026/03/31 14:00",
              isCustom: false,
              content: `{\n  "sampler": {\n    "class_type": "KSampler",\n    "inputs": {\n      "seed": 284719482,\n      "steps": 30,\n      "cfg": 3.5,\n      "sampler_name": "euler_ancestral",\n      "scheduler": "normal",\n      "denoise": 1.0,\n      "model": ["model_loader", 0],\n      "positive": ["pos_prompt", 0],\n      "negative": ["neg_prompt", 0],\n      "latent_image": ["latent_img", 0]\n    }\n  },\n  "model_loader": {\n    "class_type": "CheckpointLoaderSimple",\n    "inputs": {\n      "ckpt_name": "flux1-dev-fp8.safetensors"\n    }\n  },\n  "pos_prompt": {\n    "class_type": "CLIPTextEncode",\n    "inputs": {\n      "text": "hyperrealistic 3d rendering, cinematic lighting, ultra high details, masterpieces, 8k",\n      "clip": ["model_loader", 1]\n    }\n  },\n  "neg_prompt": {\n    "class_type": "CLIPTextEncode",\n    "inputs": {\n      "text": "poor graphic, low fidelity, bad shadows, extra fingers, text message",\n      "clip": ["model_loader", 1]\n    }\n  },\n  "latent_img": {\n    "class_type": "EmptyLatentImage",\n    "inputs": {\n      "width": 1024,\n      "height": 1024,\n      "batch_size": 1\n    }\n  },\n  "dec": {\n    "class_type": "VAEDecode",\n    "inputs": {\n      "samples": ["sampler", 0],\n      "vae": ["model_loader", 2]\n    }\n  },\n  "save": {\n    "class_type": "SaveImage",\n    "inputs": {\n      "filename_prefix": "Klein_SuperMultimodal",\n      "images": ["dec", 0]\n    }\n  }\n}`
            },
            {
              id: "wf-4",
              name: "Flux2+Klein单图编辑.json",
              size: "36 KB",
              date: "2026/04/20 15:46",
              isCustom: false,
              content: getFreshWf4Content()
            },
            {
              id: "wf-5",
              name: "flux2-klein-材质替换-材质渲染.json",
              size: "37 KB",
              date: "2026/04/02 11:34",
              isCustom: false,
              content: `{\n  "sampler": {\n    "class_type": "KSampler",\n    "inputs": {\n      "seed": 983120482,\n      "steps": 28,\n      "cfg": 4.5,\n      "sampler_name": "dpmpp_2m_sde",\n      "scheduler": "karras",\n      "denoise": 0.7,\n      "model": ["ckpt", 0],\n      "positive": ["render_node", 0],\n      "negative": ["render_node", 1],\n      "latent_image": ["latent", 0]\n    }\n  },\n  "render_node": {\n    "class_type": "ControlNetApplyAdvanced",\n    "inputs": {\n      "strength": 0.85,\n      "start_percent": 0.0,\n      "end_percent": 1.0,\n      "positive": ["text_pos", 0],\n      "negative": ["text_neg", 0],\n      "control_net": ["ctrl_loader", 0],\n      "image": ["prep_lineart", 0]\n    }\n  },\n  "ctrl_loader": {\n    "class_type": "ControlNetLoader",\n    "inputs": {\n      "control_net_name": "controlnet_depth_flux.safetensors"\n    }\n  },\n  "prep_lineart": {\n    "class_type": "LineartEdgeDetector",\n    "inputs": {\n      "resolution": 512,\n      "image": ["source_material", 0]\n    }\n  },\n  "source_material": {                      "class_type": "LoadImage",\n    "inputs": {\n      "image": "product_raw_plastic.png"\n    }\n  },\n  "text_pos": {\n    "class_type": "CLIPTextEncode",\n    "inputs": {\n      "text": "shiny polished metallic body, luxury carbon fiber surface, studio light",\n      "clip": ["ckpt", 1]\n    }\n  },\n  "text_neg": {\n    "class_type": "CLIPTextEncode",\n    "inputs": {\n      "text": "dirty, rough surface, low fidelity, plastic look, worst quality",\n      "clip": ["ckpt", 1]\n    }\n  },\n  "ckpt": {\n    "class_type": "CheckpointLoaderSimple",\n    "inputs": {\n      "ckpt_name": "flux1-dev-fp8.safetensors"\n    }\n  },\n  "latent": {\n    "class_type": "VAEEncode",\n    "inputs": {\n      "pixels": ["source_material", 0],\n      "vae": ["ckpt", 2]\n    }\n  },\n  "decode": {\n    "class_type": "VAEDecode",\n    "inputs": {\n      "samples": ["sampler", 0],\n      "vae": ["ckpt", 2]\n    }\n  },\n  "save": {\n    "class_type": "SaveImage",\n    "inputs": {\n      "filename_prefix": "Material_Rendering_V1",\n      "images": ["decode", 0]\n    }\n  }\n}`
            },
            {
              id: "wf-6",
              name: "YZ金鱼-InfiniteTalk超自然数字人对口型单人-v1.json",
              size: "61 KB",
              date: "2025/12/31 03:16",
              isCustom: false,
              content: `{\n  "lip_sync": {\n    "class_type": "InfiniteTalkLipsyncNode",\n    "inputs": {\n      "audio_path": "E:\\\\audio\\\\speech.mp3",\n      "face_image": "E:\\\\images\\\\avatar.png",\n      "fps": 25,\n      "alignment_threshold": 0.82\n    }\n  },\n  "audio_loader": {\n    "class_type": "PrimitiveNode",\n    "inputs": {\n      "value": "E:\\\\audio\\\\speech.mp3"\n    }\n  },\n  "avatar_loader": {\n    "class_type": "LoadImage",\n    "inputs": {\n      "image": "avatar.png"\n    }\n  },\n  "video_compiler": {\n    "class_type": "SaveImage",\n    "inputs": {\n      "filename_prefix": "InfiniteTalk_Output",\n      "images": ["lip_sync", 0]\n    }\n  }\n}`
            },
            {
              id: "wf-7",
              name: "YZ金鱼-Qwen-image超真实生图&图像反推.json",
              size: "86 KB",
              date: "2025/12/31 03:32",
              isCustom: false,
              content: `{\n  "sampler": {\n    "class_type": "KSampler",\n    "inputs": {\n      "seed": 5218302194,\n      "steps": 30,\n      "cfg": 7.0,\n      "sampler_name": "dpmpp_2m_sde",\n      "scheduler": "karras",\n      "denoise": 1.0,\n      "model": ["ckpt", 0],\n      "positive": ["prompt_output", 0],\n      "negative": ["neg", 0],\n      "latent_image": ["latent", 0]\n    }\n  },\n  "qwen_node": {\n    "class_type": "Qwen2VLGenerate",\n    "inputs": {\n      "prompt": "Describe this image in detail for ComfyUI prompt generation",\n      "image": ["load_image", 0],\n      "max_tokens": 512,\n      "temperature": 0.2\n    }\n  },\n  "load_image": {\n    "class_type": "LoadImage",\n    "inputs": {\n      "image": "ref_image.png"\n    }\n  },\n  "prompt_output": {\n    "class_type": "CLIPTextEncode",\n    "inputs": {\n      "text": ["qwen_node", 0],\n      "clip": ["ckpt", 1]\n    }\n  },\n  "ckpt": {\n    "class_type": "CheckpointLoaderSimple",\n    "inputs": {\n      "ckpt_name": "F2K_Realistic_Concept_v2.safetensors"\n    }\n  },\n  "latent": {\n    "class_type": "EmptyLatentImage",\n    "inputs": {\n      "width": 1024,\n      "height": 1024,\n      "batch_size": 1\n    }\n  },\n  "neg": {\n    "class_type": "CLIPTextEncode",\n    "inputs": {\n      "text": "nsfw, low quality, cartoon, digital art, sketch, black and white",\n      "clip": ["ckpt", 1]\n    }\n  },\n  "decode": {\n    "class_type": "VAEDecode",\n    "inputs": {\n      "samples": ["sampler", 0],\n      "vae": ["ckpt", 2]\n    }\n  },\n  "save": {\n    "class_type": "SaveImage",\n    "inputs": {\n      "filename_prefix": "QwenPromptAuto_Gen",\n      "images": ["decode", 0]\n    }\n  }\n}`
            },
            {
              id: "wf-8",
              name: "提取线稿——Klein.json",
              size: "24 KB",
              date: "2026/03/23 13:09",
              isCustom: false,
              content: `{\n  "lineart": {\n    "class_type": "LineartEdgeDetector",\n    "inputs": {\n      "resolution": 512,\n      "image": ["load_raw", 0]\n    }\n  },\n  "load_raw": {\n    "class_type": "LoadImage",\n    "inputs": {\n      "image": "photo.png"\n    }\n  },\n  "save_lineart": {\n    "class_type": "SaveImage",\n    "inputs": {\n      "filename_prefix": "Klein_Lineart_Output",\n      "images": ["lineart", 0]\n    }\n  }\n}`
            },
            {
              id: "wf-9",
              name: "提示词反推.json",
              size: "9 KB",
              date: "2026/04/20 15:56",
              isCustom: false,
              content: `{\n  "wd14_tagger": {\n    "class_type": "WD14Tagger",\n    "inputs": {\n      "threshold": 0.35,\n      "image": ["load_img", 0]\n    }\n  },\n  "load_img": {\n    "class_type": "LoadImage",\n    "inputs": {\n      "image": "danbooru_face.jpg"\n    }\n  },\n  "output_tags": {\n    "class_type": "Note",\n    "inputs": {\n      "value": ["wd14_tagger", 0]\n    }\n  }\n}`
            },
            {
              id: "wf-10",
              name: "自定义测试节点.json",
              size: "60 KB",
              date: "2026/05/14 13:36",
              isCustom: false,
              content: `{\n  "test_node": {\n    "class_type": "CustomDebugNode",\n    "inputs": {\n      "value": "debugging",\n      "input_stream": ["checkpoint_loader", 0]\n    }\n  },\n  "checkpoint_loader": {\n    "class_type": "CheckpointLoaderSimple",\n    "inputs": {\n      "ckpt_name": "sd_xl_base_1.0.safetensors"\n    }\n  },\n  "save_debug": {\n    "class_type": "SaveImage",\n    "inputs": {\n      "filename_prefix": "Sandbox_Test",\n      "images": ["test_node", 0]\n    }\n  }\n}`
            }
          ],
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
        return incomingData.filter((d): d is any => !!d);
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
    return incomingEdges
      .map((e) => state.nodes.find((n) => n.id === e.source)?.data)
      .filter((d): d is any => !!d);
  }));
};
