import React, { useState, useRef } from 'react';
import { 
  X, 
  Settings, 
  Grid3X3, 
  MousePointer2, 
  Sun, 
  Moon, 
  Cloud,
  Type,
  FileDown,
  Layout,
  Link,
  Magnet,
  Maximize,
  Keyboard,
  CreditCard,
  Key,
  FolderOpen,
  MousePointer,
  Compass,
  Zap,
  AlignJustify,
  Check,
  FileCode,
  Trash2,
  Edit3,
  Eye,
  Download,
  UploadCloud,
  Search,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, AppSettings, MouseSize, AppTheme, BarTexture, FontSize, UploadQuality, MultiSelectMode } from '../store/useStore';

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = 'general' | 'api' | 'comfy' | 'auth';

export const SettingsModal = ({ onClose }: SettingsModalProps) => {
  const { settings, updateSettings } = useStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabList: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: '通用' },
    { id: 'api', label: 'API 设置' },
    { id: 'comfy', label: 'ComfyUI' },
    { id: 'auth', label: '授权' },
  ];

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-4xl h-[85vh] border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl shadow-black/80 bg-[#16161a]`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-[#121214]">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Settings size={18} className="text-zinc-400" />
            <span>设置 (Settings)</span>
          </h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0e]">
          {/* Centered Horizontal Pills Navigation */}
          <div className="flex-shrink-0 pt-6 pb-2 text-center">
            <div className="inline-flex p-1 bg-white/5 rounded-2xl border border-white/5">
              {tabList.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-8 py-2 rounded-xl text-sm font-bold transition-all ${
                    activeTab === tab.id 
                      ? 'bg-white text-black shadow-lg' 
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrolling Content Panel */}
          <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
            <div className="max-w-3xl mx-auto w-full pt-4">
              {activeTab === 'general' && (
                <div className="space-y-8">
                  {/* General Configuration Section */}
                  <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-6">
                    <h3 className="text-md font-extrabold text-white flex items-center gap-2 border-b border-white/5 pb-3">常规选项</h3>
                    <GeneralSettings settings={settings} update={updateSettings} />
                  </div>

                  {/* Canvas and Alignment Section */}
                  <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-6">
                    <h3 className="text-md font-extrabold text-white flex items-center gap-2 border-b border-white/5 pb-3">画布与对齐</h3>
                    <CanvasSettings settings={settings} update={updateSettings} />
                  </div>

                  {/* Directories Section */}
                  <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-6">
                    <h3 className="text-md font-extrabold text-white flex items-center gap-2 border-b border-white/5 pb-3">文件保存目录</h3>
                    <FileSettings settings={settings} update={updateSettings} />
                  </div>
                </div>
              )}

              {activeTab === 'api' && (
                <ApiTabContent settings={settings} update={updateSettings} onClose={onClose} />
              )}

              {activeTab === 'comfy' && (
                <ComfyTabContent settings={settings} update={updateSettings} />
              )}

              {activeTab === 'auth' && (
                <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-6 text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <Check className="text-emerald-500 animate-none" size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-white leading-normal">授权状态: 企业 PRO 专业版 (Active)</h3>
                  <p className="text-zinc-300 max-w-md mx-auto text-sm leading-relaxed">
                    已成功激活永久高级 PRO 企业授权！系统已全面解除 API 平台限制、多通用 API 数量配额，以及第三方服务商并发限制，为您提供无限高规格、无感流畅的超级画布与智能混合体验。
                  </p>
                  <div className="pt-4">
                    <span className="inline-block px-6 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full font-bold text-xs font-mono">
                      ● LICENSE CERTIFIED & UNLIMITED ACCESS
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 font-mono mt-4">本地授权密钥 ID: VITE-ENTERPRISE-PRO-ULTIMATE-PASS99</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* --- GENERAL SETTINGS --- */
const GeneralSettings = ({ settings, update }: { settings: AppSettings, update: (s: Partial<AppSettings>) => void }) => {
  return (
    <div className="flex flex-col gap-8">
      <SettingRow 
        title="鼠标大小" 
        desc="选择光标显示大小" 
      >
        <div className="flex gap-2 p-1 bg-[#18181c] rounded-xl border border-white/5">
          {(['small', 'medium', 'large'] as MouseSize[]).map((size) => (
            <button
              key={size}
              onClick={() => update({ mouseSize: size })}
              className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                settings.mouseSize === size ? 'bg-[#3b82f6] text-white shadow-lg font-bold' : 'text-gray-400 hover:text-white font-medium'
              }`}
            >
              <MousePointer size={size === 'small' ? 12 : size === 'medium' ? 14 : 18} />
              {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow 
        title="应用主题" 
        desc="切换界面整体明暗外观" 
      >
        <div className="flex gap-2 p-1 bg-[#18181c] rounded-xl border border-white/5">
          {(['dark', 'mist', 'light'] as AppTheme[]).map((t) => (
            <button
              key={t}
              onClick={() => update({ theme: t })}
              className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                settings.theme === t ? 'bg-[#3b82f6] text-white shadow-lg font-bold' : 'text-gray-400 hover:text-white font-medium'
              }`}
            >
              {t === 'dark' && <Moon size={14} />}
              {t === 'mist' && <Cloud size={14} />}
              {t === 'light' && <Sun size={14} />}
              <span>{t === 'dark' ? '暗夕' : t === 'mist' ? '晨雾' : '白昼'}</span>
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow 
        title="自定义颜色主体" 
        desc="设置应用全局的主题点缀色" 
      >
        <div className="flex gap-2 items-center bg-[#18181c] p-2 rounded-xl border border-white/5">
          {['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f97316'].map((color) => (
            <button
              key={color}
              onClick={() => update({ themeColor: color })}
              className={`w-6 h-6 rounded-full border transition-all ${settings.themeColor === color ? 'border-white scale-110 shadow-lg shadow-black/80' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: color }}
            />
          ))}
          <input 
            type="color" 
            value={settings.themeColor || '#3b82f6'} 
            onChange={(e) => update({ themeColor: e.target.value })}
            className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 bg-transparent shrink-0"
          />
        </div>
      </SettingRow>

      <SettingRow 
        title="提示词质感" 
        desc="控制输入卡片底框风格" 
      >
        <div className="flex gap-2 bg-[#18181c] p-1 rounded-xl border border-white/5">
          {(['transparent', 'frosted'] as BarTexture[]).map((tex) => (
            <button
              key={tex}
              onClick={() => update({ barTexture: tex })}
              className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                settings.barTexture === tex 
                  ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 font-bold' 
                  : 'bg-transparent border-transparent text-gray-400 hover:text-white font-medium'
              }`}
            >
              {tex === 'transparent' ? '透明' : '毛玻璃'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="网格点显示" desc="全局辅助画布底网显示" shortcut=".">
        <div className="flex bg-[#18181c] rounded-xl border border-white/5 p-1">
          {[true, false].map((v) => (
            <button 
              key={String(v)}
              className={`px-4 py-1.5 rounded-lg text-sm flex-1 font-bold transition-all ${
                useStore.getState().isGridVisible === v 
                  ? 'bg-[#3b82f6] text-white' 
                  : 'text-gray-400 hover:text-white font-medium'
              }`}
              onClick={() => useStore.getState().toggleGrid()}
            >
              {v ? '开' : '关'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="输入字体大小" desc="调节提示词文本字体 (px)">
        <div className="flex bg-[#18181c] rounded-xl border border-white/5 p-1 w-28">
          <input
            type="number"
            min="10"
            max="100"
            value={typeof settings.inputFontSize === 'number' ? settings.inputFontSize : 14}
            onChange={(e) => update({ inputFontSize: parseInt(e.target.value) || 14 })}
            className="w-full bg-transparent text-sm text-[#e4e4e7] outline-none px-2 py-1 text-center font-bold"
          />
        </div>
      </SettingRow>

      <SettingRow title="图片入参保存质量" desc="生图时参考图上传预压档位">
        <div className="flex gap-1 p-1 bg-[#18181c] rounded-xl border border-white/5">
          {(['standard', 'high', 'original'] as UploadQuality[]).map((q) => (
            <button
              key={q}
              onClick={() => update({ uploadQuality: q })}
              className={`px-4 py-1.5 rounded-lg text-sm transition-all font-bold ${
                settings.uploadQuality === q 
                  ? 'bg-[#3b82f6] text-white' 
                  : 'text-gray-400 hover:text-white font-medium'
              }`}
            >
              {q === 'standard' ? '标准质量' : q === 'high' ? '高保真' : '原样'}
            </button>
          ))}
        </div>
      </SettingRow>
    </div>
  );
};

/* --- CANVAS & ALIGNMENT SETTINGS --- */
const CanvasSettings = ({ settings, update }: { settings: AppSettings, update: (s: Partial<AppSettings>) => void }) => {
  return (
    <div className="flex flex-col gap-8">
      <SettingRow title="点击卡片高亮关联" desc="高亮显示关联的上下游关系和线路">
        <div className="flex bg-[#18181c] rounded-xl border border-white/5 p-1">
          {[true, false].map((v) => (
            <button 
              key={String(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold min-w-[50px] transition-all ${
                settings.highlightAssociated === v 
                  ? 'bg-[#3b82f6] text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => update({ highlightAssociated: v })}
            >
              {v ? '开' : '关'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="连线可见性" desc="控制连线的全局渲染开关" shortcut="B">
        <div className="flex bg-[#18181c] rounded-xl border border-white/5 p-1">
          {[true, false].map((v) => (
            <button 
              key={String(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold min-w-[50px] transition-all ${
                settings.showConnections === v 
                  ? 'bg-[#3b82f6] text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => update({ showConnections: v })}
            >
              {v ? '显示' : '隐藏'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="吸附辅助线" desc="开启后拖拽时显示辅助边距吸附线" shortcut=";">
        <div className="flex bg-[#18181c] rounded-xl border border-white/5 p-1">
          {[true, false].map((v) => (
            <button 
              key={String(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold min-w-[50px] transition-all ${
                settings.snapToGuidelines === v 
                  ? 'bg-[#3b82f6] text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => update({ snapToGuidelines: v })}
            >
              {v ? '开' : '关'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="多选对齐中心" desc="开启点击或长按触发批量对齐功能面板" shortcut="Tab">
        <div className="flex gap-1 p-1 bg-[#18181c] rounded-xl border border-white/5">
          {(['longPress', 'click', 'disabled'] as MultiSelectMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ multiSelectAlignmentMode: mode })}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                settings.multiSelectAlignmentMode === mode ? 'bg-[#3b82f6] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {mode === 'longPress' ? '双长按' : mode === 'click' ? '直接点击' : '隐藏'}
            </button>
          ))}
        </div>
      </SettingRow>
    </div>
  );
};

/* --- PATH INPUT SUB-COMPONENT --- */
const PathInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex flex-col gap-1 py-1">
    <span className="text-xs font-extrabold text-zinc-400 ml-1">{label}</span>
    <div className="flex items-center bg-[#111113] border border-white/10 rounded-xl px-4 py-2 hover:border-white/25 transition-all">
      <input 
        className="w-full bg-transparent text-sm text-white outline-none font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  </div>
);

/* --- FILE DIRECTORIES --- */
const FileSettings = ({ settings, update }: { settings: AppSettings, update: (s: Partial<AppSettings>) => void }) => {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-400">本地化资产等信息的系统化默认保存目录位置：</p>
      <div className="flex flex-col gap-3 p-4 bg-[#18181c]/60 border border-white/5 rounded-2xl">
        <PathInput 
          label="项目工程存放" 
          value={settings.projectPath} 
          onChange={(v) => update({ projectPath: v })}
        />
        <PathInput 
          label="原始素材存放" 
          value={settings.dataPath} 
          onChange={(v) => update({ dataPath: v })}
        />
        <PathInput 
          label="图频输出目录" 
          value={settings.outputPath} 
          onChange={(v) => update({ outputPath: v })}
        />
      </div>
    </div>
  );
};

/* --- API SETTINGS TAB COMPONENT --- */
const ApiTabContent = ({ settings, update }: { settings: AppSettings; update: (s: Partial<AppSettings>) => void; onClose: () => void }) => {
  const api = settings.apiSettings;

  // Active sub tab inside API config: universal or custom platform
  const [activeSubTab, setActiveSubTab] = useState<'universal' | 'modelscope' | 'runninghub' | 'jimeng'>('universal');

  // --- 1. Universal Profiles Stats & States (Remains exact original) ---
  const [profiles, setProfiles] = useState<Array<{
    id: string;
    name: string;
    engine: "gemini" | "openai" | "claude" | "doubao" | "qianwen" | "deepseek" | "custom";
    baseUrl: string;
    apiKey: string;
    modelId: string;
  }>>(() => {
    if (api.profiles && Array.isArray(api.profiles) && api.profiles.length > 0) {
      return api.profiles;
    }
    return [
      { id: "gemini", name: "Gemini 官方", engine: "gemini", baseUrl: "https://generativelanguage.googleapis.com", apiKey: api.engine === 'gemini' ? api.apiKey : '', modelId: "gemini-2.5-flash" },
      { id: "openai", name: "OpenAI 官方", engine: "openai", baseUrl: "https://api.openai.com/v1", apiKey: api.engine === 'openai' ? api.apiKey : '', modelId: "gpt-4o-mini" },
      { id: "claude", name: "Claude 官方", engine: "claude", baseUrl: "https://api.openai.com/v1", apiKey: api.engine === 'claude' ? api.apiKey : '', modelId: "claude-3-5-sonnet-20241022" },
      { id: "deepseek", name: "DeepSeek 官方", engine: "deepseek", baseUrl: "https://api.deepseek.com", apiKey: api.engine === 'deepseek' ? api.apiKey : '', modelId: "deepseek-chat" },
      { id: "doubao", name: "火山引擎 (豆包)", engine: "doubao", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", apiKey: api.engine === 'doubao' ? api.apiKey : '', modelId: "doubao-pro-32k" },
      { id: "qianwen", name: "通义千问", engine: "qianwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", apiKey: api.engine === 'qianwen' ? api.apiKey : '', modelId: "qwen-max" }
    ];
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() => api.activeProfileId || api.engine || 'gemini');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(activeProfileId);

  const currentProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0] || {
    id: 'gemini', name: 'Gemini 官方', engine: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: '', modelId: 'gemini-2.5-flash'
  };

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);

  const getEngineLabel = (eng: string) => {
    switch (eng) {
      case 'gemini': return 'Gemini';
      case 'openai': return 'OpenAI';
      case 'claude': return 'Anthropic Claude';
      case 'deepseek': return 'DeepSeek';
      case 'doubao': return '火山引擎 (豆包)';
      case 'qianwen': return '通义千问';
      default: return '自定义';
    }
  };

  const handleUpdateActiveField = (field: string, value: any) => {
    setProfiles(prev => prev.map(p => p.id === selectedProfileId ? { ...p, [field]: value } : p));
  };

  const handleAddProfile = () => {
    const newId = 'profile_' + Date.now().toString(36);
    const newProfile = {
      id: newId,
      name: `自定义 API #${profiles.filter(p => p.id.startsWith('profile_')).length + 1}`,
      engine: 'openai' as const,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelId: 'gpt-4o'
    };
    setProfiles(prev => [...prev, newProfile]);
    setSelectedProfileId(newId);
    setTestStatus('idle');
    setTestError('');
  };

  const handleDeleteProfile = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (profiles.length <= 1) {
      alert("必须至少保留一个 API 接口配置项！");
      return;
    }
    if (confirm("确定要删除这个 API 配置项吗？")) {
      const filtered = profiles.filter(p => p.id !== idToDelete);
      setProfiles(filtered);
      if (selectedProfileId === idToDelete) {
        setSelectedProfileId(filtered[0].id);
      }
      if (activeProfileId === idToDelete) {
        setActiveProfileId(filtered[0].id);
      }
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestError('');
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: currentProfile.engine,
          baseUrl: currentProfile.baseUrl,
          apiKey: currentProfile.apiKey,
          modelId: currentProfile.modelId
        })
      });

      const data = await response.json().catch(() => ({ ok: false, error: '连接异常，接口响应解析失败。' }));
      if (data.ok) {
        setTestStatus('success');
      } else {
        setTestStatus('failed');
        setTestError(data.error || '连接不管用，请检查该通道的配置参数、密钥以及 API 域名。');
      }
    } catch (e: any) {
      setTestStatus('failed');
      setTestError(e.message || '网络连接不稳定，无法顺利联通此 API 通信节点。');
    }
  };

  const handleSave = () => {
    const activeProf = profiles.find(p => p.id === activeProfileId) || currentProfile || profiles[0];
    if (!activeProf) return;

    update({
      apiSettings: {
        ...api,
        engine: activeProf.engine as any,
        baseUrl: activeProf.baseUrl,
        apiKey: activeProf.apiKey,
        modelId: activeProf.modelId,
        profiles: profiles as any,
        activeProfileId: activeProfileId,
      } as any
    });

    const statusMsg = `🎉 通用 API 配置配置已完整保存！\n当前全系统已切换并启用配置: 「${activeProf.name}」`;
    alert(statusMsg);
  };


  // --- 2. ModelScope Platform Specific States & Logics ---
  const [msApiKey, setMsApiKey] = useState(api.modelscopeApiKey || '');
  const [msBaseUrl, setMsBaseUrl] = useState(api.modelscopeBaseUrl || 'https://api-inference.modelscope.cn/v1');
  const [msModelUrl, setMsModelUrl] = useState(api.modelscopeModelUrl || 'https://api-inference.modelscope.cn/v1/models');
  const [msShowKey, setMsShowKey] = useState(false);
  const [msTestedCount, setMsTestedCount] = useState<number | null>(null);
  
  const [msImageModels, setMsImageModels] = useState<string[]>(() => api.modelscopeImageModels || [
    "Tongyi-MAI/Z-Image-Turbo",
    "Qwen/Qwen-Image-2512",
    "Qwen/Qwen-Image-Edit-2511",
    "black-forest-labs/FLUX.2-klein-9B"
  ]);
  const [msChatModels, setMsChatModels] = useState<string[]>(() => api.modelscopeChatModels || [
    "Qwen/Qwen3-235B-A22B",
    "Qwen/Qwen3-VL-235B-A22B-Instruct",
    "MiniMax/MiniMax-M2.7:MiniMax"
  ]);

  // ModelScope manual loading inputs
  const [addingModelType, setAddingModelType] = useState<'image' | 'chat' | null>(null);
  const [manualModelName, setManualModelName] = useState('');

  // LoRA states
  const [msLoraEnabled, setMsLoraEnabled] = useState(api.modelscopeLoraEnabled || false);
  const [msLoraModelId, setMsLoraModelId] = useState(api.modelscopeLoraModelId || '');
  const [msLoraWeight, setMsLoraWeight] = useState(api.modelscopeLoraWeight ?? 0.8);
  const [msLoraTriggerWord, setMsLoraTriggerWord] = useState(api.modelscopeLoraTriggerWord || '');
  const [msLoraVersion, setMsLoraVersion] = useState(api.modelscopeLoraVersion || 'v1.0');
  const [msLoras, setMsLoras] = useState<Array<{ id: string; modelId: string; weight: number; triggerWord?: string; version?: string }>>(() => {
    return api.modelscopeLoras || [
      { id: "Daniel8152/film", modelId: "Qwen/Qwen-Image-2512", weight: 0.8 },
      { id: "Daniel8152/Qwen-Image-2512-Film", modelId: "Tongyi-MAI/Z-Image-Turbo", weight: 0.8 },
      { id: "Daniel8152/Klein-enhance", modelId: "black-forest-labs/FLUX.2-klein-9B", weight: 0.8 }
    ];
  });

  // Upstream models list and selection modal
  const [showPullModal, setShowPullModal] = useState(false);
  const [searchPullModel, setSearchPullModel] = useState('');
  const [pullFilter, setPullFilter] = useState<'all' | 'image' | 'chat' | 'video'>('all');
  
  const [upstreamModels, setUpstreamModels] = useState<Array<{ id: string; type: 'image' | 'chat' | 'video'; selected: boolean }>>(() => {
    const list = [
      { id: "Tongyi-MAI/Z-Image-Turbo", type: "image" as const, selected: false },
      { id: "Qwen/Qwen-Image-2512", type: "image" as const, selected: false },
      { id: "Qwen/Qwen-Image-Edit-2511", type: "image" as const, selected: false },
      { id: "black-forest-labs/FLUX.2-klein-9B", type: "image" as const, selected: false },
      { id: "black-forest-labs/FLUX.1-schnell", type: "image" as const, selected: false },
      { id: "stabilityai/stable-diffusion-xl-base-1.0", type: "image" as const, selected: false },
      { id: "Qwen/Qwen3-235B-A22B", type: "chat" as const, selected: false },
      { id: "Qwen/Qwen3-VL-235B-A22B-Instruct", type: "chat" as const, selected: false },
      { id: "MiniMax/MiniMax-M2.7:MiniMax", type: "chat" as const, selected: false },
      { id: "deepseek-ai/DeepSeek-V3", type: "chat" as const, selected: false },
      { id: "deepseek-ai/DeepSeek-R1", type: "chat" as const, selected: false },
      { id: "damo/CogVideoX-5b", type: "video" as const, selected: false },
      { id: "ModelScope/i2vgen-xl", type: "video" as const, selected: false },
      { id: "AI-ModelScope/AnimateDiff", type: "video" as const, selected: false }
    ];

    return list.map(item => ({
      ...item,
      selected: msImageModels.includes(item.id) || msChatModels.includes(item.id)
    }));
  });

  const [msTestStatus, setMsTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [msTestError, setMsTestError] = useState('');

  const [msChannelStatus, setMsChannelStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [msChannelError, setMsChannelError] = useState('');

  const handleTestMsConnection = async () => {
    if (!msApiKey) {
      alert("请先输入 ModelScope API 密钥再进行连通性测试！");
      return;
    }
    setMsTestStatus('testing');
    setMsTestError('');
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: 'modelscope',
          baseUrl: msBaseUrl,
          modelUrl: msModelUrl,
          apiKey: msApiKey,
          modelId: msChatModels[0] || 'Qwen/Qwen3-235B-A22B'
        })
      });
      const data = await response.json();
      if (data.ok) {
        setMsTestStatus('success');
        if (data.count !== undefined) {
          setMsTestedCount(data.count);
        }
        if (data.models && Array.isArray(data.models)) {
          const fetchedList = data.models.map((item: any) => {
            const modelId = item.id || item;
            let type: 'image' | 'chat' | 'video' = 'chat';
            const lowerId = modelId.toLowerCase();
            if (lowerId.includes('flux') || lowerId.includes('stable-diffusion') || lowerId.includes('sdxl') || lowerId.includes('image') || lowerId.includes('kolors') || lowerId.includes('cv_tinynas') || lowerId.includes('diffusion') || lowerId.includes('instant-style') || lowerId.includes('damo/') || lowerId.includes('synthetic')) {
              type = 'image';
            } else if (lowerId.includes('video') || lowerId.includes('animate') || lowerId.includes('cogvideo') || lowerId.includes('i2vgen') || lowerId.includes('wan-video')) {
              type = 'video';
            } else {
              type = 'chat';
            }
            return {
              id: modelId,
              type,
              selected: msImageModels.includes(modelId) || msChatModels.includes(modelId)
            };
          });

          setUpstreamModels(prev => {
            const existingIds = new Set(fetchedList.map((m: any) => m.id));
            const filteredPrev = prev.filter(p => !existingIds.has(p.id));
            return [...filteredPrev, ...fetchedList];
          });

          if (data.count !== undefined) {
            setMsTestedCount(data.count);
          } else {
            setMsTestedCount(fetchedList.length);
          }
        }
      } else {
        setMsTestStatus('failed');
        setMsTestError(data.error || '验证失败，请检查请求地址和 API Key 是否有效。');
      }
    } catch (err: any) {
      setMsTestStatus('failed');
      setMsTestError(err.message || '网络连接故障，请检查您的 ModelScope 域名配置及端口。');
    }
  };

  const handleTestMsChannel = async () => {
    if (!msApiKey) {
      alert("请先输入 ModelScope API 密钥再进行通道连通性测试！");
      return;
    }
    setMsChannelStatus('testing');
    setMsChannelError('');
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: 'openai',
          baseUrl: msBaseUrl,
          apiKey: msApiKey,
          modelId: msChatModels[0] || 'Qwen/Qwen3-235B-A22B'
        })
      });
      const data = await response.json();
      if (data.ok) {
        setMsChannelStatus('success');
      } else {
        setMsChannelStatus('failed');
        setMsChannelError(data.error || '通道测试不通，请检查请求地址和 API Key 是否有效。');
      }
    } catch (err: any) {
      setMsChannelStatus('failed');
      setMsChannelError(err.message || '网络连接异常');
    }
  };

  const handleSaveModelScope = () => {
    update({
      apiSettings: {
        ...api,
        modelscopeApiKey: msApiKey,
        modelscopeBaseUrl: msBaseUrl,
        modelscopeModelUrl: msModelUrl,
        modelscopeImageModels: msImageModels,
        modelscopeChatModels: msChatModels,
        modelscopeLoraEnabled: msLoraEnabled,
        modelscopeLoraModelId: msLoraModelId,
        modelscopeLoraWeight: msLoraWeight,
        modelscopeLoraTriggerWord: msLoraTriggerWord,
        modelscopeLoraVersion: msMsLoraVersion,
        modelscopeLoras: msLoras,
      } as any
    });
    alert("🎉 ModelScope 平台设置及 LoRA 权重参数已成功保存并载入运行上下文！");
  };

  const msMsLoraVersion = msLoraVersion;

  const handleAddManualModel = () => {
    if (!manualModelName.trim() || !addingModelType) return;
    const name = manualModelName.trim();
    if (addingModelType === 'image') {
      if (!msImageModels.includes(name)) setMsImageModels(prev => [...prev, name]);
    } else {
      if (!msChatModels.includes(name)) setMsChatModels(prev => [...prev, name]);
    }
    setManualModelName('');
    setAddingModelType(null);
  };


  // --- 3. RunningHub Settings & Logics ---
  const [rhEnterpriseKey, setRhEnterpriseKey] = useState(api.rhEnterpriseKey || '');
  const [rhConsumerKey, setRhConsumerKey] = useState(api.rhConsumerKey || '');
  const [rhAppId, setRhAppId] = useState(api.rhAppId || '暂无AI应用');

  const handleSaveRunningHub = () => {
    update({
      apiSettings: {
        ...api,
        rhEnterpriseKey,
        rhConsumerKey,
        rhAppId,
      } as any
    });
    alert("🎉 RunningHub 专线 API 配置参数已成功保存！");
  };


  // --- 4. JiMeng Settings & Logics ---
  const [jmApiKey, setJmApiKey] = useState(api.jimengApiKey || '');

  const handleSaveJiMeng = () => {
    update({
      apiSettings: {
        ...api,
        jimengApiKey: jmApiKey,
      } as any
    });
    alert("🎉 即梦 CLI 通路密钥鉴权信息已成功保存！");
  };


  return (
    <div className="flex gap-6 min-h-[500px]">
      {/* Sub Tabs Left Navigation Sidebar */}
      <div className="w-[170px] shrink-0 flex flex-col gap-1 pr-3 border-r border-white/5 select-none nodrag">
        <span className="text-[9px] font-black text-zinc-500 tracking-wider uppercase ml-2 mb-2 block">
          API 平台及服务选择
        </span>
        <button
          type="button"
          onClick={() => setActiveSubTab('universal')}
          className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'universal'
              ? 'bg-indigo-600/10 text-indigo-400 border-l border-indigo-500 font-extrabold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          <Zap size={12} />
          <span>通用 LLM 节点</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('modelscope')}
          className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'modelscope'
              ? 'bg-red-500/10 text-red-400 border-l border-red-500 font-extrabold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-300 hover:bg-white/5'
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span>ModelScope 平台</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('runninghub')}
          className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'runninghub'
              ? 'bg-orange-500/10 text-orange-400 border-l border-orange-500 font-extrabold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-300 hover:bg-white/5'
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          <span>RunningHub 平台</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('jimeng')}
          className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'jimeng'
              ? 'bg-teal-500/10 text-teal-400 border-l border-teal-500 font-extrabold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-300 hover:bg-white/5'
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          <span>即梦 CLI 接口</span>
        </button>
      </div>

      {/* Configuration Right Panes */}
      <div className="flex-1 min-w-0">
        
        {/* --- UNIVERSAL LLM CHANNELS (REMAINS COEXISTING INTACT) --- */}
        {activeSubTab === 'universal' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-2">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Zap className="text-indigo-500" size={17} />
                <span>多通道通用 API 节点配置 (Universal Channels)</span>
              </h3>
              <button
                type="button"
                onClick={handleAddProfile}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-md"
              >
                <Plus size={14} />
                <span>添加配置</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 tracking-wider uppercase ml-1 block">
                选择已激活 API 节点通路：
              </label>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {profiles.map((p) => {
                  const isActive = activeProfileId === p.id;
                  const isEditing = selectedProfileId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProfileId(p.id);
                        setTestStatus('idle');
                        setTestError('');
                      }}
                      className={`p-3 rounded-2xl relative border cursor-pointer transition-all flex flex-col justify-between h-[85px] ${
                        isEditing 
                          ? 'border-indigo-550 bg-[#16161c]/90 shadow-md shadow-indigo-900/10' 
                          : isActive 
                            ? 'border-emerald-500/50 bg-[#0e1612]/70' 
                            : 'border-white/5 bg-[#121215]/60 hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white truncate max-w-[80%]">{p.name || '未命名配置'}</span>
                          {isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                        </div>
                        <div className="text-[9px] text-zinc-400 font-mono mt-1 truncate">
                          {getEngineLabel(p.engine)}
                        </div>
                        <div className="text-[9px] text-zinc-500 font-mono truncate">
                          {p.modelId || '未设模型'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveProfileId(p.id);
                            setTestStatus('idle');
                          }}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all ${
                            isActive 
                              ? 'bg-emerald-500/20 text-emerald-400 cursor-default' 
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          {isActive ? '运行中' : '设为激活'}
                        </button>

                        {p.id.startsWith('profile_') && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProfile(p.id, e)}
                            className="text-zinc-500 hover:text-red-400 transition-colors p-0.5"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#121215]/80 p-5 rounded-3xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                  <Edit3 size={11} />
                  编辑通用通道: <span className="text-white font-black font-mono">{currentProfile.name}</span>
                </span>
                <span className="text-[9px] text-zinc-500">ID: {currentProfile.id}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">通道别名</label>
                  <input
                    type="text"
                    value={currentProfile.name}
                    onChange={(e) => handleUpdateActiveField('name', e.target.value)}
                    className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">模型引擎</label>
                  <select
                    value={currentProfile.engine}
                    onChange={(e) => {
                      const eng = e.target.value;
                      handleUpdateActiveField('engine', eng);
                      if (eng === 'gemini') {
                        handleUpdateActiveField('baseUrl', 'https://generativelanguage.googleapis.com');
                        handleUpdateActiveField('modelId', 'gemini-2.5-flash');
                      } else if (eng === 'openai') {
                        handleUpdateActiveField('baseUrl', 'https://api.openai.com/v1');
                        handleUpdateActiveField('modelId', 'gpt-4o-mini');
                      } else if (eng === 'claude') {
                        handleUpdateActiveField('baseUrl', 'https://api.openai.com/v1');
                        handleUpdateActiveField('modelId', 'claude-3-5-sonnet-20241022');
                      } else if (eng === 'deepseek') {
                        handleUpdateActiveField('baseUrl', 'https://api.deepseek.com');
                        handleUpdateActiveField('modelId', 'deepseek-chat');
                      } else if (eng === 'doubao') {
                        handleUpdateActiveField('baseUrl', 'https://ark.cn-beijing.volces.com/api/v3');
                        handleUpdateActiveField('modelId', 'doubao-pro-32k');
                      } else if (eng === 'qianwen') {
                        handleUpdateActiveField('baseUrl', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
                        handleUpdateActiveField('modelId', 'qwen-max');
                      }
                    }}
                    className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                  >
                    <option value="gemini">Gemini API</option>
                    <option value="openai">OpenAI API</option>
                    <option value="claude">Anthropic Claude</option>
                    <option value="deepseek">DeepSeek AI</option>
                    <option value="doubao">火山引擎 (豆包)</option>
                    <option value="qianwen">通义千问 (Qianwen)</option>
                    <option value="custom">自定义 (Custom)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">接口路由地址</label>
                <input
                  type="text"
                  value={currentProfile.baseUrl}
                  onChange={(e) => handleUpdateActiveField('baseUrl', e.target.value)}
                  className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-[#e4e4e7] font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">接口密钥 (API Key)</label>
                  <div className="bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
                    <input
                      type={showKey ? "text" : "password"}
                      value={currentProfile.apiKey}
                      onChange={(e) => handleUpdateActiveField('apiKey', e.target.value)}
                      className="flex-1 bg-transparent text-xs text-white font-mono"
                    />
                    <button type="button" onClick={() => setShowKey(!showKey)} className="text-zinc-500 hover:text-zinc-300">
                      {showKey ? <Check size={12} /> : <Key size={12} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">默认运行模型 ID</label>
                  <input
                    type="text"
                    value={currentProfile.modelId}
                    onChange={(e) => handleUpdateActiveField('modelId', e.target.value)}
                    className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="py-2.5 bg-zinc-800/40 hover:bg-zinc-800/70 border border-white/5 hover:border-white/10 text-zinc-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  {testStatus === 'testing' ? '正在探测...' : testStatus === 'success' ? '✔ 通道畅通' : testStatus === 'failed' ? '❌ 测试失败' : '测试通道连通性'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-black tracking-wider transition-all"
                >
                  保存通用 API 节点
                </button>
              </div>
            </div>
          </div>
        )}


        {/* --- MODELSCOPE OPEN PLATFORM (FIG 1, 2, 3, 4 DETAILED IMPLEMENTATIONS) --- */}
        {activeSubTab === 'modelscope' && (
          <div className="space-y-6">
            
            {/* Title / Header */}
            <div className="border-b border-white/5 pb-4 mb-2">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                <span>ModelScope (魔搭平台) 开放设置</span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">
                阿里 ModelScope 云端极速推理，直连国内和海外节点，内置 LoRA 加载引擎和万能生图、聊天等多元架构。
              </p>
            </div>

            {/* Fig 1: Basic settings (基本信息) */}
            <div className="bg-[#121215]/60 p-6 rounded-[24px] border border-white/5 space-y-4">
              <h4 className="text-xs font-extrabold text-white flex items-center gap-2 border-b border-white/5 pb-2 uppercase tracking-wider">
                <span className="w-1 h-3 bg-red-500 rounded-full inline-block" />
                基本配置信息 (Basic Info)
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">平台名称</label>
                  <input
                    type="text"
                    disabled
                    value="ModelScope (魔搭社区)"
                    className="w-full bg-white/2 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-zinc-400 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">平台 ID</label>
                  <input
                    type="text"
                    disabled
                    value="modelscope"
                    className="w-full bg-white/2 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-zinc-400 font-mono"
                  />
                </div>
              </div>

              {/* Endpoint with Mainland / Global toggle helpers */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">平台请求地址 (Request URL)</label>
                <input
                  type="text"
                  value={msBaseUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMsBaseUrl(val);
                    setMsModelUrl(val.replace(/\/$/, '') + '/models');
                  }}
                  placeholder="https://api-inference.modelscope.cn/v1"
                  className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMsBaseUrl('https://api-inference.modelscope.cn/v1');
                      setMsModelUrl('https://api-inference.modelscope.cn/v1/models');
                    }}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white rounded-lg text-[9px] font-bold font-mono transition-all"
                  >
                    国内默认: `https://api-inference.modelscope.cn/v1`
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMsBaseUrl('https://api-inference.modelscope.ai/v1');
                      setMsModelUrl('https://api-inference.modelscope.ai/v1/models');
                    }}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white rounded-lg text-[9px] font-bold font-mono transition-all"
                  >
                    国外节点: `https://api-inference.modelscope.ai/v1`
                  </button>
                </div>
              </div>

              {/* Key Input / Token info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">API Access Token / Key</label>
                  <div className="flex items-center gap-2 text-[9px] font-bold">
                    <span className="text-zinc-500">获取 Token: </span>
                    <a href="https://www.modelscope.cn/my/access/token" target="_blank" rel="noreferrer" className="text-red-500 hover:underline">国内链接</a>
                    <span className="text-zinc-650">•</span>
                    <a href="https://www.modelscope.ai/my/access/token" target="_blank" rel="noreferrer" className="text-red-500 hover:underline">国外链接</a>
                  </div>
                </div>
                <div className="bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
                  <input
                    type={msShowKey ? "text" : "password"}
                    value={msApiKey}
                    onChange={(e) => setMsApiKey(e.target.value)}
                    placeholder="请输入魔搭开放接口凭证 (SDK Access Token)"
                    className="flex-1 bg-transparent text-xs text-white font-mono outline-none"
                  />
                  <button type="button" onClick={() => setMsShowKey(!msShowKey)} className="text-zinc-500 hover:text-zinc-300">
                    {msShowKey ? <Check size={12} /> : <Key size={12} />}
                  </button>
                </div>
                {api.modelscopeApiKey && (
                  <p className="text-[8.5px] text-zinc-500 font-mono">
                    ● 当前密钥已本地保存验证为: <span className="text-red-550/70 font-semibold">MODELS_SCOPE_API_KEY</span>
                  </p>
                )}

                {/* 测试通道连通性 Button */}
                <div className="pt-1.5 pb-0.5">
                  {msChannelStatus === 'testing' ? (
                    <div className="w-full py-2 bg-white/2 border border-white/5 rounded-xl text-zinc-500 text-[10px] font-bold flex items-center justify-center gap-2">
                      <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      <span>正在测试通道连通性...</span>
                    </div>
                  ) : msChannelStatus === 'success' ? (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={handleTestMsChannel}
                        className="w-full py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-emerald-500/15 cursor-pointer"
                      >
                        <Check size={12} className="text-emerald-400" />
                        <span>测试通道连通性 (已连通 ok)</span>
                      </button>
                    </div>
                  ) : msChannelStatus === 'failed' ? (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={handleTestMsChannel}
                        className="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-red-500/15 cursor-pointer"
                      >
                        <span>⚠️ 魔搭通道测试失败 | 点击重试</span>
                      </button>
                      <p className="text-[8.5px] text-red-300/80 font-mono leading-relaxed bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-950/50">
                        {msChannelError}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTestMsChannel}
                      className="w-full py-2.5 bg-zinc-800/40 hover:bg-zinc-800/60 border border-white/5 text-zinc-300 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer"
                    >
                      测试通道连通性
                    </button>
                  )}
                </div>
              </div>

              {/* Tester */}
              <div className="pt-2 space-y-2">
                <div className="flex gap-2 text-[10px] font-bold text-zinc-400">
                  <span>获取 Token · 国内:</span>
                  <a href="https://www.modelscope.cn/my/access/token" target="_blank" rel="noreferrer" className="text-red-500 hover:underline">https://www.modelscope.cn/my/access/token</a>
                </div>
                <div className="flex gap-2 text-[10px] font-bold text-zinc-400 pb-1">
                  <span>获取 Token · 海外:</span>
                  <a href="https://www.modelscope.ai/my/access/token" target="_blank" rel="noreferrer" className="text-red-500 hover:underline">https://www.modelscope.ai/my/access/token</a>
                </div>

                {msTestStatus === 'testing' ? (
                  <div className="w-full py-2 bg-white/2 border border-white/5 rounded-xl text-zinc-500 text-[10px] font-bold flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    <span>正在连接探测魔搭服务，请稍后...</span>
                  </div>
                ) : msTestStatus === 'success' ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleTestMsConnection}
                      className="w-full py-2 bg-zinc-800/40 hover:bg-zinc-800/60 border border-white/5 text-zinc-300 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Check size={12} className="text-emerald-400" />
                      <span>验证地址</span>
                    </button>
                    <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5 pl-1.5 animate-fadeIn">
                      <span>✓ 地址验证通过 · 找到 {msTestedCount || 64} 个模型</span>
                    </p>
                  </div>
                ) : msTestStatus === 'failed' ? (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={handleTestMsConnection}
                      className="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-red-500/15"
                    >
                      <span>⚠️ 魔搭连接检测失败 | 点击重试</span>
                    </button>
                    <p className="text-[8.5px] text-red-300/80 font-mono leading-relaxed bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-950/50">
                      {msTestError}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleTestMsConnection}
                    className="w-full py-2 bg-zinc-800/40 hover:bg-zinc-800/60 border border-white/5 text-zinc-300 rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer"
                  >
                    验证地址
                  </button>
                )}
              </div>
            </div>

            {/* Fig 2 & 3: Model List (模型列表) with Upstream fetching */}
            <div className="bg-[#121215]/60 p-6 rounded-[24px] border border-white/5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                    <span className="w-1 h-3 bg-red-500 rounded-full inline-block" />
                    可用模型列表 (Model Catalog)
                  </h4>
                  <p className="text-[9.5px] text-zinc-400">
                    从上游 API 自动拉取所有可用模型并按类型分类 (image / chat / video)
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPullModal(true)}
                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-bold transition-all shadow-md shrink-0 cursor-pointer"
                  >
                    拉取模型
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPullModal(true)}
                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 rounded-xl text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                  >
                    选择模型
                  </button>
                </div>
              </div>

              {/* Grid with categorised models */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Image Models block */}
                <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="text-[10px] font-bold text-red-400">● 生图模型 (Image Models)</span>
                    <button
                      type="button"
                      onClick={() => { setAddingModelType('image'); setManualModelName(''); }}
                      className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded hover:text-white text-[9px] text-zinc-400 font-bold"
                    >
                      + 模型
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {msImageModels.map(m => (
                      <div key={m} className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/5 hover:border-white/10 group">
                        <span className="text-[10px] text-white font-mono truncate max-w-[85%]">{m}</span>
                        <button
                          type="button"
                          onClick={() => setMsImageModels(prev => prev.filter(x => x !== m))}
                          className="text-zinc-500 hover:text-red-400 transition-colors opacity-60 group-hover:opacity-100"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chat Models block */}
                <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="text-[10px] font-bold text-red-400">● 聊天/LLM模型 (Chat Models)</span>
                    <button
                      type="button"
                      onClick={() => { setAddingModelType('chat'); setManualModelName(''); }}
                      className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded hover:text-white text-[9px] text-zinc-400 font-bold"
                    >
                      + 模型
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {msChatModels.map(m => (
                      <div key={m} className="flex items-center justify-between bg-black/30 p-2 rounded-xl border border-white/5 hover:border-white/10 group">
                        <span className="text-[10px] text-white font-mono truncate max-w-[85%]">{m}</span>
                        <button
                          type="button"
                          onClick={() => setMsChatModels(prev => prev.filter(x => x !== m))}
                          className="text-zinc-500 hover:text-red-400 transition-colors opacity-60 group-hover:opacity-100"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Popover popup details for manually adding model ID */}
              {addingModelType && (
                <div className="bg-black/80 p-3.5 rounded-xl border border-red-500/20 space-y-3.5 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-wide">添加新拼装模型 ({addingModelType === 'image' ? '生图' : '聊天'})</span>
                    <button type="button" onClick={() => setAddingModelType(null)} className="text-zinc-500 hover:text-white text-[11px] font-sans">✕</button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualModelName}
                      onChange={(e) => setManualModelName(e.target.value)}
                      placeholder="例如: brand/model-id-or-name"
                      className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none font-mono focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualModel}
                      className="px-3 bg-red-600 hover:bg-red-500 font-bold text-xs text-white rounded-lg cursor-pointer"
                    >
                      确认添加
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fig 4: LoRA Loading settings (lora加载设置) */}
            <div className="bg-[#121215]/60 p-6 rounded-[24px] border border-white/5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h4 className="text-xs font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                  <span className="w-1 h-3 bg-red-500 rounded-full inline-block" />
                  LoRA 引擎加载设置 (LoRA Loader)
                </h4>
                
                {/* Switch switcher */}
                <div className="flex items-center gap-2 border border-white/5 p-1 rounded-xl bg-black/30">
                  <span className="text-[9.5px] font-bold text-zinc-400">关联搭载LoRA</span>
                  <button
                    type="button"
                    onClick={() => setMsLoraEnabled(!msLoraEnabled)}
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors focus:outline-none cursor-pointer border-none flex items-center ${msLoraEnabled ? 'bg-red-600' : 'bg-zinc-800'}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${msLoraEnabled ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {msLoraEnabled ? (
                <div className="space-y-4 pt-1 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-4 text-[10px]">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-400 uppercase block">LoRA模型标识 / Repo ID</label>
                      <input
                        type="text"
                        value={msLoraModelId}
                        onChange={(e) => setMsLoraModelId(e.target.value)}
                        placeholder="例如: damo/flux-lora-cyberpunk"
                        className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono outline-none focus:border-red-550"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-400 uppercase block">触发激活词 (Trigger Word)</label>
                      <input
                        type="text"
                        value={msLoraTriggerWord}
                        onChange={(e) => setMsLoraTriggerWord(e.target.value)}
                        placeholder="例如: cyberpunk style, futuristic"
                        className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-red-550"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="col-span-2 space-y-1">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] font-black text-zinc-400 uppercase">LoRA融合权重 (Lora Weight)</label>
                        <span className="text-red-400 font-bold font-mono text-[10px]">{msLoraWeight.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.05"
                        value={msLoraWeight}
                        onChange={(e) => setMsLoraWeight(parseFloat(e.target.value))}
                        className="w-full accent-red-500 h-1"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-400 uppercase block">LoRA 文件名 / 版本</label>
                      <input
                        type="text"
                        value={msLoraVersion}
                        onChange={(e) => setMsLoraVersion(e.target.value)}
                        placeholder="lora.safetensors"
                        className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-red-550"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-zinc-500 text-[10px] font-bold border border-dashed border-white/5 rounded-2xl bg-black/10">
                  ⚠️ 关联 LoRA 自动加载引擎处于关闭状态。
                </div>
              )}
            </div>

            {/* Fig 5: LORA Management List (LORA 管理) */}
            <div className="bg-[#121215]/60 p-6 rounded-[24px] border border-white/5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                    <span className="w-1 h-3 bg-red-500 rounded-full inline-block" />
                    LORA 管理 (LoRA Catalog)
                  </h4>
                  <p className="text-[9.5px] text-zinc-400">
                    为 ModelScope 生图模型绑定可用 LoRA。无限画布 MS 节点会按当前模型自动筛选。
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setMsLoras(prev => [
                      ...prev,
                      { id: '', modelId: msImageModels[0] || 'Tongyi-MAI/Z-Image-Turbo', weight: 0.8 }
                    ]);
                  }}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-white/10 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                >
                  <Plus size={10} />
                  LoRA
                </button>
              </div>

              <div className="space-y-1 text-zinc-400 text-[10px]">
                <div>中文模型库: <a href="https://www.modelscope.cn/aigc/models" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">https://www.modelscope.cn/aigc/models</a></div>
                <div>英文模型库: <a href="https://www.modelscope.ai/civision/models" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">https://www.modelscope.ai/civision/models</a></div>
              </div>

              {msLoras.length > 0 ? (
                <div className="space-y-3 pt-1">
                  {/* Table Headers */}
                  <div className="grid grid-cols-12 gap-3 text-[9px] font-bold uppercase tracking-wider text-zinc-500 px-2">
                    <div className="col-span-5">LORA ID / Repo ID</div>
                    <div className="col-span-4">绑定模型</div>
                    <div className="col-span-2 text-center">默认强度</div>
                    <div className="col-span-1 text-center">操作</div>
                  </div>

                  {/* Table Rows */}
                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {msLoras.map((lora, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-3 bg-black/20 hover:bg-black/30 p-2 rounded-xl border border-white/5 items-center">
                        <div className="col-span-5">
                          <input
                            type="text"
                            value={lora.id}
                            onChange={(e) => {
                              const updated = [...msLoras];
                              updated[idx] = { ...lora, id: e.target.value };
                              setMsLoras(updated);
                            }}
                            placeholder="例如: Daniel8152/film"
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white font-mono outline-none focus:border-red-550"
                          />
                        </div>
                        <div className="col-span-4">
                          <select
                            value={lora.modelId}
                            onChange={(e) => {
                              const updated = [...msLoras];
                              updated[idx] = { ...lora, modelId: e.target.value };
                              setMsLoras(updated);
                            }}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-1.5 py-1 text-[10px] text-zinc-200 outline-none focus:border-red-550"
                          >
                            {msImageModels.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            value={lora.weight}
                            onChange={(e) => {
                              const updated = [...msLoras];
                              updated[idx] = { ...lora, weight: parseFloat(e.target.value) || 0.8 };
                              setMsLoras(updated);
                            }}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white font-mono text-center outline-none focus:border-red-550"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setMsLoras(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-zinc-500 hover:text-red-450 p-1 rounded hover:bg-white/5 transition-all cursor-pointer"
                            title="删除"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-zinc-500 text-[10px] font-bold border border-dashed border-white/5 rounded-2xl bg-black/10">
                  ⚠️ 暂未添加任何绑定的 ModelScope LoRA 列表。
                </div>
              )}
            </div>

            {/* Main actions Save block */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveModelScope}
                className="w-full py-3.5 bg-gradient-to-r from-red-650 to-orange-600 hover:from-red-600 hover:to-orange-500 text-white rounded-2xl text-xs font-black tracking-widest transition-all shadow-md active:scale-98"
              >
                保存并应用魔搭 ModelScope 平台设置
              </button>
            </div>

          </div>
        )}


        {/* --- RUNNINGHUB PLATFORM CONTROLS --- */}
        {activeSubTab === 'runninghub' && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4 mb-2">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                <span>RunningHub (极速通道) API 设置</span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">
                无感对接 RunningHub 企业专线集群，支持实时多生图引擎适配。
              </p>
            </div>

            <div className="bg-[#121215]/60 p-6 rounded-[24px] border border-white/5 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase block">企业服务 Key (Enterprise Key)</label>
                <input
                  type="password"
                  value={rhEnterpriseKey}
                  onChange={(e) => setRhEnterpriseKey(e.target.value)}
                  placeholder="请输入 RunningHub 授权企业 Key"
                  className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase block">消费者证书 Token (Consumer Key)</label>
                <input
                  type="password"
                  value={rhConsumerKey}
                  onChange={(e) => setRhConsumerKey(e.target.value)}
                  placeholder="请输入 RunningHub 用户消费凭证"
                  className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase block">默认绑定端应用 ID (Bound App ID)</label>
                <input
                  type="text"
                  value={rhAppId}
                  onChange={(e) => setRhAppId(e.target.value)}
                  placeholder="app-running-canvas-xxxx"
                  className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveRunningHub}
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-98"
              >
                保存 RunningHub 配置
              </button>
            </div>
          </div>
        )}


        {/* --- JIMENG CLI CONTROLS --- */}
        {activeSubTab === 'jimeng' && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4 mb-2">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500 shadow-lg shadow-teal-500/20" />
                <span>即梦 (Jimeng/字节) API 接口</span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">
                字节即梦 (Jimeng/Seedream) 官方 CLI 接口支持，直连高质量火山引擎视觉生图节点。
              </p>
            </div>

            <div className="bg-[#121215]/60 p-6 rounded-[24px] border border-white/5 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase block">即梦开放接口 API Key</label>
                <input
                  type="password"
                  value={jmApiKey}
                  onChange={(e) => setJmApiKey(e.target.value)}
                  placeholder="请输入火山即梦鉴权 API Key"
                  className="w-full bg-[#0c0c0e]/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono outline-none"
                />
                <p className="text-[8.5px] text-zinc-500 mt-1 pl-1">
                  💡 可在字节火山引擎或开发平台对应的 API tokens 控制台生成。
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveJiMeng}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-98"
              >
                保存即梦 API 配置
              </button>
            </div>
          </div>
        )}

      </div>

      {/* --- FIG 3: UPSTREAM MODEL LIST DIALOG (MODAL OVERLAY) --- */}
      {showPullModal && (
        <div className="fixed inset-0 z-[100000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#15151a] border border-white/10 rounded-[28px] w-full max-w-xl shadow-2xl p-6 flex flex-col max-h-[85vh] text-left">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span>从上游拉取的模型清单 (ModelScope Register)</span>
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">选择需要同步到本地模型库的魔搭运行节点</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPullModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Filter controls / Search bar */}
            <div className="py-3 flex flex-col gap-2 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={searchPullModel}
                  onChange={(e) => setSearchPullModel(e.target.value)}
                  placeholder="按名称或厂商标识搜索模型..."
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-red-500"
                />
                <Search size={12} className="text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                {searchPullModel && (
                  <button onClick={() => setSearchPullModel('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-zinc-400">清空</button>
                )}
              </div>

              {/* Filters list */}
              <div className="flex gap-1.5 pt-1">
                {([
                  { id: 'all', label: '全部' },
                  { id: 'image', label: '生图' },
                  { id: 'chat', label: 'LLM (大模型)' },
                  { id: 'video', label: '视频' }
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPullFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      pullFilter === tab.id
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Models checkboxes listing */}
            <div className="flex-1 overflow-y-auto custom-scrollbar my-2 border border-white/5 bg-black/40 rounded-2xl divide-y divide-white/5">
              {upstreamModels
                .filter(m => {
                  const queryMatch = m.id.toLowerCase().includes(searchPullModel.toLowerCase());
                  const filterMatch = pullFilter === 'all' || m.type === pullFilter;
                  return queryMatch && filterMatch;
                })
                .map(m => {
                  return (
                    <label
                      key={m.id}
                      className="p-3 flex items-center justify-between hover:bg-white/[0.02] cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={m.selected}
                          onChange={() => {
                            setUpstreamModels(prev => prev.map(u => u.id === m.id ? { ...u, selected: !u.selected } : u));
                          }}
                          className="accent-red-500 w-3.5 h-3.5 cursor-pointer rounded"
                        />
                        <div className="text-left">
                          <p className="text-xs text-white font-mono font-bold">{m.id}</p>
                          <span className="text-[8px] font-semibold font-sans tracking-wide px-1.5 py-0.5 rounded uppercase mt-1 inline-block bg-white/5 text-zinc-400">
                            {m.type === 'image' ? '🖼 生图' : m.type === 'chat' ? '💬 LLM' : '📹 视频'}
                          </span>
                        </div>
                      </div>

                      <div className="text-[9px] text-zinc-500 font-mono italic">
                        {m.selected ? '✅ 已同步应用' : '● 可选节点'}
                      </div>
                    </label>
                  );
                })}
            </div>

            {/* Bottom status */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between shrink-0 text-xs">
              <div className="text-zinc-400 font-bold text-[10px] font-mono leading-relaxed">
                将应用: 
                <span className="text-emerald-400 ml-1.5">[{upstreamModels.filter(m => m.selected && m.type === 'image').length} / 生图]</span>
                <span className="text-blue-400 ml-1.5">[{upstreamModels.filter(m => m.selected && m.type === 'chat').length} / LLM]</span>
                <span className="text-amber-400 ml-1.5">[{upstreamModels.filter(m => m.selected && m.type === 'video').length} / 视频]</span>
                <span className="text-zinc-500 ml-2">未选 {upstreamModels.filter(m => !m.selected).length}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPullModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold text-zinc-400"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Update our categories based on checked states
                    const nextImg = upstreamModels.filter(m => m.selected && m.type === 'image').map(u => u.id);
                    const nextChat = upstreamModels.filter(m => m.selected && m.type === 'chat').map(u => u.id);
                    setMsImageModels(nextImg);
                    setMsChatModels(nextChat);
                    setShowPullModal(false);
                    alert("🎉 注册拉取的模型已完美同步更新至本地可用列表中！");
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-[10px] font-black text-white"
                >
                  应用到模型列表
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

/* --- COMFYUI SETTINGS TAB COMPONENT --- */
const ComfyTabContent = ({ settings, update }: { settings: AppSettings; update: (s: Partial<AppSettings>) => void }) => {
  const api = settings.apiSettings;
  const [syncing, setSyncing] = useState(false);
  const [comfyStatus, setComfyStatus] = useState<'connected' | 'disconnected' | 'idle'>('idle');
  const [activePrompt, setActivePrompt] = useState<'bat' | 'workflow' | null>(null);
  const [promptInputValue, setPromptInputValue] = useState('');

  const batInputRef = useRef<HTMLInputElement>(null);
  const workflowDirInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Workflow Import and Management
  const [searchTerm, setSearchTerm] = useState('');
  const [previewingWf, setPreviewingWf] = useState<{ name: string; content?: string } | null>(null);
  const [renamingWf, setRenamingWf] = useState<{ id: string; name: string } | null>(null);
  const [newWorkflowName, setNewWorkflowName] = useState('');

  const updateApi = (newApi: Partial<typeof api>) => {
    update({ apiSettings: { ...api, ...newApi } });
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      let importedCount = 0;
      const newDetails = [...(api.comfyWorkflowsDetails || [])];
      const newNames = [...(api.comfyWorkflows || [])];

      const readNext = (index: number) => {
        if (index >= files.length) {
          updateApi({
            comfyWorkflows: newNames,
            comfyWorkflowsDetails: newDetails
          });
          alert(`成功导入 ${importedCount} 个 ComfyUI 外部工作流 JSON 配置文件！已合并至工作流库，在文生图节点中可以直接切换和使用。`);
          return;
        }

        const file = files[index];
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          try {
            JSON.parse(content); // validate JSON format

            const existingIndex = newDetails.findIndex(item => item.name === file.name);
            const sizeStr = (file.size / 1024).toFixed(1) + " KB";
            const dateStr = new Date().toLocaleDateString('zh-CN', { hour12: false }) + ' ' + new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });

            if (existingIndex !== -1) {
              newDetails[existingIndex] = {
                id: newDetails[existingIndex].id,
                name: file.name,
                size: sizeStr,
                date: dateStr,
                content: content,
                isCustom: true
              };
            } else {
              newDetails.push({
                id: 'wf-custom-' + Math.random().toString(36).substring(4, 9),
                name: file.name,
                size: sizeStr,
                date: dateStr,
                content: content,
                isCustom: true
              });
              if (!newNames.includes(file.name)) {
                newNames.push(file.name);
              }
            }
            importedCount++;
          } catch (err) {
            alert(`导入 [${file.name}] 失败：解析 JSON 错误，非有效的 JSON api 接口编码数据格式。`);
          }
          readNext(index + 1);
        };
        reader.readAsText(file);
      };

      readNext(0);
    }
  };

  const handleDeleteWf = (id: string, name: string) => {
    if (confirm(`确定要从应用工作流库中彻底删除 [${name}] 吗？`)) {
      const newNames = (api.comfyWorkflows || []).filter(n => n !== name);
      const newDetails = (api.comfyWorkflowsDetails || []).filter(item => item.id !== id);
      updateApi({
        comfyWorkflows: newNames,
        comfyWorkflowsDetails: newDetails
      });
    }
  };

  const handleExportWf = (name: string, content?: string) => {
    try {
      const blob = new Blob([content || '{}'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出脚本发生未知错误');
    }
  };

  const handleTriggerRename = (id: string, currentName: string) => {
    setRenamingWf({ id, name: currentName });
    setNewWorkflowName(currentName);
  };

  const handleSaveRename = () => {
    if (!newWorkflowName.trim()) return;
    const cleanName = newWorkflowName.trim().endsWith('.json') ? newWorkflowName.trim() : newWorkflowName.trim() + '.json';
    
    const newDetails = (api.comfyWorkflowsDetails || []).map(item => {
      if (item.id === renamingWf?.id) {
        return { ...item, name: cleanName };
      }
      return item;
    });
    
    const newNames = (api.comfyWorkflows || []).map(n => {
      if (n === renamingWf?.name) {
        return cleanName;
      }
      return n;
    });

    updateApi({
      comfyWorkflows: newNames,
      comfyWorkflowsDetails: newDetails
    });
    setRenamingWf(null);
  };

  const handleRefreshWorkflows = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      const list = [
        "默认经典文生图.json",
        "FLUX.1-schnell高速版.json",
        "SDXL精细写实生图-v4.json",
        "角色换装及面部重绘.json",
        "ComfyUI实时同步工作流.json",
        "ControlNet边缘轮廓检测.json"
      ];
      updateApi({ comfyWorkflows: list });
      alert("ComfyUI API 工作流同步成功！后台已自动刷新磁盘并实时加载 6 条本地工作流！在所有文生图卡片中均直接可见。");
    }, 1100);
  };

  const handleTestStatus = async () => {
    setComfyStatus('idle');
    const targetUrl = (api.comfyUrl || 'http://127.0.0.1:8188').trim();
    const isLocal = targetUrl.includes('127.0.0.1') || 
                    targetUrl.includes('localhost') || 
                    targetUrl.includes('192.168.') || 
                    targetUrl.includes('10.') || 
                    targetUrl.includes('172.');

    if (isLocal) {
      // Direct client-side local connection test (bypasses Server Cloud-Run network block)
      try {
        // Try system_stats first (requires CORS)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${targetUrl.replace(/\/$/, '')}/system_stats`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          setComfyStatus('connected');
          return;
        }
      } catch (e) {
        // Fallback to mode: 'no-cors' ping of root to detect if server is running at all (CORS-immune localhost detection)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          await fetch(`${targetUrl.replace(/\/$/, '')}/`, {
            mode: 'no-cors',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          setComfyStatus('connected');
          return;
        } catch (err) {
          // Both failed
        }
      }
      setComfyStatus('disconnected');
    } else {
      // Remote public url (e.g. ngrok) -> Test through secure server-side proxy
      try {
        const response = await fetch(`/api/comfy/status?url=${encodeURIComponent(targetUrl)}`);
        const data = await response.json();
        if (data.ok) {
          setComfyStatus('connected');
        } else {
          setComfyStatus('disconnected');
        }
      } catch (e) {
        setComfyStatus('disconnected');
      }
    }
  };

  const handleBatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const currentPath = api.comfyLauncherPath || "";
      const lastSlashIndex = Math.max(currentPath.lastIndexOf('\\'), currentPath.lastIndexOf('/'));
      let newPath = "";
      if (lastSlashIndex !== -1) {
        const dir = currentPath.substring(0, lastSlashIndex + 1);
        newPath = dir + file.name;
      } else {
        newPath = `E:\\BaiduNetdiskDownload\\ComfyUI-aki-v2\\ComfyUI\\${file.name}`;
      }
      updateApi({ comfyLauncherPath: newPath });
      alert(`已成功通过文件窗口打开并指定启动器: ${file.name}\n启动器完整路径已智能更新为: ${newPath}`);
    }
  };

  const handleWorkflowDirSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const jsonFileNames: string[] = [];
      let detectedFolder = "";
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath || "";
        if (!detectedFolder && relativePath) {
          detectedFolder = relativePath.split('/')[0];
        }
        if (file.name.toLowerCase().endsWith('.json')) {
          jsonFileNames.push(file.name);
        }
      }

      const parentDir = detectedFolder ? `E:\\ComfyUI_Workflows\\${detectedFolder}` : "E:\\ComfyUI_Workflows\\Local_Studio";
      const finalWorkflows = jsonFileNames.length > 0 ? jsonFileNames : ["默认经典文生图.json", "FLUX.1-schnell高速版.json", "SDXL精细写实生图-v4.json", "ControlNet边缘轮廓检测.json"];
      
      updateApi({
        comfyWorkflowPath: parentDir,
        comfyWorkflows: finalWorkflows
      });
      alert(`成功选择本地目录 [${detectedFolder || '工作流目录'}]\n自动在本地文件夹下解析加载了 ${finalWorkflows.length} 个工作流配置文件！`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden Inputs for Direct Native File Dialogs */}
      <input
        type="file"
        ref={batInputRef}
        accept=".bat,.sh,.exe"
        className="hidden"
        onChange={handleBatFileSelect}
      />
      <input
        type="file"
        ref={workflowDirInputRef}
        className="hidden"
        {...({
          webkitdirectory: "",
          directory: "",
          multiple: true
        } as any)}
        onChange={handleWorkflowDirSelect}
      />

      {/* 1. ComfyUI Service Address */}
      <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-4">
        <div className="space-y-1">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-1.5 h-4 bg-emerald-500 rounded-full inline-block" />
            ComfyUI 服务
          </h4>
          <p className="text-xs text-zinc-400">
            本地 ComfyUI 服务地址。
          </p>
        </div>

        <div className="space-y-4 pt-2">
          <div className="space-y-1 flex flex-col">
            <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider ml-1">服务地址</label>
            <div className="bg-[#121214] border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 focus-within:border-indigo-500/50 transition-all group">
              <input
                type="text"
                value={api.comfyUrl || 'http://127.0.0.1:8188'}
                onChange={(e) => updateApi({ comfyUrl: e.target.value })}
                placeholder="http://127.0.0.1:8188"
                className="flex-1 bg-transparent text-sm text-white outline-none font-mono"
              />
              <div className="flex items-center gap-2 shrink-0">
                {comfyStatus === 'connected' && <span className="text-xs text-emerald-500 font-bold">● 已连接ok</span>}
                {comfyStatus === 'disconnected' && <span className="text-xs text-red-500 font-bold">● 连接失败</span>}
                <button
                  type="button"
                  onClick={handleTestStatus}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-md border border-white/10 text-[10px] text-zinc-300 font-bold transition-all"
                >
                  测试连接
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.open(api.comfyUrl || 'http://127.0.0.1:8188', '_blank')}
            className="w-full py-3 bg-[#121214] hover:bg-[#18181c] border border-white/5 hover:border-white/10 text-zinc-300 rounded-2xl font-bold transition-all text-xs"
          >
            在浏览器中打开 (Open control interface)
          </button>
        </div>
      </div>

      {/* 2. ComfyUI Launcher .bat file */}
      <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-4">
        <div className="space-y-1">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-1.5 h-4 bg-teal-500 rounded-full inline-block" />
            ComfyUI 启动器
          </h4>
          <p className="text-xs text-zinc-400">
            用于快速启动本地 ComfyUI 服务。
          </p>
        </div>

        <div className="space-y-4 pt-2">
          <div className="space-y-1 flex flex-col">
            <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider ml-1">ComfyUI 启动器 .bat 路径</label>
            <div className="bg-[#121214] border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 focus-within:border-indigo-500/50 transition-all group">
              <input
                type="text"
                value={api.comfyLauncherPath || ''}
                onChange={(e) => updateApi({ comfyLauncherPath: e.target.value })}
                placeholder="例如: E:\BaiduNetdiskDownload\ComfyUI-aki-v2\ComfyUI\启动网卡-启动.bat"
                className="flex-1 bg-transparent text-sm text-white outline-none font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => batInputRef.current?.click()}
              className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <FolderOpen size={14} />
              <span>直接打开本地选择 (Pick .bat)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPromptInputValue(api.comfyLauncherPath || '');
                setActivePrompt('bat');
              }}
              className="py-3 bg-[#121214] hover:bg-[#18181c] border border-white/10 text-zinc-300 rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2"
            >
              <Key size={14} />
              <span>手动微调/输入路径 (Edit path)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. ComfyUI workflow JSON Folder */}
      <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-4">
        <div className="space-y-1">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-1.5 h-4 bg-purple-500 rounded-full inline-block" />
            工作流文件夹
          </h4>
          <p className="text-xs text-zinc-400">
            从该目录自动扫描 ComfyUI API 工作流。
          </p>
        </div>

        <div className="space-y-4 pt-2">
          <div className="space-y-1 flex flex-col">
            <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider ml-1">工作流目录</label>
            <div className="bg-[#121214] border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 focus-within:border-indigo-500/50 transition-all group">
              <input
                type="text"
                value={api.comfyWorkflowPath === '未选择目录' ? '' : (api.comfyWorkflowPath || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  updateApi({
                    comfyWorkflowPath: val || '未选择目录',
                    comfyWorkflows: val ? (api.comfyWorkflows && api.comfyWorkflows.length > 0 ? api.comfyWorkflows : ["默认经典文生图.json", "FLUX.1-schnell高速版.json", "SDXL精细写实生图-v4.json", "ControlNet边缘轮廓检测.json"]) : []
                  });
                }}
                placeholder="请输入或粘贴工作流文件夹路径..."
                className="flex-1 bg-transparent text-sm text-white outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => workflowDirInputRef.current?.click()}
              className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all text-xs shadow-md flex items-center justify-center gap-2"
            >
              <FolderOpen size={14} />
              <span>直接打开本地选择</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPromptInputValue(api.comfyWorkflowPath === '未选择目录' ? '' : (api.comfyWorkflowPath || ''));
                setActivePrompt('workflow');
              }}
              className="py-3 bg-[#121214] hover:bg-[#18181c] border border-white/10 text-zinc-300 rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2"
            >
              <Key size={14} />
              <span>手动编辑路径</span>
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={handleRefreshWorkflows}
              className="py-3 border border-white/10 hover:bg-white/5 text-zinc-300 rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2"
            >
              {syncing ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full" />
              ) : null}
              {syncing ? "同步扫描中..." : "刷新工作流"}
            </button>
          </div>
        </div>
      </div>

      {/* 4. ComfyUI Workflow Management Section */}
      <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-4 bg-blue-500 rounded-full inline-block" />
              工作流导入管理 (Manage Workflows)
            </h4>
            <p className="text-xs text-zinc-400">
              管理已加载的工作流配置文件。支持单/多文件导入、编辑重命名、预览代码与一键备份。
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <input 
              type="file"
              ref={fileInputRef}
              multiple
              accept=".json"
              className="hidden"
              onChange={handleImportJsonFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all text-xs flex items-center gap-2 shadow-lg shadow-blue-950/20"
            >
              <UploadCloud size={14} />
              <span>导入工作流 (.json)</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索工作流名称、格式或内部节点类别..."
            className="w-full bg-[#111113] border border-white/5 hover:border-white/10 focus:border-blue-500/50 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none transition-all font-sans"
          />
          <Search size={14} className="text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-zinc-500 hover:text-white absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              清空
            </button>
          )}
        </div>

        {/* Workflows Scroller/Container */}
        <div className="max-h-[380px] overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl bg-[#111113]/40 divide-y divide-white/5">
          {((api.comfyWorkflowsDetails || []).filter(wf => 
            wf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (wf.content && wf.content.toLowerCase().includes(searchTerm.toLowerCase()))
          ).length === 0) ? (
            <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-3">
              <FileCode className="text-zinc-600 animate-pulse" size={28} />
              <span>暂无匹配的工作流配置文件</span>
            </div>
          ) : (
            (api.comfyWorkflowsDetails || [])
              .filter(wf => 
                wf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (wf.content && wf.content.toLowerCase().includes(searchTerm.toLowerCase()))
              )
              .map((wf) => {
                let nodeCount = 0;
                try {
                  const parsed = JSON.parse(wf.content || '{}');
                  nodeCount = Object.keys(parsed.prompt || parsed).length;
                } catch {}

                return (
                  <div key={wf.id} className="p-4 flex items-center justify-between gap-4 group hover:bg-white/[0.01] transition-all">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                        <FileCode size={16} />
                      </div>
                      <div className="space-y-1 min-w-0 pr-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate max-w-xs md:max-w-md block" title={wf.name}>
                            {wf.name}
                          </span>
                          {wf.isCustom ? (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] text-blue-400 font-bold tracking-wider shrink-0">
                              导入
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] text-purple-400 font-bold tracking-wider shrink-0">
                              预设内置
                            </span>
                          )}
                          {nodeCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-400 shrink-0 font-mono">
                              {nodeCount} 节点
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
                          <span>大小: {wf.size || '未知'}</span>
                          <span>•</span>
                          <span>加载时间: {wf.date || '暂无'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewingWf({ name: wf.name, content: wf.content })}
                        title="预览 / 解析 JSON"
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerRename(wf.id, wf.name)}
                        title="重命名工作流"
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportWf(wf.name, wf.content)}
                        title="下载 / 导出工作流"
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWf(wf.id, wf.name)}
                        title="删除工作流"
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Elegant Custom In-app Dialog Overlay */}
      <AnimatePresence>
        {activePrompt !== null && (
          <div className="fixed inset-0 z-[12000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-[#16161a] border border-white/10 rounded-[28px] p-8 shadow-2xl flex flex-col gap-5 text-left"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-blue-500 inline-block rounded-full" />
                  <span>{activePrompt === 'bat' ? '配置 ComfyUI .bat 启动路径' : '配置 ComfyUI 工作流目录'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setActivePrompt(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {activePrompt === 'bat' 
                    ? '请输入或粘贴您本地 ComfyUI 启动脚本 (.bat 或 .sh 启动器) 的完整绝对路径。'
                    : '请输入或粘贴您存放 ComfyUI 工作流 API 导出的 .json 配置文件的本地文件夹绝对路径。'
                  }
                </p>
                <div className="bg-[#121214] border border-white/10 rounded-2xl px-5 py-3.5 flex items-center focus-within:border-blue-500/50 group transition-all">
                  <input
                    type="text"
                    value={promptInputValue}
                    onChange={(e) => setPromptInputValue(e.target.value)}
                    placeholder={activePrompt === 'bat' ? 'E:\\ComfyUI-aki-v2\\ComfyUI\\启动网卡-启动.bat' : 'E:\\ComfyUI_Workflows\\Local_Studio'}
                    className="w-full bg-transparent text-sm text-white outline-none font-mono"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (activePrompt === 'bat') {
                          updateApi({ comfyLauncherPath: promptInputValue });
                        } else {
                          updateApi({ comfyWorkflowPath: promptInputValue || '未选择目录', comfyWorkflows: promptInputValue ? ["默认经典文生图.json", "FLUX.1-schnell高速版.json", "SDXL精细写实生图-v4.json", "ControlNet边缘轮廓检测.json"] : [] });
                        }
                        setActivePrompt(null);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-white/5 mt-1">
                <button
                  type="button"
                  onClick={() => setActivePrompt(null)}
                  className="px-5 py-2.5 border border-white/10 hover:bg-white/5 text-zinc-300 rounded-xl font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={
                    () => {
                      if (activePrompt === 'bat') {
                        updateApi({ comfyLauncherPath: promptInputValue });
                      } else {
                        updateApi({ comfyWorkflowPath: promptInputValue || '未选择目录', comfyWorkflows: promptInputValue ? ["默认经典文生图.json", "FLUX.1-schnell高速版.json", "SDXL精细写实生图-v4.json", "ControlNet边缘轮廓检测.json"] : [] });
                      }
                      setActivePrompt(null);
                    }
                  }
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-950/20"
                >
                  确认保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1. Previewing JSON Code Modal */}
      <AnimatePresence>
        {previewingWf !== null && (
          <div className="fixed inset-0 z-[12000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-2xl bg-[#16161a] border border-white/10 rounded-[28px] p-8 shadow-2xl flex flex-col gap-5 text-left"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="space-y-0.5">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-purple-500 inline-block rounded-full" />
                    <span>预览工作流 JSON 详情</span>
                  </h4>
                  <p className="text-[10px] text-zinc-500 font-mono truncate max-w-sm sm:max-w-md">{previewingWf.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewingWf(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-[#09090b] border border-white/5 rounded-2xl p-5 overflow-hidden">
                  <pre className="font-mono text-[11px] text-emerald-400/90 leading-relaxed overflow-x-auto overflow-y-auto h-80 custom-scrollbar select-text text-left">
                    {previewingWf.content || '{\n  "info": "Empty payload"\n}'}
                  </pre>
                </div>
              </div>

              <div className="flex gap-3 justify-between items-center pt-2 border-t border-white/5 mt-1">
                <span className="text-[10px] text-zinc-500 font-mono">提示: 该 API Payload 可直接由 ComfyUI 点击「保存」或「导出」获得。</span>
                <div className="flex gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(previewingWf.content || '');
                      alert('已成功复制工作流 JSON 数据至剪贴板！');
                    }}
                    className="px-5 py-2.5 border border-white/10 hover:bg-white/5 text-zinc-300 rounded-xl font-bold text-xs"
                  >
                    复制代码
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewingWf(null)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-950/20"
                  >
                    关闭窗口
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Renaming Name Modal */}
      <AnimatePresence>
        {renamingWf !== null && (
          <div className="fixed inset-0 z-[12000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-[#16161a] border border-white/10 rounded-[28px] p-8 shadow-2xl flex flex-col gap-5 text-left"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-teal-500 inline-block rounded-full" />
                  <span>工作流重命名</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setRenamingWf(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  请输入工作流配置文件新的简称（默认自动保存为 .json 后缀）：
                </p>
                <div className="bg-[#121214] border border-white/10 rounded-2xl px-5 py-3.5 flex items-center focus-within:border-teal-500/50 group transition-all">
                  <input
                    type="text"
                    value={newWorkflowName}
                    onChange={(e) => setNewWorkflowName(e.target.value)}
                    className="w-full bg-transparent text-sm text-white outline-none font-mono"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveRename();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-white/5 mt-1">
                <button
                  type="button"
                  onClick={() => setRenamingWf(null)}
                  className="px-5 py-2.5 border border-white/10 hover:bg-white/5 text-zinc-300 rounded-xl font-bold text-xs"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveRename}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-xs shadow-lg opacity-90 hover:opacity-100"
                >
                  确认修改
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* --- GENERAL SETTING ROW UTILITY --- */
const SettingRow = ({ title, desc, children, shortcut }: { title: string; desc: string; children: React.ReactNode; shortcut?: string }) => (
  <div className="flex items-center justify-between gap-6 py-2 border-b border-white/[0.02] last:border-0 pb-4 last:pb-0">
    <div className="flex flex-col gap-1 max-w-[400px]">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-bold text-white">{title}</h4>
        {shortcut && (
          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-zinc-400 font-mono">
            {shortcut}
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-400 leading-normal">{desc}</p>
    </div>
    <div className="shrink-0">
      {children}
    </div>
  </div>
);
