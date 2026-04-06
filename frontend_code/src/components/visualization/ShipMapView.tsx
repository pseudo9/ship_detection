
import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import L from 'leaflet';
import 'leaflet-timedimension';
import 'leaflet/dist/leaflet.css';
import 'leaflet-timedimension/src/leaflet.timedimension.control.css';
import { FullScreen } from 'leaflet.fullscreen';
import omnivore from 'leaflet-omnivore/leaflet-omnivore.js';
import { getCommonBaseLayers } from '../../utils/getCommonBaseLayers';
import 'leaflet.fullscreen/dist/Control.FullScreen.css';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';


// TypeScript global declaration for omnivore
declare global {
  interface Window {
    omnivore: {
      gpx: (url: string, options?: any, customLayer?: any) => any;
      // Add other methods if needed
    };
  }
}

declare module 'leaflet' {
  export class TimeDimension extends L.Evented {
    constructor(options?: any);
    // Add any additional methods/properties you use
  }
}

// Sensor range area polygon (lat, lon)
const SENSOR_RANGE_AREA = [
  [59.595574362762164, 10.599478202033964],
  [59.57155601955038, 10.601453094501752],
  [59.57063442476659, 10.662134057916324],
  [59.59674128924907, 10.659840051737666],
  [59.595574362762164, 10.599478202033964], // Close the polygon
];

// 20 unique, visually distinct colors (no color family dominates)
const COLOR_PALETTE = [
  '#E6194B', // Red
  '#3CB44B', // Green
  '#FFE119', // Yellow
  '#4363D8', // Blue
  '#F58231', // Orange
  '#911EB4', // Purple
  '#46F0F0', // Cyan
  '#F032E6', // Magenta
  '#BCF60C', // Lime
  '#FABEBE', // Pink
  '#008080', // Teal
  '#E6BEFF', // Lavender
  '#9A6324', // Brown
  '#FFFAC8', // Cream
  '#800000', // Maroon
  '#Aaffc3', // Mint
  '#808000', // Olive
  '#FFD8B1', // Apricot
  '#000075', // Navy
  '#808080', // Grey
];

// Helper to generate a unique color in HSL format
function generateColor(index: number): string {
  const hue = (index * 137.508) % 360; // use golden angle for best distribution
  return `hsl(${hue}, 70%, 50%)`;
}

