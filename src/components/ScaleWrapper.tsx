import React, { useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useUpdateNodeInternals } from '@xyflow/react';

interface ScaleWrapperProps {
  id: string;
  type: string;
  baseWidth?: number;
  baseHeight?: number;
  disableDynamicHeight?: boolean;
  children: React.ReactNode;
}

export const ScaleWrapper: React.FC<ScaleWrapperProps> = ({ id, type, baseWidth: customBaseWidth, baseHeight: customBaseHeight, disableDynamicHeight = true, children }) => {
  const node = useStore((state) => state.nodes.find((n) => n.id === id));
  const innerRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  
  const getBaseDimensions = (nodeType: string) => {
    switch (nodeType) {
      case "fusion-master":
        return { width: 720, height: 960 }; // 3:4
      case "image-gen":
        return { width: 450, height: 600 }; // 3:4
      case "text-gen":
        return { width: 450, height: 600 }; // 3:4
      case "image-source":
      case "text-source":
      case "text":
        return { width: 400, height: 400 }; // 1:1
      case "reverse":
        return { width: 450, height: 600 }; // 3:4
      case "double-box-transform":
        return { width: 800, height: 600 }; // 4:3
      case "translate-engine":
      case "logic-engine":
      case "prompt-engine":
      case "ms-gen":
        return { width: 450, height: 600 }; // 3:4
      case "spatial-view":
        return { width: 960, height: 540 }; // 16:9
      case "apt-web-tool":
        return { width: 1000, height: 750 }; // 4:3
      case "io-image-list":
        return { width: 450, height: 600 }; // 3:4
      case "ai-ps-engine":
        return { width: 880, height: 640 };
      case "group-node":
        return { width: 800, height: 600 }; // 4:3
      default:
        return { width: 400, height: 400 }; // 1:1
    }
  };

  const defaultDims = getBaseDimensions(type);
  const baseWidth = customBaseWidth || defaultDims.width;
  const currentWidth = node?.style?.width 
    ? (typeof node.style.width === 'number' ? node.style.width : parseInt(node.style.width as string, 10))
    : (node?.measured?.width || baseWidth);

  const scale = currentWidth / baseWidth;
  const nodeUiFontSize = useStore((state) => state.settings.nodeUiFontSize ?? 14);

  // Intelligently compensate font size to prevent tiny text on screen when scale is small
  // Enforce a minimum on-screen visual font-size (typically around 11px)
  const visualMin = nodeUiFontSize < 10 
    ? nodeUiFontSize 
    : Math.max(10, Math.min(12, nodeUiFontSize * 0.8));

  const compensatedFs = nodeUiFontSize === 0 
    ? 0 
    : Math.max(visualMin / scale, nodeUiFontSize / Math.pow(scale, 0.55));

  // Dynamic Height Sync to make sure the drag border perfectly wraps the scaled content
  useEffect(() => {
    const element = innerRef.current;
    if (!element) return;

    const updateHeightAndInternals = () => {
      if (!disableDynamicHeight) {
        const parentCard = element.parentElement;
        const rfNode = element.closest('.react-flow__node') as HTMLElement;
        
        // Get unscaled height of inside content
        const unscaledHeight = element.scrollHeight;
        const visualHeight = unscaledHeight * scale;
        
        if (parentCard) {
          parentCard.style.height = `${visualHeight}px`;
        }
        if (rfNode) {
          rfNode.style.height = `${visualHeight}px`;
        }
      }
      
      // Always notify React Flow about node size & handle updates to prevent drifting lines
      try {
        updateNodeInternals(id);
      } catch (err) {
        console.warn("Failed to update node internals:", err);
      }
    };

    updateHeightAndInternals();

    const observer = new ResizeObserver(() => {
      updateHeightAndInternals();
    });

    observer.observe(element);
    
    // Periodically sync to handle dynamic content loads (like images load)
    const timer = setInterval(updateHeightAndInternals, 500);

    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, [id, scale, nodeUiFontSize, disableDynamicHeight, updateNodeInternals]);

  // Render content with smooth subpixel scaling
  return (
    <div 
      ref={innerRef}
      className="w-full h-full flex flex-col scale-container origin-top-left"
      style={{
        transform: `scale(${scale})`,
        width: `${100 / scale}%`,
        height: `${100 / scale}%`,
        backfaceVisibility: 'hidden',
        WebkitFontSmoothing: 'subpixel-antialiased',
        fontSize: `${compensatedFs}px`,
        ['--node-ui-fs' as any]: `${compensatedFs}px`,
      }}
    >
      {children}
    </div>
  );
};
