export interface ShipDetection {
  mmsi: string;  // Changed from 'id' to match real data
  name?: string;  // Ship name from MRD
  timestamp: string;
  latitude: number;  // Real GPS coordinates
  longitude: number;
  speedOverGround: number;  // From AIS
  courseOverGround: number | null;
  trueHeading: number | null;
  aisStatus: 'verified' | 'pending';  // Matched with AIS or not
  confidence: number;
  radarSource: number;
  navigationalStatus?: number;
}

export interface AISMessage {
  mmsi: string;
  type: string;
  msgtime: string;
  latitude?: number;
  longitude?: number;
  sog?: number;      // Speed over ground
  cog?: number;      // Course over ground
  heading?: number;
  nav_status?: number;
}

export interface AISRecord {
  reception_time: string;
  mmsi: string;
  reception_location: string;
  message_type: number;
  message: AISMessage;
  // Derived fields for easy access
  latitude?: number;
  longitude?: number;
  sog?: number;
  cog?: number;
  heading?: number;
}

export interface SignalFilters {
  lowPass: boolean;
  highPass: boolean;
  bandPass: boolean;
  noiseReduction: boolean;
}

export interface TimeConfig {
  startTime: string;
  endTime: string;
}

export interface SignalMetrics {
  prf: number;
  pri: number;
  rotationPeriod: number;
  snr: number;
}

export interface RadarData {
  time: number[];
  amplitude: number[];
  frequency: number[];
}

export interface AppState {
  dataSource: 'offline' | 'live';
  currentPage: number;
  totalPages: number;
  isPlaying: boolean;
  filters: SignalFilters;
  timeConfig: TimeConfig;
  detections: ShipDetection[];
  currentView: 'waveform' | 'map' | 'spectrum' | 'waterfall';
  activeRadars: number[];
  zoom: number;
  signalMetrics: SignalMetrics;
}

export interface WaveformAppProps {
  data: { x: string[]; y: number[] } | null;
}