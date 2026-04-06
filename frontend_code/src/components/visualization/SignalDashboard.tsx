import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { getThemeColors } from '../../utils/themeColors';
import { generateReport, type ReportData, type ShipReport } from '../../api/WaveFormApi';

// ─── Color palette for ships ─────────────────────────────────────────────────
const SHIP_COLORS = [
  '#00d4ff', '#00ff88', '#ffc107', '#ff6b6b', '#a78bfa',
  '#fb923c', '#34d399', '#f472b6', '#60a5fa', '#facc15',
  '#4ade80', '#f87171', '#c084fc', '#38bdf8', '#fbbf24',
];
const shipColor = (idx: number) => SHIP_COLORS[idx % SHIP_COLORS.length];

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScatterPoint {
  x: number; // rotation time (s)
  y: number; // pulse width mode (μs)
  prt: number; // pulse repetition time (μs)
  mmsi: string;
  radarIdx: number;
  shipIdx: number;
  color: string;
}

// ─── Canvas Scatter Plot ──────────────────────────────────────────────────────
const ScatterPlot = ({
  points,
  isDark,
  width,
  height,
}: {
  points: ScatterPoint[];
  isDark: boolean;
  width: number;
  height: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: ScatterPoint } | null>(null);

  const PAD = { top: 30, right: 20, bottom: 50, left: 60 };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = width;
    const H = height;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    // Data ranges
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.max(0, Math.min(...xs) - 0.2);
    const maxX = Math.max(...xs) + 0.2;
    const minY = Math.max(0, Math.min(...ys) - 20);
    const maxY = Math.max(...ys) + 20;

    const toCanvasX = (v: number) => PAD.left + ((v - minX) / (maxX - minX)) * plotW;
    const toCanvasY = (v: number) => PAD.top + plotH - ((v - minY) / (maxY - minY)) * plotH;

    // Background
    ctx.fillStyle = isDark ? '#060d18' : '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = isDark ? 'rgba(0,212,255,0.08)' : 'rgba(0,102,204,0.1)';
    ctx.lineWidth = 1;
    const xTicks = 6, yTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const xv = minX + (i / xTicks) * (maxX - minX);
      const cx = toCanvasX(xv);
      ctx.beginPath(); ctx.moveTo(cx, PAD.top); ctx.lineTo(cx, PAD.top + plotH); ctx.stroke();
      ctx.fillStyle = isDark ? 'rgba(154,165,177,0.8)' : '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(xv.toFixed(1), cx, PAD.top + plotH + 16);
    }
    for (let i = 0; i <= yTicks; i++) {
      const yv = minY + (i / yTicks) * (maxY - minY);
      const cy = toCanvasY(yv);
      ctx.beginPath(); ctx.moveTo(PAD.left, cy); ctx.lineTo(PAD.left + plotW, cy); ctx.stroke();
      ctx.fillStyle = isDark ? 'rgba(154,165,177,0.8)' : '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(yv.toFixed(0), PAD.left - 8, cy + 4);
    }

    // Axis labels
    ctx.fillStyle = isDark ? '#9aa5b1' : '#475569';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Rotation Time (s)', PAD.left + plotW / 2, H - 6);
    ctx.save();
    ctx.translate(14, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Pulse Width Mode (μs)', 0, 0);
    ctx.restore();

    // Axis lines
    ctx.strokeStyle = isDark ? 'rgba(0,212,255,0.3)' : 'rgba(0,102,204,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, PAD.top + plotH);
    ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
    ctx.stroke();

    // Points
    points.forEach(pt => {
      const cx = toCanvasX(pt.x);
      const cy = toCanvasY(pt.y);
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Outline
      ctx.strokeStyle = isDark ? '#060d18' : '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [points, isDark, width, height]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.max(0, Math.min(...xs) - 0.2);
    const maxX = Math.max(...xs) + 0.2;
    const minY = Math.max(0, Math.min(...ys) - 20);
    const maxY = Math.max(...ys) + 20;
    const toCanvasX = (v: number) => PAD.left + ((v - minX) / (maxX - minX)) * plotW;
    const toCanvasY = (v: number) => PAD.top + plotH - ((v - minY) / (maxY - minY)) * plotH;

    let closest: ScatterPoint | null = null;
    let minDist = Infinity;
    points.forEach(pt => {
      const dx = toCanvasX(pt.x) - mx;
      const dy = toCanvasY(pt.y) - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) { minDist = d; closest = pt; }
    });
    if (minDist < 20 && closest) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, point: closest });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 12,
          top: tooltip.y - 10,
          background: isDark ? 'rgba(5,15,30,0.97)' : 'rgba(248,250,252,0.97)',
          border: `1px solid ${tooltip.point.color}`,
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          color: isDark ? '#e0e6ed' : '#1a202c',
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: `0 0 12px ${tooltip.point.color}44`,
          whiteSpace: 'nowrap',
        }}>
          <div style={{ color: tooltip.point.color, fontWeight: 700, marginBottom: 4 }}>
            MMSI: {tooltip.point.mmsi}
          </div>
          <div>Radar #{tooltip.point.radarIdx + 1}</div>
          <div>Pulse Width: <strong>{tooltip.point.y.toFixed(1)} μs</strong></div>
          <div>Rotation Time: <strong>{tooltip.point.x.toFixed(3)} s</strong></div>
          <div>PRT: <strong>{tooltip.point.prt.toFixed(1)} μs</strong></div>
        </div>
      )}
    </div>
  );
};

