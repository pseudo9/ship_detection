import React, { useMemo, useEffect, useRef } from 'react';
import uPlot from 'uplot';
import UPlotChart from './UPlotChart';
import { formatMicroseconds } from '../../utils/dataGenerator';
import type { WaveformAppProps } from '../../types/index';
import { useAppStore } from '../../stores/useAppStore';
import { getThemeColors } from '../../utils/themeColors';

const WaveformApp: React.FC<WaveformAppProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uPlotInstance = useRef<uPlot | null>(null);
  
  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const colors = getThemeColors(isDark);

  // console.log('Data type of received data in Waveform component:', typeof data);
  // console.log('Received data in Waveform component:', data); // Prepare aligned data for uPlot

  // Tooltip plugin
  const tooltipPlugin = useMemo(() => {
    return () => {
      let tooltipLeftOffset = 0;
      let tooltipTopOffset = 0;

      const tooltip = document.createElement("div");
      tooltip.style.cssText = `
        position: absolute;
        display: none;
        background: rgb(30 41 59);
        color: white;
        font-size: 12px;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid rgb(71 85 105);
        pointer-events: none;
        z-index: 100;
        white-space: pre;
        font-family: monospace;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      `;
      
      let seriesIdx: number | null = 1;
      let dataIdx: number | null = null;
      let over: HTMLElement;
      let tooltipVisible = false;

      function showTooltip() {
        if (!tooltipVisible) {
          tooltip.style.display = "block";
          over.style.cursor = "crosshair";
          tooltipVisible = true;
        }
      }

      function hideTooltip() {
        if (tooltipVisible) {
          tooltip.style.display = "none";
          over.style.cursor = "";
          tooltipVisible = false;
        }
      }

      function setTooltip(u: uPlot) {
        if (seriesIdx === null || dataIdx === null) return;
        
        const amplitude = u.data[seriesIdx][dataIdx];
        const timestamp = u.data[0][dataIdx];
        
        if (amplitude === undefined || amplitude === null || timestamp === undefined || timestamp === null) return;
        
        showTooltip();

        const top = u.valToPos(amplitude, 'y');
        const lft = u.valToPos(timestamp, 'x');

        const tooltipHeight = 70;
        const shiftY = (top < tooltipHeight) ? 10 : -tooltipHeight - 10;
        const shiftX = 10;

        tooltip.style.top = (tooltipTopOffset + top + shiftY) + "px";
        tooltip.style.left = (tooltipLeftOffset + lft + shiftX) + "px";
        
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
        const microseconds = Math.floor((timestamp % 1) * 1000000).toString().padStart(6, '0').slice(3, 6);
        const timeStr = `${hours}:${minutes}:${seconds}.${milliseconds}${microseconds}`;
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        tooltip.textContent = (
          `Date: ${dateStr}\n` +
          `Time: ${timeStr}\n` +
          `Amplitude: ${amplitude.toFixed(2)}`
        );
      }

      return {
        hooks: {
          ready: [
            (u: uPlot) => {
              over = u.over;
              tooltipLeftOffset = parseFloat(over.style.left || '0');
              tooltipTopOffset = parseFloat(over.style.top || '0');
              const wrap = u.root.querySelector(".u-wrap");
              if (wrap) wrap.appendChild(tooltip);
            }
          ],
          setCursor: [
            (u: uPlot) => {
              const c = u.cursor;
              const newIdx = c.idx ?? null;
              
              if (newIdx !== null) {
                dataIdx = newIdx;
                if (seriesIdx !== null) {
                  setTooltip(u);
                }
              } else {
                dataIdx = null;
                hideTooltip();
              }
            }
          ],
          setSeries: [
            (u: uPlot, sidx: number | null) => {
              if (seriesIdx !== sidx) {
                seriesIdx = sidx;
                if (sidx === null) {
                  hideTooltip();
                } else if (dataIdx !== null) {
                  setTooltip(u);
                }
              }
            }
          ]
        }
      };
    };
  }, []);

  const alignedData = useMemo(() => {
    // console.log('Data received in Waveform component:', data);

    // Handle nested data structure where x and y are inside data.data
    const actualData = data?.data || data;
    
    if (!actualData || !actualData.x || !actualData.y) {
      // console.log('Data validation FAILED - no valid x/y arrays found');
      return null;
    }

    // console.log('Data validation PASSED - processing', actualData.x.length, 'points');
    const xValues = actualData.x.map((timestamp: string) => new Date(timestamp).getTime());
    return [xValues, actualData.y] as uPlot.AlignedData;
  }, [data]);

  // Chart options
  const chartOptions: uPlot.Options = useMemo(() => ({
    width: 400,
    height: 200,
    cursor: {
      focus: {
        prox: 100, // Increase proximity detection for better tooltip tracking when zoomed
      },
      drag: {
        setScale: true,
        x: true,
        y: true,
      }
    },
    scales: {
      x: { time: false },
      y: {
        range: (_, min, max) => [min, max] // Dynamically set range based on data
      }
    },
    axes: [
      {
        label: "Time",
        size: 60, // Increase axis height to accommodate two lines
        splits: (u) => {
          const scale = u.scales.x;
          const visibleRange = scale.max - scale.min;
          const step = visibleRange / 5; // Divide the range into 10 evenly spaced points
          return Array.from({ length: 6 }, (_, i) => scale.min + i * step);
        },
        values: (u, splits) => {
          const scale = u.scales.x;
          const visibleRange = scale.max - scale.min;

          if (visibleRange < 1000000) { // If zoomed in to less than 1 second, show microseconds
            // console.log('Rendering microsecond precision');
            return splits.map((v) => {
              const date = new Date(v);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              const seconds = date.getSeconds().toString().padStart(2, '0');
              const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
              const microseconds = Math.floor((v % 1) * 1000000).toString().padStart(6, '0').slice(3, 6);
              return `${hours}:${minutes}:${seconds}.${milliseconds}${microseconds}`;
            });
          } else {
            // console.log('Rendering standard format');
            return splits.map((v) => {
              const date = new Date(v);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              const seconds = date.getSeconds().toString().padStart(2, '0');
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return `${dateStr}\n${hours}:${minutes}:${seconds}`;
            });
          }
        },
        grid: { stroke: colors.gridLine, width: 1 },
        stroke: colors.chartText,
      },
      {
        label: "Amplitude",
        grid: { stroke: colors.gridLine, width: 1 },
        stroke: colors.chartText,
      }
    ],
    series: [
      {},
      {
        label: "Signal",
        stroke: isDark ? "#10b981" : "#0066cc",
        width: 1,
        points: { show: false }
      }
    ],
    plugins: [tooltipPlugin()],
  }), [data, tooltipPlugin, isDark, colors]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        uPlotInstance.current?.setSize({ width, height });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial resize

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (alignedData) {
      // console.log('Rendering data:', alignedData);
    }
  }, [alignedData]);

  useEffect(() => {
    // console.log('WaveformApp component is called');
    const actualData = data?.data || data;
    if (actualData && actualData.x && actualData.y) {
      // console.log('First 10 elements of data:', {
      //   x: actualData.x.slice(0, 10),
      //   y: actualData.y.slice(0, 10),
      // });
    } else {
      // console.log('Data is undefined or incomplete');
    }
  }, [data]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex flex-col" 
      style={{ 
        overflowY: 'auto',
        background: colors.chartBg,
        transition: 'background 0.3s ease'
      }}
    >
      <div 
        className="w-full h-full rounded-lg border shadow-xl overflow-hidden relative"
        style={{
          background: colors.chartBg,
          borderColor: colors.border,
          transition: 'all 0.3s ease'
        }}
      >
        {alignedData ? (
          <UPlotChart 
            data={alignedData} 
            options={{
              ...chartOptions,
              width: containerRef.current?.clientWidth || chartOptions.width,
              height: containerRef.current?.clientHeight || chartOptions.height,
            }} 
            className="w-full h-full"
          />
        ) : (
          <div 
            className="text-center"
            style={{ color: colors.textSecondary }}
          >
            No data to display
          </div>
        )}
      </div>
      <div 
        className="py-2 text-xs flex justify-between"
        style={{ 
          color: colors.textSecondary,
          transition: 'color 0.3s ease'
        }}
      >
        <div className="flex gap-4">
          <span>{(data?.data?.x || data?.x)?.length.toLocaleString() || 0} data points rendered</span>
        </div>
        <span>Drag to Zoom • Shift + Drag to Pan • Double-click to Reset</span>
      </div>
    </div>
  );
};

export default WaveformApp;

