import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { useLocationContext } from '../../context/LocationContext';
import { 
  MapPin, Crosshair, Save, Calendar, Plus, Trash2, 
  CheckCircle2, AlertCircle, Info, Navigation, Sliders
} from 'lucide-react';
import L from 'leaflet';
import { getDeviceGPSCoordinates, reverseGeocodeCoords } from '../../utils/gpsLocation';

const PRESET_RADII = [2, 3, 5, 7, 10, 15];

export default function ProviderServiceArea({ setActiveTab }) {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const { updateProviderLocation } = useLocationContext();

  const [kitchenCoords, setKitchenCoords] = useState({ latitude: 18.5362, longitude: 73.8410 });
  const [kitchenAddress, setKitchenAddress] = useState('');
  const [defaultRadius, setDefaultRadius] = useState(5.0);
  const [dateSpecificRules, setDateSpecificRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Date override form
  const [newDate, setNewDate] = useState('');
  const [newDateRadius, setNewDateRadius] = useState(7.0);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  const fetchServiceAreaInfo = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [locRes, areaRes] = await Promise.all([
        fetch('/api/provider/location', { headers }),
        fetch('/api/provider/service-area', { headers })
      ]);

      if (locRes.ok) {
        const locData = await locRes.json();
        setKitchenCoords({
          latitude: locData.location?.latitude || 18.5362,
          longitude: locData.location?.longitude || 73.8410
        });
        setKitchenAddress(locData.location?.address || locData.kitchenAddress || '');
      }

      if (areaRes.ok) {
        const areaData = await areaRes.json();
        setDefaultRadius(areaData.defaultRadiusKm || 5.0);
        setDateSpecificRules(areaData.dateSpecificAreas || []);
      }
    } catch (err) {
      console.error('Failed to load provider service area:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceAreaInfo();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [kitchenCoords.latitude, kitchenCoords.longitude],
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Custom Kitchen Pin Marker
    const kitchenIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div class="pin-circle w-10 h-10 rounded-full bg-[#0f5238] text-white flex items-center justify-center border-2 border-white shadow-2xl cursor-grab active:cursor-grabbing">
          <span class="material-symbols-outlined text-xl">restaurant</span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const marker = L.marker([kitchenCoords.latitude, kitchenCoords.longitude], {
      draggable: true,
      icon: kitchenIcon
    }).addTo(map);

    marker.bindPopup(`<strong>📍 Kitchen Location</strong><br/>${kitchenAddress || 'Your Kitchen'}`);

    // Real-time Service Radius Circle
    const circle = L.circle([kitchenCoords.latitude, kitchenCoords.longitude], {
      radius: defaultRadius * 1000,
      color: '#2d6a4f',
      fillColor: '#2d6a4f',
      fillOpacity: 0.15,
      weight: 2
    }).addTo(map);

    marker.on('dragend', async (e) => {
      const { lat, lng } = e.target.getLatLng();
      setKitchenCoords({ latitude: lat, longitude: lng });
      circle.setLatLng([lat, lng]);

      // Reverse geocode new address
      try {
        const res = await fetch(`/api/location/reverse?lat=${lat}&lon=${lng}`);
        if (res.ok) {
          const data = await res.json();
          setKitchenAddress(data.address || `Kitchen (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
      } catch (err) {
        console.warn('Geocoding error:', err);
      }
    });

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      setKitchenCoords({ latitude: lat, longitude: lng });

      try {
        const res = await fetch(`/api/location/reverse?lat=${lat}&lon=${lng}`);
        if (res.ok) {
          const data = await res.json();
          setKitchenAddress(data.address || `Kitchen (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
      } catch (err) {
        console.warn('Geocoding error:', err);
      }
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Force Leaflet to recalculate container bounds after mount to prevent steady/frozen preview
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading]);

  // Update circle radius dynamically when defaultRadius changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(defaultRadius * 1000);
    }
  }, [defaultRadius]);

  const handleSaveDefaultRadius = async () => {
    setSaving(true);
    setStatusMsg('');
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      // 1. Save Kitchen Location Coordinates & Address
      const locRes = await fetch('/api/provider/location', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          latitude: kitchenCoords.latitude,
          longitude: kitchenCoords.longitude,
          address: kitchenAddress,
          city: 'Pune'
        })
      });

      // 2. Save Default Radius
      const radRes = await fetch('/api/provider/service-area', {
        method: 'POST',
        headers,
        body: JSON.stringify({ radius_km: defaultRadius })
      });

      if (!locRes.ok || !radRes.ok) {
        throw new Error('Failed to save service area settings.');
      }

      if (updateProviderLocation) {
        updateProviderLocation({
          latitude: kitchenCoords.latitude,
          longitude: kitchenCoords.longitude,
          address: kitchenAddress,
          city: 'Pune'
        });
      }

      setStatusMsg('✓ Kitchen location & default service radius saved successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUseGPS = async () => {
    setDetectingGps(true);
    setGpsError('');
    try {
      // 1. Request device coordinates (Browser GPS with Windows Location fallback)
      const coords = await getDeviceGPSCoordinates();
      const { latitude, longitude } = coords;

      // 2. Smoothly fly existing OpenStreetMap preview to detected coordinates (Google Maps style)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.flyTo([latitude, longitude], 16, { duration: 1.5, easeLinearity: 0.25 });
      }

      // 3. Automatically move/place marker and circle on the detected location
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      }
      if (circleRef.current) {
        circleRef.current.setLatLng([latitude, longitude]);
      }

      // 4. Update coordinates state & reverse geocode address
      setKitchenCoords({ latitude, longitude });
      const geo = await reverseGeocodeCoords(latitude, longitude);
      setKitchenAddress(geo.address);
      if (markerRef.current) {
        markerRef.current.bindPopup(`<strong>📍 Kitchen Location</strong><br/>${geo.address}`).openPopup();
      }

      setStatusMsg(`✓ Kitchen location detected! (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). Click "Confirm Location" to save.`);
    } catch (err) {
      console.warn('Provider GPS detection error:', err);
      const dialogue = err.userDialogue || err.message || 'Unable to detect GPS location.';
      setGpsError(dialogue);
    } finally {
      setDetectingGps(false);
    }
  };

  const handleAddDateRule = async (e) => {
    e.preventDefault();
    if (!newDate) return alert('Please pick a date.');

    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/provider/service-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ effective_date: newDate, radius_km: parseFloat(newDateRadius) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setNewDate('');
      setStatusMsg(data.message);
      fetchServiceAreaInfo();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteDateRule = async (ruleId) => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/provider/service-area/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete rule.');

      fetchServiceAreaInfo();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-[#707973] font-semibold">
        Loading Service Area Settings...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl border border-[#2d6a4f]/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#2d6a4f]/15 text-[#2d6a4f] flex items-center justify-center">
              <Crosshair className="w-5 h-5" />
            </div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
              Delivery Service Area & Kitchen Location
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#404943]">
            Configure where your kitchen operates and set your delivery radius for geofenced customer matching.
          </p>
        </div>

        <button
          onClick={handleSaveDefaultRadius}
          disabled={saving}
          className="btn-pill btn-primary text-sm px-6 py-3 font-bold shadow-lg flex items-center gap-2 self-end md:self-center"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Confirm Location</span>
            </>
          )}
        </button>
      </div>

      {statusMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-sm animate-in fade-in">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {/* Main Grid: Map on Left, Controls on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Real OpenStreetMap Visualizer (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-5 rounded-3xl shadow-xl space-y-3 border border-black/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#2d6a4f]" />
                <h3 className="font-heading font-bold text-base text-[#181a2e]">
                  Live OpenStreetMap Service Coverage
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUseGPS}
                  disabled={detectingGps}
                  className="btn-pill btn-primary text-xs px-3.5 py-1.5 font-bold shadow-xs flex items-center gap-1.5"
                  title="Detect and use current device GPS location"
                >
                  {detectingGps ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Use GPS</span>
                    </>
                  )}
                </button>
                <span className="text-xs font-bold text-[#2d6a4f] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Radius: {defaultRadius} KM Circle
                </span>
              </div>
            </div>

            {gpsError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-center justify-between text-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{gpsError}</span>
                </div>
                <button onClick={() => setGpsError('')} className="text-rose-700 hover:text-rose-900 font-bold ml-2">✕</button>
              </div>
            )}

            <div className="relative rounded-2xl overflow-hidden border border-black/10 shadow-inner h-[380px] sm:h-[460px]">
              <div ref={mapContainerRef} className="w-full h-full" />
              <div className="absolute bottom-2 left-2 z-20 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-[#404943] border border-black/5 shadow-xs">
                📍 Drag the green chef pin or click on the map to set your kitchen origin
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl text-xs flex items-center justify-between text-[#404943]">
              <span>Kitchen Address: <strong>{kitchenAddress || 'Pune, Maharashtra'}</strong></span>
              <span className="text-[11px] text-[#707973]">Coords: ({kitchenCoords.latitude.toFixed(4)}, {kitchenCoords.longitude.toFixed(4)})</span>
            </div>
          </div>
        </div>

        {/* Configuration Controls (1 Col) */}
        <div className="space-y-6">
          {/* Default Radius Selector */}
          <div className="glass-panel p-6 rounded-3xl shadow-xl space-y-5 border border-black/5">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#2d6a4f]" />
              <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                Default Service Radius
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#707973]">Current Radius:</span>
                <span className="text-xl font-heading font-black text-[#0f5238]">
                  {defaultRadius} KM
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={defaultRadius}
                onChange={(e) => setDefaultRadius(parseFloat(e.target.value))}
                className="w-full accent-[#2d6a4f] cursor-pointer"
              />

              {/* Preset Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {PRESET_RADII.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDefaultRadius(r)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      defaultRadius === r
                        ? 'bg-[#2d6a4f] text-white shadow-xs'
                        : 'bg-white border border-black/10 text-[#404943] hover:bg-black/5'
                    }`}
                  >
                    {r} KM
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-[#707973] leading-relaxed">
              Customers located within this distance will see your kitchen listed under <strong>"Providers Serving Your Location"</strong>.
            </p>
          </div>

          {/* Date-Specific Service Radius Overrides */}
          <div className="glass-panel p-6 rounded-3xl shadow-xl space-y-4 border border-black/5">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#e07a5f]" />
              <h3 className="font-heading font-bold text-base text-[#181a2e]">
                Date-Specific Radius Overrides
              </h3>
            </div>

            <form onSubmit={handleAddDateRule} className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={newDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="px-3 py-2 bg-white rounded-xl border border-black/10 text-xs font-semibold text-[#181a2e]"
                />
                <select
                  value={newDateRadius}
                  onChange={(e) => setNewDateRadius(e.target.value)}
                  className="px-3 py-2 bg-white rounded-xl border border-black/10 text-xs font-semibold text-[#181a2e]"
                >
                  {PRESET_RADII.map((r) => (
                    <option key={r} value={r}>{r} KM</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full btn-pill btn-secondary text-xs py-2 font-bold shadow-xs flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Date Rule</span>
              </button>
            </form>

            {/* List of active date overrides */}
            {dateSpecificRules.length > 0 && (
              <div className="divide-y divide-black/5 border-t border-black/5 pt-2 space-y-2">
                {dateSpecificRules.map((rule) => (
                  <div key={rule.id} className="pt-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#181a2e] block">{rule.effective_date}</span>
                      <span className="text-[11px] text-[#2d6a4f] font-semibold">Radius: {rule.radius_km} KM</span>
                    </div>
                    <button
                      onClick={() => handleDeleteDateRule(rule.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
