
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { BpmPoint } from '../types';
import clsx from 'clsx';
import { Activity, Lock, Unlock, Clock, AlertCircle, Wand2 } from 'lucide-react';

interface BpmLogProps {
  data: BpmPoint[];
  currentTime: number;
  onRowClick: (time: number) => void;
  interval: number;
  onIntervalChange: (val: number) => void;
  hasTrack: boolean;
  isAnalyzing: boolean;
}

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// 0 represents "Auto"
const INTERVAL_OPTIONS = [0, 0.5, 1, 2, 5, 10, 30];

export const BpmLog: React.FC<BpmLogProps> = ({ 
    data, 
    currentTime, 
    onRowClick, 
    interval, 
    onIntervalChange,
    hasTrack,
    isAnalyzing
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLTableRowElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Determine the effective interval for highlighting logic
  // If Auto (0), we try to infer from data spacing or default to 30
  const effectiveInterval = useMemo(() => {
      if (interval > 0) return interval;
      if (data.length > 1) {
          return data[1].time - data[0].time;
      }
      return 30;
  }, [interval, data]);

  // Determine the active row index based on current time
  const activeIndex = data.findIndex((point, i) => {
    const nextPoint = data[i+1];
    // Highlight valid until next point or effective interval
    const endTime = nextPoint ? nextPoint.time : point.time + effectiveInterval; 
    return currentTime >= point.time && currentTime < endTime;
  });

  // Derive active time for stable dependency (avoids effect running on every ms update)
  const activeTime = activeIndex !== -1 ? data[activeIndex].time : null;

  // Calculate Average BPM
  const averageBpm = useMemo(() => {
    if (data.length === 0) return null;
    const sum = data.reduce((acc, p) => acc + p.bpm, 0);
    return (sum / data.length).toFixed(1);
  }, [data]);

  useEffect(() => {
    if (autoScroll && activeRowRef.current) {
        // Use scrollIntoView for robust scrolling regardless of container offset context
        activeRowRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
  }, [activeTime, autoScroll]); 

  // Empty State Rendering Helper
  const renderEmptyState = () => {
    if (!hasTrack) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                <Activity size={48} className="opacity-20" />
                <p>Upload a track to analyze BPM</p>
            </div>
        );
    }
    
    if (isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-fuchsia-400 gap-4">
                <Activity size={48} className="animate-bounce opacity-50" />
                <p className="animate-pulse">Processing Audio...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
            <AlertCircle size={48} className="opacity-20" />
            <div className="text-center">
                <p>No BPM detected.</p>
                <p className="text-xs mt-2 opacity-60">Try adjusting the interval or using a track with a clearer beat.</p>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-t border-slate-800">
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center shadow-md z-10 gap-2">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 shrink-0">
                <Activity size={16} className="text-fuchsia-400" />
                <span className="hidden sm:inline">BPM Log</span>
            </h3>
            
            <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
                {/* Average BPM Display */}
                {averageBpm !== null && (
                    <div className="flex items-center gap-1.5 bg-slate-800/50 px-2.5 py-1 rounded border border-fuchsia-500/20 shadow-sm shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg</span>
                        <span className="font-mono text-sm font-bold text-fuchsia-400">{averageBpm}</span>
                    </div>
                )}

                {/* Interval Selector */}
                <div className="flex items-center gap-2 bg-slate-800 px-2 py-1 rounded border border-slate-700 hover:border-slate-600 transition-colors shrink-0">
                    <Clock size={12} className={clsx(interval === 0 ? "text-cyan-400" : "text-slate-400")} />
                    <select 
                        value={interval} 
                        onChange={(e) => onIntervalChange(Number(e.target.value))}
                        disabled={!hasTrack || isAnalyzing}
                        className={clsx(
                            "bg-transparent text-xs text-slate-200 outline-none cursor-pointer pr-1",
                            (!hasTrack || isAnalyzing) && "opacity-50 cursor-not-allowed",
                            interval === 0 && "text-cyan-400 font-bold"
                        )}
                        style={{ colorScheme: 'dark' }}
                    >
                        {INTERVAL_OPTIONS.map(opt => (
                            <option key={opt} value={opt} className="bg-slate-900 text-slate-200">
                                {opt === 0 ? "Auto" : `${opt}s`}
                            </option>
                        ))}
                    </select>
                    {interval === 0 && <Wand2 size={10} className="text-cyan-400 animate-pulse" />}
                </div>

                <div className="h-4 w-px bg-slate-700 shrink-0" />

                <span className="text-xs text-slate-500 hidden sm:inline shrink-0">{data.length} pts</span>
                
                <button 
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors border shrink-0",
                        autoScroll 
                            ? "bg-cyan-900/30 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/50" 
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                    )}
                    title={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll to current time"}
                >
                    {autoScroll ? <Lock size={12} /> : <Unlock size={12} />}
                    <span className="hidden sm:inline">{autoScroll ? "Sync On" : "Sync Off"}</span>
                </button>
            </div>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto relative p-4 space-y-1">
            {data.length === 0 ? renderEmptyState() : (
                <>
                <table className="w-full text-left border-collapse relative">
                    <thead className="text-xs text-slate-500 uppercase top-0 bg-slate-950/95 backdrop-blur z-20 shadow-sm">
                        <tr>
                            <th className="pb-2 pl-4 pt-2">Time</th>
                            <th className="pb-2 pt-2">BPM</th>
                            <th className="pb-2 pt-2 w-full">Visual</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((point, i) => {
                            const isActive = i === activeIndex;
                            
                            return (
                                <tr 
                                    key={point.time}
                                    ref={isActive ? activeRowRef : null}
                                    onClick={() => onRowClick(point.time)}
                                    className={clsx(
                                        "border-b border-slate-800/50 transition-colors duration-200 text-sm cursor-pointer group",
                                        isActive ? "bg-fuchsia-900/20 text-fuchsia-300" : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200"
                                    )}
                                >
                                    <td className="py-2 pl-4 font-mono w-24 group-hover:font-bold">{formatTime(point.time)}</td>
                                    <td className="py-2 font-bold w-16">{point.bpm.toFixed(1)}</td>
                                    <td className="py-2 opacity-50 group-hover:opacity-80">
                                        <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden w-full max-w-xs">
                                            <div 
                                                className={clsx("h-full transition-all duration-300", isActive ? "bg-fuchsia-500" : "bg-slate-500 group-hover:bg-slate-400")} 
                                                style={{ width: `${Math.max(0, Math.min(100, ((point.bpm - 60) / 100) * 100))}%` }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="h-32" /> 
                </>
            )}
        </div>
    </div>
  );
};
