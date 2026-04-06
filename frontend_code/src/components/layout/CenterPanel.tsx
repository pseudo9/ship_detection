import { useEffect } from 'react';
import VisualizationWindow from '../visualization/VisualizationWindow';
import AnalysisReport from '../analysis/AnalysisReport';

interface CenterPanelProps {
  visualizationData: any; // Replace 'any' with the appropriate type if known
}

const CenterPanel = ({ visualizationData }: CenterPanelProps) => {
  useEffect(() => {
    // console.log('Visualization Data updated:', visualizationData);
  }, [visualizationData]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      background: 'none' // Removed any background styling
    }}>
      {/* Visualization Window - Takes 60% */}
      <div style={{ flex: '0 0 60%' }}>
        <VisualizationWindow data={visualizationData} />
      </div>

      {/* Analysis Report - Takes 40% */}
      <div style={{ flex: '1 1 40%', minHeight: 0, overflow: 'auto' }}>
        <AnalysisReport />
      </div>
    </div>
  );
};

export default CenterPanel;