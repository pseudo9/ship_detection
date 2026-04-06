import 'leaflet-timedimension/dist/leaflet.timedimension.control.css';
import 'leaflet-timedimension';
import { useMap } from 'react-leaflet';
import React from 'react';

// Add TimeDimension control to the map
const PlaybackControl = () => {
	const map = useMap();
	React.useEffect(() => {
		// @ts-ignore
		if (!map.timeDimension) {
			// @ts-ignore
			map.timeDimension = new window.L.TimeDimension({
				period: 'PT1M',
			});
		}
		// @ts-ignore
		const tdControl = new window.L.Control.TimeDimension({
			position: 'bottomleft',
			autoPlay: false,
			minSpeed: 1,
			speedStep: 1,
			maxSpeed: 15,
			timeSliderDragUpdate: true,
		});
		map.addControl(tdControl);
		return () => {
			map.removeControl(tdControl);
		};
	}, [map]);
	return null;
};

export default PlaybackControl;
