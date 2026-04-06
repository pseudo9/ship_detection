import type { RadarDataSet } from '../types';

export const mockRadarData: RadarDataSet = {
  data: [
    {
      id: 10438,
      timestamp: '2023-09-22 14:09:22.012029',
      amplitude: 411,
      pulse_width: 500,
      derived_feature_key: 1
    },
    {
      id: 10439,
      timestamp: '2023-09-22 14:09:22.284790',
      amplitude: 352,
      pulse_width: 480,
      derived_feature_key: 1
    },
    {
      id: 10440,
      timestamp: '2023-09-22 14:09:22.290004',
      amplitude: 325,
      pulse_width: 60,
      derived_feature_key: 1
    },
    {
      id: 10441,
      timestamp: '2023-09-22 14:09:22.904325',
      amplitude: 325,
      pulse_width: 60,
      derived_feature_key: 1
    },
    {
      id: 10442,
      timestamp: '2023-09-22 14:09:23.313283',
      amplitude: 301,
      pulse_width: 40,
      derived_feature_key: 1
    },
    {
      id: 22072,
      timestamp: '2023-09-22 14:33:02.172874',
      amplitude: 313,
      pulse_width: 440,
      derived_feature_key: 2
    },
    {
      id: 22073,
      timestamp: '2023-09-22 14:33:02.175033',
      amplitude: 434,
      pulse_width: 500,
      derived_feature_key: 2
    },
    {
      id: 22074,
      timestamp: '2023-09-22 14:33:02.177238',
      amplitude: 450,
      pulse_width: 520,
      derived_feature_key: 2
    },
    {
      id: 22075,
      timestamp: '2023-09-22 14:33:02.179369',
      amplitude: 382,
      pulse_width: 540,
      derived_feature_key: 2
    },
    {
      id: 22076,
      timestamp: '2023-09-22 14:33:02.181550',
      amplitude: 396,
      pulse_width: 480,
      derived_feature_key: 2
    }
  ],
  
  derived_features: {
    "1": {
      radar_id: "1000",
      time_active_from: "2023-09-22 14:09:22.012029",
      time_active_to: "2023-09-22 14:33:02.172874",
      radar_rotation_time_s: 2.5,
      radar_rotation_rate_rpm: 23,
      pulse_width: "100",
      pulse_repetition_interval_ms: 1.0
    },
    "2": {
      radar_id: "2000",
      time_active_from: "2023-09-22 14:33:02.175033",
      time_active_to: "2023-09-22 14:33:02.181550",
      radar_rotation_time_s: 2.0,
      radar_rotation_rate_rpm: 30,
      pulse_width: "200",
      pulse_repetition_interval_ms: 1.2
    }
  }
};