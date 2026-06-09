import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { 
  Globe2, 
  ExternalLink, 
  Link as LinkIcon, 
  ImagePlus, 
  Trash2, 
  Info, 
  Maximize2, 
  Minimize2, 
  Plus, 
  Minus, 
  Star, 
  X, 
  Search, 
  RefreshCw, 
  Send,
  CloudLightning,
  Server,
  Terminal,
  FileJson,
  Database,
  Upload,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  History,
  Key,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Pin,
  PinOff,
  ChevronUp,
  ChevronDown,
  Anchor
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { normalizeWorkflowToPrompt } from './SettingsModal';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

// Detect if running in Electron desktop environment or local desktop mode
const isElectron = typeof window !== 'undefined' && 
  window.navigator && 
  window.navigator.userAgent.toLowerCase().includes('electron');

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        allowpopups?: any;
        nodeintegration?: any;
        websecurity?: any;
        useragent?: string;
        style?: React.CSSProperties;
      }, HTMLElement>;
    }
  }
}

// --- ComfyUI Types ---
interface ComfyNodeData {
  comfyUrl?: string;
  workflowJson?: any;
  workflowName?: string;
  scanResult?: WorkflowScanResult;
  outputs?: {
    status?: 'idle' | 'scanning' | 'ready' | 'uploading' | 'running' | 'success' | 'error';
    promptId?: string;
    logs?: string[];
    images?: any[];
  }
}

interface ImageMapping {
  comfyNodeId: string;
  classType: string;
  title: string;
  field: string;
  currentValue: string;
}

interface ImageOutput {
  comfyNodeId: string;
  classType: string;
  title: string;
  field: string;
}

interface EditableField {
  name: string;
  label: string;
  value: any;
  fieldType: 'text' | 'textarea' | 'number' | 'checkbox' | 'file-input';
  path: string;
}

interface ExposedParam {
  exposeIndex: number;
  comfyNodeId: string;
  classType: string;
  title: string;
  editableFields: EditableField[];
}

interface WorkflowScanResult {
  imageInputs: ImageMapping[];
  imageOutputs: ImageOutput[];
  exposedParams: ExposedParam[];
}

// --- ComfyUI Utils ---
const AUTO_IMAGE_INPUT_CLASSES = ["LoadImage", "LoadImageMask"];
const AUTO_IMAGE_OUTPUT_CLASSES = ["SaveImage", "PreviewImage"];
const HASHTAG_EXPOSE_REGEX = /#(\d+)/;

function inferFieldType(name: string, value: any): 'text' | 'textarea' | 'number' | 'checkbox' | 'file-input' {
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  if (typeof value === "string") {
    if (name === "text" || value.length > 80 || value.includes("\n")) return "textarea";
    if (name.toLowerCase().includes("image") && !name.toLowerCase().includes("mask")) return "file-input";
    return "text";
  }
  return "text";
}

function extractEditableInputs(node: any): EditableField[] {
  const inputs = node.inputs || {};
  const fields: EditableField[] = [];
  for (const [name, value] of Object.entries(inputs)) {
    // Arrays in ComfyUI workflow JSON usually represent connections [node_id, output_index]
    if (Array.isArray(value)) continue;
    
    // Filter out some common internal fields that shouldn't be edited directly as simple text/number
    if (name === "image" && AUTO_IMAGE_INPUT_CLASSES.includes(node.class_type)) continue;
    
    fields.push({ 
      name, 
      label: name, 
      value, 
      fieldType: inferFieldType(name, value), 
      path: `inputs.${name}` 
    });
  }
  return fields;
}

function scanComfyWorkflow(workflow: any): WorkflowScanResult {
  const imageInputs: ImageMapping[] = [];
  const imageOutputs: ImageOutput[] = [];
  const exposedParams: ExposedParam[] = [];
  
  if (!workflow || typeof workflow !== 'object') return { imageInputs: [], imageOutputs: [], exposedParams: [] };
  
  const normalized = normalizeWorkflowToPrompt(workflow);
  
  // First pass: identify all nodes
  for (const [nodeId, node] of Object.entries<any>(normalized)) {
    const classType = node.class_type || node.type;
    const title = node._meta?.title || node.title || classType || `Node ${nodeId}`;
    
    // 1. Auto-identify Image Inputs
    if (AUTO_IMAGE_INPUT_CLASSES.includes(classType)) {
      imageInputs.push({ 
        comfyNodeId: nodeId, 
        classType, 
        title, 
        field: "image", 
        currentValue: node.inputs?.image || "" 
      });
    }
    
    // 2. Auto-identify Image Outputs
    if (AUTO_IMAGE_OUTPUT_CLASSES.includes(classType)) {
      imageOutputs.push({ 
        comfyNodeId: nodeId, 
        classType, 
        title, 
        field: "images" 
      });
    }
    
    // 3. Identify Hashtag Exposed Parameters
    const match = title.match(HASHTAG_EXPOSE_REGEX);
    if (match) {
      exposedParams.push({
        exposeIndex: Number(match[1]),
        comfyNodeId: nodeId,
        classType,
        title,
        editableFields: extractEditableInputs(node)
      });
    }
  }
  
  // Sort exposed parameters by the # index
  exposedParams.sort((a, b) => a.exposeIndex - b.exposeIndex);
  
  return { imageInputs, imageOutputs, exposedParams };
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  forceProxy?: boolean;
}

const shouldProxyUrl = (url: string) => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  
  let currentOrigin = '';
  try {
    currentOrigin = window.location.origin.toLowerCase();
  } catch (e) {}
  
  if (
    lowerUrl.includes('localhost') ||
    lowerUrl.includes('127.0.0.1') ||
    lowerUrl.includes('.loca.lt') ||
    lowerUrl.includes('accounts.google.com/gsi/') ||
    lowerUrl.includes('google.com/gsi/') ||
    lowerUrl.startsWith('/') ||
    lowerUrl.startsWith('data:') ||
    lowerUrl.startsWith('blob:') ||
    (currentOrigin && lowerUrl.startsWith(currentOrigin))
  ) {
    return false;
  }
  
  // Note: Only proxy unencrypted 'http://' by default to bypass browser mixed-content blocks.
  // Secure 'https://' URLs should load directly via native iframe by default to avoid hosting proxy/IP blocklists.
  return lowerUrl.startsWith('http://');
};

interface BrowserFrameProps {
  isPortal?: boolean;
  
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onAddTab: (url?: string, title?: string) => void;
  onCloseTab: (id: string) => void;
  pageUrl: string;
  setPageUrl: (url: string) => void;
  iframeUrl: string;
  refreshKey: number;
  favorites: string[];
  onNavigate: () => void;
  onRefresh: () => void;
  onAddFavorite: (url?: string) => void;
  onRemoveFavorite: (url: string) => void;
  onBookmarkClick: (url: string) => void;
  onToggleOverlay: (open: boolean) => void;
  onOpenExternal: () => void;
  onBackward: () => void;
  onForward: () => void;
  historyEntries: { url: string; title: string; timestamp: number }[];
  onClearHistory: () => void;
  savedCredentials: { domain: string; username: string; passwordString: string; id: string }[];
  onSaveCredential: (domain: string, username: string, passwordString: string) => void;
  onDeleteCredential: (id: string) => void;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  onIframeLoad?: (e: React.SyntheticEvent<HTMLIFrameElement>) => void;
  onToggleForceProxy?: (tabId: string) => void;
  isFolded?: boolean;
  setIsFolded?: (folded: boolean) => void;
  isPinned?: boolean;
  setIsPinned?: (pinned: boolean) => void;
  setPinnedPos?: (pos: { x: number; y: number }) => void;
}

