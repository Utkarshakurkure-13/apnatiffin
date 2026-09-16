const express = require('express');
const router = express.Router();
const GeocodingService = require('../services/geocodingService');
const WindowsLocationService = require('../services/windowsLocationService');

/**
 * GET /api/location/windows-device - Detect device location via Windows OS / IP fallback
 */
router.get('/windows-device', async (req, res) => {
  try {
    const coords = await WindowsLocationService.getWindowsCoordinates();
    if (!coords.success) {
      return res.status(404).json(coords);
    }
    const reverse = await GeocodingService.reverseGeocode(coords.latitude, coords.longitude);
    return res.json({
      success: true,
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: reverse.address,
      city: reverse.city || 'Pune',
      area: reverse.area || '',
      source: coords.source,
      windowsStatus: coords.windowsStatus
    });
  } catch (err) {
    console.error('[LOCATION API ERROR - WINDOWS DEVICE]', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/location/reverse - Reverse Geocode Coordinates to Readable Address
 */
router.get('/reverse', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Parameters "lat" and "lon" are required.' });
    }

    const result = await GeocodingService.reverseGeocode(lat, lon);
    return res.json(result);
  } catch (err) {
    console.error('[LOCATION API ERROR - REVERSE]', err);
    return res.status(500).json({ error: err.message || 'Failed to reverse geocode location.' });
  }
});

/**
 * GET /api/location/search - Search address / Forward Autocomplete
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ results: [] });
    }

    const results = await GeocodingService.searchAddress(q);
    return res.json({ results });
  } catch (err) {
    console.error('[LOCATION API ERROR - SEARCH]', err);
    return res.status(500).json({ error: err.message || 'Failed to search address.' });
  }
});

module.exports = router;

