import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { useLocationContext } from '../../context/LocationContext';
import { 
  MapPin, Navigation, Check, ArrowLeft, 
  RotateCw, AlertCircle, ShieldAlert, CheckCircle2, 
  Layers, ChefHat, Compass, Loader2, Edit3
} from 'lucide-react';
import confetti from 'canvas-confetti';
import L from 'leaflet';
import { getDeviceGPSCoordinates, reverseGeocodeCoords } from '../../utils/gpsLocation';

export default function CustomerLocationPage({ setActiveTab }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { 
    deliveryLocation, 
    loadingLocation, 
    locationError, 
    permissionStatus, 
    requestDeviceLocation, 
    updateDeliveryLocation 
  } = useLocationContext();

  const [mapCoords, setMapCoords] = useState({
    latitude: deliveryLocation?.latitude || 18.5314,
    longitude: deliveryLocation?.longitude || 73.8446
  });
  const [currentAddress, setCurrentAddress] = useState(deliveryLocation?.address || '');
  const [manualAddressInput, setManualAddressInput] = useState(deliveryLocation?.address || '');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [showCoverageCircles, setShowCoverageCircles] = useState(true);
  const [providers, setProviders] = useState([]);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState('');
  const [gpsDialogue, setGpsDialogue] = useState(null);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const providerLayersRef = useRef([]);

  // Sync state when deliveryLocation updates from context
  useEffect(() => {
    if (deliveryLocation && deliveryLocation.latitude && deliveryLocation.longitude) {
      setMapCoords({
        latitude: deliveryLocation.latitude,
        longitude: deliveryLocation.longitude
      });
      setCurrentAddress(deliveryLocation.address || '');
      setManualAddressInput(deliveryLocation.address || '');
    }
  }, [deliveryLocation]);

  // Fetch nearby providers for coverage overlay
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const lat = mapCoords.latitude;
        const lon = mapCoords.longitude;
        const token = localStorage.getItem('aapna_tiffin_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const res = await fetch(`/api/customer/providers-by-location?lat=${lat}&lon=${lon}`, { headers });
        if (res.ok) {
          const data = await res.json();
          const all = [...(data.servingYourLocation || []), ...(data.otherAvailableProviders || [])];
          setProviders(all);
        }
      } catch (err) {
        console.warn('Failed to fetch providers for coverage map:', err);
      }
    };

    fetchProviders();
  }, [mapCoords]);

  // Reverse geocode coords when pin moves
  const reverseGeocode = async (lat, lon) => {
    setGeocoding(true);
    try {
      const res = await fetch(`/api/location/reverse?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
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

    // Customer Marker (Pulsing Pin)
    const customerIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-11 h-11 rounded-full bg-emerald-500/30 animate-ping"></span>
          <div class="pin-circle w-10 h-10 rounded-full bg-[#2d6a4f] text-white flex items-center justify-center border-2 border-white shadow-2xl z-10 cursor-grab active:cursor-grabbing">
            <span class="material-symbols-outlined text-xl">person_pin_circle</span>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const marker = L.marker([mapCoords.latitude, mapCoords.longitude], {
      draggable: true,
      icon: customerIcon
    }).addTo(map);

    marker.bindPopup(`<strong>📍 Selected Delivery Location</strong><br/>${currentAddress || 'Drag or click to adjust'}`);

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

    // Force Leaflet to recalculate container bounds after mount to prevent steady/frozen preview
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

  // Provider Coverage Circles Overlay on the Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear old provider layers
    providerLayersRef.current.forEach(layer => mapInstanceRef.current.removeLayer(layer));
    providerLayersRef.current = [];

    if (!showCoverageCircles) return;

    providers.forEach(p => {
      const pLat = p.prov_lat || 18.5204;
      const pLon = p.prov_lon || 73.8567;
      const radiusMeters = (p.service_radius_km || 5.0) * 1000;
      const isServing = !!p.is_serving_location;

      // Circle
      const circle = L.circle([pLat, pLon], {
        radius: radiusMeters,
        color: isServing ? '#2d6a4f' : '#e07a5f',
        fillColor: isServing ? '#2d6a4f' : '#e07a5f',
        fillOpacity: isServing ? 0.12 : 0.05,
        weight: 1.8,
        dashArray: isServing ? null : '6, 6'
      }).addTo(mapInstanceRef.current);

      // Provider Chef Marker
      const provIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="pin-circle w-8 h-8 rounded-full ${isServing ? 'bg-[#2d6a4f]' : 'bg-[#e07a5f]'} text-white flex items-center justify-center border-2 border-white shadow-md">
            <span class="material-symbols-outlined text-sm">restaurant</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const pMarker = L.marker([pLat, pLon], { icon: provIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div style="font-family: inherit; padding: 2px;">
            <strong style="color: #181a2e; font-size: 12px;">${p.kitchen_name}</strong>
            <p style="margin: 2px 0; font-size: 11px; color: ${isServing ? '#2d6a4f' : '#e07a5f'}; font-weight: bold;">
              ${isServing ? '✓ Serves Your Location' : '✗ Outside Service Area'}
            </p>
            <span style="font-size: 10px; color: #777;">Radius: ${p.service_radius_km} KM</span>
          </div>
        `);

      providerLayersRef.current.push(circle, pMarker);
    });
  }, [providers, showCoverageCircles]);

  // Quick GPS Detection
  const handleDetectGPS = async () => {
    setGpsDialogue(null);
    try {
      const loc = await requestDeviceLocation(true);
      if (loc && loc.latitude && loc.longitude) {
        const newCoords = {
          latitude: loc.latitude,
          longitude: loc.longitude
        };
        setMapCoords(newCoords);
        setCurrentAddress(loc.address);
        setManualAddressInput(loc.address);

        // Smoothly fly camera to street level
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.flyTo([loc.latitude, loc.longitude], 16, {
            duration: 1.5,
            easeLinearity: 0.25
          });

          // Draw / update accuracy halo
          if (accuracyCircleRef.current) {
            mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
          }
          accuracyCircleRef.current = L.circle([loc.latitude, loc.longitude], {
            radius: Math.min(Math.max(loc.accuracy || 30, 20), 120),
            color: '#2d6a4f',
            fillColor: '#52b788',
            fillOpacity: 0.18,
            weight: 1.5
          }).addTo(mapInstanceRef.current);
        }

        // Place marker on detected location
        if (markerRef.current) {
          markerRef.current.setLatLng([loc.latitude, loc.longitude]);
          markerRef.current.bindPopup(`<strong>📍 Your Current Location</strong><br/>${loc.address}`).openPopup();
        }

        setGpsDialogue({
          type: 'success',
          message: `✓ Current location detected! (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}). Click "Confirm Location" to save.`
        });
      }
    } catch (err) {
      console.warn('GPS detection failed:', err);
      const dialogue = err.userDialogue || err.message || 'Unable to detect current location. You can enter your address manually below.';
      setGpsDialogue({
        type: 'error',
        code: err.code,
        message: dialogue
      });
    }
  };

  // Locate and set address entered manually
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
            markerRef.current.bindPopup(`<strong>📍 Delivery Location</strong><br/>${manualAddressInput.trim()}`).openPopup();
          }
          setGpsDialogue({
            type: 'info',
            message: `✓ Located "${manualAddressInput.trim()}" on the map. Click "Confirm Location" to save.`
          });
        } else {
          setCurrentAddress(manualAddressInput.trim());
          setGpsDialogue({
            type: 'info',
            message: `✓ Address set to "${manualAddressInput.trim()}". You can adjust the pin on the map and click "Confirm Location".`
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

  const handleSaveAndConfirm = () => {
    const finalAddress = (manualAddressInput && manualAddressInput.trim()) 
      ? manualAddressInput.trim() 
      : (currentAddress || `Location (${mapCoords.latitude.toFixed(4)}, ${mapCoords.longitude.toFixed(4)})`);

    updateDeliveryLocation({
      latitude: mapCoords.latitude,
      longitude: mapCoords.longitude,
      address: finalAddress,
      city: 'Local Area'
    });

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    setSavedSuccessMsg('✓ Delivery location updated and synchronized!');
    setTimeout(() => {
      setSavedSuccessMsg('');
      setActiveTab('customer-dashboard');
    }, 1200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Breadcrumb Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('customer-dashboard')}
            className="p-2.5 rounded-2xl bg-white border border-black/10 hover:bg-black/5 text-[#181a2e] transition-colors shadow-xs"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
              Delivery Location & Coverage Map
            </h1>
            <p className="text-xs sm:text-sm text-[#404943]">
              Detect your real device location, enter your address manually, or pin-point on OpenStreetMap
            </p>
          </div>
        </div>

        {/* Quick GPS Action Button */}
        <button
          onClick={handleDetectGPS}
          disabled={loadingLocation || geocoding}
          className="btn-pill btn-primary text-xs sm:text-sm px-5 py-2.5 font-bold shadow-md flex items-center gap-2 self-start sm:self-auto"
        >
          {loadingLocation || geocoding ? (
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

      {/* GPS Dialogues: Success, Permission Denied, Windows Location Off */}
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
                  ? 'Location Detected' 
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

      {/* Permission Denied or Detection Error Alert Banner */}
      {!gpsDialogue && (permissionStatus === 'DENIED' || permissionStatus === 'LOCATION_OFF' || locationError) && (
        <div className="p-4 bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block text-sm">
                {permissionStatus === 'LOCATION_OFF' 
                  ? 'Windows Location Services Turned OFF' 
                  : 'Location Access Required'}
              </span>
              <span>
                {locationError || (permissionStatus === 'LOCATION_OFF'
                  ? 'Location is turned OFF in Windows Settings. Turn on "Location services" in Settings > Privacy & Security > Location.'
                  : 'Location permission was denied. Please allow location access in your browser or enter your address manually below.')}
              </span>
            </div>
          </div>
          <button
            onClick={handleDetectGPS}
            className="btn-pill bg-amber-600 hover:bg-amber-700 text-white text-xs px-4 py-2 font-bold shrink-0 shadow-xs"
          >
            Try Again
          </button>
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
                  Interactive OpenStreetMap
                </h3>
              </div>

              {/* Toggle Provider Service Area Circles */}
              <button
                onClick={() => setShowCoverageCircles(!showCoverageCircles)}
                className={`btn-pill text-xs px-3 py-1 font-semibold border transition-all flex items-center gap-1.5 ${
                  showCoverageCircles
                    ? 'bg-emerald-50 text-[#0f5238] border-emerald-200'
                    : 'bg-white text-[#707973] border-black/10'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{showCoverageCircles ? 'Hide Service Circles' : 'View Coverage Circles'}</span>
              </button>
            </div>

            {/* Map Canvas */}
            <div className="relative rounded-2xl overflow-hidden border border-black/10 shadow-inner h-[420px] sm:h-[500px]">
              <div ref={mapContainerRef} className="w-full h-full" />
              <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-[#404943] border border-black/5 shadow-md">
                💡 Drag the green pin or click anywhere on the map to place your delivery location
              </div>
            </div>

            {/* Map Legend */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-[#404943]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#2d6a4f]" />
                <span className="font-bold">Your Delivery Pin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-700" />
                <span>Provider Serves You (Green Circle)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#e07a5f] border border-dashed border-[#e07a5f]" />
                <span>Outside Service Radius (Orange Dashed)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Location Controls & Address Card (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Current Detected Address Card */}
          <div className="glass-panel p-6 rounded-3xl shadow-xl space-y-4 border border-[#2d6a4f]/20 bg-gradient-to-b from-white to-emerald-50/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#0f5238] uppercase tracking-wider">
                Current Selected Location
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
                      placeholder="Enter full delivery address (Flat/House No, Building, Street, Area, City)..."
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
                      {geocoding ? 'Detecting address details...' : (currentAddress || 'No location selected yet')}
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
                <p className="text-[11px] text-[#707973] font-mono pt-1">
                  Coordinates: {mapCoords.latitude.toFixed(5)}, {mapCoords.longitude.toFixed(5)}
                </p>
              </div>
            </div>

            {/* Save & Confirm Action */}
            <button
              onClick={handleSaveAndConfirm}
              disabled={geocoding}
              className="w-full btn-pill btn-primary py-3 text-sm font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Location</span>
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
              Type your complete delivery address (Flat/House No, Building, Street, Area, City, Pincode):
            </p>
            <textarea
              value={manualAddressInput}
              onChange={(e) => {
                setManualAddressInput(e.target.value);
                setCurrentAddress(e.target.value);
              }}
              rows={3}
              placeholder="e.g. Flat 402, Sai Residency, Model Colony, Pune - 411016"
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
