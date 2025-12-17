
export type TrackId = 'A' | 'B' | 'C';

export interface TrackData {
  id: TrackId;
  name: string;
  url: string;
  duration: number;
}

export interface BpmPoint {
  time: number;
  bpm: number;
}

// Minimal definition for WaveSurfer instance to avoid full type import issues in global scope if library not fully typed in env
export interface WaveSurferInstance {
  play: () => void;
  pause: () => void;
  stop: () => void;
  setTime: (time: number) => void;
  seekTo: (progress: number) => void;
  setVolume: (vol: number) => void;
  load: (url: string) => Promise<void>;
  destroy: () => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  un: (event: string, callback: (...args: any[]) => void) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  isPlaying: () => boolean;
  getDecodedData: () => AudioBuffer | null;
  // Added for Differential Mode (Phase Inversion)
  getMediaElement: () => HTMLMediaElement;
}

// Genre Analyzer Types
export interface AiAnalysisResult {
  genre: string;
  mood: string;
  key: string;
  musicalDescription: string;
}

export interface AnalyzedTrack {
  id: string;
  file: File;
  status: 'idle' | 'decoding' | 'analyzing_ai' | 'done' | 'error';
  duration?: number;
  aiAnalysis?: AiAnalysisResult;
  error?: string;
  audioBuffer?: AudioBuffer;
}
