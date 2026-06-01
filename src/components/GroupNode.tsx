import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Link2Off, Edit2 } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';

interface GroupNodeProps {
  id: string;
  data: {
    label?: string;
    color?: string;
  };
  selected?: boolean;
}

export const GroupNode: React.FC<GroupNodeProps> = ({ id, data, selected }) => {
  const { updateNodeData, ungroupNode } = useStore();
  const node = useStore((state) => state.nodes.find((n) => n.id === id));
  const settings = useStore((state) => state.settings);
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || 'G');
  const [isHovered, setIsHovered] = useState(false);

  const { getZoom } = useReactFlow();
  let zoom = 1;
  try {
    zoom = getZoom();
  } catch (e) {
    // fallback
  }

  const handleSave = () => {
    setIsEditing(false);
    updateNodeData(id, { label });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const currentWidth = node?.style?.width 
    ? (typeof node.style.width === 'number' ? node.style.width : parseInt(node.style.width as string, 10))
    : (node?.measured?.width || 500);

  // Compensate text size intelligently with zoom & scale
  const zoomCompensation = Math.max(0.6, Math.min(1.5, Math.pow(zoom, 0.6)));
  const groupLabelFontSize = Math.max(13, Math.min(64, ((currentWidth / 500) * (settings?.nodeUiFontSize ?? 14)) / zoomCompensation));
  const activeColor = data.color || '#3b82f6';

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full h-full min-w-[200px] min-h-[150px] rounded-[24px] border-[2px] transition-all flex flex-col pointer-events-auto overflow-hidden"
      style={{ 
        boxSizing: 'border-box',
        borderColor: selected ? activeColor : `${activeColor}40`,
        boxShadow: selected ? `0 0 30px ${activeColor}25` : `0 0 15px ${activeColor}0a`,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        backgroundColor: selected ? `${activeColor}1c` : `${activeColor}0a`
      }}
    >
      {/* Top Header/Titlebar */}
      <div 
        className="flex items-center justify-between px-5 py-3 border-b border-white/5 select-none"
        style={{ backgroundColor: `${activeColor}15` }}
      >
        <div className="flex items-center gap-2 max-w-[50%]">
          {isEditing ? (
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="nodrag nopan bg-black/70 border border-white/20 rounded px-2 py-0.5 text-gray-100 font-bold font-sans focus:outline-none focus:ring-2 focus:ring-accent w-full"
              style={{ fontSize: `${groupLabelFontSize}px` }}
              autoFocus
            />
          ) : (
            <div 
              onDoubleClick={() => setIsEditing(true)}
              className="group/lbl flex items-center gap-1.5 cursor-pointer"
            >
              <span 
                className="font-black text-gray-200 uppercase tracking-wider truncate"
                style={{ fontSize: `${groupLabelFontSize}px` }}
              >
                {label}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="opacity-0 group-hover/lbl:opacity-100 p-0.5 bg-white/5 hover:bg-white/10 rounded transition-all"
              >
                <Edit2 size={10} className="text-gray-400" />
              </button>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 nodrag">
          {(selected || isHovered) && (
            <div className="flex flex-wrap items-center gap-1 bg-black/50 px-2.5 py-1 rounded-full border border-white/5 shadow-inner">
              {[
                { hex: '#3b82f6', name: '蓝' },
                { hex: '#a855f7', name: '紫' },
                { hex: '#10b981', name: '绿' },
                { hex: '#f59e0b', name: '黄' },
                { hex: '#ef4444', name: '红' },
                { hex: '#ec4899', name: '粉' },
                { hex: '#f97316', name: '橙' },
                { hex: '#14b8a6', name: '青' },
                { hex: '#6366f1', name: '靛' }
              ].map((c) => (
                <button
                  key={c.hex}
                  onClick={() => updateNodeData(id, { color: c.hex })}
                  className={`w-3.5 h-3.5 rounded-full border border-white/15 transition-all ${
                    activeColor === c.hex 
                      ? 'scale-125 border-white ring-2 ring-white/30' 
                      : 'hover:scale-110 opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>
          )}

          {/* Ungroup Button */}
          <button
            onClick={() => ungroupNode(id)}
            title="Ungroup (alt+P)"
            className="p-1.5 bg-white/5 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-gray-400 border border-white/5 hover:border-red-500/20 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Link2Off size={11} />
            <span className="text-[10px] font-black uppercase tracking-wider">Ungroup</span>
          </button>
        </div>
      </div>

      {/* Background Container for Dropping Items */}
      <div className="flex-1 w-full h-full pointer-events-none" />
    </div>
  );
};
