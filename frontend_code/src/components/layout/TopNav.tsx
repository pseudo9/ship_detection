import { useAppStore } from '../../stores/useAppStore';

const TopNav = () => {
  const { dataSource, timeConfig, theme, toggleTheme } = useAppStore();

  const isDark = theme === 'dark';

  return (
    <nav style={{
      background: isDark 
        ? 'linear-gradient(to right, #0d1b2a, #1b3a5f)'
        : 'linear-gradient(to right, #f0f4f8, #d9e2ec)',
      borderBottom: isDark 
        ? '2px solid rgba(0, 212, 255, 0.3)'
        : '2px solid rgba(99, 110, 114, 0.2)',
      boxShadow: isDark 
        ? '0 2px 10px rgba(0, 0, 0, 0.3)'
        : '0 2px 10px rgba(0, 0, 0, 0.1)',
      padding: '16px 24px',
      transition: 'all 0.3s ease'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
       {/* Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: isDark 
              ? 'linear-gradient(135deg, #00d4ff 0%, #00ff88 100%)'
              : 'linear-gradient(135deg, #0066cc 0%, #0099ff 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            boxShadow: isDark 
              ? '0 0 20px rgba(0, 212, 255, 0.5)'
              : '0 0 20px rgba(0, 102, 204, 0.3)',
            transition: 'all 0.3s ease'
          }}>
            
          </div>
          <div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? '#00d4ff' : '#0066cc',
              textShadow: isDark 
                ? '0 0 10px rgba(0, 212, 255, 0.8)'
                : 'none',
              margin: 0,
              transition: 'all 0.3s ease'
            }}>
              Ship Identification via radar signals
            </h1>
            <p style={{
              fontSize: '0.875rem',
              color: isDark ? '#9aa5b1' : '#64748b',
              margin: 0,
              marginTop: '2px',
              transition: 'all 0.3s ease'
            }}>
              
            </p>
          </div>
        </div>

        {/* Status and Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              border: isDark 
                ? '1px solid rgba(0, 212, 255, 0.3)'
                : '1px solid rgba(99, 110, 114, 0.3)',
              background: isDark 
                ? 'rgba(26, 38, 66, 0.8)'
                : 'rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              transition: 'all 0.3s ease',
              boxShadow: isDark 
                ? '0 2px 8px rgba(0, 0, 0, 0.2)'
                : '0 2px 8px rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(10px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark 
                ? 'rgba(0, 212, 255, 0.2)'
                : 'rgba(0, 102, 204, 0.15)';
              e.currentTarget.style.borderColor = isDark 
                ? '#00d4ff'
                : '#0066cc';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDark 
                ? 'rgba(26, 38, 66, 0.8)'
                : 'rgba(255, 255, 255, 0.8)';
              e.currentTarget.style.borderColor = isDark 
                ? 'rgba(0, 212, 255, 0.3)'
                : 'rgba(99, 110, 114, 0.3)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          
          {/* System Status Indicator */}
          {/* <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(13, 27, 42, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(42, 74, 111, 0.5)',
            borderRadius: '20px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: dataSource === 'live' ? '#00ff88' : '#666',
              animation: dataSource === 'live' ? 'pulse 2s infinite' : 'none'
            }} />
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#e0e6ed'
            }}>
              {dataSource === 'live' ? 'System Live' : 'Offline Mode'}
            </span>
          </div> */}

          {/* Time Range Display */}
          {/* <div style={{
            padding: '8px 16px',
            background: 'rgba(26, 38, 66, 0.6)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(42, 74, 111, 0.3)',
            borderRadius: '8px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.875rem'
            }}>
              <span></span>
              <span style={{
                fontFamily: 'monospace',
                color: '#00d4ff',
                fontWeight: 600
              }}>
                {timeConfig.startTime} - {timeConfig.endTime}
              </span>
            </div>
          </div> */}

          {/* Export Button */}
          {/* <button style={{
            padding: '8px 16px',
            background: 'rgba(26, 38, 66, 1)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            color: '#e0e6ed',
            fontSize: '0.875rem',
            fontWeight: 600
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)';
            e.currentTarget.style.borderColor = '#00d4ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(26, 38, 66, 1)';
            e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
          }}>
             Export
          </button> */}

          {/* Settings Button */}
          {/* <button style={{
            padding: '8px 16px',
            background: 'rgba(26, 38, 66, 1)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            color: '#e0e6ed',
            fontSize: '0.875rem',
            fontWeight: 600
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)';
            e.currentTarget.style.borderColor = '#00d4ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(26, 38, 66, 1)';
            e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
          }}>
            Settings
          </button> */}
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
