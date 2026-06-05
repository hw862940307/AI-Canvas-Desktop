import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, FileCode, FolderOpen, HardDrive, Search, 
  ArrowLeft, ArrowRight, ArrowUp, RotateCw, Upload, 
  Check, X, ShieldAlert, Monitor, ChevronRight, Cloud, 
  DownloadCloud, Download, FileText, Layers, HelpCircle,
  Copy, ZoomIn, ZoomOut, Printer, FileSpreadsheet, FileArchive,
  Image, Terminal, Loader2
} from 'lucide-react';
import JSZip from 'jszip';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: string;
  modified?: string;
  children?: FileItem[];
}

interface SimulatedFileExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selectedPath: string) => void;
  initialPath?: string;
  appName?: string;
  appPresetId?: string;
}

// Format byte sizes nicely
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Parse a standard Windows path to extract drive letter and directory segments
const parseWindowsPath = (winPath: string) => {
  const parts = winPath.split('\\').filter(Boolean);
  if (parts.length === 0) return { drive: 'F:' as const, segments: [] };
  
  let driveStr = parts[0].toUpperCase();
  if (!driveStr.includes(':')) {
    driveStr = driveStr + ':';
  }
  
  let drive: 'C:' | 'D:' | 'E:' | 'F:' = 'F:';
  if (['C:', 'D:', 'E:', 'F:'].includes(driveStr)) {
    drive = driveStr as any;
  }
  
  return {
    drive,
    segments: parts.slice(1)
  };
};

