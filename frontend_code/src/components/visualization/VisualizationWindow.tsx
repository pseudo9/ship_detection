import { useState, useEffect } from 'react';
import WaveformApp from './WaveformApp';
import { fetchAllDataFromDB } from '../../api/WaveFormApi';
import type { WaveformAppProps } from '../../types/index';
import { useAppStore } from '../../stores/useAppStore';
import { getThemeColors } from '../../utils/themeColors';
import LeafletMap from './ShipMapView';
import AnalyticsDashboard from './Analyticsdashboard';
import SignalDashboard from './SignalDashboard';

type Tab = 'waveform' | 'map' | 'analytics' | 'signal';

const TABS: { key: Tab; label: string }[] = [
  { key: 'waveform',  label: 'Waveform'  },
  { key: 'map',       label: 'Map View'  },
  { key: 'analytics', label: 'Analytics' },
  { key: 'signal',    label: 'Signal'    },
];

const VisualizationWindow = ({ data }: { data: WaveformAppProps['data'] }) => {
  const [activeTab, setActiveTab] = useState<Tab>('waveform');
  const [dbData, setDbData] = useState<WaveformAppProps['data']>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const colors = getThemeColors(isDark);

  useEffect(() => {
    if (data) setDbData(data);
  }, [data]);

  const getDbData = async () => {
    try {
      const allDbData = await fetchAllDataFromDB();
      setDbData(allDbData);
    } catch (error) {
      console.error('Error fetching DB data:', error);
    }
  };

  const isNonChartTab = activeTab === 'analytics' || activeTab === 'signal';

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: colors.panelBgAlt,
      border: `1px solid ${colors.borderAccent}`,
      borderRadius: '8px',
      overflowY: 'auto',
      overflowX: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      {/* ── Tab Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 14px',
        borderBottom: `1px solid ${colors.borderAccent}`,
        background: colors.headerBg,
        transition: 'all 0.3s ease',
        flexWrap: 'wrap',
      }}>
        {TABS.map(tab => (
  <button
    key={tab.key}
    onClick={() => setActiveTab(tab.key)}
    style={{
      padding: '7px 16px',
      background: activeTab === tab.key ? colors.accentBg : 'transparent',
      border: activeTab === tab.key
        ? `1px solid ${colors.borderHover}`
        : `1px solid ${colors.border}`,
      borderRadius: 6,
      color: activeTab === tab.key ? colors.textAccent : colors.textSecondary,
      cursor: 'pointer',
      fontSize: '0.83rem',
      fontWeight: activeTab === tab.key ? 700 : 500,
      transition: 'all 0.2s',
    }}
  >
    {tab.label}
  </button>
))}

        <div style={{ flex: 1 }} />

        {/* Plot MRD — waveform only */}
        {activeTab === 'waveform' && (
          <button
            onClick={getDbData}
            style={{
              padding: '8px 14px',
              background: isDark
                ? 'linear-gradient(to right, #00d4ff, #0099cc)'
                : 'linear-gradient(to right, #0066cc, #0080ff)',
              border: 'none',
              borderRadius: 8,
              color: isDark ? '#0d1b2a' : '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.83rem',
              transition: 'all 0.3s ease',
            }}
          >
            Plot MRD Data
          </button>
        )}

        {/* Maximize — waveform only */}
        {activeTab === 'waveform' && (
          <button
            onClick={() => setIsMaximized(true)}
            title="Maximize graph"
            style={{
              padding: 8,
              background: isDark ? 'rgba(0,212,255,0.1)' : 'rgba(0,102,204,0.1)',
              border: isDark ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(0,102,204,0.5)',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(0,212,255,0.2)' : 'rgba(0,102,204,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(0,212,255,0.1)' : 'rgba(0,102,204,0.1)'; }}
          >
            <img
              src="/maximize.png"
              alt="Maximize"
              style={{
                width: 24, height: 24, objectFit: 'contain',
                filter: 'brightness(0) saturate(100%) invert(70%) sepia(88%) saturate(2591%) hue-rotate(160deg) brightness(103%) contrast(101%)',
              }}
            />
          </button>
        )}
      </div>

      {/* ── Content Area ── */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: isNonChartTab
          ? (isDark ? 'linear-gradient(160deg,#060d18 0%,#0d1b2a 100%)' : '#f0f4f8')
          : 'linear-gradient(135deg,#0a1420 0%,#0f1f30 100%)',
        overflow: 'hidden',
        transition: 'background 0.3s ease',
      }}>
        {/* Grid overlay — waveform/map only */}
        {!isNonChartTab && (
          <svg style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.1 }}>
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#00d4ff" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        )}

        {activeTab === 'waveform' && (
          <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WaveformApp data={dbData} />
          </div>
        )}

        {activeTab === 'map' && (
          <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
            <LeafletMap />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div style={{ position: 'absolute', width: '100%', height: '100%', overflowY: 'auto' }}>
            <AnalyticsDashboard />
          </div>
        )}

        {activeTab === 'signal' && (
          <div style={{ position: 'absolute', width: '100%', height: '100%', overflowY: 'auto' }}>
            <SignalDashboard />
          </div>
        )}
      </div>

      {/* ── Maximized Modal ── */}
      {isMaximized && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.95)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', padding: 20,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20, paddingBottom: 12,
            borderBottom: '1px solid rgba(0,212,255,0.3)',
          }}>
            <h2 style={{ color: '#00d4ff', fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
              Waveform Visualization
            </h2>
            <button
              onClick={() => setIsMaximized(false)}
              style={{
                padding: 8,
                background: 'rgba(255,68,68,0.1)',
                border: '1px solid rgba(255,68,68,0.5)',
                borderRadius: 6, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <img
                src="/close.png" alt="Close"
                style={{
                  width: 32, height: 32, objectFit: 'contain',
                  filter: 'brightness(0) saturate(100%) invert(49%) sepia(96%) saturate(3207%) hue-rotate(335deg) brightness(102%) contrast(102%)',
                }}
              />
            </button>
          </div>

          <div style={{
            flex: 1,
            background: 'linear-gradient(135deg,#0a1420 0%,#0f1f30 100%)',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 8, position: 'relative', overflow: 'hidden',
          }}>
            <svg style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.1 }}>
              <defs>
                <pattern id="grid-maximized" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#00d4ff" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-maximized)" />
            </svg>
            <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WaveformApp data={dbData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizationWindow;