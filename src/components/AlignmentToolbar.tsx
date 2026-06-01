import React, { useState, useEffect } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Maximize } from 'lucide-react';
import { useStore } from '../store/useStore';

export function AlignmentToolbar() {
  const { setNodes, getNodes } = useReactFlow();
  const nodes = useNodes();
  const settings = useStore(state => state.settings);
  const selectedNodes = nodes.filter(n => n.selected);
  const [isOpen, setIsOpen] = useState(false);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (selectedNodes.length < 2) setIsOpen(false);
  }, [selectedNodes.length]);

  if (selectedNodes.length < 2 || settings.multiSelectAlignmentMode === 'disabled') {
    return null;
  }

  const handleAlign = (type: string) => {
    const sNodes = getNodes().filter(n => n.selected);
    if(sNodes.length < 2) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    sNodes.forEach(n => {
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x + (n.measured?.width || 200));
      minY = Math.min(minY, n.position.y);
      maxY = Math.max(maxY, n.position.y + (n.measured?.height || 200));
    });

    setNodes(nds => nds.map(n => {
      if (!n.selected) return n;
      let newX = n.position.x;
      let newY = n.position.y;
      const w = n.measured?.width || 200;
      const h = n.measured?.height || 200;

      switch(type) {
        case 'left': newX = minX; break;
        case 'center': newX = minX + (maxX - minX)/2 - w/2; break;
        case 'right': newX = maxX - w; break;
        case 'top': newY = minY; break;
        case 'middle': newY = minY + (maxY - minY)/2 - h/2; break;
        case 'bottom': newY = maxY - h; break;
      }
      return { ...n, position: { x: newX, y: newY } };
    }));
  };

  const handleDistribute = (type: 'horizontal' | 'vertical') => {
    const sNodes = getNodes().filter(n => n.selected);
    if(sNodes.length < 2) return;
    
    const sorted = [...sNodes].sort((a, b) => 
      type === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
    );

    const startNode = sorted[0];
    const spacing = settings.alignmentSpacing || 40;

    setNodes(nds => {
      let currentPos = type === 'horizontal' ? startNode.position.x : startNode.position.y;
      
      return nds.map(n => {
        if (!n.selected) return n;
        const index = sorted.findIndex(sn => sn.id === n.id);
        if (index === 0) {
          currentPos += type === 'horizontal' ? (n.measured?.width || 200) + spacing : (n.measured?.height || 200) + spacing;
          return n;
        }

        const newPos = currentPos;
        currentPos += type === 'horizontal' ? (n.measured?.width || 200) + spacing : (n.measured?.height || 200) + spacing;

        return {
          ...n,
          position: {
            x: type === 'horizontal' ? newPos : n.position.x,
            y: type === 'vertical' ? newPos : n.position.y
          }
        };
      });
    });
  };

  const handlePointerDown = () => {
    if (settings.multiSelectAlignmentMode === 'longPress') {
      const timer = setTimeout(() => setIsOpen(true), 500);
      setPressTimer(timer);
    }
  };

  const handlePointerUp = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  const handleClick = () => {
    if (settings.multiSelectAlignmentMode === 'click') {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      <button 
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
        className="px-4 py-2 bg-accent text-white rounded-full shadow-lg shadow-accent/30 font-bold text-lg tracking-wide flex items-center gap-2 hover:bg-accent hover:scale-105 active:scale-95 transition-all"
      >
        <Maximize size={16} />
        {selectedNodes.length} Nodes Selected
      </button>

      {isOpen && (
        <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl shadow-2xl flex items-center p-2 gap-1 animate-in slide-in-from-top-2 fade-in">
          <div className="flex gap-1 border-r border-[var(--border)] pr-2 mr-1">
            <button onClick={() => handleAlign('left')} className="p-2 hover:bg-[var(--border)] hover:text-white text-gray-400 rounded-lg tooltip" title="左对齐"><AlignLeft size={16} /></button>
            <button onClick={() => handleAlign('center')} className="p-2 hover:bg-[var(--border)] hover:text-white text-gray-400 rounded-lg tooltip" title="竖直居中"><AlignCenter size={16} /></button>
            <button onClick={() => handleAlign('right')} className="p-2 hover:bg-[var(--border)] hover:text-white text-gray-400 rounded-lg tooltip" title="右对齐"><AlignRight size={16} /></button>
          </div>
          <div className="flex gap-1 border-r border-[var(--border)] pr-2 mr-1">
            <button onClick={() => handleAlign('top')} className="p-2 hover:bg-[var(--border)] hover:text-white text-gray-400 rounded-lg tooltip" title="顶对齐"><AlignStartVertical size={16} /></button>
            <button onClick={() => handleAlign('middle')} className="p-2 hover:bg-[var(--border)] hover:text-white text-gray-400 rounded-lg tooltip" title="水平居中"><AlignCenterVertical size={16} /></button>
            <button onClick={() => handleAlign('bottom')} className="p-2 hover:bg-[var(--border)] hover:text-white text-gray-400 rounded-lg tooltip" title="底对齐"><AlignEndVertical size={16} /></button>
          </div>
          <div className="flex gap-1">
            <button onClick={() => handleDistribute('horizontal')} className="p-2 hover:bg-[var(--border)] hover:text-white text-accent rounded-lg tooltip" title="水平分布"><AlignHorizontalDistributeCenter size={16} /></button>
            <button onClick={() => handleDistribute('vertical')} className="p-2 hover:bg-[var(--border)] hover:text-white text-accent rounded-lg tooltip" title="垂直分布"><AlignVerticalDistributeCenter size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
