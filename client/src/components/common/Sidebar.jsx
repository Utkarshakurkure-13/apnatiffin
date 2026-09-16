import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { APP_LOGO } from '../../utils/foodImages';
import { 
  LayoutDashboard, ShoppingBag, CalendarCheck, Receipt, 
  Sparkles, Settings, Truck, Target, MapPin, 
  UtensilsCrossed, IndianRupee, Users, Store, LogOut, 
  X, ChevronRight, User
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen }) {
  const { user, profile, logout, isCustomer, isProvider, isAdmin } = useAuth();
  const { t } = useI18n();

  // Close sidebar on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && sidebarOpen && setSidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, setSidebarOpen]);

  if (!user) return null;

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    if (setSidebarOpen) {
      setSidebarOpen(false);
    }
  };

  const handleProfileNav = () => {
    if (isCustomer) setActiveTab('customer-profile');
    else if (isProvider) setActiveTab('provider-profile');
    else if (isAdmin) setActiveTab('admin-profile');
    if (setSidebarOpen) setSidebarOpen(false);
  };

  // Role Navigation Configs
  const customerNavItems = [
    { id: 'customer-dashboard', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard },
    { id: 'customer-orders', label: t('nav.orders') || 'Orders', icon: ShoppingBag },
    { id: 'customer-subscriptions', label: t('nav.subscriptions') || 'Subscriptions', icon: CalendarCheck },
    { id: 'customer-bills', label: t('nav.bills') || 'Bills & Finance', icon: Receipt },
    { id: 'customer-points', label: t('nav.points') || 'Rewards & Points', icon: Sparkles },
  ];

  const providerNavItems = [
    { id: 'provider-dashboard', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard },
    { id: 'provider-delivery-route', label: "Today's Delivery Route", icon: Truck },
    { id: 'provider-orders', label: t('nav.todays_orders') || 'Orders', icon: ShoppingBag },
    { id: 'provider-service-area', label: 'My Service Area', icon: Target },
    { id: 'provider-location', label: 'Kitchen Location & Map', icon: MapPin },
    { id: 'provider-menu', label: t('nav.menu') || 'Menu Management', icon: UtensilsCrossed },
    { id: 'provider-earnings', label: t('nav.earnings') || 'Earnings & Payouts', icon: IndianRupee },
    { id: 'provider-customers', label: t('nav.customers') || 'Customer Directory', icon: Users },
  ];

  const adminNavItems = [
    { id: 'admin-dashboard', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard },
    { id: 'admin-customers', label: t('nav.customers') || 'Customers', icon: Users },
    { id: 'admin-providers', label: t('nav.providers') || 'Providers', icon: Store },
    { id: 'admin-orders', label: t('nav.orders') || 'Orders & Transactions', icon: ShoppingBag },
  ];

  const navItems = isCustomer 
    ? customerNavItems 
    : (isProvider ? providerNavItems : (isAdmin ? adminNavItems : []));

  const settingsTabId = isCustomer 
    ? 'customer-settings' 
    : (isProvider ? 'provider-settings' : 'admin-settings');

  const isSettingsActive = activeTab === settingsTabId;

  return (
    <>
      {/* Backdrop Overlay for all screen sizes */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-45 animate-in fade-in transition-opacity"
        />
      )}

      {/* Sidebar Container (Collapsed by default on all screens, slides in when open) */}
      <aside className={`
        fixed top-0 bottom-0 left-0 w-72 bg-white/98 backdrop-blur-md border-r border-black/8 z-50
        flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Top Branding Section in Sidebar */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-black/5">
          <div 
            onClick={() => handleNavClick(isCustomer ? 'customer-dashboard' : (isProvider ? 'provider-dashboard' : 'admin-dashboard'))}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-2xl bg-[#2d6a4f]/10 flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden border border-[#2d6a4f]/20 shadow-xs">
              <img src={APP_LOGO} alt="Aapna Tiffin Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-base text-[#0f5238] tracking-tight leading-tight">
                {t('app_name')}
              </span>
              <span className="text-[10px] font-bold text-[#e07a5f] uppercase tracking-wider">
                {isCustomer ? 'Customer Portal' : (isProvider ? 'Provider Portal' : 'Admin Console')}
              </span>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            title="Close navigation sidebar"
            className="p-1.5 rounded-xl hover:bg-black/5 text-[#707973] hover:text-[#181a2e] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="text-[11px] font-bold text-[#707973] uppercase tracking-wider px-3 mb-2">
            Navigation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#2d6a4f] text-white shadow-sm'
                    : 'text-[#404943] hover:text-[#181a2e] hover:bg-black/5'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-white scale-105' : 'text-[#2d6a4f]'}`} />
                <span className="truncate flex-1">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                )}
              </button>
            );
          })}

          {/* Divider */}
          <div className="pt-3 pb-2 px-3">
            <hr className="border-black/8" />
          </div>

          <div className="text-[11px] font-bold text-[#707973] uppercase tracking-wider px-3 mb-1">
            Preferences
          </div>

          {/* Settings Nav Item */}
          <button
            onClick={() => handleNavClick(settingsTabId)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left ${
              isSettingsActive
                ? 'bg-[#2d6a4f] text-white shadow-sm'
                : 'text-[#404943] hover:text-[#181a2e] hover:bg-black/5'
            }`}
          >
            <Settings className={`w-4 h-4 shrink-0 transition-transform ${isSettingsActive ? 'text-white scale-105' : 'text-[#2d6a4f]'}`} />
            <span className="truncate flex-1">{t('nav.settings') || 'Settings'}</span>
            {isSettingsActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
            )}
          </button>
        </div>

        {/* Bottom User Profile Section */}
        <div className="p-3 border-t border-black/8 bg-gray-50/70 space-y-2">
          <div 
            onClick={handleProfileNav}
            className="flex items-center gap-2.5 p-2 rounded-2xl hover:bg-white transition-all cursor-pointer border border-transparent hover:border-black/5 group"
          >
            <div className="w-8 h-8 rounded-full bg-[#2d6a4f]/15 text-[#2d6a4f] flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-[#2d6a4f] group-hover:text-white transition-colors">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-[#181a2e] truncate group-hover:text-[#2d6a4f]">
                {profile?.full_name || profile?.kitchen_name || user.email.split('@')[0]}
              </span>
              <span className="text-[10px] text-[#707973] uppercase tracking-wider font-semibold">
                {user.role}
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#707973] group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>

          <button
            onClick={() => { logout(); setActiveTab('landing'); if (setSidebarOpen) setSidebarOpen(false); }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('nav.logout') || 'Log Out'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
