import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { useLocationContext } from '../../context/LocationContext';
import { 
  MapPin, Navigation, Check, ArrowLeft, 
  RotateCw, AlertCircle, ShieldAlert, CheckCircle2, 
  ChefHat, Compass, Loader2, Save, Edit3
} from 'lucide-react';
import confetti from 'canvas-confetti';
import L from 'leaflet';
import { getDeviceGPSCoordinates, reverseGeocodeCoords } from '../../utils/gpsLocation';

export default function ProviderLocationPage({ setActiveTab }) {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const { 
    providerLocation, 
    updateProviderLocation, 
    fetchProviderLocation 
  } = useLocationContext();

  const [mapCoords, setMapCoords] = useState({
    latitude: providerLocation?.latitude || 18.5362,
    longitude: providerLocation?.longitude || 73.8410
  });
  const [currentAddress, setCurrentAddress] = useState(providerLocation?.address || profile?.kitchen_address || '');
  const [manualAddressInput, setManualAddressInput] = useState(providerLocation?.address || profile?.kitchen_address || '');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState('');
  const [gpsDialogue, setGpsDialogue] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);

  // Sync initial location from backend
  useEffect(() => {
    const loadLocation = async () => {
      try {
        const token = localStorage.getItem('aapna_tiffin_token');
        if (token) {
          const res = await fetch('/api/provider/location', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const loc = data.location;
            if (loc?.latitude && loc?.longitude) {
              const lat = parseFloat(loc.latitude);
              const lon = parseFloat(loc.longitude);
              const addr = loc.address || data.kitchenAddress || profile?.kitchen_address || '';
              setMapCoords({ latitude: lat, longitude: lon });
              setCurrentAddress(addr);
              setManualAddressInput(addr);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load initial provider location:', err);
      } finally {
        setLoadingInitial(false);
      }
    };
    loadLocation();
  }, []);

  // Sync state if providerLocation updates from context
  useEffect(() => {
    if (providerLocation?.latitude && providerLocation?.longitude) {
      setMapCoords({
        latitude: providerLocation.latitude,
        longitude: providerLocation.longitude
      });
      if (providerLocation.address) {
        setCurrentAddress(providerLocation.address);
        setManualAddressInput(providerLocation.address);
      }
    }
  }, [providerLocation]);

  // Reverse geocode coords when pin moves
  const reverseGeocode = async (lat, lon) => {
    setGeocoding(true);
    try {
      const res = await fetch(`/api/location/reverse?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || `Kitchen (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
        setCurrentAddress(addr);
        setManualAddressInput(addr);
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
    } finally {
      setGeocoding(false);
    }
  };

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [mapCoords.latitude, mapCoords.longitude],
      zoom: 15,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Provider Chef Pin Marker
    const chefIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-11 h-11 rounded-full bg-emerald-500/30 animate-ping"></span>
          <div class="pin-circle w-10 h-10 rounded-full bg-[#2d6a4f] text-white flex items-center justify-center border-2 border-white shadow-2xl z-10 cursor-grab active:cursor-grabbing">
            <span class="material-symbols-outlined text-xl">restaurant</span>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const marker = L.marker([mapCoords.latitude, mapCoords.longitude], {
      draggable: true,
      icon: chefIcon
    }).addTo(map);

    marker.bindPopup(`<strong>📍 Kitchen Location</strong><br/>${currentAddress || 'Drag or click to adjust'}`);

    marker.on('dragend', (e) => {
      const { lat, lng } = e.target.getLatLng();
      setMapCoords({ latitude: lat, longitude: lng });
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([lat, lng]);
      }
      reverseGeocode(lat, lng);
    });

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([lat, lng]);
      }
      setMapCoords({ latitude: lat, longitude: lng });
      reverseGeocode(lat, lng);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    // Force Leaflet to recalculate container bounds after mount to prevent frozen preview
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (accuracyCircleRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Quick GPS Detection
  const handleDetectGPS = async () => {
    setGpsDialogue(null);
    setGeocoding(true);
    try {
      const coords = await getDeviceGPSCoordinates();
      const { latitude, longitude, accuracy } = coords;

      setMapCoords({ latitude, longitude });

      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.flyTo([latitude, longitude], 16, {
          duration: 1.5,
          easeLinearity: 0.25
        });

        // Draw accuracy circle
        if (accuracyCircleRef.current) {
          mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
        }
        accuracyCircleRef.current = L.circle([latitude, longitude], {
          radius: Math.min(Math.max(accuracy || 30, 20), 120),
          color: '#2d6a4f',
          fillColor: '#52b788',
          fillOpacity: 0.18,
          weight: 1.5
        }).addTo(mapInstanceRef.current);
      }

      const geo = await reverseGeocodeCoords(latitude, longitude);
      const addr = geo.address || `Kitchen (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      setCurrentAddress(addr);
      setManualAddressInput(addr);

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
        markerRef.current.bindPopup(`<strong>📍 Detected GPS Location</strong><br/>${addr}`).openPopup();
      }

      setGpsDialogue({
        type: 'success',
        message: `✓ Current GPS location detected! (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). Click "Save Kitchen Location" to confirm.`
      });
    } catch (err) {
      console.warn('GPS detection failed:', err);
      const dialogue = err.userDialogue || err.message || 'Unable to detect GPS location. You can enter your address manually below.';
      setGpsDialogue({
        type: 'error',
        code: err.code,
        message: dialogue
      });
    } finally {
      setGeocoding(false);
    }
  };

  // Geocode address typed manually
  const handleApplyManualAddress = async () => {
    if (!manualAddressInput || manualAddressInput.trim().length < 3) {
      alert('Please enter a valid address.');
      return;
    }

    setGeocoding(true);
    try {
      const res = await fetch(`/api/location/search?q=${encodeURIComponent(manualAddressInput.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const first = data.results[0];
          const lat = first.latitude;
          const lon = first.longitude;
          setMapCoords({ latitude: lat, longitude: lon });
          setCurrentAddress(manualAddressInput.trim());

          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
            mapInstanceRef.current.flyTo([lat, lon], 16, { duration: 1.2 });
          }
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lon]);
            markerRef.current.bindPopup(`<strong>📍 Kitchen Location</strong><br/>${manualAddressInput.trim()}`).openPopup();
          }
          setGpsDialogue({
            type: 'info',
            message: `✓ Located "${manualAddressInput.trim()}" on the map. Click "Save Kitchen Location" to confirm.`
          });
        } else {
          setCurrentAddress(manualAddressInput.trim());
          setGpsDialogue({
            type: 'info',
            message: `✓ Address set to "${manualAddressInput.trim()}". You can adjust the pin on the map and click "Save Kitchen Location".`
          });
        }
      } else {
        setCurrentAddress(manualAddressInput.trim());
      }
    } catch (err) {
      console.warn('Address geocoding error:', err);
      setCurrentAddress(manualAddressInput.trim());
    } finally {
      setGeocoding(false);
      setIsEditingAddress(false);
    }
  };

  // Save and synchronize location
  const handleSaveLocation = async () => {
    const finalAddress = (manualAddressInput && manualAddressInput.trim()) 
      ? manualAddressInput.trim() 
      : (currentAddress || `Kitchen (${mapCoords.latitude.toFixed(4)}, ${mapCoords.longitude.toFixed(4)})`);

    setSaving(true);
    try {
      await updateProviderLocation({
        latitude: mapCoords.latitude,
        longitude: mapCoords.longitude,
        address: finalAddress,
        city: 'Pune'
      });

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      setSavedSuccessMsg('✓ Kitchen location updated and saved!');

      setTimeout(() => {
        setSavedSuccessMsg('');
        setActiveTab('provider-dashboard');
      }, 1200);
    } catch (err) {
      alert('Failed to save kitchen location: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Breadcrumb Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('provider-dashboard')}
            className="p-2.5 rounded-2xl bg-white border border-black/10 hover:bg-black/5 text-[#181a2e] transition-colors shadow-xs"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
              Kitchen Location & Map
            </h1>
            <p className="text-xs sm:text-sm text-[#404943]">
              Set your kitchen address via automatic GPS, manual address entry, or interactive OpenStreetMap
            </p>
          </div>
        </div>

        {/* Quick GPS Action Button */}
        <button
          onClick={handleDetectGPS}
          disabled={geocoding}
          className="btn-pill btn-primary text-xs sm:text-sm px-5 py-2.5 font-bold shadow-md flex items-center gap-2 self-start sm:self-auto"
        >
          {geocoding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Detecting Location...</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>Use GPS</span>
            </>
          )}
        </button>
      </div>

      {savedSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center gap-2 text-sm font-bold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{savedSuccessMsg}</span>
        </div>
      )}

      {/* GPS Dialogues: Success, Manual Info, Permission Denied, Windows Location Off */}
      {gpsDialogue && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in ${
          gpsDialogue.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
            : (gpsDialogue.type === 'info' 
              ? 'bg-blue-50 border-blue-200 text-blue-950' 
              : (gpsDialogue.code === 'LOCATION_OFF' 
                ? 'bg-amber-50 border-amber-300 text-amber-950' 
                : 'bg-rose-50 border-rose-200 text-rose-950'))
        }`}>
          <div className="flex items-start gap-3">
            {gpsDialogue.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : gpsDialogue.type === 'info' ? (
              <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <span className="font-bold block text-sm">
                {gpsDialogue.type === 'success' 
                  ? 'Kitchen Location Detected' 
                  : (gpsDialogue.code === 'LOCATION_OFF' 
                    ? 'Windows Location Service Is Turned OFF' 
                    : (gpsDialogue.code === 'PERMISSION_DENIED' 
                      ? 'Location Permission Rejected' 
                      : 'Notice'))}
              </span>
              <span>{gpsDialogue.message}</span>
            </div>
          </div>
          {gpsDialogue.type === 'error' && (
            <button
              onClick={handleDetectGPS}
              className="btn-pill bg-[#2d6a4f] hover:bg-[#22543d] text-white text-xs px-4 py-2 font-bold shrink-0 shadow-xs"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Map on Left (8 Cols), Control & Address Panel on Right (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* OpenStreetMap View (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="glass-panel p-4 sm:p-5 rounded-3xl shadow-xl space-y-3 border border-black/5 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#2d6a4f]" />
                <h3 className="font-heading font-bold text-sm sm:text-base text-[#181a2e]">
                  Interactive OpenStreetMap Kitchen Pin
                </h3>
              </div>
              <span className="text-[11px] font-bold text-[#2d6a4f] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Draggable Marker
              </span>
            </div>

            {/* Map Canvas */}
            <div className="relative rounded-2xl overflow-hidden border border-black/10 shadow-inner h-[420px] sm:h-[500px]">
              <div ref={mapContainerRef} className="w-full h-full" />
              <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-[#404943] border border-black/5 shadow-md">
                💡 Drag the green chef pin or click anywhere on the map to set your kitchen coordinates
              </div>
            </div>

            {/* Coordinates info */}
            <div className="flex items-center justify-between text-[11px] text-[#707973] px-1 font-mono">
              <span>Latitude: {mapCoords.latitude.toFixed(5)}</span>
              <span>Longitude: {mapCoords.longitude.toFixed(5)}</span>
            </div>
          </div>
        </div>

        {/* Location Controls & Address Card (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Current Selected Location Card */}
          <div className="glass-panel p-6 rounded-3xl shadow-xl space-y-4 border border-[#2d6a4f]/20 bg-gradient-to-b from-white to-emerald-50/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#0f5238] uppercase tracking-wider">
                Current Kitchen Address
              </span>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#0f5238] border border-emerald-300">
                Active
              </span>
            </div>

            <div className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-black/5 shadow-xs">
              <MapPin className="w-5 h-5 text-[#2d6a4f] shrink-0 mt-0.5 animate-bounce" />
              <div className="space-y-1 w-full">
                {isEditingAddress ? (
                  <div className="space-y-2">
                    <textarea
                      value={manualAddressInput}
                      onChange={(e) => setManualAddressInput(e.target.value)}
                      rows={3}
                      placeholder="Enter full kitchen address (Flat/Shop No, Building, Street, Area, City)..."
                      className="w-full p-2.5 bg-white rounded-xl border border-black/15 text-xs font-semibold text-[#181a2e] focus:outline-none focus:border-[#2d6a4f]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleApplyManualAddress}
                        className="btn-pill bg-[#2d6a4f] text-white text-[11px] px-3 py-1 font-bold shadow-xs flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Apply</span>
                      </button>
                      <button
                        onClick={() => {
                          setManualAddressInput(currentAddress);
                          setIsEditingAddress(false);
                        }}
                        className="btn-pill bg-gray-100 hover:bg-gray-200 text-[#404943] text-[11px] px-3 py-1 font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-[#181a2e] leading-snug">
                      {geocoding ? 'Detecting address details...' : (currentAddress || 'No address set yet')}
                    </p>
                    <button
                      onClick={() => setIsEditingAddress(true)}
                      className="mt-1.5 text-[11px] font-bold text-[#2d6a4f] hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Address Manually</span>
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-[#707973] font-mono pt-1">
                  Coords: {mapCoords.latitude.toFixed(4)}, {mapCoords.longitude.toFixed(4)}
                </p>
              </div>
            </div>

            {/* Save & Confirm Action */}
            <button
              onClick={handleSaveLocation}
              disabled={geocoding || saving}
              className="w-full btn-pill btn-primary py-3 text-sm font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Location...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Kitchen Location</span>
                </>
              )}
            </button>
          </div>

          {/* Direct Manual Address Entry Card */}
          <div className="glass-panel p-5 rounded-3xl shadow-xl space-y-3 border border-black/5">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-[#2d6a4f]" />
              <h3 className="font-heading font-bold text-sm text-[#181a2e]">
                Enter Address Manually
              </h3>
            </div>
            <p className="text-[11px] text-[#707973]">
              If GPS is unavailable, enter your complete kitchen or flat address here:
            </p>
            <textarea
              value={manualAddressInput}
              onChange={(e) => {
                setManualAddressInput(e.target.value);
                setCurrentAddress(e.target.value);
              }}
              rows={3}
              placeholder="e.g. Flat 301, Ganga Heights, Model Colony, Pune - 411016"
              className="w-full p-2.5 bg-white rounded-2xl border border-black/10 text-xs font-semibold text-[#181a2e] focus:outline-none focus:border-[#2d6a4f] shadow-2xs"
            />
            <button
              onClick={handleApplyManualAddress}
              disabled={geocoding}
              className="btn-pill bg-[#2d6a4f]/10 hover:bg-[#2d6a4f]/20 text-[#0f5238] text-xs px-4 py-2 font-bold w-full flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Locate on Map & Set Address</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
