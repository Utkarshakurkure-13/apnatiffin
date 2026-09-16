import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { useLocationContext } from '../../context/LocationContext';
import { useNotificationContext } from '../../context/NotificationContext';
import NotificationDropdown from './NotificationDropdown';
import { APP_LOGO } from '../../utils/foodImages';
import { 
  Menu as MenuIcon, X, MapPin, Bell, User, 
  Settings, Globe, LogOut, ChevronDown, Utensils
} from 'lucide-react';

export default function Header({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }) {
  const { user, profile, logout, isCustomer, isProvider, isAdmin } = useAuth();
  const { lang, changeLanguage, t } = useI18n();
  const { deliveryLocation, providerLocation, fetchProviderLocation } = useLocationContext();
  const { unreadCount } = useNotificationContext();
  
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Ensure provider location is loaded if logged in as provider
  useEffect(() => {
    if (isProvider && !providerLocation && fetchProviderLocation) {
      fetchProviderLocation();
    }
  }, [isProvider, providerLocation, fetchProviderLocation]);

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  const handleLocationClick = () => {
    if (isProvider) {
      setActiveTab('provider-location');
    } else {
      setActiveTab('customer-location');
    }
  };

  const handleProfileClick = () => {
    if (isCustomer) setActiveTab('customer-profile');
    else if (isProvider) setActiveTab('provider-profile');
    else if (isAdmin) setActiveTab('admin-profile');
    setProfileDropdownOpen(false);
  };

  const handleSettingsClick = () => {
    if (isCustomer) setActiveTab('customer-settings');
    else if (isProvider) setActiveTab('provider-settings');
    else if (isAdmin) setActiveTab('admin-settings');
    setProfileDropdownOpen(false);
  };

  // Determine displayed location text
  const rawAddress = isProvider 
    ? (providerLocation?.address || profile?.kitchen_address)
    : deliveryLocation?.address;

  const displayLocation = rawAddress ? rawAddress.split(',')[0].trim() : 'Detecting...';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass-header h-18">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-3 sm:gap-6">
        {/* Left Side: Hamburger Menu + Location (App branding is in Sidebar) */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          {user ? (
            <>
              {/* Hamburger toggle button */}
              <button
                onClick={() => setSidebarOpen && setSidebarOpen(!sidebarOpen)}
                title="Toggle Menu"
                aria-label="Toggle navigation menu"
                className="w-10 h-10 rounded-2xl bg-white/90 hover:bg-emerald-50 border border-black/10 hover:border-[#2d6a4f]/40 text-[#181a2e] hover:text-[#0f5238] transition-all shadow-2xs cursor-pointer flex items-center justify-center shrink-0 group active:scale-95"
              >
                <MenuIcon className="w-5 h-5 text-[#2d6a4f] group-hover:scale-110 transition-transform" />
              </button>

              {/* Location Display (Clickable to open location page, NO "Change" button, no repeated app title) */}
              <div 
                onClick={handleLocationClick}
                title="Click to view & update location"
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/80 hover:bg-emerald-50/90 border border-black/10 hover:border-[#2d6a4f]/30 cursor-pointer transition-all group max-w-[180px] sm:max-w-[280px] md:max-w-[400px] shadow-2xs"
              >
                <span className="text-emerald-700 text-sm shrink-0 group-hover:scale-110 transition-transform">
                  📍
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#181a2e] group-hover:text-[#2d6a4f] truncate">
                  {displayLocation}
                </span>
              </div>
            </>
          ) : (
            /* Guest Logo & Brand Name */
            <div 
              onClick={() => setActiveTab('landing')} 
              className="flex items-center gap-2.5 cursor-pointer group shrink-0"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#2d6a4f]/10 flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden border border-[#2d6a4f]/20 shadow-xs">
                <img src={APP_LOGO} alt="Aapna Tiffin Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-heading font-extrabold text-base sm:text-lg text-[#0f5238] tracking-tight leading-tight">
                {t('app_name')}
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Notifications + Profile / Login */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {user ? (
            <>
              {/* Notifications Bell */}
              <div className="relative">
                <button
                  onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
                  title="Notifications"
                  aria-label="Notifications"
                  className="w-9 h-9 rounded-full bg-white/80 hover:bg-emerald-50/70 border border-black/8 text-[#181a2e] hover:text-[#0f5238] flex items-center justify-center transition-all shadow-xs relative cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs border border-white animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Panel */}
                <NotificationDropdown 
                  isOpen={notificationPanelOpen} 
                  onClose={() => setNotificationPanelOpen(false)} 
                  setActiveTab={setActiveTab} 
                />
              </div>

              {/* Profile Avatar & Name Area with Dropdown Menu */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/80 hover:bg-emerald-50/70 border border-black/8 shadow-xs transition-all cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-full bg-[#2d6a4f]/15 text-[#2d6a4f] flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-[#2d6a4f] group-hover:text-white transition-colors">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-bold text-[#181a2e] truncate max-w-[110px]">
                      {profile?.full_name || profile?.kitchen_name || user.email.split('@')[0]}
                    </span>
                    <span className="text-[9px] font-semibold text-[#707973] uppercase tracking-wider">
                      {user.role}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#707973] group-hover:text-[#181a2e] transition-transform" />
                </button>

                {/* Profile Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-black/8 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 border-b border-black/5">
                      <p className="text-xs font-bold text-[#181a2e] truncate">
                        {profile?.full_name || profile?.kitchen_name || user.email}
                      </p>
                      <p className="text-[10px] text-[#707973] truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-[#0f5238] border border-emerald-200">
                        {user.role}
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={handleProfileClick}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-[#181a2e] hover:bg-[#2d6a4f]/5 flex items-center gap-2.5 cursor-pointer"
                      >
                        <User className="w-4 h-4 text-[#2d6a4f]" />
                        <span>My Profile</span>
                      </button>

                      <button
                        onClick={handleSettingsClick}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-[#181a2e] hover:bg-[#2d6a4f]/5 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-[#2d6a4f]" />
                        <span>Settings</span>
                      </button>

                      {/* Quick Language Selection inside Profile Dropdown */}
                      <div className="px-4 py-2 border-t border-black/5">
                        <span className="text-[10px] font-bold text-[#707973] uppercase tracking-wider block mb-1.5">
                          Language
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => changeLanguage('en')}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                              lang === 'en' ? 'bg-[#2d6a4f] text-white shadow-2xs' : 'bg-gray-100 text-[#404943] hover:bg-gray-200'
                            }`}
                          >
                            EN
                          </button>
                          <button
                            onClick={() => changeLanguage('mr')}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                              lang === 'mr' ? 'bg-[#2d6a4f] text-white shadow-2xs' : 'bg-gray-100 text-[#404943] hover:bg-gray-200'
                            }`}
                          >
                            मराठी
                          </button>
                          <button
                            onClick={() => changeLanguage('hi')}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                              lang === 'hi' ? 'bg-[#2d6a4f] text-white shadow-2xs' : 'bg-gray-100 text-[#404943] hover:bg-gray-200'
                            }`}
                          >
                            हिंदी
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-black/5 pt-1">
                      <button
                        onClick={() => {
                          logout();
                          setActiveTab('landing');
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('landing')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#404943] hover:text-[#181a2e] hover:bg-black/5 cursor-pointer"
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>{t('nav.explore') || 'Explore'}</span>
              </button>

              <button
                onClick={() => setActiveTab('common-login')}
                className="btn-pill btn-primary text-xs sm:text-sm px-4 sm:px-5 py-2 cursor-pointer"
              >
                <span>{t('nav.login') || 'Login'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