// ─── Canvas Histogram ─────────────────────────────────────────────────────────
const Histogram = ({
  values,
  label,
  unit,
  color,
  isDark,
  width,
  height,
  bins = 15,
}: {
  values: number[];
  label: string;
  unit: string;
  color: string;
  isDark: boolean;
  width: number;
  height: number;
  bins?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || values.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const PAD = { top: 20, right: 16, bottom: 44, left: 48 };
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;

    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const binSize = (maxV - minV) / bins || 1;
    const counts = Array(bins).fill(0);
    values.forEach(v => {
      const b = Math.min(bins - 1, Math.floor((v - minV) / binSize));
      counts[b]++;
    });
    const maxCount = Math.max(...counts);

    // Background
    ctx.fillStyle = isDark ? '#060d18' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Bars
    const barW = plotW / bins - 2;
    counts.forEach((count, i) => {
      const barH = (count / maxCount) * plotH;
      const x = PAD.left + i * (plotW / bins) + 1;
      const y = PAD.top + plotH - barH;

      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      const grad = ctx.createLinearGradient(x, y, x, PAD.top + plotH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '33');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Grid lines
    ctx.strokeStyle = isDark ? 'rgba(0,212,255,0.08)' : 'rgba(0,102,204,0.1)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const cy = PAD.top + plotH * (1 - f);
      ctx.beginPath(); ctx.moveTo(PAD.left, cy); ctx.lineTo(PAD.left + plotW, cy); ctx.stroke();
      ctx.fillStyle = isDark ? 'rgba(154,165,177,0.8)' : '#64748b';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxCount * f).toString(), PAD.left - 4, cy + 3);
    });

    // X axis ticks
    ctx.fillStyle = isDark ? 'rgba(154,165,177,0.8)' : '#64748b';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
      const v = minV + f * (maxV - minV);
      const cx = PAD.left + f * plotW;
      ctx.fillText(v.toFixed(1), cx, PAD.top + plotH + 14);
    });

    // Axis lines
    ctx.strokeStyle = isDark ? 'rgba(0,212,255,0.3)' : 'rgba(0,102,204,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, PAD.top + plotH);
    ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
    ctx.stroke();

    // X label
    ctx.fillStyle = isDark ? '#9aa5b1' : '#475569';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${label} (${unit})`, PAD.left + plotW / 2, height - 4);

    // Y label
    ctx.save();
    ctx.translate(12, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Count', 0, 0);
    ctx.restore();

  }, [values, isDark, width, height, bins, color, label, unit]);

  return <canvas ref={canvasRef} style={{ width: '100%', height }} />;
};

// ─── Per-ship signal card ─────────────────────────────────────────────────────
const ShipSignalCard = ({
  ship,
  idx,
  isDark,
  colors,
}: {
  ship: ShipReport;
  idx: number;
  isDark: boolean;
  colors: ReturnType<typeof getThemeColors>;
}) => {
  const color = shipColor(idx);
  const [open, setOpen] = useState(false);

  const avgPW = ship.fingerprints.length
    ? ship.fingerprints.reduce((a, f) => a + (f.pulse_width_mode ?? 0), 0) / ship.fingerprints.length
    : null;
  const avgRT = ship.fingerprints.length
    ? ship.fingerprints.reduce((a, f) => a + (f.est_radar_rotation_time ?? 0), 0) / ship.fingerprints.length
    : null;
  const avgPRT = ship.fingerprints.length
    ? ship.fingerprints.reduce((a, f) => a + (f.pulse_repetition_time_micro_s ?? 0), 0) / ship.fingerprints.length
    : null;

  return (
    <div style={{
      border: `1px solid ${color}44`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
      overflow: 'hidden',
      background: isDark ? 'rgba(6,13,24,0.7)' : 'rgba(255,255,255,0.9)',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
          cursor: 'pointer', userSelect: 'none',
          background: isDark ? 'rgba(10,22,40,0.6)' : 'rgba(241,245,249,0.8)',
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: `${color}22`, border: `2px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800, color, flexShrink: 0,
        }}>{idx + 1}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: colors.text }}>
            MMSI <span style={{ color, fontFamily: 'monospace' }}>{ship.mmsi}</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: colors.textSecondary }}>
            {ship.overlap_start ?? '–'} → {ship.overlap_end ?? '–'} &nbsp;·&nbsp; {ship.fingerprints.length} radar{ship.fingerprints.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Summary pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {[
            { label: 'PW', val: avgPW, unit: 'μs', c: '#00d4ff' },
            { label: 'RT', val: avgRT, unit: 's', c: '#00ff88' },
            { label: 'PRT', val: avgPRT, unit: 'μs', c: '#ffc107' },
          ].map(({ label, val, unit, c }) => (
            <div key={label} style={{
              padding: '2px 8px', borderRadius: 10,
              background: `${c}18`, border: `1px solid ${c}44`,
              fontSize: '0.68rem', color: c, fontFamily: 'monospace', fontWeight: 700,
            }}>
              {label}: {val != null ? val.toFixed(1) : '–'} {unit}
            </div>
          ))}
        </div>

        <span style={{ color: colors.textSecondary, fontSize: '0.8rem', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>▼</span>
      </div>

      {/* Expanded radar details */}
      {open && ship.fingerprints.length > 0 && (
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${color}22` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
            <thead>
              <tr>
                {['Radar', 'Pulse Width (μs)', 'Rotation Time (s)', 'PRT (μs)'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: colors.textSecondary, fontWeight: 600, borderBottom: `1px solid ${color}33` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ship.fingerprints.map((fp, fi) => (
                <tr key={fi}>
                  <td style={{ padding: '5px 8px', color, fontWeight: 700 }}>R{fi + 1}</td>
                  <td style={{ padding: '5px 8px', color: '#00d4ff', fontFamily: 'monospace' }}>
                    {fp.pulse_width_mode?.toFixed(2) ?? '–'}
                  </td>
                  <td style={{ padding: '5px 8px', color: '#00ff88', fontFamily: 'monospace' }}>
                    {fp.est_radar_rotation_time?.toFixed(3) ?? '–'}
                  </td>
                  <td style={{ padding: '5px 8px', color: '#ffc107', fontFamily: 'monospace' }}>
                    {fp.pulse_repetition_time_micro_s?.toFixed(1) ?? '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && ship.fingerprints.length === 0 && (
        <div style={{ padding: '10px 14px', fontSize: '0.76rem', color: colors.textSecondary, fontStyle: 'italic' }}>
          No radar fingerprints in overlap window.
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const SignalDashboard = () => {
  const { timeConfig, theme } = useAppStore();
  const isDark = theme === 'dark';
  const colors = getThemeColors(isDark);
  const accent = isDark ? '#00d4ff' : '#0066cc';

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const handleLoad = async () => {
    if (!timeConfig.startTime || !timeConfig.endTime) {
      setError('Set a time range in the left panel first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await generateReport(timeConfig.startTime, timeConfig.endTime);
      setReport(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load signal data.');
    } finally {
      setLoading(false);
    }
  };

  // Build scatter points: one per fingerprint
  const scatterPoints: ScatterPoint[] = [];
  report?.ships.forEach((ship, si) => {
    ship.fingerprints.forEach((fp, fi) => {
      if (fp.est_radar_rotation_time != null && fp.pulse_width_mode != null) {
        scatterPoints.push({
          x: fp.est_radar_rotation_time,
          y: fp.pulse_width_mode,
          prt: fp.pulse_repetition_time_micro_s ?? 0,
          mmsi: ship.mmsi,
          radarIdx: fi,
          shipIdx: si,
          color: shipColor(si),
        });
      }
    });
  });

  // PRT histogram values
  const prtValues = (report?.ships ?? []).flatMap(s =>
    s.fingerprints.map(f => f.pulse_repetition_time_micro_s).filter(Boolean) as number[]
  );

  // Rotation time histogram values
  const rtValues = (report?.ships ?? []).flatMap(s =>
    s.fingerprints.map(f => f.est_radar_rotation_time).filter(Boolean) as number[]
  );

  const chartW = Math.max(300, (containerWidth - 52) / 2);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%', overflowY: 'auto', padding: 20,
        display: 'flex', flexDirection: 'column', gap: 18,
        background: isDark ? 'linear-gradient(160deg,#060d18 0%,#0d1b2a 100%)' : '#f0f4f8',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: accent, letterSpacing: '0.04em' }}>
            📡 Signal Processing Dashboard
          </div>
          <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginTop: 2 }}>
            {timeConfig.startTime} → {timeConfig.endTime} (UTC)
            {report && ` · ${report.number_of_ships} ships · ${report.number_of_radars} radars`}
          </div>
        </div>
        <button
          onClick={handleLoad}
          disabled={loading}
          style={{
            padding: '8px 20px',
            background: loading ? 'transparent' : `linear-gradient(135deg,${accent},#0099cc)`,
            border: `1px solid ${accent}`,
            borderRadius: 8, color: loading ? accent : (isDark ? '#060d18' : '#fff'),
            fontWeight: 700, fontSize: '0.82rem',
            cursor: loading ? 'wait' : 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {loading
            ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Loading...</>
            : '⚡ Load Signal Data'
          }
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.8rem' }}>
          ⚠️ {error}
        </div>
      )}

      {!report && !loading && !error && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, color: colors.textSecondary, opacity: 0.65,
        }}>
          <div style={{ fontSize: '3rem' }}>〰️</div>
          <div style={{ fontSize: '0.88rem' }}>
            Click <strong style={{ color: accent }}>Load Signal Data</strong> to visualise radar signal parameters.
          </div>
          <div style={{ fontSize: '0.72rem' }}>Requires MRD + AIS data to be uploaded and a time range set.</div>
        </div>
      )}

      {report && (
        <>
          {/* ── Scatter: Rotation Time vs Pulse Width ── */}
          <div style={{
            background: isDark ? 'rgba(10,22,40,0.75)' : 'rgba(255,255,255,0.9)',
            border: `1px solid ${colors.borderAccent}`,
            borderRadius: 10, padding: 16,
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: accent, marginBottom: 10 }}>
              Rotation Time (X) vs Pulse Width Mode (Y) — per Radar
            </div>

            {scatterPoints.length === 0 ? (
              <div style={{ color: colors.textSecondary, fontSize: '0.8rem', fontStyle: 'italic', padding: '20px 0' }}>
                No fingerprint data available for scatter plot.
              </div>
            ) : (
              <>
                <ScatterPlot
                  points={scatterPoints}
                  isDark={isDark}
                  width={containerWidth - 52}
                  height={260}
                />
                {/* Legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {report.ships.map((ship, si) => (
                    <div key={ship.mmsi} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: shipColor(si), boxShadow: `0 0 6px ${shipColor(si)}` }} />
                      <span style={{ fontSize: '0.7rem', color: colors.textSecondary, fontFamily: 'monospace' }}>{ship.mmsi}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Histograms row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* PRT Histogram */}
            <div style={{
              background: isDark ? 'rgba(10,22,40,0.75)' : 'rgba(255,255,255,0.9)',
              border: `1px solid ${colors.borderAccent}`,
              borderRadius: 10, padding: 14,
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffc107', marginBottom: 8 }}>
                Pulse Repetition Time Distribution
              </div>
              {prtValues.length === 0 ? (
                <div style={{ color: colors.textSecondary, fontSize: '0.75rem', fontStyle: 'italic' }}>No PRT data.</div>
              ) : (
                <Histogram
                  values={prtValues}
                  label="PRT"
                  unit="μs"
                  color="#ffc107"
                  isDark={isDark}
                  width={chartW}
                  height={180}
                />
              )}
              {prtValues.length > 0 && (
                <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: '0.7rem', color: colors.textSecondary, fontFamily: 'monospace' }}>
                  <span>Min: <strong style={{ color: '#ffc107' }}>{Math.min(...prtValues).toFixed(1)}</strong></span>
                  <span>Max: <strong style={{ color: '#ffc107' }}>{Math.max(...prtValues).toFixed(1)}</strong></span>
                  <span>Avg: <strong style={{ color: '#ffc107' }}>{(prtValues.reduce((a, b) => a + b, 0) / prtValues.length).toFixed(1)}</strong></span>
                  <span>n={prtValues.length}</span>
                </div>
              )}
            </div>

            {/* Rotation Time Histogram */}
            <div style={{
              background: isDark ? 'rgba(10,22,40,0.75)' : 'rgba(255,255,255,0.9)',
              border: `1px solid ${colors.borderAccent}`,
              borderRadius: 10, padding: 14,
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00ff88', marginBottom: 8 }}>
                Rotation Time Distribution
              </div>
              {rtValues.length === 0 ? (
                <div style={{ color: colors.textSecondary, fontSize: '0.75rem', fontStyle: 'italic' }}>No rotation time data.</div>
              ) : (
                <Histogram
                  values={rtValues}
                  label="Rotation Time"
                  unit="s"
                  color="#00ff88"
                  isDark={isDark}
                  width={chartW}
                  height={180}
                  bins={10}
                />
              )}
              {rtValues.length > 0 && (
                <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: '0.7rem', color: colors.textSecondary, fontFamily: 'monospace' }}>
                  <span>Min: <strong style={{ color: '#00ff88' }}>{Math.min(...rtValues).toFixed(2)}</strong></span>
                  <span>Max: <strong style={{ color: '#00ff88' }}>{Math.max(...rtValues).toFixed(2)}</strong></span>
                  <span>Avg: <strong style={{ color: '#00ff88' }}>{(rtValues.reduce((a, b) => a + b, 0) / rtValues.length).toFixed(2)}</strong></span>
                  <span>n={rtValues.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Per-ship signal cards ── */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: accent, marginBottom: 10 }}>
              🚢 Per-Ship Signal Parameters
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {report.ships.map((ship, si) => (
                <ShipSignalCard
                  key={ship.mmsi + si}
                  ship={ship}
                  idx={si}
                  isDark={isDark}
                  colors={colors}
                />
              ))}
              {report.ships.length === 0 && (
                <div style={{ color: colors.textSecondary, fontSize: '0.8rem', fontStyle: 'italic' }}>
                  No ships found in this time window.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SignalDashboard;