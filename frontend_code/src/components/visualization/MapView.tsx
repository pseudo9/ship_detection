import { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { getThemeColors } from '../../utils/themeColors';

interface Ship {
  id: string;
  name: string;
  lat: number;
  lon: number;
  status: 'verified' | 'pending';
}

interface MapViewProps {
  zoom: number;
}

// const MapView = ({ zoom }: MapViewProps) => {
const MapView = () => {
  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const colors = getThemeColors(isDark);
  
  // Mock ship positions in Oslofjord
  const ships: Ship[] = [
    { id: '257059600', name: 'TRYGVE BRAARUD', lat: 59.566, lon: 10.638, status: 'verified' },
    { id: '257819000', name: 'COASTAL GUARD', lat: 59.584, lon: 10.618, status: 'pending' },
    { id: '258144500', name: 'FERRY OSLO', lat: 59.476, lon: 10.688, status: 'verified' },
    { id: '636019292', name: 'CARGO VESSEL', lat: 59.514, lon: 10.581, status: 'verified' },
    { id: '257100550', name: 'UNKNOWN', lat: 59.547, lon: 10.572, status: 'pending' },
  ];

  // Oslofjord bounds
  const mapBounds = {
    minLat: 59.45,
    maxLat: 59.62,
    minLon: 10.35,
    maxLon: 10.72
  };

  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [hoveredShip, setHoveredShip] = useState<string | null>(null);

  // Convert lat/lon to pixel coordinates
  const latLonToPixel = (lat: number, lon: number, width: number, height: number) => {
    const x = ((lon - mapBounds.minLon) / (mapBounds.maxLon - mapBounds.minLon)) * width;
    const y = height - ((lat - mapBounds.minLat) / (mapBounds.maxLat - mapBounds.minLat)) * height;
    return { x, y };
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: colors.mapBg,
      overflow: 'hidden',
      transform: `scale(${1})`,
      transformOrigin: 'center',
      transition: 'all 0.3s ease'
    }}>
      {/* Water texture */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background: isDark ? `
          radial-gradient(circle at 20% 30%, rgba(0, 212, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(0, 212, 255, 0.08) 0%, transparent 50%),
          repeating-linear-gradient(90deg, rgba(0, 212, 255, 0.02) 0px, transparent 2px, transparent 40px),
          repeating-linear-gradient(0deg, rgba(0, 212, 255, 0.02) 0px, transparent 2px, transparent 40px)
        ` : `
          radial-gradient(circle at 20% 30%, rgba(0, 102, 204, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(0, 102, 204, 0.06) 0%, transparent 50%),
          repeating-linear-gradient(90deg, rgba(0, 102, 204, 0.03) 0px, transparent 2px, transparent 40px),
          repeating-linear-gradient(0deg, rgba(0, 102, 204, 0.03) 0px, transparent 2px, transparent 40px)
        `,
        transition: 'background 0.3s ease'
      }} />

      {/* Coastline/Land areas */}
      <svg style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        opacity: 0.6
      }}>
        {/* Left coastline */}
        <path
          d="M 0,100 Q 50,80 80,120 T 120,200 T 150,350 T 180,500 L 0,500 Z"
          fill={colors.mapLand}
          stroke={colors.borderAccent}
          strokeWidth="2"
        />
        {/* Right coastline */}
        <path
          d="M 800,50 Q 750,100 720,150 T 680,250 T 650,380 T 620,500 L 800,500 Z"
          fill={colors.mapLand}
          stroke={colors.borderAccent}
          strokeWidth="2"
        />
        {/* Islands */}
        <ellipse cx="300" cy="180" rx="40" ry="30" fill={colors.mapLand} stroke={colors.borderAccent} strokeWidth="1.5" />
        <ellipse cx="500" cy="280" rx="35" ry="25" fill={colors.mapLand} stroke={colors.borderAccent} strokeWidth="1.5" />
        <ellipse cx="420" cy="400" rx="50" ry="40" fill={colors.mapLand} stroke={colors.borderAccent} strokeWidth="1.5" />
      </svg>

      {/* Grid overlay */}
      <svg style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        opacity: 0.15
      }}>
        <defs>
          <pattern id="mapGrid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#00d4ff" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapGrid)" />
      </svg>

      {/* Ships */}
      <svg style={{
        position: 'absolute',
        width: '100%',
        height: '100%'
      }}>
        {ships.map((ship) => {
          const containerWidth = 800; // Approximate width
          const containerHeight = 500; // Approximate height
          const { x, y } = latLonToPixel(ship.lat, ship.lon, containerWidth, containerHeight);
          const isHovered = hoveredShip === ship.id;
          const isSelected = selectedShip?.id === ship.id;

          return (
            <g key={ship.id}>
              {/* Ship radar ping circle */}
              <circle
                cx={x}
                cy={y}
                r={isHovered || isSelected ? 30 : 20}
                fill="none"
                stroke={ship.status === 'verified' ? '#00ff88' : '#ffc107'}
                strokeWidth="2"
                opacity="0.3"
                style={{ transition: 'all 0.3s' }}
              >
                <animate
                  attributeName="r"
                  from={isHovered || isSelected ? 30 : 20}
                  to={isHovered || isSelected ? 50 : 35}
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.5"
                  to="0"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Ship icon */}
              <g
                onMouseEnter={() => setHoveredShip(ship.id)}
                onMouseLeave={() => setHoveredShip(null)}
                onClick={() => setSelectedShip(ship)}
                style={{ cursor: 'pointer' }}
              >
                {/* Ship marker */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered || isSelected ? 10 : 8}
                  fill={ship.status === 'verified' ? '#00ff88' : '#ffc107'}
                  stroke="#0a1628"
                  strokeWidth="2"
                  style={{ transition: 'all 0.2s' }}
                />
                
                {/* Direction indicator */}
                <path
                  d={`M ${x},${y - (isHovered || isSelected ? 10 : 8)} L ${x - 4},${y + 4} L ${x + 4},${y + 4} Z`}
                  fill={ship.status === 'verified' ? '#00ff88' : '#ffc107'}
                  stroke="#0a1628"
                  strokeWidth="1"
                  style={{ transition: 'all 0.2s' }}
                />

                {/* Glow effect */}
                {(isHovered || isSelected) && (
                  <circle
                    cx={x}
                    cy={y}
                    r="15"
                    fill={ship.status === 'verified' ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 193, 7, 0.3)'}
                  />
                )}
              </g>

              {/* Ship label (always visible) */}
              <text
                x={x}
                y={y - 20}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill={isHovered || isSelected ? '#00d4ff' : '#9aa5b1'}
                style={{ 
                  pointerEvents: 'none',
                  textShadow: '0 0 4px rgba(0, 0, 0, 0.8)',
                  transition: 'all 0.2s'
                }}
              >
                {ship.id}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Compass */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        background: 'rgba(10, 22, 40, 0.9)',
        border: '2px solid rgba(0, 212, 255, 0.4)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem',
        color: '#00d4ff',
        fontWeight: 'bold'
      }}>
        N
        <div style={{
          position: 'absolute',
          bottom: '-2px',
          fontSize: '0.75rem',
          color: '#666'
        }}>
          S
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(10, 22, 40, 0.95)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: '8px',
        padding: '12px 16px'
      }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#00d4ff', marginBottom: '8px' }}>
          Oslofjord Region
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9aa5b1', marginBottom: '8px' }}>
          Lat: 59.45° - 59.62° N<br/>
          Lon: 10.35° - 10.72° E
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#00ff88',
              border: '2px solid #0a1628'
            }} />
            <span style={{ fontSize: '0.75rem', color: '#9aa5b1' }}>AIS Verified</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#ffc107',
              border: '2px solid #0a1628'
            }} />
            <span style={{ fontSize: '0.75rem', color: '#9aa5b1' }}>Pending AIS</span>
          </div>
        </div>
      </div>

      {/* Coordinates display */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'rgba(10, 22, 40, 0.9)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '0.75rem',
        color: '#9aa5b1',
        fontFamily: 'monospace'
      }}>
        Zoom: {zoom.toFixed(1)}x | {ships.length} ships visible
      </div>

      {/* Selected ship info panel */}
      {selectedShip && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'rgba(10, 22, 40, 0.95)',
          border: `2px solid ${selectedShip.status === 'verified' ? '#00ff88' : '#ffc107'}`,
          borderRadius: '8px',
          padding: '16px',
          minWidth: '220px',
          maxWidth: '280px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#00d4ff' }}>
              {selectedShip.name}
            </span>
            <button
              onClick={() => setSelectedShip(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9aa5b1',
                cursor: 'pointer',
                fontSize: '1.25rem',
                padding: '0',
                lineHeight: '1'
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#9aa5b1' }}>MMSI:</span>
              <span style={{ color: '#e0e6ed', fontFamily: 'monospace' }}>{selectedShip.id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#9aa5b1' }}>Latitude:</span>
              <span style={{ color: '#e0e6ed', fontFamily: 'monospace' }}>{selectedShip.lat.toFixed(4)}°</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#9aa5b1' }}>Longitude:</span>
              <span style={{ color: '#e0e6ed', fontFamily: 'monospace' }}>{selectedShip.lon.toFixed(4)}°</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9aa5b1' }}>Status:</span>
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: selectedShip.status === 'verified' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 193, 7, 0.2)',
                color: selectedShip.status === 'verified' ? '#00ff88' : '#ffc107',
                border: `1px solid ${selectedShip.status === 'verified' ? '#00ff88' : '#ffc107'}`
              }}>
                {selectedShip.status === 'verified' ? '✓ Verified' : '⏳ Pending'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;