import { useState } from 'react';
import TopNav from './components/layout/TopNav';
import LeftPanel from './components/layout/LeftPanel';
import CenterPanel from './components/layout/CenterPanel';
import RightPanel from './components/layout/RightPanel';
import { useAppStore } from './stores/useAppStore';

function App() {
  const [visualizationData, setVisualizationData] = useState(null); // State to hold data for VisualizationWindow
  const { theme } = useAppStore();
  const isDark = theme === 'dark';

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: isDark 
        ? 'linear-gradient(135deg, #0a1628 0%, #1a2642 100%)'
        : 'linear-gradient(135deg, #e0e7ee 0%, #f5f7fa 100%)',
      transition: 'background 0.3s ease'
    }}>
      {/* Top Navigation */}
      <TopNav />
      
      {/* Main Content - 3 Columns */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        gap: '16px', 
        padding: '16px',
        overflow: 'hidden'
      }}>
        
        {/* LEFT PANEL */}
        <div style={{ 
          width: '340px', 
          flexShrink: 0,
          height: '100%'
        }}>
          <LeftPanel onVisualizationDataChange={setVisualizationData} />
        </div>

        {/* CENTER PANEL */}
        <div style={{ 
          flex: 1,
          height: '100%'
        }}>
          <CenterPanel visualizationData={visualizationData} />
        </div>

        {/* RIGHT PANEL */}
        {/* <div style={{ 
          width: '240px', 
          flexShrink: 0,
          height: '100%'
        }}>
          <RightPanel />
        </div> */}
        
      </div>
    </div>
  );
}

export default App;