// Complete Windows 11 baseline filesystem roots
const BASE_FS: Record<string, FileItem[]> = {
  'C:': [
    {
      id: 'c_pf',
      name: 'Program Files',
      type: 'folder',
      children: [
        {
          id: 'c_pf_adobe',
          name: 'Adobe',
          type: 'folder',
          children: [
            {
              id: 'c_pf_adobe_ps',
              name: 'Adobe Photoshop 2024',
              type: 'folder',
              children: [
                { id: 'c_pf_adobe_ps_exe', name: 'Photoshop.exe', type: 'file', size: '154 MB', modified: '2026-03-12 14:22' },
                { id: 'c_pf_adobe_ps_dll', name: 'amtlib.dll', type: 'file', size: '4.2 MB', modified: '2024-11-05 09:12' },
                { id: 'c_pf_adobe_ps_config', name: 'presets.json', type: 'file', size: '45 KB', modified: '2026-01-20 18:30' }
              ]
            }
          ]
        },
        {
          id: 'c_pf_blender',
          name: 'Blender Foundation',
          type: 'folder',
          children: [
            {
              id: 'c_pf_blender_40',
              name: 'Blender 4.0',
              type: 'folder',
              children: [
                { id: 'c_pf_blender_exe', name: 'blender.exe', type: 'file', size: '241 MB', modified: '2024-01-20 15:45' }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'c_users',
      name: 'Users',
      type: 'folder',
      children: [
        {
          id: 'c_users_admin',
          name: 'Administrator',
          type: 'folder',
          children: [
            {
              id: 'c_users_admin_desktop',
              name: 'Desktop',
              type: 'folder',
              children: [
                { id: 'c_desk_txt', name: '渲染状态记录.txt', type: 'file', size: '12 KB', modified: '2026-06-03 15:45' }
              ]
            }
          ]
        }
      ]
    }
  ],
  'D:': [
    {
      id: 'd_ai',
      name: 'ai-draw',
      type: 'folder',
      children: [
        {
          id: 'd_ai_comfyui',
          name: 'ComfyUI_windows_portable',
          type: 'folder',
          children: [
            { id: 'd_ai_comfyui_gpu', name: 'run_nvidia_gpu.bat', type: 'file', size: '1.5 KB', modified: '2026-04-11 15:33' }
          ]
        }
      ]
    }
  ],
  'E:': [
    {
      id: 'e_work',
      name: 'Work_Workspace',
      type: 'folder',
      children: [
        {
          id: 'e_work_renders',
          name: 'renders_output',
          type: 'folder',
          children: [
            { id: 'e_render_p1', name: 'keyshot_rendered_001.png', type: 'file', size: '8.4 MB', modified: '2026-06-02 22:15' }
          ]
        }
      ]
    }
  ],
  'F:': [
    {
      id: 'f_baidu_net',
      name: 'BaiduNetdiskDownload',
      type: 'folder',
      children: [
        {
          id: 'f_comfy_aki',
          name: 'ComfyUI-aki-v3',
          type: 'folder',
          children: [
            {
              id: 'f_comfy_root',
              name: 'ComfyUI',
              type: 'folder',
              children: [
                {
                  id: 'f_comfy_user',
                  name: 'user',
                  type: 'folder',
                  children: [
                    {
                      id: 'f_comfy_default',
                      name: 'default',
                      type: 'folder',
                      children: [
                        {
                          id: 'f_comfy_workflows',
                          name: 'workflows',
                          type: 'folder',
                          children: [
                            { id: 'f_workflow_test_json', name: 'flux_comfy_workflow_core.json', type: 'file', size: '36 KB', modified: '2026-06-05 12:10' },
                            { id: 'f_workflow_example_json', name: 'stable_diffusion_xl_upscale.json', type: 'file', size: '28 KB', modified: '2026-06-04 18:45' }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

export const SimulatedFileExplorer: React.FC<SimulatedFileExplorerProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath = '',
  appName = '',
  appPresetId = ''
}) => {
  if (!isOpen) return null;

  // Initialize the physical path prefix with the user's ComfyUI folder path exactly as shown in screenshot
  const defaultPrefix = initialPath || 'F:\\BaiduNetdiskDownload\\ComfyUI-aki-v3\\ComfyUI\\user\\default\\workflows';
  
  const [mountPrefix, setMountPrefix] = useState<string>(defaultPrefix);
  const [virtualFS, setVirtualFS] = useState<Record<string, FileItem[]>>(BASE_FS);
  const [currentDrive, setCurrentDrive] = useState<'C:' | 'D:' | 'E:' | 'F:'>('F:');
  const [pathSegments, setPathSegments] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isThisPC, setIsThisPC] = useState<boolean>(false);

  // Loaded real files handle state map
  const [realFileMap, setRealFileMap] = useState<Record<string, File>>({});
  const [loadedRealFiles, setLoadedRealFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Navigation History
  const [history, setHistory] = useState<{ drive: 'C:' | 'D:' | 'E:' | 'F:'; segments: string[]; isPC: boolean }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Modal active preview states
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // Shares realFileMap with preview component globally and instantly
  useEffect(() => {
    (window as any)._explorerRealFileMap = realFileMap;
    return () => {
      delete (window as any)._explorerRealFileMap;
    };
  }, [realFileMap]);

  // Navigate utility
  const navigateTo = (drive: 'C:' | 'D:' | 'E:' | 'F:', segments: string[], isPC: boolean) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ drive, segments, isPC });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    setCurrentDrive(drive);
    setPathSegments(segments);
    setIsThisPC(isPC);
    setSelectedFile('');
    setSearchQuery('');
  };

  // Setup initial route location matching initial path
  useEffect(() => {
    const startPath = mountPrefix || initialPath;
    if (startPath) {
      const driveMatch = startPath.match(/^([A-Za-z]):\\/);
      if (driveMatch) {
        const driveLetter = driveMatch[1].toUpperCase();
        const drive = (driveLetter + ':') as 'C:' | 'D:' | 'E:' | 'F:';
        
        const segments = startPath
          .replace(/^([A-Za-z]):\\/, '')
          .split('\\')
          .filter(s => s && !s.toLowerCase().includes('.exe') && !s.toLowerCase().includes('.bat') && !s.toLowerCase().includes('.json'));
        
        const filePart = startPath.split('\\').pop() || '';
        const fileMatch = filePart.includes('.') ? filePart : '';

        setCurrentDrive(drive);
        setPathSegments(segments);
        setIsThisPC(false);
        if (fileMatch) {
          setSelectedFile(fileMatch);
        }
        setHistory([{ drive, segments, isPC: false }]);
        setHistoryIndex(0);
        return;
      }
    }

    setCurrentDrive('F:');
    setPathSegments(['BaiduNetdiskDownload', 'ComfyUI-aki-v3', 'ComfyUI', 'user', 'default', 'workflows']);
    setIsThisPC(false);
    setHistory([{ drive: 'F:', segments: ['BaiduNetdiskDownload', 'ComfyUI-aki-v3', 'ComfyUI', 'user', 'default', 'workflows'], isPC: false }]);
    setHistoryIndex(0);
  }, [initialPath, isOpen]);

  // React to path prefix changes or new file uploads to rebuild filesystem tree on F: / other drives
  const updateVirtualFSWithRealFiles = (filesList: File[], prefix: string) => {
    const fsCopy = JSON.parse(JSON.stringify(BASE_FS)) as Record<string, FileItem[]>;
    const { drive, segments } = parseWindowsPath(prefix);
    
    if (!fsCopy[drive]) {
      fsCopy[drive] = [];
    }

    // Build absolute host folder nodes automatically
    let currentLevel = fsCopy[drive];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      let existingFolder = currentLevel.find(item => item.name === seg && item.type === 'folder');
      if (!existingFolder) {
        existingFolder = {
          id: `mount_folder_${drive.slice(0, 1)}_${i}_${seg}`,
          name: seg,
          type: 'folder',
          children: []
        };
        currentLevel.push(existingFolder);
      }
      currentLevel = existingFolder.children || (existingFolder.children = []);
    }

    // Graft all real files recursively onto the leaf node
    const newFileMap: Record<string, File> = { ...realFileMap };
    
    filesList.forEach((file, index) => {
      const relPath = file.webkitRelativePath || file.name;
      let parts = relPath.split('/').filter(Boolean);
      
      // Prevent duplicating the folder leaf name in tree navigation
      const leafSegName = segments[segments.length - 1];
      if (parts.length > 1 && leafSegName && parts[0].toLowerCase() === leafSegName.toLowerCase()) {
        parts = parts.slice(1);
      }
      
      let level = currentLevel;
      parts.forEach((part, pIdx) => {
        const isFile = pIdx === parts.length - 1;
        let existing = level.find(item => item.name === part && item.type === (isFile ? 'file' : 'folder'));
        
        if (!existing) {
          if (isFile) {
            const timestamp = new Date(file.lastModified).toISOString().replace('T', ' ').substring(0, 16);
            const sizeStr = formatBytes(file.size);
            const fileId = `real_file_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            
            newFileMap[fileId] = file;
            
            const fileNode: FileItem = {
              id: fileId,
              name: part,
              type: 'file',
              size: sizeStr,
              modified: timestamp
            };
            level.push(fileNode);
          } else {
            const folderNode: FileItem = {
              id: `real_folder_${index}_${pIdx}_${part}`,
              name: part,
              type: 'folder',
              children: []
            };
            level.push(folderNode);
            existing = folderNode;
          }
        }
        
        if (!isFile && existing) {
          level = existing.children || (existing.children = []);
        }
      });
    });

    setRealFileMap(newFileMap);
    setVirtualFS(fsCopy);
  };

  // Re-mount automatically when prefix or loaded file arrays are modified
  useEffect(() => {
    if (loadedRealFiles.length > 0) {
      updateVirtualFSWithRealFiles(loadedRealFiles, mountPrefix);
    }
  }, [mountPrefix, loadedRealFiles]);

  const handleBackward = () => {
    if (historyIndex > 0) {
      const target = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCurrentDrive(target.drive);
      setPathSegments(target.segments);
      setIsThisPC(target.isPC);
      setSelectedFile('');
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const target = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setCurrentDrive(target.drive);
      setPathSegments(target.segments);
      setIsThisPC(target.isPC);
      setSelectedFile('');
    }
  };

  const handleUp = () => {
    if (isThisPC) return;
    if (pathSegments.length === 0) {
      navigateTo(currentDrive, [], true);
    } else {
      navigateTo(currentDrive, pathSegments.slice(0, -1), false);
    }
  };

  const getContentsAtCurrentPath = (): FileItem[] => {
    if (isThisPC) return [];
    
    const fsCopy = { ...virtualFS };
    let current = fsCopy[currentDrive] || [];

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      let foundFolder = current.find(item => item.name === segment && item.type === 'folder');
      
      if (!foundFolder) {
        foundFolder = {
          id: `dyn_idx_${segment}_${i}`,
          name: segment,
          type: 'folder',
          children: []
        };
        current.push(foundFolder);
      }
      
      current = foundFolder.children || (foundFolder.children = []);
    }

    return current;
  };

  const handleFolderClick = (name: string) => {
    navigateTo(currentDrive, [...pathSegments, name], false);
  };

  const handleDriveClick = (drive: 'C:' | 'D:' | 'E:' | 'F:') => {
    // If we have selected real files and are changing prefix, map directories dynamically
    navigateTo(drive, [], false);
  };

  const handleThisPCClick = () => {
    navigateTo('C:', [], true);
  };

  // Triggers when dragging directories or files over explorer window
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Handle Dragging File System Objects Directly
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const items = e.dataTransfer.items;
    if (items) {
      const filesArr: File[] = [];
      const traverseEntry = async (entry: any) => {
        if (entry.isFile) {
          const file = await new Promise<File>((resolve) => entry.file(resolve));
          // Attach relative path for nested elements
          Object.defineProperty(file, 'webkitRelativePath', {
            value: entry.fullPath.substring(1), // remove starting slash
            writable: false
          });
          filesArr.push(file);
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          let allEntries: any[] = [];
          const readAll = async () => {
            const results = await new Promise<any[]>((resolve) => reader.readEntries(resolve));
            if (results.length > 0) {
              allEntries = [...allEntries, ...results];
              await readAll();
            }
          };
          await readAll();
          for (const subEntry of allEntries) {
            await traverseEntry(subEntry);
          }
        }
      };

      const handleAllDropped = async () => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === 'file') {
            const entry = (item as any).webkitGetAsEntry?.() || (item as any).getAsEntry?.();
            if (entry) {
              await traverseEntry(entry);
            } else {
              const file = item.getAsFile();
              if (file) filesArr.push(file);
            }
          }
        }
        if (filesArr.length > 0) {
          // If workflows is the entry, align prefix drive automatically
          setLoadedRealFiles(prev => [...prev, ...filesArr]);
        }
      };
      
      handleAllDropped();
    } else {
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        setLoadedRealFiles(prev => [...prev, ...droppedFiles]);
      }
    }
  };

  // Direct directory browser triggering (webkitdirectory)
  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (filesList && filesList.length > 0) {
      const arr = Array.from(filesList);
      setLoadedRealFiles(prev => [...prev, ...arr]);
    }
  };

  const handleMultipleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (filesList && filesList.length > 0) {
      const arr = Array.from(filesList);
      setLoadedRealFiles(prev => [...prev, ...arr]);
    }
  };

  const currentPathString = isThisPC ? '此电脑' : `${currentDrive}\\${pathSegments.join('\\')}`;
  const fullSelectedPath = selectedFile 
    ? (isThisPC ? `C:\\${selectedFile}` : `${currentDrive}\\${pathSegments.join('\\')}${pathSegments.length > 0 ? '\\' : ''}${selectedFile}`)
    : '';

  const confirmSelection = () => {
    if (fullSelectedPath) {
      onSelect(fullSelectedPath);
    }
    onClose();
  };

  // Recursive search matching across nested files
  const performSearch = (items: FileItem[], query: string, prefixPath: string): { path: string; name: string; size?: string }[] => {
    let results: { path: string; name: string; size?: string }[] = [];
    const normalizedQuery = query.toLowerCase();

    for (const item of items) {
      const currentFullPath = `${prefixPath}\\${item.name}`;
      if (item.type === 'file' && item.name.toLowerCase().includes(normalizedQuery)) {
        results.push({ path: currentFullPath, name: item.name, size: item.size });
      } else if (item.type === 'folder' && item.children) {
        results = [...results, ...performSearch(item.children, query, currentFullPath)];
      }
    }
    return results;
  };

  const getSearchResults = () => {
    if (!searchQuery) return [];
    if (isThisPC) {
      let results: { path: string; name: string; size?: string }[] = [];
      Object.keys(virtualFS).forEach(drive => {
        results = [...results, ...performSearch(virtualFS[drive], searchQuery, drive)];
      });
      return results;
    } else {
      return performSearch(getContentsAtCurrentPath(), searchQuery, currentPathString);
    }
  };

  const searchResults = getSearchResults();
  const visibleContents = getContentsAtCurrentPath();

  const getSelectedDetails = () => {
    if (!selectedFile && !isThisPC) {
      return {
        title: isThisPC ? '此电脑' : `本地磁盘 (${currentDrive})`,
        count: isThisPC ? '4个驱动卷' : `${visibleContents.length} 个子项目`,
        description: '选择电脑上特定的物理路径、文件夹或文件，深度加载其实际层数据。'
      };
    }
    
    if (isThisPC) {
      return {
        title: '此电脑 (My PC)',
        count: '设备和驱动器 (4)',
        description: '操作系统磁盘卷控制器，包含 C、D、E、F 本地物理高带宽连接卷。'
      };
    }

    const item = visibleContents.find(f => f.name === selectedFile);
    if (item) {
      const ext = item.name.split('.').pop()?.toLowerCase();
      let typeDesc = '未知物理文件';
      if (ext === 'exe') typeDesc = 'Windows 可执行程序 (.exe)';
      else if (ext === 'bat') typeDesc = '命令行批处理脚本 (.bat)';
      else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext || '')) typeDesc = '图像资产 (.png, .jpg)';
      else if (ext === 'zip' || ext === 'rar' || ext === '7z') typeDesc = 'ZIP/RAR 压缩备份包';
      else if (ext === 'docx' || ext === 'doc') typeDesc = 'Word 文档';
      else if (ext === 'xlsx' || ext === 'xls') typeDesc = 'Excel 数据度量表';
      else if (ext === 'csv') typeDesc = '逗号分隔数值数据 (.csv)';
      else if (ext === 'json') typeDesc = 'ComfyUI 标定流配置 (.json)';
      else if (ext === 'txt') typeDesc = '纯文本文件 (.txt)';

      return {
        item,
        title: item.name,
        count: item.size || '0 Bytes',
        type: typeDesc,
        modified: item.modified || '2026-06-05',
        path: `${currentDrive}\\${pathSegments.join('\\')}\\${selectedFile}`,
        description: item.id.startsWith('real_file_') 
          ? '🔌 实机物理文件连接。直接双击或点击下方解码，即可读取图片、工作表格、压缩包或 JSON 工作流全文内容。'
          : '仿真模拟资产文件。设置上方真实的绝对宿主路径，即可输出正确的 Windows 系统执行句柄。'
      };
    }

    return {
      title: '此电脑',
      count: '未选中任何项目',
      description: '双击进入驱动硬盘目录，或拖拽本地真实文件夹载入。'
    };
  };

  const details = getSelectedDetails();

  return (
    <div 
      className="fixed inset-0 z-[100050] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 transition-all"
      onClick={onClose}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div 
        className={`bg-[#1c1c1c] border-2 ${isDragOver ? 'border-emerald-500 scale-[1.01]' : 'border-indigo-500/30'} max-w-5xl w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto h-[620px] text-[#f3f3f3] font-sans transition-all relative`}
        onClick={e => e.stopPropagation()}
      >
        {/* Full drag overlay indication */}
        {isDragOver && (
          <div className="absolute inset-0 bg-emerald-950/90 z-50 flex flex-col items-center justify-center border-4 border-dashed border-emerald-400 p-6 pointer-events-none text-center">
            <Upload size={64} className="text-emerald-400 mb-4 animate-bounce" />
            <h3 className="text-xl font-black text-white">拽入并挂载真实的本地文件夹 / 物理文件</h3>
            <p className="text-sm text-emerald-300 mt-2 max-w-md">
              松开鼠标将电脑上的文件瞬间载入。我们将提取整个文件夹中所有子目录的真实相对结构与文件内容，不上传至任何服务器，100% 浏览器客户端安全解析。
            </p>
          </div>
        )}

        {/* Windows explorer top heading tabs */}
        <div className="bg-[#181818] px-4 pt-2 flex items-center gap-1.5 shrink-0 border-b border-white/5 select-none text-[11px]">
          <div className="flex items-center gap-2 bg-[#2d2d2d] px-3.5 py-1.5 rounded-t-lg border-t border-x border-white/10 text-white font-medium max-w-[200px] truncate">
            <Monitor size={11} className="text-indigo-400" />
            <span>物理硬盘柜 &raquo; {currentDrive}</span>
            <X size={10} className="ml-2 hover:bg-white/10 p-0.5 rounded cursor-pointer" onClick={onClose} />
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span>Microsoft Windows File Port &bull; HTML5 Drive API</span>
          </div>
        </div>

        {/* Action controls header toolbar */}
        <div className="bg-[#242424] py-2 px-4 border-b border-white/5 flex items-center gap-2.5 shrink-0 select-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleBackward}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded hover:bg-white/10 text-[#f3f3f3] disabled:opacity-30 cursor-pointer border-none bg-transparent"
              title="后退"
            >
              <ArrowLeft size={13} />
            </button>
            <button
              onClick={handleForward}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded hover:bg-white/10 text-[#f3f3f3] disabled:opacity-30 cursor-pointer border-none bg-transparent"
              title="前进"
            >
              <ArrowRight size={13} />
            </button>
            <button
              onClick={handleUp}
              className="p-1.5 rounded hover:bg-white/10 text-[#f3f3f3] cursor-pointer border-none bg-transparent"
              title="向上"
            >
              <ArrowUp size={13} />
            </button>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedFile('');
              }}
              className="p-1.5 rounded hover:bg-white/10 text-[#f3f3f3] cursor-pointer border-none bg-transparent"
              title="刷新"
            >
              <RotateCw size={13} />
            </button>
          </div>

          {/* Breadcrumbs Address bar */}
          <div className="flex-1 min-w-0 bg-[#1e1e1e] px-3 py-1.5 rounded border border-white/10 text-left font-mono text-[11px] text-[#f3f3f3] flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none shadow-inner">
            <Monitor size={11} className="text-indigo-400 shrink-0 mr-1" />
            <button 
              onClick={handleThisPCClick} 
              className="hover:bg-white/10 px-1 py-0.5 rounded text-indigo-300 font-bold border-none bg-transparent cursor-pointer text-[11px]"
            >
              此电脑
            </button>
            
            {!isThisPC && (
              <>
                <ChevronRight size={10} className="text-slate-500 shrink-0" />
                <button 
                  onClick={() => handleDriveClick(currentDrive)}
                  className="hover:bg-white/10 px-1 py-0.5 rounded text-indigo-400 border-none bg-transparent cursor-pointer text-[11px]"
                >
                  本地磁盘 ({currentDrive})
                </button>
              </>
            )}

            {pathSegments.map((seg, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight size={10} className="text-slate-500 shrink-0" />
                <button
                  onClick={() => {
                    const nextSegs = pathSegments.slice(0, idx + 1);
                    navigateTo(currentDrive, nextSegs, false);
                  }}
                  className="hover:bg-white/10 px-1 py-0.5 rounded text-slate-300 border-none bg-transparent cursor-pointer text-[11px] max-w-[120px] truncate"
                >
                  {seg}
                </button>
              </React.Fragment>
            ))}

            {selectedFile && (
              <>
                <ChevronRight size={10} className="text-slate-500 shrink-0" />
                <span className="text-emerald-400 font-bold px-1 truncate max-w-[180px]">{selectedFile}</span>
              </>
            )}
          </div>

          {/* Search layout */}
          <div className="relative w-44 shrink-0">
            <input 
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedFile('');
              }}
              placeholder="搜索当前目录内容..."
              className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2 pl-7 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            />
            <Search size={11} className="absolute left-2.5 top-2 text-slate-400 font-bold" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1 text-slate-400 hover:text-white border-none bg-transparent cursor-pointer text-[10px]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* main workspace pane */}
        <div className="flex flex-1 min-h-0">
          
          {/* Column 1: Navigation and real physical file import hubs */}
          <div className="w-[190px] border-r border-white/5 bg-[#171717] p-3 flex flex-col gap-4 shrink-0 text-left select-none overflow-y-auto">
            
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-2 block mb-1">快速访问</span>
              
              <button onClick={handleThisPCClick} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-slate-300 hover:bg-white/5 border-none bg-transparent text-left cursor-pointer">
                <Monitor size={11} className="text-indigo-405 shrink-0" />
                <span>此电脑 (My PC)</span>
              </button>

              <button onClick={() => navigateTo('F:', ['BaiduNetdiskDownload', 'ComfyUI-aki-v3', 'ComfyUI', 'user', 'default', 'workflows'], false)} className="w-full flex items-center gap-2 px-2 py-1 py-1.5 rounded text-[11px] text-slate-300 hover:bg-white/5 border-none bg-transparent text-left cursor-pointer pl-6 truncate">
                <FolderOpen size={11} className="text-amber-500 shrink-0" />
                <span>Workflows 目录</span>
              </button>
            </div>

            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-2 block mb-1">硬盘驱动控制器</span>
              
              <div className="space-y-0.5 pl-2">
                {['C:', 'D:', 'E:', 'F:'].map((drv) => (
                  <button 
                    key={drv}
                    onClick={() => handleDriveClick(drv as any)} 
                    className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10.5px] border-none bg-transparent text-left cursor-pointer ${!isThisPC && currentDrive === drv ? 'bg-indigo-600/15 text-indigo-300 font-black' : 'text-slate-400 hover:text-white'}`}
                  >
                    <HardDrive size={10} className="text-indigo-400 shrink-0" />
                    <span>本地磁盘 ({drv})</span>
                  </button>
                ))}
              </div>
            </div>

            {/*🔌 Physical Active Connect module for mapping real client PC folders directly */}
            <div className="mt-auto border-t border-white/5 pt-4 space-y-3">
              <div className="p-2 bg-indigo-950/20 rounded border border-indigo-500/10 text-[9px] text-indigo-300 space-y-1">
                <div className="flex items-center gap-1 font-bold">
                  <ShieldAlert size={10} className="text-indigo-400" />
                  <span>对接实机物理绝对路径</span>
                </div>
                <p className="text-slate-400 leading-normal">
                  拖拽或选择文件夹载入。设定相同的 Windows 绝对路径前缀，确保流节点直接获取匹配的文件句柄！
                </p>
              </div>

              {/* Absolute Prefix Input */}
              <div className="space-y-1 text-[10px]">
                <label className="text-slate-500 block font-bold">宿主绝对路径前缀 (Mount Base):</label>
                <input 
                  type="text"
                  value={mountPrefix}
                  onChange={(e) => setMountPrefix(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded px-2 py-1 font-mono text-[9px] text-[#4fcca3] focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. F:\ComfyUI"
                />
              </div>

              {/* Upload Buttons */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="explorer-real-dir-mount"
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-indigo-650 hover:bg-indigo-600 border-none text-white text-[10px] font-black cursor-pointer transition-all shadow-md text-center select-none"
                  title="载入一整套硬盘内的文件夹"
                >
                  <Folder size={11} />
                  <span>载入本地文件夹</span>
                </label>
                <input 
                  id="explorer-real-dir-mount"
                  type="file"
                  multiple
                  onChange={handleFolderUpload}
                  className="hidden"
                  {...({
                    webkitdirectory: "true",
                    directory: "true"
                  } as any)}
                />

                <label 
                  htmlFor="explorer-real-files-mount"
                  className="w-full flex items-center justify-center gap-1.5 py-1 px-1 py-1.5 rounded bg-[#2b2b2b] hover:bg-[#383838] border border-white/10 text-slate-300 hover:text-white text-[10px] font-black cursor-pointer transition-all text-center select-none"
                  title="直接选择电脑上的某个/多个物理文件"
                >
                  <FileText size={11} />
                  <span>加入物理文件</span>
                </label>
                <input 
                  id="explorer-real-files-mount"
                  type="file"
                  multiple
                  onChange={handleMultipleFilesUpload}
                  className="hidden"
                />
              </div>

              {loadedRealFiles.length > 0 && (
                <div className="bg-emerald-950/20 border border-emerald-500/15 rounded p-2 text-[9px] text-emerald-400 font-mono">
                  <span className="font-extrabold flex items-center gap-1">
                    <Check size={10} /> 载入物理: {loadedRealFiles.length} 个
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Center Folders and Files Grid Display */}
          <div className="flex-1 p-4 bg-[#141414] overflow-y-auto flex flex-col pointer-events-auto min-h-0 text-left">
            {searchQuery ? (
              // Search matches list
              <div className="space-y-2">
                <div className="border-b border-white/5 pb-2">
                  <span className="text-[10px] font-black text-slate-400 font-mono uppercase tracking-widest">
                    在当前物理分卷检索出的成果: ({searchResults.length})
                  </span>
                </div>
                {searchResults.length === 0 ? (
                  <div className="py-20 text-center text-xs text-slate-500 font-mono italic">未检索到匹配的流程文件或媒体图张...</div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {searchResults.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedFile(item.name);
                          const driveSeg = item.path.split('\\')[0] + ':';
                          const paths = item.path.split('\\').slice(1);
                          paths.pop(); // strip file name
                          setCurrentDrive(driveSeg as any);
                          setPathSegments(paths);
                          setIsThisPC(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${selectedFile === item.name ? 'bg-indigo-600/10 border-indigo-500 text-white' : 'bg-[#222]/40 hover:bg-[#2c2c2c]/40 border-transparent text-slate-300'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileCode size={15} className="text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-[11.5px] text-white block truncate leading-none">{item.name}</span>
                            <span className="text-[8.5px] font-mono text-slate-500 block truncate mt-1">{item.path}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">{item.size}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : isThisPC ? (
              // Devices and Drives dashboard (standard Win11 layout)
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest select-none">此电脑 &bull; 本地设备和磁盘驱动器</h4>
                  <div className="grid grid-cols-2 gap-4">
                    
                    {['C', 'D', 'E', 'F'].map((drv, idx) => {
                      const dStr = drv + ':';
                      const driveLabel = drv === 'C' ? '系统物理卷' : drv === 'D' ? '辅助软件卷' : drv === 'E' ? '空间资料卷' : '数字绘图卷柜 (新加坡卷)';
                      const percentage = drv === 'C' ? '70%' : drv === 'D' ? '45%' : drv === 'E' ? '22%' : '85%';
                      const spacingTxt = drv === 'C' ? '92 GB 可用，共 300 GB' : drv === 'D' ? '180 GB 可用，共 320 GB' : drv === 'E' ? '310 GB 可用，共 400 GB' : '15 GB 可用，共 100 GB';
                      return (
                        <div 
                          key={drv}
                          onClick={() => handleDriveClick(dStr as any)}
                          className="bg-[#1e1e1e]/60 p-3.5 rounded-xl border border-white/5 hover:bg-[#252525] hover:border-indigo-500/25 transition-all select-none flex items-center gap-4.5 cursor-pointer group shadow-md"
                        >
                          <HardDrive size={24} className="text-indigo-400 shrink-0 group-hover:scale-105 transition-transform" />
                          <div className="text-left leading-normal min-w-0 flex-1">
                            <span className="text-[11.5px] font-bold text-white block truncate">本地磁盘 ({dStr})</span>
                            <span className="text-[8.5px] text-slate-400 block mt-0.5">{driveLabel}</span>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5 border border-black/20">
                              <div className="bg-indigo-600 h-full rounded-full" style={{ width: percentage }} />
                            </div>
                            <span className="text-[8.5px] text-[#888] block mt-1 font-mono">{spacingTxt}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-white/5 pt-5 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">云高空带宽映射通道</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1e1e1e]/40 p-3 rounded-lg border border-white/5 flex items-center gap-3">
                      <Cloud size={20} className="text-sky-400 shrink-0" />
                      <div className="min-w-0 leading-normal text-left">
                        <span className="text-[11px] font-bold text-white block truncate">WPS 本地同步卷柜</span>
                        <span className="text-[8.5px] text-slate-400 block font-mono">200 GB 物理高速镜像通道</span>
                      </div>
                    </div>
                    <div className="bg-[#1e1e1e]/40 p-3 rounded-lg border border-white/5 flex items-center gap-3">
                      <DownloadCloud size={20} className="text-blue-400 shrink-0" />
                      <div className="min-w-0 leading-normal text-left">
                        <span className="text-[11px] font-bold text-white block truncate">百度网盘备份卷</span>
                        <span className="text-[8.5px] text-slate-400 block font-mono">10 GB 实时极速下载端缓存片</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Detailed Folders & Files grid List matching Windows 11 Explorer item grids
              <div className="space-y-4">
                {visibleContents.length === 0 ? (
                  <div className="py-24 text-center">
                    <FolderOpen size={40} className="text-slate-600 mx-auto mb-3" />
                    <span className="text-xs text-slate-500 font-bold font-mono">该分卷文件夹目录暂空</span>
                    <p className="text-[10px] text-slate-600 mt-2 max-w-sm mx-auto">
                      请点击左侧面板 <b>[载入本地文件夹]</b> 把您电脑上的 ComfyUI 流程文件夹导入进行同步，即可浏览其中的所有物理文件！
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {visibleContents.map((item) => {
                      const isFolder = item.type === 'folder';
                      const isSelected = selectedFile === item.name;
                      const ext = item.name.split('.').pop()?.toLowerCase();
                      
                      let colorClass = 'text-indigo-400';
                      if (ext === 'bat') colorClass = 'text-emerald-400 font-bold';
                      else if (ext === 'zip' || ext === 'rar') colorClass = 'text-amber-500';
                      else if (ext === 'json') colorClass = 'text-[#4fcca3]';
                      else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) colorClass = 'text-purple-400';
                      else if (ext === 'docx') colorClass = 'text-blue-400';
                      else if (ext === 'xlsx' || ext === 'csv') colorClass = 'text-emerald-555';

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedFile(item.name)}
                          onDoubleClick={() => {
                            if (isFolder) {
                              handleFolderClick(item.name);
                            } else {
                              setSelectedFile(item.name);
                              setPreviewFile(item);
                            }
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-lg border-2 text-left transition-all cursor-pointer ${isSelected ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md' : 'bg-[#181818]/60 hover:bg-[#202020]/80 border-transparent text-slate-300'}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isFolder ? (
                              <Folder size={16} className="text-yellow-600 fill-yellow-600 shrink-0" />
                            ) : (
                              <FileCode size={15} className={`${colorClass} shrink-0`} />
                            )}
                            <div className="min-w-0">
                              <span className="text-[11px] font-bold block truncate leading-none text-slate-100">{item.name}</span>
                              <span className="text-[8.5px] font-mono text-slate-500 block mt-1.5">
                                {isFolder ? '子文件夹' : `文件 &bull; 大小: ${item.size || '1.1 KB'}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 select-none">
                            <span className="text-[9.5px] font-mono text-slate-505">{item.modified || ''}</span>
                            <div className={`w-3.5 h-3.5 rounded-full border border-indigo-500/20 flex items-center justify-center ${isSelected ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-transparent'}`}>
                              {isSelected && <Check size={8} />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Column 3: Properties inspector pane */}
          <div className="w-[190px] border-l border-white/5 bg-[#171717] p-3 flex flex-col gap-4 text-left select-none shrink-0 overflow-y-auto">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">详细信息</h4>
            
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-xl bg-slate-800/40 border border-white/5 flex items-center justify-center text-slate-400 mx-auto shadow-inner">
                {selectedFile ? (
                  <FileCode size={24} className={selectedFile.endsWith('.bat') ? 'text-emerald-400' : 'text-indigo-400'} />
                ) : isThisPC ? (
                  <Monitor size={24} className="text-indigo-400" />
                ) : (
                  <HardDrive size={24} className="text-indigo-400" />
                )}
              </div>

              <div className="space-y-2.5 leading-relaxed text-slate-405">
                <span className="text-[11.5px] font-black text-white block text-center truncate">{details.title}</span>
                <span className="text-[9.5px] text-slate-400 block text-center font-mono">{details.count}</span>
                
                {details.type && (
                  <div className="text-[9.5px] bg-black/40 p-2.5 rounded border border-white/5 mt-3 space-y-2 font-mono text-slate-400 break-all leading-normal">
                    <div>
                      <span className="text-slate-500 mr-1 font-sans font-bold text-[8.5px]">类别:</span>
                      <span className="text-white font-bold">{details.type}</span>
                    </div>
                    {details.modified && (
                      <div>
                        <span className="text-slate-500 mr-1 font-sans font-bold text-[8.5px]">修改日期:</span>
                        <span className="text-white">{details.modified}</span>
                      </div>
                    )}
                    {details.path && (
                      <div className="pt-2 border-t border-white/5">
                        <span className="text-slate-500 font-sans block mb-1 font-bold text-[8.5px]">绝对物理路径:</span>
                        <span className="text-indigo-300 font-bold block bg-black/80 px-2 py-1.5 rounded text-[8px] break-all select-all font-mono leading-tight">{details.path}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* pulsating viewer action button */}
                {selectedFile && !isThisPC && (
                  <button
                    type="button"
                    onClick={() => {
                      const item = visibleContents.find(f => f.name === selectedFile);
                      if (item && item.type === 'file') setPreviewFile(item);
                    }}
                    className="w-full mt-3 py-2 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-[10.5px] font-black cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md border-none select-none active:scale-[0.98] animate-pulse"
                  >
                    <Layers size={13} />
                    <span>👁️ 解码预览文件内容</span>
                  </button>
                )}
              </div>

              <div className="p-3 bg-slate-950/40 border border-indigo-550/10 rounded-lg text-[8.5px] text-slate-400 leading-normal text-center select-none font-serif">
                💡 <b>直觉式操作:</b> Dual-Click (双击) 文件夹进入，双击物理文件打开全文阅读或图像解码标定参数。100% 对齐 Windows 自带句柄架构。
              </div>
            </div>
          </div>
        </div>

        {/* Status indicator absolute bar */}
        <div className="bg-[#242424] py-2 px-4 border-t border-white/5 flex items-center justify-between shrink-0 select-none text-[10px] text-slate-400">
          <div className="text-left font-mono truncate max-w-lg">
            <span>当前选定的物理引用路径 (将输出至节点):</span>
            <div className="text-[11px] font-bold text-white block mt-0.5 select-all truncate">
              {fullSelectedPath || '未选定文件 (双击 workflows叶子 文件夹加载 Windows 本地文件)'}
            </div>
          </div>

          <div className="flex gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-[#333] hover:bg-[#3d3d3d] text-slate-305 hover:text-white rounded text-[10.5px] font-bold cursor-pointer transition-colors border-none"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!fullSelectedPath}
              onClick={confirmSelection}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#333] disabled:opacity-30 disabled:text-slate-500 text-white rounded text-[10.5px] font-black cursor-pointer transition-all shadow-md border-none flex items-center gap-1"
            >
              <Check size={11} />
              <span>载入该文件</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal 2: Dynamic Full Decoded File Contents Reader */}
      {previewFile && (
        <FilePreviewModal 
          file={previewFile}
          drive={currentDrive}
          segments={pathSegments}
          onClose={() => setPreviewFile(null)}
          onConfirmSelect={() => {
            const finalPath = `${currentDrive}\\${pathSegments.join('\\')}\\${previewFile.name}`;
            onSelect(finalPath);
            setPreviewFile(null);
            onClose();
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// DEEP NATIVE FILE CONTENT READER MODAL
// ==========================================
interface FilePreviewModalProps {
  file: FileItem;
  drive: string;
  segments: string[];
  onClose: () => void;
  onConfirmSelect: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  drive,
  segments,
  onClose,
  onConfirmSelect
}) => {
  const filename = file.name;
  const ext = filename.split('.').pop()?.toLowerCase();
  const absoluteLocation = `${drive}\\${segments.join('\\')}\\${filename}`;

  const realFile = (window as any)._explorerRealFileMap?.[file.id];

  // Viewer adjustable states
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [imageChannel, setImageChannel] = useState<'rgb' | 'r' | 'g' | 'b'>('rgb');
  const [gridOverlay, setGridOverlay] = useState<boolean>(true);

  // States to load real content in-memory
  const [loading, setLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');
  
  const [textContent, setTextContent] = useState<string>('');
  const [imageBlobUrl, setImageBlobUrl] = useState<string>('');
  const [zipEntries, setZipEntries] = useState<any[]>([]);
  const [csvGrid, setCsvGrid] = useState<string[][]>([]);

  // Selected sub index file inside archive
  const [archiveSubFilename, setArchiveSubFilename] = useState<string>('');
  const [archiveSubText, setArchiveSubText] = useState<string>('');
  const [archiveSubImgUrl, setArchiveSubImgUrl] = useState<string>('');
  const [archiveSubLoading, setArchiveSubLoading] = useState<boolean>(false);

  // Fallback demo mock spreadsheet
  const [excelRows, setExcelRows] = useState([
    { id: 1, name: '主窗口标定偏移 dX (mm)', value: '0.125', weight: '2.5', drift: '0.003' },
    { id: 2, name: '辅渲染器标定偏移 dY (mm)', value: '-0.342', weight: '1.8', drift: '-0.012' },
    { id: 3, name: '深度对线误差 dZ (mm)', value: '0.008', weight: '5.0', drift: '0.000' },
    { id: 4, name: 'GPU 渲染主频率偏移 (Mhz)', value: '1850', weight: '0.4', drift: '2.5' }
  ]);

  useEffect(() => {
    if (!realFile) return;

    let active = true;
    const processData = async () => {
      setLoading(true);
      setErrorText('');
      try {
        const fileExt = realFile.name.split('.').pop()?.toLowerCase() || '';
        
        if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(fileExt)) {
          const u = URL.createObjectURL(realFile);
          if (active) setImageBlobUrl(u);
        } else if (fileExt === 'zip') {
          const ab = await realFile.arrayBuffer();
          const zip = await JSZip.loadAsync(ab);
          const tempEntries: any[] = [];
          zip.forEach((rel, entry) => {
            tempEntries.push({
              name: entry.name,
              dir: entry.dir,
              size: (entry as any)._data?.uncompressedSize || 0,
              entry: entry
            });
          });
          if (active) setZipEntries(tempEntries);
        } else if (fileExt === 'csv') {
          const text = await realFile.text();
          const grid = text.split('\n').filter(Boolean).map(row => row.split(','));
          if (active) setCsvGrid(grid);
        } else {
          // Standard text based codecs (JSON comfy workflows, bat, py, log)
          const text = await realFile.text();
          if (active) setTextContent(text);
        }
      } catch (err: any) {
        if (active) setErrorText('文件解码分析失败: ' + err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    processData();

    return () => {
      active = false;
      if (imageBlobUrl) URL.revokeObjectURL(imageBlobUrl);
    };
  }, [realFile]);

  // Click ZIP inner file to browse
  const handleArchiveSubClick = async (item: any) => {
    if (item.dir) return;
    setArchiveSubLoading(true);
    setArchiveSubFilename(item.name);
    setArchiveSubText('');
    setArchiveSubImgUrl('');

    try {
      const name = item.name.toLowerCase();
      const sExt = name.split('.').pop();
      if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(sExt || '')) {
        const b = await item.entry.async('blob');
        const url = URL.createObjectURL(b);
        setArchiveSubImgUrl(url);
      } else {
        const txt = await item.entry.async('string');
        setArchiveSubText(txt);
      }
    } catch (e) {
      console.error("Unzip item reading failed", e);
    } finally {
      setArchiveSubLoading(false);
    }
  };

  const getHeading = () => {
    if (realFile) return `[物理机硬盘映射解密] ${realFile.type || '物理二进制层'}`;
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') return '图像静态图层光度计分析';
    if (ext === 'zip' || ext === 'rar') return 'WIN32 压缩封装结构查看器';
    if (ext === 'xlsx' || ext === 'csv') return '系统度量交互式标定电子明细表';
    return '纯文本及参数反照编辑器';
  };

  return (
    <div className="fixed inset-0 z-[100100] bg-black/85 backdrop-blur-md flex items-center justify-center p-6 text-slate-100 font-sans" onClick={onClose}>
      <div 
        className="bg-[#121212] border-2 border-indigo-500/40 w-full max-w-4xl h-[540px] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* title bar */}
        <div className="bg-[#181818] px-5 py-3 flex items-center gap-3 border-b border-white/5 font-mono text-[11px] shrink-0">
          <Layers size={14} className="text-indigo-400 animate-pulse" />
          <span className="text-slate-500">Windows 全真解码 &raquo;</span>
          <span className="font-bold text-white text-[12px] truncate max-w-lg">{filename}</span>
          <span className="ml-auto bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded text-[9px] border border-indigo-400/20">{getHeading()}</span>
          <X size={14} className="hover:bg-red-500 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer" onClick={onClose} />
        </div>

        {/* interactive content area */}
        <div className="flex-1 min-h-0 flex bg-[#0d0d0d] relative">
          {loading && (
            <div className="absolute inset-0 bg-black/70 z-50 flex flex-col items-center justify-center text-center">
              <Loader2 className="text-indigo-400 animate-spin mb-2" size={32} />
              <span className="text-xs font-mono text-slate-400">正在读取电脑物理硬盘介质，加载全量层数据并反向渲染...</span>
            </div>
          )}

          {errorText && (
            <div className="absolute inset-0 bg-red-950/20 z-50 flex flex-col items-center justify-center p-6 text-center text-red-400 font-mono">
              <ShieldAlert size={40} className="mb-2" />
              <span className="font-bold text-sm">物理介质解析异常</span>
              <p className="text-xs text-slate-450 max-w-md mt-1">{errorText}</p>
            </div>
          )}

          <div className="flex-1 p-4 min-h-0 overflow-y-auto">
            {/* A. Image preview */}
            {(ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || ext === 'gif' || ext === 'bmp') && (
              <div className="h-full flex flex-col gap-3">
                <div className="bg-[#181818] p-2 rounded border border-white/5 flex items-center gap-4 text-[10px] font-mono text-slate-400 leading-none">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setZoomLevel(Math.max(50, zoomLevel - 20))} className="p-1 rounded hover:bg-white/5 text-white border-none bg-transparent cursor-pointer">
                      <ZoomOut size={12} />
                    </button>
                    <span className="font-bold text-white">{zoomLevel}%</span>
                    <button onClick={() => setZoomLevel(Math.min(200, zoomLevel + 20))} className="p-1 rounded hover:bg-white/5 text-white border-none bg-transparent cursor-pointer">
                      <ZoomIn size={12} />
                    </button>
                  </div>
                  <div className="h-4 w-[1px] bg-white/10" />
                  <div className="flex bg-black/40 p-0.5 rounded border border-white/5">
                    <button onClick={() => setImageChannel('rgb')} className={`px-2 py-0.5 rounded border-none cursor-pointer text-[9px] ${imageChannel === 'rgb' ? 'bg-indigo-600 text-white font-bold' : 'bg-transparent text-slate-400 hover:text-white'}`}>RGB原色</button>
                    <button onClick={() => setImageChannel('r')} className={`px-2 py-0.5 rounded border-none cursor-pointer text-[9px] ${imageChannel === 'r' ? 'bg-red-900 text-white font-bold' : 'bg-transparent text-slate-400 hover:text-white'}`}>R通道</button>
                    <button onClick={() => setImageChannel('g')} className={`px-2 py-0.5 rounded border-none cursor-pointer text-[9px] ${imageChannel === 'g' ? 'bg-emerald-900 text-white font-bold' : 'bg-transparent text-slate-400 hover:text-white'}`}>G通道</button>
                    <button onClick={() => setImageChannel('b')} className={`px-2 py-0.5 rounded border-none cursor-pointer text-[9px] ${imageChannel === 'b' ? 'bg-blue-900 text-white font-bold' : 'bg-transparent text-slate-400 hover:text-white'}`}>B通道</button>
                  </div>
                  <label className="ml-auto flex items-center gap-1.5 cursor-pointer text-white">
                    <input type="checkbox" checked={gridOverlay} onChange={() => setGridOverlay(!gridOverlay)} className="accent-indigo-500" />
                    <span>坐标卡尺十字网格线</span>
                  </label>
                </div>

                <div className="flex-1 bg-slate-950 rounded-xl border border-white/5 relative overflow-hidden flex items-center justify-center p-4 min-h-[300px]">
                  {gridOverlay && (
                    <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#555_1px,transparent_1px),linear-gradient(to_bottom,#555_1px,transparent_1px)] bg-[size:32px_32px]">
                      <div className="absolute inset-1/2 w-full h-[1px] bg-red-500/50 -translate-x-1/2" />
                      <div className="absolute inset-1/2 h-full w-[1px] bg-red-500/50 -translate-y-1/2" />
                    </div>
                  )}

                  <div 
                    style={{ 
                      transform: `scale(${zoomLevel / 100})`, 
                      filter: imageChannel === 'r' ? 'grayscale(100%) sepia(100%) hue-rotate(330deg) saturate(9)' : imageChannel === 'g' ? 'grayscale(100%) sepia(100%) hue-rotate(80deg) saturate(9)' : imageChannel === 'b' ? 'grayscale(100%) sepia(100%) hue-rotate(190deg) saturate(9)' : 'none' 
                    }} 
                    className="max-h-[300px] max-w-full rounded-lg shadow-xl overflow-hidden transition-all duration-305 flex items-center justify-center"
                  >
                    {imageBlobUrl ? (
                      <img src={imageBlobUrl} alt={filename} className="max-h-[300px] object-contain select-none" referrerPolicy="no-referrer" />
                    ) : (
                      // Fallback vector container when no real file is available (demo)
                      <div className="w-[450px] h-[220px] bg-gradient-to-br from-indigo-950 via-slate-900 to-black p-4 text-left border border-white/10 flex flex-col justify-between relative font-sans leading-relaxed select-none">
                        <span className="absolute top-3 right-3 text-[8px] font-mono text-indigo-400/40 bg-indigo-950/20 px-1 rounded border border-indigo-500/20">VIRTUAL_PBR_HOST</span>
                        <div className="space-y-1 z-10">
                          <span className="text-[10px] font-mono block text-amber-500 font-extrabold uppercase">3D GPU RENDER OUTPUT PREVIEW</span>
                          <h4 className="text-[13px] font-black text-white">{filename}</h4>
                          <p className="text-[9.5px] text-slate-400 max-w-sm mt-1">
                            数字渲染对准校验图，采用 16-bit Display P3 色域。在 C# API HWND 主动对焦引擎下可直接映射。
                          </p>
                        </div>
                        
                        <div className="w-full h-18 bg-black/60 border border-white/5 rounded-lg flex items-center justify-between p-3 relative font-mono text-[9px] text-[#4fcca3] z-10 leading-tight">
                          <div className="space-y-0.5">
                            <div>RESOLUTION: <span className="text-white">2048 x 1536</span></div>
                            <div>COLOR SPACE: <span className="text-white">Display P3</span></div>
                          </div>
                          <div className="text-right space-y-0.5">
                            <div>BIAS_DELTA: <span className="text-amber-400">0.003 mm</span></div>
                            <div>STATUS_CONN: <span className="text-white">OK (30FPS)</span></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* B. ZIP file contents unzipper */}
            {(ext === 'zip' || ext === 'rar') && (
              <div className="h-full flex flex-col gap-3 font-sans text-left">
                <div className="bg-[#181818] p-2 rounded border border-white/5 flex items-center gap-2 text-[10.5px] text-slate-350">
                  <FileArchive size={14} className="text-amber-500" />
                  <span>ZIP 物理包内高精度反解压缩叶片目录 tree (双击或单击下属文件看内容):</span>
                </div>

                <div className="grid grid-cols-2 gap-3 flex-1 min-h-[280px]">
                  {/* Left Column: zip file tree entries */}
                  <div className="bg-[#161616] rounded-xl border border-white/5 overflow-y-auto max-h-[300px] text-[11px] divide-y divide-white/5">
                    {zipEntries.length > 0 ? (
                      zipEntries.map((item, id) => (
                        <button
                          key={id}
                          onClick={() => handleArchiveSubClick(item)}
                          className={`w-full text-left p-2.5 font-mono transition-all flex items-center gap-2 border-none bg-transparent hover:bg-white/5 text-slate-300 ${archiveSubFilename === item.name ? 'bg-indigo-600/15 text-white font-bold' : ''}`}
                        >
                          <FileCode size={12} className={item.dir ? 'text-yellow-600' : 'text-indigo-400'} />
                          <span className="truncate flex-1">{item.name}</span>
                          <span className="text-[9px] text-slate-500 shrink-0">{formatBytes(item.size)}</span>
                        </button>
                      ))
                    ) : (
                      // Mock simulation entries
                      <div className="p-4 text-center text-slate-505 font-serif text-[10.5px]">
                        <div>/ {filename} (仿真压缩柜)</div>
                        <p className="mt-2 text-[9px] text-slate-600 leading-normal">
                          载入一整套含 workflows 文件夹的真实的 zip 提取包后，在此处可以浏览并打开全部物理层文件。
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: zip entry content readers */}
                  <div className="bg-[#161616] rounded-xl border border-white/5 p-3 flex flex-col min-h-0 text-[10px]">
                    <div className="border-b border-white/5 pb-1.5 mb-2 font-mono text-slate-400 flex justify-between">
                      <span>子项预览: {archiveSubFilename || '未选择'}</span>
                      {archiveSubLoading && <Loader2 className="animate-spin text-indigo-450" size={12} />}
                    </div>
                    
                    <div className="flex-1 overflow-auto bg-black/40 p-2.5 rounded font-mono text-[9px] text-slate-300 leading-normal text-left whitespace-pre-wrap">
                      {archiveSubImgUrl ? (
                        <div className="flex items-center justify-center h-full">
                          <img src={archiveSubImgUrl} alt={archiveSubFilename} className="max-h-[180px] object-contain" />
                        </div>
                      ) : archiveSubText ? (
                        archiveSubText
                      ) : (
                        <span className="text-slate-600 italic">选中左侧 zip 页目录中的物理资产项，点击载入客户端即时解析查看器</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* C. Spreadsheet parser (Excel CSV) */}
            {(ext === 'xlsx' || ext === 'csv') && (
              <div className="h-full flex flex-col gap-3 font-sans">
                <div className="bg-[#181818] p-2 rounded border border-white/5 flex items-center gap-3 text-[10px] text-slate-400 select-none leading-none">
                  <FileSpreadsheet size={13} className="text-emerald-500" />
                  <span>交互式网格标定工作表 &raquo; <b className="text-white">ACTIVE_TAB_SHEET</b></span>
                </div>

                <div className="flex-1 bg-[#141414] rounded-xl border border-white/5 overflow-auto p-3 max-h-[300px]">
                  {csvGrid.length > 0 ? (
                    <table className="w-full text-left font-mono text-[10px] text-slate-300 leading-normal border-collapse">
                      <thead>
                        <tr className="bg-[#242424] border-b border-white/10 text-[9px] text-slate-450 uppercase uppercase-wider">
                          <th className="p-2 border border-white/5">轴/格</th>
                          {csvGrid[0]?.map((_, hIdx) => (
                            <th key={hIdx} className="p-2 border border-white/5">列 {hIdx + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {csvGrid.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-white/5 transition-all">
                            <td className="p-2 border border-white/5 font-extrabold text-yellow-600 bg-black/20">A{rIdx + 1}</td>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="p-2 border border-white/5 max-w-[120px] truncate">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    // Excel Mock View
                    <div className="min-w-[500px]">
                      <div className="grid grid-cols-6 bg-[#252525] py-2 px-3 text-[9.5px] font-bold border-b border-white/15 text-slate-300">
                        <span>轴格 (Cell)</span>
                        <span>偏差标定校验类别</span>
                        <span>运行测定值 (Value)</span>
                        <span>敏感度权重</span>
                        <span>系统偏差</span>
                        <span className="text-right">合算修正</span>
                      </div>
                      <div className="divide-y divide-white/5 font-mono text-[10px] text-slate-300">
                        {excelRows.map(row => (
                          <div key={row.id} className="grid grid-cols-6 py-2 px-3 items-center hover:bg-white/5">
                            <span className="text-yellow-600 font-extrabold">A{row.id + 4}</span>
                            <span className="text-white">{row.name}</span>
                            <input 
                              type="text" 
                              value={row.value} 
                              onChange={(e) => {
                                const val = e.target.value;
                                setExcelRows(prev => prev.map(r => r.id === row.id ? { ...r, value: val } : r));
                              }}
                              className="w-14 bg-black border border-white/10 text-white font-mono rounded text-center text-[10px] focus:outline-none focus:border-indigo-500 py-0.5"
                            />
                            <span>{row.weight}</span>
                            <span className="text-purple-400">{row.drift}</span>
                            <span className="text-right text-[#4fcca3] font-black">
                              {(parseFloat(row.value || '0') * parseFloat(row.weight) + parseFloat(row.drift)).toFixed(3)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* D. Code editor text viewport (JSON comfy, bat, scripts etc.) */}
            {ext !== 'png' && ext !== 'jpg' && ext !== 'jpeg' && ext !== 'webp' && ext !== 'gif' && ext !== 'bmp' && ext !== 'zip' && ext !== 'rar' && ext !== 'xlsx' && ext !== 'csv' && (
              <div className="h-full flex flex-col gap-3 font-mono leading-normal">
                {/* VS Code titlebar control tab */}
                <div className="bg-[#181818] p-2 px-4 rounded border border-white/5 flex items-center gap-1.5 text-[10px] text-slate-400 select-none shrink-0">
                  <Terminal size={12} className="text-yellow-500" />
                  <span className="bg-black/35 text-white font-bold px-3 py-1 rounded border-t border-x border-white/10 truncate max-w-[200px]">{filename}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[9px] bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded">UTF-8</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(textContent);
                      }}
                      className="flex items-center gap-1 py-1 px-2.5 bg-[#2c2c2c] hover:bg-[#383838] hover:text-white text-slate-350 rounded text-[9.5px] cursor-pointer border-none font-bold transition-all"
                    >
                      <Copy size={11} />
                      <span>复制代码</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 bg-[#151515] rounded-xl border border-white/5 overflow-y-auto p-4 text-[10px] text-slate-300 max-h-[300px] font-mono leading-normal select-text">
                  {textContent ? (
                    // Displays actual real computer files
                    textContent.split('\n').map((line, idx) => (
                      <div key={idx} className="flex gap-4">
                        <span className="text-slate-650 select-none w-6 text-right font-mono text-[9.5px]">{idx + 1}</span>
                        <span className="whitespace-pre">{line}</span>
                      </div>
                    ))
                  ) : (
                    // Simulated ComfyUI node details fallback
                    [
                      `{`,
                      `  "prompt_workflow_meta": {`,
                      `    "id": "${filename.replace('.json', '')}",`,
                      `    "engine": "comfyui_launcher",`,
                      `    "physical_windows_drive": "${drive}",`,
                      `    "hwnd_latency_jitter_ms": "2.41"`,
                      `  },`,
                      `  "calibrated_positions": {`,
                      `    "axis_translation_offset_dx": 0.125,`,
                      `    "axis_translation_offset_dy": -0.342,`,
                      `    "absolute_screen_rect_bounds": "x=${drive === 'F:' ? '1425' : '100'}, y=812, width=1920, height=1085"`,
                      `  }`,
                      `}`
                    ].map((line, idx) => (
                      <div key={idx} className="flex gap-4 font-mono">
                        <span className="text-slate-600 select-none w-6 text-right">{idx + 1}</span>
                        <span className="whitespace-pre">
                          {line.includes(':') ? (
                            <>
                              <span className="text-indigo-300 font-bold">{line.split(':')[0]}</span>:
                              <span className="text-amber-400">{line.split(':')[1]}</span>
                            </>
                          ) : (
                            <span className="text-slate-400">{line}</span>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar details info pane */}
          <div className="w-[190px] border-l border-white/5 bg-[#141414] p-3 flex flex-col gap-4 text-left font-mono text-[9px] shrink-0 select-none">
            <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1.5">物理标定详情</h4>
            
            <div className="space-y-4 text-slate-400 leading-normal">
              <div className="space-y-1 bg-black/40 p-2 rounded border border-white/5">
                <span className="text-white font-bold block mb-1">物理绝对位置:</span>
                <span className="text-indigo-300 font-bold block break-all text-[8px] bg-black/80 px-1.5 py-1 rounded leading-tight">{absoluteLocation}</span>
              </div>

              <div className="space-y-1.5 bg-black/40 p-2 rounded border border-white/5">
                <div>媒体尺寸: <span className="text-white font-bold">{file.size || '1.1 KB'}</span></div>
                <div>修改时间: <span className="text-white font-bold">{file.modified || '2026-06-05'}</span></div>
                <div>文件后缀: <span className="text-amber-500 font-bold uppercase">{ext || 'RAW_BIN'}</span></div>
              </div>

              <div className="p-2.5 bg-indigo-950/20 border border-indigo-500/10 rounded-lg text-slate-350 leading-relaxed text-[8px]">
                <span className="text-indigo-300 font-bold block mb-1">客户端直接解析</span>
                本项目完全通过浏览器 File API 直接在本地机解码分析，保护数据隐私，0延迟反解。
              </div>
            </div>
          </div>
        </div>

        {/* preview modal footer */}
        <div className="bg-[#181818] p-4 border-t border-white/5 flex items-center justify-between shrink-0 select-none text-[10px]">
          <div className="text-left font-mono">
            <span className="text-slate-500 block">确认选定此物理路径绑定 HWND 控制:</span>
            <span className="text-[#4fcca3] font-bold text-[11px] block truncate max-w-lg leading-tight mt-0.5">{absoluteLocation}</span>
          </div>

          <div className="flex gap-2.5 shrink-0">
            <button 
              onClick={onClose} 
              className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#383838] text-slate-300 hover:text-white rounded text-[11px] font-bold cursor-pointer transition-colors border-none"
            >
              关闭预览
            </button>
            <button 
              onClick={onConfirmSelect} 
              className="px-6 py-2 bg-indigo-650 hover:bg-indigo-550 text-white font-extrabold rounded text-[11px] cursor-pointer transition-all flex items-center gap-1 border-none shadow-md"
            >
              <Check size={11} />
              <span>直接确认选择该路径</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
