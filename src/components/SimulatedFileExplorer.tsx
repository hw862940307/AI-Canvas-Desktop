import React, { useState, useEffect } from 'react';
import { 
  Folder, FileCode, FolderOpen, HardDrive, Search, 
  ArrowLeft, Home, Upload, Info, Check, X, ShieldAlert
} from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
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

// Full virtual Windows folder mapping mimicking actual installer directories
const MOCK_FS: Record<string, FileItem[]> = {
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
                { id: 'c_pf_adobe_ps_exe', name: 'Photoshop.exe', type: 'file' },
                { id: 'c_pf_adobe_ps_dll', name: 'amtlib.dll', type: 'file' }
              ]
            },
            {
              id: 'c_pf_adobe_sub_p',
              name: 'Adobe Substance 3D Painter',
              type: 'folder',
              children: [
                { id: 'c_pf_adobe_sub_p_exe', name: 'Adobe Substance 3D Painter.exe', type: 'file' }
              ]
            },
            {
              id: 'c_pf_adobe_sub_d',
              name: 'Adobe Substance 3D Designer',
              type: 'folder',
              children: [
                { id: 'c_pf_adobe_sub_d_exe', name: 'Adobe Substance 3D Designer.exe', type: 'file' }
              ]
            }
          ]
        },
        {
          id: 'c_pf_autodesk',
          name: 'Autodesk',
          type: 'folder',
          children: [
            {
              id: 'c_pf_autodesk_maya',
              name: 'Maya2024',
              type: 'folder',
              children: [
                {
                  id: 'c_pf_autodesk_maya_bin',
                  name: 'bin',
                  type: 'folder',
                  children: [
                    { id: 'c_pf_autodesk_maya_exe', name: 'maya.exe', type: 'file' },
                    { id: 'c_pf_autodesk_maya_py', name: 'mayapy.exe', type: 'file' }
                  ]
                }
              ]
            },
            {
              id: 'c_pf_autodesk_3ds',
              name: '3ds Max 2024',
              type: 'folder',
              children: [
                { id: 'c_pf_autodesk_3ds_exe', name: '3dsmax.exe', type: 'file' }
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
                { id: 'c_pf_blender_exe', name: 'blender.exe', type: 'file' },
                { id: 'c_pf_blender_launcher_exe', name: 'blender-launcher.exe', type: 'file' }
              ]
            }
          ]
        },
        {
          id: 'c_pf_epic',
          name: 'Epic Games',
          type: 'folder',
          children: [
            {
              id: 'c_pf_epic_ue5',
              name: 'UE_5.3',
              type: 'folder',
              children: [
                {
                  id: 'c_pf_epic_ue5_eng',
                  name: 'Engine',
                  type: 'folder',
                  children: [
                    {
                      id: 'c_pf_epic_ue5_bin',
                      name: 'Binaries',
                      type: 'folder',
                      children: [
                        {
                          id: 'c_pf_epic_ue5_w64',
                          name: 'Win64',
                          type: 'folder',
                          children: [
                            { id: 'c_pf_epic_ue5_exe', name: 'UnrealEditor.exe', type: 'file' }
                          ]
                        }
                      ]
                    }
                  ]
                }
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
                { id: 'c_pf_keyshot_exe', name: 'keyshot.exe', type: 'file' }
              ]
            }
          ]
        },
        {
          id: 'c_pf_marvelous',
          name: 'Marvelous Designer',
          type: 'folder',
          children: [
            { id: 'c_pf_marvelous_exe', name: 'MarvelousDesigner.exe', type: 'file' }
          ]
        },
        {
          id: 'c_pf_zbrush',
          name: 'Maxon ZBrush 2024',
          type: 'folder',
          children: [
            { id: 'c_pf_zbrush_exe', name: 'ZBrush.exe', type: 'file' }
          ]
        },
        {
          id: 'c_pf_sidefx',
          name: 'Side Effects Software',
          type: 'folder',
          children: [
            {
              id: 'c_pf_sidefx_houdini',
              name: 'Houdini 20.0',
              type: 'folder',
              children: [
                {
                  id: 'c_pf_sidefx_houdini_bin',
                  name: 'bin',
                  type: 'folder',
                  children: [
                    { id: 'c_pf_sidefx_houdini_exe', name: 'houdini.exe', type: 'file' }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: 'c_pf_reality',
          name: 'Capturing Reality',
          type: 'folder',
          children: [
            {
              id: 'c_pf_reality_rc',
              name: 'RealityCapture',
              type: 'folder',
              children: [
                { id: 'c_pf_reality_rc_exe', name: 'RealityCapture.exe', type: 'file' }
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
              id: 'c_users_admin_appdata',
              name: 'AppData',
              type: 'folder',
              children: [
                {
                  id: 'c_users_admin_appdata_local',
                  name: 'Local',
                  type: 'folder',
                  children: [
                    {
                      id: 'c_users_admin_appdata_local_programs',
                      name: 'Programs',
                      type: 'folder',
                      children: [
                        {
                          id: 'c_users_admin_appdata_local_programs_vscode',
                          name: 'Microsoft VS Code',
                          type: 'folder',
                          children: [
                            { id: 'c_users_admin_appdata_local_programs_vscode_exe', name: 'Code.exe', type: 'file' }
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
            { id: 'd_ai_comfyui_gpu', name: 'run_nvidia_gpu.bat', type: 'file' },
            { id: 'd_ai_comfyui_cpu', name: 'run_cpu.bat', type: 'file' }
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

  // Track the current drive and current folder path list
  const [currentDrive, setCurrentDrive] = useState<'C:' | 'D:'>('C:');
  const [pathSegments, setPathSegments] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Local physical file input fallback states
  const [localFileName, setLocalFileName] = useState<string>('');
  const [localFileConstructedPath, setLocalFileConstructedPath] = useState<string>('');

  // Automatically expand files matched to the preset
  useEffect(() => {
    // If we have an existing absolute path, try to pre-populate current folder
    if (initialPath) {
      const driveMatch = initialPath.match(/^([A-Za-z]):\\/);
      if (driveMatch) {
        const drive = (driveMatch[1].toUpperCase() + ':') as 'C:' | 'D:';
        setCurrentDrive(drive);
        
        // Break up path, filter empties
        const segments = initialPath
          .replace(/^([A-Za-z]):\\/, '')
          .split('\\')
          .filter(s => s && !s.includes('.exe') && !s.includes('.bat'));
        
        setPathSegments(segments);
        
        const filePart = initialPath.split('\\').pop() || '';
        if (filePart.includes('.exe') || filePart.includes('.bat')) {
          setSelectedFile(filePart);
        }
      }
    } else if (appPresetId) {
      // Smart defaults if path is empty but we have an app id
      if (appPresetId === 'comfyui') {
        setCurrentDrive('D:');
        setPathSegments(['ai-draw', 'ComfyUI_windows_portable']);
        setSelectedFile('run_nvidia_gpu.bat');
      } else if (appPresetId === 'vscode') {
        setCurrentDrive('C:');
        setPathSegments(['Users', 'Administrator', 'AppData', 'Local', 'Programs', 'Microsoft VS Code']);
        setSelectedFile('Code.exe');
      } else {
        // Find corresponding Program Files folder
        setCurrentDrive('C:');
        if (appPresetId === 'keyshot') {
          setPathSegments(['Program Files', 'KeyShot11', 'bin']);
          setSelectedFile('keyshot.exe');
        } else if (appPresetId === 'blender') {
          setPathSegments(['Program Files', 'Blender Foundation', 'Blender 4.0']);
          setSelectedFile('blender.exe');
        } else if (appPresetId === 'photoshop') {
          setPathSegments(['Program Files', 'Adobe', 'Adobe Photoshop 2024']);
          setSelectedFile('Photoshop.exe');
        } else if (appPresetId === 'painter') {
          setPathSegments(['Program Files', 'Adobe', 'Adobe Substance 3D Painter']);
          setSelectedFile('Adobe Substance 3D Painter.exe');
        } else if (appPresetId === 'designer') {
          setPathSegments(['Program Files', 'Adobe', 'Adobe Substance 3D Designer']);
          setSelectedFile('Adobe Substance 3D Designer.exe');
        } else if (appPresetId === 'marvelous') {
          setPathSegments(['Program Files', 'Marvelous Designer']);
          setSelectedFile('MarvelousDesigner.exe');
        } else if (appPresetId === 'zbrush') {
          setPathSegments(['Program Files', 'Maxon ZBrush 2024']);
          setSelectedFile('ZBrush.exe');
        } else if (appPresetId === 'maya') {
          setPathSegments(['Program Files', 'Autodesk', 'Maya2024', 'bin']);
          setSelectedFile('maya.exe');
        } else if (appPresetId === '3dsmax') {
          setPathSegments(['Program Files', 'Autodesk', '3ds Max 2024']);
          setSelectedFile('3dsmax.exe');
        } else if (appPresetId === 'houdini') {
          setPathSegments(['Program Files', 'Side Effects Software', 'Houdini 20.0', 'bin']);
          setSelectedFile('houdini.exe');
        } else if (appPresetId === 'unreal') {
          setPathSegments(['Program Files', 'Epic Games', 'UE_5.3', 'Engine', 'Binaries', 'Win64']);
          setSelectedFile('UnrealEditor.exe');
        } else if (appPresetId === 'realitycapture') {
          setPathSegments(['Program Files', 'Capturing Reality', 'RealityCapture']);
          setSelectedFile('RealityCapture.exe');
        }
      }
    }
  }, [initialPath, appPresetId, isOpen]);

  // Navigate to standard directory mapping
  const getContentsAtCurrentPath = (): FileItem[] => {
    let current = MOCK_FS[currentDrive];
    for (const segment of pathSegments) {
      const found = current.find(item => item.name === segment && item.type === 'folder');
      if (found && found.children) {
        current = found.children;
      } else {
        return [];
      }
    }
    return current;
  };

  const handleFolderClick = (name: string) => {
    setPathSegments(prev => [...prev, name]);
    setSelectedFile('');
  };

  const handleBackClick = () => {
    if (pathSegments.length > 0) {
      setPathSegments(prev => prev.slice(0, -1));
      setSelectedFile('');
    }
  };

  const handleDriveClick = (drive: 'C:' | 'D:') => {
    setCurrentDrive(drive);
    setPathSegments([]);
    setSelectedFile('');
  };

  const handleRealFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setLocalFileName(file.name);
      
      // Since browser masks real paths, construct an intelligent fake absolute path
      const baseFolder = appPresetId ? (
        appPresetId === 'comfyui' ? 'D:\\ai-draw\\ComfyUI_windows_portable' :
        appPresetId === 'vscode' ? 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Microsoft VS Code' :
        'C:\\Program Files\\' + (appName ? appName : 'CustomApp')
      ) : 'C:\\Program Files\\CustomApp';

      const guessedPath = `${baseFolder}\\${file.name}`;
      setLocalFileConstructedPath(guessedPath);
      setSelectedFile(file.name);
    }
  };

  const currentPathString = `${currentDrive}\\${pathSegments.join('\\')}`;
  const fullSelectedPath = selectedFile 
    ? `${currentPathString}${pathSegments.length > 0 ? '\\' : ''}${selectedFile}`
    : '';

  const confirmSelection = () => {
    const finalPath = localFileConstructedPath || fullSelectedPath;
    if (finalPath) {
      onSelect(finalPath);
    }
    onClose();
  };

  // Perform a full recursive search inside virtual filesystem
  const performSearch = (items: FileItem[], query: string, prefixPath: string): { path: string; name: string }[] => {
    let results: { path: string; name: string }[] = [];
    const normalizedQuery = query.toLowerCase();

    for (const item of items) {
      const currentFullPath = `${prefixPath}\\${item.name}`;
      if (item.type === 'file' && item.name.toLowerCase().includes(normalizedQuery)) {
        results.push({ path: currentFullPath, name: item.name });
      } else if (item.type === 'folder' && item.children) {
        results = [...results, ...performSearch(item.children, query, currentFullPath)];
      }
    }
    return results;
  };

  const searchResults = searchQuery 
    ? performSearch(MOCK_FS[currentDrive], searchQuery, currentDrive)
    : [];

  const visibleContents = getContentsAtCurrentPath();

  return (
    <div className="fixed inset-0 z-[100050] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-indigo-500/20 max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto h-[480px]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="bg-slate-950/70 py-3.5 px-5 border-b border-indigo-500/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FolderOpen size={11} />
            </div>
            <div className="text-left">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">本地可执行程序选取器</h3>
              <p className="text-[9px] text-slate-500 font-mono mt-0.5">NATIVE APPLICATIONS FILE NAVIGATOR</p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 border-none bg-transparent text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Path navigation toolbar */}
        <div className="bg-slate-900/50 py-2 px-4 border-b border-indigo-500/5 flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={pathSegments.length === 0}
            onClick={handleBackClick}
            className="p-1.5 rounded-lg border border-indigo-500/10 bg-slate-950/40 hover:bg-indigo-950/20 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
            title="返回上一级"
          >
            <ArrowLeft size={12} />
          </button>

          <button
            type="button"
            onClick={() => {
              setPathSegments([]);
              setSelectedFile('');
            }}
            className="p-1.5 rounded-lg border border-indigo-500/10 bg-slate-950/40 hover:bg-indigo-950/20 text-slate-405 hover:text-white cursor-pointer"
            title="回根目录"
          >
            <Home size={12} />
          </button>

          {/* Path string representation bar */}
          <div className="flex-1 min-w-0 bg-slate-950 px-3 py-1 rounded-lg border border-indigo-500/10 text-left font-mono text-[9px] text-indigo-300 flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <HardDrive size={10} className="text-indigo-400/80 shrink-0" />
            <span>{localFileConstructedPath || (fullSelectedPath || (currentPathString + '\\'))}</span>
          </div>

          {/* Quick Find Box */}
          <div className="relative w-36">
            <input 
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedFile('');
              }}
              placeholder="搜索应用..."
              className="w-full bg-slate-950 border border-indigo-500/15 rounded-lg pl-6 pr-2 py-1 text-[9.5px] text-white focus:outline-none focus:border-indigo-500/50"
            />
            <Search size={10} className="absolute left-2 top-2 text-slate-500" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-[9px] text-slate-500 hover:text-white border-none bg-transparent cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Main Columns Container */}
        <div className="flex flex-1 min-h-0">
          {/* Side drive list */}
          <div className="w-[140px] border-r border-indigo-500/5 bg-slate-900/60 p-3.5 flex flex-col gap-2.5 shrink-0 text-left select-none">
            <span className="text-[8px] font-black tracking-wider text-slate-500 uppercase font-mono mb-1">分卷设备 (Volumes)</span>
            
            <button
              type="button"
              onClick={() => handleDriveClick('C:')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${currentDrive === 'C:' ? 'bg-indigo-550/15 border-indigo-500/30 text-white' : 'bg-transparent border-transparent text-slate-400 hover:text-white'}`}
            >
              <HardDrive size={12} className="text-indigo-400" />
              <span>本地磁盘 (C:)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDriveClick('D:')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${currentDrive === 'D:' ? 'bg-indigo-550/15 border-indigo-500/30 text-white' : 'bg-transparent border-transparent text-slate-400 hover:text-white'}`}
            >
              <HardDrive size={12} className="text-violet-400" />
              <span>本地磁盘 (D:)</span>
            </button>

            <div className="mt-auto border-t border-indigo-500/5 pt-3">
              <label 
                htmlFor="explorer-real-file"
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-550 border-none text-white text-[9.5px] font-black cursor-pointer transition-all shadow-md text-center inline-block shrink-0"
              >
                <Upload size={11} />
                <span>导入真实文件</span>
              </label>
              <input 
                id="explorer-real-file"
                type="file"
                accept=".exe,.bat,.cmd,.sh"
                onChange={handleRealFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Directory Files List Grid / Search Outputs */}
          <div className="flex-1 p-4 bg-slate-950/20 overflow-y-auto flex flex-col pointer-events-auto min-h-0 text-left">
            {searchQuery ? (
              // Search outputs listings
              <div className="space-y-1.5">
                <span className="text-[8px] font-black tracking-wider text-slate-500 uppercase font-mono">搜索结果 ({searchResults.length})</span>
                {searchResults.length === 0 ? (
                  <div className="py-12 text-center text-[10px] text-slate-500 font-mono">找不到匹配的可执行文件</div>
                ) : (
                  <div className="grid grid-cols-1 gap-1">
                    {searchResults.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setLocalFileConstructedPath('');
                          setSelectedFile(item.name);
                          // Expand path segments to match search item parent directories
                          const driveIndex = item.path.indexOf(':\\');
                          if (driveIndex !== -1) {
                            const segs = item.path.substring(driveIndex + 3).split('\\');
                            segs.pop(); // discard file name
                            setPathSegments(segs);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all ${selectedFile === item.name ? 'bg-indigo-550/15 border-indigo-500 text-white' : 'bg-slate-950/30 hover:bg-slate-900/40 border-indigo-500/5 text-slate-400 hover:text-slate-200'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCode size={12} className="text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-extrabold text-[10px] truncate leading-tight">{item.name}</div>
                            <div className="text-[8px] font-mono text-slate-500 truncate mt-0.5">{item.path}</div>
                          </div>
                        </div>
                        <Check size={11} className={`text-indigo-400 shrink-0 transition-opacity ${selectedFile === item.name ? 'opacity-100' : 'opacity-0'}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Folder Explorer Grid
              <div className="h-full flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-2 shrink-0">
                  <span className="text-[8px] font-black tracking-wider text-slate-500 uppercase font-mono">当前文件夹内容</span>
                  <span className="text-[8px] font-mono text-indigo-404 font-bold">{visibleContents.length} 个对象</span>
                </div>

                {visibleContents.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-600 font-mono text-[9.5px]">
                    <span>( 空目录 )</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 content-start flex-1 overflow-y-auto pr-1">
                    {/* Folders first */}
                    {visibleContents
                      .filter(item => item.type === 'folder')
                      .map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onDoubleClick={() => handleFolderClick(item.name)}
                          onClick={() => handleFolderClick(item.name)}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/40 hover:bg-slate-900 border border-indigo-500/5 hover:border-indigo-550/20 text-slate-400 hover:text-white transition-all text-left group cursor-pointer"
                        >
                          <Folder size={13} className="text-[#ff9c00] group-hover:scale-110 transition-transform" />
                          <span className="text-[9.5px] font-black truncate">{item.name}</span>
                        </button>
                    ))}

                    {/* Executable Files */}
                    {visibleContents
                      .filter(item => item.type === 'file')
                      .map(item => {
                        const isSelected = selectedFile === item.name && !localFileConstructedPath;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setLocalFileConstructedPath('');
                              setSelectedFile(item.name);
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${isSelected ? 'bg-indigo-550/15 border-indigo-500 text-white' : 'bg-slate-950/30 hover:bg-slate-900/40 border-indigo-500/5 text-slate-400 hover:text-slate-200'}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileCode size={13} className={`${item.name.endsWith('.bat') ? 'text-emerald-400' : 'text-indigo-455'}`} />
                              <span className="text-[9.5px] font-extrabold truncate">{item.name}</span>
                            </div>
                            <Check size={11} className={`text-indigo-400 shrink-0 transition-all ${isSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} />
                          </button>
                        );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Warning guidelines or browser safety details */}
        {localFileConstructedPath && (
          <div className="bg-amber-950/10 border-t border-amber-500/10 px-4 py-2 text-left flex items-start gap-2 text-amber-300 animate-pulse shrink-0">
            <ShieldAlert size={12} className="shrink-0 mt-0.5" />
            <div className="text-[8.5px] font-sans leading-normal">
              <b>🚀 真实文件导入成功!</b> 受浏览器沙箱安全限制，真实路径已被转换为智能推断地址: <span className="font-mono text-white underline">{localFileConstructedPath}</span>。底册 Windows 系统拉起进程会精准以此程序名在后台进程通信中搜索，您可以即时开始调试！
            </div>
          </div>
        )}

        {/* Bottom selector info & submit bar */}
        <div className="bg-slate-950/90 py-3.5 px-5 border-t border-indigo-500/10 flex items-center justify-between shrink-0">
          <div className="text-left max-w-sm">
            <span className="text-[8px] font-black tracking-wider text-slate-500 uppercase font-mono">已选择的程序绝对路径：</span>
            <div className="text-[9.5px] font-semibold text-white/90 truncate max-w-[340px] font-mono mt-0.5">
              {localFileConstructedPath || (fullSelectedPath || '未选择软件 (.exe)')}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-350 rounded-lg text-[9.5px] font-bold cursor-pointer transition-all border-none"
            >
              取消
            </button>
            <button
              type="button"
              disabled={(!fullSelectedPath && !localFileConstructedPath)}
              onClick={confirmSelection}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:opacity-40 disabled:text-slate-500 text-white rounded-lg text-[9.5px] font-black cursor-pointer transition-all shadow-md border-none flex items-center gap-1"
            >
              <span>确认选择</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
