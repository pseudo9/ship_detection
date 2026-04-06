import React, { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import type { UPlotChartProps } from '../../models/types';
/**
 * Panning Plugin for uPlot.
 * Enables panning when holding Shift + Click/Drag.
 */
function panPlugin() {
  return {
    hooks: {
      init: (u: uPlot) => {
        let dragging = false;
        let lastX: number | null = null;
        let lastY: number | null = null;

        const over = u.over;

        over.addEventListener("mousedown", (e: MouseEvent) => {
          if (e.shiftKey) {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            // Disable native zoom selection when panning
            // Commented out zoom-related functionality for now
            u.cursor.drag!.setScale = false;
          } else {
            u.cursor.drag!.setScale = true;
          }
        });

        window.addEventListener("mousemove", (e: MouseEvent) => {
          if (dragging && lastX !== null && lastY !== null) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;

            if (dx !== 0 || dy !== 0) {
              const xRange = u.scales.x.max! - u.scales.x.min!;
              const yRange = u.scales.y.max! - u.scales.y.min!;

              const xUnitPerPx = xRange / u.bbox.width;
              const yUnitPerPx = yRange / u.bbox.height;

              u.batch(() => {
                u.setScale("x", {
                  min: u.scales.x.min! - dx * xUnitPerPx,
                  max: u.scales.x.max! - dx * xUnitPerPx,
                });
                u.setScale("y", {
                  min: u.scales.y.min! + dy * yUnitPerPx,
                  max: u.scales.y.max! + dy * yUnitPerPx,
                });
              });

              lastX = e.clientX;
              lastY = e.clientY;
            }
          }
        });

        window.addEventListener("mouseup", () => {
          dragging = false;
          lastX = null;
          lastY = null;
        });
      }
    }
  };
}

const UPlotChart: React.FC<UPlotChartProps> = ({ data, options, onInit, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uPlotInstance = useRef<uPlot | null>(null);

  // Initialization and re-initialization when options change (for theme changes)
  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy existing instance if it exists
    if (uPlotInstance.current) {
      uPlotInstance.current.destroy();
    }

    const finalOptions = {
      ...options,
      plugins: [
        ...(options.plugins || []),
        panPlugin()
      ]
    };

    const u = new uPlot(finalOptions, data, containerRef.current);
    uPlotInstance.current = u;

    if (onInit) onInit(u);

    return () => {
      if (uPlotInstance.current) {
        uPlotInstance.current.destroy();
        uPlotInstance.current = null;
      }
    };
  }, [options, data]); // Re-create when options or data change

  // Handle resizing to parent container
  useEffect(() => {
    const handleResize = () => {
      if (uPlotInstance.current && containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          uPlotInstance.current.setSize({
            width: parent.clientWidth,
            height: parent.clientHeight
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div ref={containerRef} className={`uplot-wrapper ${className || ''}`} />;
};

export default UPlotChart;
