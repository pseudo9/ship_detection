const BASE_URL = import.meta.env.VITE_BACKEND_HOST;
// const TEMP_DATA_KEY = 'tempData';

export const fetchAllDataFromDB = async () => {
  // const cachedData = localStorage.getItem(TEMP_DATA_KEY);
  // if (cachedData) {
  //   return JSON.parse(cachedData);
  // }

  const response = await fetch(`${BASE_URL}/get-sensor-data/`);
  if (!response.ok) {
    throw new Error('Failed to fetch waveform data');
  }

  const data = await response.json();

  // localStorage.setItem(TEMP_DATA_KEY, JSON.stringify(data));
  return data;
};

export const retrieveRadarData = async (startTime: string, endTime: string) => {
  const response = await fetch(`${BASE_URL}/retrieve-radar-data/?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`);

  if (!response.ok) {
    throw new Error('Failed to retrieve radar data');
  }

  return await response.json();
};

export const uploadMrdData = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/upload-sensor-data/`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let message = 'Failed to upload MRD data';

    try {
      const errorText = await response.text();

      if (errorText.trim()) {
        try {
          const errorData = JSON.parse(errorText);
          if (typeof errorData?.detail === 'string' && errorData.detail.trim()) {
            message = errorData.detail;
          } else {
            message = errorText;
          }
        } catch {
          message = errorText;
        }
      }
    } catch {
      // Fall back to the default message when the response body cannot be read.
    }

    throw new Error(message);
  }

  return await response.json();
};

export const uploadAisData = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/upload-ais-data/`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload AIS data');
  }

  return await response.json();
};

export const clearAllData = async () => {
  const response = await fetch(`${BASE_URL}/clear-all-data/`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to clear data');
  }

  return await response.json();
};

export const getAisData = async () => {
  const response = await fetch(`${BASE_URL}/get-ais-data/`);

  if (!response.ok) {
    throw new Error('Failed to fetch AIS data');
  }

  return await response.json();
};

export const getAisMapPlotData = async (startTime: string, endTime: string) => {
  const response = await fetch(
    `${BASE_URL}/get-ais-map-plot-data/?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch AIS map plot data');
  }

  return await response.json();
};


export interface RadarFingerprint {
  pulse_width_mode: number;
  est_radar_rotation_time: number;
  pulse_repetition_time_micro_s: number;
}

export interface ShipReport {
  mmsi: string;
  overlap_start: string | null;
  overlap_end: string | null;
  speed_min: number | null;
  speed_max: number | null;
  course_min: number | null;
  course_max: number | null;
  number_of_radars: number;
  fingerprints: RadarFingerprint[];
  length: number | null;
  beam: number | null;
}

export interface ReportData {
  date: string;
  start_time: string;
  end_time: string;
  number_of_ships: number;
  number_of_radars: number;
  ships: ShipReport[];
}

export const generateReport = async (startTime: string, endTime: string): Promise<ReportData> => {
  const response = await fetch(
    `${BASE_URL}/api/generate-report?start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`
  );

  if (!response.ok) {
    throw new Error('Failed to generate report');
  }

  const result = await response.json();
  return result.report;
};

export const saveReport = async (data: ReportData) => {
  const response = await fetch(`${BASE_URL}/api/save-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to save report');
  }

  return await response.json();
};

export interface SavedReportRecord {
  id: number;
  report_date: string;
  report_start_time: string;
  report_end_time: string;
  mmsi: string;
  overlap_start: string | null;
  overlap_end: string | null;
  speed_min: number | null;
  speed_max: number | null;
  course_min: number | null;
  course_max: number | null;
  length: number | null;
  beam: number | null;
  pulse_width_mode: number | null;
  est_radar_rotation_time: number | null;
  pulse_repetition_time_micro_s: number | null;
  created_at: string | null;
}

export const getSavedReports = async (): Promise<SavedReportRecord[]> => {
  const response = await fetch(`${BASE_URL}/api/saved-reports`);

  if (!response.ok) {
    throw new Error('Failed to fetch saved reports');
  }

  const result = await response.json();
  return result.data;
};
