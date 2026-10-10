/**
 * Geocoding Service
 * Provides forward geocoding (City -> [lng, lat]) and distance calculations.
 * Supports OpenStreetMap Nominatim (default) and Google Geocoding API.
 * Includes a fast in-memory coordinate dictionary for Indian & demo cities.
 */

/**
 * Pre-defined city coordinates [longitude, latitude] for immediate resolution
 * and zero-network reliability during test suites and offline operation.
 */
const CITY_COORDINATES_CACHE = {
  mumbai: {
    lat: 19.076,
    lon: 72.8777,
    displayName: 'Mumbai, Maharashtra, India',
  },
  bombay: {
    lat: 19.076,
    lon: 72.8777,
    displayName: 'Mumbai, Maharashtra, India',
  },
  pune: { lat: 18.5204, lon: 73.8567, displayName: 'Pune, Maharashtra, India' },
  jalgaon: {
    lat: 21.0077,
    lon: 75.5626,
    displayName: 'Jalgaon, Maharashtra, India',
  },
  dhule: {
    lat: 20.9042,
    lon: 74.7749,
    displayName: 'Dhule, Maharashtra, India',
  },
  nashik: {
    lat: 19.9975,
    lon: 73.7898,
    displayName: 'Nashik, Maharashtra, India',
  },
  nagpur: {
    lat: 21.1458,
    lon: 79.0882,
    displayName: 'Nagpur, Maharashtra, India',
  },
  aurangabad: {
    lat: 19.8762,
    lon: 75.3433,
    displayName: 'Chhatrapati Sambhajinagar, Maharashtra, India',
  },
  bengaluru: {
    lat: 12.9716,
    lon: 77.5946,
    displayName: 'Bengaluru, Karnataka, India',
  },
  bangalore: {
    lat: 12.9716,
    lon: 77.5946,
    displayName: 'Bengaluru, Karnataka, India',
  },
  delhi: { lat: 28.6139, lon: 77.209, displayName: 'New Delhi, Delhi, India' },
  newdelhi: {
    lat: 28.6139,
    lon: 77.209,
    displayName: 'New Delhi, Delhi, India',
  },
  kolkata: {
    lat: 22.5726,
    lon: 88.3639,
    displayName: 'Kolkata, West Bengal, India',
  },
  chennai: {
    lat: 13.0827,
    lon: 80.2707,
    displayName: 'Chennai, Tamil Nadu, India',
  },
  hyderabad: {
    lat: 17.385,
    lon: 78.4867,
    displayName: 'Hyderabad, Telangana, India',
  },
  ahmedabad: {
    lat: 23.0225,
    lon: 72.5714,
    displayName: 'Ahmedabad, Gujarat, India',
  },
};

/**
 * Calculate Haversine distance between two coordinates in kilometers.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in km
 */
export const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Forward-geocode a city name to coordinates { lat, lon, displayName }
 * @param {string} cityName
 * @returns {Promise<{ lat: number, lon: number, displayName: string } | null>}
 */
export const forwardGeocodeCity = async (cityName) => {
  if (!cityName || typeof cityName !== 'string' || !cityName.trim()) {
    return null;
  }

  const normalized = cityName
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .trim();

  // 1. Check in-memory pre-configured coordinates
  if (CITY_COORDINATES_CACHE[normalized]) {
    return { ...CITY_COORDINATES_CACHE[normalized] };
  }

  // 2. Swappable provider check (Google Maps if configured)
  const provider = (
    process.env.GEOCODING_PROVIDER || 'nominatim'
  ).toLowerCase();
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;

  if (provider === 'google' && googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        cityName
      )}&key=${googleKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          return {
            lat: loc.lat,
            lon: loc.lng,
            displayName: data.results[0].formatted_address,
          };
        }
      }
    } catch {
      // Fallback to Nominatim
    }
  }

  // 3. OpenStreetMap Nominatim forward search
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      cityName
    )}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OfferBazaar/1.0 (contact@offerbazaar.com)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name || cityName,
      };
    }
    return null;
  } catch {
    return null;
  }
};

export default {
  forwardGeocodeCity,
  haversineDistanceKm,
};
