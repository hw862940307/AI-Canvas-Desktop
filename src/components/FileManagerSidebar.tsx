import React, { useState, useRef, useEffect } from 'react';
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
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, FileItem, FolderItem } from '../store/useStore';
import { useReactFlow } from '@xyflow/react';

export const FileManagerSidebar = () => {
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
    addNode
  } = useStore();

  const { screenToFlowPosition } = useReactFlow();

  const [activeTab, setActiveTab] = useState<'history' | 'materials' | 'output'>('history');
  const [activeCategory, setActiveCategory] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // Calculate new width based on mouse position relative to sidebar (72px)
      const newWidth = Math.max(300, Math.min(800, e.clientX - 72));
      setFileManagerWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setFileManagerWidth]);

  const handleResizeStart = () => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const handleAddFileToCanvas = (file: FileItem) => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });
    addNode('image', center.x - 150, center.y - 120, { imageUrl: file.url });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, folderId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      addMaterial({
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 
              file.type.startsWith('video/') ? 'video' : 
              file.type.startsWith('audio/') ? 'audio' : 'other',
        url,
        size: file.size,
        folderId
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragStart = (event: React.DragEvent, file: FileItem) => {
    event.dataTransfer.setData('application/reactflow/type', 'image');
    event.dataTransfer.setData('application/reactflow/data', JSON.stringify({ imageUrl: file.url }));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (!showFileManager) return null;

  const filteredHistory = files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || f.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div 
      initial={{ x: -fileManagerWidth - 72 }}
      animate={{ x: 72 }}
      exit={{ x: -fileManagerWidth - 72 }}
      style={{ width: fileManagerWidth }}
      className="fixed top-0 bottom-0 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col z-[40] overflow-hidden shadow-[20px_0_40px_rgba(0,0,0,0.5)]"
    >
      {/* Resizer Handle on the Right */}
      <div 
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-[100]"
      />

      {/* Header */}
      <div className={`p-6 flex flex-col gap-4 border-b border-[var(--border)] transition-all ${
        settings.barTexture === 'frosted' ? 'frosted-glass border-b-white/5' : 'bg-[var(--bg-secondary)]'
      }`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">文件管理</h2>
          <button 
            onClick={toggleFileManager}
            className="p-2 hover:bg-red-500/10 rounded-lg text-[var(--text-secondary)] hover:text-red-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 p-1 bg-black/20 rounded-xl">
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-base font-bold rounded-lg transition-all ${
              activeTab === 'history' ? 'bg-[var(--bg-tertiary)] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            历史生成
          </button>
          <button 
            onClick={() => setActiveTab('materials')}
            className={`flex-1 py-2 text-base font-bold rounded-lg transition-all ${
              activeTab === 'materials' ? 'bg-[var(--bg-tertiary)] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            素材库
          </button>
          <button 
            onClick={() => setActiveTab('output')}
            className={`flex-1 py-2 text-base font-bold rounded-lg transition-all ${
              activeTab === 'output' ? 'bg-[var(--bg-tertiary)] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            输出文件夹
          </button>
        </div>
      </div>

      {activeTab === 'history' ? (
        <HistoryView 
          category={activeCategory} 
          setCategory={setActiveCategory} 
          files={filteredHistory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onAdd={handleAddFileToCanvas}
          onDelete={(id: string) => removeFile(id, false)}
          onDragStart={handleDragStart}
        />
      ) : activeTab === 'materials' ? (
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
        />
      ) : (
        <OutputView 
          onAdd={handleAddFileToCanvas}
          onDragStart={handleDragStart}
        />
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
};

const HistoryView = ({ category, setCategory, files, searchQuery, setSearchQuery, onAdd, onDelete, onDragStart }: any) => {
  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]/50">
      <div className="p-6 pb-0 space-y-4">
        <p className="text-sm text-gray-500 font-bold uppercase tracking-widest leading-none">
          当前项目生成媒体历史
        </p>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {(['all', 'image', 'video', 'audio'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
                category === cat 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              {cat === 'all' ? '所有' : cat === 'image' ? '图像' : cat === 'video' ? '视频' : '声音'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索历史文件..."
            className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-base text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 select-none">
            <ImageIcon size={48} strokeWidth={1} />
            <p className="text-sm font-bold mt-4 tracking-widest uppercase">暂无生成媒体历史</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {files.map((file: FileItem) => (
              <div 
                key={file.id} 
                draggable
                onDragStart={(e) => onDragStart(e, file)}
                className="group relative aspect-square bg-black/20 rounded-2xl overflow-hidden border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer"
              >
                {file.type === 'image' ? (
                  <img draggable={false} src={file.url} alt={file.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    {file.type === 'video' ? <Video size={24} /> : <Music size={24} />}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onAdd(file); }}
                    className="p-2 bg-blue-600 rounded-lg text-white hover:bg-blue-500 transition-colors shadow-lg"
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                    className="p-2 bg-white/10 rounded-lg text-white hover:bg-red-500/20 hover:text-red-400 transition-all"
                  >
                    <Minus size={16} />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-sm text-white truncate px-1 opacity-80">{file.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MaterialsView = ({ folders, materials, searchQuery, setSearchQuery, addFolder, removeFolder, updateFolder, onAdd, onDelete, addMaterial, clearFolderMaterials, onDragStart }: any) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tempPath, setTempPath] = useState('');
  const localSyncInputRef = useRef<HTMLInputElement>(null);

  const selectedFolder = folders.find((f: any) => f.id === selectedFolderId);
  const filteredMaterials = materials.filter((m: any) => m.folderId === selectedFolderId);

  // Real Sync Logic using Browser File Picker
  const handleSync = () => {
    if (!selectedFolderId) return;
    localSyncInputRef.current?.click();
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedFolderId) return;

    setIsSyncing(true);
    // Optionally clear current materials to "refresh" from local
    clearFolderMaterials(selectedFolderId);

    // Read files and add as materials with local blob URLs
    Array.from(files).forEach((file: File) => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        addMaterial({
          name: file.name,
          url: url,
          type: 'image',
          size: file.size,
          folderId: selectedFolderId
        });
      }
    });

    // Simulate a brief delay for UI feedback
    setTimeout(() => {
      setIsSyncing(false);
      // Clean up input
      if (localSyncInputRef.current) localSyncInputRef.current.value = '';
    }, 600);
  };

  // Toggle edit and save
  const handleToggleEdit = () => {
    if (isEditingPath) {
      updateFolder(selectedFolderId, { path: tempPath });
    } else {
      setTempPath(selectedFolder?.path || '');
    }
    setIsEditingPath(!isEditingPath);
  };

  const handleAddLocalPath = () => {
    const name = prompt('请输入文件夹名称:');
    if (!name) return;
    const newId = crypto.randomUUID();
    addFolder(name, 'C:\\AI\\Assets\\Local_Repo', undefined, newId);
    
    // Auto-select the newly created folder
    setTimeout(() => {
      setSelectedFolderId(newId);
    }, 100);
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]/50 overflow-hidden">
      {/* Hidden inputs for folder/file sync */}
      <input 
        type="file"
        ref={localSyncInputRef}
        onChange={handleLocalFileChange}
        className="hidden"
        multiple
        accept="image/*"
      />
      <div className="p-6 pb-0 space-y-4">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedFolderId && (
                <button 
                  onClick={() => setSelectedFolderId(null)}
                  className="p-1 hover:bg-white/5 rounded-lg text-gray-500 transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <h3 className="text-lg font-bold text-gray-300">
                {selectedFolderId ? selectedFolder?.name : '素材库'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
               <button className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all">
                  <Plus size={14} className="text-gray-400" />
                  <span className="text-sm font-bold text-gray-400">AI 角色</span>
               </button>
               <button 
                 onClick={handleAddLocalPath}
                 title="扫描本地路径"
                 className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all text-gray-400"
               >
                  <FolderPlus size={16} />
               </button>
            </div>
         </div>

          {selectedFolderId && (
           <div className="flex flex-col gap-3 p-4 bg-black/30 rounded-2xl border border-white/5 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <div className="w-1 h-1 bg-blue-500 rounded-full" />
                  物理路径
                </span>
                <button 
                  onClick={handleToggleEdit}
                  className={`px-2 py-0.5 rounded text-sm font-bold transition-all ${
                    isEditingPath 
                      ? 'bg-blue-600 text-white hover:bg-blue-500' 
                      : 'text-blue-500 hover:bg-blue-500/10'
                  }`}
                >
                  {isEditingPath ? '完成' : '编辑'}
                </button>
              </div>
              
              {isEditingPath ? (
                <div className="relative group">
                  <input 
                    type="text"
                    value={tempPath}
                    onChange={(e) => setTempPath(e.target.value)}
                    placeholder="输入文件夹路径..."
                    className="w-full bg-black/40 border border-blue-500/50 rounded-xl px-3 py-2 text-base text-white focus:outline-none focus:ring-1 ring-blue-500/30 transition-all font-mono"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleToggleEdit()}
                  />
                </div>
              ) : (
                <p className="text-base font-mono text-gray-400 break-all select-all leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5">
                  {selectedFolder?.path || '未设置路径'}
                </p>
              )}
           </div>
         )}

         {!selectedFolderId && (
           <div className="flex gap-2">
              <button className="flex-1 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm font-bold text-white shadow-sm">
                个人素材
              </button>
           </div>
         )}

         <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索素材..."
              className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-base text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
            />
         </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        {!selectedFolderId ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">文件夹</span>
              <button 
                onClick={() => addFolder(prompt('文件夹名称:') || '新文件夹')}
                className="text-gray-500 hover:text-blue-500 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {folders.map((folder: any) => (
                <div 
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-white/10 rounded-2xl cursor-pointer group transition-all"
                >
                  <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
                    <Folder size={20} className="text-blue-500/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-gray-200 truncate">{folder.name}</p>
                    <p className="text-sm text-gray-500 truncate mt-0.5 font-mono opacity-60 underline underline-offset-2">{folder.path}</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFolder(folder.id); }}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">预览资产 ({filteredMaterials.length})</span>
                <div className="flex items-center gap-2">
                  <button className="text-sm font-bold text-gray-500 hover:text-white uppercase transition-colors">尺寸</button>
                  <div className="w-px h-3 bg-white/10" />
                  <button className="text-sm font-bold text-gray-500 hover:text-white uppercase transition-colors">顺序</button>
                </div>
             </div>
             {filteredMaterials.length === 0 ? (
               <div className="h-64 flex flex-col items-center justify-center bg-black/10 border border-dashed border-white/5 rounded-2xl text-gray-600 opacity-50 select-none px-6 text-center">
                  <FolderOpen size={48} strokeWidth={1} className="mb-4" />
                  <p className="text-sm font-bold tracking-widest uppercase">物理目录扫描中...</p>
                  <p className="text-sm mt-2 leading-relaxed">请确保本地后端服务已启动并连接至此路径以同步预览数据。</p>
               </div>
             ) : (
               <div className="grid grid-cols-2 gap-4 pb-12">
                  {filteredMaterials.map((file: any) => (
                    <div 
                      key={file.id} 
                      draggable
                      onDragStart={(e) => onDragStart(e, file)}
                      className="group relative aspect-square bg-black/20 rounded-2xl overflow-hidden border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer shadow-lg active:scale-95"
                    >
                      <img draggable={false} src={file.url} alt={file.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAdd(file); }}
                          className="p-2.5 bg-blue-600 rounded-xl text-white hover:bg-blue-500 transition-all hover:scale-110 active:scale-90 shadow-xl"
                        >
                          <Plus size={18} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                          className="p-2.5 bg-white/10 rounded-xl text-white hover:bg-red-500/20 hover:text-red-400 transition-all"
                        >
                          <Minus size={18} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="text-sm text-white/70 truncate font-mono">{file.name}</p>
                      </div>
                    </div>
                  ))}
               </div>
             )}
          </div>
        )}
      </div>

      {selectedFolderId && (
        <div className="p-4 border-t border-[var(--border)] bg-black/20 flex gap-2">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {isSyncing ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                扫描中...
              </>
            ) : (
              <>
                <FolderOpen size={14} />
                同步资产
              </>
            )}
          </button>
          <button className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition-all hover:text-white">
            <Search size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

const OutputView = ({ onAdd, onDragStart }: any) => {
  const [folders] = useState([
    { name: 'Multiple grids', id: 'out-1' },
    { name: 'mask_preview', id: 'out-2' },
    { name: 'mask', id: 'out-3' },
    { name: '_derived', id: 'out-4' },
  ]);
  const [files, setFiles] = useState([
    { id: 'f-1', name: 'output_001.png', url: 'https://picsum.photos/seed/out1/800/800', type: 'image' as const },
    { id: 'f-2', name: 'output_002.png', url: 'https://picsum.photos/seed/out2/800/800', type: 'image' as const },
    { id: 'f-3', name: 'output_003.png', url: 'https://picsum.photos/seed/out3/800/800', type: 'image' as const },
    { id: 'f-4', name: 'output_004.png', url: 'https://picsum.photos/seed/out4/800/800', type: 'image' as const },
    { id: 'f-5', name: 'output_005.png', url: 'https://picsum.photos/seed/out5/800/800', type: 'image' as const },
    { id: 'f-6', name: 'output_006.png', url: 'https://picsum.photos/seed/out6/800/800', type: 'image' as const },
  ]);

  const handleDeleteFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]/50 overflow-hidden">
      <div className="p-6 pb-4 border-b border-[var(--border)] space-y-4">
        <p className="text-sm text-gray-500 font-bold uppercase tracking-widest leading-none">
          浏览 output 输出目录
        </p>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm font-bold text-gray-400">
            output
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-2 gap-4">
          {folders.map(folder => (
            <div key={folder.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 cursor-pointer transition-all flex flex-col items-center gap-3 group">
              <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Folder size={24} className="text-blue-500" />
              </div>
              <span className="text-sm font-bold text-gray-400 text-center line-clamp-1">{folder.name}</span>
            </div>
          ))}
          {files.map(file => (
            <div 
              key={file.id} 
              draggable
              onDragStart={(e) => onDragStart(e, file)}
              className="group relative aspect-[3/4] bg-black/20 rounded-2xl overflow-hidden border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer"
            >
              <img draggable={false} src={file.url} alt={file.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                 <button 
                    onClick={(e) => { e.stopPropagation(); onAdd(file); }}
                    className="p-2 bg-blue-600 rounded-lg text-white hover:bg-blue-500 transition-colors shadow-lg"
                  >
                    <Plus size={16} />
                 </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
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
