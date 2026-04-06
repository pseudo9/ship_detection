import { create } from 'zustand';
import type { AppState, SignalFilters, TimeConfig, ShipDetection } from '../types';

interface AppStore extends AppState {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setDataSource: (source: 'offline' | 'live') => void;
  toggleFilter: (filter: keyof SignalFilters) => void;
  setTimeConfig: (config: TimeConfig) => void;
  setCurrentPage: (page: number) => void;
  togglePlayback: () => void;
  setCurrentView: (view: AppState['currentView']) => void;
  toggleRadar: (radarId: number) => void;
  setZoom: (zoom: number) => void;
  setMapData: (data: any) => void;
  mapData: any;
  isUploading: boolean;
  uploadStatus: 'pending' | 'success' | 'error' | 'idle';
  isAisUploading: boolean;
  aisUploadStatus: 'pending' | 'success' | 'error' | 'idle';
  setUploading: (isUploading: boolean) => void;
  setUploadStatus: (uploadStatus: 'pending' | 'success' | 'error' | 'idle') => void;
  setAisUploading: (isAisUploading: boolean) => void;
  setAisUploadStatus: (aisUploadStatus: 'pending' | 'success' | 'error' | 'idle') => void;
  isClearing: boolean;
  clearStatus: 'pending' | 'success' | 'error' | 'idle';
  setClearing: (isClearing: boolean) => void;
  setClearStatus: (clearStatus: 'pending' | 'success' | 'error' | 'idle') => void;
  analysisData: {
    numberOfRadars: number;
    numberOfShips: number;
    radar_unique_attributes: any[];
    ais_unique_ships: any[];
  };
  setAnalysisData: (data: {
    numberOfRadars: number;
    numberOfShips: number;
    radar_unique_attributes: any[];
    ais_unique_ships: any[];
  }) => void;
}


export const useAppStore = create<AppStore>((set) => ({
  // Initial state
  theme: 'dark',
  dataSource: 'offline',
  currentPage: 1,
  totalPages: 48,
  isPlaying: false,
  filters: {
    lowPass: true,
    highPass: false,
    bandPass: true,
    noiseReduction: true,
  },
  timeConfig: {
    startTime: '10:00:00',
    endTime: '10:05:00',
  },

  currentView: 'waveform',
  activeRadars: [1, 2, 3],
  zoom: 2.0,
  signalMetrics: {
    prf: 842,
    pri: 1.19,
    rotationPeriod: 2.8,
    snr: 24.5,
  },

  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  
  // Actions
  setDataSource: (source) => set({ dataSource: source }),
  
  toggleFilter: (filter) => set((state) => ({
    filters: {
      ...state.filters,
      [filter]: !state.filters[filter],
    },
  })),
  
  setTimeConfig: (config) => set({ timeConfig: config }),
  
  setCurrentPage: (page) => set({ currentPage: page }),
  
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  setCurrentView: (view) => set({ currentView: view }),
  
  toggleRadar: (radarId) => set((state) => {
    const activeRadars = state.activeRadars.includes(radarId)
      ? state.activeRadars.filter(id => id !== radarId)
      : [...state.activeRadars, radarId];
    return { activeRadars };
  }),
  
  setZoom: (zoom) => set({ zoom }),
  
  
  mapData: {},
  setMapData: (data) => set({ mapData: data }),
  
  isUploading: false,
  uploadStatus: 'idle',
  setUploading: (isUploading) => set({ isUploading }),
  setUploadStatus: (uploadStatus) => set({ uploadStatus }),
  isAisUploading: false,
  aisUploadStatus: 'idle',
  setAisUploading: (isAisUploading) => set({ isAisUploading }),
  setAisUploadStatus: (aisUploadStatus) => set({ aisUploadStatus }),
  isClearing: false,
  clearStatus: 'idle',
  setClearing: (isClearing) => set({ isClearing }),
  setClearStatus: (clearStatus) => set({ clearStatus }),
  analysisData: {
    numberOfRadars: 0,
    numberOfShips: 0,
    radar_unique_attributes: [],
    ais_unique_ships: [],
  },
  setAnalysisData: (data) => set({ analysisData: data }),
}));