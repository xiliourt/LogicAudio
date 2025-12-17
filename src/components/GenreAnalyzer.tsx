import React, { useState, useCallback } from 'react';
import { Upload, Sparkles, Loader2, Music2, AlertCircle, X, Key, Copy, Check, ArrowRight } from 'lucide-react';
import { AnalyzedTrack, AiAnalysisResult } from '../types';
import { decodeAudioData } from '../utils/audioAnalysis';
import { analyzeTrackWithGemini } from '../services/geminiService';
import clsx from 'clsx';

interface GenreAnalyzerProps {
  tracks: AnalyzedTrack[];
  setTracks: React.Dispatch<React.SetStateAction<AnalyzedTrack[]>>;
  apiKey: string;
  setApiKey: (key: string) => void;
}

const AnalysisResultCard: React.FC<{ analysis: AiAnalysisResult }> = ({ analysis }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
      navigator.clipboard.writeText(analysis.musicalDescription);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
      <div className="w-full h-32 bg-slate-950 rounded-lg border border-slate-800 flex overflow-hidden shadow-inner">
          {/* Description Area */}
          <div className="flex-1 p-3 relative group/desc min-w-0">
              <div className="absolute top-2 right-2 opacity-0 group-hover/desc:opacity-100 transition-opacity z-10">
                   <button 
                      onClick={handleCopy}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 text-slate-400 hover:text-white transition-colors flex items-center gap-1 shadow-sm"
                      title="Copy Description"
                   >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                   </button>
              </div>
              <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
                  <p className="text-sm text-slate-300 leading-relaxed font-light">
                      {analysis.musicalDescription}
                  </p>
              </div>
          </div>

          {/* Tags Column */}
          <div className="w-40 bg-slate-900/50 p-2.5 flex flex-col justify-center gap-2 shrink-0 border-l border-slate-800">
              {/* Key - Side by Side */}
              <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider shrink-0">Key</span>
                  <div className="text-xs font-bold text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-900/50 text-right min-w-[3rem] truncate">
                      {analysis.key}
                  </div>
              </div>
              
               {/* Genre - Side by Side */}
              <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider shrink-0">Genre</span>
                  <div className="text-[11px] font-medium text-fuchsia-300 bg-fuchsia-950/20 px-2 py-0.5 rounded border border-fuchsia-900/30 text-right truncate max-w-[5rem]" title={analysis.genre}>
                      {analysis.genre}
                  </div>
              </div>

              {/* Mood - Stacked or Side depending on length, defaulting to stacked for safety */}
               <div className="flex flex-col gap-0.5 pt-0.5 border-t border-slate-800/50 mt-0.5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Mood</span>
                   <div className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded text-center truncate border border-slate-700/50" title={analysis.mood}>
                      {analysis.mood}
                  </div>
              </div>
          </div>
      </div>
  );
};

