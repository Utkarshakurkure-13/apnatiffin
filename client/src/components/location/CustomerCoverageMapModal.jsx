import React, { useEffect, useRef } from 'react';
import { MapPin, ChefHat, ShieldCheck, X, Navigation } from 'lucide-react';
import L from 'leaflet';

export default function CustomerCoverageMapModal({
  isOpen,
  onClose,
  customerLocation,
  providers = [],
  onSelectProvider
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const cLat = customerLocation?.latitude || 18.5314;
    const cLon = customerLocation?.longitude || 73.8446;

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [cLat, cLon],
        zoom: 13,
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
            <span class="absolute w-10 h-10 rounded-full bg-emerald-500/30 animate-ping"></span>
            <div class="pin-circle w-10 h-10 rounded-full bg-[#2d6a4f] text-white flex items-center justify-center border-2 border-white shadow-xl z-10">
              <span class="material-symbols-outlined text-xl">person_pin_circle</span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const customerMarker = L.marker([cLat, cLon], { icon: customerIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: inherit; padding: 4px;">
            <strong style="color: #2d6a4f; font-size: 13px;">📍 Your Delivery Location</strong>
            <p style="margin: 4px 0 0; font-size: 11px; color: #555;">${customerLocation?.address || 'Current Location'}</p>
          </div>
        `);

      const bounds = L.latLngBounds([[cLat, cLon]]);

      // Plot Providers and Service Radius Circles
      providers.forEach((p) => {
        const pLat = p.prov_lat || 18.5204;
        const pLon = p.prov_lon || 73.8567;
        const radiusMeters = (p.service_radius_km || 5.0) * 1000;
        const isServing = !!p.is_serving_location;

        bounds.extend([pLat, pLon]);

        // Service Radius Circle
        L.circle([pLat, pLon], {
          radius: radiusMeters,
          color: isServing ? '#2d6a4f' : '#e07a5f',
          fillColor: isServing ? '#2d6a4f' : '#e07a5f',
          fillOpacity: isServing ? 0.12 : 0.05,
          weight: 1.8,
          dashArray: isServing ? null : '6, 6'
        }).addTo(map);

        // Provider Marker Icon
        const providerIcon = L.divIcon({
          className: 'custom-map-pin',
          html: `
            <div class="pin-circle w-9 h-9 rounded-full ${isServing ? 'bg-[#2d6a4f]' : 'bg-[#e07a5f]'} text-white flex items-center justify-center border-2 border-white shadow-lg">
              <span class="material-symbols-outlined text-lg">restaurant</span>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const marker = L.marker([pLat, pLon], { icon: providerIcon }).addTo(map);

        const popupContent = document.createElement('div');
        popupContent.style.fontFamily = 'inherit';
        popupContent.style.padding = '4px';
        popupContent.innerHTML = `
          <div style="min-width: 180px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-weight: 800; font-size: 13px; color: #181a2e;">${p.kitchen_name}</span>
              <span style="font-size: 10px; font-weight: 700; background: #fff8e1; color: #b78103; padding: 2px 6px; border-radius: 999px;">${p.total_reviews > 0 ? `★ ${p.rating_avg}` : '★ 0.0'}</span>
            </div>
            <p style="margin: 0 0 6px; font-size: 11px; color: #666;">Chef: ${p.provider_name} • ${p.food_type}</p>
            <div style="font-size: 11px; font-weight: 600; color: ${isServing ? '#2d6a4f' : '#e07a5f'}; margin-bottom: 8px;">
              ${isServing ? '✓ Serves Your Location' : '✗ Outside Service Radius'}
              <br/><span style="color: #777; font-size: 10px;">Distance: ${p.distance_km !== null ? p.distance_km + ' KM' : 'N/A'} • Radius: ${p.service_radius_km} KM</span>
            </div>
            <button id="btn-view-prov-${p.id}" style="width: 100%; background: #2d6a4f; color: #fff; border: none; padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; cursor: pointer;">
              View Kitchen Menu
            </button>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-view-prov-${p.id}`);
          if (btn && onSelectProvider) {
            btn.onclick = () => {
              onSelectProvider(p.id);
              onClose();
            };
          }
        });
      });

      // Fit map to include customer and provider markers nicely
      map.fitBounds(bounds, { padding: [40, 40] });
      mapInstanceRef.current = map;
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, customerLocation, providers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/55 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-modal rounded-3xl p-5 sm:p-7 max-w-4xl w-full shadow-2xl border border-white/80 space-y-4 relative flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2d6a4f]/15 text-[#2d6a4f] flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-lg sm:text-xl text-[#181a2e]">
                Live Provider Coverage & Service Areas
              </h3>
              <p className="text-xs text-[#707973]">
                OpenStreetMap showing your location and local home chefs' delivery coverage circles
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#707973] hover:text-[#181a2e] hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legend Bar */}
        <div className="flex flex-wrap items-center gap-4 bg-white/80 px-4 py-2 rounded-2xl border border-black/5 text-xs text-[#404943]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#2d6a4f]" />
            <span className="font-semibold">Your Location</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-700" />
            <span className="font-semibold">Provider Serves Your Location (Green Circle)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#e07a5f] border border-dashed border-[#e07a5f]" />
            <span className="font-semibold">Other Providers (Orange Dashed)</span>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative flex-1 min-h-[380px] sm:min-h-[460px] rounded-2xl overflow-hidden border border-black/10 shadow-inner">
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[#707973] font-medium">
            📍 Current delivery address: <strong className="text-[#181a2e]">{customerLocation?.address || 'Pune'}</strong>
          </span>
          <button
            onClick={onClose}
            className="btn-pill btn-primary text-xs px-5 py-2 font-bold shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
