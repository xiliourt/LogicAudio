
import { BpmPoint } from '../types';

/**
 * Filters the audio buffer using an OfflineAudioContext to isolate beat frequencies.
 * This is the expensive operation and should only be done once per track load.
 */
export async function filterAudioBuffer(audioBuffer: AudioBuffer): Promise<{ data: Float32Array; sampleRate: number }> {
  // Use OfflineAudioContext to process audio faster than real-time
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  
  // 1. Highpass to remove DC offset and rumble
  const highpass = offlineCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 40;
  highpass.Q.value = 1;

  // 2. Lowpass filter to isolate kick/snare frequencies.
  // PREVIOUS: 120Hz (Kick only). 
  // NEW: 400Hz. This captures the fundamental of the Snare (~200-250Hz) 
  // which provides the crucial backbeat (2 & 4) for locking tempo correctly.
  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 400; 
  lowpass.Q.value = 1;
  
  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(offlineCtx.destination);
  source.start(0);
  
  const renderedBuffer = await offlineCtx.startRendering();
  return {
    data: renderedBuffer.getChannelData(0),
    sampleRate: renderedBuffer.sampleRate
  };
}

/**
 * Analyzes BPM from pre-filtered PCM data.
 * This is fast and can be re-run with different intervals instantly.
 */
export function analyzeBpmFromData(data: Float32Array, sampleRate: number, duration: number, interval: number = 2): BpmPoint[] {
  const points: BpmPoint[] = [];
  
  // Logic for Auto Interval (0) -> default to 30s steps
  const step = interval === 0 ? 30 : interval;

  // Force a minimum window size of 30s for stability.
  // This ensures that even short interval checks look at enough context.
  const windowSize = Math.max(step, 30); 
  
  for (let startTime = 0; startTime < duration; startTime += step) {
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(Math.min(startTime + windowSize, duration) * sampleRate);
    
    // Skip if segment is too short to be reliable
    if (endSample - startSample < sampleRate * 5) continue;
    
    const slice = data.slice(startSample, endSample);
    const bpm = detectBpmInChunk(slice, sampleRate);
    
    if (bpm) {
      points.push({
        time: startTime,
        bpm: bpm
      });
    } else if (points.length > 0) {
        // Carry forward previous if detection fails
        points.push({
            time: startTime,
            bpm: points[points.length - 1].bpm
        });
    }
  }
  
  return points;
}

/**
 * Robust BPM detection using Autocorrelation of the ONSET Envelope.
 * - Uses Onset (Flux) instead of raw RMS to handle sustain/bass muddiness.
 * - Captures Snare info for better backbeat locking.
 * - Applies perceptual weighting to resolve harmonics.
 */
function detectBpmInChunk(data: Float32Array, sampleRate: number): number | null {
  // 1. Downsample
  // Target ~172Hz control rate (44100 / 256)
  const downsampleRatio = 256; 
  const envelopeRate = sampleRate / downsampleRatio;
  const envelopeLength = Math.ceil(data.length / downsampleRatio);
  
  // 2. Compute RMS Envelope
  const envelope = new Float32Array(envelopeLength);
  for (let i = 0; i < envelopeLength; i++) {
      let sumSq = 0;
      const start = i * downsampleRatio;
      const end = Math.min(start + downsampleRatio, data.length);
      for (let j = start; j < end; j++) {
          sumSq += data[j] * data[j];
      }
      envelope[i] = Math.sqrt(sumSq / (end - start));
  }

  // 3. Compute Onset Envelope (Spectral Flux / Difference)
  // This is CRITICAL. It differentiates the signal, turning "hills" of volume
  // into "spikes" of change. This sharpens the beat significantly.
  const onset = new Float32Array(envelopeLength);
  for (let i = 1; i < envelopeLength; i++) {
      // Half-wave rectified first difference
      const diff = envelope[i] - envelope[i-1];
      onset[i] = Math.max(0, diff); 
  }

  // 4. Autocorrelation
  // BPM range: 55 to 190 (Wider range to catch slow Hip Hop or fast DnB)
  const minBpm = 55;
  const maxBpm = 190;
  
  const minLag = Math.floor((60 / maxBpm) * envelopeRate);
  const maxLag = Math.floor((60 / minBpm) * envelopeRate);

  let maxWeightedCorr = -1;
  let bestLag = -1;

  // Search lags
  for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      // Autocorrelate the ONSET signal
      for (let i = 0; i < envelopeLength - lag; i++) {
          sum += onset[i] * onset[i + lag];
      }
      
      const bpm = 60 * envelopeRate / lag;
      
      // WEIGHTING:
      // Gaussian centered at 110 BPM.
      // Sigma increased to 0.6 (was 0.5) to be slightly less aggressive,
      // allowing 90-100 BPM tracks to compete better against 120 BPM artifacts.
      // 110 is a good "Pop Center".
      const weight = Math.exp( -Math.pow(Math.log2(bpm / 110), 2) / 0.6 );
      
      const weightedSum = sum * weight;

      if (weightedSum > maxWeightedCorr) {
          maxWeightedCorr = weightedSum;
          bestLag = lag;
      }
  }

  if (bestLag === -1) return null;

  // 5. Parabolic Interpolation for decimal precision
  let refinedLag = bestLag;
  
  // Helper to get raw correlation at a specific lag
  const getCorrAt = (l: number) => {
      let s = 0;
      for (let i = 0; i < envelopeLength - l; i++) {
          s += onset[i] * onset[i + l];
      }
      return s;
  };

  const y1 = getCorrAt(bestLag - 1);
  const y2 = getCorrAt(bestLag); 
  const y3 = getCorrAt(bestLag + 1);
  
  const denominator = y1 - 2 * y2 + y3;
  if (Math.abs(denominator) > 0.00001) {
       refinedLag = bestLag + 0.5 * (y1 - y3) / denominator;
  }

  let detectedBpm = 60 * envelopeRate / refinedLag;

  // Clamp
  if (detectedBpm < minBpm) detectedBpm = minBpm;
  if (detectedBpm > maxBpm) detectedBpm = maxBpm;

  return detectedBpm;
}