export const GenreAnalyzer: React.FC<GenreAnalyzerProps> = ({ tracks, setTracks, apiKey, setApiKey }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [tempKey, setTempKey] = useState('');

  const processTrackLocally = async (trackId: string, file: File) => {
    try {
      setTracks(prev => prev.map(t => 
        t.id === trackId ? { ...t, status: 'decoding' } : t
      ));

      const buffer = await decodeAudioData(file);

      setTracks(prev => prev.map(t => 
        t.id === trackId ? { 
            ...t, 
            status: 'idle', // Ready for AI analysis
            duration: buffer.duration, 
            audioBuffer: buffer 
        } : t
      ));

    } catch (err: any) {
      console.error("Processing error", err);
      setTracks(prev => prev.map(t => 
        t.id === trackId ? { ...t, status: 'error', error: 'Failed to decode audio' } : t
      ));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const audioFiles = (Array.from(e.dataTransfer.files) as File[]).filter(file => 
        file.type.startsWith('audio/')
      );
      addFiles(audioFiles);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const audioFiles = (Array.from(e.target.files) as File[]).filter(file => 
        file.type.startsWith('audio/')
      );
      addFiles(audioFiles);
    }
  };

  const addFiles = (files: File[]) => {
    const newTracks: AnalyzedTrack[] = files.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      status: 'decoding'
    }));

    setTracks(prev => [...prev, ...newTracks]);

    newTracks.forEach(track => {
      processTrackLocally(track.id, track.file);
    });
  };

  const handleAiAnalysis = async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.audioBuffer) return;

    setTracks(prev => prev.map(t => 
      t.id === trackId ? { ...t, status: 'analyzing_ai' } : t
    ));

    try {
      const result = await analyzeTrackWithGemini(track.audioBuffer, apiKey);
      setTracks(prev => prev.map(t => 
        t.id === trackId ? { ...t, status: 'done', aiAnalysis: result } : t
      ));
    } catch (err: any) {
      console.error("AI Analysis error", err);
      setTracks(prev => prev.map(t => 
        t.id === trackId ? { 
            ...t, 
            status: 'idle', 
            error: 'AI Analysis failed: ' + (err.message || 'Unknown error')
        } : t
      ));
    }
  };

  const removeTrack = (id: string) => {
      setTracks(prev => prev.filter(t => t.id !== id));
  };

  const handleSubmitKey = (e: React.FormEvent) => {
      e.preventDefault();
      if (tempKey.trim()) {
          setApiKey(tempKey.trim());
      }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 overflow-y-auto">
      
      {/* Hero / Header */}
      <div className="max-w-4xl mx-auto w-full mb-8 text-center space-y-4 relative">
         <h2 className="text-3xl font-bold text-white tracking-tight">
             Genre & Vibe Analyzer
         </h2>
         <p className="text-slate-400 max-w-lg mx-auto">
             Upload tracks to instantly decode them locally, then use <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400 font-bold">Gemini AI</span> to detect Genre, Key, and Mood.
         </p>
         
         {/* Edit Key Button (Only when key is set) */}
         {apiKey && (
            <div className="absolute top-0 right-0">
                 <button 
                    onClick={() => { setApiKey(''); setTempKey(''); }}
                    className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
                 >
                    <Key size={10} />
                    Change API Key
                 </button>
            </div>
         )}
      </div>

      {/* API Key Gating */}
      {!apiKey ? (
          <div className="max-w-md mx-auto w-full mb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
                 <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-cyan-400">
                     <Key size={24} />
                 </div>
                 <h3 className="text-xl font-bold text-white mb-2">Enter Gemini API Key</h3>
                 <p className="text-sm text-slate-400 mb-6">
                     An API key is required to access the AI analysis features. Your key is stored locally in your browser.
                 </p>
                 
                 <form onSubmit={handleSubmitKey} className="flex flex-col gap-3">
                     <input 
                        type="password"
                        value={tempKey}
                        onChange={(e) => setTempKey(e.target.value)}
                        placeholder="Paste your API key here..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                     />
                     <button 
                        type="submit"
                        disabled={!tempKey.trim()}
                        className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                         Start Analyzing
                         <ArrowRight size={16} />
                     </button>
                 </form>
             </div>
          </div>
      ) : (
          <>
            {/* Dropzone */}
            <div 
                className={clsx(
                    "w-full max-w-4xl mx-auto mb-10 border-2 border-dashed rounded-2xl transition-colors duration-300 flex flex-col items-center justify-center h-48 shrink-0 group cursor-pointer animate-in fade-in zoom-in-95",
                    isDragOver ? "border-cyan-500 bg-cyan-950/20" : "border-slate-800 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-900/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
            >
                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer group/upload">
                    <div className="p-4 rounded-full border-2 border-dashed border-slate-700 group-hover/upload:border-slate-500 transition-colors mb-4">
                        <Upload className="w-8 h-8 text-slate-500 group-hover/upload:text-cyan-400 transition-colors" />
                    </div>
                    <span className="text-sm font-medium text-slate-400 group-hover/upload:text-slate-200 transition-colors">Drag audio here or click to upload</span>
                    <p className="text-xs text-slate-600 mt-2">MP3, WAV, AAC</p>
                    <input type="file" className="hidden" multiple accept="audio/*" onChange={handleFileSelect} />
                </label>
            </div>

            {/* Track List */}
            <div className="w-full max-w-5xl mx-auto space-y-3 pb-20">
                {tracks.map((track, index) => (
                    <div 
                        key={track.id} 
                        className="group relative bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all duration-200 shadow-sm"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="flex items-center gap-6">
                            
                            {/* Left: Info */}
                            {/* When analysis is present, shrink the info section to give space to the result */}
                            <div className={clsx(
                                "flex items-center gap-4 min-w-0 transition-all duration-500", 
                                track.aiAnalysis ? "w-1/3 xl:w-1/4" : "flex-1"
                            )}>
                                <div className={clsx(
                                    "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                    track.status === 'done' ? "bg-fuchsia-900/20 text-fuchsia-400" : "bg-slate-800 text-slate-500"
                                )}>
                                    {track.status === 'decoding' ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <Music2 className="w-6 h-6" />
                                    )}
                                </div>
                                
                                <div className="min-w-0">
                                    <h3 className="font-medium text-slate-200 truncate pr-4" title={track.file.name}>
                                        {track.file.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                        <span>{(track.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                        {track.duration && (
                                            <>
                                                <span>•</span>
                                                <span>{formatDuration(track.duration)}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: AI Action / Result */}
                            <div className={clsx(
                                "flex justify-end transition-all duration-500",
                                track.aiAnalysis ? "flex-1" : "shrink-0"
                            )}>
                                {track.aiAnalysis ? (
                                <AnalysisResultCard analysis={track.aiAnalysis} />
                                ) : (
                                    <button
                                        onClick={() => handleAiAnalysis(track.id)}
                                        disabled={track.status === 'decoding' || track.status === 'analyzing_ai' || !track.audioBuffer}
                                        className={clsx(
                                            "flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold border transition-all shadow-lg",
                                            track.status === 'analyzing_ai'
                                                ? "bg-fuchsia-900/20 border-fuchsia-800 text-fuchsia-300 cursor-wait"
                                                : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 hover:bg-slate-700"
                                        )}
                                    >
                                        {track.status === 'analyzing_ai' ? (
                                            <>
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4 text-fuchsia-400" />
                                                Analyze Vibe
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Remove Button */}
                            <button 
                                onClick={() => removeTrack(track.id)}
                                className="p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-950/20 rounded-full transition-colors shrink-0"
                                title="Remove track"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        {track.error && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-900/30">
                                <AlertCircle className="w-3 h-3" />
                                {track.error}
                            </div>
                        )}
                    </div>
                ))}
            </div>
          </>
      )}
    </div>
  );
};