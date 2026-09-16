import React from 'react';
import { useLocationContext } from '../../context/LocationContext';
import { MapPin, ShieldCheck, Navigation, CheckCircle2, X } from 'lucide-react';

export default function LocationPermissionModal() {
  const {
    permissionModalOpen,
    loadingLocation,
    locationError,
    requestDeviceLocation,
    dismissPermissionModal
  } = useLocationContext();

  if (!permissionModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-white/80 space-y-6 relative">
        {/* Close icon for manual dismiss */}
        <button
          onClick={dismissPermissionModal}
          className="absolute top-4 right-4 p-2 rounded-full text-[#707973] hover:text-[#181a2e] hover:bg-black/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#2d6a4f]/15 text-[#2d6a4f] flex items-center justify-center">
            <MapPin className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-xl text-[#181a2e]">
              Allow Location Access
            </h3>
            <span className="text-xs text-[#707973] font-semibold">
              Find fresh homestyle tiffins near you
            </span>
          </div>
        </div>

        {/* Value Proposition Points */}
        <div className="space-y-3 bg-white/70 p-4 rounded-2xl border border-black/5 text-xs sm:text-sm text-[#404943]">
          <p className="font-semibold text-[#181a2e] mb-1">We use your location to:</p>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
              <span>Find providers serving your area</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
              <span>Show available tiffin providers near you</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
              <span>Check provider delivery coverage & radius</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
              <span>Help providers plan quick, efficient delivery routes</span>
            </li>
          </ul>
        </div>

        {locationError && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{locationError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => requestDeviceLocation(true)}
            disabled={loadingLocation}
            className="btn-pill btn-primary flex-1 py-3 text-sm font-bold shadow-lg flex items-center justify-center gap-2"
          >
            {loadingLocation ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Detecting Location...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>Allow Location</span>
              </>
            )}
          </button>

          <button
            onClick={dismissPermissionModal}
            disabled={loadingLocation}
            className="btn-pill btn-outline py-3 px-5 text-sm font-semibold hover:bg-black/5"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
