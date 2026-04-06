import { useAppStore } from '../../stores/useAppStore';
import { useState } from 'react';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { DemoContainer, DemoItem } from '@mui/x-date-pickers/internals/demo'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { retrieveRadarData, uploadMrdData, uploadAisData, clearAllData, getAisMapPlotData } from '../../api/WaveFormApi';
import type { WaveformAppProps } from '../../types/index';

dayjs.extend(utc);
dayjs.extend(timezone);

// Define the desired format string
const customFormat = 'YYYY-MM-DD HH:mm:ss'
const initialValue = dayjs('2025-10-26T22:30:15') // 22:30:15 is 10:30:15 PM in 24h format

interface LeftPanelProps {
  onVisualizationDataChange?: (data: WaveformAppProps) => void;
}

const getUploadErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed?.detail === 'string' && parsed.detail.trim()) {
        return parsed.detail;
      }
    } catch {
      // Use the plain error message when it is not JSON.
    }

    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    try {
      const parsed = JSON.parse(error);
      if (typeof parsed?.detail === 'string' && parsed.detail.trim()) {
        return parsed.detail;
      }
    } catch {
      // Use the plain string when it is not JSON.
    }

    return error;
  }

  return 'Upload failed. Please try again.';
};

const LeftPanel: React.FC<LeftPanelProps> = ({ onVisualizationDataChange = () => {} }) => {
  const { 
    dataSource, 
    filters, 
    timeConfig,
    isUploading,
    uploadStatus,
    isAisUploading,
    aisUploadStatus,
    isClearing,
    clearStatus,
    theme,
    setDataSource, 
    toggleFilter,
    setTimeConfig,
    setUploading,
    setUploadStatus,
    setAisUploading,
    setAisUploadStatus,
    setClearing,
    setClearStatus,
    setAnalysisData,
    setMapData,
  } = useAppStore();
  
  const isDark = theme === 'dark';

  const [startTime, setStartTime] = useState<Dayjs | null>(timeConfig.startTime ? dayjs(timeConfig.startTime) : null);
  const [endTime, setEndTime] = useState<Dayjs | null>(timeConfig.endTime ? dayjs(timeConfig.endTime) : null);
  const [mrdFileName, setMrdFileName] = useState<string | null>(null);
  const [aisFileName, setAisFileName] = useState<string | null>(null);
  const [mrdUploadError, setMrdUploadError] = useState<string | null>(null);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleMrdFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setMrdFileName(file.name);
      setMrdUploadError(null);
      setUploading(true);
      setUploadStatus('pending');
      try {
        await uploadMrdData(file);
        setUploadStatus('success');
        setMrdUploadError(null);
      } catch (error) {
        setUploadStatus('error');
        setMrdUploadError(getUploadErrorMessage(error));
      } finally {
        setUploading(false);
      }
    }
  };

  const handleAisFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAisFileName(file.name);
      setAisUploading(true);
      setAisUploadStatus('pending');
      try {
        await uploadAisData(file);
        setAisUploadStatus('success');
      } catch (error) {
        setAisUploadStatus('error');
      } finally {
        setAisUploading(false);
      }
    }
  };

  const handleClearData = async () => {
    setClearing(true);
    setClearStatus('pending');
    try {
      await clearAllData();
      setClearStatus('success');
      
      // Reset file uploads
      setMrdFileName(null);
      setAisFileName(null);
      setMrdUploadError(null);
      
      // Reset file input elements
      const mrdInput = document.getElementById('mrd-upload') as HTMLInputElement;
      const aisInput = document.getElementById('ais-upload') as HTMLInputElement;
      if (mrdInput) mrdInput.value = '';
      if (aisInput) aisInput.value = '';
      
    } catch (error) {
      setClearStatus('error');
      console.error('Error clearing data:', error);
    } finally {
      setClearing(false);
    }
  };

  // Ensure UTC timezone is used to avoid daylight saving adjustments
  // Convert to string before setting the start time
  const handleStartTimeChange = (newValue: Dayjs | null) => {
    if (newValue) {
      const utcTime = newValue.utc(); // Convert to UTC
      setStartTime(utcTime);
    }
  };

  // Convert to string before setting the end time
  const handleEndTimeChange = (newValue: Dayjs | null) => {
    if (newValue) {
      const utcTime = newValue.utc(); // Convert to UTC
      setEndTime(utcTime);
    }
  };

  const handleApplyTimeframe = async () => {
    if (startTime && endTime) {
      try {
        const StartTimeString = startTime.format(customFormat);
        const EndTimeString = endTime.format(customFormat);
        
        // Update the timeConfig in the store
        setTimeConfig({ startTime: StartTimeString, endTime: EndTimeString });

        const radarData = await retrieveRadarData(StartTimeString, EndTimeString);

        // console.log('Radar Data:', radarData);

        // Fetch AIS map plot data for the same time range
        const aisMapData = await getAisMapPlotData(StartTimeString, EndTimeString);
        console.log('AIS Map Data:', aisMapData);
        
        // Transform and update map data in the store
        if (aisMapData.status === 'success' && aisMapData.data) {
          // Flatten the grouped data and transform to ShipDetection format
          const transformedMapData: any = {};

          Object.keys(aisMapData.data).forEach((mmsi) => {
            transformedMapData[mmsi] = aisMapData.data[mmsi].map((aisRecord: any) => ({
              mmsi: String(aisRecord.mmsi),
              receptionLocation: aisRecord.reception_location || 'Unknown',
              timestamp: (aisRecord.reception_time || ''),
              latitude: aisRecord.latitude,
              longitude: aisRecord.longitude,
              speedOverGround: aisRecord.speed_over_ground || 0,
              courseOverGround: aisRecord.course_over_ground || null,
              navigationalStatus: aisRecord.navigational_status || 0,
              messageType: aisRecord.message_type || null,
              aisClass: aisRecord.ais_class || null,
              isInZone: aisRecord.is_in_zone || false,
              ship_name: aisRecord.ship_name || '',
              ship_length: aisRecord.ship_length || '',
              ship_width: aisRecord.ship_width || '',
              true_heading: aisRecord.true_heading || '',
            }));
          });

          // Store uniqueShips and shipPlottingData as separate properties
          setMapData({
            uniqueShips: aisMapData.unique_ships,
            shipPlottingData: transformedMapData
          });
        }

        // Update analysis data in the store
        setAnalysisData({
          numberOfRadars: radarData.radar_unique_attributes.length,
          numberOfShips: radarData.ais_ships_in_zone_count,
          radar_unique_attributes: radarData.radar_unique_attributes,
          ais_unique_ships: radarData.ais_unique_ships,
        });

        // Iterate over radarData and map to x and y
        const x = radarData.radar_signal_data.map((item: any) => item.timestamp);
        const y = radarData.radar_signal_data.map((item: any) => item.amplitude);

        // Assign to formattedData
        const formattedData: WaveformAppProps = {
          data: {
            x,
            y
          }
        };

        onVisualizationDataChange(formattedData); // Pass data to parent

      } catch (error) {
        console.error('Error retrieving radar data:', error);
      }
    } else {
      console.warn('Start time or end time is not set');
    }
  };

  return (
    <div style={{
      background: isDark ? 'rgba(13, 27, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      border: isDark ? '1px solid rgba(42, 74, 111, 0.5)' : '1px solid rgba(203, 213, 224, 0.8)',
      borderRadius: '12px',
      padding: '24px',
      height: '100%',
      overflowY: 'auto',
      color: isDark ? '#e0e6ed' : '#1a202c',
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      transition: 'all 0.3s ease'
    }}>
      
      {/* Data Source Selection */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: isDark ? '#00d4ff' : '#0066cc',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: isDark ? '2px solid rgba(0, 212, 255, 0.3)' : '2px solid rgba(0, 102, 204, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s ease'
        }}>
          <span></span>
          Data Source
        </h2>
        
        {/* <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => setDataSource('offline')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: dataSource === 'offline' ? '1px solid #00d4ff' : '1px solid #2a4a6f',
              background: dataSource === 'offline' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(26, 38, 66, 0.5)',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: dataSource === 'offline' ? '#00d4ff' : '#666'
                }} />
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Offline Data</span>
              </div>
              <span></span>
            </div>
          </button>

          <button
            onClick={() => setDataSource('live')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: dataSource === 'live' ? '1px solid #00d4ff' : '1px solid #2a4a6f',
              background: dataSource === 'live' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(26, 38, 66, 0.5)',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: dataSource === 'live' ? '#00ff88' : '#666'
                }} />
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Live Feed</span>
              </div>
              <span></span>
            </div>
          </button>
        </div> */}

        {/* File Upload Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          {/* MRD Data Upload */}
          <div>
            <label 
              htmlFor="mrd-upload"
              style={{
                display: 'block',
                padding: '20px',
                border: '2px dashed rgba(0, 212, 255, 0.3)',
                borderRadius: '8px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.6)';
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📁</div>
              <div style={{ fontSize: '0.875rem', color: '#9aa5b1', marginBottom: '4px' }}>
                {isUploading ? 'Uploading...' : 'Click to upload MRD data'}
              </div>
              {uploadStatus === 'success' && mrdFileName && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#00d4ff', 
                  marginTop: '8px',
                  fontWeight: 600 
                }}>
                  ✓ {mrdFileName} uploaded successfully!
                </div>
              )}
              {uploadStatus === 'error' && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#ff4d4d', 
                  marginTop: '8px',
                  fontWeight: 600 
                }}>
                  ✗ {mrdUploadError || 'Upload failed. Please try again.'}
                </div>
              )}
              {uploadStatus === 'pending' && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#e0e6ed', 
                  marginTop: '8px',
                  fontWeight: 600 
                }}>
                  Processing...
                </div>
              )}
            </label>
            <input
              id="mrd-upload"
              type="file"
              accept=".bin"
              onChange={handleMrdFileUpload}
              style={{ display: 'none' }}
            />
          </div>

          {/* AIS Data Upload */}
          <div>
            <label
              htmlFor="ais-upload"
              style={{
                display: 'block',
                padding: '20px',
                border: '2px dashed rgba(0, 212, 255, 0.3)',
                borderRadius: '8px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.6)';
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📡</div>
              <div style={{ fontSize: '0.875rem', color: '#9aa5b1', marginBottom: '4px' }}>
                {useAppStore.getState().isAisUploading ? 'Uploading...' : 'Click to upload AIS data'}
              </div>
              {useAppStore.getState().aisUploadStatus === 'success' && aisFileName && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#00d4ff',
                  marginTop: '8px',
                  fontWeight: 600
                }}>
                  ✓ {aisFileName} uploaded successfully!
                </div>
              )}
              {useAppStore.getState().aisUploadStatus === 'error' && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#ff4d4d',
                  marginTop: '8px',
                  fontWeight: 600
                }}>
                  ✗ Upload failed. Please try again.
                </div>
              )}
              {useAppStore.getState().aisUploadStatus === 'pending' && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#e0e6ed',
                  marginTop: '8px',
                  fontWeight: 600
                }}>
                  Processing...
                </div>
              )}
            </label>
            <input
              id="ais-upload"
              type="file"
              accept=".ais,.csv,.txt"
              onChange={handleAisFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Clear Data Button */}
        <button
          onClick={handleClearData}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '16px',
            background: 'rgba(100, 116, 139, 0.2)',
            border: '1px solid rgba(100, 116, 139, 0.5)',
            borderRadius: '8px',
            color: '#9aa5b1',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(100, 116, 139, 0.3)';
            e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.5)';
          }}
        >
          🗑️ Clear Data
        </button>
        {isClearing && <div style={{ fontSize: '0.75rem', color: '#e0e6ed', marginTop: '8px', fontWeight: 600 }}>Clearing data...</div>}
        {clearStatus === 'success' && <div style={{ fontSize: '0.75rem', color: '#00d4ff', marginTop: '8px', fontWeight: 600 }}>✓ Data cleared successfully!</div>}
        {clearStatus === 'error' && <div style={{ fontSize: '0.75rem', color: '#ff4d4d', marginTop: '8px', fontWeight: 600 }}>✗ Error clearing data.</div>}
      </section>

      {/* Time Configuration */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: isDark ? '#00d4ff' : '#0066cc',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: isDark ? '2px solid rgba(0, 212, 255, 0.3)' : '2px solid rgba(0, 102, 204, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s ease'
        }}>
          <span></span>
          Time Configuration
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DemoContainer
                components={['DateTimePicker', 'DateTimePicker']}
              >
                <DemoItem label={`Start Time (HH:MM:SS)`}>
                  <DateTimePicker
                    value={startTime ? dayjs(startTime) : null}
                    onChange={(newValue) => handleStartTimeChange(newValue)}
                    views={['year', 'day', 'hours', 'minutes', 'seconds']}
                    format={customFormat}
                    //  timezone="Europe/Berlin"
                    ampm={false}
                    sx={{
                      width: '100%',
                      background: 'rgba(194, 210, 247, 0.6)',
                      borderRadius: '8px',
                      fontSize: '0.875rem'
                    }}
                  />
                </DemoItem>

                <DemoItem label={`End Time (HH:MM:SS)`}>
                  <DateTimePicker
                    value={endTime ? dayjs(endTime) : null}
                    onChange={(newValue) => handleEndTimeChange(newValue)}
                    views={['year', 'day', 'hours', 'minutes', 'seconds']}
                    format={customFormat}
                    ampm={false}
                    sx={{
                      width: '100%',
                      background: 'rgba(194, 210, 247, 0.6)',
                      borderRadius: '8px',
                      fontSize: '0.875rem'
                    }}
                  />
                </DemoItem>
              </DemoContainer>
            </LocalizationProvider>
          </div>
          <button
            onClick={handleApplyTimeframe}
            style={{
              width: '100%',
              padding: '10px',
              background: isDark ? 'linear-gradient(to right, #00d4ff, #0099cc)' : 'linear-gradient(to right, #0066cc, #0080ff)',
              border: 'none',
              borderRadius: '8px',
              color: isDark ? '#0d1b2a' : '#ffffff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
              marginTop: '12px',
              transition: 'all 0.3s ease'
            }}
          >
            Apply Timeframe
          </button>
        </div>
      </section>

      {/* Render DateTimePicker Component */}
      <section style={{ marginBottom: '24px' }}>
      </section>

      {/* Data Filters */}
      {/* <section style={{ marginBottom: '24px' }}>
        <h2 style={{
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
          <span></span>
          Data Filters
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
          <button
            onClick={() => toggleFilter('lowPass')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: filters.lowPass ? '1px solid #00d4ff' : '1px solid #2a4a6f',
              background: filters.lowPass ? 'rgba(0, 212, 255, 0.2)' : 'rgba(26, 38, 66, 0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.3s'
            }}
          >
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              border: filters.lowPass ? '2px solid #00d4ff' : '2px solid #2a4a6f',
              background: filters.lowPass ? '#00d4ff' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              {filters.lowPass ? '✓' : ''}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Filter 1
            </span>
          </button>

         
          <button
            onClick={() => toggleFilter('highPass')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: filters.highPass ? '1px solid #00d4ff' : '1px solid #2a4a6f',
              background: filters.highPass ? 'rgba(0, 212, 255, 0.2)' : 'rgba(26, 38, 66, 0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.3s'
            }}
          >
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              border: filters.highPass ? '2px solid #00d4ff' : '2px solid #2a4a6f',
              background: filters.highPass ? '#00d4ff' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 'bold',
            
            }}>
              {filters.highPass ? '✓' : ''}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Filter 2
            </span>
          </button>

        
          <button
            onClick={() => toggleFilter('bandPass')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: filters.bandPass ? '1px solid #00d4ff' : '1px solid #2a4a6f',
              background: filters.bandPass ? 'rgba(0, 212, 255, 0.2)' : 'rgba(26, 38, 66, 0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.3s'
            }}
          >
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              border: filters.bandPass ? '2px solid #00d4ff' : '2px solid #2a4a6f',
              background: filters.bandPass ? '#00d4ff' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              {filters.bandPass ? '✓' : ''}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Filter 3
            </span>
          </button>

         
          <button
            onClick={() => toggleFilter('noiseReduction')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: filters.noiseReduction ? '1px solid #00d4ff' : '1px solid #2a4a6f',
              background: filters.noiseReduction ? 'rgba(0, 212, 255, 0.2)' : 'rgba(26, 38, 66, 0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.3s'
            }}
          >
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              border: filters.noiseReduction ? '2px solid #00d4ff' : '2px solid #2a4a6f',
              background: filters.noiseReduction ? '#00d4ff' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              {filters.noiseReduction ? '✓' : ''}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Filter 4
            </span>
          </button>
        </div>

        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: 'rgba(0, 212, 255, 0.2)',
          border: '1px solid #00d4ff',
          borderRadius: '20px',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#00d4ff',
          fontWeight: 600
        }}>
          {activeFilterCount} Filter{activeFilterCount !== 1 ? 's' : ''} Active
        </div>
      </section> */}
    </div>
  );
};

export default LeftPanel;



