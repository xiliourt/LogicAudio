
import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js'; 
import { Upload } from 'lucide-react';
import { TrackData, TrackId, WaveSurferInstance } from '../types';
import { COLOR_WAVE_PROGRESS } from '../constants';
import clsx from 'clsx';

interface TrackDeckProps {
  id: TrackId;
  track: TrackData | null;
  color: string;
  height?: number | 'auto'; // Updated to accept 'auto' or be optional effectively via logic
  readOnly?: boolean;
  className?: string;
  onUpload?: (file: File) => void;
  onReady: (id: TrackId, ws: WaveSurferInstance) => void;
  onTimeUpdate?: (time: number) => void;
}

export const TrackDeck: React.FC<TrackDeckProps> = ({ 
  id, 
  track, 
  color, 
  height = 'auto', 
  readOnly = false,
  className,
  onUpload, 
  onReady, 
  onTimeUpdate 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    // Determine initial height
    const initialHeight = typeof height === 'number' ? height : (containerRef.current.clientHeight || 128);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: `${color}40`, 
      progressColor: color,
      cursorColor: COLOR_WAVE_PROGRESS,
      height: initialHeight,
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      normalize: true, 
      minPxPerSec: 50,
      interact: false, // Always disable click-to-seek on wave, use Ruler
      cursorWidth: 1,
      autoScroll: true,
      hideScrollbar: true,
    });

    // Important: Start silent so we can apply crossfade/auto-gain logic in App.tsx without volume blips
    ws.setVolume(0);

    wsRef.current = ws;

    ws.on('ready', () => {
      setIsLoading(false);
      onReady(id, ws as unknown as WaveSurferInstance);
    });

    if (onTimeUpdate) {
      ws.on('timeupdate', (currentTime) => {
        onTimeUpdate(currentTime);
      });
    }

    // Cleanup
    return () => {
      ws.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, id, readOnly]); // Removed height from dependency to prevent re-init on resize

  // Handle Dynamic Resize
  useEffect(() => {
    if (!containerRef.current || !wsRef.current) return;

    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            // WaveSurfer 7 setOptions handles redraw
            // We pass the new height. Note: WaveSurfer expects integer.
            const newHeight = Math.floor(entry.contentRect.height);
            if (newHeight > 0) {
                 wsRef.current?.setOptions({ height: newHeight });
            }
        }
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // Load Track
  useEffect(() => {
    if (track && wsRef.current) {
      setIsLoading(true);
      wsRef.current.load(track.url);
    }
  }, [track]);

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    if (readOnly) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/') && onUpload) {
      onUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onUpload) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div 
      className={clsx(
        "w-full h-full flex flex-col relative group transition-colors duration-300",
        !readOnly && isDragOver ? "bg-slate-800/50" : "bg-transparent",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      {/* Track Info Overlay - Only for main decks */}
      {!readOnly && (
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded flex items-center justify-center text-slate-950 font-bold"
              style={{ backgroundColor: color }}
            >
              {id}
            </div>
            <div>
               <h3 className={clsx("font-medium shadow-black drop-shadow-md", track ? "text-white" : "text-slate-500")}>
                 {track ? track.name : "No Track Loaded"}
               </h3>
               {isLoading && <span className="text-xs text-cyan-400 animate-pulse">Decoding Audio...</span>}
            </div>
          </div>
        </div>
      )}

      {/* Upload Prompt (Visible if no track and not readOnly) */}
      {!readOnly && !track && (
        <div className="absolute inset-0 flex items-center justify-center z-0">
           <label className="cursor-pointer flex flex-col items-center gap-4 text-slate-500 hover:text-slate-300 transition-colors group/upload">
              <div className="p-4 rounded-full border-2 border-dashed border-slate-700 group-hover/upload:border-slate-500 transition-colors">
                <Upload size={32} />
              </div>
              <span className="text-sm font-medium">Drag audio here or click to upload</span>
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileSelect} />
           </label>
        </div>
      )}

      {/* Change Track Button (Visible on hover if track exists) */}
      {!readOnly && track && (
        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-md flex items-center gap-2 text-xs shadow-lg border border-slate-700">
            <Upload size={14} />
            <span>Replace</span>
            <input type="file" accept="audio/*" className="hidden" onChange={handleFileSelect} />
          </label>
        </div>
      )}

      {/* WaveSurfer Container */}
      <div ref={containerRef} className="w-full h-full flex items-center" />
      
    </div>
  );
};
