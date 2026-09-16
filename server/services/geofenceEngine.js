/**
 * Geofence Engine
 * Authoritative Server-Side Geodesic / Haversine distance calculations and provider matching.
 */

const db = require('../config/database');

/**
 * Calculates straight-line / geodesic distance between two lat/lon coordinates in kilometers
 * using the Haversine formula.
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // Earth's mean radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return parseFloat(d.toFixed(2));
}

const GeofenceEngine = {
  haversineDistanceKm,

  /**
   * Get active provider kitchen location
   */
  getProviderLocation(providerId) {
    const loc = db.prepare(`
      SELECT * FROM provider_locations WHERE provider_id = ?
    `).get(providerId);

    if (loc) return loc;

    // Fallback: If no dedicated location record yet, return default Pune coordinates
    const profile = db.prepare(`SELECT kitchen_address FROM provider_profiles WHERE id = ?`).get(providerId);
    return {
      provider_id: providerId,
      latitude: 18.5204,
      longitude: 73.8567,
      address: profile?.kitchen_address || 'Pune Kitchen',
      city: 'Pune',
      area: 'Central',
      postal_code: '411001'
    };
  },

  /**
   * Get effective service radius for a provider on a specific date (in KM)
   */
  getEffectiveServiceRadius(providerId, targetDate = null) {
    const queryDate = targetDate || new Date().toISOString().split('T')[0];

    // Check date-specific override first
    const dateSpecific = db.prepare(`
      SELECT radius_km, is_active FROM provider_service_areas 
      WHERE provider_id = ? AND effective_date = ? AND is_active = 1
    `).get(providerId, queryDate);

    if (dateSpecific) {
      return dateSpecific.radius_km;
    }

    // Check default service area (effective_date IS NULL)
    const defaultRadius = db.prepare(`
      SELECT radius_km FROM provider_service_areas 
      WHERE provider_id = ? AND effective_date IS NULL AND is_active = 1
    `).get(providerId);

    if (defaultRadius) {
      return defaultRadius.radius_km;
    }

    // Default system radius fallback is 5.0 KM
    return 5.0;
  },

  /**
   * Check if a customer location is within provider's service radius on a given date
   */
  isLocationWithinProviderServiceArea(providerId, customerLat, customerLon, targetDate = null) {
    const provLoc = this.getProviderLocation(providerId);
    const radiusKm = this.getEffectiveServiceRadius(providerId, targetDate);
    const distanceKm = haversineDistanceKm(
      parseFloat(customerLat),
      parseFloat(customerLon),
      provLoc.latitude,
      provLoc.longitude
    );

    return {
      isWithinRadius: distanceKm <= radiusKm,
      distanceKm,
      radiusKm,
      providerLocation: provLoc
    };
  },

  /**
   * Match providers against customer coordinates & return two distinct sections:
   * 1. servingYourLocation (inside service radius)
   * 2. otherAvailableProviders (outside service radius)
   */
  getProvidersForCustomerLocation({ customerLat, customerLon, targetDate = null, foodType = 'ALL', sortBy = 'RATING_HIGH' }) {
    const queryDate = targetDate || new Date().toISOString().split('T')[0];
    const hasCoords = customerLat !== undefined && customerLon !== undefined && !isNaN(parseFloat(customerLat)) && !isNaN(parseFloat(customerLon));
    const cLat = hasCoords ? parseFloat(customerLat) : null;
    const cLon = hasCoords ? parseFloat(customerLon) : null;

    let query = `
      SELECT p.*, pp.single_meal_lunch_price, pp.single_meal_dinner_price, 
             pp.weekly_lunch_sub_price, pp.monthly_lunch_sub_price, pp.extra_roti_unit_price,
             pl.latitude as prov_lat, pl.longitude as prov_lon, pl.address as prov_address, pl.city as prov_city, pl.area as prov_area
      FROM provider_profiles p
      LEFT JOIN provider_pricing pp ON p.id = pp.provider_id
      LEFT JOIN provider_locations pl ON p.id = pl.provider_id
      WHERE p.is_open = 1
    `;
    const params = [];

    if (foodType && foodType !== 'ALL') {
      query += ` AND p.food_type = ?`;
      params.push(foodType);
    }

    const allProviders = db.prepare(query).all(...params);

    const servingYourLocation = [];
    const otherAvailableProviders = [];

    for (const p of allProviders) {
      // Resolve provider coordinates
      const provLat = p.prov_lat !== null && p.prov_lat !== undefined ? p.prov_lat : 18.5204;
      const provLon = p.prov_lon !== null && p.prov_lon !== undefined ? p.prov_lon : 73.8567;
      const serviceRadius = this.getEffectiveServiceRadius(p.id, queryDate);

      let distanceKm = null;
      let isWithinRadius = false;

      if (hasCoords) {
        distanceKm = haversineDistanceKm(cLat, cLon, provLat, provLon);
        isWithinRadius = distanceKm <= serviceRadius;
      }

      const MAX_NEARBY_DISCOVERY_RADIUS_KM = 60.0; // Show up to 60 KM nearby providers, omit >60 KM distant providers

      const enhancedProvider = {
        ...p,
        prov_lat: provLat,
        prov_lon: provLon,
        service_radius_km: serviceRadius,
        distance_km: distanceKm,
        is_serving_location: isWithinRadius,
        coverage_label: isWithinRadius ? '✓ Serves Your Location' : 'Doesn\'t currently serve your location'
      };

      if (isWithinRadius) {
        servingYourLocation.push(enhancedProvider);
      }
      
      // "Other Available Providers" = Providers located MORE THAN 15 KM and UP TO 30 KM from the customer's current location
      if (distanceKm !== null && distanceKm > 15.0 && distanceKm <= 30.0) {
        otherAvailableProviders.push(enhancedProvider);
      }
    }

    // Sort helper
    const sortFn = (a, b) => {
      if (sortBy === 'DISTANCE_LOW' && a.distance_km !== null && b.distance_km !== null) {
        return a.distance_km - b.distance_km;
      }
      if (sortBy === 'PRICE_LOW') {
        return (a.single_meal_lunch_price || 110) - (b.single_meal_lunch_price || 110);
      }
      if (sortBy === 'PRICE_HIGH') {
        return (b.single_meal_lunch_price || 110) - (a.single_meal_lunch_price || 110);
      }
      // Default: RATING_HIGH
      return (b.rating_avg || 0) - (a.rating_avg || 0);
    };

    servingYourLocation.sort(sortFn);
    otherAvailableProviders.sort(sortFn);

    return {
      customerLocation: hasCoords ? { latitude: cLat, longitude: cLon } : null,
      targetDate: queryDate,
      totalProvidersCount: allProviders.length,
      servingCount: servingYourLocation.length,
      otherCount: otherAvailableProviders.length,
      servingYourLocation,
      otherAvailableProviders
    };
  }
};

module.exports = GeofenceEngine;
