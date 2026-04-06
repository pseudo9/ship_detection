export const getThemeColors = (isDark: boolean) => ({
  // Backgrounds
  panelBg: isDark ? 'rgba(13, 27, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
  panelBgAlt: isDark ? 'rgba(10, 22, 40, 0.9)' : 'rgba(248, 250, 252, 0.95)',
  cardBg: isDark ? 'rgba(26, 38, 66, 0.6)' : 'rgba(241, 245, 249, 0.8)',
  headerBg: isDark ? 'rgba(5, 15, 30, 0.8)' : 'rgba(241, 245, 249, 0.9)',
  
  // Borders
  border: isDark ? 'rgba(42, 74, 111, 0.5)' : 'rgba(203, 213, 224, 0.8)',
  borderAccent: isDark ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 102, 204, 0.3)',
  borderHover: isDark ? '#00d4ff' : '#0066cc',
  
  // Text
  text: isDark ? '#e0e6ed' : '#1a202c',
  textSecondary: isDark ? '#9aa5b1' : '#64748b',
  textAccent: isDark ? '#00d4ff' : '#0066cc',
  
  // Accents
  accent: isDark ? '#00d4ff' : '#0066cc',
  accentBg: isDark ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0, 102, 204, 0.15)',
  accentGlow: isDark ? '0 0 20px rgba(0, 212, 255, 0.5)' : '0 0 20px rgba(0, 102, 204, 0.3)',
  
  // Chart/Graph
  gridLine: isDark ? 'rgba(73, 217, 245, 0.1)' : 'rgba(191, 219, 254, 0.4)',
  chartBg: isDark ? '#0a1628' : '#f8fafc',
  chartText: isDark ? '#e0e6ed' : '#334155',
  
  // Map
  mapBg: isDark ? 'linear-gradient(135deg, #1a3a52 0%, #0f2537 100%)' : 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
  mapWater: isDark ? 'rgba(0, 212, 255, 0.1)' : 'rgba(0, 102, 204, 0.1)',
  mapLand: isDark ? 'rgba(34, 60, 80, 0.8)' : 'rgba(180, 200, 210, 0.8)',
  
  // Status Colors
  success: isDark ? '#00ff88' : '#10b981',
  warning: isDark ? '#fbbf24' : '#f59e0b',
  error: isDark ? '#ef4444' : '#dc2626',
  verified: isDark ? '#00ff88' : '#10b981',
  pending: isDark ? '#fbbf24' : '#f59e0b',
});
