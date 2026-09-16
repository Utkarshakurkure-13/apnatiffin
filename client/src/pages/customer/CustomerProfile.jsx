import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  ShoppingBag, 
  CalendarCheck, 
  Sparkles, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CustomerProfile({ setActiveTab }) {
  const { user, profile, refreshProfile } = useAuth();
  const { t, language, changeLanguage } = useI18n();

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [prefLang, setPrefLang] = useState('en');
  
  const [stats, setStats] = useState({
    activeOrdersCount: 0,
    totalOrdersCount: 0,
    activeSubsCount: 0,
    availablePoints: 0
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/customer/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setFullName(data.profile.full_name || '');
          setMobile(data.profile.mobile || '');
          setDeliveryAddress(data.profile.delivery_address || '');
        }
        if (data.user) {
          setPrefLang(data.user.preferred_language || 'en');
        }
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load profile data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: fullName,
          mobile,
          delivery_address: deliveryAddress,
          preferred_language: prefLang
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      if (prefLang !== language) {
        changeLanguage(prefLang);
      }

      await refreshProfile();
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      setFeedback({ type: 'success', message: 'Profile details updated successfully!' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
          My Customer Profile
        </h1>
        <p className="text-xs sm:text-sm text-[#404943] mt-1">
          Manage your personal information, delivery location address, and view account activity.
        </p>
      </div>

      {feedback.message && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback({ type: '', message: '' })} className="font-bold opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {loading ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-2">
          <Clock className="w-8 h-8 animate-spin mx-auto text-[#2d6a4f]" />
          <p className="text-xs text-[#707973] font-semibold">{t('common.loading')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* USER HERO CARD */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl border border-black/5 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 bg-gradient-to-r from-emerald-50/40 via-white to-amber-50/30">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div className="w-20 h-20 rounded-3xl bg-[#2d6a4f] text-white flex items-center justify-center text-3xl font-black shadow-lg shadow-[#2d6a4f]/20">
                {(fullName || user?.email || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h2 className="font-heading font-black text-xl sm:text-2xl text-[#181a2e]">
                    {fullName || profile?.full_name || 'Valued Customer'}
                  </h2>
                  <span className="badge-pill bg-[#2d6a4f] text-white text-[10px] font-bold uppercase tracking-wider">
                    Customer
                  </span>
                </div>
                <p className="text-xs text-[#404943] flex items-center justify-center sm:justify-start gap-1.5 font-medium">
                  <Mail className="w-3.5 h-3.5 text-[#707973]" />
                  <span>{user?.email}</span>
                </p>
                <p className="text-xs text-[#707973] flex items-center justify-center sm:justify-start gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#707973]" />
                  <span>{mobile || profile?.mobile || 'No mobile linked'}</span>
                </p>
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-center gap-2 shrink-0">
              <span className="text-[10px] uppercase font-bold text-[#707973]">Account Status</span>
              <span className="badge-pill bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Active</span>
              </span>
            </div>
          </div>

          {/* QUICK METRICS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div 
              onClick={() => setActiveTab('customer-orders')}
              className="glass-panel p-4 sm:p-5 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between text-[#707973] mb-1">
                <span className="text-[11px] font-bold uppercase">Active Orders</span>
                <ShoppingBag className="w-4 h-4 text-[#2d6a4f]" />
              </div>
              <div className="text-2xl font-black text-[#181a2e]">{stats.activeOrdersCount}</div>
              <span className="text-[10px] text-[#2d6a4f] font-semibold flex items-center gap-0.5 mt-1">
                Track Live <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            <div 
              onClick={() => setActiveTab('customer-subscriptions')}
              className="glass-panel p-4 sm:p-5 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between text-[#707973] mb-1">
                <span className="text-[11px] font-bold uppercase">Subscriptions</span>
                <CalendarCheck className="w-4 h-4 text-[#e07a5f]" />
              </div>
              <div className="text-2xl font-black text-[#181a2e]">{stats.activeSubsCount}</div>
              <span className="text-[10px] text-[#e07a5f] font-semibold flex items-center gap-0.5 mt-1">
                View Calendar <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            <div 
              onClick={() => setActiveTab('customer-points')}
              className="glass-panel p-4 sm:p-5 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between text-[#707973] mb-1">
                <span className="text-[11px] font-bold uppercase">Loyalty Points</span>
                <Sparkles className="w-4 h-4 text-[#e9c46a]" />
              </div>
              <div className="text-2xl font-black text-[#181a2e]">{stats.availablePoints}</div>
              <span className="text-[10px] text-[#775b06] font-semibold flex items-center gap-0.5 mt-1">
                Redeem Rewards <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            <div 
              onClick={() => setActiveTab('customer-orders')}
              className="glass-panel p-4 sm:p-5 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between text-[#707973] mb-1">
                <span className="text-[11px] font-bold uppercase">Total Orders</span>
                <ShoppingBag className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-black text-[#181a2e]">{stats.totalOrdersCount}</div>
              <span className="text-[10px] text-[#707973] font-semibold flex items-center gap-0.5 mt-1">
                Order History <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* EDIT PROFILE FORM */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl border border-black/5 space-y-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-[#2d6a4f]" />
                <h3 className="font-heading font-bold text-xl text-[#181a2e]">
                  Personal & Delivery Details
                </h3>
              </div>
              <span className="text-xs text-[#707973] font-semibold">Editable Profile Fields</span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                    Full Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rohit Patil"
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm text-[#181a2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                    Mobile Number (For OTP & Delivery Call):
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm text-[#181a2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1.5 flex items-center justify-between">
                  <span>Primary Doorstep Delivery Address:</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('customer-location')}
                    className="text-[11px] text-[#2d6a4f] hover:underline font-semibold flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Open Live Map</span>
                  </button>
                </label>
                <textarea
                  rows={3}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Flat No, Building, Street, Landmark, Area, City"
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm text-[#181a2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                    Registered Email (Read Only):
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full px-4 py-3 rounded-2xl bg-gray-100 border border-black/10 text-xs sm:text-sm text-gray-500 cursor-not-allowed font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                    Preferred UI Language:
                  </label>
                  <select
                    value={prefLang}
                    onChange={(e) => setPrefLang(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm text-[#181a2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                  >
                    <option value="en">English (EN)</option>
                    <option value="mr">मराठी (Marathi)</option>
                    <option value="hi">हिंदी (Hindi)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-black/5">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-pill btn-primary px-6 py-3 text-xs sm:text-sm flex items-center gap-2 shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
