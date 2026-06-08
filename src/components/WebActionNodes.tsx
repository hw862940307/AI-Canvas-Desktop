import React from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { FileText, Camera, Database } from 'lucide-react';

export const WebScrapeNode = ({ selected }: any) => (
  <>
    <NodeResizer minWidth={250} minHeight={150} isVisible={selected} />
    <div className={`p-4 bg-[var(--bg-secondary)] rounded-xl border-2 ${selected ? 'border-indigo-500' : 'border-[var(--border)]'} shadow-xl w-full h-full flex flex-col`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500" />
      <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
        <Database size={16} className="text-indigo-400" />
        <span className="font-bold text-sm text-gray-200 uppercase tracking-widest">网页采集节点</span>
      </div>
      <div className="flex-1 flex items-center justify-center text-xs text-gray-500 text-center font-mono">
        (Awaiting Browser Context)
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500" />
    </div>
  </>
);

export const WebScreenshotNode = ({ selected }: any) => (
  <>
    <NodeResizer minWidth={250} minHeight={150} isVisible={selected} />
    <div className={`p-4 bg-[var(--bg-secondary)] rounded-xl border-2 ${selected ? 'border-amber-500' : 'border-[var(--border)]'} shadow-xl w-full h-full flex flex-col`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-amber-500" />
      <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
        <Camera size={16} className="text-amber-400" />
        <span className="font-bold text-sm text-gray-200 uppercase tracking-widest">网页截图节点</span>
      </div>
      <div className="flex-1 flex items-center justify-center text-xs text-gray-500 text-center font-mono">
        (Output: Image Stream)
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-amber-500" />
    </div>
  </>
);

export const WebToTextNode = ({ selected }: any) => (
  <>
    <NodeResizer minWidth={250} minHeight={150} isVisible={selected} />
    <div className={`p-4 bg-[var(--bg-secondary)] rounded-xl border-2 ${selected ? 'border-emerald-500' : 'border-[var(--border)]'} shadow-xl w-full h-full flex flex-col`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-emerald-500" />
      <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
        <FileText size={16} className="text-emerald-400" />
        <span className="font-bold text-sm text-gray-200 uppercase tracking-widest">网页转文本节点</span>
      </div>
      <div className="flex-1 flex items-center justify-center text-xs text-gray-500 text-center font-mono">
        (Output: LLM Context Text)
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500" />
    </div>
  </>
);