const BrowserFrame = React.memo(({ 
  isPortal = false, 
  
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  pageUrl, 
  setPageUrl, 
  iframeUrl, 
  refreshKey, 
  favorites, 
  onNavigate, 
  onRefresh, 
  onAddFavorite, 
  onRemoveFavorite, 
  onBookmarkClick,
  onToggleOverlay,
  onOpenExternal,
  onBackward,
  onForward,
  historyEntries,
  onClearHistory,
  savedCredentials,
  onSaveCredential,
  onDeleteCredential,
  iframeRef,
  onIframeLoad,
  onToggleForceProxy,
  isFolded = false,
  setIsFolded,
  isPinned = false,
  setIsPinned,
  setPinnedPos
}: BrowserFrameProps) => {
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'history' | 'passwords'>('history');
  
  // Local state for manually added passwords
  const [newDomain, setNewDomain] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [visiblePasswordState, setVisiblePasswordState] = useState<Record<string, boolean>>({});

  // Active domain identification for automated autofill match
  const activeHostname = tryGetHostname(iframeUrl || pageUrl).toLowerCase();
  const activeCredential = savedCredentials.find(c => {
    const d = String(c.domain || '').toLowerCase();
    return d && (activeHostname.includes(d) || d.includes(activeHostname));
  });

  const handleAutofillActiveTab = (cred: any) => {
    if (!iframeRef?.current) return;
    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      const usernameInputs = doc.querySelectorAll('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"], input[name*="email"]');
      const passwordInputs = doc.querySelectorAll('input[type="password"], input[name*="pass"]');

      if (usernameInputs.length > 0) {
        const userInput = usernameInputs[0] as HTMLInputElement;
        userInput.value = cred.username;
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        userInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (passwordInputs.length > 0) {
        const passInput = passwordInputs[0] as HTMLInputElement;
        passInput.value = cred.passwordString;
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (e) {
      alert("已自动复制凭据，请右击输入框贴入直接登录！\n账号：" + cred.username);
    }
  };

  const handleAddCredentialClick = () => {
    if (!newUsername || !newPassword) {
      alert("请输入用户名和密码！");
      return;
    }
    const finalDomain = newDomain.trim() || tryGetHostname(pageUrl);
    onSaveCredential(finalDomain, newUsername.trim(), newPassword.trim());
    setNewDomain('');
    setNewUsername('');
    setNewPassword('');
  };

  const isLocaltunnel = (iframeUrl || '').includes('.loca.lt');
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const isTabProxied = activeTab?.forceProxy ?? (iframeUrl ? shouldProxyUrl(iframeUrl) : false);
  const resolvedIframeSrc = isTabProxied
    ? `/api/proxy?url=${encodeURIComponent(iframeUrl)}`
    : iframeUrl;

  return (
    <div 
      className={`flex flex-col bg-[var(--bg-secondary)] border border-[var(--border)] nodrag nowheel ${isPortal ? 'w-[90vw] h-[85vh] rounded-[32px] shadow-2xl' : 'flex-1 rounded-2xl'}`}
      style={isPortal ? {} : {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        
        
      }}
    >
      
      {/* Browser Tabs Row */}
      <div className="bg-black/80 px-4 pt-2 border-b border-[var(--border)] flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-hide shrink-0 rounded-t-2xl">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div 
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer text-xs font-medium transition-all duration-200 border-t border-x shrink-0 ${
                isActive 
                  ? 'bg-black/55 border-[var(--border)] text-white' 
                  : 'bg-black/20 border-transparent text-gray-500 hover:bg-black/30 hover:text-gray-300'
              }`}
              style={{ minWidth: 100, maxWidth: 180 }}
            >
              <Globe2 size={12} className={isActive ? 'text-accent' : 'text-gray-600'} />
              <span className="flex-1 truncate select-none text-[11px] font-semibold">{tab.title}</span>
              {tabs.length > 1 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-white/10 p-0.5 rounded transition-all text-gray-400 hover:text-red-500"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
        <button 
          onClick={() => onAddTab('https://www.google.com', 'New Tab')}
          className="p-1 px-2 mb-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all shrink-0 cursor-pointer flex items-center gap-1"
          title="新建标签页"
        >
          <Plus size={11} />
          <span className="text-[10px] uppercase font-bold tracking-wider">Tab</span>
        </button>
      </div>

      {/* Search Header */}
      <div className="bg-black/60 px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 shrink-0 px-1">
          <div className="flex items-center gap-1.5">
             <div className="w-3 h-3 rounded-full bg-red-500/40" />
             <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
             <div className="w-3 h-3 rounded-full bg-green-500/40" />
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1 border-l border-white/10 pl-3">
            <button 
              onClick={onBackward}
              className="p-1 px-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer flex items-center justify-center animate-none"
              title="后退"
            >
              <ArrowLeft size={16} />
            </button>
            <button 
              onClick={onForward}
              className="p-1 px-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer flex items-center justify-center animate-none"
              title="前进"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 flex items-center gap-3 bg-white/5 border border-[var(--border)] rounded-xl px-4 py-1.5 min-w-0 group hover:bg-white/10 transition-all">
          <Search size={14} className="text-gray-600 group-hover:text-gray-400" />
          <input 
            className="flex-1 bg-transparent text-base text-gray-300 outline-none truncate font-mono"
            value={pageUrl || ''}
            onChange={(e) => setPageUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onNavigate()}
            placeholder="Search or enter URL"
          />
          <div className="flex items-center gap-2">
            {onToggleForceProxy && (
              <button 
                onClick={() => onToggleForceProxy(activeTabId)}
                className={`p-1 px-1.5 rounded transition-all duration-200 flex items-center gap-1 ${isTabProxied ? 'text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-400/20' : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'}`}
                title={isTabProxied ? "已启用「服务器中转代理」：加载此网址时通过后台中转，安全突破跨域和本地端口混合内容拦截政策" : "已切换为「直连访问」：直接由浏览器与网址域名握手（若网页加载失败或受跨域限制，请点击此处切换为代理模式）"}
              >
                <Server size={14} />
                <span className="text-[9px] font-black uppercase tracking-wider hidden sm:inline">{isTabProxied ? "代理中" : "直连"}</span>
              </button>
            )}
            <button 
              onClick={onNavigate}
              className="text-indigo-400 hover:text-indigo-300 transition-colors p-1"
              title="Navigate"
            >
              <Send size={14} />
            </button>
            <button 
              onClick={onRefresh}
              className="text-gray-600 hover:text-white transition-colors p-1"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button 
              onClick={() => onAddFavorite()}
              className={`transition-colors ${favorites.includes(pageUrl) ? 'text-yellow-500' : 'text-gray-600 hover:text-white'}`}
            >
              <Star size={14} fill={favorites.includes(pageUrl) ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => setShowSidebar(p => !p)} 
            className={`p-2 transition-all cursor-pointer ${showSidebar ? 'text-indigo-400' : 'text-gray-500 hover:text-white'}`} 
            title="历史记录与密码管理"
          >
            <History size={16} />
          </button>
          <button onClick={onOpenExternal} className="p-2 text-gray-500 hover:text-white transition-all" title="在新标签页打开">
            <ExternalLink size={16} />
          </button>
          
          <button 
            onClick={() => onToggleOverlay(!isPortal)} 
            className="p-2 text-gray-500 hover:text-white transition-all transform hover:scale-105 active:scale-95" 
            title={isPortal ? "最小化" : "最大化全屏"}
          >
            {isPortal ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {!isPortal && (
            <>
              {setIsPinned && setPinnedPos && (
                <button 
                  onClick={() => {
                    const nextPinned = !isPinned;
                    setIsPinned(nextPinned);
                    if (nextPinned) {
                      setPinnedPos({ x: window.innerWidth / 2 - 400, y: 150 });
                      useStore.getState().setIsTopVisible(false);
                    } else {
                      useStore.getState().setIsTopVisible(true);
                    }
                  }}
                  className={`p-2 transition-all transform hover:scale-105 active:scale-95 ${isPinned ? 'text-yellow-400' : 'text-gray-500 hover:text-white'}`}
                  title={isPinned ? "取消视口固定" : "固定在当前位置"}
                >
                  {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                </button>
              )}

              {setIsFolded && (
                <button 
                  onClick={() => setIsFolded(!isFolded)}
                  className={`p-2 transition-all transform hover:scale-105 active:scale-95 ${isFolded ? 'text-indigo-400' : 'text-gray-500 hover:text-white'}`}
                  title={isFolded ? "展开窗口" : "折叠最小化窗口"}
                >
                  {isFolded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              )}

              <button 
                onClick={() => useStore.getState().toggleWebPreview()}
                className="p-2 text-gray-500 hover:text-red-400 transition-all transform hover:scale-105 active:scale-95 ml-1"
                title="关闭面板"
              >
                <X size={16} />
              </button>
            </>
          )}

          {isPortal && (
            <button onClick={() => onToggleOverlay(false)} className="p-2 text-red-500/50 hover:text-red-500 ml-1">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Bookmarks Bar */}
      <div className="bg-black/40 px-4 py-2 border-b border-[var(--border)] flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-hide shrink-0">
        <button 
          onClick={() => {
            const url = prompt('输入要收藏的网页地址:', pageUrl);
            if (url) {
               let formatted = url.trim();
               if (!formatted.startsWith('http')) {
                 formatted = 'https://' + formatted;
               }
               onAddFavorite(formatted);
            }
          }}
          className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-accent/20 rounded shadow-sm text-gray-500 hover:text-accent transition-all shrink-0"
        >
          <Plus size={14} />
        </button>
        
        <div className="w-px h-4 bg-white/10 mx-1 shrink-0" />

        {favorites.map((url) => (
          <div key={url} className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all shrink-0 ${iframeUrl === url ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-white/2 border-[var(--border)] text-gray-500 hover:bg-white/5'}`}>
            <button 
              onClick={() => onBookmarkClick(url)}
              className="text-sm font-black uppercase tracking-tight truncate max-w-[140px]"
            >
              {tryGetHostname(url)}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onRemoveFavorite(url); }}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-all p-0.5"
            >
              <Minus size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Sandbox Multi-Kernel Status Banner */}
      <div className={`px-4 py-1.5 flex items-center justify-between text-[11px] border-b border-[var(--border)] shrink-0 ${isElectron ? 'bg-indigo-950/45 text-indigo-300 border-indigo-500/20' : 'bg-amber-950/25 text-amber-300 border-amber-500/10'}`}>
        <div className="flex items-center gap-2 overflow-hidden truncate">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isElectron ? 'bg-indigo-400' : 'bg-amber-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isElectron ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="truncate">
            {isElectron ? (
              <span className="font-semibold text-indigo-400">💎 Chromium 桌面原生沙盒直连内核已挂载</span>
            ) : (
              <span>🌐 经典网页沙盒内核 | 提示：部分安全防御网站限制内嵌，推荐通过桌面版双击 <strong>「启动项目.bat」</strong> 激活 <strong>[桌面窗口模式]</strong> 开启 100% 自由沙盒</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 pr-1 shrink-0">
          <span className="text-[10px] opacity-60 font-mono tracking-wider font-semibold">
            {isElectron ? "KERNEL: CHROME_WEBVIEW" : "KERNEL: PROXIED_IFRAME"}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-row relative bg-white overflow-hidden min-h-0">
        
        {/* Main Viewport */}
        <div className="flex-1 h-full w-full relative min-w-0">
          
          {/* Match & suggest banner */}
          {activeCredential && (
            <div className="absolute top-0 inset-x-0 bg-indigo-600 border-b border-indigo-500 text-white z-40 flex items-center justify-between gap-4 py-2 px-6 shadow-xl animate-fade-in backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Key size={14} className="text-yellow-400 animate-pulse shrink-0" />
                <span className="text-xs font-semibold">检测到此站已保存凭证 (<span className="text-indigo-200 font-mono">{activeCredential.username}</span>)</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => handleAutofillActiveTab(activeCredential)}
                  className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 border-0 rounded px-2.5 py-1 text-[11px] font-bold transition-all shrink-0 cursor-pointer"
                >
                  ⚡ 一键秒填
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(activeCredential.username);
                    alert("账号已复制：" + activeCredential.username);
                  }}
                  className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[11px] transition-all font-semibold cursor-pointer"
                >
                  复制账号
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(activeCredential.passwordString);
                    alert("密码已复制！");
                  }}
                  className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[11px] transition-all font-semibold cursor-pointer"
                >
                  复制密码
                </button>
              </div>
            </div>
          )}

          {tabs.map((tab) => {
            const isTabActive = tab.id === activeTabId;
            const tabIframeUrl = tab.url;
            const isTabProxied = tab.forceProxy ?? (tabIframeUrl ? shouldProxyUrl(tabIframeUrl) : false);
            const resolvedSrc = isTabProxied
              ? `/api/proxy?url=${encodeURIComponent(tabIframeUrl)}`
              : tabIframeUrl;

            return (
              <div 
                key={tab.id}
                className={`absolute inset-0 w-full h-full ${isTabActive ? 'block' : 'hidden'}`}
              >
                {tabIframeUrl ? (
                  <>
                    {isElectron ? (
                      <webview
                        ref={isTabActive ? (el => {
                          if (el && iframeRef) {
                            (iframeRef as any).current = el;
                          }
                        }) : undefined}
                        key={`${tab.id}-${refreshKey}`}
                        src={tabIframeUrl}
                        style={{ width: '100%', height: '100%', border: 'none', background: 'white', display: 'block' }}
                        allowpopups={true}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                        <iframe 
                          ref={isTabActive ? iframeRef : undefined}
                          key={`${tab.id}-${refreshKey}`}
                          src={resolvedSrc} 
                          className="border-0 bg-white" 
                          referrerPolicy="no-referrer" 
                          onLoad={onIframeLoad}
                          style={{
                            width: '100%',
                            height: '100%',
                            transform: 'scale(1)',
                            transformOrigin: 'top left',
                            border: 'none',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            left: 0
                          }}
                        />
                      </div>
                    )}
                    {isTabActive && isLocaltunnel && (
                       <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[30]">
                          <button 
                            onClick={() => window.open(tabIframeUrl, '_blank')}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-2xl flex items-center gap-3 animate-bounce border border-white/20"
                          >
                            <ExternalLink size={14} /> 
                            如果您看到 Localtunnel 的黑屏提示，请点击此处并在新窗口点击 "Bypass" 以启用预览
                          </button>
                       </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-secondary)] text-gray-700 gap-3 opacity-30 select-none">
                     <Globe2 size={48} strokeWidth={1} />
                     <span className="text-sm font-black uppercase tracking-[0.4em]">Ready</span>
                  </div>
                )}
              </div>
            );
          })}

          {tabs.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-secondary)] text-gray-700 gap-3 opacity-30 select-none font-sans">
               <Globe2 size={48} strokeWidth={1} />
               <span className="text-sm font-black uppercase tracking-[0.4em]">Awaiting Data Stream</span>
            </div>
          )}
        </div>

        {/* Slide-out Sidebar for History and Lockers */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="h-full border-l border-[var(--border)] bg-black/95 flex flex-col overflow-hidden shrink-0 z-30 font-sans"
            >
              {/* Sidebar Header Tabs */}
              <div className="flex bg-white/5 border-b border-[var(--border)] shrink-0 p-2 gap-1">
                <button 
                  onClick={() => setSidebarTab('history')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${sidebarTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-white/5'}`}
                >
                  <History size={12} />
                  <span>历史记忆</span>
                </button>
                <button 
                  onClick={() => setSidebarTab('passwords')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${sidebarTab === 'passwords' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-white/5'}`}
                >
                  <Key size={12} />
                  <span>密码保管箱</span>
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-y-auto custom-scrollbar">
                {sidebarTab === 'history' ? (
                  <div className="flex-grow flex flex-col min-h-0 gap-3">
                    <div className="flex items-center justify-between gap-4 shrink-0">
                      <span className="text-xs font-black tracking-widest text-gray-500 uppercase">足迹清单</span>
                      {historyEntries.length > 0 && (
                        <button 
                          onClick={onClearHistory}
                          className="text-red-400 hover:text-red-300 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer border-0 bg-transparent"
                        >
                          一键清空
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[420px] custom-scrollbar pr-1">
                      {historyEntries.slice().reverse().map((entry, index) => (
                        <div 
                          key={index}
                          className="group bg-white/5 hover:bg-white/10 rounded-xl p-3 border border-white/5 transition-all text-xs flex flex-col gap-1 relative"
                        >
                          <span className="font-bold text-white pr-6 truncate">{entry.title || tryGetHostname(entry.url)}</span>
                          <span className="text-gray-500 font-mono truncate text-[10px] leading-tight select-all">{entry.url}</span>
                          <span className="text-[9px] text-gray-600 font-mono mt-1">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                          <button 
                            onClick={() => onBookmarkClick(entry.url)}
                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 bg-indigo-600/30 hover:bg-indigo-600 rounded px-1.5 py-0.5 text-[10px] text-indigo-400 hover:text-white transition-all cursor-pointer border-0"
                          >
                            直达
                          </button>
                        </div>
                      ))}
                      {historyEntries.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-600 italic">
                          <span>暂无足迹记录</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col gap-4 min-h-0">
                    {/* Add Credential Form */}
                    <div className="bg-white/5 border border-[var(--border)] rounded-2xl p-4 flex flex-col gap-3">
                      <span className="text-xs font-black tracking-widest text-[#a855f7] uppercase flex items-center gap-1.5">
                        <Lock size={12} />
                        <span>自动留存或手动补充</span>
                      </span>
                      <div className="flex flex-col gap-2 text-xs">
                        <input 
                          type="text" 
                          placeholder="目标网站域名 (例如: amazon.com)" 
                          className="bg-black/40 border border-[var(--border)] rounded-xl px-3 py-2 text-white placeholder-gray-600 outline-none focus:border-[#a855f7]/55"
                          value={newDomain}
                          onChange={(e) => setNewDomain(e.target.value)}
                        />
                        <input 
                          type="text" 
                          placeholder="输入账号 / Email" 
                          className="bg-black/40 border border-[var(--border)] rounded-xl px-3 py-2 text-white placeholder-gray-600 outline-none focus:border-[#a855f7]/55"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                        />
                        <input 
                          type="password" 
                          placeholder="输入对应密码" 
                          className="bg-black/40 border border-[var(--border)] rounded-xl px-3 py-2 text-white placeholder-gray-600 outline-none focus:border-[#a855f7]/55"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button 
                          onClick={handleAddCredentialClick}
                          className="mt-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-2 rounded-xl transition-all shadow-md cursor-pointer border-0"
                        >
                          保存至保管箱
                        </button>
                      </div>
                    </div>

                    {/* Saved Credentials List */}
                    <div className="flex-1 flex flex-col gap-3 min-h-0">
                      <span className="text-xs font-black tracking-widest text-gray-500 uppercase">密钥池 ({savedCredentials.length}个)</span>
                      <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
                        {savedCredentials.map((cred) => {
                          const isPassVisible = visiblePasswordState[cred.id] || false;
                          return (
                            <div 
                              key={cred.id}
                              className="group bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-1.5 hover:bg-white/10 transition-all text-xs relative"
                            >
                              <div className="flex items-center justify-between pr-8">
                                <span className="font-extrabold text-[#a855f7] tracking-wider truncate font-mono text-[11px] bg-purple-500/10 px-1.5 py-0.5 rounded uppercase">{cred.domain}</span>
                              </div>
                              <div className="flex flex-col gap-1 text-gray-300 font-mono text-[11px]">
                                <div className="flex items-center justify-between">
                                  <span>账号: <strong className="text-white select-all">{cred.username}</strong></span>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(cred.username);
                                      alert("已复制账号：" + cred.username);
                                    }}
                                    className="text-[10px] text-gray-500 hover:text-indigo-400 transition-colors p-0.5 border-0 bg-transparent cursor-pointer"
                                    title="复制账号"
                                  >
                                    <Copy size={11} />
                                  </button>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>密码: <strong className="text-white select-all">{isPassVisible ? cred.passwordString : '••••••••'}</strong></span>
                                  <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={() => {
                                        setVisiblePasswordState(prev => ({ ...prev, [cred.id]: !isPassVisible }));
                                      }}
                                      className="text-[10px] text-gray-500 hover:text-indigo-400 transition-colors p-0.5 border-0 bg-transparent cursor-pointer"
                                      title={isPassVisible ? "隐藏密码" : "显示密码"}
                                    >
                                      {isPassVisible ? <EyeOff size={11} /> : <Eye size={11} />}
                                    </button>
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(cred.passwordString);
                                        alert("已复制密码！");
                                      }}
                                      className="text-[10px] text-gray-500 hover:text-indigo-400 transition-colors p-0.5 border-0 bg-transparent cursor-pointer"
                                      title="复制密码"
                                    >
                                      <Copy size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => onDeleteCredential(cred.id)}
                                className="absolute right-2 top-2.5 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 cursor-pointer border-0 bg-transparent"
                                title="从保险箱中抹除"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                        {savedCredentials.length === 0 && (
                          <div className="py-12 flex flex-col items-center justify-center text-gray-600 italic">
                            <span>暂未保存账号密码</span>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
});

// Helper for safe hostname extraction
function tryGetHostname(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch (e) {
    return url;
  }
}

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-all ${active ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
  >
    {icon}
    <span className="text-sm font-bold uppercase tracking-widest">{label}</span>
  </button>
);

export function WebPreviewPanel() {
  const showWebPreview = useStore(s => s.showWebPreview);
  const isTopVisible = useStore(s => s.isTopVisible);
  const getIncomingData = useStore((s) => s.getIncomingData);
  const addFile = useStore((s) => s.addFile);
  const settings = useStore((s) => s.settings);
  const zoom = useStore((s: any) => Math.max(0.1, s.zoom || 1));
  const nodeData = {} as any; // Shim to prevent rewrites
  const id = 'web-preview-panel';
  const updateNodeData = (..._args: any[]) => {};
  // Calculate zoom scale based on current node width (baseline is 1000px for this wide tool)
  const baselineWidth = 1000;
  const fontScale = (settings?.nodeUiFontSize ?? 14) / 14;
  
  
  
  // Scraper States
  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: '1', title: 'TUJIAGIRL', url: 'https://www.tujiagirl.com/online_ps/' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('1');
  
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || { id: '1', title: 'TUJIAGIRL', url: 'https://www.tujiagirl.com/online_ps/' };
  const iframeUrl = activeTab.url;

  const [pageUrl, setPageUrl] = useState(activeTab.url);
  const [imageAddress, setImageAddress] = useState('');
  const [imageCount, setImageCount] = useState(1);
  const [status, setStatus] = useState('支持在线网页预览、打开网页、加载图片。');
  const [images, setImages] = useState<any[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([
    'https://www.tujiagirl.com/online_ps/',
    'https://liblib.art/',
    'https://www.shutterstock.com/'
  ]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Persistent history entries and saved credentials
  const [historyEntries, setHistoryEntries] = useState<{ url: string; title: string; timestamp: number }[]>([]);
  const [savedCredentials, setSavedCredentials] = useState<{ domain: string; username: string; passwordString: string; id: string }[]>([]);

  // Sync pageUrl input with active tab url when active tab switches
  useEffect(() => {
    const activeTabObj = tabs.find(t => t.id === activeTabId);
    if (activeTabObj) {
      setPageUrl(activeTabObj.url);
    }
  }, [activeTabId, tabs]);

  // ComfyUI States
  const [viewMode, setViewMode] = useState<'scraper' | 'comfy'>(nodeData.viewMode || 'scraper');
  const [comfyUrl, setComfyUrl] = useState(nodeData.comfyUrl || 'http://127.0.0.1:8188');
  const [workflowJson, setWorkflowJson] = useState<any>(nodeData.workflowJson || {});
  const [workflowText, setWorkflowText] = useState(JSON.stringify(nodeData.workflowJson || {}, null, 2));
  const comfyFieldTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const workflowTextTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [comfyStatus, setComfyStatus] = useState<'idle' | 'scanning' | 'ready' | 'uploading' | 'running' | 'success' | 'error'>(nodeData.outputs?.status || 'idle');
  const [scanResult, setScanResult] = useState<WorkflowScanResult>(nodeData.scanResult || { imageInputs: [], imageOutputs: [], exposedParams: [] });
  const [promptId, setPromptId] = useState<string>(nodeData.outputs?.promptId || '');
  const [logs, setLogs] = useState<string[]>(nodeData.outputs?.logs || []);
  const [outputImages, setOutputImages] = useState<any[]>(nodeData.outputs?.images || []);
  const [comfyView, setComfyView] = useState<'browser' | 'source'>(nodeData.comfyView || 'browser');
  const [isComfyIframeLoading, setIsComfyIframeLoading] = useState(true);
  const [showLocalHelp, setShowLocalHelp] = useState(true);
  const [forceProxyComfy, setForceProxyComfy] = useState<boolean>(nodeData.forceProxyComfy || false);
  const [forceIframeRender, setForceIframeRender] = useState<boolean>(false);

  const [isFolded, setIsFolded] = useState<boolean>(nodeData.isFolded || false);
  const [isPinned, setIsPinned] = useState<boolean>(nodeData.isPinned || false);
  const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number }>(nodeData.pinnedPos || { x: 300, y: 150 });

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const posStartRef = useRef<{ x: number; y: number } | null>(null);

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

  const comfyIframeRef = useRef<HTMLIFrameElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Track the placeholder's viewport coordinates dynamically to match position perfectly without reload
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;
    
    const update = () => {
      const r = el.getBoundingClientRect();
      // Only set state if any dimension is different to save render performance
      setRect((prev) => {
        if (!prev) return r;
        if (
          prev.left === r.left &&
          prev.top === r.top &&
          prev.width === r.width &&
          prev.height === r.height
        ) {
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
    
    const timer = setInterval(update, 30);
    
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, { capture: true });
      clearInterval(timer);
    };
  }, []);

  // Auto-scan workflow when text changes
  useEffect(() => {
    if (!workflowText || workflowText === '{}') return;
    try {
      const parsed = JSON.parse(workflowText);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        setWorkflowJson(parsed);
        const result = scanComfyWorkflow(parsed);
        setScanResult(result);
        
        if (workflowTextTimeoutRef.current) {
          clearTimeout(workflowTextTimeoutRef.current);
        }
        workflowTextTimeoutRef.current = setTimeout(() => {
          updateNodeData(id, { 
            workflowJson: parsed,
            scanResult: result
          });
        }, 300);

        if (comfyStatus === 'idle' || comfyStatus === 'error') {
          setComfyStatus('ready');
        }
      }
    } catch (e) {
      // Ignore parsing errors during typing
    }
  }, [workflowText, id, updateNodeData]);

  useEffect(() => {
    return () => {
      if (comfyFieldTimeoutRef.current) {
        clearTimeout(comfyFieldTimeoutRef.current);
      }
      if (workflowTextTimeoutRef.current) {
        clearTimeout(workflowTextTimeoutRef.current);
      }
    };
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => {
      const newLogs = [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50);
      updateNodeData(id, { outputs: { ...nodeData.outputs, logs: newLogs } });
      return newLogs;
    });
  }, [id, nodeData.outputs, updateNodeData]);

  const checkIsLocal = (url: string) => {
    const trimmed = (url || '').trim().toLowerCase();
    return trimmed.includes('127.0.0.1') || trimmed.includes('localhost') || trimmed.startsWith('http://192.168.') || trimmed.startsWith('http://10.') || trimmed.startsWith('http://172.');
  };

  const sanitizeUrl = (url: string) => {
    let trimmed = (url || '').trim();
    if (!trimmed) return '';
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      trimmed = 'http://' + trimmed;
    }
    return trimmed.replace(/\/$/, '');
  };

  const handleComfyStatusCheck = async () => {
    const cleanUrl = sanitizeUrl(comfyUrl);
    if (!cleanUrl) {
      addLog('❌ 错误：ComfyUI URL 不能为空。');
      return;
    }
    const isLocal = checkIsLocal(cleanUrl);
    addLog(`Testing connection to ${cleanUrl} (${isLocal ? 'Local Mode' : 'Cloud Proxy Mode'})...`);
    setStatus(`正在拨测 ${cleanUrl} (${isLocal ? '本地' : '云端'}) 连接状态...`);

    try {
      if (isLocal) {
        // Direct local test via fetch (more precise error handling)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`${cleanUrl}/system_stats`, { 
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          addLog('✅ 成功直接连接：本地 ComfyUI 响应正常。');
          setStatus('✨ 本地连接测试成功！');
          setComfyStatus('ready');
          setShowLocalHelp(false);
        } else {
          addLog(`❌ 本地连接返回错误状态: ${response.status}`);
          setComfyStatus('error');
        }
      } else {
        const response = await axios.get('/api/comfy/status', { params: { url: cleanUrl } });
        if (response.data.ok) {
          addLog('✅ 成功建立连接：远端 ComfyUI 后端响应正常。');
          setStatus('✨ 连接测试成功！');
          setComfyStatus('ready');
        } else {
          addLog('❌ 连接失败：后端有响应但返回了错误。');
          setComfyStatus('error');
        }
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || String(error);
      
      if (isLocal) {
        addLog(`⚠️ 直接获取高级连接性能指标失败: [${errorMsg}]。正在尝试启动跨域免疫穿透检测 (CORS-immune probe)...`);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          await fetch(`${cleanUrl}/`, {
            mode: 'no-cors',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          addLog('✅ 穿透检测判定成功：本地 ComfyUI 在您电脑端响应活跃，确定已在后台成功开启运行！');
          setStatus('✨ 本地连接测试成功！');
          setComfyStatus('ready');
          setShowLocalHelp(false);
          return;
        } catch (pierceError) {
          addLog('❌ 穿透检测最终失败：本地电脑上可能并未开启 ComfyUI 软件，或者未监听该端口。');
        }
      } else {
        addLog(`❌ 远程连接服务线路中断: ${errorMsg}`);
      }
      
      if (isLocal) {
        setShowLocalHelp(true);
        if (window.location.protocol === 'https:' && !cleanUrl.startsWith('https:')) {
          addLog('⚠️ 核心原因: HTTPS 安全限制 (Mixed Content)。浏览器禁止在此加密页面请求您的 HTTP 本地地址。');
          addLog('💡 推荐方案 A: 在浏览器地址栏左侧点击“锁头”图标 -> 网站设置 -> 找到“不安全内容” -> 设置为“允许”。');
          addLog('💡 推荐方案 B: 使用 localtunnel (npx localtunnel --port 8188) 获取一个 https 地址。');
          addLog('💡 提示: 也可以搜索并安装 "Allow CORS: Access-Control-Allow-Origin" 插件。');
        } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('aborted')) {
          addLog('💡 提示: 无法获取连接信息。请确认 ComfyUI 是否已通过 --listen 启动，且允许 CORS。');
        }
      }
      setComfyStatus('error');
      setStatus('连接失败，请检查 URL 和网络环境。');
    }
  };

  const handleSyncFromLocal = async () => {
    const isLocal = comfyUrl.includes('127.0.0.1') || comfyUrl.includes('localhost');
    if (!isLocal) {
      addLog('💡 同步功能目前仅支持本地节点 (127.0.0.1)。');
      return;
    }

    addLog('正在尝试从本地 ComfyUI 同步工作流信息...');
    try {
      const response = await fetch(`${comfyUrl.replace(/\/$/, '')}/object_info`, { mode: 'cors' });
      if (response.ok) {
        const data = await response.json();
        addLog(`✅ 已从本地获取到 ${Object.keys(data).length} 个节点定义。`);
        setStatus('本地信息同步完成。若需同步具体工作流，请手动导入 JSON。');
      } else {
        addLog(`❌ 同步失败: 状态码 ${response.status}`);
      }
    } catch (e: any) {
      addLog(`❌ 同步失败: ${e.message}`);
    }
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setWorkflowText(text);
      addLog(`File ${file.name} loaded. Click "Scan" to identify nodes.`);
    };
    reader.readAsText(file);
  };

  const handleComfyScan = () => {
    try {
      const parsed = JSON.parse(workflowText);
      setWorkflowJson(parsed);
      const result = scanComfyWorkflow(parsed);
      setScanResult(result);
      updateNodeData(id, { 
        workflowJson: parsed,
        scanResult: result,
        workflowName: nodeData.workflowName || 'Default Workflow'
      });
      addLog(`Workflow scanned. Found ${result.imageInputs.length} image inputs, ${result.imageOutputs.length} outputs, and ${result.exposedParams.length} exposed parameters.`);
      setComfyStatus('ready');
    } catch (e) {
      addLog(`Failed to parse workflow JSON: ${String(e)}`);
      setComfyStatus('error');
    }
  };

  const handleComfyFieldChange = (cNodeId: string, fieldName: string, value: any) => {
    let nextWorkflowJson: any = null;

    // 1. Deep update workflowJson to ensure React picks up all internal changes
    setWorkflowJson((prev: any) => {
      const next = { ...prev };
      if (next[cNodeId] && next[cNodeId].inputs) {
        next[cNodeId] = {
          ...next[cNodeId],
          inputs: {
            ...next[cNodeId].inputs,
            [fieldName]: value
          }
        };
      }
      
      const newText = JSON.stringify(next, null, 2);
      setWorkflowText(newText);
      nextWorkflowJson = next;
      
      return next;
    });
    
    // 2. Update scanResult locally for immediate UI feedback
    setScanResult(prev => {
      const nextResult = { ...prev };
      const paramNode = nextResult.exposedParams.find(p => p.comfyNodeId === cNodeId);
      if (paramNode) {
        const field = paramNode.editableFields.find(f => f.name === fieldName);
        if (field) field.value = value;
      }
      return nextResult;
    });

    // 3. Debounce the store / node data update to prevent typing lag
    if (comfyFieldTimeoutRef.current) {
      clearTimeout(comfyFieldTimeoutRef.current);
    }
    comfyFieldTimeoutRef.current = setTimeout(() => {
      if (nextWorkflowJson) {
        updateNodeData(id, { workflowJson: nextWorkflowJson });
      }
    }, 300);

    addLog(`Updated ${fieldName} to ${typeof value === 'string' ? `"${value.slice(0, 20)}${value.length > 20 ? '...' : ''}"` : value}`);
  };

  const handleComfyRun = async () => {
    if (comfyStatus === 'running' || comfyStatus === 'uploading') return;
    
    // Check if workflow is loaded
    if (!workflowJson || Object.keys(workflowJson).length === 0) {
      addLog('❌ 运行失败：未检测到有效的工作流内容。');
      setComfyStatus('error');
      setStatus('错误：请先导入或粘贴 ComfyUI 工作流 JSON。');
      return;
    }

    const cleanUrl = sanitizeUrl(comfyUrl);
    if (!cleanUrl) {
      addLog('❌ 运行失败：未设置 ComfyUI 服务器地址。');
      setComfyStatus('error');
      setStatus('错误：必须填写有效的 ComfyUI URL。');
      return;
    }

    setComfyStatus('uploading');
    const isLocal = checkIsLocal(cleanUrl);
    addLog(`System: 正在启动执行引擎... (模式: ${isLocal ? '本地直接' : '云端代理'})`);

    try {
      const baseApiUrl = isLocal ? cleanUrl : '';

      addLog('Step 1: 正在检测输入图像与外部参数...');
      const incomingData = getIncomingData(id);
      const canvasImages = incomingData
        .filter(d => (d as any).url || (d as any).imageUrl)
        .map(d => (d as any).url || (d as any).imageUrl);
      
      // DEEP CLONE and normalize for execution payload
      let updatedWorkflow = normalizeWorkflowToPrompt(workflowJson);

      // 1. Sync Exposed Parameters
      addLog('Step 2: 正在映射参数面板数值到工作流...');
      scanResult.exposedParams.forEach(param => {
        if (updatedWorkflow[param.comfyNodeId]) {
          if (!updatedWorkflow[param.comfyNodeId].inputs) {
            updatedWorkflow[param.comfyNodeId].inputs = {};
          }
          param.editableFields.forEach(field => {
            updatedWorkflow[param.comfyNodeId].inputs[field.name] = field.value;
          });
        }
      });

      // 2. Upload Images to correct nodes
      if (canvasImages.length > 0 && scanResult.imageInputs.length > 0) {
        addLog(`Step 3: 正在准备上传图像 (检测到 ${canvasImages.length} 张输入图)...`);
        
        // Map images to LoadImage nodes sequentially
        for (let i = 0; i < Math.min(canvasImages.length, scanResult.imageInputs.length); i++) {
          const imgUrl = canvasImages[i];
          const targetNode = scanResult.imageInputs[i];
          
          addLog(`> 正在处理图像 [${i+1}] 并上传给节点 [${targetNode.title}] (ID: ${targetNode.comfyNodeId})...`);
          
          try {
            const response = await fetch(imgUrl);
            const blob = await response.blob();
            const file = new File([blob], `canvas_input_${Date.now()}_${i}.png`, { type: 'image/png' });

            const formData = new FormData();
            formData.append('image', file);
            formData.append('overwrite', 'true');

            let uploadResponse;
            if (isLocal) {
              const uploadResult = await fetch(`${baseApiUrl}/upload/image`, {
                method: 'POST',
                body: formData,
                mode: 'cors'
              });
              if (!uploadResult.ok) throw new Error(`Local upload failed: ${uploadResult.status}`);
              uploadResponse = { data: await uploadResult.json() };
            } else {
              formData.append('url', cleanUrl);
              uploadResponse = await axios.post('/api/comfy/upload-image', formData);
            }
            
            const filename = uploadResponse.data.name || uploadResponse.data.filename;
            updatedWorkflow[targetNode.comfyNodeId].inputs.image = filename;
            addLog(`✅ 图像已上传: ${filename}`);
          } catch (uploadErr: any) {
            addLog(`⚠️ 图像 [${i+1}] 上传失败: ${uploadErr.message}`);
          }
        }
      }

      setComfyStatus('running');
      addLog('🚀 Step 4: 正在提交任务至 ComfyUI API...');
      
      let promptId;
      if (isLocal) {
        const runResult = await fetch(`${baseApiUrl}/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: updatedWorkflow,
            client_id: `nv_node_${id}`
          }),
          mode: 'cors'
        });
        if (!runResult.ok) throw new Error(`Local prompt failed: ${runResult.status}`);
        const runData = await runResult.json();
        promptId = runData.prompt_id;
      } else {
        const runResponse = await axios.post('/api/comfy/run-workflow', {
          url: cleanUrl,
          workflow: updatedWorkflow,
          client_id: `nv_node_${id}`
        });
        promptId = runResponse.data.prompt_id;
      }

      setPromptId(promptId);
      addLog(`✨ 任务已成功入队！Prompt ID: ${promptId}`);
      setStatus(`正在生成中... (ID: ${promptId.slice(0,8)})`);
      pollComfyHistory(promptId, cleanUrl);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || String(error);
      const isConnectionError = errorMsg.includes('ECONNREFUSED') || 
                                errorMsg.includes('Network Error') || 
                                errorMsg.includes('timeout') || 
                                errorMsg.includes('Failed to fetch');
      
      addLog(`❌ 执行失败: ${errorMsg}`);
      setComfyStatus('error');
      setStatus(`执行故障: ${errorMsg}`);
      
      if (isLocal && (errorMsg.includes('Failed to fetch') || isConnectionError)) {
        setShowLocalHelp(true);
        if (window.location.protocol === 'https:' && !cleanUrl.startsWith('https:')) {
           addLog('⚠️ 检测到安全限制: 您的浏览器拦截了从 HTTPS (云端应用) 到 HTTP (本地) 的请求。');
           addLog('💡 必须执行以下操作才能运行：');
           addLog('  1. 在浏览器地址栏左侧点击“锁头”图标 -> 网站设置 -> 找到“不安全内容” -> 设置为“允许”。');
           addLog('  2. 或者使用 localtunnel (npx localtunnel --port 8188) 获取 https 地址。');
        } else {
           addLog('💡 请确保您的本地 ComfyUI 启动参数包含 --listen 且服务已正常开启。');
        }
      }
    }
  };

  const pollComfyHistory = async (pId: string, currentUrl: string) => {
    let attempts = 0;
    const maxAttempts = 300; // ~10 minutes timeout with 2s interval
    
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        addLog('❌ 任务超时：ComfyUI 未能在规定时间内返回结果。');
        setComfyStatus('error');
        setStatus('执行超时：ComfyUI 响应时间过长。');
        return;
      }

      try {
        const isLocal = checkIsLocal(currentUrl);
        const baseApiUrl = isLocal ? currentUrl : '';
        
        let history;
        if (isLocal) {
          const response = await fetch(`${baseApiUrl}/history/${pId}`, { mode: 'cors' });
          if (response.ok) {
             const data = await response.json();
             history = data[pId];
          }
        } else {
          const response = await axios.get(`/api/comfy/history/${pId}`, { params: { url: currentUrl } });
          history = response.data[pId];
        }

        if (history) {
          clearInterval(interval);
          addLog('✅ 工作流执行完毕。');
          const extractedImages: any[] = [];
          for (const outputNode of scanResult.imageOutputs) {
            const nodeOut = history.outputs?.[outputNode.comfyNodeId];
            if (nodeOut?.images) {
              for (const img of nodeOut.images) {
                 const url = isLocal 
                   ? `${baseApiUrl}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type || 'output'}`
                   : `/api/comfy/view?url=${encodeURIComponent(currentUrl)}&filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type || 'output'}`;
                 extractedImages.push({ ...img, url, nodeId: outputNode.comfyNodeId });
              }
            }
          }
          setOutputImages(extractedImages);
          setComfyStatus('success');
          setStatus('✨ 工作流执行成功！');
          
          // Sync extracted images to local history and global gallery
          if (extractedImages.length > 0) {
            const newImagesForScraper = [...images];
            extractedImages.forEach((img, idx) => {
              const name = `comfy_${img.filename || idx}_${Date.now()}`;
              const imgData = { 
                url: img.url, 
                name: name, 
                path: img.url, 
                source: 'comfyui' 
              };
              
              // 1. Add to node's internal history
              newImagesForScraper.push(imgData);
              
              // 2. Add to global gallery
              addFile({
                name: name,
                type: 'image',
                url: img.url
              });
            });
            
            setImages(newImagesForScraper);
            updateStore({ 
              images: newImagesForScraper,
              outputs: { 
                status: 'success', 
                images: extractedImages, 
                promptId: pId, 
                logs: logs 
              } 
            });
            addLog(`✅ 已将 ${extractedImages.length} 张生成图同步至历史记录和全局图库。`);
          } else {
            updateNodeData(id, { outputs: { status: 'success', images: extractedImages, promptId: pId, logs: logs } });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  };

  const updateStore = useCallback((updates: any) => {
    const isCloudHost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (updates.forceProxyComfy && checkIsLocal(comfyUrl) && isCloudHost) {
      alert("【⚠️ 本地连接代理警报】\n\n当前输入的 ComfyUI 是本地或局域网IP地址 (" + comfyUrl + ")。\n\n由于「服务器中转代理模式」是在我们的云端后台上部署网络请求的，云端服务器在公网上无法触连您自家的电脑网路（也无法解析本地 127.0.0.1 / localhost 节点）。因此，强行开启中转中连通常会遭遇 Connection refused (ECONNREFUSED) 错误报错。\n\n本地 IP 必须以非中转的「直连本地」模式运作。我们将代由帮您关闭该代理中转设置，并请您参考视图中间的「极速排障指南」来极速设置您的浏览器或者穿透通道进行连通。");
      setForceProxyComfy(false);
      updates.forceProxyComfy = false;
    }
    updateNodeData(id, updates);
  }, [id, updateNodeData, comfyUrl]);

  // Local address restriction: Server-side proxy cannot access loopback/internal addresses when on a cloud host.
  // We automatically revert forceProxyComfy to false if comfyUrl is a local IP and on a cloud host.
  useEffect(() => {
    const isCloudHost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (checkIsLocal(comfyUrl) && forceProxyComfy && isCloudHost) {
      setForceProxyComfy(false);
      updateStore({ forceProxyComfy: false });
    }
  }, [comfyUrl, forceProxyComfy, updateStore]);

  const handleClearHistory = useCallback(() => {
    setHistoryEntries([]);
    updateStore({ historyEntries: [] });
  }, [updateStore]);

  const handleSaveCredential = useCallback((domain: string, username: string, passwordString: string) => {
    const newCred = {
      domain: domain.trim().toLowerCase(),
      username: username.trim(),
      passwordString: passwordString.trim(),
      id: Math.random().toString(36).substring(2, 9)
    };
    setSavedCredentials(prev => {
      const updated = [...prev, newCred];
      updateStore({ savedCredentials: updated });
      return updated;
    });
  }, [updateStore]);

  const handleDeleteCredential = useCallback((id: string) => {
    setSavedCredentials(prev => {
      const updated = prev.filter(c => c.id !== id);
      updateStore({ savedCredentials: updated });
      return updated;
    });
  }, [updateStore]);

  const handleToggleForceProxy = useCallback((tabId: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (!tab) return prev;
      const currentProxied = tab.forceProxy ?? (tab.url ? shouldProxyUrl(tab.url) : false);
      const nextTabs = prev.map(t => t.id === tabId ? { ...t, forceProxy: !currentProxied } : t);
      updateStore({ tabs: nextTabs });
      return nextTabs;
    });
  }, [updateStore]);

  const handleSelectTab = useCallback((id: string) => {
    setActiveTabId(id);
    const tabObj = tabs.find(t => t.id === id);
    if (tabObj) {
      setPageUrl(tabObj.url);
      updateStore({ activeTabId: id, pageUrl: tabObj.url });
    }
  }, [tabs]);

  const handleCloseTab = useCallback((tabIdToClose: string) => {
    if (tabs.length <= 1) return;
    
    setTabs(prev => {
      const targetIndex = prev.findIndex(t => t.id === tabIdToClose);
      const nextTabs = prev.filter(t => t.id !== tabIdToClose);
      
      let nextActiveId = activeTabId;
      if (activeTabId === tabIdToClose) {
        const newActiveIndex = Math.max(0, targetIndex - 1);
        nextActiveId = nextTabs[newActiveIndex]?.id || '';
      }
      
      setActiveTabId(nextActiveId);
      const activeTabObj = nextTabs.find(t => t.id === nextActiveId);
      if (activeTabObj) {
        setPageUrl(activeTabObj.url);
      }
      
      updateStore({ 
        tabs: nextTabs, 
        activeTabId: nextActiveId,
        pageUrl: activeTabObj ? activeTabObj.url : '' 
      });
      
      return nextTabs;
    });
  }, [tabs, activeTabId]);

  const handleAddTab = useCallback((url = 'https://www.google.com', title?: string) => {
    const newId = Date.now().toString();
    const resolvedTitle = title || tryGetHostname(url) || '新标签页';
    const newTabObj = { id: newId, title: resolvedTitle, url };
    
    setTabs(prev => {
      const nextTabs = [...prev, newTabObj];
      updateStore({ 
        tabs: nextTabs, 
        activeTabId: newId,
        pageUrl: url
      });
      return nextTabs;
    });
    setActiveTabId(newId);
    setPageUrl(url);
  }, []);

  const handleBackward = useCallback(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.history.back();
      } catch (e) {
        console.warn("History back failed:", e);
      }
    }
  }, []);

  const handleForward = useCallback(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.history.forward();
      } catch (e) {
        console.warn("History forward failed:", e);
      }
    }
  }, []);

  const handleIframeLoad = useCallback((e: React.SyntheticEvent<HTMLIFrameElement>) => {
    try {
      const iframe = e.currentTarget;
      if (iframe && iframe.contentWindow) {
        const currentLoc = iframe.contentWindow.location.href;
        let realUrl = '';
        if (currentLoc.includes('/api/proxy?url=')) {
          const urlObj = new URL(currentLoc);
          const parsed = urlObj.searchParams.get('url');
          if (parsed) {
            realUrl = parsed;
          }
        } else if (currentLoc.startsWith('http://') || currentLoc.startsWith('https://')) {
          realUrl = currentLoc;
        }
        
        if (realUrl) {
          // Log visit entry to browsing history feed
          setHistoryEntries(prev => {
            if (prev.length > 0 && prev[prev.length - 1].url === realUrl) {
              return prev;
            }
            const nextHistory = [...prev, { url: realUrl, title: tryGetHostname(realUrl), timestamp: Date.now() }].slice(-100);
            updateStore({ historyEntries: nextHistory });
            return nextHistory;
          });

          setTabs(prev => {
            const activeTabObj = prev.find(t => t.id === activeTabId);
            if (activeTabObj && activeTabObj.url !== realUrl) {
              const nextTabs = prev.map(t => t.id === activeTabId ? { ...t, url: realUrl, title: tryGetHostname(realUrl) } : t);
              updateStore({ tabs: nextTabs, pageUrl: realUrl });
              return nextTabs;
            }
            return prev;
          });
          setPageUrl(realUrl);
        }
      }
    } catch (err) {
      console.warn("Failed to read iframe URL:", err);
    }
  }, [activeTabId, updateStore]);

  // Listen for iframe navigation messaging to open internal tabs for popup requests or navigate current tab
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data) {
        if (event.data.type === 'OPEN_INTERNAL_TAB') {
          const { url } = event.data;
          if (url) {
            handleAddTab(url);
          }
        } else if (event.data.type === 'OPEN_EXTERNAL_TAB') {
          const { url } = event.data;
          if (url) {
            handleAddTab(url);
          }
        } else if (event.data.type === 'NAVIGATE_CURRENT_TAB') {
          const { url } = event.data;
          if (url) {
            setTabs(prev => {
              const nextTabs = prev.map(t => t.id === activeTabId ? { ...t, url, title: tryGetHostname(url) } : t);
              updateStore({ tabs: nextTabs, pageUrl: url });
              return nextTabs;
            });
            setPageUrl(url);
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleAddTab, activeTabId, updateStore]);

  const handleNavigate = useCallback(() => {
    let url = pageUrl.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }
    const title = tryGetHostname(url);
    
    setTabs(prev => {
      const nextTabs = prev.map(t => t.id === activeTabId ? { ...t, url, title } : t);
      updateStore({ tabs: nextTabs, pageUrl: url });
      return nextTabs;
    });
    setPageUrl(url);
  }, [pageUrl, activeTabId]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleAddFavorite = useCallback((customUrl?: string) => {
    const targetUrl = customUrl ? customUrl.trim() : pageUrl;
    if (!targetUrl || favorites.includes(targetUrl)) return;
    const next = [...favorites, targetUrl];
    setFavorites(next);
    updateStore({ favorites: next });
  }, [pageUrl, favorites]);

  const handleRemoveFavorite = useCallback((url: string) => {
    const next = favorites.filter(f => f !== url);
    setFavorites(next);
    updateStore({ favorites: next });
  }, [favorites]);

  const handleBookmarkClick = useCallback((url: string) => {
    const title = tryGetHostname(url);
    setTabs(prev => {
      const nextTabs = prev.map(t => t.id === activeTabId ? { ...t, url, title } : t);
      updateStore({ tabs: nextTabs, pageUrl: url });
      return nextTabs;
    });
    setPageUrl(url);
  }, [activeTabId]);

  const handleAddOnlineImage = () => {
    const raw = (imageAddress || '').trim();
    if (!raw) {
      setStatus('请先填写“在线图像地址”。');
      return;
    }
    const urls = raw.split(/\n|,|\s+/).map(x => x.trim()).filter(Boolean).filter(x => /^https?:\/\//i.test(x));
    if (!urls.length) {
      setStatus('并未识别到有效的在线图像地址。');
      return;
    }
    const max = Math.max(1, Number(imageCount || 1));
    const newImages = [...images];
    const extracted = urls.slice(0, max);
    
    extracted.forEach((url) => {
      let name = `online_${newImages.length + 1}`;
      try {
        const u = new URL(url);
        const base = decodeURIComponent(u.pathname.split('/').pop() || '');
        if (base) name = base;
      } catch (e) {}
      
      const imgData = { url, name, path: url, source: 'online' };
      newImages.push(imgData);
      
      // Sync to global gallery
      addFile({
        name: name,
        type: 'image',
        url: url
      });
    });
    
    setImages(newImages);
    updateStore({ images: newImages });
    setImageAddress('');
    setStatus(`成功捕获 ${extracted.length} 个新资源并同步至全局。`);
  };

  const handleToggleSelect = (index: number) => {
    const set = new Set(selectedIndices);
    if (set.has(index)) set.delete(index);
    else set.add(index);
    const next = [...set].sort((a, b) => a - b);
    setSelectedIndices(next);
    updateStore({ selectedIndices: next });
  };

  const handleRemoveImage = (index: number) => {
    const nextImages = images.filter((_, i) => i !== index);
    const nextIndices = selectedIndices.filter(i => i !== index).map(i => i > index ? i - 1 : i);
    setImages(nextImages);
    setSelectedIndices(nextIndices);
    updateStore({ images: nextImages, selectedIndices: nextIndices });
  };

  const BrowserFrameComponent = (isPortal = false) => (
    <BrowserFrame 
      isPortal={isPortal}
      
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={handleSelectTab}
      onAddTab={handleAddTab}
      onCloseTab={handleCloseTab}
      pageUrl={pageUrl}
      setPageUrl={setPageUrl}
      iframeUrl={iframeUrl}
      refreshKey={refreshKey}
      favorites={favorites}
      onNavigate={handleNavigate}
      onRefresh={handleRefresh}
      onAddFavorite={handleAddFavorite}
      onRemoveFavorite={handleRemoveFavorite}
      onBookmarkClick={handleBookmarkClick}
      onToggleOverlay={setIsOverlayOpen}
      onOpenExternal={() => handleAddTab(iframeUrl || pageUrl)}
      onBackward={handleBackward}
      onForward={handleForward}
      historyEntries={historyEntries}
      onClearHistory={handleClearHistory}
      savedCredentials={savedCredentials}
      onSaveCredential={handleSaveCredential}
      onDeleteCredential={handleDeleteCredential}
      iframeRef={iframeRef}
      onIframeLoad={handleIframeLoad}
      onToggleForceProxy={handleToggleForceProxy}
      isFolded={isFolded}
      setIsFolded={setIsFolded}
      isPinned={isPinned}
      setIsPinned={setIsPinned}
      setPinnedPos={setPinnedPos}
    />
  );

  const ComfyUIOverlay = () => (
    <div className="w-full h-full flex flex-col bg-[var(--bg-secondary)] rounded-[32px] overflow-hidden shadow-2xl border border-[var(--border)]">
      <div className="bg-black/60 px-8 py-5 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
           <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center shadow-lg">
             <CloudLightning size={24} className="text-white" />
           </div>
           <div>
             <h3 className="text-lg font-black text-white tracking-widest uppercase italic">ComfyUI Full Control</h3>
             <span className="text-base font-mono text-gray-600 tracking-widest">BRIDGE_TERMINAL_V1.3</span>
           </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all flex items-center gap-3"
          >
            <RefreshCw size={20} />
            <span className="text-sm font-black uppercase tracking-widest px-2">Refresh View</span>
          </button>
          <button 
            onClick={() => setIsOverlayOpen(false)}
            className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all"
          >
            <Minimize2 size={20} />
          </button>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <iframe 
          key={`${refreshKey}-portal`}
          src={forceProxyComfy ? `/api/proxy?url=${encodeURIComponent(comfyUrl)}` : comfyUrl}
          className="w-full h-full border-none"
        />
      </div>
    </div>
  );

  return (
    <>
      {/* ALWAYS ACTIVE WEB BROWSER PORTAL CONTAINER */}
      {createPortal(
        <div 
          onMouseEnter={() => {
            if (!isPinned) {
              useStore.getState().setIsTopVisible(true);
            }
          }}
          onMouseLeave={() => {
            if (!isPinned) {
              useStore.getState().setIsTopVisible(false);
            }
          }}
          onPointerDown={e => {
            e.stopPropagation();
            if (isPinned) handlePinnedHeaderPointerDown(e);
          }}
          onPointerMove={e => {
            if (isPinned) handlePinnedHeaderPointerMove(e);
          }}
          onPointerUp={e => {
            if (isPinned) handlePinnedHeaderPointerUp(e);
          }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          className="fixed overflow-hidden shadow-2xl bg-[var(--bg-secondary)] flex flex-col"
          style={
            isOverlayOpen 
              ? {
                  left: '48px',
                  top: '12%',
                  width: 'calc(100vw - 96px)',
                  height: '80%',
                  zIndex: 10001,
                  pointerEvents: 'auto',
                  display: showWebPreview ? 'flex' : 'none',
                  borderRadius: '24px',
                  border: '1px solid var(--border)',
                  transform: 'none',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }
              : (isPinned
                  ? {
                      left: `${pinnedPos.x}px`,
                      top: `${pinnedPos.y}px`,
                      width: '800px',
                      height: isFolded ? '68px' : '600px',
                      zIndex: 10002,
                      pointerEvents: showWebPreview ? 'auto' : 'none',
                      display: showWebPreview ? 'flex' : 'none',
                      borderRadius: '24px',
                      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85), 0 0 25px rgba(234,179,8,0.2)',
                      border: '2px solid rgba(234,179,8,0.45)',
                      transition: 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      overflow: 'hidden',
                    }
                  : {
                      left: '50%',
                      top: '64px',
                      width: '80vw',
                      maxWidth: '1400px',
                      height: isFolded ? '68px' : 'min(75vh, 900px)',
                      transform: `translateX(-50%) translateY(${isPinned ? '0' : (isTopVisible ? '0' : 'calc(-100% - 64px)')})`,
                      opacity: isPinned ? 1 : (isTopVisible ? 1 : 0),
                      zIndex: isPinned ? 40 : 39,
                      pointerEvents: (showWebPreview && (isPinned || isTopVisible)) ? 'auto' : 'none',
                      display: showWebPreview ? 'flex' : 'none',
                      borderRadius: isPinned ? '16px' : '0 0 16px 16px',
                      border: '1px solid var(--border)',
                      borderTop: isPinned ? '1px solid var(--border)' : 'none',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      overflow: 'hidden',
                      boxShadow: isTopVisible || isPinned ? '0 25px 50px -12px rgba(0,0,0,0.5)' : 'none',
                    }
                )
          }
        >
          {/* Header */}
          <div 
            className="border-b border-[var(--border)] flex items-center justify-between bg-black/40 shrink-0 rounded-t-2xl"
            style={{ padding: '12px 20px', cursor: isPinned ? 'move' : 'default' }}
          >
            <div 
              className="flex items-center"
              style={{ gap: 16 }}
            >
              <div 
                className={`rounded-2xl flex items-center justify-center shadow-lg transition-all bg-indigo-600`}
                style={{ width: 44, height: 44 }}
              >
                <Globe2 size={22} className="text-white" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <h3 
                    className="font-black text-white tracking-widest uppercase italic"
                    style={{ fontSize: 13 }}
                  >
                    网页预览面板
                  </h3>
                  {isPinned && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/30 text-[10px] font-black text-yellow-400 tracking-wider font-mono">
                      <Pin size={10} className="animate-pulse text-yellow-500" />
                      <span>已固定</span>
                    </div>
                  )}
                </div>
                <div 
                  className="flex items-center font-mono text-gray-500 tracking-widest"
                  style={{ gap: 8, fontSize: 10 }}
                >
                  <span>V2.0 WEB_PREVIEW_BRIDGE</span>
                </div>
              </div>
            </div>
            
            <div 
              className="flex items-center"
              style={{ gap: 8 }}
            >
              {/* 顶层状态组件：折叠和固定 */}
              <button 
                onClick={() => setIsOverlayOpen(!isOverlayOpen)}
                className="hover:bg-white/5 rounded-2xl text-gray-500 hover:text-white transition-all transform hover:scale-105 active:scale-95"
                style={{ padding: 10 }}
                title={isOverlayOpen ? "退出全屏" : "全屏脱离画布"}
              >
                {isOverlayOpen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>

              <button 
                onClick={() => {
                  const nextPinned = !isPinned;
                  setIsPinned(nextPinned);
                  if (nextPinned) {
                    setPinnedPos({ x: window.innerWidth / 2 - 400, y: 150 });
                    useStore.getState().setIsTopVisible(false);
                  } else {
                    useStore.getState().setIsTopVisible(true);
                  }
                }}
                className={`hover:bg-white/5 rounded-2xl transition-all transform hover:scale-105 active:scale-95 ${isPinned ? 'text-yellow-400 bg-yellow-500/15' : 'text-gray-500 hover:text-white'}`}
                style={{ padding: 10 }}
                title={isPinned ? "取消视口固定" : "固定在当前位置"}
              >
                {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
              </button>

              <button 
                onClick={() => setIsFolded(!isFolded)}
                className={`hover:bg-white/5 rounded-2xl transition-all transform hover:scale-105 active:scale-95 ${isFolded ? 'text-indigo-400 bg-indigo-400/10' : 'text-gray-500 hover:text-white'}`}
                style={{ padding: 10 }}
                title={isFolded ? "展开窗口" : "折叠最小化窗口"}
              >
                {isFolded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>

              <div className="w-px h-4 bg-[var(--border)] mx-1" />

              <button 
                onClick={() => useStore.getState().toggleWebPreview()}
                className="hover:bg-red-500/20 rounded-2xl text-gray-500 hover:text-red-400 transition-all transform hover:scale-105 active:scale-95"
                style={{ padding: 10 }}
                title="关闭面板"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {!isFolded && BrowserFrameComponent(isOverlayOpen)}
        </div>,
        document.body
      )}

      {/* FULLSCREEN OVERLAY BACKGROUND */}
      {(showWebPreview && isOverlayOpen) && createPortal(
        <div 
          className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-3xl" 
          onPointerDown={e => e.stopPropagation()}
          onClick={() => setIsOverlayOpen(false)}
        >
          <div className="absolute top-4 right-12 text-gray-500 font-bold select-none text-xs tracking-widest pointer-events-none uppercase">
            点击空白区域退出全屏
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
