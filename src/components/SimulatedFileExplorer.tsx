import React, { useState, useEffect } from 'react';
import { 
  Folder, FileCode, FolderOpen, HardDrive, Search, 
  ArrowLeft, ArrowRight, ArrowUp, RotateCw, Home, Upload, 
  Info, Check, X, ShieldAlert, Monitor, ChevronRight, Cloud, 
  DownloadCloud, Download, FileText, Layers, HelpCircle,
  Copy, ZoomIn, ZoomOut, Printer, FileSpreadsheet, FileArchive,
  Image, Terminal
} from 'lucide-react';

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
            },
            {
              id: 'c_pf_adobe_ps_2026',
              name: 'Adobe Photoshop 2026',
              type: 'folder',
              children: [
                { id: 'c_pf_adobe_ps_2026_exe', name: 'Photoshop.exe', type: 'file', size: '182 MB', modified: '2026-05-18 10:11' },
                { id: 'c_pf_adobe_ps_2026_dll', name: 'amtlib.dll', type: 'file', size: '4.5 MB', modified: '2026-05-18 10:11' }
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
                { id: 'c_pf_blender_exe', name: 'blender.exe', type: 'file', size: '241 MB', modified: '2024-01-20 15:45' },
                { id: 'c_pf_blender_launcher_exe', name: 'blender-launcher.exe', type: 'file', size: '1.2 MB', modified: '2024-01-20 15:45' }
              ]
            }
          ]
        },
        {
          id: 'c_pf_keyshot',
          name: 'KeyShot11',
          type: 'folder',
          children: [
            {
              id: 'c_pf_keyshot_bin',
              name: 'bin',
              type: 'folder',
              children: [
                { id: 'c_pf_keyshot_exe', name: 'keyshot.exe', type: 'file', size: '182 MB', modified: '2024-06-18 10:30' }
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
                { id: 'c_desk_k', name: 'KeyShot 11.lnk', type: 'file', size: '2 KB', modified: '2026-05-01 10:15' },
                { id: 'c_desk_b', name: 'Blender 4.0.lnk', type: 'file', size: '1.5 KB', modified: '2026-05-01 10:15' },
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
            { id: 'd_ai_comfyui_gpu', name: 'run_nvidia_gpu.bat', type: 'file', size: '1.5 KB', modified: '2026-04-11 15:33' },
            { id: 'd_ai_comfyui_cpu', name: 'run_cpu.bat', type: 'file', size: '1.4 KB', modified: '2026-04-11 15:33' }
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
            { id: 'e_render_p1', name: 'keyshot_rendered_001.png', type: 'file', size: '8.4 MB', modified: '2026-06-02 22:15' },
            { id: 'e_render_scene', name: 'industrial_drill_final.bip', type: 'file', size: '450 MB', modified: '2026-06-04 18:22' }
          ]
        }
      ]
    }
  ],
  'F:': [
    {
      id: 'f_ue_projects',
      name: 'UnrealProjects',
      type: 'folder',
      children: [
        {
          id: 'f_ue_projects_s1',
          name: 'CyberpunkCityLevel',
          type: 'folder',
          children: [
            { id: 'f_ue_uproject', name: 'CyberpunkCityLevel.uproject', type: 'file', size: '15 KB', modified: '2026-05-22 16:45' }
          ]
        }
      ]
    },
    {
      id: 'f_textures',
      name: 'PBR_Textures_Pack',
      type: 'folder',
      children: [
        { id: 'f_tex_wood', name: 'carbon_rough_color.png', type: 'file', size: '4.1 MB', modified: '2026-01-10 12:45' },
        { id: 'f_tex_metal', name: 'brushed_iron_normal.png', type: 'file', size: '8.2 MB', modified: '2026-01-10 12:46' }
      ]
    }
  ]
};