const LeafletMap: React.FC = () => {
  // Get ship map data from the store for later use
  const { mapData } = useAppStore();
  console.log('mapData in ShipMapView:', mapData);
  // Extract uniqueShips and shipPlottingData
  // uniqueShips is a number representing the count
  const uniqueShips = Number(mapData?.uniqueShips) || 0;
  const shipPlottingData = mapData?.shipPlottingData || {};
  const hasMapData = Object.keys(shipPlottingData).length > 0;

  // Snackbar state
  const [open, setOpen] = useState(false);
  const [shipCount, setShipCount] = useState(0);

  // Log when uniqueShips data is received
  useEffect(() => {
    if (uniqueShips > 0) {
      console.log('Unique ships data received in ShipMapView:', uniqueShips);
    }
  }, [uniqueShips]);
  // Always show snackbar when map view is rendered and uniqueShips are present
  useEffect(() => {
    console.log('Snackbar effect triggered');
    console.log('hasMapData:', hasMapData);
    console.log('uniqueShips:', uniqueShips);
    if (hasMapData && uniqueShips > 0) {
      console.log('Setting shipCount and opening Snackbar');
      setShipCount(uniqueShips);
      setOpen(true);
    }
  }, [hasMapData, uniqueShips]);

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  useEffect(() => {
    // Clean up any previous map instance
    let map: L.Map | null = null;
    if (document.getElementById('leafletmap')) {
      map = L.map('leafletmap', { fullscreenControl: true }).setView([59.570618,10.631136 ], 10);
      map.addControl(
        new FullScreen({
          position: 'topright'
        })
      );
      // Draw SENSOR_RANGE_AREA as a dashed polyline
      const sensorRangePolyline = L.polyline(SENSOR_RANGE_AREA, {
        color: '#00d4ff',
        weight: 3,
        dashArray: '8 8',
        opacity: 0.8,
      });
      sensorRangePolyline.addTo(map);
      // Animate all ships' trajectories using leaflet-timedimension
      let staticGeoJson = null;
      let geoJsonLayer = null;
      if (hasMapData) {
        // Prepare static geojson data for all ships, including LineString for animated polyline
        const shipEntries = Object.entries(shipPlottingData);
        // Assign a unique color to each shipKey (MMSI)
        const shipKeys = shipEntries.map(([shipKey]) => shipKey);
        const colorMap: Record<string, string> = {};
        shipKeys.forEach((shipKey, idx) => {
          colorMap[shipKey] = idx < COLOR_PALETTE.length ? COLOR_PALETTE[idx] : generateColor(idx);
        });

        const features = shipEntries.flatMap(([shipKey, shipDetections]) => {
          if (!Array.isArray(shipDetections) || shipDetections.length === 0) return [];
          // Sort by timestamp if needed
          const sorted = [...shipDetections].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          // Assign a unique color for this ship
          const color = colorMap[shipKey];
          // Each detection as a Point feature (optionally with time property)
          const pointFeatures = sorted.map((d, i) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [d.longitude, d.latitude],
            },
            properties: {
              mmsi: d.mmsi,
              receptionLocation: d.receptionLocation || '',
              time: d.timestamp,
              last: i === sorted.length - 1, // Mark last point
              latitude: d.latitude,
              longitude: d.longitude,
              speedOverGround: d.speed_over_ground || 0,
              // ship_name: d.ship_name || '',
              // ship_length: d.ship_length || '',
              // ship_width: d.ship_width || '',
              // course_over_ground: d.course_over_ground || '',
              // true_heading: d.true_heading || '',
            },
          }));
          // Create a LineString feature for the ship's trajectory, with time array and unique color
          if (sorted.length > 1) {
            return [
              ...pointFeatures,
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: sorted.map(d => [d.longitude, d.latitude]),
                },
                properties: {
                  mmsi: sorted[0].mmsi,
                  receptionLocation: sorted[0].receptionLocation || '',
                  times: sorted.map(d => d.timestamp),
                  ship_timestamp: sorted[0].timestamp,
                  ship_name: sorted[0].ship_name || '',
                  ship_length: sorted[0].ship_length || '',
                  ship_width: sorted[0].ship_width || '',
                  speed_over_ground: sorted[0].speed_over_ground || '',
                  course_over_ground: sorted[0].course_over_ground || '',
                  true_heading: sorted[0].true_heading || '',
                  style: { color, weight: 3 },
                },
              },
            ];
          }
          return pointFeatures;
        });
        staticGeoJson = {
          type: 'FeatureCollection',
          features,
        };
        // Function to create a colored marker icon (SVG data URI)
        function createColoredMarkerIcon(color: string) {
          const svg = `
            <svg xmlns='http://www.w3.org/2000/svg' width='25' height='41' viewBox='0 0 25 41'>
              <path d='M12.5 0C5.6 0 0 5.6 0 12.5c0 9.1 11.2 27.1 11.7 27.9.4.7 1.5.7 1.9 0C13.8 39.6 25 21.6 25 12.5 25 5.6 19.4 0 12.5 0z' fill='${color}' stroke='#222' stroke-width='2'/>
              <circle cx='12.5' cy='12.5' r='5' fill='white' stroke='#222' stroke-width='2'/>
            </svg>
          `;
          return L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
            shadowSize: [41, 41]
          });
        }

        geoJsonLayer = L.geoJson(staticGeoJson, {
          filter: (feature) => feature.geometry.type === 'LineString' || feature.geometry.type === 'Point',
          style: (feature) => feature.properties && feature.properties.style ? feature.properties.style : { color: 'blue', weight: 3 },
          pointToLayer: function (feature, latLng) {
            if (feature.properties && feature.properties.last) {
              // Debug: log all properties for this marker
              console.log('Marker feature.properties:', feature.properties);
              // Use the color from the corresponding polyline (feature.properties.style.color)
              const color = feature.properties && feature.properties.style && feature.properties.style.color
                ? feature.properties.style.color
                : (colorMap[feature.properties.mmsi] || 'blue');
              const marker = L.marker(latLng, { icon: createColoredMarkerIcon(color) });
              // Prefer timestamp if available, else time
              let timeValue = feature.properties.ship_timestamp || '';
              if (typeof timeValue === 'string') {
                timeValue = timeValue.replace('T', ' ').replace('Z', '');
              }
                const popupContent = `
                  <div style="padding:12px;min-width:320px;font-family:Segoe UI,sans-serif;font-size:0.875rem;position:relative;">
                    <div style='position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background-color:${color};border:2px solid #333;cursor:pointer;'></div>
                    <div style="font-size:1rem;font-weight:700;color:#000;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid ${color};padding-right:40px;">
                      🚢 ${feature.properties.ship_name && feature.properties.ship_name !== 'Unknown' ? feature.properties.ship_name : `MMSI: ${feature.properties.mmsi}`}
                    </div>
                    <div style="display:flex;gap:16px;">
                      <div style="flex:1;min-width:140px;">
                        <div style="margin-bottom:8px;">
                          <div style="color:#000;font-size:0.75rem;margin-bottom:2px;"><strong>MMSI</strong></div>
                          <div style="font-family:monospace;font-size:0.75rem;color:#000;">${feature.properties.mmsi}</div>
                        </div>
                        <div style="margin-bottom:8px;">
                          <div style="color:#000;font-size:0.75rem;margin-bottom:2px;"><strong>Time</strong></div>
                          <div style="font-size:0.75rem;color:#000;">${timeValue}</div>
                        </div>
                        <div style="margin-bottom:8px;">
                          <div style="color:#000;font-size:0.75rem;margin-bottom:2px;"><strong>Ship Name</strong></div>
                          <div style="font-size:0.75rem;color:#000;">${feature.properties.ship_name || 'Unknown'}</div>
                        </div>
                        <div style="margin-bottom:8px;">
                          <div style="color:#000;font-size:0.75rem;margin-bottom:2px;"><strong>Ship Length</strong></div>
                          <div style="font-size:0.75rem;color:#000;">${feature.properties.ship_length || 'Unknown'} m</div>
                        </div>
                      </div>
                      <div style="flex:1;min-width:140px;">
                        <div style="margin-bottom:8px;">
                          <div style="color:#000;font-size:0.75rem;margin-bottom:2px;"><strong>Ship Width</strong></div>
                          <div style="font-size:0.75rem;color:#000;">${feature.properties.ship_width || 'Unknown'} m</div>
                        </div>
                        <div style="margin-bottom:8px;">
                          <div style="color:#000;font-size:0.75rem;margin-bottom:2px;"><strong>Speed Over Ground</strong></div>
                          <div style="font-size:0.75rem;color:#000;">${feature.properties.speed_over_ground || 'Unknown'} knots</div>
                        </div>
                        <div style="margin-bottom:8px;">
                          <div style="color:#000;font-size:0.75rem;margin-bottom:2px;"><strong>Course Over Ground</strong></div>
                          <div style="font-size:0.75rem;color:#000;">${feature.properties.course_over_ground || 'Unknown'}</div>
                        </div>
                        <div style="margin-bottom:8px;">
                          <div style="color:#000;font-size:0.75rem;margin-bottom:2px;"><strong>True Heading</strong></div>
                          <div style="font-size:0.75rem;color:#000;">${feature.properties.true_heading || 'Unknown'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              marker.bindPopup(popupContent);
              return marker;
            }
            // Do not render other points
            return null;
          }
        });
      }

      // Create and attach TimeDimension and Player before adding the control
      const timeDimension = new L.TimeDimension({
        period: 'PT1M',
      });

      map.timeDimension = timeDimension;
      const player = new L.TimeDimension.Player({
        transitionTime: 100,
        loop: false,
        startOver: true
      }, timeDimension);

      const timeDimensionControlOptions = {
        player,
        timeDimension,
        position: 'bottomleft',
        autoPlay: true,
        minSpeed: 1,
        speedStep: 0.5,
        maxSpeed: 15,
        timeSliderDragUpdate: true
      };
      var timeDimensionControl = new L.Control.TimeDimension(timeDimensionControlOptions);
      map.addControl(timeDimensionControl);

      // Animate polylines with time control
      let geoJsonTimeLayer = null;
      if (geoJsonLayer) {
        geoJsonTimeLayer = L.timeDimension.layer.geoJson(geoJsonLayer, {
          updateTimeDimension: true,
          addlastPoint: true,
          waitForReady: true
        });
        geoJsonTimeLayer.addTo(map);
      }
      L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.{ext}', {
        attribution: '&copy; OpenStreetMap contributors',
        ext: 'png'
      }).addTo(map);
    }
    return () => {
      if (map) map.remove();
    };
  }, [mapData]);

  // Add the map div and snackbar here
  return (
    <>
      <div id="leafletmap" style={{ height: "100%", width: "100%" }}></div>
      <Snackbar
        open={open}
        autoHideDuration={2000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {`Loaded ${shipCount} unique ship${shipCount !== 1 ? 's' : ''} on the map!`}
        </Alert>
      </Snackbar>
    </>
  );
};

export default LeafletMap;