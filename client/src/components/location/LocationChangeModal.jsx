import React, { useState, useEffect, useRef } from 'react';
import { useLocationContext } from '../../context/LocationContext';
import { MapPin, Search, Navigation, Check, X, Loader2 } from 'lucide-react';
import L from 'leaflet';

export default function LocationChangeModal() {
  const {
    deliveryLocation,
    changeModalOpen,
    setChangeModalOpen,
    updateDeliveryLocation,
    requestDeviceLocation,
    loadingLocation
  } = useLocationContext();

  const [selectedCoords, setSelectedCoords] = useState({
    latitude: deliveryLocation?.latitude || 18.5314,
    longitude: deliveryLocation?.longitude || 73.8446
  });
  const [selectedAddress, setSelectedAddress] = useState(deliveryLocation?.address || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Sync initial state when modal opens
  useEffect(() => {
    if (changeModalOpen && deliveryLocation) {
      setSelectedCoords({
        latitude: deliveryLocation.latitude,
        longitude: deliveryLocation.longitude
      });
      setSelectedAddress(deliveryLocation.address);
    }
  }, [changeModalOpen, deliveryLocation]);

  // Reverse geocode when coordinates change
  const fetchAddressForCoords = async (lat, lon) => {
    setGeocoding(true);
    try {
      const res = await fetch(`/api/location/reverse?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAddress(data.address || `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
      }
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    } finally {
      setGeocoding(false);
    }
  };

  // Initialize Leaflet Map inside Modal
  useEffect(() => {
    if (!changeModalOpen || !mapContainerRef.current) return;

    // Small timeout to allow modal animation to complete before Leaflet sizes the container
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [selectedCoords.latitude, selectedCoords.longitude],
        zoom: 14,
        zoomControl: true
      });

      // Standard OSM Tile Layer with mandatory attribution
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Custom Pin Marker
      const pinIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="pin-circle w-9 h-9 rounded-full bg-[#2d6a4f] text-white flex items-center justify-center border-2 border-white shadow-lg cursor-grab active:cursor-grabbing">
            <span class="material-symbols-outlined text-lg">location_on</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });

      const marker = L.marker([selectedCoords.latitude, selectedCoords.longitude], {
        draggable: true,
        icon: pinIcon
      }).addTo(map);

      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        setSelectedCoords({ latitude: lat, longitude: lng });
        fetchAddressForCoords(lat, lng);
      });

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setSelectedCoords({ latitude: lat, longitude: lng });
        fetchAddressForCoords(lat, lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [changeModalOpen]);

  // Update map view when coords change externally (e.g. from search selection)
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([selectedCoords.latitude, selectedCoords.longitude], 15);
      markerRef.current.setLatLng([selectedCoords.latitude, selectedCoords.longitude]);
    }
  }, [selectedCoords]);

  // Autocomplete Search Debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/location/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.warn('Location search error:', err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleSelectSearchResult = (item) => {
    setSelectedCoords({
      latitude: item.latitude,
      longitude: item.longitude
    });
    setSelectedAddress(item.address || item.display_name);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleUseCurrentLocation = async () => {
    try {
      const loc = await requestDeviceLocation(true);
      if (loc && loc.latitude && loc.longitude) {
        setSelectedCoords({
          latitude: loc.latitude,
          longitude: loc.longitude
        });
        setSelectedAddress(loc.address);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([loc.latitude, loc.longitude], 15, { animate: true });
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([loc.latitude, loc.longitude]);
        }
      }
    } catch (err) {
      console.warn('GPS location detection failed:', err);
    }
  };

  const handleSaveLocation = () => {
    updateDeliveryLocation({
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
      address: selectedAddress,
      city: 'Pune'
    });
  };

  if (!changeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-modal rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl border border-white/80 space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2d6a4f]/15 text-[#2d6a4f] flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-lg text-[#181a2e]">
                Select Delivery Location
              </h3>
              <p className="text-xs text-[#707973]">
                Search address or drag the pin to your exact delivery location
              </p>
            </div>
          </div>

          <button
            onClick={() => setChangeModalOpen(false)}
            className="p-2 rounded-full text-[#707973] hover:text-[#181a2e] hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {locationError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-center gap-2 text-xs">
            <span className="text-rose-600 font-bold shrink-0">⚠️</span>
            <span>{locationError}</span>
          </div>
        )}

        {/* Search Bar & Use Current Location Button */}
        <div className="space-y-2 relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search street, area, landmark, or city..."
                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl border border-black/10 text-xs font-medium text-[#181a2e] focus:outline-none focus:border-[#2d6a4f] shadow-xs"
              />
              {searching && (
                <Loader2 className="w-4 h-4 text-[#2d6a4f] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            <button
              onClick={handleUseCurrentLocation}
              disabled={loadingLocation}
              title="Use Device GPS Location"
              className="btn-pill btn-primary text-xs px-3.5 py-2.5 flex items-center gap-1.5 whitespace-nowrap shadow-xs font-bold"
            >
              {loadingLocation ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              <span>Use GPS</span>
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-2xl shadow-xl border border-black/10 max-h-56 overflow-y-auto divide-y divide-black/5">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSearchResult(item)}
                  className="p-3 hover:bg-[#2d6a4f]/5 cursor-pointer text-xs flex items-start gap-2.5 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#181a2e] block">{item.address}</span>
                    <span className="text-[11px] text-[#707973] line-clamp-1">{item.display_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real Leaflet Map Container */}
        <div className="relative rounded-2xl overflow-hidden border border-black/10 shadow-inner h-64 sm:h-72">
          <div ref={mapContainerRef} className="w-full h-full" />
          <div className="absolute bottom-2 left-2 z-20 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-semibold text-[#404943] border border-black/5 shadow-xs">
            💡 Click or drag pin to adjust location
          </div>
        </div>

        {/* Selected Address Display Card */}
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-bold text-[#0f5238] uppercase tracking-wider block">
                Selected Delivery Address
              </span>
              <p className="text-xs font-semibold text-[#181a2e]">
                {geocoding ? 'Locating address...' : selectedAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => setChangeModalOpen(false)}
            className="btn-pill btn-outline text-xs px-5 py-2.5 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveLocation}
            disabled={geocoding}
            className="btn-pill btn-primary text-xs px-6 py-2.5 font-bold shadow-md flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Confirm Location</span>
          </button>
        </div>
      </div>
    </div>
  );
}
