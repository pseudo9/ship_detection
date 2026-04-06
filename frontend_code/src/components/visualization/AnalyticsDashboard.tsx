import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { getThemeColors } from '../../utils/themeColors';
import { generateReport, type ReportData } from '../../api/WaveFormApi';

// ─── Mini bar chart rendered via canvas ───────────────────────────────────────
const BarChart = ({
  values,
  labels,
  color,
  unit,
  height = 120,
}: {
  values: (number | null)[];
  labels: string[];
  color: string;
  unit: string;
  height?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = height;
    canvas.width = W;
    canvas.height = H;

    ctx.clearRect(0, 0, W, H);

    const numericVals = values.map(v => v ?? 0);
    const maxVal = Math.max(...numericVals, 1);
    const barW = Math.max(8, (W / numericVals.length) - 6);
    const gap = (W - barW * numericVals.length) / (numericVals.length + 1);

    numericVals.forEach((val, i) => {
      const barH = (val / maxVal) * (H - 30);
      const x = gap + i * (barW + gap);
      const y = H - barH - 20;

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      const grad = ctx.createLinearGradient(x, y, x, H - 20);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '44');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 3);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Value label on top
      ctx.fillStyle = color;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const label = val === 0 ? '–' : val.toFixed(1);
      ctx.fillText(label, x + barW / 2, y - 2);

      // Bottom label
      ctx.fillStyle = 'rgba(200,220,240,0.55)';
      ctx.font = '9px monospace';
      const lbl = labels[i] ? labels[i].slice(0, 8) : '';
      ctx.fillText(lbl, x + barW / 2, H - 4);
    });

    // Y axis line
    ctx.strokeStyle = 'rgba(200,220,240,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, H - 20);
    ctx.stroke();
  }, [values, labels, color, height]);

  return <canvas ref={canvasRef} style={{ width: '100%', height }} />;
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({
  label,
  value,
  unit,
  accent,
  icon,
  isDark,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
  icon: string;
  isDark: boolean;
}) => (
  <div style={{
    background: isDark ? 'rgba(10,22,40,0.85)' : 'rgba(255,255,255,0.92)',
    border: `1px solid ${accent}44`,
    borderRadius: 10,
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    boxShadow: `0 0 18px ${accent}22`,
    position: 'relative',
    overflow: 'hidden',
  }}>
    {/* accent line */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '10px 10px 0 0' }} />
    <div style={{ fontSize: '1.4rem', marginBottom: 2 }}>{icon}</div>
    <div style={{ fontSize: '0.72rem', color: isDark ? '#6b8fa8' : '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: '2rem', fontWeight: 700, color: accent, lineHeight: 1.1 }}>
      {value}
      {unit && <span style={{ fontSize: '0.9rem', color: isDark ? '#9aa5b1' : '#64748b', marginLeft: 4 }}>{unit}</span>}
    </div>
  </div>
);

// ─── Per-ship fingerprint row ─────────────────────────────────────────────────
const ShipRow = ({
  ship,
  idx,
  isDark,
  colors,
  accent,
}: {
  ship: ReportData['ships'][0];
  idx: number;
  isDark: boolean;
  colors: ReturnType<typeof import('../../utils/themeColors').getThemeColors>;
  accent: string;
}) => {
  const [open, setOpen] = useState(false);
  const hasFingerprints = ship.fingerprints.length > 0;

  return (
    <div style={{
      border: `1px solid ${colors.borderAccent}`,
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      {/* Ship header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          background: isDark ? 'rgba(10,22,40,0.7)' : 'rgba(241,245,249,0.9)',
          cursor: 'pointer',
          gap: 14,
          userSelect: 'none',
        }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: '50%',
          background: `${accent}22`, border: `1.5px solid ${accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.72rem', fontWeight: 700, color: accent, flexShrink: 0,
        }}>{idx + 1}</span>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: colors.text }}>
            MMSI: <span style={{ color: accent, fontFamily: 'monospace' }}>{ship.mmsi}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginTop: 2 }}>
            Overlap: {ship.overlap_start ?? '–'} → {ship.overlap_end ?? '–'} &nbsp;|&nbsp;
            Speed: {ship.speed_min ?? '–'} – {ship.speed_max ?? '–'} kn &nbsp;|&nbsp;
            {ship.length != null ? `${ship.length} m` : 'Length: –'} × {ship.beam != null ? `${ship.beam} m beam` : 'Beam: –'}
          </div>
        </div>

        <div style={{
          padding: '3px 10px', borderRadius: 12,
          background: hasFingerprints ? `${accent}22` : 'rgba(100,116,139,0.15)',
          color: hasFingerprints ? accent : '#64748b',
          fontSize: '0.72rem', fontWeight: 700,
        }}>
          {ship.fingerprints.length} radar{ship.fingerprints.length !== 1 ? 's' : ''}
        </div>

        <span style={{ color: colors.textSecondary, fontSize: '0.8rem', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </div>

      {/* Expanded fingerprints */}
      {open && (
        <div style={{ padding: '12px 14px', background: isDark ? 'rgba(5,15,30,0.6)' : '#f8fafc' }}>
          {!hasFingerprints ? (
            <div style={{ color: colors.textSecondary, fontSize: '0.8rem', fontStyle: 'italic' }}>
              No radar fingerprints detected during this ship's overlap window.
            </div>
          ) : (
            <>
              {/* Charts row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: colors.textSecondary, marginBottom: 4 }}>Pulse Width Mode (μs)</div>
                  <BarChart
                    values={ship.fingerprints.map(f => f.pulse_width_mode)}
                    labels={ship.fingerprints.map((_, i) => `R${i + 1}`)}
                    color="#00d4ff"
                    unit="μs"
                    height={100}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: colors.textSecondary, marginBottom: 4 }}>Rotation Time (s)</div>
                  <BarChart
                    values={ship.fingerprints.map(f => f.est_radar_rotation_time)}
                    labels={ship.fingerprints.map((_, i) => `R${i + 1}`)}
                    color="#00ff88"
                    unit="s"
                    height={100}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: colors.textSecondary, marginBottom: 4 }}>Pulse Rep. Time (μs)</div>
                  <BarChart
                    values={ship.fingerprints.map(f => f.pulse_repetition_time_micro_s)}
                    labels={ship.fingerprints.map((_, i) => `R${i + 1}`)}
                    color="#ffc107"
                    unit="μs"
                    height={100}
                  />
                </div>
              </div>

              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.borderAccent}` }}>
                    {['Radar', 'Pulse Width (μs)', 'Rotation Time (s)', 'PRT (μs)'].map(h => (
                      <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: colors.textSecondary, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ship.fingerprints.map((fp, fi) => (
                    <tr key={fi} style={{ borderBottom: `1px solid ${colors.borderAccent}22`, background: fi % 2 === 0 ? `${accent}08` : 'transparent' }}>
                      <td style={{ padding: '5px 8px', color: accent, fontWeight: 600 }}>Radar {fi + 1}</td>
                      <td style={{ padding: '5px 8px', color: colors.text, fontFamily: 'monospace' }}>{fp.pulse_width_mode?.toFixed(2) ?? '–'}</td>
                      <td style={{ padding: '5px 8px', color: colors.text, fontFamily: 'monospace' }}>{fp.est_radar_rotation_time?.toFixed(3) ?? '–'}</td>
                      <td style={{ padding: '5px 8px', color: colors.text, fontFamily: 'monospace' }}>{fp.pulse_repetition_time_micro_s?.toFixed(1) ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main AnalyticsDashboard ──────────────────────────────────────────────────
const AnalyticsDashboard = () => {
  const { timeConfig, theme } = useAppStore();
  const isDark = theme === 'dark';
  const colors = getThemeColors(isDark);
  const accent = isDark ? '#00d4ff' : '#0066cc';

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aggregate metrics across all ships' fingerprints
  const allFingerprints = report?.ships.flatMap(s => s.fingerprints) ?? [];
  const pwValues = allFingerprints.map(f => f.pulse_width_mode).filter(Boolean) as number[];
  const rtValues = allFingerprints.map(f => f.est_radar_rotation_time).filter(Boolean) as number[];
  const prtValues = allFingerprints.map(f => f.pulse_repetition_time_micro_s).filter(Boolean) as number[];

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const fmt = (n: number | null, d = 2) => n == null ? '–' : n.toFixed(d);

  const handleGenerate = async () => {
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
      setError(e?.message ?? 'Failed to generate analytics.');
    } finally {
      setLoading(false);
    }
  };

  // Per-ship cross-chart data
  const shipLabels = report?.ships.map(s => s.mmsi) ?? [];
  const shipPWAvg = report?.ships.map(s => {
    const vals = s.fingerprints.map(f => f.pulse_width_mode).filter(Boolean) as number[];
    return vals.length ? avg(vals)! : 0;
  }) ?? [];
  const shipRTAvg = report?.ships.map(s => {
    const vals = s.fingerprints.map(f => f.est_radar_rotation_time).filter(Boolean) as number[];
    return vals.length ? avg(vals)! : 0;
  }) ?? [];
  const shipPRTAvg = report?.ships.map(s => {
    const vals = s.fingerprints.map(f => f.pulse_repetition_time_micro_s).filter(Boolean) as number[];
    return vals.length ? avg(vals)! : 0;
  }) ?? [];

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      background: isDark ? 'linear-gradient(160deg, #060d18 0%, #0d1b2a 100%)' : '#f0f4f8',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: accent, letterSpacing: '0.04em' }}>
            📊 Signal Analytics Dashboard
          </div>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginTop: 2 }}>
            {timeConfig.startTime} → {timeConfig.endTime} (UTC)
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            padding: '9px 22px',
            background: loading ? 'rgba(0,212,255,0.1)' : `linear-gradient(135deg, ${accent} 0%, #0099cc 100%)`,
            border: `1px solid ${accent}`,
            borderRadius: 8,
            color: loading ? accent : (isDark ? '#060d18' : '#fff'),
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {loading ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              Analysing...
            </>
          ) : '⚡ Run Analytics'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.82rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── No data yet ── */}
      {!report && !loading && !error && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
          color: colors.textSecondary, fontSize: '0.9rem', opacity: 0.7,
        }}>
          <div style={{ fontSize: '3rem' }}>📡</div>
          <div>Click <strong style={{ color: accent }}>Run Analytics</strong> to load signal statistics for the selected time window.</div>
          <div style={{ fontSize: '0.75rem' }}>Make sure MRD + AIS data is uploaded and a time range is set.</div>
        </div>
      )}

      {/* ── Summary stat cards ── */}
      {report && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <StatCard label="Total Ships (AIS)" value={report.number_of_ships} icon="🚢" accent="#00ff88" isDark={isDark} />
            <StatCard label="Total Radars (MRD)" value={report.number_of_radars} icon="📡" accent={accent} isDark={isDark} />
            <StatCard label="Avg Pulse Width" value={fmt(avg(pwValues))} unit="μs" icon="〰️" accent="#00d4ff" isDark={isDark} />
            <StatCard label="Avg Rotation Time" value={fmt(avg(rtValues), 3)} unit="s" icon="🔄" accent="#00ff88" isDark={isDark} />
            <StatCard label="Avg PRT" value={fmt(avg(prtValues), 1)} unit="μs" icon="⏱️" accent="#ffc107" isDark={isDark} />
            <StatCard label="Report Date" value={report.date} icon="📅" accent="#9aa5b1" isDark={isDark} />
          </div>

          {/* ── Cross-ship signal comparison charts ── */}
          {report.ships.length > 0 && (
            <div style={{
              background: isDark ? 'rgba(10,22,40,0.7)' : 'rgba(255,255,255,0.9)',
              border: `1px solid ${colors.borderAccent}`,
              borderRadius: 10,
              padding: 18,
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: accent, marginBottom: 16 }}>
                📈 Signal Parameters — All Ships Comparison
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Avg Pulse Width (μs) per Ship
                  </div>
                  <BarChart values={shipPWAvg} labels={shipLabels} color="#00d4ff" unit="μs" height={130} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Avg Rotation Time (s) per Ship
                  </div>
                  <BarChart values={shipRTAvg} labels={shipLabels} color="#00ff88" unit="s" height={130} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Avg PRT (μs) per Ship
                  </div>
                  <BarChart values={shipPRTAvg} labels={shipLabels} color="#ffc107" unit="μs" height={130} />
                </div>
              </div>
            </div>
          )}

          {/* ── Per-ship breakdown ── */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: accent, marginBottom: 12 }}>
              🚢 Per-Ship Radar Fingerprints ({report.ships.length} ship{report.ships.length !== 1 ? 's' : ''})
            </div>
            {report.ships.length === 0 ? (
              <div style={{ color: colors.textSecondary, fontSize: '0.82rem', fontStyle: 'italic' }}>
                No ships found in the selected time window and zone.
              </div>
            ) : (
              report.ships.map((ship, i) => (
                <ShipRow key={ship.mmsi + i} ship={ship} idx={i} isDark={isDark} colors={colors} accent={accent} />
              ))
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default AnalyticsDashboard;