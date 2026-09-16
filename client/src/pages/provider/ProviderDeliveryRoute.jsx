import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import StatusBadge from '../../components/common/StatusBadge';
import { 
  Navigation, MapPin, CheckCircle2, Clock, Phone, 
  RotateCw, Key, Camera, AlertCircle, ChefHat, 
  ChevronRight, Calendar, Route, Check, X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import L from 'leaflet';

export default function ProviderDeliveryRoute({ setActiveTab }) {
  const { user, profile } = useAuth();
  const { t } = useI18n();

  const [routeData, setRouteData] = useState(null);
  const [mealTypeFilter, setMealTypeFilter] = useState('ALL');
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Delivery Verification Modals
  const [activeStop, setActiveStop] = useState(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [inputOtp, setInputOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylineRef = useRef(null);
  const markersRef = useRef([]);

  const fetchDeliveryRoute = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const res = await fetch(`/api/provider/delivery-route?meal_type=${mealTypeFilter}&date=${targetDate}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRouteData(data);
      }
    } catch (err) {
      console.error('Failed to fetch delivery route:', err);
    } finally {
      setLoading(false);
      setRecalculating(false);
    }
  };

  useEffect(() => {
    fetchDeliveryRoute();
  }, [mealTypeFilter, targetDate]);

  // Render & Update Leaflet Route Map
  useEffect(() => {
    if (loading || !mapContainerRef.current || !routeData) return;

    const origin = routeData.origin || { latitude: 18.5362, longitude: 73.8410 };
    const stops = routeData.orderedStops || [];
    const waypoints = routeData.waypoints || [];

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [origin.latitude, origin.longitude],
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    const bounds = L.latLngBounds([[origin.latitude, origin.longitude]]);

    // 1. Kitchen Start Marker (Origin)
    const kitchenIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div class="pin-circle w-10 h-10 rounded-full bg-[#0f5238] text-white flex items-center justify-center border-2 border-white shadow-2xl">
          <span class="material-symbols-outlined text-xl">restaurant</span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    L.marker([origin.latitude, origin.longitude], { icon: kitchenIcon })
      .addTo(map)
      .bindPopup(`<strong>📍 Kitchen Start Location</strong><br/>${origin.address || 'Kitchen'}`);

    // 2. Road Route Polyline (OSRM Geometry)
    if (waypoints.length > 0) {
      polylineRef.current = L.polyline(waypoints, {
        color: '#2d6a4f',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    // 3. Customer Stop Markers with Sequence Numbers
    stops.forEach((stop) => {
      bounds.extend([stop.latitude, stop.longitude]);

      const isCompleted = stop.is_completed;
      const stopIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="pin-circle w-9 h-9 rounded-full ${isCompleted ? 'bg-gray-400 text-white line-through' : 'bg-[#e07a5f] text-white'} flex items-center justify-center border-2 border-white shadow-lg font-bold text-xs">
            ${isCompleted ? '✓' : stop.stop_sequence}
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: inherit; padding: 4px;">
            <strong style="color: ${isCompleted ? '#666' : '#e07a5f'}; font-size: 13px;">
              Stop ${stop.stop_sequence}: ${stop.customer_name} ${isCompleted ? '(DELIVERED)' : ''}
            </strong>
            <p style="margin: 4px 0 0; font-size: 11px; color: #444;">${stop.address}</p>
            <p style="margin: 2px 0 0; font-size: 11px; color: #777;">Order #${stop.order_number} • ${stop.meal_type}</p>
          </div>
        `);
    });

    map.fitBounds(bounds, { padding: [50, 50] });
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading, routeData]);

  // Complete Stop via OTP
  const handleVerifyOtp = async () => {
    if (!inputOtp || !activeStop) return;
    setVerifyingOtp(true);
    setOtpError('');
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/provider/delivery-route/complete-stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: activeStop.order_id,
          otp: inputOtp.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP');

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      setActionMsg(`✓ Stop ${activeStop.stop_sequence} for ${activeStop.customer_name} delivered successfully!`);
      setOtpModalOpen(false);
      setInputOtp('');
      setActiveStop(null);
      fetchDeliveryRoute();
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Complete Stop via Photo Proof
  const handleUploadPhoto = async () => {
    if (!activeStop) return;
    setUploadingPhoto(true);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/provider/delivery-route/complete-stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: activeStop.order_id,
          photo_url: photoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record photo delivery');

      setActionMsg(`✓ Photo proof recorded for ${activeStop.customer_name}. Order marked Delivered.`);
      setPhotoModalOpen(false);
      setPhotoUrl('');
      setActiveStop(null);
      fetchDeliveryRoute();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-[#707973] font-semibold">
        Calculating recommended road delivery route...
      </div>
    );
  }

  const stops = routeData?.orderedStops || [];
  const remainingStops = stops.filter(s => !s.is_completed);
  const completedStops = stops.filter(s => s.is_completed);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Summary Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl border border-[#2d6a4f]/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#2d6a4f]/15 text-[#2d6a4f] flex items-center justify-center">
              <Route className="w-5 h-5" />
            </div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
              Today's Recommended Delivery Route
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#404943]">
            Optimized multi-stop road network route connecting your kitchen to active customer delivery destinations.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-3 py-1.5 bg-white rounded-xl border border-black/10 text-xs font-semibold text-[#181a2e]"
          />

          <div className="flex bg-white/80 border border-black/10 rounded-full p-1 text-xs font-bold">
            <button
              onClick={() => setMealTypeFilter('ALL')}
              className={`px-3 py-1 rounded-full transition-all ${mealTypeFilter === 'ALL' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#404943]'}`}
            >
              All Meals
            </button>
            <button
              onClick={() => setMealTypeFilter('LUNCH')}
              className={`px-3 py-1 rounded-full transition-all ${mealTypeFilter === 'LUNCH' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#404943]'}`}
            >
              Lunch
            </button>
            <button
              onClick={() => setMealTypeFilter('DINNER')}
              className={`px-3 py-1 rounded-full transition-all ${mealTypeFilter === 'DINNER' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#404943]'}`}
            >
              Dinner
            </button>
          </div>

          <button
            onClick={() => { setRecalculating(true); fetchDeliveryRoute(); }}
            disabled={recalculating}
            title="Recalculate Route"
            className="btn-pill btn-outline p-2 text-xs"
          >
            <RotateCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-sm animate-in fade-in">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {/* TRIP METRICS KPI STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl shadow-xs border border-black/5">
          <span className="text-[11px] font-bold text-[#707973] uppercase tracking-wider block">
            Total Road Distance
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-heading font-black text-[#0f5238]">
              {routeData?.totalDistanceKm || 0}
            </span>
            <span className="text-xs font-bold text-[#2d6a4f]">KM</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl shadow-xs border border-black/5">
          <span className="text-[11px] font-bold text-[#707973] uppercase tracking-wider block">
            Est. Trip Duration
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-heading font-black text-[#e07a5f]">
              {routeData?.estimatedDurationMins || 0}
            </span>
            <span className="text-xs font-bold text-[#e07a5f]">Mins</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl shadow-xs border border-black/5">
          <span className="text-[11px] font-bold text-[#707973] uppercase tracking-wider block">
            Stops Remaining
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-heading font-black text-[#181a2e]">
              {remainingStops.length}
            </span>
            <span className="text-xs font-semibold text-[#707973]">/ {stops.length} Stops</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl shadow-xs border border-black/5">
          <span className="text-[11px] font-bold text-[#707973] uppercase tracking-wider block">
            Completed Deliveries
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-heading font-black text-emerald-600">
              {completedStops.length}
            </span>
            <span className="text-xs font-semibold text-emerald-700">Delivered</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Road Map on Left, Ordered Sequence on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Leaflet Road Map (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5 rounded-3xl shadow-xl space-y-3 border border-black/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#2d6a4f]" />
                <h3 className="font-heading font-bold text-base text-[#181a2e]">
                  Turn-by-Turn Road Map
                </h3>
              </div>
              <span className="text-xs font-semibold text-[#707973]">
                {routeData?.isRealRoadNetwork ? '✓ OSRM Road Network' : 'Road Interpolation'}
              </span>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-black/10 shadow-inner h-[400px] sm:h-[480px]">
              <div ref={mapContainerRef} className="w-full h-full" />
              <div className="absolute bottom-2 left-2 z-20 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-[#404943] border border-black/5 shadow-xs">
                📍 Sequence: Kitchen ➔ Stop 1 ➔ Stop 2 ➔ Stop 3...
              </div>
            </div>
          </div>
        </div>

        {/* Stop-by-Stop List (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-lg text-[#181a2e]">
              Recommended Stop Sequence
            </h3>
            <span className="text-xs font-bold text-[#2d6a4f]">
              {stops.length} Total Deliveries
            </span>
          </div>

          {stops.length === 0 ? (
            <div className="glass-panel p-8 rounded-3xl text-center text-[#707973] space-y-2">
              <CheckCircle2 className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="font-semibold text-[#181a2e]">No active deliveries scheduled for this slot.</p>
              <p className="text-xs text-[#404943]">New orders ready for dispatch will automatically appear in this sequence.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
              {stops.map((stop) => {
                const isDelivered = stop.is_completed;
                return (
                  <div
                    key={stop.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isDelivered 
                        ? 'bg-gray-50/80 border-gray-200 opacity-75' 
                        : 'bg-white border-[#2d6a4f]/25 shadow-md hover:border-[#2d6a4f]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-[#e07a5f] text-white shadow-xs'
                        }`}>
                          {isDelivered ? '✓' : stop.stop_sequence}
                        </div>
                        <div>
                          <h4 className="font-heading font-bold text-sm text-[#181a2e]">
                            {stop.customer_name}
                          </h4>
                          <span className="text-[10px] text-[#707973] uppercase font-bold">
                            Order #{stop.order_number} • {stop.meal_type}
                          </span>
                        </div>
                      </div>

                      <StatusBadge status={stop.order_status} />
                    </div>

                    <div className="text-xs text-[#404943] flex items-start gap-1.5 bg-gray-50 p-2.5 rounded-xl border border-black/5">
                      <MapPin className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{stop.address}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <a
                        href={`tel:${stop.customer_mobile}`}
                        className="flex items-center gap-1 font-bold text-[#2d6a4f] hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{stop.customer_mobile}</span>
                      </a>

                      {!isDelivered ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setActiveStop(stop);
                              setOtpModalOpen(true);
                            }}
                            className="btn-pill btn-primary text-xs px-3 py-1 font-bold shadow-xs flex items-center gap-1"
                          >
                            <Key className="w-3 h-3" />
                            <span>Verify OTP</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveStop(stop);
                              setPhotoModalOpen(true);
                            }}
                            title="Upload Delivery Photo Proof"
                            className="p-1.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* OTP Verification Modal */}
      {otpModalOpen && activeStop && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-modal rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[#2d6a4f]" />
                <h3 className="font-heading font-bold text-base text-[#181a2e]">
                  Enter 4-Digit Delivery OTP
                </h3>
              </div>
              <button onClick={() => setOtpModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#404943]">
              Ask customer <strong>{activeStop.customer_name}</strong> for their 4-digit order PIN:
            </p>

            <input
              type="text"
              maxLength={4}
              value={inputOtp}
              onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full text-center text-3xl font-mono font-black tracking-widest py-3 bg-white rounded-2xl border-2 border-[#2d6a4f]/30 focus:border-[#2d6a4f] focus:outline-none shadow-xs text-[#0f5238]"
            />

            {otpError && (
              <p className="text-xs text-rose-600 font-semibold text-center">{otpError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOtpModalOpen(false)}
                className="btn-pill btn-outline text-xs px-4 py-2 flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || inputOtp.length !== 4}
                className="btn-pill btn-primary text-xs px-5 py-2 flex-1 font-bold shadow-md"
              >
                {verifyingOtp ? 'Verifying...' : 'Confirm Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Proof Upload Modal */}
      {photoModalOpen && activeStop && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-modal rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-600" />
                <h3 className="font-heading font-bold text-base text-[#181a2e]">
                  Doorstep Photo Proof
                </h3>
              </div>
              <button onClick={() => setPhotoModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#404943]">
              If customer is unavailable to give OTP, take a photo of the tiffin at their doorstep:
            </p>

            <input
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Paste photo proof URL (or use default)"
              className="w-full px-3 py-2 bg-white rounded-xl border border-black/10 text-xs text-[#181a2e]"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPhotoModalOpen(false)}
                className="btn-pill btn-outline text-xs px-4 py-2 flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadPhoto}
                disabled={uploadingPhoto}
                className="btn-pill bg-amber-600 hover:bg-amber-700 text-white text-xs px-5 py-2 flex-1 font-bold shadow-md"
              >
                {uploadingPhoto ? 'Saving...' : 'Submit Proof'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