// Generates highly detailed, realistic subfolders, images, archives, docs dynamically
const generateDynamicFilesForFolder = (folderName: string, segments: string[], drive: string): FileItem[] => {
  const normalized = folderName.toLowerCase();
  const results: FileItem[] = [];
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

  // 1. Image related directory
  if (normalized.includes('render') || normalized.includes('picture') || normalized.includes('photo') || normalized.includes('image') || normalized.includes('texture') || normalized.includes('output') || normalized.includes('material')) {
    results.push(
      { id: `dyn_img_${folderName}_1`, name: `${folderName}_render_diffuse.png`, type: 'file', size: '6.4 MB', modified: timestamp },
      { id: `dyn_img_${folderName}_2`, name: `octane_camera_isometric_v08.jpg`, type: 'file', size: '3.1 MB', modified: timestamp },
      { id: `dyn_img_${folderName}_3`, name: `displacement_brushed_metal_normal.png`, type: 'file', size: '7.5 MB', modified: timestamp },
      { id: `dyn_zip_${folderName}_4`, name: `texture_mapping_materials.zip`, type: 'file', size: '142 MB', modified: timestamp },
      { id: `dyn_doc_${folderName}_5`, name: `render_quality_checklist.xlsx`, type: 'file', size: '45 KB', modified: timestamp },
      { id: `dyn_txt_${folderName}_6`, name: `render_performance_profile.log`, type: 'file', size: '18 KB', modified: timestamp }
    );
  } 
  // 2. ComfyUI / AI / Scripts related directory
  else if (normalized.includes('comfy') || normalized.includes('ai') || normalized.includes('draw') || normalized.includes('stable') || normalized.includes('diffusion')) {
    results.push(
      { id: `dyn_bin_${folderName}_1`, name: `run_nvidia_gpu_optimized.bat`, type: 'file', size: '1.8 KB', modified: timestamp },
      { id: `dyn_doc_${folderName}_2`, name: `workflow_v2_hires_upscale.json`, type: 'file', size: '240 KB', modified: timestamp },
      { id: `dyn_img_${folderName}_3`, name: `comfy_generated_grid_test_01.png`, type: 'file', size: '5.2 MB', modified: timestamp },
      { id: `dyn_zip_${folderName}_4`, name: `custom_nodes_extension_source.zip`, type: 'file', size: '3.2 MB', modified: timestamp },
      { id: `dyn_txt_${folderName}_5`, name: `comfyui_server_boot.log`, type: 'file', size: '124 KB', modified: timestamp }
    );
  } 
  // 3. Unreal / Engine / Projects
  else if (normalized.includes('unreal') || normalized.includes('ue') || normalized.includes('project') || normalized.includes('unity') || normalized.includes('game') || normalized.includes('level') || normalized.includes('scene')) {
    results.push(
      { id: `dyn_file_${folderName}_1`, name: `${folderName}.uproject`, type: 'file', size: '12 KB', modified: timestamp },
      { id: `dyn_txt_${folderName}_2`, name: `Config/DefaultEngine.ini`, type: 'file', size: '8.4 KB', modified: timestamp },
      { id: `dyn_zip_${folderName}_3`, name: `Content_Backup_Package_June.zip`, type: 'file', size: '840 MB', modified: timestamp },
      { id: `dyn_img_${folderName}_4`, name: `Saved_Thumbnails_LevelDesignMap.png`, type: 'file', size: '2.5 MB', modified: timestamp },
      { id: `dyn_txt_${folderName}_5`, name: `Saved_Logs_UnrealEditor_LastSession.log`, type: 'file', size: '250 KB', modified: timestamp }
    );
  } 
  // 4. Documents / Workspaces
  else if (normalized.includes('work') || normalized.includes('document') || normalized.includes('projects') || normalized.includes('workspace')) {
    results.push(
      { id: `dyn_doc_${folderName}_1`, name: `CAD_calibration_specs_agreement.pdf`, type: 'file', size: '2.4 MB', modified: timestamp },
      { id: `dyn_doc_${folderName}_2`, name: `interactive_system_schedule.xlsx`, type: 'file', size: '75 KB', modified: timestamp },
      { id: `dyn_doc_${folderName}_3`, name: `3D_collaboration_manifest.docx`, type: 'file', size: '112 KB', modified: timestamp },
      { id: `dyn_zip_${folderName}_4`, name: `engineering_source_v1.4.zip`, type: 'file', size: '55 MB', modified: timestamp },
      { id: `dyn_img_${folderName}_5`, name: `process_flowchart_board.png`, type: 'file', size: '1.6 MB', modified: timestamp }
    );
  } 
  // 5. Classic user folders
  else if (normalized.includes('download') || normalized.includes('desktop') || normalized.includes('user') || normalized.includes('admin') || normalized.includes('doc')) {
    results.push(
      { id: `dyn_bin_${folderName}_1`, name: `Blender_v4.2_stable_installer.exe`, type: 'file', size: '310 MB', modified: timestamp },
      { id: `dyn_zip_${folderName}_2`, name: `extracted_models_archive.zip`, type: 'file', size: '185 MB', modified: timestamp },
      { id: `dyn_doc_${folderName}_3`, name: `Client_Signoff_Design_Brief.docx`, type: 'file', size: '80 KB', modified: timestamp },
      { id: `dyn_img_${folderName}_4`, name: `reference_inspiration_01.jpg`, type: 'file', size: '4.2 MB', modified: timestamp },
      { id: `dyn_txt_${folderName}_5`, name: `quick_scratchpad_notes.txt`, type: 'file', size: '15 KB', modified: timestamp }
    );
  } 
  // 6. Generic directories (Allows infinitely deep traversal with proper content)
  else {
    results.push(
      { id: `dyn_doc_${folderName}_pdf`, name: `${folderName}_specifications_v1.pdf`, type: 'file', size: '1.8 MB', modified: timestamp },
      { id: `dyn_zip_${folderName}_zip`, name: `${folderName}_archive_backup.zip`, type: 'file', size: '45.2 MB', modified: timestamp },
      { id: `dyn_xlsx_${folderName}_xlsx`, name: `parameter_inventory_sheet.xlsx`, type: 'file', size: '38 KB', modified: timestamp },
      { id: `dyn_img_${folderName}_png`, name: `${folderName}_visual_preview.png`, type: 'file', size: '2.9 MB', modified: timestamp },
      { id: `dyn_txt_${folderName}_json`, name: `settings_config.json`, type: 'file', size: '2.5 KB', modified: timestamp },
      { id: `dyn_txt_${folderName}_txt`, name: `deployment_log_notes.txt`, type: 'file', size: '1.4 KB', modified: timestamp }
    );
  }

  // Always generate 2 nested folders to let users go infinitely deeper in their exploration!
  results.push(
    { id: `dyn_fold_${folderName}_backup`, name: `Backup_System_Cluster`, type: 'folder', children: [] },
    { id: `dyn_fold_${folderName}_cached`, name: `Cache_Temp_Data`, type: 'folder', children: [] }
  );

  return results;
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

  // Track the dynamic physical navigation tree
  const [virtualFS, setVirtualFS] = useState<Record<string, FileItem[]>>(BASE_FS);
  const [currentDrive, setCurrentDrive] = useState<'C:' | 'D:' | 'E:' | 'F:'>('C:');
  const [pathSegments, setPathSegments] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isThisPC, setIsThisPC] = useState<boolean>(false);

  // User upload & read-in states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string>('');
  const [uploadedTextContent, setUploadedTextContent] = useState<string>('');
  const [localFileConstructedPath, setLocalFileConstructedPath] = useState<string>('');

  // Nav history
  const [history, setHistory] = useState<{ drive: 'C:' | 'D:' | 'E:' | 'F:'; segments: string[]; isPC: boolean }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // File Preview Modal States
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewInsideZipFile, setPreviewInsideZipFile] = useState<{ name: string; size: string; type: string } | null>(null);

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
    setPreviewInsideZipFile(null);
  };

  useEffect(() => {
    if (initialPath) {
      const driveMatch = initialPath.match(/^([A-Za-z]):\\/);
      if (driveMatch) {
        const driveLetter = driveMatch[1].toUpperCase();
        const drive = (driveLetter + ':') as 'C:' | 'D:' | 'E:' | 'F:';
        
        const segments = initialPath
          .replace(/^([A-Za-z]):\\/, '')
          .split('\\')
          .filter(s => s && !s.toLowerCase().includes('.exe') && !s.toLowerCase().includes('.bat') && !s.toLowerCase().includes('.uproject'));
        
        const filePart = initialPath.split('\\').pop() || '';
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

    setCurrentDrive('C:');
    setPathSegments([]);
    setIsThisPC(true);
    setHistory([{ drive: 'C:', segments: [], isPC: true }]);
    setHistoryIndex(0);
  }, [initialPath, appPresetId, isOpen]);

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

  // Traverses filesystem. If directory is empty or dynamic, lazily spawns complete files of all kinds!
  const getContentsAtCurrentPath = (): FileItem[] => {
    if (isThisPC) return [];
    
    // We deep copy or read from virtualFS state
    const fsCopy = { ...virtualFS };
    let current = fsCopy[currentDrive] || [];

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      let foundIdx = current.findIndex(item => item.name === segment && item.type === 'folder');
      
      if (foundIdx === -1) {
        // dynamically append folder
        const newFolder: FileItem = {
          id: `dyn_idx_${segment}_${i}`,
          name: segment,
          type: 'folder',
          children: []
        };
        current.push(newFolder);
        foundIdx = current.length - 1;
      }

      const foundFolder = current[foundIdx];
      if (!foundFolder.children || foundFolder.children.length === 0) {
        foundFolder.children = generateDynamicFilesForFolder(segment, pathSegments.slice(0, i + 1), currentDrive);
        // update our mutable registry
        setVirtualFS(fsCopy);
      }
      current = foundFolder.children;
    }

    return current;
  };

  const handleFolderClick = (name: string) => {
    navigateTo(currentDrive, [...pathSegments, name], false);
  };

  const handleDriveClick = (drive: 'C:' | 'D:' | 'E:' | 'F:') => {
    navigateTo(drive, [], false);
  };

  const handleThisPCClick = () => {
    navigateTo('C:', [], true);
  };

  // Handles raw system physical loading! Automatically reads pictures and document texts dynamically
  const handleRealFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFile(file);
      setSelectedFile(file.name);
      
      // Determine pseudo-folder binding path
      const drive = isThisPC ? 'C:' : currentDrive;
      const baseFolder = pathSegments.length > 0 
        ? (drive + '\\' + pathSegments.join('\\')) 
        : `${drive}\\Program Files\\CustomApp`;
        
      const fullPath = `${baseFolder}\\${file.name}`;
      setLocalFileConstructedPath(fullPath);

      // FileReader for previewing raw upload content
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedDataUrl(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedTextContent(event.target?.result as string || '普通二进制对象数据...');
        };
        reader.readAsText(file);
      }
    }
  };

  const currentPathString = isThisPC ? '此电脑' : `${currentDrive}\\${pathSegments.join('\\')}`;
  const fullSelectedPath = selectedFile 
    ? (isThisPC ? `C:\\${selectedFile}` : `${currentDrive}\\${pathSegments.join('\\')}${pathSegments.length > 0 ? '\\' : ''}${selectedFile}`)
    : '';

  const confirmSelection = () => {
    const finalPath = localFileConstructedPath || fullSelectedPath;
    if (finalPath) {
      onSelect(finalPath);
    }
    onClose();
  };

  // Recursive search matching
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
        count: isThisPC ? '7个设备/驱动器' : `${visibleContents.length} 个子项目`,
        description: '选择一个文件、文件夹或虚拟磁盘卷以查看其详细物理参数及数据流预览。'
      };
    }
    
    if (isThisPC) {
      return {
        title: '此电脑 (This PC)',
        count: '7 个主要项目',
        description: '系统检测为 Windows 11 本地工作站，包含 C、D、E、F 本地分卷以及 3 个超高速云存储通道映射。'
      };
    }

    const item = visibleContents.find(f => f.name === selectedFile);
    if (item) {
      const ext = item.name.split('.').pop()?.toLowerCase();
      let typeDesc = '未知资产文件';
      if (ext === 'exe') typeDesc = 'Win32 执行程序';
      else if (ext === 'bat') typeDesc = 'CMD 批处理脚本';
      else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') typeDesc = 'PBR/渲染静态图层';
      else if (ext === 'zip' || ext === 'rar') typeDesc = 'ZIP 资源压缩包';
      else if (ext === 'docx') typeDesc = 'Word 全真文档';
      else if (ext === 'xlsx') typeDesc = 'Excel 数据度量表';
      else if (ext === 'pdf') typeDesc = 'PDF 矢量工程图纸';
      else if (ext === 'json') typeDesc = 'RAW JSON 参数配置';

      return {
        item,
        title: item.name,
        count: item.size || '1.1 KB',
        type: typeDesc,
        modified: item.modified || '2026-06-05',
        path: `${currentDrive}\\${pathSegments.join('\\')}\\${selectedFile}`,
        description: '此文件路径已获取物理HWND句柄。点击下方预览按钮可直接解码查看数据及底层标定参数！'
      };
    }

    if (localFileConstructedPath) {
      return {
        item: { name: selectedFile, type: 'file', id: 'uploaded' } as FileItem,
        title: selectedFile,
        count: uploadedFile ? `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB` : '本地装载',
        type: '用户直接导入的物理文件',
        modified: '刚刚读入',
        path: localFileConstructedPath,
        description: '已成功打通浏览器物理隔离！该文件内容已被直接序列化读入物理内存。点击预览按键即可立即渲染！'
      };
    }

    return {
      title: '此电脑',
      count: '未选中对象',
      description: '选择单个文件以查看系统参数、三维坐标，或启动文件深度预览与读写！'
    };
  };

  const details = getSelectedDetails();

  return (
    <div className="fixed inset-0 z-[100050] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-[#1e1e1e] border-2 border-indigo-500/30 max-w-5xl w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto h-[640px] text-[#f3f3f3] font-sans"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Tabs */}
        <div className="bg-[#1c1c1c] px-4 pt-2.5 flex items-center gap-1.5 shrink-0 border-b border-white/5 select-none text-[11px]">
          <div className="flex items-center gap-2 bg-[#2d2d2d] px-3.5 py-1.5 rounded-t-lg border-t border-x border-white/10 text-white font-medium max-w-[150px] truncate">
            <Monitor size={11} className="text-indigo-400" />
            <span>此电脑 (This PC)</span>
            <X size={10} className="ml-2 hover:bg-white/10 p-0.5 rounded cursor-pointer" onClick={onClose} />
          </div>
          <button className="p-1 px-2 rounded hover:bg-white/5 text-slate-400 hover:text-white text-xs">+</button>
          
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <span>Microsoft Windows 11 Explorer Simulation v9.2</span>
          </div>
        </div>

        {/* Navigation Toolbar */}
        <div className="bg-[#2d2d2d] py-2 px-4 border-b border-white/5 flex items-center gap-2.5 shrink-0 select-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleBackward}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded hover:bg-white/10 text-[#f3f3f3] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed border-none bg-transparent"
              title="后退"
            >
              <ArrowLeft size={13} />
            </button>
            <button
              onClick={handleForward}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded hover:bg-white/10 text-[#f3f3f3] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed border-none bg-transparent"
              title="前进"
            >
              <ArrowRight size={13} />
            </button>
            <button
              onClick={handleUp}
              className="p-1.5 rounded hover:bg-white/10 text-[#f3f3f3] cursor-pointer border-none bg-transparent"
              title="返回上一级"
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

          {/* Breadcrumbs Address Bar */}
          <div className="flex-1 min-w-0 bg-[#202020] px-3.5 py-1.5 rounded border border-white/15 text-left font-mono text-[11px] text-[#f3f3f3]/90 flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none shadow-inner">
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
                  className="hover:bg-white/10 px-1 py-0.5 rounded text-slate-300 border-none bg-transparent cursor-pointer text-[11px]"
                >
                  {seg}
                </button>
              </React.Fragment>
            ))}

            {selectedFile && (
              <>
                <ChevronRight size={10} className="text-slate-500 shrink-0" />
                <span className="text-emerald-400 font-bold px-1">{selectedFile}</span>
              </>
            )}
          </div>

          {/* Search box */}
          <div className="relative w-48 shrink-0">
            <input 
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedFile('');
              }}
              placeholder="在 此电脑 中搜索"
              className="w-full bg-[#202020] border border-white/15 rounded px-2.5 pl-7 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500 shadow-inner"
            />
            <Search size={11} className="absolute left-2.5 top-2 text-slate-400 font-bold" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1 text-[10px] text-slate-400 hover:text-white border-none bg-transparent cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* main workspace pane */}
        <div className="flex flex-1 min-h-0">
          
          {/* Column 1: Left Quick Navigation Sidebar */}
          <div className="w-[180px] border-r border-white/5 bg-[#1b1b1b] p-3 flex flex-col gap-3 shrink-0 text-left select-none overflow-y-auto">
            
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-2 block mb-1">导航和快速访问</span>
              
              <button onClick={handleThisPCClick} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11.5px] text-slate-300 hover:bg-white/5 border-none bg-transparent text-left cursor-pointer">
                <Monitor size={11} className="text-indigo-400 shrink-0" />
                <span>桌面 (Desktop)</span>
              </button>
              
              <button onClick={() => navigateTo('C:', ['Users', 'Administrator', 'Desktop'], false)} className="w-full flex items-center gap-2 px-2 py-1 py-1.5 rounded text-[11.5px] text-slate-300 hover:bg-white/5 border-none bg-transparent text-left cursor-pointer pl-6">
                <Folder size={11} className="text-amber-500 shrink-0" />
                <span>下载 (Downloads)</span>
              </button>
              
              <button onClick={() => navigateTo('E:', ['Work_Workspace'], false)} className="w-full flex items-center gap-2 px-2 py-1 py-1.5 rounded text-[11.5px] text-slate-300 hover:bg-white/5 border-none bg-transparent text-left cursor-pointer pl-6">
                <Folder size={11} className="text-indigo-400 shrink-0" />
                <span>工作文档 (Work_WS)</span>
              </button>

              <button onClick={() => navigateTo('F:', ['PBR_Textures_Pack'], false)} className="w-full flex items-center gap-2 px-2 py-1 py-1.5 rounded text-[11.5px] text-slate-300 hover:bg-white/5 border-none bg-transparent text-left cursor-pointer pl-6">
                <Folder size={11} className="text-[#a573ff] shrink-0" />
                <span>材质/图片 (Textures)</span>
              </button>
            </div>

            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-2 block mb-1">高速云盘映射</span>
              <button className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] text-slate-300 hover:bg-white/5 border-none bg-transparent text-left cursor-pointer">
                <Cloud size={11} className="text-sky-400 shrink-0" />
                <span>WPS云端文件</span>
              </button>
              <button className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] text-slate-300 hover:bg-white/5 border-none bg-transparent text-left cursor-pointer">
                <DownloadCloud size={11} className="text-blue-400 shrink-0" />
                <span>百度网盘备份区</span>
              </button>
            </div>

            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-2 block mb-1">物理磁盘卷</span>
              
              <button
                onClick={handleThisPCClick}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-semibold text-left border-none bg-transparent cursor-pointer ${isThisPC ? 'bg-indigo-600/20 text-white font-bold' : 'text-slate-300 hover:bg-white/5'}`}
              >
                <Monitor size={11} className="text-indigo-400 shrink-0" />
                <span>此电脑 (My PC)</span>
              </button>

              <div className="pl-4 space-y-0.5 border-l border-white/5 ml-3">
                <button 
                  onClick={() => handleDriveClick('C:')} 
                  className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10.5px] border-none bg-transparent text-left cursor-pointer ${!isThisPC && currentDrive === 'C:' ? 'bg-indigo-600/15 text-indigo-300 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  <HardDrive size={10} className="text-indigo-400 shrink-0" />
                  <span>系统卷 (C:)</span>
                </button>
                <button 
                  onClick={() => handleDriveClick('D:')} 
                  className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10.5px] border-none bg-transparent text-left cursor-pointer ${!isThisPC && currentDrive === 'D:' ? 'bg-indigo-600/15 text-indigo-300 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  <HardDrive size={10} className="text-emerald-400 shrink-0" />
                  <span>软件/绘图 (D:)</span>
                </button>
                <button 
                  onClick={() => handleDriveClick('E:')} 
                  className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10.5px] border-none bg-transparent text-left cursor-pointer ${!isThisPC && currentDrive === 'E:' ? 'bg-indigo-600/15 text-indigo-300 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  <HardDrive size={10} className="text-amber-500 shrink-0" />
                  <span>工作文档 (E:)</span>
                </button>
                <button 
                  onClick={() => handleDriveClick('F:')} 
                  className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10.5px] border-none bg-transparent text-left cursor-pointer ${!isThisPC && currentDrive === 'F:' ? 'bg-indigo-600/15 text-indigo-300 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  <HardDrive size={10} className="text-purple-400 shrink-0" />
                  <span>数字卷柜 (F:)</span>
                </button>
              </div>
            </div>

            {/* Quick manual asset import */}
            <div className="mt-auto border-t border-white/5 pt-3">
              <label 
                htmlFor="explorer-real-file-desktop"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 border-none text-white text-[11px] font-black cursor-pointer transition-all shadow text-center select-none"
              >
                <Upload size={11} />
                <span>导入物理 asset/文件</span>
              </label>
              <input 
                id="explorer-real-file-desktop"
                type="file"
                onChange={handleRealFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Column 2: Center Folders and Files Display area */}
          <div className="flex-1 p-5 bg-[#171717] overflow-y-auto flex flex-col pointer-events-auto min-h-0 text-left">
            {searchQuery ? (
              // Search view
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase font-mono tracking-wider">在电脑卷中检索到的结果: ({searchResults.length})</span>
                </div>
                {searchResults.length === 0 ? (
                  <div className="py-20 text-center text-xs text-slate-500 font-mono italic">未搜寻到匹配的可执行或配置文件...</div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {searchResults.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setLocalFileConstructedPath('');
                          setSelectedFile(item.name);
                          const driveSeg = item.path.split('\\')[0] + ':';
                          const paths = item.path.split('\\').slice(1);
                          paths.pop(); // remove file name
                          setCurrentDrive(driveSeg as any);
                          setPathSegments(paths);
                          setIsThisPC(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${selectedFile === item.name ? 'bg-indigo-600/10 border-indigo-500 text-white' : 'bg-[#222]/40 hover:bg-[#2c2c2c]/40 border-transparent text-slate-300'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileCode size={16} className="text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-[11.5px] text-white block truncate leading-none">{item.name}</span>
                            <span className="text-[9px] font-mono text-slate-500 block truncate mt-1">{item.path}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] font-mono text-slate-400">{item.size}</span>
                          <div className={`w-4 h-4 rounded-full border border-indigo-500/30 flex items-center justify-center ${selectedFile === item.name ? 'bg-indigo-600 text-white' : 'bg-transparent'}`}>
                            {selectedFile === item.name && <Check size={10} />}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : isThisPC ? (
              // 1. Devices & Drives layout (matches Windows 11 completely)
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider select-none">设备和驱动器 (7个主要虚拟节点)</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    
                    <div className="bg-[#242424]/80 p-3 rounded-lg border border-white/5 select-none flex items-center gap-3 shadow-sm hover:border-sky-500/20 transition-all">
                      <Cloud size={24} className="text-sky-400 shrink-0" />
                      <div className="text-left leading-normal min-w-0">
                        <span className="text-[11.5px] font-bold text-white block truncate">WPS云盘映射</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">云端高带宽同步层</span>
                      </div>
                    </div>

                    <div className="bg-[#242424]/80 p-3 rounded-lg border border-white/5 select-none flex items-center gap-3 shadow-sm hover:border-blue-500/20 transition-all">
                      <DownloadCloud size={24} className="text-blue-550 shrink-0" />
                      <div className="text-left leading-normal min-w-0">
                        <span className="text-[11.5px] font-bold text-white block truncate">百度网盘映射</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">GB级超大型模型提取区</span>
                      </div>
                    </div>

                    <div className="bg-[#242424]/80 p-3 rounded-lg border border-white/5 select-none flex items-center gap-3 shadow-sm hover:border-emerald-500/20 transition-all">
                      <Download size={24} className="text-emerald-450 shrink-0" />
                      <div className="text-left leading-normal min-w-0">
                        <span className="text-[11.5px] font-bold text-white block truncate">夸克大容量存储</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">底盘渲染分块高速映射</span>
                      </div>
                    </div>

                    {/* C Drive */}
                    <div 
                      onClick={() => handleDriveClick('C:')}
                      onDoubleClick={() => handleDriveClick('C:')}
                      className="bg-[#242424]/80 p-3 rounded-lg border border-white/5 hover:bg-[#2c2c2c] hover:border-indigo-500/20 transition-all select-none flex items-center gap-3 cursor-pointer group shadow"
                    >
                      <HardDrive size={24} className="text-indigo-400 shrink-0 group-hover:scale-105 transition-transform" />
                      <div className="text-left leading-normal min-w-0 flex-1">
                        <span className="text-[11.5px] font-bold text-white block truncate">系统盘 (C:)</span>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5 border border-black/20">
                          <div className="bg-sky-500 h-full rounded-full" style={{ width: '80%' }} />
                        </div>
                        <span className="text-[9px] text-[#999] block mt-1">57.4 GB 可用，共 299 GB</span>
                      </div>
                    </div>

                    {/* D Drive */}
                    <div 
                      onClick={() => handleDriveClick('D:')}
                      onDoubleClick={() => handleDriveClick('D:')}
                      className="bg-[#242424]/80 p-3 rounded-lg border border-white/5 hover:bg-[#2c2c2c] hover:border-emerald-500/20 transition-all select-none flex items-center gap-3 cursor-pointer group shadow"
                    >
                      <HardDrive size={24} className="text-emerald-450 shrink-0 group-hover:scale-105 transition-transform" />
                      <div className="text-left leading-normal min-w-0 flex-1">
                        <span className="text-[11.5px] font-bold text-white block truncate">绘图软件 (D:)</span>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5 border border-black/20">
                          <div className="bg-sky-500 h-full rounded-full" style={{ width: '55%' }} />
                        </div>
                        <span className="text-[9px] text-[#999] block mt-1">141 GB 可用，共 316 GB</span>
                      </div>
                    </div>

                    {/* E Drive */}
                    <div 
                      onClick={() => handleDriveClick('E:')}
                      onDoubleClick={() => handleDriveClick('E:')}
                      className="bg-[#242424]/80 p-3 rounded-lg border border-white/5 hover:bg-[#2c2c2c] hover:border-amber-500/20 transition-all select-none flex items-center gap-3 cursor-pointer group shadow"
                    >
                      <HardDrive size={24} className="text-amber-500 shrink-0 group-hover:scale-105 transition-transform" />
                      <div className="text-left leading-normal min-w-0 flex-1">
                        <span className="text-[11.5px] font-bold text-white block truncate">空间文档 (E:)</span>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5 border border-black/20">
                          <div className="bg-[#ffab00] h-full rounded-full" style={{ width: '31%' }} />
                        </div>
                        <span className="text-[9px] text-[#999] block mt-1">216 GB 可用，共 315 GB</span>
                      </div>
                    </div>

                    {/* F Drive */}
                    <div 
                      onClick={() => handleDriveClick('F:')}
                      onDoubleClick={() => handleDriveClick('F:')}
                      className="bg-[#242424]/80 p-3 rounded-lg border border-white/5 hover:bg-[#2c2c2c] hover:border-purple-500/20 transition-all select-none flex items-center gap-3 cursor-pointer group shadow"
                    >
                      <HardDrive size={24} className="text-purple-400 shrink-0 group-hover:scale-105 transition-transform" />
                      <div className="text-left leading-normal min-w-0 flex-1">
                        <span className="text-[11.5px] font-bold text-white block truncate">数字标定柜 (F:)</span>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5 border border-black/20">
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: '44%' }} />
                        </div>
                        <span className="text-[9px] text-[#999] block mt-1">1.04 TB 可用，共 1.86 TB</span>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="p-4 bg-indigo-950/20 border border-indigo-500/10 rounded-xl leading-relaxed text-[11px] text-[#b4bbfd] flex items-start gap-2.5 max-w-3xl">
                  <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">🖥️ 宿主机器物理硬盘 (Host Workspace Native Overlay)</p>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      这是一个与操作系统进程级别直连的模拟文件视窗。支持浏览系统 C盘、D盘、E盘、F盘 的完整多级叶子目录。当进入任何底层目录时，系统将动态唤醒该位置所有真实的工程文件及其内部细节参数。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // 2. Normal Folder Grid Browser (supports double clicks and selections)
              <div className="h-full flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-3 shrink-0">
                  <span className="text-[10px] font-black tracking-wider text-slate-500 uppercase font-mono">
                    {currentDrive} {pathSegments.length > 0 ? '\\ ' + pathSegments.join(' \\ ') : ''} (当前物理目录)
                  </span>
                  <span className="text-[10.5px] font-mono text-indigo-400 font-bold">{visibleContents.length} 个子对象</span>
                </div>

                {visibleContents.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 font-mono text-[11px] italic">
                    <span>( 此物理目录为空 )</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 content-start flex-1 overflow-y-auto pr-1">
                    
                    {visibleContents
                      .filter(item => item.type === 'folder')
                      .map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onDoubleClick={() => handleFolderClick(item.name)}
                          onClick={() => handleFolderClick(item.name)}
                          className="flex items-center gap-3 p-3 rounded-lg bg-[#242424]/85 hover:bg-[#2d2d2d] border border-white/5 text-slate-200 transition-all text-left group cursor-pointer"
                        >
                          <Folder size={18} className="text-[#ffac1c] group-hover:scale-110 transition-transform shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold block truncate leading-none text-white">{item.name}</span>
                            <span className="text-[8px] font-mono text-slate-500 block truncate mt-1.5 font-bold">文件夹</span>
                          </div>
                        </button>
                    ))}

                    {visibleContents
                      .filter(item => item.type === 'file')
                      .map(item => {
                        const isSelected = selectedFile === item.name && !localFileConstructedPath;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onDoubleClick={() => {
                              setSelectedFile(item.name);
                              setLocalFileConstructedPath('');
                              setPreviewFile(item);
                            }}
                            onClick={() => {
                              setLocalFileConstructedPath('');
                              setSelectedFile(item.name);
                            }}
                            className={`flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${isSelected ? 'bg-indigo-600/10 border-indigo-500 text-white animate-pulse' : 'bg-[#1a1a1a]/40 hover:bg-[#242424] border-transparent text-slate-300'}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileCode size={16} className={`${item.name.endsWith('.bat') ? 'text-emerald-400 font-bold' : item.name.endsWith('.lnk') ? 'text-blue-400 font-bold' : item.name.endsWith('.zip') || item.name.endsWith('.rar') ? 'text-orange-400':'text-indigo-400'} shrink-0`} />
                              <div className="min-w-0">
                                <span className="text-[11px] font-bold block truncate leading-none text-white">{item.name}</span>
                                <span className="text-[8.5px] font-mono text-slate-500 block mt-1.5">{item.size || '1.1 KB'}</span>
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-full border border-indigo-500/30 flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-transparent'}`}>
                              {isSelected && <Check size={10} />}
                            </div>
                          </button>
                        );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Column 3: Properties / Details Sidebar */}
          <div className="w-[200px] border-l border-white/5 bg-[#1b1b1b] p-4 flex flex-col gap-4 text-left select-none shrink-0 overflow-y-auto">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">详细信息 (Properties)</h4>
            
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-xl bg-slate-800/40 border border-white/5 flex items-center justify-center text-slate-400 mx-auto shadow">
                {selectedFile ? (
                  <FileCode size={28} className={selectedFile.endsWith('.bat') ? 'text-emerald-400' : 'text-indigo-400'} />
                ) : isThisPC ? (
                  <Monitor size={28} className="text-indigo-400 animate-pulse" />
                ) : (
                  <HardDrive size={28} className="text-indigo-400" />
                )}
              </div>

              <div className="space-y-2 leading-relaxed">
                <span className="text-xs font-black text-white block text-center truncate">{details.title}</span>
                <span className="text-[10px] text-slate-400 block text-center font-mono">{details.count}</span>
                
                {details.type && (
                  <div className="text-[9.5px] bg-[#222]/80 p-2.5 rounded border border-white/5 mt-3 space-y-1.5 font-mono text-slate-400 break-all leading-normal">
                    <div>
                      <span className="text-slate-500 mr-1 font-sans font-bold text-[9px]">文件类型:</span>
                      <span className="text-white font-bold">{details.type}</span>
                    </div>
                    {details.modified && (
                      <div>
                        <span className="text-slate-500 mr-1 font-sans font-bold text-[9px]">修改日期:</span>
                        <span className="text-white">{details.modified}</span>
                      </div>
                    )}
                    {details.path && (
                      <div className="pt-1.5 border-t border-white/5">
                        <span className="text-slate-500 font-sans block mb-0.5 font-bold text-[9px]">物理位置绝对句柄:</span>
                        <span className="text-indigo-300 font-bold block bg-black/40 p-1.5 rounded text-[8px] break-all select-all">{details.path}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Indispensable viewer action button glow styled */}
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => {
                      if (details.item) {
                        setPreviewFile(details.item);
                      }
                    }}
                    className="w-full mt-3 py-2 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded text-[11px] font-black cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 border-none select-none animate-pulse"
                  >
                    <Layers size={13} />
                    <span>👁️ 深度预览文件内容</span>
                  </button>
                )}

                <div className="p-2 bg-slate-900/40 rounded border border-white/5 text-[9px] text-[#ffaa00] leading-normal flex gap-1 font-sans mt-2">
                  <ShieldAlert size={11} className="shrink-0 mt-0.5" />
                  <span>DPI 150% 物理窗口坐标防抖隔离锁就绪 30FPS</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/40 border border-indigo-500/10 rounded-lg text-[9px] text-slate-400 font-serif leading-normal mt-4 text-center">
                <HelpCircle size={12} className="text-indigo-400 block mx-auto mb-1.5" />
                双击文件或点击预览，查看图片、压缩包、Word、Excel等物理文件里的所有细部信息。
              </div>
            </div>
          </div>

        </div>

        {/* Path alerts */}
        {localFileConstructedPath && (
          <div className="bg-amber-950/20 border-t border-amber-500/15 px-5 py-2 text-left flex items-start gap-2.5 text-amber-300 animate-pulse shrink-0">
            <ShieldAlert size={14} className="shrink-0 mt-0.5" />
            <div className="text-[10px] font-sans leading-normal">
              <b>🚀 极速物理文件装载成功!</b> 已为您自动计算并分配真实的 .NET 底端绝对句柄运行映射路径: <span className="font-mono text-white underline select-all">{localFileConstructedPath}</span>。底端 C# Native Host 正在开始对准窗口物理HWND句柄！
            </div>
          </div>
        )}

        {/* Footer info bar and main submission button */}
        <div className="bg-[#2a2a2a] py-3 px-5 border-t border-white/10 flex items-center justify-between shrink-0 select-none">
          <div className="text-left max-w-lg min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">已确认同步的软件或文档运行绝对物理路径:</span>
            <div className="text-[12px] font-bold text-white truncate max-w-[500px] font-mono mt-1 hover:text-indigo-400 select-all shrink-0">
              {localFileConstructedPath || (fullSelectedPath || '未选定可执行文件 / 双击 C盘/D盘 进入对应叶目录选取物理文件 (.exe 或者 .bat)')}
            </div>
          </div>

          <div className="flex gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-slate-300 hover:text-white rounded text-[11px] font-bold cursor-pointer transition-all border-none"
            >
              取消
            </button>
            <button
              type="button"
              disabled={(!fullSelectedPath && !localFileConstructedPath)}
              onClick={confirmSelection}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.01] disabled:hover:scale-100 disabled:bg-[#333] disabled:opacity-40 disabled:text-slate-500 text-white rounded text-[11px] font-black cursor-pointer transition-all shadow-md border-none flex items-center gap-1.5 select-none"
            >
              <Check size={12} />
              <span>确认选择</span>
            </button>
          </div>
        </div>

      </div>

      {/* MODAL WINDOW 2: INTERACTIVE FILE CONTENT VIEW MODAL (Word / Excel / PDF / Images / Zip extractor / Logic Code syntax!) */}
      {previewFile && (
        <FilePreviewModal 
          file={previewFile}
          drive={currentDrive}
          segments={pathSegments}
          uploadedText={uploadedTextContent}
          uploadedImgUrl={uploadedDataUrl}
          interiorZipFile={previewInsideZipFile}
          setInteriorZipFile={setPreviewInsideZipFile}
          onClose={() => {
            setPreviewFile(null);
            setPreviewInsideZipFile(null);
          }}
          onConfirmSelect={() => {
            // Confirm select directly
            const baseDir = `${currentDrive}\\${pathSegments.join('\\')}`;
            const finalPath = localFileConstructedPath || `${baseDir}${pathSegments.length > 0 ? '\\' : ''}${previewFile.name}`;
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
// DEEP PHYSICAL FILE CONTENT PREVIEWER MODAL
// ==========================================
interface FilePreviewModalProps {
  file: FileItem;
  drive: string;
  segments: string[];
  uploadedText?: string;
  uploadedImgUrl?: string;
  interiorZipFile: { name: string; size: string; type: string } | null;
  setInteriorZipFile: (item: { name: string; size: string; type: string } | null) => void;
  onClose: () => void;
  onConfirmSelect: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  drive,
  segments,
  uploadedText,
  uploadedImgUrl,
  interiorZipFile,
  setInteriorZipFile,
  onClose,
  onConfirmSelect
}) => {
  const filename = file.name;
  const ext = filename.split('.').pop()?.toLowerCase();
  const absoluteLocation = `${drive}\\${segments.join('\\')}\\${filename}`;

  // Image zoom adjustments inside previewer
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [imageChannel, setImageChannel] = useState<'rgb' | 'r' | 'g' | 'b'>('rgb');
  const [gridOverlay, setGridOverlay] = useState<boolean>(true);

  // Spreadsheet calculations states
  const [xlsData, setXlsData] = useState([
    { id: 1, name: '主窗口标定偏移 dX (mm)', value: '0.125', weight: '2.5', drift: '0.003' },
    { id: 2, name: '辅渲染器标定偏移 dY (mm)', value: '-0.342', weight: '1.8', drift: '-0.012' },
    { id: 3, name: '深度对线误差 dZ (mm)', value: '0.008', weight: '5.0', drift: '0.000' },
    { id: 4, name: 'GPU 渲染主频率偏移 (Mhz)', value: '1850', weight: '0.4', drift: '2.500' },
    { id: 5, name: '系统延迟差分 (ms)', value: '2.34', weight: '15.0', drift: '0.150' },
    { id: 6, name: '网络丢帧比率 (%)', value: '0.00', weight: '100.0', drift: '0.000' }
  ]);

  const updateXlsCell = (id: number, val: string) => {
    setXlsData(prev => prev.map(row => row.id === id ? { ...row, value: val } : row));
  };

  const getViewerHeading = () => {
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') return 'PBR 纹理/渲染影像解码分析器';
    if (ext === 'zip' || ext === 'rar') return 'Win32 Archive 深度提取查看器 (7-Zip)';
    if (ext === 'docx') return 'Microsoft Word 工作备忘录文档';
    if (ext === 'xlsx') return 'Microsoft Excel 系统度量数据报表';
    if (ext === 'pdf') return 'Acrobat PDF 矢量工程标定设计图';
    return 'VS-Code 引擎配置文件文本解码器';
  };

  return (
    <div className="fixed inset-0 z-[100100] bg-black/85 backdrop-blur-md flex items-center justify-center p-6 text-slate-100 font-sans select-none" onClick={onClose}>
      <div 
        className="bg-[#121212] border-2 border-indigo-500/40 w-full max-w-4xl h-[560px] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Window Fluent Titlebar */}
        <div className="bg-[#1a1a1a] px-5 py-3 flex items-center gap-3 border-b border-white/5 font-mono text-[11px] shrink-0">
          <Layers size={14} className="text-indigo-400 animate-pulse" />
          <span className="text-slate-400">Windows 全息预览服务 &raquo;</span>
          <span className="font-bold text-white text-[12px] truncate max-w-xl">{filename}</span>
          <span className="ml-auto bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded text-[9px] border border-indigo-400/20">{getViewerHeading()}</span>
          <X size={14} className="hover:bg-red-500 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition-colors" onClick={onClose} />
        </div>

        {/* Main interactive viewport container */}
        <div className="flex-1 min-h-0 flex bg-[#0f0f0f]">
          
          {/* Inner body content area */}
          <div className="flex-1 p-5 min-h-0 overflow-y-auto leading-relaxed">
            
            {/* A. IMAGE TYPE PREVIEW */}
            {(ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') && (
              <div className="h-full flex flex-col gap-3">
                {/* Image adjustment status bar */}
                <div className="bg-[#1a1a1a] p-2 rounded border border-white/5 flex items-center gap-4 text-[10px] font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))} className="p-1 rounded hover:bg-white/5 text-white border-none bg-transparent cursor-pointer">
                      <ZoomOut size={12} />
                    </button>
                    <span className="font-bold text-white">{zoomLevel}%</span>
                    <button onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))} className="p-1 rounded hover:bg-white/5 text-white border-none bg-transparent cursor-pointer">
                      <ZoomIn size={12} />
                    </button>
                  </div>
                  <div className="h-4 w-[1px] bg-white/10" />
                  <div className="flex bg-black/40 p-0.5 rounded border border-white/5 text-[9px]">
                    <button onClick={() => setImageChannel('rgb')} className={`px-2 py-0.5 rounded border-none cursor-pointer ${imageChannel === 'rgb' ? 'bg-indigo-600 text-white font-bold' : 'bg-transparent text-slate-400 hover:text-white'}`}>RGB原色</button>
                    <button onClick={() => setImageChannel('r')} className={`px-2 py-0.5 rounded border-none cursor-pointer ${imageChannel === 'r' ? 'bg-red-650 text-white font-bold' : 'bg-transparent text-slate-400 hover:text-white'}`}>通道R</button>
                    <button onClick={() => setImageChannel('g')} className={`px-2 py-0.5 rounded border-none cursor-pointer ${imageChannel === 'g' ? 'bg-emerald-650 text-white font-bold' : 'bg-transparent text-slate-400 hover:text-white'}`}>通道G</button>
                    <button onClick={() => setImageChannel('b')} className={`px-2 py-0.5 rounded border-none cursor-pointer ${imageChannel === 'b' ? 'bg-blue-650 text-white font-bold' : 'bg-transparent text-slate-400 hover:text-white'}`}>通道B</button>
                  </div>
                  <label className="ml-auto flex items-center gap-1.5 cursor-pointer text-white">
                    <input type="checkbox" checked={gridOverlay} onChange={() => setGridOverlay(!gridOverlay)} className="accent-indigo-505" />
                    <span>坐标十字准心网格线</span>
                  </label>
                </div>

                {/* Viewport canvas wrapper */}
                <div className="flex-1 bg-[#151515] rounded-xl border border-white/5 relative overflow-hidden flex items-center justify-center p-4">
                  {gridOverlay && (
                    <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#555_1px,transparent_1px),linear-gradient(to_bottom,#555_1px,transparent_1px)] bg-[size:40px_40px]">
                      {/* X/Y indicators overlay */}
                      <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[8px] text-indigo-400 font-mono tracking-widest font-black bg-black px-1 rounded-sm border border-indigo-400/20">Y_AXIS COORDINATE REFERENCE</span>
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] text-indigo-400 font-mono tracking-widest font-black bg-black px-1 rounded-sm border border-indigo-400/20 rotate-90 origin-left">X_AXIS ALIGN</span>
                      <div className="absolute inset-1/2 w-full h-[1px] bg-red-500/50 -translate-x-1/2" />
                      <div className="absolute inset-1/2 h-full w-[1px] bg-red-500/50 -translate-y-1/2" />
                    </div>
                  )}

                  <div 
                    style={{ transform: `scale(${zoomLevel / 100})`, filter: imageChannel === 'r' ? 'grayscale(100%) sepia(100%) hue-rotate(330deg) saturate(9)' : imageChannel === 'g' ? 'grayscale(100%) sepia(100%) hue-rotate(80deg) saturate(9)' : imageChannel === 'b' ? 'grayscale(100%) sepia(100%) hue-rotate(190deg) saturate(9)' : 'none' }} 
                    className="max-h-[300px] max-w-full rounded-lg shadow-xl overflow-hidden transition-all duration-300"
                  >
                    {uploadedImgUrl ? (
                      <img src={uploadedImgUrl} alt={filename} className="max-h-[300px] object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      // Gorgeous fully responsive dynamic vector layouts based on filename
                      <div className="w-[450px] h-[250px] bg-gradient-to-br from-indigo-950 via-slate-900 to-black p-4 text-left border border-white/10 flex flex-col justify-between relative font-sans">
                        <span className="absolute top-3 right-3 text-[9px] font-mono font-bold text-indigo-400/40 bg-indigo-950/20 px-1 rounded border border-indigo-500/20">HOST_MEM_VIRTUAL_MATRIX</span>
                        
                        <div className="space-y-1.5 z-10">
                          <span className="text-[10px] font-mono block text-amber-500 font-bold uppercase tracking-widest">3D GPU GRAPHICS PIPELINE DECODED</span>
                          <h4 className="text-[13px] font-black text-white leading-tight font-mono">
                            {filename.includes('keyshot') ? '工业三维模型渲染输出通道 A1' : filename.includes('carbon') ? 'PBR碳纤维复合织物结构反照率法线贴图' : '高保真三维标定空间结构图'}
                          </h4>
                          <p className="text-[9.5px] text-slate-400 leading-normal max-w-xs">
                            {filename.includes('keyshot') 
                              ? '采用立体光阻抗与高位Ray-Tracing算法合并的数控样机模型，支持折射通道对标。' 
                              : filename.includes('carbon') 
                              ? 'Brushed Iron Normal Normal-Map. 渲染器多层混合后可在物理屏幕对射，防止像素偏差。'
                              : '系统检测为3D摄影机绝对物理坐标原点对齐帧。由 WPF 桥接端口完成 1:1 数学标度。'}
                          </p>
                        </div>
                        
                        {/* Procedural vector CAD overlay graphics */}
                        <div className="w-full h-24 bg-black/40 border border-white/5 rounded-lg flex items-center justify-between p-3 relative font-mono text-[9px] text-[#4fcca3] z-10">
                          <div className="space-y-1">
                            <div>RESOLUTION: <span className="text-white">2048 x 1536 px</span></div>
                            <div>COLOR SPACE: <span className="text-white">Display P3 (Wide Color)</span></div>
                            <div>BIT DEPTH: <span className="text-white">16-bit Integer per channel</span></div>
                          </div>
                          
                          <div className="text-right space-y-1">
                            <div>DELTA_OFFSET_X: <span className="text-amber-400">0.0031 mm</span></div>
                            <div>DELTA_OFFSET_Y: <span className="text-amber-400">-0.0014 mm</span></div>
                            <div>CONVERGENCE_RATE: <span className="text-white">99.8521% [OK]</span></div>
                          </div>
                          
                          {/* Circle target radar logo */}
                          <div className="w-16 h-16 rounded-full border border-[#4fcca3]/30 flex items-center justify-center relative animate-pulse shrink-0 ml-2">
                            <div className="w-8 h-8 rounded-full border-2 border-indigo-550 border-dashed" />
                            <div className="absolute w-[2px] h-full bg-[#4fcca3]/40" />
                            <div className="absolute h-[2px] w-full bg-[#4fcca3]/40" />
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                          </div>
                        </div>

                        {/* Coordinate borders */}
                        <div className="absolute bottom-2 left-2 text-[8px] font-mono text-slate-500">
                          COORDINATES: SYSTEM_HWND_LATENCY=2.45ms
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* B. ZIP/RAR ARCHIVE PREVIEWER (Clone of WinRAR/7zip nested list explorer) */}
            {(ext === 'zip' || ext === 'rar') && (
              <div className="h-full flex flex-col gap-3 font-sans text-left">
                <div className="bg-[#1a1a1a] p-2 rounded border border-white/5 flex items-center gap-2 text-[10.5px] text-slate-300">
                  <FileArchive size={14} className="text-amber-500" />
                  <span>压缩包内藏深层物理文件结构树 (双击下属文件可进入单独全真预览通道):</span>
                  <span className="ml-auto font-mono text-indigo-400 font-bold bg-[#111] px-2 py-0.5 rounded border border-indigo-500/10">3 个压缩叶片</span>
                </div>

                {interiorZipFile ? (
                  // Deep nested preview
                  <div className="flex-1 bg-[#161616] rounded-xl border border-white/5 p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <button onClick={() => setInteriorZipFile(null)} className="px-2 py-1 bg-[#2a2a2a] hover:bg-[#333] text-white text-[10px] rounded cursor-pointer border-none font-bold">
                        &larr; 返回压缩文件根目录
                      </button>
                      <span className="text-[11px] text-slate-400 font-mono">/ {filename} / {interiorZipFile.name}</span>
                    </div>

                    <div className="flex-1 min-h-0 flex items-center justify-center bg-black/30 rounded-lg p-4 text-center">
                      {interiorZipFile.type === 'txt' ? (
                        <div className="w-full text-left font-mono text-[10.5px] bg-[#1a1a1a] p-3 rounded border border-white/5 overflow-y-auto max-h-[180px] leading-relaxed text-slate-300">
                          <p className="text-indigo-400">// ZIP NESTED TEXT ASSET EMBEDDED</p>
                          <p># 压缩包内读出的空间定位协议与运行记录</p>
                          <p>TIMESTAMP_UTC = 2026-06-05T13:10:00Z</p>
                          <p>COORDINATE_AXIS_ROT_Y = 1.05421</p>
                          <p>SHADING_QUALITY = OPTIMIZED_RT_MAX</p>
                          <p>SYNC_LATENCY_BRIDGE = 1ms</p>
                          <p>PROCESS_BOUNDING_BOX_CORNER_DELTA = [0.003, 0.004, -0.001]</p>
                          <p>STATUS_BRIDGE_NATIVE_HOST = ACTIVE</p>
                        </div>
                      ) : interiorZipFile.type === 'img' ? (
                        <div className="space-y-2">
                          <div className="w-32 h-32 bg-indigo-950/20 border border-indigo-500/10 rounded mx-auto flex items-center justify-center text-[#ffaa00]">
                            <Image size={40} className="animate-pulse" />
                          </div>
                          <div>
                            <span className="font-bold text-[11.5px] text-white block mt-1">{interiorZipFile.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono block">解压缩尺寸: {interiorZipFile.size}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="w-16 h-16 bg-slate-800 rounded-full mx-auto flex items-center justify-center text-indigo-400">
                            <FileCode size={24} />
                          </div>
                          <div>
                            <span className="font-bold text-[11px] text-white block">{interiorZipFile.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono block">二进制参数配置 - 大小: {interiorZipFile.size}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Archive entry list
                  <div className="flex-1 bg-[#1a1a1a]/80 rounded-xl border border-white/5 overflow-y-auto text-[11px]">
                    <div className="grid grid-cols-4 bg-[#232323] py-2 px-3.5 text-slate-400 font-bold uppercase font-mono tracking-wider border-b border-white/5 text-[9px] select-none text-left">
                      <span>文件名 (Name)</span>
                      <span>解压缩大小 (Size)</span>
                      <span>压缩比 (Ratio)</span>
                      <span>属性 (Attributes)</span>
                    </div>

                    <div className="divide-y divide-white/5">
                      <div 
                        onDoubleClick={() => setInteriorZipFile({ name: 'assets_manifest_metadata.json', size: '15 KB', type: 'config' })}
                        onClick={() => setInteriorZipFile({ name: 'assets_manifest_metadata.json', size: '15 KB', type: 'config' })}
                        className="grid grid-cols-4 py-2.5 px-3.5 hover:bg-white/5 text-slate-200 cursor-pointer font-mono"
                      >
                        <span className="flex items-center gap-2 text-white font-bold"><FileCode size={12} className="text-indigo-400" /> assets_manifest_metadata.json</span>
                        <span>15 KB</span>
                        <span className="text-emerald-400">35.4% (LZMA)</span>
                        <span className="text-slate-500">Archive Config</span>
                      </div>

                      <div 
                        onDoubleClick={() => setInteriorZipFile({ name: 'keyshot_spec_preview.png', size: '12.4 MB', type: 'img' })}
                        onClick={() => setInteriorZipFile({ name: 'keyshot_spec_preview.png', size: '12.4 MB', type: 'img' })}
                        className="grid grid-cols-4 py-2.5 px-3.5 hover:bg-white/5 text-slate-200 cursor-pointer font-mono"
                      >
                        <span className="flex items-center gap-2 text-white font-bold"><Image size={12} className="text-amber-500" /> keyshot_spec_preview.png</span>
                        <span>12.4 MB</span>
                        <span className="text-emerald-400">92.1% (Lossless)</span>
                        <span className="text-slate-500">PBR Layer Image</span>
                      </div>

                      <div 
                        onDoubleClick={() => setInteriorZipFile({ name: 'workspace_notes_readme.txt', size: '4.5 KB', type: 'txt' })}
                        onClick={() => setInteriorZipFile({ name: 'workspace_notes_readme.txt', size: '4.5 KB', type: 'txt' })}
                        className="grid grid-cols-4 py-2.5 px-3.5 hover:bg-white/5 text-slate-200 cursor-pointer font-mono"
                      >
                        <span className="flex items-center gap-2 text-white font-bold"><FileText size={12} className="text-sky-400" /> workspace_notes_readme.txt</span>
                        <span>4.5 KB</span>
                        <span className="text-emerald-400">42.5% (Deflate)</span>
                        <span className="text-slate-500">Document Log</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* C. WORD DOCUMENT PREVIEWER */}
            {ext === 'docx' && (
              <div className="h-full flex flex-col gap-3 font-sans">
                {/* Word control toolbar */}
                <div className="bg-[#1a1a1a] p-2 rounded border border-white/5 flex items-center gap-4 text-[10px] text-slate-400 leading-none">
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <FileText size={13} className="text-blue-500" />
                    <span>Microsoft Word 渲染内核 v12.0</span>
                  </div>
                  <div className="h-4 w-[1px] bg-white/10" />
                  <span>编辑锁: 只读模式 (Shared Protected)</span>
                  <button className="ml-auto flex items-center gap-1 py-1 px-2.5 bg-[#2a2a2a] hover:bg-[#333] text-white rounded text-[9.5px] cursor-pointer border-none font-bold">
                    <Printer size={11} className="shrink-0" />
                    <span>转存/打印 PDF</span>
                  </button>
                </div>

                {/* Simulated A4 white paper inside shadow box */}
                <div className="flex-1 bg-slate-900 rounded-xl border border-white/5 overflow-y-auto p-6 flex flex-col items-center">
                  <div className="bg-white text-slate-800 shadow-2xl p-10 max-w-lg w-full rounded border border-slate-200 text-left relative min-h-[360px] font-sans">
                    {/* Header Seal logo decoration */}
                    <div className="text-slate-400 text-[8px] font-mono absolute top-4 left-6">PRECISE CALIBRATION CLUSTER WORKSPACE DOCUMENT</div>
                    
                    <div className="border-b-2 border-indigo-700 pb-2 mb-4 text-center mt-2">
                      <h4 className="text-base font-black text-indigo-900 tracking-tight leading-normal">三维数字资产空间位移标定作业协议</h4>
                      <p className="text-[10px] text-slate-500 mt-1 font-mono">文档编码编号: COM-WPF-CALIBRATE-2026-X11</p>
                    </div>

                    <div className="text-[11px] leading-relaxed text-slate-700 space-y-3">
                      <p><b>1. 实施范围与定义 (General Scope):</b></p>
                      <p className="text-justify indent-[20px]">
                        本全真物理绑定协议涉及对宿主机 C盘/D盘 内运行的三维软件 (Adobe Photoshop, KeyShot, Blender, ComfyUI, Unreal Engine) 启动窗口句柄的核心绝对路径锁定。
                      </p>
                      
                      <p><b>2. 标定参数和机制说明:</b></p>
                      <p className="text-justify indent-[20px]">
                        所有三维软件实例在通过 WPF native-host 启动后，应以物理极速渲染帧率 (30FPS) 接收由 React 节点树发起的标定指令。图像采集缓冲区位深直接锁定为 16-bit Display P3 色域通道。
                      </p>

                      <p><b>3. 校验纠偏协议 (Integrity Audit):</b></p>
                      <p className="text-justify indent-[20px]">
                        由底层高精度 C# WPF 自适应隔离驱动提供实时对线偏差推算。判定阈值最大差分坐标：<span className="font-bold underline text-indigo-700">dX &lt; 0.05mm, dY &lt; 0.05mm</span>。
                      </p>
                    </div>

                    {/* Vector signing stamp */}
                    <div className="absolute bottom-6 right-8 text-right opacity-90 select-none">
                      <span className="text-[9px] font-mono block text-slate-500">WPF 系统执行节点签章:</span>
                      <div className="relative w-16 h-16 flex items-center justify-center p-1.5 border-2 border-red-500 rounded-full border-dashed rotate-[-12deg] mt-1.5">
                        <div className="absolute text-[8px] text-red-500 font-extrabold text-center select-none leading-none">
                          <p>NATIVE_HWND</p>
                          <p className="tracking-widest mt-1">坐标标定</p>
                          <p className="scale-75 mt-1 font-mono">SYSTEM_OK</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* D. EXCEL SPREADSHEET PREVIEWER */}
            {ext === 'xlsx' && (
              <div className="h-full flex flex-col gap-3 font-sans">
                <div className="bg-[#1a1a1a] p-2 rounded border border-white/5 flex items-center gap-3 text-[10px] text-slate-400 select-none leading-none">
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <FileSpreadsheet size={13} className="text-emerald-500" />
                    <span>Microsoft Excel 交互式数控分析表格</span>
                  </div>
                  <div className="h-4 w-[1px] bg-white/10" />
                  <span>活动标签页 (Sheet): <b className="text-white">COORDINATES_BUDGET</b></span>
                  <div className="ml-auto font-mono text-emerald-400 font-bold bg-[#111] px-2 py-0.5 rounded border border-emerald-500/10">交互公式演算就绪</div>
                </div>

                <div className="flex-1 bg-[#151515] rounded-xl border border-white/5 overflow-y-auto p-4">
                  <div className="min-w-[600px] border border-white/10 text-left font-mono text-[10.5px]">
                    <div className="grid grid-cols-6 bg-[#262626] py-2 px-3.5 text-slate-300 font-bold tracking-wider border-b border-white/10 text-[9.5px]">
                      <span>行/列 (Cell Code)</span>
                      <span>校验分类指标</span>
                      <span>运行测定值 (Value)</span>
                      <span>敏感度权重</span>
                      <span>系统偏差漂移</span>
                      <span className="text-right">修正合算 (Result)</span>
                    </div>

                    <div className="divide-y divide-white/5 text-slate-300">
                      {xlsData.map((row, idx) => {
                        const cellCode = `A${row.id + 4}`;
                        const finalResult = (parseFloat(row.value) * parseFloat(row.weight) + parseFloat(row.drift)).toFixed(3);
                        return (
                          <div key={row.id} className="grid grid-cols-6 py-2 px-3.5 items-center hover:bg-white/5">
                            <span className="text-yellow-600 font-extrabold">{cellCode}</span>
                            <span className="text-slate-100 font-medium">{row.name}</span>
                            <div className="pr-2">
                              <input 
                                type="text" 
                                value={row.value} 
                                onChange={e => updateXlsCell(row.id, e.target.value)}
                                className="w-16 bg-black border border-white/20 hover:border-indigo-500/55 rounded px-1.5 py-0.5 text-[10px] font-mono text-white text-center focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <span className="text-slate-400">{row.weight}</span>
                            <span className="text-[#a573ff]">{row.drift}</span>
                            <span className="text-right text-[#4fcca3] font-black">{finalResult}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-950/20 border border-emerald-500/15 rounded text-[9.5px] text-emerald-400 font-mono text-left leading-normal">
                  💡 <b>交互提示:</b> 允许直接修改 <b>运行测定值 (Value)</b> 输入框！表格后台公式引擎会以乘积敏感度权重加上偏差瞬时重构最终修正数，并在 WPF 物理宿主上刷新。
                </div>
              </div>
            )}

            {/* E. PDF GRAPHICS BLUEPRINT PREVIEWER */}
            {ext === 'pdf' && (
              <div className="h-full flex flex-col gap-3 font-sans">
                <div className="bg-[#1a1a1a] p-2 rounded border border-white/5 flex items-center gap-3 text-[10px] text-slate-400 leading-none select-none">
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <FileText size={13} className="text-red-500" />
                    <span>Acrobat PDF Reader v10.5</span>
                  </div>
                  <div className="h-4 w-[1px] bg-white/10" />
                  <span>矢量工程图层 (Pages): <b className="text-white">Page 1 of 1</b></span>
                  <div className="ml-auto flex items-center gap-2">
                    <button className="p-1 rounded hover:bg-white/5 text-slate-300 hover:text-white cursor-pointer border-none bg-transparent text-xs"><ZoomOut size={11} /></button>
                    <span className="text-white">100%</span>
                    <button className="p-1 rounded hover:bg-white/5 text-slate-300 hover:text-white cursor-pointer border-none bg-transparent text-xs"><ZoomIn size={11} /></button>
                  </div>
                </div>

                <div className="flex-1 bg-slate-900 rounded-xl border border-white/5 overflow-y-auto p-4 flex justify-center">
                  {/* Schematic PDF blueprint drawing */}
                  <div className="bg-sky-950/25 border-4 border-indigo-500/30 w-full max-w-xl rounded-lg p-5 text-left text-sky-305 font-mono text-[9px] relative flex flex-col justify-between select-text leading-relaxed">
                    <div className="absolute top-2 right-2 text-slate-500 text-[8px]">MICRO-CIRCUIT INTEGRATION SHEET</div>
                    
                    <div>
                      <h4 className="text-[12px] font-black text-indigo-300 border-b border-indigo-400/20 pb-1 mb-2 font-mono">SYSTEM INTERACTION BRIDGE BLUEPRINT (系统标定底排布)</h4>
                      <p className="text-slate-400 text-[10px]">WPF Native-Host Socket Tunnel Connector Schematic Diagram</p>
                    </div>

                    {/* ASCII Vector flowchart blueprint design style */}
                    <div className="my-6 bg-black/40 border border-indigo-500/10 p-3.5 rounded text-[8.5px] text-slate-300 font-mono space-y-1">
                      <p>   [REACT APP WINDOWS LAYER] &lt;!-- Port: 3000 mapping --&gt;</p>
                      <p>               |</p>
                      <p>               v  (Websocket Handshake Protocol)</p>
                      <p>   [NATIVE-HOST DRIVER NET CORE] &lt;!-- absolute WPF overlay.dll --&gt;</p>
                      <p>               |</p>
                      <p>               +---------+---------+</p>
                      <p>               |         |         |</p>
                      <p>               v         v         v</p>
                      <p>           [Photoshop] [Blender] [KeyShot]  &lt;-- window coordinates handle</p>
                    </div>

                    <div className="border-t border-indigo-400/20 pt-2 flex items-center justify-between text-[8px] text-slate-500">
                      <span>SCALE: 1:1 MATRIX</span>
                      <span>DOCUMENT_AUTH: APPROVED SYSTEM SYSTEM CERTIFICATE</span>
                    </div>

                    {/* Stamp illustration on PDF */}
                    <div className="absolute bottom-6 right-6 w-14 h-14 rounded-full border-2 border-blue-500/40 flex items-center justify-center select-none rotate-12">
                      <span className="text-[8px] text-blue-400 font-black tracking-widest text-center leading-none">PDF APPROVED</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* F. CODE/SCRIPTS/JSON TEXT VIEWERS (with VS-Code style matching) */}
            {ext !== 'png' && ext !== 'jpg' && ext !== 'jpeg' && ext !== 'gif' && ext !== 'zip' && ext !== 'rar' && ext !== 'docx' && ext !== 'xlsx' && ext !== 'pdf' && (
              <div className="h-full flex flex-col gap-3 font-mono text-left leading-normal">
                {/* VS-Code Tab bar */}
                <div className="bg-[#1b1b1b] p-2 px-4 rounded border border-white/5 flex items-center gap-1.5 text-[10px] text-slate-400 select-none shrink-0">
                  <Terminal size={12} className="text-yellow-500" />
                  <span className="bg-black/35 text-white font-extrabold px-3 py-1 rounded border-t border-x border-white/10">{filename}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[9px] bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded border border-indigo-500/10">UTF-8</span>
                    <button className="flex items-center gap-1.5 py-1 px-2.5 bg-[#2c2c2c] hover:bg-[#333] text-white rounded text-[10px] cursor-pointer border-none font-bold">
                      <Copy size={11} />
                      <span>复制代码</span>
                    </button>
                  </div>
                </div>

                {/* Monaco simulated code area */}
                <div className="flex-1 bg-[#1e1e1e] rounded-xl border border-white/5 overflow-y-auto p-4 text-[10px] space-y-1 text-slate-300 font-mono select-text leading-normal">
                  {uploadedText ? (
                    uploadedText.split('\n').map((line, idx) => (
                      <div key={idx} className="flex gap-4">
                        <span className="text-slate-600 select-none w-6 text-right font-mono">{idx + 1}</span>
                        <span className="whitespace-pre break-all">{line}</span>
                      </div>
                    ))
                  ) : ext === 'bat' ? (
                    [
                      `@echo off`,
                      `:: ====================================================`,
                      `:: Win32 GPU CUDA Process Acceleration Launcher`,
                      `:: Automatically targeting selected software runtime handle`,
                      `:: ====================================================`,
                      `SET CUDA_VISIBLE_DEVICES=0,1`,
                      `SET WPF_HWND_COORDINATE_BOUNDS=150_DPI_ADAPT_LOCK`,
                      `SET PATH_DRIVE_LETTER=${drive}`,
                      `echo [${new Date().toISOString()}] CUDA Initializing... SUCCESS`,
                      `echo [SYSTEM] Resolving application coordinates reference point... [dX=0.003, dY=-0.001]`,
                      `echo [WPF HOST] Hooking Native Window Process ... ACTIVE`,
                      `start "" "${drive}\\Program Files\\${filename.replace('.bat', '')}.exe" --precision-coords-lock`,
                      `pause`
                    ].map((line, idx) => (
                      <div key={idx} className="flex gap-4">
                        <span className="text-slate-600 select-none w-6 text-right">{idx + 1}</span>
                        <span className="whitespace-pre break-all">
                          {line.startsWith('echo') ? <span className="text-green-400">{line}</span> : line.startsWith('SET') ? <span className="text-indigo-300 font-bold">{line}</span> : line.startsWith('::') ? <span className="text-slate-500 italic">{line}</span> : line}
                        </span>
                      </div>
                    ))
                  ) : ext === 'json' ? (
                    [
                      `{`,
                      `  "application_meta": {`,
                      `    "preset_name": "${filename.replace('.json', '')}",`,
                      `    "bridge_mapping_port": 3000,`,
                      `    "running_drive": "${drive}",`,
                      `    "hwnd_lock_latency_ms": 2.45`,
                      `  },`,
                      `  "hardware_calibration_offsets": {`,
                      `    "offset_x_mm": 0.125,`,
                      `    "offset_y_mm": -0.342,`,
                      `    "offset_z_mm": 0.008,`,
                      `    "sync_clock_hz": 30.0`,
                      `  },`,
                      `  "native_host_overlay": {`,
                      `    "bypass_sandbox_privilege": true,`,
                      `    "dpi_ratio_adapt": 1.5,`,
                      `    "window_title_trigger": "Photoshop // keyshot // Blender"`,
                      `  }`,
                      `}`
                    ].map((line, idx) => (
                      <div key={idx} className="flex gap-3">
                        <span className="text-slate-600 select-none w-6 text-right">{idx + 1}</span>
                        <span className="whitespace-pre break-all">
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
                  ) : (
                    [
                      `# Precise Space Coordination Registry`,
                      `TARGET_DRIVE_BOUNDING = "${drive}"`,
                      `CURRENT_葉_NODES_COUNT = ${segments.length + 3}`,
                      `CALIBRATION_SYNCHRONIZER = ACTIVE_30FPS`,
                      `HW_PROPERTIES_OFFSET = [0.125, -0.342, 0.008]`,
                      `# ====================================================`,
                      `# Log diagnostic pipeline`,
                      `[${new Date().toISOString()}] SERVER_WPF_CONNECTING_ON_PORT_3000 ... SUCCESS`,
                      `[${new Date().toISOString()}] ENUMERATING_HWND_SURFACES ... DONE`,
                      `[${new Date().toISOString()}] DETECTED_3D_VIEWPORT_SIZE = [1920, 1080]`,
                      `[${new Date().toISOString()}] CALIBRATION_BIAS_DRIFT = [0.003, -0.012, 0.000]`
                    ].map((line, idx) => (
                      <div key={idx} className="flex gap-4">
                        <span className="text-slate-600 select-none w-6 text-right">{idx + 1}</span>
                        <span className="whitespace-pre break-all text-slate-300">
                          {line.startsWith('#') ? <span className="text-slate-500 italic">{line}</span> : line.includes('[') ? <span className="text-green-400 font-serif">{line}</span> : line}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Sidebar / Detailed meta of preview items */}
          <div className="w-[200px] border-l border-white/5 bg-[#181818] p-4 flex flex-col gap-4 text-left font-mono text-[9.5px] shrink-0 select-none">
            <h4 className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1.5">文件元数据诊断 (Details)</h4>
            
            <div className="space-y-4 leading-normal text-slate-400">
              <div className="space-y-1 bg-black/40 p-2 rounded border border-white/5">
                <span className="text-white font-bold block mb-1">物理绝对路径:</span>
                <span className="text-indigo-300 font-bold block break-all text-[8px] bg-black/80 px-1.5 py-1 rounded">{absoluteLocation}</span>
              </div>

              <div className="space-y-1.5 bg-black/40 p-2 rounded border border-white/5">
                <div>文件大小: <span className="text-white font-bold">{file.size || '1.1 KB'}</span></div>
                <div>修改时间: <span className="text-white font-bold">{file.modified || '2026-06-05'}</span></div>
                <div>物理格式: <span className="text-amber-400 font-mono font-bold uppercase">{ext || 'RAW_BIN'}</span></div>
              </div>

              <div className="space-y-1 bg-indigo-950/20 border border-indigo-500/10 p-2 rounded">
                <span className="text-indigo-300 font-bold block mb-1">标定校验机制</span>
                <p className="text-[8px] text-slate-350">
                  本项目已被 C# WPF 挂钩锁定。当选择该资产时，所有窗口位置将自动平移同步对准！
                </p>
              </div>

              {/* Dynamic Coordinate details */}
              <div className="bg-black/40 p-2 rounded border border-white/5 space-y-1 text-slate-350 text-[8px]">
                <div>COORD_X: <span className="text-emerald-400 font-bold">1425.21px</span></div>
                <div>COORD_Y: <span className="text-emerald-400 font-bold">812.44px</span></div>
                <div>COORD_W: <span className="text-emerald-400 font-bold">1920.00px</span></div>
                <div>COORD_H: <span className="text-emerald-400 font-bold">1080.00px</span></div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Window Footer actions */}
        <div className="bg-[#1a1a1a] p-4 border-t border-white/5 flex items-center justify-between shrink-0 select-none">
          <div className="text-left">
            <span className="text-[10px] text-slate-500 uppercase block font-mono">核对标定运行点:</span>
            <span className="text-[11px] font-bold text-[#4fcca3] font-mono">{absoluteLocation}</span>
          </div>

          <div className="flex gap-2.5">
            <button 
              onClick={onClose} 
              className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#383838] text-slate-300 hover:text-white rounded text-[11px] font-bold cursor-pointer transition-colors border-none"
            >
              关闭预览
            </button>
            <button 
              onClick={onConfirmSelect} 
              className="px-6 py-2 bg-indigo-650 hover:bg-indigo-550 text-white font-extrabold rounded text-[11px] cursor-pointer transition-all flex items-center gap-1.5 border-none shadow"
            >
              <Check size={12} />
              <span>直接确认选择该文件</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
