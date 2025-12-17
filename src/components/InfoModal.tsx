
import React, { useEffect } from 'react';
import { X, MousePointer2, Layers, BarChart3, CheckCircle2, AlertTriangle, Info, Activity, Ear, CircleSlash } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Container */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/10">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-fuchsia-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Info className="text-white" size={18} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-white">Usage Guide</h2>
                <p className="text-xs text-slate-400">Keyboard Shortcuts & Terminology</p>
             </div>
           </div>
           <button 
             onClick={onClose}
             className="text-slate-500 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800"
           >
             <X size={20} />
           </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Intro */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
            <h3 className="font-bold text-slate-200 mb-2 flex items-center gap-2">
                <MousePointer2 size={18} className="text-cyan-400" />
                Getting Started
            </h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-400">
                <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                        <span className="text-cyan-500 font-bold">•</span>
                        <span>Drag & Drop audio files directly onto Track A or Track B to load them.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-cyan-500 font-bold">•</span>
                        <span>Click anywhere on the top <strong>Ruler</strong> to seek instantly.</span>
                    </li>
                </ul>
                 <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                        <span className="text-cyan-500 font-bold">•</span>
                        <span>Use the <strong>Crossfader</strong> at the bottom to mix between tracks.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-cyan-500 font-bold">•</span>
                        <span>Switch to <strong>BPM Analyzer</strong> tab for tempo detection logs.</span>
                    </li>
                </ul>
            </div>
          </div>

          {/* Meter Explanations (The core request) */}
          <div>
             <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2 pb-2 border-b border-slate-800">
                <BarChart3 size={18} className="text-fuchsia-400" />
                Audio Meter Reference
            </h3>
            
            <div className="grid md:grid-cols-3 gap-4">
                {/* LUFS */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col h-full hover:border-emerald-500/50 transition-colors group">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-emerald-400">LUFS Meter</h4>
                        <div className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20">LOUDNESS</div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <p className="text-sm text-slate-300 leading-relaxed">
                           Measures the average loudness of the track over time. This is the industry standard.
                        </p>
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs space-y-2">
                             <p className="text-slate-400"><strong className="text-slate-200">Why?</strong> "Is my master hitting -14 LUFS for Spotify or -9 LUFS for CD?"</p>
                             <div className="flex items-center gap-2 text-emerald-400/80 mt-2">
                                <CheckCircle2 size={12} />
                                <span>Green bar = Target Hit (-14)</span>
                             </div>
                        </div>
                    </div>
                </div>

                 {/* True Peak */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col h-full hover:border-rose-500/50 transition-colors group">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-rose-400">True Peak</h4>
                        <div className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[10px] font-bold border border-rose-500/20">CLIPPING</div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <p className="text-sm text-slate-300 leading-relaxed">
                           Detects inter-sample peaks that will clip when converted to analog (DAC).
                        </p>
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs space-y-2">
                             <p className="text-slate-400"><strong className="text-slate-200">Why?</strong> Standard meters miss these. Helps prevent distortion on cheap speakers.</p>
                             <div className="flex items-center gap-2 text-rose-400/80 mt-2">
                                <AlertTriangle size={12} />
                                <span>Red box = Clip Detected</span>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Correlation */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col h-full hover:border-cyan-500/50 transition-colors group">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-cyan-400">Correlation</h4>
                        <div className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-500 text-[10px] font-bold border border-cyan-500/20">PHASE</div>
                    </div>
                    <div className="flex-1 space-y-3">
                        <p className="text-sm text-slate-300 leading-relaxed">
                           A simple bar from -1 to +1 indicating phase relationship.
                        </p>
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs space-y-2">
                             <p className="text-slate-400"><strong className="text-slate-200">Why?</strong> Tells if track vanishes in mono (e.g. phone speakers).</p>
                             <div className="space-y-1 pt-2">
                                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                    <span>-1 (Bad)</span>
                                    <span>0</span>
                                    <span>+1 (Good)</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
                                    <div className="absolute left-1/2 w-0.5 h-full bg-slate-500"></div>
                                    <div className="absolute left-[80%] w-1.5 h-full bg-cyan-500 rounded-full"></div>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>

            </div>
          </div>

          {/* Tools & Views */}
          <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
              <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        <Layers size={16} className="text-slate-400" /> 
                        Difference Overlay
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        The bottom view in Comparator mode shows the <strong>visual difference</strong> between tracks. 
                        If tracks are identical, this area will appear empty/flat. Spikes indicate mastering differences or mix changes.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        <CircleSlash size={16} className="text-rose-400" /> 
                        Differential Mode (Null Test)
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Toggle the <strong>Circle Slash icon</strong> to flip the phase of Track B. 
                        This sums both tracks. If they are identical, you will hear absolute silence. 
                        Anything you do hear is the exact difference between the two files (e.g., reverb tails, compression artifacts).
                    </p>
                  </div>
              </div>
              
              <div className="space-y-4">
                   <div>
                       <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                          <Activity size={16} className="text-slate-400" /> 
                          BPM Analyzer
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                          In Analyzer mode, the <strong>BPM Log</strong> tracks tempo stability. Click the "Lock" icon to toggle auto-scrolling, which keeps the log synced to playback position.
                      </p>
                   </div>
                   <div>
                       <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                          <Ear size={16} className="text-emerald-400" /> 
                          Auto-Gain Match
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                          Toggle the <strong>Ear icon</strong> near the crossfader to automatically normalize volume between tracks. This ensures you compare <strong>quality</strong>, not just loudness.
                      </p>
                   </div>
              </div>
          </div>

        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
           <button 
             onClick={onClose}
             className="px-6 py-2 bg-white text-slate-950 hover:bg-slate-200 rounded-md text-sm font-bold transition-colors shadow-lg shadow-white/5"
           >
             Close Guide
           </button>
        </div>
      </div>
    </div>
  );
};
