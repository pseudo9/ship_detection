import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { getThemeColors } from '../../utils/themeColors';
import {
  generateReport,
  saveReport,
  getSavedReports,
  type ReportData,
  type ShipReport,
  type RadarFingerprint,
  type SavedReportRecord,
} from '../../api/WaveFormApi';

const AnalysisReport = () => {
  const { timeConfig, analysisData, theme } = useAppStore();

  const isDark = theme === 'dark';
  const colors = getThemeColors(isDark);

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [editableReport, setEditableReport] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savedRecords, setSavedRecords] = useState<SavedReportRecord[]>([]);

  // Fetch saved reports on mount
  useEffect(() => {
    loadSavedReports();
  }, []);

  const loadSavedReports = async () => {
    try {
      const data = await getSavedReports();
      setSavedRecords(data);
    } catch (e) {
      console.error('Failed to load saved reports', e);
    }
  };

  const handleGenerateReport = async () => {
    const { startTime, endTime } = timeConfig;

    if (!startTime || !endTime) {
      alert('Please select a valid time range.');
      return;
    }

    setIsGenerating(true);
    setReportError(null);
    setSaveStatus(null);

    try {
      const data = await generateReport(startTime, endTime);
      setReportData(data);
      // Deep copy for editable state
      setEditableReport(JSON.parse(JSON.stringify(data)));
    } catch (error) {
      console.error('Report generation error:', error);
      setReportError('Failed to generate report. See console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveReport = async () => {
    if (!editableReport) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const result = await saveReport(editableReport);
      setSaveStatus({ type: 'success', message: `Saved ${result.rows_saved} rows to database.` });
      await loadSavedReports();
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save report to database.' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Helpers to update editable state ---
  const updateShipField = (shipIdx: number, field: keyof ShipReport, value: string) => {
    if (!editableReport) return;
    const updated = { ...editableReport, ships: [...editableReport.ships] };
    const ship = { ...updated.ships[shipIdx] };

    const numericFields: (keyof ShipReport)[] = ['speed_min', 'speed_max', 'course_min', 'course_max', 'length', 'beam', 'number_of_radars'];
    if (numericFields.includes(field)) {
      (ship as any)[field] = value === '' ? null : Number(value);
    } else {
      (ship as any)[field] = value;
    }

    updated.ships[shipIdx] = ship;
    setEditableReport(updated);
  };

  const updateFingerprint = (shipIdx: number, fpIdx: number, field: keyof RadarFingerprint, value: string) => {
    if (!editableReport) return;
    const updated = { ...editableReport, ships: [...editableReport.ships] };
    const ship = { ...updated.ships[shipIdx], fingerprints: [...updated.ships[shipIdx].fingerprints] };
    const fp = { ...ship.fingerprints[fpIdx] };
    (fp as any)[field] = value === '' ? null : Number(value);
    ship.fingerprints[fpIdx] = fp;
    updated.ships[shipIdx] = ship;
    setEditableReport(updated);
  };

  const addFingerprint = (shipIdx: number) => {
    if (!editableReport) return;
    const updated = { ...editableReport, ships: [...editableReport.ships] };
    const ship = { ...updated.ships[shipIdx], fingerprints: [...updated.ships[shipIdx].fingerprints] };
    ship.fingerprints.push({ pulse_width_mode: 0, est_radar_rotation_time: 0, pulse_repetition_time_micro_s: 0 });
    ship.number_of_radars = ship.fingerprints.length;
    updated.ships[shipIdx] = ship;
    setEditableReport(updated);
  };

  const removeFingerprint = (shipIdx: number, fpIdx: number) => {
    if (!editableReport) return;
    const updated = { ...editableReport, ships: [...editableReport.ships] };
    const ship = { ...updated.ships[shipIdx], fingerprints: [...updated.ships[shipIdx].fingerprints] };
    ship.fingerprints.splice(fpIdx, 1);
    ship.number_of_radars = ship.fingerprints.length;
    updated.ships[shipIdx] = ship;
    setEditableReport(updated);
  };

  // --- Shared input style ---
  const inputStyle = (width = '80px'): React.CSSProperties => ({
    width,
    padding: '4px 8px',
    borderRadius: '4px',
    border: `1px solid ${colors.borderAccent}`,
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    color: colors.text,
    fontSize: '0.85rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  });

  const handleDownloadReport = () => {
    const data = editableReport || reportData;
    if (!data) return;

    let report = '';
    report += '═══════════════════════════════════════════════════════════\n';
    report += '                   SCENARIO ANALYSIS REPORT               \n';
    report += '═══════════════════════════════════════════════════════════\n\n';

    report += `Timeframe: ${data.date}, from ${data.start_time} to ${data.end_time} (UTC)\n\n`;
    report += `Number of Ships (AIS Data): ${data.number_of_ships}\n`;
    report += `Number of Radars (MRD Data): ${data.number_of_radars}\n\n`;

    report += '───────────────────────────────────────────────────────────\n';
    report += ' Ships present during timeframe and within scenario area\n';
    report += '───────────────────────────────────────────────────────────\n\n';

    data.ships.forEach((ship, index) => {
      report += `  Ship ${index + 1}: ${ship.mmsi}\n`;
      report += `    Overlap Time: ${ship.overlap_start ?? 'N/A'} to ${ship.overlap_end ?? 'N/A'} (UTC)\n`;
      report += `    Length / Beam: ${ship.length != null && ship.beam != null ? `${ship.length} m / ${ship.beam} m` : 'N/A'}\n`;
      report += `    Number of Radars: ${ship.number_of_radars}\n`;
      report += `    Speed Range: ${ship.speed_min ?? 'N/A'} - ${ship.speed_max ?? 'N/A'} knots\n`;
      report += `    Course Range: ${ship.course_min ?? 'N/A'}° - ${ship.course_max ?? 'N/A'}°\n`;

      if (ship.fingerprints.length > 0) {
        report += `    Fingerprints:\n`;
        ship.fingerprints.forEach((fp, fpIdx) => {
          report += `      Radar ${fpIdx + 1}:\n`;
          report += `        Period (Rotation Time): ${fp.est_radar_rotation_time ?? 'N/A'} s\n`;
          report += `        Pulse Width: ${fp.pulse_width_mode ?? 'N/A'} μs\n`;
          report += `        Pulse Repetition Time: ${fp.pulse_repetition_time_micro_s ?? 'N/A'} μs\n`;
        });
      } else {
        report += `    Fingerprints: None detected during overlap window\n`;
      }
      report += '\n';
    });

    report += '═══════════════════════════════════════════════════════════\n';
    report += '                       END OF REPORT                      \n';
    report += '═══════════════════════════════════════════════════════════\n';

    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scenario_report_${data.date}_${data.start_time.replace(':', '')}-${data.end_time.replace(':', '')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      background: colors.panelBgAlt,
      border: `1px solid ${colors.borderAccent}`,
      borderRadius: '8px',
      transition: 'all 0.3s ease'
    }}>
      {/* Header with Time Stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: `1px solid ${colors.borderAccent}`,
        background: colors.headerBg,
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '4px' }}>
              Start Time
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: colors.textAccent }}>
              {timeConfig.startTime}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '4px' }}>
              End Time
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: colors.textAccent }}>
              {timeConfig.endTime}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '4px' }}>
              Number of Radars
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: colors.textAccent }}>
              {analysisData.numberOfRadars}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '4px' }}>
              Number of Ships
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, color: colors.textAccent }}>
              {analysisData.numberOfShips}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            style={{
              padding: '8px 20px',
              background: colors.accentBg,
              border: `1px solid ${colors.borderHover}`,
              borderRadius: '6px',
              color: colors.textAccent,
              cursor: isGenerating ? 'wait' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: isGenerating ? 0.7 : 1,
            }}>
            <span>📋</span>
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
          {editableReport && (
            <>
              <button
                onClick={handleDownloadReport}
                style={{
                  padding: '8px 20px',
                  background: isDark ? 'rgba(0, 255, 136, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  border: `1px solid ${colors.success}`,
                  borderRadius: '6px',
                  color: colors.success,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}>
                <span>⬇️</span>
                Download Report
              </button>
              <button
                onClick={handleSaveReport}
                disabled={isSaving}
                style={{
                  padding: '8px 20px',
                  background: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.12)',
                  border: `1px solid ${isDark ? '#818cf8' : '#6366f1'}`,
                  borderRadius: '6px',
                  color: isDark ? '#a5b4fc' : '#4f46e5',
                  cursor: isSaving ? 'wait' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  opacity: isSaving ? 0.7 : 1,
                }}>
                <span>💾</span>
                {isSaving ? 'Saving...' : 'Save to Database'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error / Success Messages */}
      {reportError && (
        <div style={{
          padding: '12px 20px',
          background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(220, 38, 38, 0.1)',
          color: colors.error,
          fontSize: '0.875rem',
          fontWeight: 500,
          borderBottom: `1px solid ${colors.borderAccent}`,
        }}>
          ⚠️ {reportError}
        </div>
      )}
      {saveStatus && (
        <div style={{
          padding: '12px 20px',
          background: saveStatus.type === 'success'
            ? (isDark ? 'rgba(0, 255, 136, 0.1)' : 'rgba(16, 185, 129, 0.1)')
            : (isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(220, 38, 38, 0.1)'),
          color: saveStatus.type === 'success' ? colors.success : colors.error,
          fontSize: '0.875rem',
          fontWeight: 500,
          borderBottom: `1px solid ${colors.borderAccent}`,
        }}>
          {saveStatus.type === 'success' ? '✅' : '⚠️'} {saveStatus.message}
        </div>
      )}

      {/* Report Preview */}
      <div style={{ padding: '16px' }}>
        {!editableReport ? (
          /* Default Tables when no report generated yet */
          <div style={{ display: 'flex', gap: '16px' }}>
            {/* Radar Data Table */}
            <div style={{ flex: 1 }}>
              <h3 style={{ color: colors.textAccent, marginBottom: '12px' }}>Radar Attributes</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: colors.headerBg, borderBottom: `1px solid ${colors.borderAccent}` }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.textAccent, fontWeight: 600 }}>
                      Pulse Width Mode
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.textAccent, fontWeight: 600 }}>
                      Est. Radar Rotation Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysisData.radar_unique_attributes.map((radar, index) => (
                    <tr key={index} style={{
                      borderBottom: `1px solid ${colors.borderAccent}`,
                      background: index % 2 === 0 ? colors.cardBg : 'transparent',
                    }}>
                      <td style={{ padding: '12px 16px', color: colors.text }}>{radar.pulse_width_mode}</td>
                      <td style={{ padding: '12px 16px', color: colors.text }}>{radar.est_radar_rotation_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* AIS Data Table */}
            <div style={{ flex: 1 }}>
              <h3 style={{ color: colors.textAccent, marginBottom: '12px' }}>AIS Unique Ships</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: colors.headerBg, borderBottom: `1px solid ${colors.borderAccent}` }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.textAccent, fontWeight: 600 }}>MMSI</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.textAccent, fontWeight: 600 }}>Reception Location</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisData.ais_unique_ships.map((ship, index) => (
                    <tr key={index} style={{
                      borderBottom: `1px solid ${colors.borderAccent}`,
                      background: index % 2 === 0 ? colors.cardBg : 'transparent',
                    }}>
                      <td style={{ padding: '12px 16px', color: colors.text }}>{ship.mmsi}</td>
                      <td style={{ padding: '12px 16px', color: colors.text }}>{ship.reception_location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Generated Report Preview — Editable */
          <div style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
            {/* Report Header */}
            <div style={{
              padding: '16px 20px',
              background: colors.accentBg,
              borderRadius: '8px',
              marginBottom: '16px',
              border: `1px solid ${colors.borderAccent}`,
            }}>
              <h3 style={{ color: colors.textAccent, margin: '0 0 8px 0', fontSize: '1rem' }}>
                📄 Scenario Analysis Report
              </h3>
              <div style={{ fontSize: '0.9rem', color: colors.text, fontWeight: 500 }}>
                Timeframe: {editableReport.date}, from {editableReport.start_time} to {editableReport.end_time} (UTC)
              </div>
              <div style={{ display: 'flex', gap: '24px', marginTop: '12px' }}>
                <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                  <strong style={{ color: colors.textAccent }}>Ships (AIS):</strong> {editableReport.number_of_ships}
                </div>
                <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                  <strong style={{ color: colors.textAccent }}>Radars (MRD):</strong> {editableReport.number_of_radars}
                </div>
              </div>
            </div>

            {/* Ships with their Radar Fingerprints — EDITABLE */}
            {editableReport.ships.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ color: colors.textAccent, marginBottom: '8px', fontSize: '0.9rem' }}>
                  🚢 Ships Present During Timeframe
                </h4>
                {editableReport.ships.map((ship, index) => (
                  <div key={index} style={{
                    marginBottom: '12px',
                    border: `1px solid ${colors.borderAccent}`,
                    borderRadius: '6px',
                    overflow: 'hidden',
                  }}>
                    {/* Ship Header Row */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: colors.headerBg,
                      borderBottom: `1px solid ${colors.borderAccent}`,
                    }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: colors.textSecondary, fontSize: '0.85rem' }}>Ship {index + 1}</span>
                        <span style={{ color: colors.textSecondary, fontSize: '0.85rem' }}>MMSI:</span>
                        <input
                          type="text"
                          value={ship.mmsi}
                          onChange={(e) => updateShipField(index, 'mmsi', e.target.value)}
                          style={inputStyle('120px')}
                        />
                        <span style={{ color: colors.textSecondary, fontSize: '0.85rem' }}>Overlap:</span>
                        <input
                          type="text"
                          value={ship.overlap_start ?? ''}
                          onChange={(e) => updateShipField(index, 'overlap_start', e.target.value)}
                          style={inputStyle('60px')}
                          placeholder="HH:MM"
                        />
                        <span style={{ color: colors.textSecondary, fontSize: '0.8rem' }}>–</span>
                        <input
                          type="text"
                          value={ship.overlap_end ?? ''}
                          onChange={(e) => updateShipField(index, 'overlap_end', e.target.value)}
                          style={inputStyle('60px')}
                          placeholder="HH:MM"
                        />
                      </div>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: isDark ? 'rgba(0, 212, 255, 0.15)' : 'rgba(0, 102, 204, 0.1)',
                        color: colors.textAccent,
                      }}>
                        {ship.fingerprints.length} Radar{ship.fingerprints.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Ship Details — Editable */}
                    <div style={{ padding: '10px 14px', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.85rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: colors.textSecondary }}>Length (m):</span>
                        <input
                          type="number"
                          value={ship.length ?? ''}
                          onChange={(e) => updateShipField(index, 'length', e.target.value)}
                          style={inputStyle('70px')}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: colors.textSecondary }}>Beam (m):</span>
                        <input
                          type="number"
                          value={ship.beam ?? ''}
                          onChange={(e) => updateShipField(index, 'beam', e.target.value)}
                          style={inputStyle('70px')}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: colors.textSecondary }}>Speed:</span>
                        <input
                          type="number"
                          value={ship.speed_min ?? ''}
                          onChange={(e) => updateShipField(index, 'speed_min', e.target.value)}
                          style={inputStyle('60px')}
                        />
                        <span style={{ color: colors.textSecondary }}>–</span>
                        <input
                          type="number"
                          value={ship.speed_max ?? ''}
                          onChange={(e) => updateShipField(index, 'speed_max', e.target.value)}
                          style={inputStyle('60px')}
                        />
                        <span style={{ color: colors.textSecondary, fontSize: '0.8rem' }}>kn</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: colors.textSecondary }}>Course:</span>
                        <input
                          type="number"
                          value={ship.course_min ?? ''}
                          onChange={(e) => updateShipField(index, 'course_min', e.target.value)}
                          style={inputStyle('60px')}
                        />
                        <span style={{ color: colors.textSecondary }}>–</span>
                        <input
                          type="number"
                          value={ship.course_max ?? ''}
                          onChange={(e) => updateShipField(index, 'course_max', e.target.value)}
                          style={inputStyle('60px')}
                        />
                        <span style={{ color: colors.textSecondary, fontSize: '0.8rem' }}>°</span>
                      </div>
                    </div>

                    {/* Per-Ship Fingerprints — Editable */}
                    <div style={{ padding: '0 14px 10px 14px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: colors.textAccent }}>
                          📡 Fingerprints
                        </div>
                        <button
                          onClick={() => addFingerprint(index)}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '4px',
                            border: `1px solid ${colors.borderAccent}`,
                            background: isDark ? 'rgba(0, 212, 255, 0.1)' : 'rgba(0, 102, 204, 0.06)',
                            color: colors.textAccent,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}>
                          + Add Fingerprint
                        </button>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${colors.borderAccent}` }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', color: colors.textSecondary, fontWeight: 500 }}>#</th>
                            <th style={{ padding: '6px 10px', textAlign: 'left', color: colors.textSecondary, fontWeight: 500 }}>Period (s)</th>
                            <th style={{ padding: '6px 10px', textAlign: 'left', color: colors.textSecondary, fontWeight: 500 }}>Pulse Width (μs)</th>
                            <th style={{ padding: '6px 10px', textAlign: 'left', color: colors.textSecondary, fontWeight: 500 }}>PRT (μs)</th>
                            <th style={{ padding: '6px 10px', textAlign: 'center', color: colors.textSecondary, fontWeight: 500, width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {ship.fingerprints.map((fp, fpIdx) => (
                            <tr key={fpIdx} style={{
                              borderBottom: `1px solid ${colors.borderAccent}`,
                              background: fpIdx % 2 === 0 ? colors.cardBg : 'transparent',
                            }}>
                              <td style={{ padding: '6px 10px', color: colors.textSecondary }}>Radar {fpIdx + 1}</td>
                              <td style={{ padding: '6px 10px' }}>
                                <input
                                  type="number"
                                  step="any"
                                  value={fp.est_radar_rotation_time ?? ''}
                                  onChange={(e) => updateFingerprint(index, fpIdx, 'est_radar_rotation_time', e.target.value)}
                                  style={inputStyle('90px')}
                                />
                              </td>
                              <td style={{ padding: '6px 10px' }}>
                                <input
                                  type="number"
                                  step="any"
                                  value={fp.pulse_width_mode ?? ''}
                                  onChange={(e) => updateFingerprint(index, fpIdx, 'pulse_width_mode', e.target.value)}
                                  style={inputStyle('90px')}
                                />
                              </td>
                              <td style={{ padding: '6px 10px' }}>
                                <input
                                  type="number"
                                  step="any"
                                  value={fp.pulse_repetition_time_micro_s ?? ''}
                                  onChange={(e) => updateFingerprint(index, fpIdx, 'pulse_repetition_time_micro_s', e.target.value)}
                                  style={inputStyle('90px')}
                                />
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                <button
                                  onClick={() => removeFingerprint(index, fpIdx)}
                                  title="Remove fingerprint"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: colors.error || '#ef4444',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    padding: '2px 4px',
                                    lineHeight: 1,
                                  }}>
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                          {ship.fingerprints.length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ padding: '10px', color: colors.textSecondary, textAlign: 'center', fontSize: '0.8rem' }}>
                                No fingerprints — click "Add Fingerprint" to add one
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Saved Reports Table ─── */}
      <div style={{
        borderTop: `1px solid ${colors.borderAccent}`,
        padding: '16px 20px',
      }}>
        <h4 style={{ color: colors.textAccent, marginBottom: '12px', fontSize: '0.9rem' }}>
          🗄️ Saved Report Records ({savedRecords.length})
        </h4>
        {savedRecords.length === 0 ? (
          <div style={{ color: colors.textSecondary, fontSize: '0.85rem', padding: '10px 0' }}>
            No saved records yet. Generate a report, edit values, and click "Save to Database".
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: '1100px' }}>
              <thead>
                <tr style={{ background: colors.headerBg, borderBottom: `1px solid ${colors.borderAccent}` }}>
                  {['ID', 'Date', 'Start', 'End', 'MMSI', 'Overlap', 'Speed', 'Course', 'Length', 'Beam', 'PW Mode', 'Rot. Time', 'PRT', 'Saved At'].map((h) => (
                    <th key={h} style={{ padding: '8px 8px', textAlign: 'left', color: colors.textAccent, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {savedRecords.map((r, i) => (
                  <tr key={r.id} style={{
                    borderBottom: `1px solid ${colors.borderAccent}`,
                    background: i % 2 === 0 ? colors.cardBg : 'transparent',
                  }}>
                    <td style={{ padding: '6px 8px', color: colors.textSecondary }}>{r.id}</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.report_date}</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.report_start_time}</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.report_end_time}</td>
                    <td style={{ padding: '6px 8px', color: colors.text, fontWeight: 500 }}>{r.mmsi}</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.overlap_start ?? '–'} – {r.overlap_end ?? '–'}</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.speed_min ?? '–'} – {r.speed_max ?? '–'}</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.course_min ?? '–'}° – {r.course_max ?? '–'}°</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.length ?? '–'}</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.beam ?? '–'}</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.pulse_width_mode ?? '–'}</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.est_radar_rotation_time ?? '–'}</td>
                    <td style={{ padding: '6px 8px', color: colors.text }}>{r.pulse_repetition_time_micro_s ?? '–'}</td>
                    <td style={{ padding: '6px 8px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisReport;