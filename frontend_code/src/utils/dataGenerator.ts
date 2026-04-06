

/**
 * Generates a large dataset of time (microseconds) and amplitude.
 * @param count Number of points to generate
 * @returns An array of Point objects
 */
export const generateLargeDataset = (count: number): { x: number[], y1: number[], y2: number[] } => {
  const x: number[] = new Array(count);
  const y1: number[] = new Array(count);
  const y2: number[] = new Array(count);
  
  // Starting timestamp in microseconds (e.g., current time * 1000)
  let currentTs = Date.now() * 1000;
  const step = 10; // 10 microseconds step

  for (let i = 0; i < count; i++) {
    x[i] = currentTs;
    
    // Shift the signal up by 100 to ensure it stays positive (0 to ~170+)
    const baseSignal = 100 + 50 * Math.sin(i / 1000) + 20 * Math.cos(i / 500);
    const noise = Math.random() * 5; // Positive noise
    y1[i] = baseSignal + noise;
    
    // Discrete signal for reference (Pulse width modulation-ish)
    y2[i] = (Math.sin(i / 100) > 0) ? 1 : 0;

    currentTs += step;
  }

  return { x, y1, y2 };
};

/**
 * Formats microseconds into a human-readable duration or timestamp string.
 */
export const formatMicroseconds = (us: number): string => {
  const ms = us / 1000;
  const date = new Date(ms);
  const timeStr = date.toISOString().split('T')[1].replace('Z', '');
  const microsPart = (us % 1000).toString().padStart(3, '0');
  return `${timeStr}.${microsPart}`;
};
