/**
 * AAPNA TIFFIN - PURE BROWSER GEOLOCATION UTILITY
 * Directly triggers the browser's native location permission prompt
 * and retrieves the device's actual current latitude and longitude.
 */

export function getDeviceGPSCoordinates() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      const err = new Error('Geolocation is not supported by your browser.');
      err.code = 'NOT_SUPPORTED';
      return reject(err);
    }

    // Direct browser prompt options: maximumAge: 0 forces a fresh live reading
    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          const err = new Error('Location permission was denied. Please click the tune/lock icon in your browser URL bar and set Location to "Allow".');
          err.code = 'PERMISSION_DENIED';
          return reject(err);
        } else if (error.code === error.TIMEOUT) {
          const err = new Error('Location detection timed out. Please check your connection or allow location in your browser and try again.');
          err.code = 'TIMEOUT';
          return reject(err);
        } else {
          const err = new Error('Unable to retrieve your location from the browser. Please ensure location services are enabled on your device.');
          err.code = 'POSITION_UNAVAILABLE';
          return reject(err);
        }
      },
      options
    );
  });
}

/**
 * Reverse geocode latitude and longitude to human-readable address
 */
export async function reverseGeocodeCoords(latitude, longitude) {
  try {
    const res = await fetch(`/api/location/reverse?lat=${latitude}&lon=${longitude}`);
    if (res.ok) {
      const data = await res.json();
      return {
        address: data.address || `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
        city: data.city || 'Local Area',
        area: data.area || ''
      };
    }
  } catch (err) {
    console.warn('Reverse geocode error:', err);
  }
  return {
    address: `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
    city: 'Local Area',
    area: ''
  };
}
