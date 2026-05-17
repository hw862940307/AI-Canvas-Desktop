import React, { useState, useRef, useMemo } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { 
  Images, 
  FolderOpen, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  LayoutGrid, 
  List, 
  Maximize2, 
  Minimize2, 
  X, 
  Plus,
  History,
  Archive,
  ArrowLeft,
  FolderPlus,
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  Minus
} from 'lucide-react';
import { useStore, FileItem } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

export function IoImageListNode({ id, data, selected }: NodeProps) {
  const nodeData = data as any;

  const { 
    updateNodeData, 
    files: historyFiles, 
    folders, 
    materials, 
    addMaterial, 
    addFolder, 
    removeFolder, 
    updateFolder,
    removeFile,
    clearFolderMaterials,
    addNode
  } = useStore();
  const { screenToFlowPosition } = useReactFlow();

  const [activeTab, setActiveTab] = useState<'library' | 'history' | 'materials' | 'output'>(nodeData.activeTab || 'library');
  const [images, setImages] = useState<any[]>(nodeData.images || []);
  const [selectedIndices, setSelectedIndices] = useState<number[]>(nodeData.selectedIndices || []);
  const [thumbSize, setThumbSize] = useState(nodeData.thumbSize || 80);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(nodeData.viewMode || 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyCategory, setHistoryCategory] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  // Sync state with data changes (e.g. from global paste)
  React.useEffect(() => {
    if (nodeData.images) {
      setImages(nodeData.images);
    }
  }, [nodeData.images]);

  React.useEffect(() => {
    if (nodeData.selectedIndices) {
      setSelectedIndices(nodeData.selectedIndices);
    }
  }, [nodeData.selectedIndices]);

  const updateStore = (updates: any) => {
    updateNodeData(id, updates);
  };

  const handleImportLocal = (folderId?: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => {
      const filesArr = Array.from(input.files || []);
      
      if (activeTab === 'library') {
        const newImages = [...images];
        filesArr.forEach(file => {
          const url = URL.createObjectURL(file);
          newImages.push({
            url,
            name: file.name,
            path: file.name,
            size: file.size,
            source: 'local'
          });
        });
        setImages(newImages);
        updateStore({ images: newImages });
      } else if (activeTab === 'materials') {
        filesArr.forEach(file => {
          const reader = new FileReader();
          reader.onload = (event) => {
            addMaterial({
              name: file.name,
              type: 'image',
              url: event.target?.result as string,
              size: file.size,
              folderId: folderId || selectedFolderId || undefined
            });
          };
          reader.readAsDataURL(file);
        });
      }
    };
    input.click();
  };

  const handleItemDragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData('application/reactflow/type', 'image');
    e.dataTransfer.setData('application/reactflow/data', JSON.stringify({ imageUrl: url }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleAddToCanvas = (url: string) => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });
    addNode('image', center.x - 150, center.y - 120, { imageUrl: url });
  };

  const toggleSelect = (index: number) => {
    const next = selectedIndices.includes(index)
      ? selectedIndices.filter(i => i !== index)
      : [...selectedIndices, index].sort((a, b) => a - b);
    setSelectedIndices(next);
    updateStore({ selectedIndices: next });
  };

  const clear = () => {
    setImages([]);
    setSelectedIndices([]);
    updateStore({ images: [], selectedIndices: [] });
  };

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const processFiles = (files: File[]) => {
    const newImages = [...images];
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      newImages.push({
        url,
        name: file.name,
        path: file.name,
        size: file.size,
        source: 'local'
      });
    });
    setImages(newImages);
    updateStore({ images: newImages });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

    const dataTransfer = e.dataTransfer;
    
    // 1. Files
    const files = dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files).filter(f => f.type.startsWith('image/')));
      return;
    }

    // 2. ReactFlow Data (Internal/FileManager)
    const rfType = dataTransfer.getData('application/reactflow/type');
    const rfDataRaw = dataTransfer.getData('application/reactflow/data');
    const rfDataOld = dataTransfer.getData('application/reactflow');

    if (rfDataRaw) {
      try {
        const d = JSON.parse(rfDataRaw);
        if (d.imageUrl || d.url) {
          const url = d.imageUrl || d.url;
          const newImages = [...images, { url, name: 'Imported', path: 'External', source: 'imported' }];
          setImages(newImages);
          updateStore({ images: newImages });
          return;
        }
      } catch(e) {}
    } else if (rfDataOld) {
      try {
        const d = JSON.parse(rfDataOld);
        if (d.imageUrl || d.url) {
          const url = d.imageUrl || d.url;
          const newImages = [...images, { url, name: 'Imported', path: 'Node', source: 'node' }];
          setImages(newImages);
          updateStore({ images: newImages });
          return;
        }
      } catch(e) {}
    }

    // 3. Plain URL
    const url = dataTransfer.getData('text/plain') || dataTransfer.getData('url');
    if (url && (url.startsWith('http') || url.startsWith('data:'))) {
      const newImages = [...images, { url, name: 'Web Image', path: url, source: 'web' }];
      setImages(newImages);
      updateStore({ images: newImages });
    }
  };

  const filteredHistory = useMemo(() => {
    return historyFiles.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = historyCategory === 'all' || f.type === historyCategory;
      return matchesSearch && matchesCategory;
    });
  }, [historyFiles, searchQuery, historyCategory]);

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => m.folderId === selectedFolderId && m.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [materials, selectedFolderId, searchQuery]);

  const ListContent = (isPortal = false) => {
    const containerClasses = isPortal ? 'w-[90vw] h-[85vh] rounded-[32px] shadow-2xl' : 'flex-1 rounded-2xl';
    
    return (
      <div 
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col bg-[#0c1016] border border-white/10 overflow-hidden relative ${containerClasses} ${isDragOver ? 'border-purple-500 ring-4 ring-purple-500/20' : ''}`}>
        
        {isDragOver && (
          <div className="absolute inset-0 bg-purple-500/10 backdrop-blur-[2px] pointer-events-none z-50 flex items-center justify-center">
            <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
              <Plus size={32} className="text-white" />
            </div>
          </div>
        )}
        
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40 shrink-0 react-flow__node-draghandle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-600/20 text-white">
              <Images size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight uppercase">IO_在线图像中心</h1>
              <div className="flex items-center gap-2 text-sm font-mono text-gray-500 tracking-widest">
                <span>V1.4 ULTIMATE</span>
                <div className="w-1 h-1 rounded-full bg-purple-500" />
                <span className="text-purple-500/80">HUB ENGINE</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mr-2">
              <button 
                onClick={() => { setActiveTab('library'); updateStore({ activeTab: 'library' }); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${activeTab === 'library' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-500 hover:text-white'}`}
              >
                <Images size={14} /> 素材库
              </button>
              <button 
                onClick={() => { setActiveTab('history'); updateStore({ activeTab: 'history' }); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-500 hover:text-white'}`}
              >
                <History size={14} /> 历史生成
              </button>
              <button 
                onClick={() => { setActiveTab('materials'); updateStore({ activeTab: 'materials' }); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${activeTab === 'materials' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-500 hover:text-white'}`}
              >
                <Archive size={14} /> 本地资产
              </button>
            </div>

            <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5 mr-2">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <List size={14} />
              </button>
            </div>
            <button onClick={() => setIsOverlayOpen(!isOverlayOpen)} className="p-2 text-gray-500 hover:text-white transition-all">
              {isPortal ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            {isPortal && (
              <button onClick={() => setIsOverlayOpen(false)} className="p-2 text-red-500/50 hover:text-red-500 ml-1">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 p-5 overflow-hidden nodrag">
          {/* Filters Bar for History */}
          {activeTab === 'history' && (
            <div className="flex items-center justify-between gap-4 bg-black/20 p-3 rounded-2xl border border-white/5 shrink-0">
               <div className="flex items-center gap-2">
                 {(['all', 'image', 'video', 'audio'] as const).map(cat => (
                   <button 
                     key={cat}
                     onClick={() => setHistoryCategory(cat)}
                     className={`px-3 py-1 rounded-full text-sm font-black uppercase tracking-wider transition-all ${historyCategory === cat ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                   >
                     {cat === 'all' ? 'ALL' : cat === 'image' ? 'IMAGE' : cat === 'video' ? 'VIDEO' : 'AUDIO'}
                   </button>
                 ))}
               </div>
               <div className="relative flex-1 max-w-[200px]">
                 <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                 <input 
                   type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder="SEARCH RECORDS..."
                   className="w-full bg-black/40 border border-white/5 rounded-xl py-1.5 pl-8 pr-4 text-sm text-white focus:outline-none focus:border-purple-500/40"
                 />
               </div>
            </div>
          )}

          {/* Materials Navigation */}
          {activeTab === 'materials' && (
             <div className="flex items-center justify-between gap-4 bg-black/20 p-3 rounded-2xl border border-white/5 shrink-0">
                <div className="flex items-center gap-2">
                   {selectedFolderId && (
                     <button onClick={() => setSelectedFolderId(null)} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 transition-colors">
                        <ArrowLeft size={16} />
                     </button>
                   )}
                   <span className="text-sm font-black text-gray-400 uppercase tracking-widest ml-1">
                     {selectedFolderId ? folders.find(f => f.id === selectedFolderId)?.name : 'DIRECTORIES'}
                   </span>
                </div>
                <div className="flex items-center gap-2">
                   {!selectedFolderId && (
                     <button 
                       onClick={() => addFolder(prompt('文件夹名称:') || '新文件夹')}
                       className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all"
                     >
                       <FolderPlus size={16} />
                     </button>
                   )}
                   <div className="relative flex-1 min-w-[150px]">
                     <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                     <input 
                       type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                       placeholder="FILTER ASSETS..."
                       className="w-full bg-black/40 border border-white/5 rounded-xl py-1.5 pl-8 pr-4 text-sm text-white focus:outline-none focus:border-purple-500/40"
                     />
                   </div>
                </div>
             </div>
          )}

          {/* Gallery Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'library' && (
              <div className={`flex-1 bg-black/20 rounded-2xl border border-white/5 p-4 overflow-auto custom-scrollbar ${viewMode === 'grid' ? 'grid gap-4 content-start' : 'flex flex-col gap-2'}`} 
                   style={viewMode === 'grid' ? { gridTemplateColumns: `repeat(auto-fill, minmax(${isPortal ? thumbSize * 1.5 : thumbSize}px, 1fr))` } : {}}>
                 <AnimatePresence>
                   {images.map((img, i) => (
                     <motion.div 
                       key={i}
                       draggable
                       onDragStart={(e: any) => handleItemDragStart(e, img.url)}
                       initial={{ opacity: 0, scale: 0.9 }}
                       animate={{ opacity: 1, scale: 1 }}
                       exit={{ opacity: 0, scale: 0.9 }}
                       onClick={() => toggleSelect(i)}
                       className={`group relative overflow-hidden cursor-pointer border-2 transition-all ${
                         viewMode === 'grid' 
                          ? `aspect-square rounded-[20px] ${selectedIndices.includes(i) ? 'border-purple-500 scale-[0.98] shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 'border-white/5'}`
                          : `flex items-center gap-4 p-3 rounded-xl ${selectedIndices.includes(i) ? 'border-purple-500 bg-purple-500/10' : 'border-transparent bg-white/2 hover:bg-white/5'}`
                       }`}
                     >
                        <img draggable={false} src={img.url} className={`object-cover transition-transform group-hover:scale-110 ${viewMode === 'grid' ? 'w-full h-full' : 'w-16 h-16 rounded-lg'}`} alt="" />
                        {viewMode === 'grid' ? (
                          <div className={`absolute top-3 left-3 ${selectedIndices.includes(i) ? 'text-purple-500' : 'text-white/20'}`}>
                             {selectedIndices.includes(i) ? <CheckCircle2 size={18} fill="white" className="text-purple-600" /> : <Circle size={18} />}
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                             <p className="text-base text-white truncate font-black tracking-tight">{img.name}</p>
                             <p className="text-sm text-gray-500 truncate font-mono mt-1 opacity-50 uppercase tracking-tighter">{img.path}</p>
                          </div>
                        )}
                        {selectedIndices.includes(i) && <div className="absolute inset-0 bg-purple-500/10 pointer-events-none" />}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center pointer-events-none">
                           <span className="text-sm font-black text-white uppercase tracking-widest">DRAG TO USE</span>
                        </div>
                     </motion.div>
                   ))}
                 </AnimatePresence>
                 {images.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-gray-600">
                      <Images size={48} strokeWidth={1} />
                      <p className="text-sm font-black mt-4 uppercase tracking-[0.3em]">No library images</p>
                    </div>
                 )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className={`flex-1 bg-black/20 rounded-2xl border border-white/5 p-4 overflow-auto custom-scrollbar grid gap-4 content-start`}
                   style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${isPortal ? thumbSize * 1.5 : thumbSize}px, 1fr))` }}>
                 {filteredHistory.map((item) => (
                   <div 
                     key={item.id}
                     draggable
                     onDragStart={(e: any) => handleItemDragStart(e, item.url)}
                     className="group relative aspect-square bg-black/40 rounded-[20px] border border-white/5 hover:border-purple-500/50 transition-all cursor-pointer overflow-hidden shadow-lg"
                   >
                     {item.type === 'image' ? (
                       <img draggable={false} src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center bg-purple-600/10">
                          <History size={32} className="text-purple-600 opacity-40" />
                       </div>
                     )}
                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        <button 
                          onClick={() => handleAddToCanvas(item.url)}
                          className="px-4 py-1.5 bg-purple-600 text-white text-sm font-black rounded-lg hover:bg-purple-500 transition-all uppercase tracking-widest shadow-xl"
                        >
                          Send to Canvas
                        </button>
                        <button 
                          onClick={() => removeFile(item.id)}
                          className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                        >
                          <Minus size={14} />
                        </button>
                     </div>
                     <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent">
                        <p className="text-sm text-white/60 truncate font-mono">{item.name}</p>
                     </div>
                   </div>
                 ))}
                 {filteredHistory.length === 0 && (
                    <div className="col-span-full h-full flex flex-col items-center justify-center opacity-30 text-gray-600">
                      <History size={48} strokeWidth={1} />
                      <p className="text-sm font-black mt-4 uppercase tracking-[0.3em]">No history records</p>
                    </div>
                 )}
              </div>
            )}

            {activeTab === 'materials' && (
              <div className="flex-1 overflow-hidden flex flex-col gap-4">
                 {!selectedFolderId ? (
                    <div className="grid grid-cols-2 gap-4 content-start overflow-auto custom-scrollbar p-2">
                       {folders.map(folder => (
                         <div 
                           key={folder.id}
                           onClick={() => setSelectedFolderId(folder.id)}
                           className="group flex flex-col items-center gap-3 p-6 bg-white/2 border border-white/5 rounded-[32px] hover:bg-white/5 hover:border-purple-500/30 transition-all cursor-pointer shadow-2xl active:scale-[0.98]"
                         >
                           <div className="w-16 h-16 bg-purple-600/10 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 group-hover:shadow-[0_20px_50px_rgba(168,85,247,0.2)] border border-purple-500/10 group-hover:border-purple-500/30">
                              <Folder size={32} className="text-purple-500" />
                           </div>
                           <div className="text-center">
                              <p className="text-base font-black text-white tracking-tight">{folder.name}</p>
                              <p className="text-sm text-gray-600 font-mono mt-1 uppercase tracking-tighter truncate max-w-[120px]">{folder.path}</p>
                           </div>
                           <button 
                             onClick={(e) => { e.stopPropagation(); removeFolder(folder.id); }}
                             className="p-1.5 bg-red-500/5 text-red-500/40 hover:bg-red-500/10 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                           >
                              <X size={14} />
                           </button>
                         </div>
                       ))}
                    </div>
                 ) : (
                    <div className={`flex-1 bg-black/20 rounded-2xl border border-white/5 p-4 overflow-auto custom-scrollbar grid gap-4 content-start`}
                         style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${isPortal ? thumbSize * 1.5 : thumbSize}px, 1fr))` }}>
                       {filteredMaterials.map(item => (
                         <div 
                           key={item.id}
                           draggable
                           onDragStart={(e: any) => handleItemDragStart(e, item.url)}
                           className="group relative aspect-square bg-black/40 rounded-[20px] border border-white/5 hover:border-purple-500/50 transition-all cursor-pointer overflow-hidden shadow-lg"
                         >
                           <img draggable={false} src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                              <button 
                                onClick={() => handleAddToCanvas(item.url)}
                                className="px-4 py-1.5 bg-purple-600 text-white text-sm font-black rounded-lg hover:bg-purple-500 transition-all uppercase tracking-widest shadow-xl"
                              >
                                Send to Canvas
                              </button>
                              <button 
                                onClick={() => removeFile(item.id, true)}
                                className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                              >
                                <Minus size={14} />
                              </button>
                           </div>
                           <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent">
                              <p className="text-sm text-white/60 truncate font-mono">{item.name}</p>
                           </div>
                         </div>
                       ))}
                       {filteredMaterials.length === 0 && (
                          <div className="col-span-full h-full flex flex-col items-center justify-center opacity-30 text-gray-600 min-h-[300px]">
                            <Plus size={48} strokeWidth={1} />
                            <p className="text-sm font-black mt-4 uppercase tracking-[0.3em]">Folder is Empty</p>
                          </div>
                       )}
                    </div>
                 )}
              </div>
            )}
          </div>

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between gap-6 bg-black/40 rounded-2xl p-4 border border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleImportLocal(activeTab === 'materials' ? selectedFolderId || undefined : undefined)}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-base font-black text-white transition-all shadow-xl shadow-purple-600/10 active:scale-95"
              >
                <FolderOpen size={16} /> {activeTab === 'materials' ? 'UPLOAD TO FOLDER' : 'BATCH IMPORT'}
              </button>
              <div className="h-4 w-px bg-white/10 mx-2" />
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    const all = images.map((_, i) => i);
                    setSelectedIndices(all);
                    updateStore({ selectedIndices: all });
                  }}
                  className="px-3 py-1.5 text-sm font-black text-gray-400 hover:text-white transition-colors"
                >
                  ALL
                </button>
                <button 
                  onClick={() => { setSelectedIndices([]); updateStore({ selectedIndices: [] }); }}
                  className="px-3 py-1.5 text-sm font-black text-gray-500 hover:text-white transition-colors"
                >
                  RESET
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center gap-4 max-w-[200px]">
              <span className="text-sm font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">View Scale</span>
              <input 
                 type="range" min={60} max={300} step={10} value={thumbSize}
                 onChange={(e) => {
                   setThumbSize(parseInt(e.target.value));
                   updateStore({ thumbSize: parseInt(e.target.value) });
                 }}
                 className="flex-1 h-1 bg-white/10 rounded-full appearance-none accent-purple-500 cursor-pointer"
               />
            </div>

            <button onClick={clear} className="p-2.5 text-red-500/40 hover:text-red-500 transition-colors" title="Purge Local Gallery">
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-black border-t border-white/5 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
             <span className="text-sm text-gray-500 font-black uppercase tracking-[0.2em]">
               {activeTab === 'library' ? `Active Gallery: ${images.length}` : activeTab === 'history' ? `History Pool: ${filteredHistory.length}` : `Folder Asset Count: ${filteredMaterials.length}`}
             </span>
           </div>
           <span className="text-sm text-purple-600 font-mono tracking-widest uppercase italic">HUB_PLATFORM_V1.4</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <NodeResizer minWidth={300} minHeight={400} isVisible={selected} lineClassName="border-purple-500/50" handleClassName="h-3 w-3 bg-white border-2 border-purple-500 rounded-sm" />
      <div className={`flex flex-col w-full h-full bg-[#0c1016] rounded-3xl border-2 border-white/10 overflow-hidden shadow-2xl transition-all ${selected ? 'border-purple-500 ring-8 ring-purple-500/10' : ''}`}>
        <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-8 !h-8 !-left-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />
        <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-8 !h-8 !-right-4 !rounded-xl !border-[4px] !border-[#222] shadow-xl hover:!auto hover:!border-white transition-all duration-200 z-50 flex items-center justify-center font-bold text-white content-['+'] before:content-['+'] before:text-lg before:leading-none" />

        {ListContent(false)}
      </div>

      {isOverlayOpen && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-12 bg-black/85 backdrop-blur-3xl" onPointerDown={e => e.stopPropagation()}>
           <motion.div 
             initial={{ opacity: 0, scale: 0.9, y: 40 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.9, y: 40 }}
             className="w-full h-full"
           >
              {ListContent(true)}
           </motion.div>
           <div className="absolute inset-0 -z-10" onClick={() => setIsOverlayOpen(false)} />
        </div>,
        document.body
      )}
    </>
  );
}
