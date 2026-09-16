/**
 * Routing Service
 * Provides real road routing via OSRM (Open Source Routing Machine),
 * TSP multi-stop optimization, distance/duration calculations, and polyline coordinate decoding.
 */

// Haversine helper for fallback calculation
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Greedy Nearest-Neighbor Traveling Salesperson Problem (TSP) solver for stops sequence
 */
function optimizeStopsSequence(origin, stops) {
  if (!stops || stops.length <= 1) return stops;

  const remaining = [...stops];
  const ordered = [];
  let currentPoint = origin;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let shortestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const stop = remaining[i];
      const dist = haversineKm(currentPoint.latitude, currentPoint.longitude, stop.latitude, stop.longitude);
      if (dist < shortestDist) {
        shortestDist = dist;
        nearestIndex = i;
      }
    }

    const [nearestStop] = remaining.splice(nearestIndex, 1);
    ordered.push(nearestStop);
    currentPoint = nearestStop;
  }

  return ordered;
}

/**
 * Fallback polyline generator with intermediate road-like curvature points
 */
function generateRoadFallbackGeometry(points) {
  const waypoints = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    waypoints.push([p1.latitude, p1.longitude]);

    // Create 3 realistic intermediate street interpolation points
    const mid1 = [
      p1.latitude + (p2.latitude - p1.latitude) * 0.33 + (Math.sin(i) * 0.0005),
      p1.longitude + (p2.longitude - p1.longitude) * 0.33 - (Math.cos(i) * 0.0005)
    ];
    const mid2 = [
      p1.latitude + (p2.latitude - p1.latitude) * 0.66 - (Math.sin(i) * 0.0004),
      p1.longitude + (p2.longitude - p1.longitude) * 0.66 + (Math.cos(i) * 0.0004)
    ];
    waypoints.push(mid1, mid2);
  }
  if (points.length > 0) {
    const last = points[points.length - 1];
    waypoints.push([last.latitude, last.longitude]);
  }
  return waypoints;
}

const RoutingService = {
  /**
   * Calculate full delivery route for provider and ordered delivery stops
   * @param {Object} origin - Provider kitchen { latitude, longitude, address }
   * @param {Array} stops - Array of customer delivery stop objects { id, customer_name, address, latitude, longitude, ... }
   */
  async calculateDeliveryRoute(origin, stops = []) {
    if (!origin || !origin.latitude || !origin.longitude) {
      throw new Error('Provider origin coordinates are required for route calculation.');
    }

    if (stops.length === 0) {
      return {
        origin,
        orderedStops: [],
        totalDistanceKm: 0,
        estimatedDurationMins: 0,
        waypoints: [[origin.latitude, origin.longitude]],
        legs: []
      };
    }

    // Step 1: Optimize stops sequence using nearest neighbor TSP
    const orderedStops = optimizeStopsSequence(origin, stops).map((stop, index) => ({
      ...stop,
      stop_sequence: index + 1
    }));

    // Step 2: Build coordinate list for OSRM: origin, then each stop
    // OSRM expects: lon,lat;lon,lat;...
    const allPoints = [origin, ...orderedStops];
    const coordString = allPoints
      .map((p) => `${parseFloat(p.longitude).toFixed(6)},${parseFloat(p.latitude).toFixed(6)}`)
      .join(';');

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=false`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AapnaTiffin-RoutingEngine/1.0'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OSRM HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // OSRM geojson coordinates are [lon, lat] -> convert to Leaflet [lat, lon]
        const waypoints = (route.geometry?.coordinates || []).map(([lon, lat]) => [lat, lon]);
        const totalDistanceKm = parseFloat((route.distance / 1000).toFixed(2));
        // duration in seconds -> minutes (+ 3 minutes per stop for delivery handover)
        const travelDurationMins = Math.ceil(route.duration / 60);
        const totalDurationMins = travelDurationMins + (orderedStops.length * 3);

        const legs = (route.legs || []).map((leg, idx) => ({
          fromIndex: idx,
          toIndex: idx + 1,
          distanceKm: parseFloat((leg.distance / 1000).toFixed(2)),
          durationMins: Math.ceil(leg.duration / 60)
        }));

        return {
          origin,
          orderedStops,
          totalDistanceKm,
          estimatedDurationMins: totalDurationMins,
          waypoints,
          legs,
          isRealRoadNetwork: true
        };
      }
    } catch (err) {
      console.warn('[ROUTING] OSRM Route API fallback used:', err.message);
    }

    // Step 3: Reliable fallback calculation if OSRM is unreachable or timed out
    let fallbackDistance = 0;
    const legs = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];
      // Road factor 1.25x for city streets vs straight-line
      const dist = haversineKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude) * 1.25;
      fallbackDistance += dist;
      legs.push({
        fromIndex: i,
        toIndex: i + 1,
        distanceKm: parseFloat(dist.toFixed(2)),
        durationMins: Math.ceil(dist * 3.5) // ~18 km/h city average
      });
    }

    const fallbackDuration = Math.ceil(fallbackDistance * 3.5) + (orderedStops.length * 3);
    const fallbackWaypoints = generateRoadFallbackGeometry(allPoints);

    return {
      origin,
      orderedStops,
      totalDistanceKm: parseFloat(fallbackDistance.toFixed(2)),
      estimatedDurationMins: fallbackDuration,
      waypoints: fallbackWaypoints,
      legs,
      isRealRoadNetwork: false
    };
  }
};

module.exports = RoutingService;
