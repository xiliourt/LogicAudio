
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Info, Music, Activity, Sparkles } from 'lucide-react';
import { TrackDeck } from './components/TrackDeck';
import { MixerControls } from './components/Mixer';
import { Ruler } from './components/Ruler';
import { BpmLog } from './components/BpmLog';
import { ResizeHandle } from './components/ResizeHandle';
import { AudioMeter } from './components/AudioMeter';
import { InfoModal } from './components/InfoModal';
import { GenreAnalyzer } from './components/GenreAnalyzer';
import { TrackData, TrackId, WaveSurferInstance, BpmPoint, AnalyzedTrack } from './types';
import { filterAudioBuffer, analyzeBpmFromData } from './utils/bpm';
import { calculateTrackLoudness } from './utils/audioAnalysis';
import { COLOR_TRACK_A, COLOR_TRACK_B } from './constants';
import clsx from 'clsx';
import Footer from './components/Footer';

type ViewMode = 'comparator' | 'analyzer' | 'genre';

// Cache structure for analyzed track data
interface FilteredAudioCache {
    data: Float32Array;
    sampleRate: number;
    duration: number;
}

const App: React.FC = () => {
  // -- View State --
  const [activeTab, setActiveTab] = useState<ViewMode>('comparator');
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // -- Layout State --
  // Percentages for Comparator Mode [TrackA, TrackB, Diff]
  const [compHeights, setCompHeights] = useState([33.33, 33.33, 33.34]);
  // Pixel height for Top Track in Analyzer Mode
  const [analyzerHeight, setAnalyzerHeight] = useState(250);

  // -- Track State --
  // Comparator Tracks
  const [trackA, setTrackA] = useState<TrackData | null>(null);
  const [trackB, setTrackB] = useState<TrackData | null>(null);
  
  // Analyzer Track
  const [trackC, setTrackC] = useState<TrackData | null>(null);
  const [bpmData, setBpmData] = useState<BpmPoint[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [bpmInterval, setBpmInterval] = useState(0); // 0 = Auto

  // Genre Analyzer State (Lifted for persistence)
  const [genreTracks, setGenreTracks] = useState<AnalyzedTrack[]>([]);
  
  // API Key Persistence
  const [userApiKey, setUserApiKey] = useState<string>(() => {
      try {
          return localStorage.getItem('GEMINI_API_KEY') || '';
      } catch (e) {
          return '';
      }
  });

  const handleSetApiKey = (key: string) => {
      setUserApiKey(key);
      localStorage.setItem('GEMINI_API_KEY', key);
  };
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [crossfade, setCrossfade] = useState(0.5); // 0 = A, 1 = B
  
  // Auto-Gain & Diff Mode State
  const [autoGain, setAutoGain] = useState(false);
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [trackGains, setTrackGains] = useState<{A: number, B: number}>({ A: 1, B: 1 });

  // -- Refs & Instances --
  const wsRefA = useRef<WaveSurferInstance | null>(null);
  const wsRefB = useRef<WaveSurferInstance | null>(null);
  const wsRefDiffA = useRef<WaveSurferInstance | null>(null);
  const wsRefDiffB = useRef<WaveSurferInstance | null>(null);
  const wsRefC = useRef<WaveSurferInstance | null>(null); // Analyzer Ref
  
  // State for meters (needs re-render when instance is ready)
  const [wsInstanceA, setWsInstanceA] = useState<WaveSurferInstance | null>(null);
  const [wsInstanceB, setWsInstanceB] = useState<WaveSurferInstance | null>(null);
  const [wsInstanceC, setWsInstanceC] = useState<WaveSurferInstance | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  
  // Shared Audio Context for mixing (Crucial for Differential Mode Null Test)
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Cache for the expensive filtered audio data
  const filteredCacheRef = useRef<FilteredAudioCache | null>(null);

  // Flags
  const isSeekingRef = useRef(false);
  const isSyncingRef = useRef(false);

  // -- Resize Handlers --
  const handleCompResizeStart = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeights = [...compHeights];
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const totalHeight = containerRef.current.clientHeight;
      const deltaPx = moveEvent.clientY - startY;
      const deltaPercent = (deltaPx / totalHeight) * 100;

      const newHeights = [...startHeights];
      
      // index 0: Resizing between A (0) and B (1)
      if (index === 0) {
         // Prevent A from going below 10% and B from going below 10% (relative to their pair sum)
         const min = 10;
         const pairSum = startHeights[0] + startHeights[1];
         
         let newH0 = startHeights[0] + deltaPercent;
         newH0 = Math.max(min, Math.min(newH0, pairSum - min));
         
         newHeights[0] = newH0;
         newHeights[1] = pairSum - newH0;
      } 
      // index 1: Resizing between B (1) and Diff (2)
      else if (index === 1) {
         const min = 10;
         const pairSum = startHeights[1] + startHeights[2];
         
         let newH1 = startHeights[1] + deltaPercent;
         newH1 = Math.max(min, Math.min(newH1, pairSum - min));
         
         newHeights[1] = newH1;
         newHeights[2] = pairSum - newH1;
      }

      setCompHeights(newHeights);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleAnalyzerResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = analyzerHeight;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return;
        const delta = moveEvent.clientY - startY;
        const max = containerRef.current.clientHeight - 100; // Leave 100px for log
        const min = 150;
        
        setAnalyzerHeight(Math.max(min, Math.min(max, startHeight + delta)));
    };

    const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };


  // -- Logic Handlers --

  const resetPlayback = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    // Stop all
    [wsRefA, wsRefB, wsRefDiffA, wsRefDiffB, wsRefC].forEach(ref => {
        ref.current?.stop();
    });
  };

  const handleTabChange = (mode: ViewMode) => {
    resetPlayback();
    setActiveTab(mode);
    // Reset duration based on active tracks
    setTimeout(() => {
        if (mode === 'comparator') {
            const durA = wsRefA.current?.getDuration() || 0;
            const durB = wsRefB.current?.getDuration() || 0;
            setDuration(Math.max(durA, durB));
        } else if (mode === 'analyzer') {
            const durC = wsRefC.current?.getDuration() || 0;
            setDuration(durC);
        } else {
            // Genre mode handles its own duration/playback logic mostly
            setDuration(0);
        }
    }, 100);
  };

  // Two-step analysis:
  // 1. Initial Load: Filter buffer (Slow/Async) -> Store in cache -> Run detection
  // 2. Interval Change: Run detection on cache (Fast/Sync)
  
  const initialTrackAnalysis = async (buffer: AudioBuffer) => {
    setIsAnalyzing(true);
    setBpmData([]); // Clear old data
    try {
        // Step 1: Filter
        const filtered = await filterAudioBuffer(buffer);
        
        // Cache it
        filteredCacheRef.current = {
            data: filtered.data,
            sampleRate: filtered.sampleRate,
            duration: buffer.duration
        };
        
        // Step 2: Detect with current interval
        const points = analyzeBpmFromData(filtered.data, filtered.sampleRate, buffer.duration, bpmInterval);
        setBpmData(points);
        
    } catch (e) {
        console.error("Analysis failed", e);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleBpmIntervalChange = (newInterval: number) => {
    setBpmInterval(newInterval);
    
    // Fast path: use cached filtered data
    if (filteredCacheRef.current) {
        const { data, sampleRate, duration } = filteredCacheRef.current;
        const points = analyzeBpmFromData(data, sampleRate, duration, newInterval);
        setBpmData(points);
    } else {
        // Fallback (shouldn't happen if track loaded)
        if (wsRefC.current) {
            const buffer = wsRefC.current.getDecodedData();
            if (buffer) initialTrackAnalysis(buffer);
        }
    }
  };

  const handleTrackReady = useCallback(async (id: TrackId, instance: WaveSurferInstance) => {
    // Map IDs to refs
    if (id === 'A') {
        wsRefA.current = instance;
        setWsInstanceA(instance);
    }
    else if (id === 'B') {
        wsRefB.current = instance;
        setWsInstanceB(instance);
    }
    else if (id === 'C') {
        wsRefC.current = instance;
        setWsInstanceC(instance);
        // Auto analyze BPM when track C is ready
        const buffer = instance.getDecodedData();
        if (buffer) {
            initialTrackAnalysis(buffer);
        }
    }
    // Diff tracks handled implicitly

    // Note: Volume is now handled by the central useEffect watching state

    // Update Duration
    const dur = instance.getDuration();
    setDuration(d => Math.max(d, dur));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); 

  // -- Auto Gain Calculation Effect --
  useEffect(() => {
    if (!wsInstanceA || !wsInstanceB) {
        setTrackGains({ A: 1, B: 1 });
        return;
    }

    const bufA = wsInstanceA.getDecodedData();
    const bufB = wsInstanceB.getDecodedData();

    if (!bufA || !bufB) return; // Wait for both to be decoded

    const dbA = calculateTrackLoudness(bufA);
    const dbB = calculateTrackLoudness(bufB);

    // Target the quieter track to avoid clipping the louder one by boosting
    const target = Math.min(dbA, dbB);

    // Calculate linear gain factors
    const gainA = Math.pow(10, (target - dbA) / 20);
    const gainB = Math.pow(10, (target - dbB) / 20);

    setTrackGains({ A: gainA, B: gainB });

  }, [wsInstanceA, wsInstanceB]); // Recalculate if instances change (new track loaded)

  // -- Volume & Effects Helper --
  // WaveSurfer v7 doesn't support 'setFilters' on the main instance.
  // We must implement custom routing if we want Phase Inversion.
  const applyVolumeAndPhase = useCallback((ws: WaveSurferInstance | null, volume: number, phase: number = 1, forceGraph: boolean = false) => {
     if (!ws) return;

     const instance = ws as any;
     const media = ws.getMediaElement();
     
     if (!media) return;

     // Ensure we have a shared context for reliable phase cancellation (Null Test)
     // If A and B run on different Contexts, OS mixing latency can break nulling.
     if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
     }
     const ac = audioContextRef.current;

     // Check if we need to upgrade to Web Audio (usually only for phase inversion)
     // OR if we are forcing it (Diff Mode) to ensure latency matching between A and B.
     // Once upgraded, we stay upgraded to avoid recreating graphs constantly.
     if ((forceGraph || phase === -1) && !instance._audioGraph) {
         try {
             // Create graph on shared context
             // Note: createMediaElementSource can only be called ONCE per element. 
             // WaveSurfer creates one if using WebAudio backend, but default is MediaElement backend.
             // We assume default backend here.
             
             // Check if already connected to another context (unlikely unless WaveSurfer changed modes)
             
             const source = ac.createMediaElementSource(media);
             const gainNode = ac.createGain();
             
             source.connect(gainNode);
             gainNode.connect(ac.destination);
             
             instance._audioGraph = { source, gainNode };
         } catch (e) {
             console.warn("Could not create MediaElementSource, possibly already connected.", e);
         }
     }

     if (instance._audioGraph) {
         // Web Audio Mode
         const { gainNode } = instance._audioGraph;
         // Apply volume and phase math. GainNode handles negative values as phase inversion.
         if (gainNode) {
            gainNode.gain.value = volume * phase;
         }
         // Ensure the underlying media element is at full volume so signal reaches the GainNode.
         // (MediaElementSource ignores volume property in spec, but implementations vary, safer to max).
         media.volume = 1;

     } else {
         // Standard Mode
         ws.setVolume(volume);
     }
  }, []);

  // -- Volume & Effects Application Effect --
  useEffect(() => {
     if (activeTab === 'comparator') {
        const gA = autoGain ? trackGains.A : 1;
        const gB = autoGain ? trackGains.B : 1;

        if (isDiffMode) {
             // Differential Mode: 
             // 1. Play both tracks at effective full volume (normalized if autoGain on)
             // 2. Invert Phase of Track B
             // 3. FORCE GRAPH on both to ensure identical processing latency for perfect nulling.
             // 4. Note: Using shared AudioContext inside applyVolumeAndPhase
             
             applyVolumeAndPhase(wsRefA.current, gA, 1, true);
             applyVolumeAndPhase(wsRefB.current, gB, -1, true);

        } else {
             // Normal Mode:
             // 1. Apply Crossfader mixing
             // 2. Ensure Phase Inversion is removed from B (phase = 1)

             applyVolumeAndPhase(wsRefA.current, (1 - crossfade) * gA, 1);
             applyVolumeAndPhase(wsRefB.current, crossfade * gB, 1);
        }
        
        // Ensure ghost tracks for difference are silent
        if (wsRefDiffA.current) wsRefDiffA.current.setVolume(0);
        if (wsRefDiffB.current) wsRefDiffB.current.setVolume(0);

     } else if (activeTab === 'analyzer') {
        // Ensure Analyzer track is audible (tracks start at vol 0 to prevent blasting)
        if (wsRefC.current) wsRefC.current.setVolume(1);
     }
  }, [crossfade, autoGain, trackGains, activeTab, wsInstanceA, wsInstanceB, wsInstanceC, isDiffMode, applyVolumeAndPhase]);


  const handleFileUpload = (id: TrackId, file: File) => {
    const url = URL.createObjectURL(file);
    const newTrack: TrackData = {
      id,
      name: file.name,
      url,
      duration: 0,
    };
    
    if (id === 'A') setTrackA(newTrack);
    else if (id === 'B') setTrackB(newTrack);
    else if (id === 'C') {
        setTrackC(newTrack);
        setBpmData([]); // Reset data immediately
        filteredCacheRef.current = null; // Clear cache
    }
    
    if (!isPlaying) setCurrentTime(0);
  };

  // Helper to act on all active instances
  const activeInstances = useCallback(() => {
    if (activeTab === 'comparator') {
        return [
            wsRefA.current, 
            wsRefB.current, 
            wsRefDiffA.current, 
            wsRefDiffB.current
        ].filter(Boolean) as WaveSurferInstance[];
    } else if (activeTab === 'analyzer') {
        return [wsRefC.current].filter(Boolean) as WaveSurferInstance[];
    }
    return [];
  }, [activeTab]);

  const togglePlay = useCallback(() => {
    const targetState = !isPlaying;
    setIsPlaying(targetState);
    
    const instances = activeInstances();

    // Ensure AudioContext is running (browser autoplay policy)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }

    if (targetState) {
      instances.forEach(ws => {
         ws.setTime(currentTime);
         ws.play();
      });
    } else {
      instances.forEach(ws => ws.pause());
    }
  }, [isPlaying, currentTime, activeInstances]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    activeInstances().forEach(ws => ws.stop());
    setCurrentTime(0);
  }, [activeInstances]);

  const handleSeek = useCallback((progress: number) => {
    isSeekingRef.current = true;
    const time = progress * duration;
    setCurrentTime(time);

    activeInstances().forEach(ws => ws.seekTo(progress));

    setTimeout(() => {
      isSeekingRef.current = false;
    }, 100);
  }, [duration, activeInstances]);

  const handleSkip = useCallback((seconds: number) => {
    if (!duration) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    const progress = newTime / duration;
    handleSeek(progress);
  }, [currentTime, duration, handleSeek]);

  const handleBpmClick = useCallback((time: number) => {
    if (!duration) return;
    const progress = time / duration;
    handleSeek(progress);
  }, [duration, handleSeek]);

  // Sync Logic
  const handleTimeUpdate = useCallback((time: number, sourceId: string) => {
    if (isSeekingRef.current) return;
    if (isSyncingRef.current) return;
    
    // In Analyzer mode, simple pass through
    if (activeTab === 'analyzer') {
        setCurrentTime(time);
        return;
    }
    
    // Genre mode doesn't use the main ruler transport sync in this implementation
    if (activeTab === 'genre') return;

    // Comparator Mode Sync
    const masterId = trackA ? 'A' : 'B';
    
    if (sourceId === masterId) {
        setCurrentTime(time);

        if (isPlaying) {
            const masterWs = sourceId === 'A' ? wsRefA.current : wsRefB.current;
            if (!masterWs) return;

            const masterTime = masterWs.getCurrentTime();
            const others = activeInstances().filter(ws => ws && ws !== masterWs);

            others.forEach(slave => {
                const diff = Math.abs(masterTime - slave.getCurrentTime());
                if (diff > 0.04) { 
                   isSyncingRef.current = true;
                   slave.setTime(masterTime);
                }
            });
            
            if (isSyncingRef.current) {
                setTimeout(() => { isSyncingRef.current = false; }, 10);
            }
        }
    }
  }, [trackA, trackB, isPlaying, activeTab, activeInstances]);

  const handleCrossfadeChange = useCallback((value: number) => {
    setCrossfade(value);
    // Volume application is handled by useEffect now
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-fuchsia-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
             </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight mr-8">Logic<span className="text-slate-400 font-light">Audio</span></h1>
          
          {/* Tabs */}
          <nav className="flex bg-slate-900 rounded-lg p-1 gap-1">
             <button 
                onClick={() => handleTabChange('comparator')}
                className={clsx(
                    "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                    activeTab === 'comparator' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200"
                )}
             >
                <Music size={14} />
                Comparator
             </button>
             <button 
                onClick={() => handleTabChange('analyzer')}
                className={clsx(
                    "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                    activeTab === 'analyzer' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200"
                )}
             >
                <Activity size={14} />
                BPM Analyzer
             </button>
             <button 
                onClick={() => handleTabChange('genre')}
                className={clsx(
                    "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                    activeTab === 'genre' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200"
                )}
             >
                <Sparkles size={14} className="text-fuchsia-400" />
                Genre Analyzer
             </button>
          </nav>
        </div>
        
        <div className="flex gap-2">
           <button 
             onClick={() => setIsInfoOpen(true)}
             className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
           >
             <Info size={20} />
           </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Top Ruler (Shared, but optional for Genre tab) */}
        {activeTab !== 'genre' && (
            <div className="h-12 bg-slate-900 border-b border-slate-800 relative shrink-0 z-20">
            <Ruler 
                duration={duration} 
                currentTime={currentTime} 
                onSeek={handleSeek} 
                playheadMaxLength={activeTab === 'analyzer' ? `${analyzerHeight + 48}px` : undefined}
            />
            </div>
        )}

        <div className="flex-1 flex overflow-hidden relative">
            {/* Tracks Area Container */}
            <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
            
            {/* COMPARATOR VIEW */}
            {activeTab === 'comparator' && (
                <>
                    {/* Track A */}
                    <div 
                        className="relative bg-slate-900/30 overflow-hidden" 
                        style={{ height: `${compHeights[0]}%` }}
                    >
                        <TrackDeck 
                            id="A" 
                            track={trackA} 
                            color={COLOR_TRACK_A}
                            onUpload={(f) => handleFileUpload('A', f)}
                            onReady={handleTrackReady}
                            onTimeUpdate={(t) => handleTimeUpdate(t, 'A')}
                        />
                    </div>
                    
                    <ResizeHandle onMouseDown={(e) => handleCompResizeStart(0, e)} />

                    {/* Track B */}
                    <div 
                        className="relative bg-slate-900/30 overflow-hidden" 
                        style={{ height: `${compHeights[1]}%` }}
                    >
                        <TrackDeck 
                            id="B" 
                            track={trackB} 
                            color={COLOR_TRACK_B}
                            onUpload={(f) => handleFileUpload('B', f)}
                            onReady={handleTrackReady}
                            onTimeUpdate={(t) => handleTimeUpdate(t, 'B')}
                        />
                    </div>

                    <ResizeHandle onMouseDown={(e) => handleCompResizeStart(1, e)} />

                    {/* Difference Overlay */}
                    <div 
                        className="relative bg-black overflow-hidden"
                        style={{ height: `${compHeights[2]}%` }}
                    >
                        <div className="absolute top-3 left-4 z-20 text-xs font-bold text-slate-500 uppercase tracking-wider pointer-events-none">
                            Difference Overlay
                        </div>
                        
                        {/* Track A Ghost */}
                        <div className="absolute inset-0 z-0 opacity-80">
                        <TrackDeck 
                            id="A" 
                            track={trackA} 
                            color={COLOR_TRACK_A}
                            onReady={(id, ws) => { wsRefDiffA.current = ws; ws.setVolume(0); }}
                            readOnly
                        />
                        </div>

                        {/* Track B Ghost */}
                        <div className="absolute inset-0 z-10 mix-blend-difference opacity-100">
                        <TrackDeck 
                            id="B" 
                            track={trackB} 
                            color={COLOR_TRACK_B}
                            onReady={(id, ws) => { wsRefDiffB.current = ws; ws.setVolume(0); }}
                            readOnly
                        />
                        </div>
                    </div>
                </>
            )}

            {/* ANALYZER VIEW */}
            {activeTab === 'analyzer' && (
                <>
                    {/* Track C (Analyzer) */}
                    <div 
                        className="shrink-0 relative bg-slate-900/30 overflow-hidden"
                        style={{ height: analyzerHeight }}
                    >
                        <TrackDeck 
                            id="C" 
                            track={trackC} 
                            color="#a855f7" // Purple-500
                            onUpload={(f) => handleFileUpload('C', f)}
                            onReady={handleTrackReady}
                            onTimeUpdate={(t) => handleTimeUpdate(t, 'C')}
                        />
                        {isAnalyzing && (
                            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-50">
                                <div className="flex flex-col items-center gap-2">
                                    <Activity className="animate-bounce text-fuchsia-500" size={32} />
                                    <span className="text-fuchsia-400 font-mono animate-pulse">Analyzing Audio...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <ResizeHandle onMouseDown={handleAnalyzerResizeStart} />
                    
                    {/* BPM Log */}
                    <div className="flex-1 bg-slate-950 overflow-hidden min-h-[100px]">
                        <BpmLog 
                            data={bpmData} 
                            currentTime={currentTime} 
                            onRowClick={handleBpmClick}
                            interval={bpmInterval}
                            onIntervalChange={handleBpmIntervalChange}
                            hasTrack={!!trackC}
                            isAnalyzing={isAnalyzing}
                        />
                    </div>
                </>
            )}

            {/* GENRE ANALYZER VIEW */}
            {activeTab === 'genre' && (
                <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
                    <GenreAnalyzer 
                        tracks={genreTracks} 
                        setTracks={setGenreTracks}
                        apiKey={userApiKey}
                        setApiKey={handleSetApiKey}
                    />
                </div>
            )}

            </div>

            {/* Meter Bridge (Comparator Only) */}
            {activeTab === 'comparator' && (
                <div className="w-24 bg-slate-950 border-l border-slate-800 flex flex-col z-20 shrink-0">
                    <div className="flex-1 flex flex-col items-center py-2 overflow-hidden gap-1">
                        <span className="text-[10px] font-bold text-cyan-400 tracking-wider">TRACK A</span>
                        <AudioMeter ws={wsInstanceA} className="w-full h-full" />
                    </div>
                    <div className="h-px w-full bg-slate-800" />
                    <div className="flex-1 flex flex-col items-center py-2 overflow-hidden gap-1">
                        <span className="text-[10px] font-bold text-fuchsia-400 tracking-wider">TRACK B</span>
                        <AudioMeter ws={wsInstanceB} className="w-full h-full" />
                    </div>
                </div>
            )}
        </div>

        {/* Bottom Controls Bar (Shared but hidden in Genre view if not needed, or we can keep it for consistent footer feel) */}
        {activeTab !== 'genre' && (
            <div className="h-24 bg-slate-950 border-t border-slate-800 p-4 z-30 flex items-center justify-center gap-8 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] shrink-0">
            <MixerControls 
                isPlaying={isPlaying}
                onPlayPause={togglePlay}
                onStop={handleStop}
                onSkipBackward={() => handleSkip(-10)}
                onSkipForward={() => handleSkip(10)}
                crossfade={crossfade}
                onCrossfadeChange={handleCrossfadeChange}
                currentTime={currentTime}
                duration={duration}
                autoGain={autoGain}
                onToggleAutoGain={() => setAutoGain(!autoGain)}
                isDiffMode={isDiffMode}
                onToggleDiffMode={() => setIsDiffMode(!isDiffMode)}
                showCrossfader={activeTab === 'comparator'}
            />
            </div>
        )}

      </main>
        
      {/* Footer */}
      <Footer git="https://github.com/xiliourt/LogicAudio" />

      {/* Info Modal */}
      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </div>
  );
};

export default App;
