const { execFile } = require('child_process');
const path = require('path');

const psScriptPath = path.join(__dirname, 'get_win_coords.ps1');

// In-memory cache for 30 seconds to avoid repeating powershell calls back-to-back
let cachedLocation = null;
let cacheTime = 0;

const WindowsLocationService = {
  async getWindowsCoordinates() {
    const now = Date.now();
    if (cachedLocation && (now - cacheTime < 30000)) {
      return cachedLocation;
    }

    return new Promise((resolve) => {
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScriptPath], { timeout: 4500 }, async (error, stdout) => {
        const output = (stdout || '').trim();

        if (output.startsWith('SUCCESS:')) {
          const parts = output.replace('SUCCESS:', '').split(',');
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lon)) {
            cachedLocation = {
              success: true,
              latitude: lat,
              longitude: lon,
              source: 'WINDOWS_LOCATION_SERVICE',
              windowsStatus: 'Ready'
            };
            cacheTime = Date.now();
            return resolve(cachedLocation);
          }
        }

        const isExplicitlyDisabled = output.includes('Disabled');

        // If Windows Location Service is not ready or failed, try IP Geolocation fallback
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const ipRes = await fetch('http://ip-api.com/json', { signal: controller.signal });
          clearTimeout(timeoutId);

          if (ipRes.ok) {
            const data = await ipRes.json();
            if (data && data.status === 'success' && data.lat && data.lon) {
              const resObj = {
                success: true,
                latitude: data.lat,
                longitude: data.lon,
                city: data.city || 'Pune',
                region: data.regionName || 'Maharashtra',
                source: 'NETWORK_IP',
                windowsStatus: isExplicitlyDisabled ? 'Disabled' : 'Unavailable'
              };
              return resolve(resObj);
            }
          }
        } catch (ipErr) {
          console.warn('[WINDOWS LOCATION] IP fallback failed:', ipErr.message);
        }

        // Return error status if completely unavailable
        resolve({
          success: false,
          windowsStatus: isExplicitlyDisabled ? 'Disabled' : 'Unavailable',
          message: isExplicitlyDisabled 
            ? 'Windows Location Service is turned OFF in Windows Settings. Please turn it on in Settings > Privacy & Security > Location.' 
            : 'Device location is currently unavailable.'
        });
      });
    });
  }
};

module.exports = WindowsLocationService;
