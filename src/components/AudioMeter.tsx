import React, { useEffect, useRef } from 'react';
import { WaveSurferInstance } from '../types';

interface AudioMeterProps {
  ws: WaveSurferInstance | null;
  className?: string;
}

export const AudioMeter: React.FC<AudioMeterProps> = ({ ws, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;

    // State for smooth falloff
    let peakVal = -60;
    let lufsVal = -60;
    let corrVal = 1;

    const draw = () => {
      // 1. Acquire Data
      let currentPeak = -60;
      let currentLufs = -60; // Approximate via RMS
      let currentCorr = 1;

      if (ws && ws.isPlaying()) {
        const buffer = ws.getDecodedData();
        const currentTime = ws.getCurrentTime();
        
        if (buffer) {
          const sampleRate = buffer.sampleRate;
          // Analyze 50ms window
          const startSample = Math.floor(currentTime * sampleRate);
          const endSample = startSample + Math.floor(0.05 * sampleRate);
          
          if (endSample < buffer.length) {
            const ch0 = buffer.getChannelData(0).subarray(startSample, endSample);
            // Handle Stereo for correlation, fallback to Mono (ch0) if mono file
            const ch1 = buffer.numberOfChannels > 1 
                ? buffer.getChannelData(1).subarray(startSample, endSample) 
                : ch0;
            
            // Calculate Metrics
            let sumSqL = 0;
            let sumSqR = 0;
            let sumProd = 0;
            let maxAmp = 0;

            for (let i = 0; i < ch0.length; i++) {
              const sL = ch0[i];
              const sR = ch1[i];
              
              const absL = Math.abs(sL);
              const absR = Math.abs(sR);
              if (absL > maxAmp) maxAmp = absL;
              if (absR > maxAmp) maxAmp = absR;

              sumSqL += sL * sL;
              sumSqR += sR * sR;
              sumProd += sL * sR;
            }

            // True Peak (dB)
            // True peak is theoretically higher than sample peak, but sample peak is standard for simple meters.
            currentPeak = maxAmp > 0 ? 20 * Math.log10(maxAmp) : -60;

            // LUFS (Proxy via RMS dB)
            const rms = Math.sqrt((sumSqL + sumSqR) / (2 * ch0.length));
            currentLufs = rms > 0 ? 20 * Math.log10(rms) : -60;

            // Correlation
            // formula: sum(L*R) / sqrt(sum(L^2)*sum(R^2))
            const denominator = Math.sqrt(sumSqL * sumSqR);
            if (denominator > 0.000001) {
                currentCorr = sumProd / denominator;
            }
          }
        }
      }

      // 2. Smooth Physics (Falloff)
      peakVal = Math.max(currentPeak, peakVal - 1.5); // Fast attack, slowish decay
      lufsVal = (lufsVal * 0.95) + (currentLufs * 0.05); // Slow smoothing
      corrVal = (corrVal * 0.9) + (currentCorr * 0.1);

      // 3. Render
      ctx.clearRect(0, 0, width, height);
      
      const bottomAreaHeight = 12; // Height for correlation bar
      const meterHeight = height - bottomAreaHeight - 4;
      const meterWidth = (width - 6) / 2; // 2 bars with gap

      // -- Helper: dB to Y position --
      // Range: 0dB (top) to -60dB (bottom)
      const dbToY = (db: number) => {
        const clamped = Math.max(-60, Math.min(3, db)); // Allow up to +3 visual
        const percent = (clamped - 3) / (-60 - 3); // 0 at +3, 1 at -60
        return percent * meterHeight;
      };

      // -- DRAW LUFS (Left Bar) --
      const lufsY = dbToY(lufsVal);
      ctx.fillStyle = '#1e293b'; // bg
      ctx.fillRect(0, 0, meterWidth, meterHeight);
      
      // Target Zone (-14 LUFS)
      const targetY = dbToY(-14);
      ctx.fillStyle = '#10b981'; // Green target line
      ctx.fillRect(0, targetY, meterWidth, 1);

      // Bar
      // Gradient: Green (-14) -> Yellow (-8) -> Red (0)
      const gradL = ctx.createLinearGradient(0, 0, 0, meterHeight);
      gradL.addColorStop(0, '#ef4444');    // Red at top
      gradL.addColorStop(0.2, '#eab308');  // Yellow
      gradL.addColorStop(0.4, '#10b981');  // Green at -14ish
      gradL.addColorStop(1, '#064e3b');    // Dark green
      
      ctx.fillStyle = gradL;
      ctx.fillRect(0, lufsY, meterWidth, meterHeight - lufsY);
      
      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText('LUFS', 0, height - bottomAreaHeight - 6);


      // -- DRAW PEAK (Right Bar) --
      const peakY = dbToY(peakVal);
      const x2 = meterWidth + 4;
      
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x2, 0, meterWidth, meterHeight);

      // Clip indicator (Top box)
      if (peakVal > -0.1) {
         ctx.fillStyle = '#ef4444'; // Red clip
         ctx.fillRect(x2, 0, meterWidth, 4);
      }

      // Bar
      const gradP = ctx.createLinearGradient(0, 0, 0, meterHeight);
      gradP.addColorStop(0, '#f43f5e'); // Rose
      gradP.addColorStop(1, '#3b82f6'); // Blue

      ctx.fillStyle = gradP;
      ctx.fillRect(x2, peakY, meterWidth, meterHeight - peakY);

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('PEAK', x2, height - bottomAreaHeight - 6);


      // -- DRAW CORRELATION (Bottom) --
      // Range -1 (Left) to +1 (Right). 0 is center.
      const cy = height - 6;
      const cw = width;
      
      // Bg line
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, cy, cw, 2);
      
      // Center marker
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(cw/2, cy - 2, 1, 6);

      // Value pill
      const cx = (corrVal + 1) / 2 * cw; // Map -1..1 to 0..width
      
      ctx.fillStyle = corrVal < 0 ? '#ef4444' : '#22d3ee';
      ctx.beginPath();
      ctx.arc(cx, cy + 1, 3, 0, Math.PI * 2);
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(rafRef.current);
  }, [ws]);

  return <canvas ref={canvasRef} className={className} />;
};
