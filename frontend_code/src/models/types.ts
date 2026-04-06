
import uPlot from 'uplot';

export interface ChartData {
  x: number[];
  y: number[][];
}

export interface UPlotChartProps {
  data: uPlot.AlignedData;
  options: uPlot.Options;
  onInit?: (u: uPlot) => void;
  className?: string;
}

export interface Point {
  timestamp: number;
  value: number;
}

