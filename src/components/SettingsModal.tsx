import React, { useState } from 'react';
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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, AppSettings, MouseSize, AppTheme, BarTexture, FontSize, UploadQuality, MultiSelectMode } from '../store/useStore';

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = 'general' | 'canvas' | 'node' | 'file' | 'api' | 'subscription' | 'keyboard';

export const SettingsModal = ({ onClose }: SettingsModalProps) => {
  const { settings, updateSettings } = useStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: '常规', icon: <Grid3X3 size={18} /> },
    { id: 'canvas', label: '画布与对齐', icon: <AlignJustify size={18} /> },
    { id: 'node', label: '节点行为', icon: <MousePointer2 size={18} /> },
    { id: 'file', label: '文件与保存', icon: <FolderOpen size={18} /> },
    { id: 'api', label: 'API 输入', icon: <FileDown size={18} /> },
    { id: 'subscription', label: '订阅中心', icon: <CreditCard size={18} /> },
    { id: 'keyboard', label: '键盘快捷键', icon: <Keyboard size={18} /> },
  ];

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-5xl h-[80vh] border border-[var(--border)] rounded-[32px] overflow-hidden flex shadow-2xl shadow-black/50 ${
          settings.barTexture === 'frosted' ? 'frosted-glass' : 'bg-[var(--bg-secondary)]'
        }`}
      >
        {/* Sidebar */}
        <div className={`w-64 border-r border-[var(--border)] p-6 flex flex-col gap-6 ${
          settings.barTexture === 'frosted' ? 'bg-black/20' : 'bg-[var(--bg-tertiary)]'
        }`}>
          <h2 className="text-xl font-bold text-[var(--text-primary)] px-2">设置</h2>
          <div className="flex flex-col gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                  activeTab === tab.id 
                    ? 'bg-accent/10 text-accent border border-accent/20' 
                    : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'
                }`}
              >
                {tab.icon}
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 flex flex-col min-w-0 ${
          settings.barTexture === 'frosted' ? 'bg-transparent' : 'bg-[var(--bg-secondary)]'
        }`}>
          <div className={`h-16 flex items-center justify-between px-8 border-b border-[var(--border)] ${
            settings.barTexture === 'frosted' ? 'bg-white/5' : ''
          }`}>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              {tabs.find(t => t.id === activeTab)?.label}
            </h3>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {activeTab === 'general' && <GeneralSettings settings={settings} update={updateSettings} />}
            {activeTab === 'canvas' && <CanvasSettings settings={settings} update={updateSettings} />}
            {activeTab === 'file' && <FileSettings settings={settings} update={updateSettings} />}
            {activeTab === 'api' && <ApiSettingsComponent settings={settings} update={updateSettings} onClose={onClose} />}
            {['node', 'subscription', 'keyboard'].includes(activeTab) && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                <Zap size={48} className="opacity-20" />
                <p>该功能正在开发中...</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const GeneralSettings = ({ settings, update }: { settings: AppSettings, update: (s: Partial<AppSettings>) => void }) => {
  return (
    <div className="flex flex-col gap-10">
      <SettingRow 
        title="鼠标大小" 
        desc="选择光标显示大小" 
      >
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-[var(--border)]">
          {(['small', 'medium', 'large'] as MouseSize[]).map((size) => (
            <button
              key={size}
              onClick={() => update({ mouseSize: size })}
              className={`flex-1 px-4 py-2 rounded-lg text-lg transition-all flex items-center gap-2 ${
                settings.mouseSize === size ? 'bg-accent text-white shadow-lg' : 'text-gray-400 hover:text-white'
              }`}
            >
              <MousePointer size={size === 'small' ? 12 : size === 'medium' ? 16 : 20} />
              {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow 
        title="应用主题" 
        desc="切换界面整体明暗外观" 
      >
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-[var(--border)]">
          {(['dark', 'mist', 'light'] as AppTheme[]).map((t) => (
            <button
              key={t}
              onClick={() => update({ theme: t })}
              className={`flex-1 px-5 py-2.5 rounded-lg text-lg transition-all flex flex-col items-center gap-1 min-w-[70px] ${
                settings.theme === t ? 'bg-accent text-white shadow-lg' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'dark' && <Moon size={18} />}
              {t === 'mist' && <Cloud size={18} />}
              {t === 'light' && <Sun size={18} />}
              <span className="text-sm mt-1">{t === 'dark' ? '暗夕' : t === 'mist' ? '晨雾' : '白昼'}</span>
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow 
        title="自定义颜色主体" 
        desc="设置应用全局的主题点缀色" 
      >
        <div className="flex gap-3 items-center">
          {['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f97316'].map((color) => (
            <button
              key={color}
              onClick={() => update({ themeColor: color })}
              className={`w-10 h-10 rounded-full border-2 transition-all shadow-md ${settings.themeColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: color }}
            />
          ))}
          <div className="w-px h-6 bg-[var(--border)] mx-1" />
          <input 
            type="color" 
            value={settings.themeColor || '#3b82f6'} 
            onChange={(e) => update({ themeColor: e.target.value })}
            className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0 bg-transparent"
          />
        </div>
      </SettingRow>

      <SettingRow 
        title="提示词与动作栏质感" 
        desc="控制节点底部输入栏和浮动动作栏的背景样式" 
      >
        <div className="flex gap-2">
          {(['transparent', 'frosted'] as BarTexture[]).map((tex) => (
            <button
              key={tex}
              onClick={() => update({ barTexture: tex })}
              className={`px-6 py-2 rounded-xl text-lg border transition-all ${
                settings.barTexture === tex 
                  ? 'bg-accent/10 border-accent/50 text-accent' 
                  : 'bg-white/5 border-[var(--border)] text-gray-400 hover:text-white'
              }`}
            >
              {tex === 'transparent' ? '透明' : '毛玻璃'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="网格点显示" desc="只影响显示，不影响网格吸附" shortcut=".">
        <div className="flex bg-white/5 rounded-xl border border-[var(--border)] p-1">
          {[true, false].map((v) => (
            <button 
              key={String(v)}
              className={`px-6 py-1.5 rounded-lg text-lg flex-1 transition-all ${
                useStore.getState().isGridVisible === v 
                  ? 'bg-accent text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => useStore.getState().toggleGrid()}
            >
              {v ? '开' : '关'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="输入字体大小 (px)" desc="手动设置节点提示词输入框的字体大小">
        <div className="flex bg-white/5 rounded-xl border border-[var(--border)] p-1">
          <input
            type="number"
            min="10"
            max="100"
            value={typeof settings.inputFontSize === 'number' ? settings.inputFontSize : (settings.inputFontSize === 'small' ? 10 : settings.inputFontSize === 'large' ? 16 : 14)}
            onChange={(e) => update({ inputFontSize: parseInt(e.target.value) || 14 })}
            className="w-full bg-transparent text-lg text-[var(--text-primary)] outline-none px-4 py-2 text-center"
          />
        </div>
      </SettingRow>

      <SettingRow title="节点 UI 文字大小 (px)" desc="调节所有卡片节点的 UI 文字与排版大小比例">
        <div className="flex bg-white/5 rounded-xl border border-[var(--border)] p-1 items-center gap-4 min-w-[240px] w-full px-2">
          <input 
            type="range"
            min="0"
            max="200"
            step="1"
            value={settings.nodeUiFontSize ?? 14}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              update({ nodeUiFontSize: isNaN(val) ? 0 : val });
            }}
            className="flex-1 accent-accent h-1.5 rounded-lg appearance-none bg-white/10 cursor-pointer"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <input 
              type="number"
              min="0"
              max="200"
              value={settings.nodeUiFontSize ?? 14}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                update({ nodeUiFontSize: isNaN(val) ? 0 : Math.max(0, Math.min(200, val)) });
              }}
              className="w-14 py-0.5 text-center bg-black/40 text-sm font-semibold font-mono text-white rounded-lg border border-[var(--border)] focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs font-black text-white/30 font-mono">PX</span>
          </div>
        </div>
      </SettingRow>

      <SettingRow title="图片入参上传质量" desc="生成前参考图上传的压缩档位">
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-[var(--border)]">
          {(['standard', 'high', 'original'] as UploadQuality[]).map((q) => (
            <button
              key={q}
              onClick={() => update({ uploadQuality: q })}
              className={`px-4 py-2 rounded-lg text-lg transition-all ${
                settings.uploadQuality === q 
                  ? 'bg-accent/10 text-accent border border-accent/30' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {q === 'standard' ? '标准' : q === 'high' ? '高保真' : '原图优先'}
            </button>
          ))}
        </div>
      </SettingRow>
    </div>
  );
};

const CanvasSettings = ({ settings, update }: { settings: AppSettings, update: (s: Partial<AppSettings>) => void }) => {
  return (
    <div className="flex flex-col gap-10">
      <SettingRow title="点击节点时高亮关联节点" desc="选中节点后高亮直接连接的上下游节点和连线">
        <div className="flex bg-white/5 rounded-xl border border-[var(--border)] p-1">
          {[true, false].map((v) => (
            <button 
              key={String(v)}
              className={`px-6 py-1.5 rounded-lg text-lg min-w-[60px] transition-all ${
                settings.highlightAssociated === v 
                  ? 'bg-accent text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => update({ highlightAssociated: v })}
            >
              {v ? '开' : '关'}
            </button>
          ))}
        </div>
      </SettingRow>

      {settings.highlightAssociated && (
        <div className="ml-8 -mt-6">
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-lg text-white font-medium">高亮颜色</span>
              <span className="text-base text-gray-500">设置关联节点边框与光晕颜色</span>
            </div>
            <div className="flex gap-2">
              {['#ffffff', '#3b82f6', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444', '#f59e0b'].map(c => (
                <button
                  key={c}
                  onClick={() => update({ highlightColor: c })}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${settings.highlightColor === c ? 'border-white scale-125' : 'border-transparent hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <SettingRow title="连接线显示" desc="只控制画布上的连接线可见性，不影响节点连接关系" shortcut="B">
        <div className="flex bg-white/5 rounded-xl border border-[var(--border)] p-1">
          {[true, false].map((v) => (
            <button 
              key={String(v)}
              className={`px-6 py-1.5 rounded-lg text-lg min-w-[60px] transition-all ${
                settings.showConnections === v 
                  ? 'bg-accent text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => update({ showConnections: v })}
            >
              {v ? '开' : '关'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="辅助线吸附" desc="开启后单节点拖拽时显示辅助线并自动吸附" shortcut=";">
        <div className="flex bg-white/5 rounded-xl border border-[var(--border)] p-1">
          {[true, false].map((v) => (
            <button 
              key={String(v)}
              className={`px-6 py-1.5 rounded-lg text-lg min-w-[60px] transition-all ${
                settings.snapToGuidelines === v 
                  ? 'bg-accent text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => update({ snapToGuidelines: v })}
            >
              {v ? '开' : '关'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="网格吸附" desc="开启后拖拽节点时按网格点对齐" shortcut="L">
        <div className="flex bg-white/5 rounded-xl border border-[var(--border)] p-1">
          {[true, false].map((v) => (
            <button 
              key={String(v)}
              className={`px-6 py-1.5 rounded-lg text-lg min-w-[60px] transition-all ${
                settings.snapToGrid === v 
                  ? 'bg-accent text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => update({ snapToGrid: v })}
            >
              {v ? '开' : '关'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="启动多选对齐功能" desc="可设置为长按或点击快捷触发中心对齐面板" shortcut="Tab">
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-[var(--border)]">
          {(['longPress', 'click', 'disabled'] as MultiSelectMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ multiSelectAlignmentMode: mode })}
              className={`px-5 py-2 rounded-lg text-lg transition-all ${
                settings.multiSelectAlignmentMode === mode ? 'bg-accent text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {mode === 'longPress' ? '长按开启' : mode === 'click' ? '点击开启' : '关闭'}
            </button>
          ))}
        </div>
      </SettingRow>

      <div className="ml-8 -mt-6 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-lg text-white font-medium">对齐间距</span>
            <span className="text-base text-gray-500">分布时固定首节点，后续节点按该间距顺排</span>
          </div>
          <div className="flex items-center gap-4 min-w-[240px]">
            <input 
              type="range"
              min="0"
              max="200"
              value={settings.alignmentSpacing}
              onChange={(e) => update({ alignmentSpacing: parseInt(e.target.value) })}
              className="flex-1 accent-accent h-1.5 rounded-lg appearance-none bg-white/10 cursor-pointer"
            />
            <span className="text-lg font-mono text-white/50 w-8">{settings.alignmentSpacing}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const FileSettings = ({ settings, update }: { settings: AppSettings, update: (s: Partial<AppSettings>) => void }) => {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg text-gray-500 mb-6 font-medium">配置项目、素材数据和生成输出的本地保存目录。授权、API Key 和用户设置固定保存在应用数据目录。</p>
      
      <div className="flex flex-col gap-4 p-6 bg-white/[0.02] border border-[var(--border)] rounded-[24px]">
        <PathInput 
          label="项目保存路径" 
          desc="保存画布项目文件" 
          value={settings.projectPath} 
          onChange={(v) => update({ projectPath: v })}
        />
        <PathInput 
          label="数据文件保存路径" 
          desc="保存上传素材、资产库和工作流数据" 
          value={settings.dataPath} 
          onChange={(v) => update({ dataPath: v })}
        />
        <PathInput 
          label="输出文件保存路径" 
          desc="保存生成图片、视频、音频、裁剪和合成结果" 
          value={settings.outputPath} 
          onChange={(v) => update({ outputPath: v })}
        />
      </div>
    </div>
  );
};

const PathInput = ({ label, desc, value, onChange }: { label: string; desc: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between gap-8 py-2">
    <div className="flex flex-col gap-1">
      <span className="text-lg text-[var(--text-primary)] font-bold">{label}</span>
      <span className="text-base text-[var(--text-secondary)]">{desc}</span>
    </div>
    <div className="flex-1 flex items-center bg-white/5 border border-[var(--border)] rounded-xl px-4 py-3 group hover:border-[var(--border)] transition-all">
      <input 
        className="w-full bg-transparent text-lg text-[var(--text-secondary)] outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  </div>
);

const ApiSettingsComponent = ({ settings, update, onClose }: { settings: AppSettings, update: (s: Partial<AppSettings>) => void, onClose: () => void }) => {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const api = settings.apiSettings;

  const updateApi = (newApi: Partial<typeof api>) => {
    update({ apiSettings: { ...api, ...newApi } });
  };

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      let apiKey = api.apiKey;
      if (!apiKey && api.engine === 'gemini') {
        const env = (import.meta as any).env;
        apiKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : (env ? env.VITE_GEMINI_API_KEY : '');
      }

      if (!apiKey) {
        throw new Error(`API Key for ${api.engine} is missing in the settings form.`);
      }

      const messages = [{ role: 'user', content: "Hello, testing connection. Reply with exactly 'OK'." }];
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: api.engine,
          baseUrl: api.baseUrl,
          apiKey: apiKey,
          modelId: api.modelId,
          messages: messages
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Server connection error');
      }

      const data = await response.json();
      const result = data.text || '';
      
      if (!result || typeof result !== 'string' || result.trim() === '') {
        throw new Error("Received empty response from the language model.");
      }
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (e: any) {
      console.error("Test connection failed:", e);
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 3000);
      alert("API Connection Failed: " + (e.message || String(e)));
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-center p-1 bg-white/5 rounded-2xl border border-[var(--border)] w-fit mx-auto mb-4">
        <button
          onClick={() => updateApi({ isCustom: false })}
          className={`px-8 py-2.5 rounded-xl text-lg font-bold transition-all ${
            !api.isCustom ? 'bg-white text-black shadow-xl' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          内置 (Core)
        </button>
        <button
          onClick={() => updateApi({ isCustom: true })}
          className={`px-8 py-2.5 rounded-xl text-lg font-bold transition-all ${
            api.isCustom ? 'bg-white text-black shadow-xl' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          自定义 (Custom)
        </button>
      </div>

      <div className="space-y-6 bg-black/40 p-8 rounded-[32px] border border-[var(--border)]">
        <div className="space-y-2">
          <label className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] ml-4">Api Engine</label>
          <div className="relative group">
            <select
              value={api.engine}
              onChange={(e) => updateApi({ engine: e.target.value as any })}
              disabled={!api.isCustom}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-6 py-4 text-lg text-white appearance-none focus:outline-none focus:border-accent/50 transition-all font-bold disabled:opacity-50"
            >
              <option value="gemini">Gemini API</option>
              <option value="openai">OpenAI API</option>
              <option value="claude">Claude API</option>
              <option value="doubao">豆包 (Doubao)</option>
              <option value="qianwen">千问 (Qianwen)</option>
              <option value="deepseek">DeepSeek</option>
              <option value="custom">Custom Engine</option>
            </select>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
              <Link size={14} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] ml-4">Base URL</label>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-6 py-4 flex items-center gap-4 focus-within:border-accent/50 transition-all group">
            <input
              type="text"
              value={api.baseUrl}
              onChange={(e) => updateApi({ baseUrl: e.target.value })}
              disabled={!api.isCustom}
              placeholder="https://api.example.com"
              className="flex-1 bg-transparent text-lg text-white font-mono outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] ml-4">Api Key</label>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-6 py-4 flex items-center gap-4 focus-within:border-accent/50 transition-all group">
              <input
                type="password"
                value={api.apiKey}
                onChange={(e) => updateApi({ apiKey: e.target.value })}
                placeholder="........"
                className="flex-1 bg-transparent text-lg text-white outline-none"
              />
              <Key size={14} className="text-gray-500" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] ml-4">Model ID</label>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-6 py-4 flex items-center gap-4 focus-within:border-accent/50 transition-all group">
              <input
                type="text"
                value={api.modelId}
                onChange={(e) => updateApi({ modelId: e.target.value })}
                placeholder="gemini-1.5-pro"
                className="flex-1 bg-transparent text-lg text-white outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 bg-black/40 p-8 rounded-[32px] border border-[var(--border)]">
        <h3 className="text-lg font-bold text-white mb-4">Picture Generation Settings</h3>
        <div className="space-y-2">
          <label className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] ml-4">Image Engine</label>
          <div className="relative group">
            <select
              value={api.imageEngine}
              onChange={(e) => updateApi({ imageEngine: e.target.value as any })}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-6 py-4 text-lg text-white appearance-none focus:outline-none focus:border-accent/50 transition-all font-bold"
            >
              <option value="online">Online (在线文生图)</option>
              <option value="comfyui">ComfyUI (本地生图)</option>
            </select>
          </div>
        </div>

        {api.imageEngine === 'online' && (
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] ml-4">Image Model</label>
            <div className="relative group">
              <select
                value={api.imageModel}
                onChange={(e) => updateApi({ imageModel: e.target.value as any })}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-6 py-4 text-lg text-white appearance-none focus:outline-none focus:border-accent/50 transition-all font-bold"
              >
                <option value="Nano Banana Pro">Nano Banana Pro</option>
                <option value="Nano Banana 2">Nano Banana 2</option>
                <option value="chatgptimage2">chatgptimage2</option>
                <option value="SDXL">SDXL</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        )}

        {api.imageEngine === 'comfyui' && (
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] ml-4">ComfyUI URL</label>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-6 py-4 flex items-center gap-4 focus-within:border-accent/50 transition-all group">
              <input
                type="text"
                value={api.comfyUrl}
                onChange={(e) => updateApi({ comfyUrl: e.target.value })}
                placeholder="http://127.0.0.1:8188"
                className="flex-1 bg-transparent text-lg text-white font-mono outline-none"
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6 bg-black/40 p-8 rounded-[32px] border border-[var(--border)]">
        <button
          onClick={testConnection}
          disabled={testStatus === 'testing'}
          className={`w-full py-6 rounded-3xl border transition-all flex items-center justify-center gap-3 font-bold text-lg tracking-widest uppercase ${
            testStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500' :
            testStatus === 'error' ? 'bg-red-500/10 border-red-500/40 text-red-500' :
            'bg-white/[0.02] border-[var(--border)] text-gray-500 hover:bg-white/[0.05] hover:text-white'
          }`}
        >
          {testStatus === 'testing' ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <Zap size={18} />
            </motion.div>
          ) : testStatus === 'success' ? (
            <Check size={18} />
          ) : testStatus === 'error' ? (
            <X size={18} />
          ) : <Zap size={18} />}
          {testStatus === 'testing' ? 'Testing Connection...' : 
           testStatus === 'success' ? 'Connection Successful' :
           testStatus === 'error' ? 'Connection Failed' : 'Click to Test API Connection'}
        </button>
      </div>

      <button
        onClick={onClose}
        className="w-full bg-[#f94e10] hover:bg-[#ff5f20] text-white py-6 rounded-[24px] font-black text-lg transition-all shadow-xl shadow-[#f94e10]/20 active:scale-[0.98]"
      >
        Save Settings
      </button>
    </div>
  );
};

const SettingRow = ({ title, desc, children, shortcut }: { title: string; desc: string; children: React.ReactNode; shortcut?: string }) => (
  <div className="flex items-center justify-between">
    <div className="flex flex-col gap-1.5 max-w-[400px]">
      <div className="flex items-center gap-3">
        <h4 className="text-[17px] font-bold text-[var(--text-primary)]">{title}</h4>
        {shortcut && (
          <span className="px-2 py-0.5 rounded bg-white/5 border border-[var(--border)] text-sm text-[var(--text-secondary)] font-mono">
            {shortcut}
          </span>
        )}
      </div>
      <p className="text-lg text-[var(--text-secondary)] leading-relaxed font-medium">{desc}</p>
    </div>
    {children}
  </div>
);
