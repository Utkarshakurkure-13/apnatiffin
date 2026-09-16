import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Users, 
  ShoppingBag, 
  CalendarCheck, 
  Server, 
  Clock, 
  Lock, 
  Globe, 
  ArrowRight,
  Settings,
  Database,
  Key
} from 'lucide-react';

export default function AdminProfile({ setActiveTab }) {
  const { user, refreshProfile } = useAuth();
  const { t, language, changeLanguage } = useI18n();

  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prefLang, setPrefLang] = useState('en');
  const [feedback, setFeedback] = useState('');

  const fetchAdminProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/admin/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSystemInfo(data.systemInfo);
        if (data.user?.preferred_language) {
          setPrefLang(data.user.preferred_language);
        }
      }
    } catch (err) {
      console.error('Failed to load admin profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminProfile();
  }, []);

  const handleUpdateLanguage = async (newLang) => {
    setPrefLang(newLang);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ preferred_language: newLang })
      });
      if (res.ok) {
        changeLanguage(newLang);
        await refreshProfile();
        setFeedback('Language preference updated.');
        setTimeout(() => setFeedback(''), 2000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
          Platform Administrator Profile
        </h1>
        <p className="text-xs sm:text-sm text-[#404943] mt-1">
          Marketplace operations administrator, system permissions, and superuser access controls.
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-xs font-semibold">
          ✓ {feedback}
        </div>
      )}

      {loading ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-2">
          <Clock className="w-8 h-8 animate-spin mx-auto text-[#2d6a4f]" />
          <p className="text-xs text-[#707973] font-semibold">{t('common.loading')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ADMIN HERO CARD */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl border border-black/5 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div className="w-20 h-20 rounded-3xl bg-white/10 border border-white/20 text-white flex items-center justify-center text-3xl font-black shadow-lg">
                <ShieldAlert className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h2 className="font-heading font-black text-xl sm:text-2xl text-white">
                    Platform Administrator
                  </h2>
                  <span className="badge-pill bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                    Superadmin
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono">
                  {user?.email}
                </p>
                <p className="text-[11px] text-slate-400">
                  Full Root Privileges • Marketplace Governance • Financial Operations
                </p>
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-center gap-2 shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400">Security Clearance</span>
              <span className="badge-pill bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Level 5 Superuser</span>
              </span>
            </div>
          </div>

          {/* SYSTEM OVERVIEW METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div 
              onClick={() => setActiveTab('admin-customers')}
              className="glass-panel p-4 sm:p-5 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <span className="text-[10px] font-bold text-[#707973] uppercase block">Customers</span>
              <div className="text-2xl font-black text-[#181a2e]">{systemInfo?.totalCustomers || 0}</div>
              <span className="text-[10px] text-[#2d6a4f] font-semibold mt-1 flex items-center gap-0.5">
                Manage Users <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            <div 
              onClick={() => setActiveTab('admin-providers')}
              className="glass-panel p-4 sm:p-5 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <span className="text-[10px] font-bold text-[#707973] uppercase block">Home Chefs</span>
              <div className="text-2xl font-black text-[#181a2e]">{systemInfo?.totalProviders || 0}</div>
              <span className="text-[10px] text-[#2d6a4f] font-semibold mt-1 flex items-center gap-0.5">
                Provider Network <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            <div 
              onClick={() => setActiveTab('admin-orders')}
              className="glass-panel p-4 sm:p-5 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <span className="text-[10px] font-bold text-[#707973] uppercase block">Total Orders</span>
              <div className="text-2xl font-black text-[#181a2e]">{systemInfo?.totalOrders || 0}</div>
              <span className="text-[10px] text-[#2d6a4f] font-semibold mt-1 flex items-center gap-0.5">
                Audit Trail <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            <div 
              onClick={() => setActiveTab('admin-settings')}
              className="glass-panel p-4 sm:p-5 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <span className="text-[10px] font-bold text-[#707973] uppercase block">Active Plans</span>
              <div className="text-2xl font-black text-[#181a2e]">{systemInfo?.totalSubscriptions || 0}</div>
              <span className="text-[10px] text-[#2d6a4f] font-semibold mt-1 flex items-center gap-0.5">
                Settings <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* ADMIN SETTINGS & CONTROLS */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl border border-black/5 space-y-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#2d6a4f]" />
                <h3 className="font-heading font-bold text-xl text-[#181a2e]">
                  Administrator Preferences & Environment
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#181a2e] block">
                  Admin Console Language:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateLanguage('en')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      prefLang === 'en' ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-black/10 text-[#404943]'
                    }`}
                  >
                    English (EN)
                  </button>
                  <button
                    onClick={() => handleUpdateLanguage('mr')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      prefLang === 'mr' ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-black/10 text-[#404943]'
                    }`}
                  >
                    मराठी
                  </button>
                  <button
                    onClick={() => handleUpdateLanguage('hi')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      prefLang === 'hi' ? 'bg-[#2d6a4f] text-white' : 'bg-white border border-black/10 text-[#404943]'
                    }`}
                  >
                    हिंदी
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-xs text-[#404943] bg-gray-50 p-4 rounded-2xl border border-black/5">
                <div className="font-bold text-[#181a2e] flex items-center gap-1.5 mb-1">
                  <Database className="w-4 h-4 text-[#2d6a4f]" />
                  <span>Database & System Status</span>
                </div>
                <p>Engine: <span className="font-mono font-bold text-[#181a2e]">SQLite WASM + WAL Mode</span></p>
                <p>Geocoding: <span className="text-emerald-700 font-bold">OSM Nominatim Live</span></p>
                <p>Routing: <span className="text-emerald-700 font-bold">OSRM Real Road Network</span></p>
              </div>
            </div>

            {/* Admin Quick Navigation */}
            <div className="pt-4 border-t border-black/5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setActiveTab('admin-dashboard')}
                className="btn-pill btn-primary text-xs px-4 py-2.5"
              >
                Go to Master Dashboard
              </button>
              <button
                onClick={() => setActiveTab('admin-settings')}
                className="btn-pill btn-outline text-xs px-4 py-2.5"
              >
                Platform Commission & Pricing Rules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
