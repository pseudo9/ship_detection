import { useAppStore } from '../../stores/useAppStore';
import { getThemeColors } from '../../utils/themeColors';

const RightPanel = () => {
  const { 
    filters, 
    zoom, 
    signalMetrics,
    detections,
    activeRadars,
    dataSource,
    theme
  } = useAppStore();

  const isDark = theme === 'dark';
  const colors = getThemeColors(isDark);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const pendingAIS = detections.filter(d => d.aisStatus === 'pending').length;

  return (
    <div style={{
      background: colors.panelBg,
      backdropFilter: 'blur(10px)',
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '24px',
      height: '100%',
      overflowY: 'auto',
      color: colors.text,
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      transition: 'all 0.3s ease'
    }}>
      
      {/* Quick Stats Header */}
      <h2 style={{
        fontSize: '1.25rem',
        fontWeight: 'bold',
        color: colors.textAccent,
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.3s ease'
      }}>
        Quick Stats
      </h2>

      {/* Stats Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        {/* Active Filters */}
        <div style={{
          background: colors.cardBg,
          padding: '16px',
          borderRadius: '8px',
          border: `1px solid ${colors.borderAccent}`,
          transition: 'all 0.3s'
        }}>
          <div style={{ fontSize: '0.875rem', color: colors.textSecondary, marginBottom: '4px' }}>
            Active Filters
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: colors.textAccent }}>
            {activeFilterCount}
            <span style={{ fontSize: '1rem', color: colors.textSecondary, marginLeft: '8px' }}>filters</span>
          </div>
        </div>

        {/* Zoom Level */}
        <div style={{
          background: colors.cardBg,
          padding: '16px',
          borderRadius: '8px',
          border: `1px solid ${colors.borderAccent}`,
          transition: 'all 0.3s'
        }}>
          <div style={{ fontSize: '0.875rem', color: colors.textSecondary, marginBottom: '4px' }}>
            Zoom Level
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: colors.textAccent }}>
            {zoom.toFixed(1)}
            <span style={{ fontSize: '1rem', color: colors.textSecondary, marginLeft: '8px' }}>x</span>
          </div>
        </div>
      </div>

      {/* Signal Metrics Section - M3 FEATURES ONLY */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#00d4ff',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '2px solid rgba(0, 212, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          Signal Metrics (M3)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* PRF - Pulse Repetition Frequency */}
          <div style={{
            background: 'rgba(26, 38, 66, 0.6)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid rgba(0, 212, 255, 0.2)'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#9aa5b1', marginBottom: '8px' }}>
              PRF (Pulse Repetition Frequency)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00d4ff', marginBottom: '8px' }}>
              {signalMetrics.prf}
              <span style={{ fontSize: '0.875rem', color: '#9aa5b1', marginLeft: '8px' }}>Hz</span>
            </div>
            {/* Mini chart visualization */}
            <div style={{
              height: '48px',
              background: 'rgba(26, 38, 66, 0.5)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2px',
              padding: '0 8px'
            }}>
              {[...Array(20)].map((_, i) => {
                const height = 30 + Math.sin(i / 3) * 20 + Math.random() * 10;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(to top, #0099cc, #00d4ff)',
                      borderRadius: '2px 2px 0 0',
                      height: `${height}%`
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* PRI - Pulse Repetition Interval */}
          <div style={{
            background: 'rgba(26, 38, 66, 0.6)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid rgba(0, 212, 255, 0.2)'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#9aa5b1', marginBottom: '4px' }}>
              PRI (Pulse Repetition Interval)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00d4ff' }}>
              {signalMetrics.pri}
              <span style={{ fontSize: '0.875rem', color: '#9aa5b1', marginLeft: '8px' }}>ms</span>
            </div>
          </div>

          {/* Rotation Period */}
          <div style={{
            background: 'rgba(26, 38, 66, 0.6)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid rgba(0, 212, 255, 0.2)'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#9aa5b1', marginBottom: '8px' }}>
              Rotation Period
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#00d4ff', marginBottom: '8px' }}>
              {signalMetrics.rotationPeriod}
              <span style={{ fontSize: '0.875rem', color: '#9aa5b1', marginLeft: '8px' }}>sec</span>
            </div>
            {/* Mini bar chart */}
            <div style={{
              height: '40px',
              background: 'rgba(26, 38, 66, 0.5)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2px',
              padding: '0 4px'
            }}>
              {[0.6, 0.8, 0.5, 0.7, 0.9, 0.6, 0.8, 0.7].map((height, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(to top, #0066aa, #00d4ff)',
                    borderRadius: '2px 2px 0 0',
                    height: `${height * 100}%`
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#00d4ff',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '2px solid rgba(0, 212, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          System Information
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Data Source */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: '1px solid #2a4a6f'
          }}>
            <span style={{ fontSize: '0.875rem', color: '#9aa5b1' }}>Data Source</span>
            <span style={{ 
              fontSize: '0.875rem', 
              fontWeight: 600, 
              color: dataSource === 'live' ? '#00ff88' : '#00d4ff' 
            }}>
              {dataSource === 'live' ? 'Live Feed' : 'Offline Data'}
            </span>
          </div>
          
          {/* Active Radars */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: '1px solid #2a4a6f'
          }}>
            <span style={{ fontSize: '0.875rem', color: '#9aa5b1' }}>Radars Active</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#00ff88' }}>
              {activeRadars.length} / 3
            </span>
          </div>
          
          {/* Coverage Area */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: '1px solid #2a4a6f'
          }}>
            <span style={{ fontSize: '0.875rem', color: '#9aa5b1' }}>Coverage Area</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e0e6ed' }}>Oslofjord</span>
          </div>
          
          {/* Total Detections */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0'
          }}>
            <span style={{ fontSize: '0.875rem', color: '#9aa5b1' }}>Total Detections</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#00d4ff' }}>
              {detections.length} ships
            </span>
          </div>
        </div>
      </div>

      {/* Alerts & Notifications */}
      <div>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#00d4ff',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '2px solid rgba(0, 212, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          Alerts & Notifications
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Dark Ships Alert */}
          {pendingAIS > 0 && (
            <div style={{
              padding: '16px',
              background: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid #ffc107',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#ffc107', marginBottom: '4px' }}>
                    Dark Ships Detected
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#9aa5b1' }}>
                    {pendingAIS} vessel{pendingAIS !== 1 ? 's' : ''} without AIS verification detected
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Nominal */}
          <div style={{
            padding: '16px',
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid #00d4ff',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#00d4ff', marginBottom: '4px' }}>
                  All Systems Nominal
                </div>
                <div style={{ fontSize: '0.875rem', color: '#9aa5b1' }}>
                  All radar sensors operational and receiving data
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightPanel;
