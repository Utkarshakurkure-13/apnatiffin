/**
 * Geocoding Service
 * Provides reverse geocoding (lat/lon -> address) and forward search/autocomplete.
 * Includes in-memory caching and compliant User-Agent headers for OpenStreetMap Nominatim.
 */

// In-memory cache: key = rounded lat,lon or search string
const geocodeCache = new Map();
const MAX_CACHE_SIZE = 500;

function setCache(key, value) {
  if (geocodeCache.size >= MAX_CACHE_SIZE) {
    const firstKey = geocodeCache.keys().next().value;
    geocodeCache.delete(firstKey);
  }
  geocodeCache.set(key, value);
}

/**
 * Format raw Nominatim address object into human readable Indian street / area address
 */
function formatAddress(raw) {
  if (!raw) return 'Unknown Location';
  const a = raw.address || {};
  const parts = [];

  if (a.suburb || a.neighbourhood || a.residential) {
    parts.push(a.suburb || a.neighbourhood || a.residential);
  }
  if (a.road || a.pedestrian) {
    parts.push(a.road || a.pedestrian);
  }
  if (a.city || a.town || a.village || a.county) {
    parts.push(a.city || a.town || a.village || a.county);
  }
  if (a.state) {
    parts.push(a.state);
  }

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return raw.display_name || 'Selected Location';
}

const GeocodingService = {
  /**
   * Reverse Geocode (Latitude, Longitude -> Readable Address)
   */
  async reverseGeocode(lat, lon) {
    const numLat = parseFloat(lat);
    const numLon = parseFloat(lon);

    if (isNaN(numLat) || isNaN(numLon)) {
      throw new Error('Invalid coordinates provided for reverse geocoding.');
    }

    // Cache key rounded to 4 decimals (~11m precision)
    const cacheKey = `rev:${numLat.toFixed(4)},${numLon.toFixed(4)}`;
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey);
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${numLat}&lon=${numLon}&addressdetails=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AapnaTiffin-LocationService/1.0 (https://aapnatiffin.com; dev@aapnatiffin.com)',
          'Accept-Language': 'en,mr,hi'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Nominatim HTTP ${response.status}`);
      }

      const data = await response.json();
      const formattedAddress = formatAddress(data);
      const result = {
        latitude: numLat,
        longitude: numLon,
        address: formattedAddress,
        city: data.address?.city || data.address?.town || data.address?.village || data.address?.county || 'Nagpur / Pune',
        area: data.address?.suburb || data.address?.neighbourhood || data.address?.residential || 'Local Area',
        state: data.address?.state || 'Maharashtra',
        postal_code: data.address?.postcode || '',
        raw_display_name: data.display_name || formattedAddress
      };

      setCache(cacheKey, result);
      return result;
    } catch (err) {
      console.warn('[GEOCODING] Reverse geocode lookup fallback:', err.message);
      // Fallback response with clean coordinate formatting
      const fallbackResult = {
        latitude: numLat,
        longitude: numLon,
        address: `Location (${numLat.toFixed(4)}, ${numLon.toFixed(4)})`,
        city: 'Local Area',
        area: 'Nearby',
        state: 'Maharashtra',
        postal_code: '',
        raw_display_name: `Location (${numLat.toFixed(4)}, ${numLon.toFixed(4)})`
      };
      return fallbackResult;
    }
  },

  /**
   * Forward Geocode / Search Address Autocomplete
   */
  async searchAddress(query) {
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return [];
    }

    const trimmedQuery = query.trim();
    const cacheKey = `search:${trimmedQuery.toLowerCase()}`;
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey);
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmedQuery)}&addressdetails=1&countrycodes=in&limit=6`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AapnaTiffin-LocationService/1.0 (https://aapnatiffin.com; dev@aapnatiffin.com)',
          'Accept-Language': 'en,mr,hi'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Nominatim HTTP ${response.status}`);
      }

      const data = await response.json();
      const results = (data || []).map((item) => ({
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        address: formatAddress(item),
        city: item.address?.city || item.address?.town || item.address?.village || item.address?.county || '',
        area: item.address?.suburb || item.address?.neighbourhood || '',
        state: item.address?.state || 'Maharashtra',
        postal_code: item.address?.postcode || '',
        display_name: item.display_name
      }));

      setCache(cacheKey, results);
      return results;
    } catch (err) {
      console.warn('[GEOCODING] Search address fallback:', err.message);
      return [];
    }
  }
};

module.exports = GeocodingService;
