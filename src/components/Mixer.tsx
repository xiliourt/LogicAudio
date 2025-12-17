
import React from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Ear, CircleSlash } from 'lucide-react';
import clsx from 'clsx';
import { COLOR_TRACK_A, COLOR_TRACK_B } from '../constants';

interface MixerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  crossfade: number;
  onCrossfadeChange: (val: number) => void;
  currentTime: number;
  duration: number;
  autoGain?: boolean;
  onToggleAutoGain?: () => void;
  isDiffMode?: boolean;
  onToggleDiffMode?: () => void;
  showCrossfader?: boolean;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const MixerControls: React.FC<MixerControlsProps> = ({
  isPlaying,
  onPlayPause,
  onStop,
  onSkipBackward,
  onSkipForward,
  crossfade,
  onCrossfadeChange,
  currentTime,
  duration,
  autoGain = false,
  onToggleAutoGain,
  isDiffMode = false,
  onToggleDiffMode,
  showCrossfader = true
}) => {
  return (
    <div className="flex items-center gap-8 w-full max-w-4xl justify-between">
      
      {/* Time Display */}
      <div className="font-mono text-xl text-cyan-400 w-32 text-right hidden md:block">
        {formatTime(currentTime)}
      </div>

      {/* Transport */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onSkipBackward}
          className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors active:scale-95"
          title="-10s"
        >
          <SkipBack size={24} />
        </button>

        <button 
          onClick={onStop}
          className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-95"
        >
          <Square size={20} fill="currentColor" />
        </button>
        
        <button 
          onClick={onPlayPause}
          className={clsx(
            "w-16 h-16 rounded-full flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95",
            isPlaying ? "bg-cyan-400 hover:bg-cyan-300" : "bg-white hover:bg-slate-200"
          )}
        >
          {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
        </button>

        <button 
          onClick={onSkipForward}
          className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors active:scale-95"
          title="+10s"
        >
          <SkipForward size={24} />
        </button>
      </div>

      {/* Crossfader Section */}
      {showCrossfader && (
        <div className="flex flex-col items-center gap-2 flex-1 max-w-md relative">
          <div className="flex justify-between w-full text-[10px] font-bold tracking-wider uppercase text-slate-500">
            <span style={{ color: crossfade === 0 ? COLOR_TRACK_A : undefined }}>Track A</span>
            <span className={clsx(crossfade === 0.5 ? "text-white" : "")}>Mix</span>
            <span style={{ color: crossfade === 1 ? COLOR_TRACK_B : undefined }}>Track B</span>
          </div>
          
          <div className="flex items-center w-full gap-4">
              {/* Auto-Gain Toggle */}
              {onToggleAutoGain && (
                  <button
                      onClick={onToggleAutoGain}
                      className={clsx(
                          "flex flex-col items-center justify-center gap-1 p-2 rounded-md transition-all active:scale-95 shrink-0",
                          autoGain 
                              ? "text-emerald-400 bg-emerald-900/20 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-transparent"
                      )}
                      title="Auto-Match Loudness"
                  >
                      <Ear size={16} />
                  </button>
              )}
              
              {/* Differential Mode Toggle */}
              {onToggleDiffMode && (
                  <button
                      onClick={onToggleDiffMode}
                      className={clsx(
                          "flex flex-col items-center justify-center gap-1 p-2 rounded-md transition-all active:scale-95 shrink-0",
                          isDiffMode 
                              ? "text-rose-400 bg-rose-900/20 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]" 
                              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-transparent"
                      )}
                      title="Differential Mode (Null Test)"
                  >
                      <CircleSlash size={16} />
                  </button>
              )}

              <div className={clsx("relative flex-1 h-12 flex items-center group transition-opacity", isDiffMode && "opacity-20 pointer-events-none")}>
              {/* Rail */}
              <div className="absolute left-0 right-0 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                      className="absolute top-0 bottom-0 left-0" 
                      style={{ 
                          width: `${crossfade * 100}%`, 
                          background: `linear-gradient(90deg, ${COLOR_TRACK_A}40, ${COLOR_TRACK_B}40)`
                      }} 
                  />
              </div>
              
              {/* Native Range Input (Invisible but handles interaction) */}
              <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={crossfade}
                  onChange={(e) => onCrossfadeChange(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />

              {/* Custom Thumb */}
              <div 
                  className="absolute h-8 w-4 bg-white rounded-sm shadow-lg border-2 border-slate-300 z-10 pointer-events-none transition-transform duration-75 ease-out flex items-center justify-center"
                  style={{ left: `calc(${crossfade * 100}% - 8px)` }}
              >
                  <div className="w-[2px] h-4 bg-slate-400 rounded-full" />
              </div>
              </div>
          </div>
        </div>
      )}

      {/* Duration Display */}
      <div className="font-mono text-xl text-slate-600 w-32 text-left hidden md:block">
        {formatTime(duration)}
      </div>

    </div>
  );
};
