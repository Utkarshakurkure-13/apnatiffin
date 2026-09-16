import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { useLocationContext } from '../../context/LocationContext';
import { 
  Settings, Globe, User, MapPin, LogOut, CheckCircle2, 
  ShieldCheck, Bell, ChevronRight, Sparkles 
} from 'lucide-react';

export default function CustomerSettings({ setActiveTab }) {
  const { user, profile, logout } = useAuth();
  const { lang, changeLanguage, t } = useI18n();
  const { deliveryLocation } = useLocationContext();
  const [successMsg, setSuccessMsg] = useState('');

  const handleLanguageChange = (newLang) => {
    changeLanguage(newLang);
    setSuccessMsg(newLang === 'mr' ? 'भाषा मराठी निवडली आहे!' : (newLang === 'hi' ? 'भाषा हिंदी चुनी गई है!' : 'Language changed to English!'));
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl border border-black/5 bg-gradient-to-r from-emerald-50/60 via-white to-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#2d6a4f]/15 text-[#2d6a4f] flex items-center justify-center shadow-xs">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
              {t('nav.settings') || 'Settings'}
            </h1>
            <p className="text-xs sm:text-sm text-[#404943]">
              Manage your language preferences, delivery details, and account settings
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl flex items-center gap-2.5 text-sm font-bold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Settings Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Language Preferences */}
        <div className="glass-panel p-6 rounded-3xl shadow-xl space-y-4 border border-black/5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-black/5">
            <Globe className="w-5 h-5 text-[#2d6a4f]" />
            <h2 className="font-heading font-bold text-base text-[#181a2e]">
              Language / भाषा
            </h2>
          </div>
          <p className="text-xs text-[#707973]">
            Select your preferred display language for Aapna Tiffin:
          </p>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`p-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                lang === 'en'
                  ? 'bg-[#2d6a4f] text-white border-[#2d6a4f] shadow-md scale-[1.02]'
                  : 'bg-white border-black/10 text-[#181a2e] hover:bg-black/5'
              }`}
            >
              <span className="text-base">🇬🇧</span>
              <span>English</span>
              {lang === 'en' && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">Active</span>}
            </button>

            <button
              onClick={() => handleLanguageChange('mr')}
              className={`p-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                lang === 'mr'
                  ? 'bg-[#2d6a4f] text-white border-[#2d6a4f] shadow-md scale-[1.02]'
                  : 'bg-white border-black/10 text-[#181a2e] hover:bg-black/5'
              }`}
            >
              <span className="text-base">🚩</span>
              <span>मराठी</span>
              {lang === 'mr' && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">सक्रिय</span>}
            </button>

            <button
              onClick={() => handleLanguageChange('hi')}
              className={`p-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                lang === 'hi'
                  ? 'bg-[#2d6a4f] text-white border-[#2d6a4f] shadow-md scale-[1.02]'
                  : 'bg-white border-black/10 text-[#181a2e] hover:bg-black/5'
              }`}
            >
              <span className="text-base">🇮🇳</span>
              <span>हिंदी</span>
              {lang === 'hi' && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">सक्रिय</span>}
            </button>
          </div>
        </div>

        {/* 2. Account & Profile Quick Link */}
        <div className="glass-panel p-6 rounded-3xl shadow-xl space-y-4 border border-black/5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 pb-2 border-b border-black/5">
              <User className="w-5 h-5 text-[#2d6a4f]" />
              <h2 className="font-heading font-bold text-base text-[#181a2e]">
                Account & Profile
              </h2>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#181a2e]">
                {profile?.full_name || user?.email}
              </p>
              <p className="text-xs text-[#707973]">
                {user?.email} • {profile?.mobile || 'No mobile linked'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('customer-profile')}
            className="w-full btn-pill btn-primary text-xs py-2.5 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Edit Full Profile</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 3. Delivery Location Shortcut */}
        <div className="glass-panel p-6 rounded-3xl shadow-xl space-y-4 border border-black/5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 pb-2 border-b border-black/5">
              <MapPin className="w-5 h-5 text-[#2d6a4f]" />
              <h2 className="font-heading font-bold text-base text-[#181a2e]">
                Saved Delivery Location
              </h2>
            </div>
            <p className="text-xs font-semibold text-[#181a2e] line-clamp-2">
              {deliveryLocation?.address || profile?.delivery_address || 'No location saved yet'}
            </p>
          </div>

          <button
            onClick={() => setActiveTab('customer-location')}
            className="w-full btn-pill bg-[#2d6a4f]/10 hover:bg-[#2d6a4f]/20 text-[#0f5238] text-xs py-2.5 flex items-center justify-center gap-2 cursor-pointer font-bold transition-all"
          >
            <span>Update Delivery Location</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 4. Session & Logout */}
        <div className="glass-panel p-6 rounded-3xl shadow-xl space-y-4 border border-rose-100 bg-gradient-to-b from-white to-rose-50/30 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 pb-2 border-b border-rose-100">
              <LogOut className="w-5 h-5 text-rose-600" />
              <h2 className="font-heading font-bold text-base text-rose-950">
                Session & Logout
              </h2>
            </div>
            <p className="text-xs text-[#707973]">
              Sign out from your Aapna Tiffin customer session on this device.
            </p>
          </div>

          <button
            onClick={() => { logout(); setActiveTab('landing'); }}
            className="w-full btn-pill bg-rose-600 hover:bg-rose-700 text-white text-xs py-2.5 flex items-center justify-center gap-2 cursor-pointer font-bold shadow-md transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
