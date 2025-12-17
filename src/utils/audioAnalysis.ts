
/**
 * Calculates the approximate RMS loudness of an AudioBuffer in dB.
 * Scans all channels and averages the power.
 * Uses a stride to ensure performance on long tracks.
 */
export function calculateTrackLoudness(buffer: AudioBuffer): number {
    const numChannels = buffer.numberOfChannels;
    const len = buffer.length;
    // Analyze a significant portion but skip samples for performance (stride).
    // Stride of 1000 on 44.1k = every ~22ms sampled. Sufficient for global RMS.
    const stride = 1000; 
    
    let sumSq = 0;

    for (let c = 0; c < numChannels; c++) {
        const data = buffer.getChannelData(c);
        let chanSum = 0;
        let count = 0;
        for (let i = 0; i < len; i += stride) {
            chanSum += data[i] * data[i];
            count++;
        }
        if (count > 0) {
            sumSq += (chanSum / count);
        }
    }
    
    // Average power across channels
    const avgPower = sumSq / numChannels;
    const rms = Math.sqrt(avgPower);
    
    // Floor at -100dB to handle silence
    if (rms < 0.00001) return -100;
    
    return 20 * Math.log10(rms);
}

// Standard Audio Context - Singleton lazy init
let audioCtx: AudioContext | null = null;

export const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

export const decodeAudioData = async (file: File): Promise<AudioBuffer> => {
  const ctx = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();
  return await ctx.decodeAudioData(arrayBuffer);
};
