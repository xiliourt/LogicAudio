import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { COLOR_WAVE_PROGRESS } from '../constants';

interface RulerProps {
  duration: number;
  currentTime: number;
  onSeek: (progress: number) => void;
  playheadMaxLength?: string;
}

export const Ruler: React.FC<RulerProps> = ({ duration, currentTime, onSeek, playheadMaxLength }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Helper to calculate progress from event
  const getProgress = (clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    onSeek(getProgress(e.clientX));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        onSeek(getProgress(e.clientX));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onSeek]);

  // Draw the static ruler (Ticks and Numbers)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || duration <= 0) return;

    const width = containerRef.current.clientWidth;
    const height = 48;
    const svg = d3.select(svgRef.current);
    
    svg.selectAll('*').remove(); // Clear previous

    // Scale
    const xScale = d3.scaleLinear()
      .domain([0, duration])
      .range([0, width]);

    // Axis
    const axis = d3.axisBottom(xScale)
      .tickFormat((d) => {
        const s = d as number;
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
      })
      .ticks(width / 100) // responsive ticks
      .tickSize(8)
      .tickPadding(8);

    const g = svg.append('g')
      .attr('class', 'axis text-slate-500 text-xs select-none')
      .call(axis);
      
    g.select('.domain').remove(); // Remove bottom line
    g.selectAll('.tick line').attr('stroke', '#334155');
    g.selectAll('.tick text').attr('fill', '#64748b');

  }, [duration]); // Only redraw if duration changes (or resize)

  // Draw dynamic Playhead
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || duration <= 0) return;
    
    const width = containerRef.current.clientWidth;
    const svg = d3.select(svgRef.current);
    const xPos = (currentTime / duration) * width;

    // Remove old playhead
    svg.select('.playhead').remove();

    const marker = svg.append('g')
       .attr('class', 'playhead')
       .attr('transform', `translate(${xPos}, 0)`);

    // Triangle
    marker.append('path')
       .attr('d', 'M -6 0 L 6 0 L 0 8 Z')
       .attr('fill', COLOR_WAVE_PROGRESS);

    // Line Indicator inside the Ruler
    marker.append('line')
        .attr('y1', 0)
        .attr('y2', 48)
        .attr('stroke', COLOR_WAVE_PROGRESS)
        .attr('stroke-width', 1)
        .attr('opacity', 0.5);

  }, [currentTime, duration]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full cursor-pointer hover:bg-slate-800/30 transition-colors"
      onMouseDown={handleMouseDown}
    >
      <svg ref={svgRef} className="w-full h-full overflow-visible pointer-events-none" />
      {/* Visual Playhead Line that spans the screen or limited height */}
      {duration > 0 && (
        <div 
            className="absolute top-0 w-px bg-white pointer-events-none z-30 shadow-[0_0_10px_rgba(255,255,255,0.5)] mix-blend-overlay"
            style={{ 
                left: `${(currentTime / duration) * 100}%`,
                opacity: 0.6,
                height: playheadMaxLength || '200vh'
            }} 
        />
      )}
    </div>
  );
};