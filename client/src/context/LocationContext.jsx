import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDeviceGPSCoordinates, reverseGeocodeCoords } from '../utils/gpsLocation';

const LocationContext = createContext();

export function LocationProvider({ children }) {
  // Saved / Active delivery location
  const [deliveryLocation, setDeliveryLocation] = useState(() => {
    const saved = localStorage.getItem('aapna_tiffin_delivery_loc');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.latitude && parsed.longitude) {
          return parsed;
        }
      } catch (e) {
        // ignore invalid JSON
      }
    }
    // No hardcoded default location; start as null until detected
    return null;
  });

  // Provider saved kitchen location
  const [providerLocation, setProviderLocation] = useState(() => {
    const saved = localStorage.getItem('aapna_tiffin_provider_loc');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.latitude || parsed.address)) {
          return parsed;
        }
      } catch (e) {
        // ignore invalid JSON
      }
    }
    return null;
  });

  // Browser device current coordinates
  const [deviceLocation, setDeviceLocation] = useState(null);
  
  // Permission state
  const [permissionStatus, setPermissionStatus] = useState(() => {
    return localStorage.getItem('aapna_tiffin_loc_status') || 'PROMPT';
  });

  const [hasAskedPermission, setHasAskedPermission] = useState(() => {
    return localStorage.getItem('aapna_tiffin_loc_asked') === 'true';
  });

  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Request device GPS location via browser navigator.geolocation
  const requestDeviceLocation = async (showErrors = true) => {
    setLoadingLocation(true);
    setLocationError(null);

    try {
      const coords = await getDeviceGPSCoordinates();
      setPermissionStatus('GRANTED');
      setHasAskedPermission(true);
      localStorage.setItem('aapna_tiffin_loc_status', 'GRANTED');
      localStorage.setItem('aapna_tiffin_loc_asked', 'true');
      setPermissionModalOpen(false);

      const geo = await reverseGeocodeCoords(coords.latitude, coords.longitude);
      const locObj = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: geo.address,
        city: geo.city,
        area: geo.area,
        is_device_location: true
      };

      setDeviceLocation(locObj);
      setDeliveryLocation(locObj);
      localStorage.setItem('aapna_tiffin_delivery_loc', JSON.stringify(locObj));

      // Sync with backend if user is logged in
      const token = localStorage.getItem('aapna_tiffin_token');
      if (token) {
        fetch('/api/customer/location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(locObj)
        }).catch((e) => console.warn('Could not sync customer location to backend:', e));
      }

      return locObj;
    } catch (err) {
      const dialogue = err.userDialogue || err.message;
      if (err.code === 'PERMISSION_DENIED' || (err.message && err.message.toLowerCase().includes('denied'))) {
        setPermissionStatus('DENIED');
        localStorage.setItem('aapna_tiffin_loc_status', 'DENIED');
      } else if (err.code === 'LOCATION_OFF') {
        setPermissionStatus('LOCATION_OFF');
        localStorage.setItem('aapna_tiffin_loc_status', 'LOCATION_OFF');
      } else {
        setPermissionStatus('UNAVAILABLE');
      }
      setHasAskedPermission(true);
      localStorage.setItem('aapna_tiffin_loc_asked', 'true');
      if (showErrors) {
        setLocationError(dialogue);
      }
      throw err;
    } finally {
      setLoadingLocation(false);
    }
  };

  // Fetch provider kitchen location from backend if token exists
  const fetchProviderLocation = async () => {
    const token = localStorage.getItem('aapna_tiffin_token');
    if (!token) return null;
    try {
      const res = await fetch('/api/provider/location', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.location?.latitude && data?.location?.longitude) {
          const loc = {
            latitude: parseFloat(data.location.latitude),
            longitude: parseFloat(data.location.longitude),
            address: data.location.address || data.kitchenAddress || '',
            city: data.location.city || 'Pune',
            area: data.location.area || '',
            postal_code: data.location.postal_code || ''
          };
          setProviderLocation(loc);
          localStorage.setItem('aapna_tiffin_provider_loc', JSON.stringify(loc));
          return loc;
        } else if (data?.kitchenAddress) {
          const loc = {
            latitude: 18.5362,
            longitude: 73.8410,
            address: data.kitchenAddress,
            city: 'Pune',
            area: ''
          };
          setProviderLocation(loc);
          localStorage.setItem('aapna_tiffin_provider_loc', JSON.stringify(loc));
          return loc;
        }
      }
    } catch (e) {
      // Ignore errors for non-providers
    }
    return null;
  };

  // Update selected provider kitchen location (from map / GPS / manual entry)
  const updateProviderLocation = async (newLoc) => {
    if (!newLoc) return null;

    const locObj = {
      latitude: newLoc.latitude !== undefined ? parseFloat(newLoc.latitude) : 18.5362,
      longitude: newLoc.longitude !== undefined ? parseFloat(newLoc.longitude) : 73.8410,
      address: (newLoc.address || '').trim() || `Kitchen (${parseFloat(newLoc.latitude || 18.5362).toFixed(4)}, ${parseFloat(newLoc.longitude || 73.8410).toFixed(4)})`,
      city: (newLoc.city || 'Pune').trim(),
      area: (newLoc.area || '').trim(),
      postal_code: (newLoc.postal_code || '').trim()
    };

    setProviderLocation(locObj);
    localStorage.setItem('aapna_tiffin_provider_loc', JSON.stringify(locObj));

    // Update profile in localStorage as well if present
    try {
      const savedProf = localStorage.getItem('aapna_tiffin_profile');
      if (savedProf) {
        const parsedProf = JSON.parse(savedProf);
        parsedProf.kitchen_address = locObj.address;
        localStorage.setItem('aapna_tiffin_profile', JSON.stringify(parsedProf));
      }
    } catch (e) {}

    // Sync to backend if authenticated
    const token = localStorage.getItem('aapna_tiffin_token');
    if (token) {
      try {
        const res = await fetch('/api/provider/location', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(locObj)
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.location) {
            const updated = {
              latitude: parseFloat(data.location.latitude),
              longitude: parseFloat(data.location.longitude),
              address: data.location.address || locObj.address,
              city: data.location.city || locObj.city,
              area: data.location.area || locObj.area,
              postal_code: data.location.postal_code || locObj.postal_code
            };
            setProviderLocation(updated);
            localStorage.setItem('aapna_tiffin_provider_loc', JSON.stringify(updated));
            return updated;
          }
        }
      } catch (err) {
        console.warn('Could not sync provider location to backend:', err);
      }
    }
    return locObj;
  };

  // Only request location when user explicitly initiates it; restore provider location on mount
  useEffect(() => {
    fetchProviderLocation();
  }, []);

  // Update selected delivery location (from map pin-drop / search)
  const updateDeliveryLocation = (newLoc) => {
    if (!newLoc || newLoc.latitude === undefined || newLoc.longitude === undefined) return;

    const locObj = {
      latitude: parseFloat(newLoc.latitude),
      longitude: parseFloat(newLoc.longitude),
      address: newLoc.address || `Location (${parseFloat(newLoc.latitude).toFixed(4)}, ${parseFloat(newLoc.longitude).toFixed(4)})`,
      city: newLoc.city || 'Local Area',
      area: newLoc.area || '',
      is_device_location: !!newLoc.is_device_location
    };

    setDeliveryLocation(locObj);
    localStorage.setItem('aapna_tiffin_delivery_loc', JSON.stringify(locObj));

    // Sync to backend if authenticated
    const token = localStorage.getItem('aapna_tiffin_token');
    if (token) {
      fetch('/api/customer/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(locObj)
      }).catch((e) => console.warn('Could not sync updated location:', e));
    }
  };

  // Handle "Not Now" dismiss from permission modal (ask only once)
  const dismissPermissionModal = () => {
    setHasAskedPermission(true);
    localStorage.setItem('aapna_tiffin_loc_asked', 'true');
    setPermissionModalOpen(false);
  };

  return (
    <LocationContext.Provider
      value={{
        deliveryLocation,
        providerLocation,
        deviceLocation,
        permissionStatus,
        hasAskedPermission,
        permissionModalOpen,
        setPermissionModalOpen,
        loadingLocation,
        locationError,
        requestDeviceLocation,
        updateDeliveryLocation,
        fetchProviderLocation,
        updateProviderLocation,
        dismissPermissionModal
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}
