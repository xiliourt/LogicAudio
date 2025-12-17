import React from 'react';
import { GripHorizontal } from 'lucide-react';

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ onMouseDown, className }) => {
  return (
    <div 
      className={`group relative z-40 flex h-2 cursor-row-resize items-center justify-center hover:z-50 select-none ${className}`}
      onMouseDown={onMouseDown}
    >
      {/* Hit area for easier grabbing */}
      <div className="absolute inset-x-0 -top-2 -bottom-2 bg-transparent" />
      
      {/* Visual Line */}
      <div className="absolute inset-x-0 h-px bg-slate-800 transition-colors group-hover:bg-cyan-500" />
      
      {/* Handle Icon */}
      <div className="relative flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-500 shadow-sm transition-all group-hover:border-cyan-500 group-hover:text-cyan-400 group-active:scale-95 group-active:border-cyan-400 group-active:text-cyan-300">
        <GripHorizontal size={14} />
      </div>
    </div>
  );
};
