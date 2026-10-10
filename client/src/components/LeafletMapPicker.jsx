import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Crosshair, Check } from 'lucide-react';

// Custom SVG Pin Icon for crisp rendering without broken default image URLs
const createCustomIcon = () => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        background: linear-gradient(135deg, #6366f1, #a855f7);
        width: 34px;
        height: 34px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
};

/**
 * Leaflet Interactive Map Picker component
 * @param {Object} props
 * @param {number[]} [props.value] - [longitude, latitude]
 * @param {function} props.onChange - Callback with [longitude, latitude]
 */
export default function LeafletMapPicker({ value, onChange }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);

  // Default to Mumbai center if no coordinates provided
  const defaultLng = 72.8777;
  const defaultLat = 19.076;

  const currentLng = value && typeof value[0] === 'number' ? value[0] : null;
  const currentLat = value && typeof value[1] === 'number' ? value[1] : null;

  const hasCoords = currentLng !== null && currentLat !== null;

  // Manual coordinate input state
  const [inputLat, setInputLat] = useState(
    currentLat !== null ? currentLat.toString() : ''
  );
  const [inputLng, setInputLng] = useState(
    currentLng !== null ? currentLng.toString() : ''
  );
  const [manualError, setManualError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Sync inputs when external value changes and user isn't actively typing
  useEffect(() => {
    if (!isEditing) {
      setInputLat(currentLat !== null ? currentLat.toString() : '');
      setInputLng(currentLng !== null ? currentLng.toString() : '');
      setManualError(null);
    }
  }, [currentLat, currentLng, isEditing]);

  // Apply manual coordinates to map, marker, and parent onChange
  const applyCoordinates = useCallback(
    (latStr, lngStr, shouldCenter = true) => {
      const trimmedLat = (latStr || '').trim();
      const trimmedLng = (lngStr || '').trim();

      if (!trimmedLat && !trimmedLng) {
        setManualError('Please enter both latitude and longitude.');
        return false;
      }

      const lat = parseFloat(trimmedLat);
      const lng = parseFloat(trimmedLng);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setManualError('Latitude and Longitude must be valid numbers.');
        return false;
      }

      if (lat < -90 || lat > 90) {
        setManualError('Latitude must be between -90 and 90 degrees.');
        return false;
      }

      if (lng < -180 || lng > 180) {
        setManualError('Longitude must be between -180 and 180 degrees.');
        return false;
      }

      setManualError(null);
      setIsEditing(false);

      const formattedLng = parseFloat(lng.toFixed(6));
      const formattedLat = parseFloat(lat.toFixed(6));

      onChange([formattedLng, formattedLat]);

      if (mapInstanceRef.current && markerInstanceRef.current) {
        const marker = markerInstanceRef.current;
        const map = mapInstanceRef.current;

        marker.setLatLng([formattedLat, formattedLng]);
        if (!map.hasLayer(marker)) {
          marker.addTo(map);
        }
        if (shouldCenter) {
          map.setView([formattedLat, formattedLng], Math.max(map.getZoom(), 14));
        }
      }

      return true;
    },
    [onChange]
  );

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = currentLat || defaultLat;
      const initialLng = currentLng || defaultLng;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: hasCoords ? 14 : 11,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Create marker if coordinates exist
      const marker = L.marker([initialLat, initialLng], {
        icon: createCustomIcon(),
        draggable: true,
      });

      if (hasCoords) {
        marker.addTo(map);
      }

      // Marker drag event
      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        const fLng = parseFloat(lng.toFixed(6));
        const fLat = parseFloat(lat.toFixed(6));
        setIsEditing(false);
        setInputLat(fLat.toString());
        setInputLng(fLng.toString());
        setManualError(null);
        onChange([fLng, fLat]);
      });

      // Map click event
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        if (!map.hasLayer(marker)) {
          marker.addTo(map);
        }
        const fLng = parseFloat(lng.toFixed(6));
        const fLat = parseFloat(lat.toFixed(6));
        setIsEditing(false);
        setInputLat(fLat.toString());
        setInputLng(fLng.toString());
        setManualError(null);
        onChange([fLng, fLat]);
      });

      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Update marker position when value changes from outside
  useEffect(() => {
    if (!mapInstanceRef.current || !markerInstanceRef.current) return;

    if (hasCoords) {
      const marker = markerInstanceRef.current;
      const map = mapInstanceRef.current;

      marker.setLatLng([currentLat, currentLng]);
      if (!map.hasLayer(marker)) {
        marker.addTo(map);
      }
    }
  }, [currentLat, currentLng, hasCoords]);

  // Geolocation API handler
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const lat = parseFloat(pos.coords.latitude.toFixed(6));

        setIsEditing(false);
        setInputLat(lat.toString());
        setInputLng(lng.toString());
        setManualError(null);
        onChange([lng, lat]);

        if (mapInstanceRef.current && markerInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 15);
          markerInstanceRef.current.setLatLng([lat, lng]);
          if (!mapInstanceRef.current.hasLayer(markerInstanceRef.current)) {
            markerInstanceRef.current.addTo(mapInstanceRef.current);
          }
        }
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(err.message || 'Unable to retrieve your location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle pasting "lat, lng" string into either field
  const handlePaste = (e) => {
    const text = e.clipboardData?.getData('text');
    if (text && (text.includes(',') || text.includes(' '))) {
      const parts = text
        .split(/[,\s]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 2) {
        const p1 = parseFloat(parts[0]);
        const p2 = parseFloat(parts[1]);
        if (!Number.isNaN(p1) && !Number.isNaN(p2)) {
          e.preventDefault();
          let latStr = parts[0];
          let lngStr = parts[1];
          // Standard Google Maps format is "latitude, longitude"
          if (p1 >= -90 && p1 <= 90 && p2 >= -180 && p2 <= 180) {
            latStr = parts[0];
            lngStr = parts[1];
          }
          setInputLat(latStr);
          setInputLng(lngStr);
          applyCoordinates(latStr, lngStr, true);
        }
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <MapPin className="w-4 h-4 text-indigo-400" />
          <span>
            Click anywhere on the map, drag the pin, or type coordinates below
          </span>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={geoLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer disabled:opacity-50"
        >
          {geoLoading ? (
            <Navigation className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Crosshair className="w-3.5 h-3.5" />
          )}
          <span>{geoLoading ? 'Detecting...' : 'Use My Current Location'}</span>
        </button>
      </div>

      {geoError && (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
          {geoError}
        </div>
      )}

      {/* Leaflet Map Box */}
      <div className="rounded-xl overflow-hidden border border-slate-800 shadow-inner relative z-0">
        <div ref={mapContainerRef} className="w-full h-64 bg-slate-950" />
      </div>

      {/* Manual Coordinates Input Section */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
            <span>Type Coordinates by Hand</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 text-[11px]">GeoJSON [Lng, Lat]:</span>
            {hasCoords ? (
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                [{currentLng}, {currentLat}]
              </span>
            ) : (
              <span className="text-amber-400 font-medium text-[11px]">
                No pin placed yet
              </span>
            )}
          </div>
        </div>

        {/* Lat & Lng Input Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end">
          <div className="sm:col-span-2">
            <label
              htmlFor="manual-lat-input"
              className="block text-[11px] font-medium text-slate-300 mb-1"
            >
              Latitude <span className="text-slate-500 font-mono text-[10px]">(-90 to 90)</span>
            </label>
            <input
              id="manual-lat-input"
              type="text"
              value={inputLat}
              onChange={(e) => {
                setIsEditing(true);
                setInputLat(e.target.value);
                setManualError(null);
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyCoordinates(inputLat, inputLng, true);
                }
              }}
              onBlur={() => {
                if (inputLat && inputLng) {
                  applyCoordinates(inputLat, inputLng, false);
                }
              }}
              placeholder="e.g. 20.888587"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="manual-lng-input"
              className="block text-[11px] font-medium text-slate-300 mb-1"
            >
              Longitude <span className="text-slate-500 font-mono text-[10px]">(-180 to 180)</span>
            </label>
            <input
              id="manual-lng-input"
              type="text"
              value={inputLng}
              onChange={(e) => {
                setIsEditing(true);
                setInputLng(e.target.value);
                setManualError(null);
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyCoordinates(inputLat, inputLng, true);
                }
              }}
              onBlur={() => {
                if (inputLat && inputLng) {
                  applyCoordinates(inputLat, inputLng, false);
                }
              }}
              placeholder="e.g. 74.836692"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-1">
            <button
              type="button"
              onClick={() => applyCoordinates(inputLat, inputLng, true)}
              className="w-full h-[33px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Set Pin</span>
            </button>
          </div>
        </div>

        {manualError ? (
          <p className="text-[11px] text-rose-400 font-medium">{manualError}</p>
        ) : (
          <p className="text-[10px] text-slate-500 font-normal">
            Tip: You can type Latitude and Longitude individually or paste &quot;20.888587, 74.836692&quot; directly from Google Maps.
          </p>
        )}
      </div>
    </div>
  );
}

