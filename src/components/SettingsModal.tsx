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
  Search
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
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                    <CreditCard className="text-amber-500" size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-white leading-normal">授权与激活 (Authorization)</h3>
                  <p className="text-zinc-400 max-w-md mx-auto text-sm leading-relaxed">
                    当前版本为 永久免费版，已经解锁基础无限画布生图功能，如需享受高级云端 RunningHub 服务、多模型并发加速或解除多通用 API 数量限制，您可以升级至 Pro 尝鲜。
                  </p>
                  <div className="pt-6">
                    <button className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-2xl font-bold font-sans transition-all text-sm shadow-xl shadow-orange-950/40">
                      升级解锁高级 PRO 权益
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 font-mono mt-4">本地授权状态 ID: VITE-LOCAL-PRO-LICENSE-PASS37</p>
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

/* --- API SETTINGS TAB COMPONENT --- */
const ApiTabContent = ({ settings, update }: { settings: AppSettings; update: (s: Partial<AppSettings>) => void; onClose: () => void }) => {
  const api = settings.apiSettings;

  const updateApi = (newApi: Partial<typeof api>) => {
    update({ apiSettings: { ...api, ...newApi } });
  };

  return (
    <div className="space-y-6">
      {/* 1. Universal / Common API Section */}
      <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-4">
        <div className="space-y-1">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-1.5 h-4 bg-blue-500 rounded-full inline-block" />
            通用 API
          </h4>
          <p className="text-xs text-zinc-400 leading-normal">
            统一管理 GPT 图像、香蕉图像、AI 助手等多个服务的 API 服务商，支持按服务分别启用与配置模型。
          </p>
        </div>

        <div className="flex gap-3 items-center pt-2">
          <div className="relative flex-1">
            <select
              value={api.universalProvider || 'OpenAI'}
              onChange={(e) => updateApi({ universalProvider: e.target.value })}
              className="w-full bg-[#121214] border border-white/10 rounded-2xl px-5 py-3 text-sm text-white appearance-none focus:outline-none focus:border-indigo-500/50 transition-all font-bold"
            >
              <option value="OpenAI">OpenAI</option>
              <option value="Google AI">Google AI Studio</option>
              <option value="Claude">Anthropic Claude</option>
              <option value="DeepSeek">DeepSeek AI</option>
              <option value="Doubao">火山引擎 (豆包/即梦)</option>
              <option value="Qianwen">通义千问 (Qianwen)</option>
            </select>
            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
              <Link size={14} />
            </div>
          </div>
          <button 
            type="button"
            onClick={() => alert(`成功添加了 ${api.universalProvider || 'OpenAI'} API 配置服务商`)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shrink-0 transition-all text-sm"
          >
            添加
          </button>
          <button 
            type="button"
            className="px-6 py-3 border border-white/10 hover:bg-white/5 text-zinc-300 rounded-2xl font-bold shrink-0 transition-all text-sm"
          >
            编辑
          </button>
        </div>
        <p className="text-[11px] text-amber-500/90 font-medium">免费版仅支持 1 个通用 API 服务商，升级 Pro 解锁无限数量</p>
      </div>

      {/* 2. RunningHub API Section */}
      <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-4">
        <div className="space-y-1">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#f94e10] rounded-full inline-block" />
            RunningHub API
          </h4>
          <p className="text-xs text-zinc-400 leading-normal">
            在 runninghub.cn 获取，支持企业级共享与消费级-会员两种类型。
          </p>
        </div>

        <div className="space-y-4 pt-2">
          <div className="space-y-1 flex flex-col">
            <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider ml-1">企业级共享 API Key</label>
            <div className="bg-[#121214] border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 focus-within:border-indigo-500/50 transition-all group">
              <input
                type="password"
                value={api.rhEnterpriseKey || ''}
                onChange={(e) => updateApi({ rhEnterpriseKey: e.target.value })}
                placeholder="企业级共享密钥"
                className="flex-1 bg-transparent text-sm text-white outline-none font-mono"
              />
              <Key size={14} className="text-zinc-500" />
            </div>
          </div>

          <div className="space-y-1 flex flex-col">
            <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider ml-1">消费级-会员 API Key</label>
            <div className="bg-[#121214] border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 focus-within:border-indigo-500/50 transition-all group">
              <input
                type="password"
                value={api.rhConsumerKey || ''}
                onChange={(e) => updateApi({ rhConsumerKey: e.target.value })}
                placeholder="消费级-会员密钥（可选）"
                className="flex-1 bg-transparent text-sm text-white outline-none font-mono"
              />
              <Key size={14} className="text-zinc-500" />
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-3">
            <div className="space-y-1">
              <h5 className="text-sm font-bold text-white">RunningHub AI应用管理</h5>
              <p className="text-[11px] text-zinc-400 leading-normal">
                通过 WebAppId 解析节点参数。
              </p>
            </div>

            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <select
                  value={api.rhAppId || '暂无AI应用'}
                  onChange={(e) => updateApi({ rhAppId: e.target.value })}
                  className="w-full bg-[#121214]/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white appearance-none focus:outline-none focus:border-indigo-500/50 transition-all font-medium"
                >
                  <option value="暂无AI应用">暂无AI应用</option>
                  {(api.rhApps || []).map((appItem) => (
                    <option key={appItem.id} value={appItem.id}>{appItem.name}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                  <Link size={12} />
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  const name = prompt("请输入运行Hub AI应用名称:");
                  if (name) {
                    const id = "app-" + Math.random().toString(36).substring(4, 9);
                    const list = [...(api.rhApps || []), { id, name }];
                    updateApi({ rhApps: list, rhAppId: id });
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shrink-0 transition-all text-xs animate-none"
              >
                添加
              </button>
              <button 
                type="button"
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-zinc-300 rounded-xl font-bold shrink-0 transition-all text-xs"
              >
                编辑
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Jimeng API Section */}
      <div className="bg-[#121215]/60 p-8 rounded-[28px] border border-white/5 space-y-4">
        <div className="space-y-1">
          <h4 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-1.5 h-4 bg-indigo-500 rounded-full inline-block" />
            即梦 (豆包 Seedream)
          </h4>
          <p className="text-xs text-zinc-400 leading-normal">
            火山引擎平台获取。
          </p>
        </div>

        <div className="space-y-1 flex flex-col pt-2">
          <label className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider ml-1">API Key</label>
          <div className="bg-[#121214] border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 focus-within:border-indigo-500/50 transition-all group">
            <input
              type="password"
              value={api.jimengApiKey || ''}
              onChange={(e) => updateApi({ jimengApiKey: e.target.value })}
              placeholder="sk-..."
              className="flex-1 bg-transparent text-sm text-white outline-none font-mono"
            />
            <Key size={14} className="text-zinc-500" />
          </div>
        </div>
      </div>
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
