import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { Sliders, Save, AlertTriangle, ShieldCheck, CheckCircle2, Globe, LogOut } from 'lucide-react';

export default function AdminSettings({ setActiveTab }) {
  const { user, logout } = useAuth();
  const { lang, changeLanguage, t } = useI18n();
  const [settings, setSettings] = useState({
    platform_commission_percent: '15',
    provider_late_cancellation_penalty_percent: '20',
    customer_early_cancellation_deduction_percent: '10',
    delivery_failure_penalty_percent: '20',
    delivery_failure_penalty_points: '10',
    reward_point_threshold: '100',
    min_order_advance_hours: '3'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('aapna_tiffin_token');
    fetch('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load settings', err);
        setLoading(false);
      });
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings })
      });
      if (!res.ok) throw new Error('Failed to update settings');
      setSuccessMsg('Platform business parameters saved successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
          {t('admin.settings_tab')}
        </h1>
        <p className="text-xs sm:text-sm text-[#404943]">
          Configure authoritative platform commission rates, cancellation penalty percentages, and milestone reward parameters.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {successMsg}
          </span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[#707973] font-semibold">{t('common.loading')}</div>
      ) : (
        <form onSubmit={handleSave} className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl space-y-6 border border-black/5">
          {/* Section 1: Platform Commission */}
          <div className="space-y-4 pb-6 border-b border-black/5">
            <h3 className="font-heading font-bold text-lg text-[#181a2e]">
              1. Platform Commission
            </h3>
            <div>
              <label className="text-xs font-bold text-[#181a2e] uppercase tracking-wider block mb-1">
                {t('admin.commission_setting')}
              </label>
              <input
                type="number"
                step="0.5"
                value={settings.platform_commission_percent}
                onChange={(e) => handleChange('platform_commission_percent', e.target.value)}
                className="w-full sm:w-48 px-4 py-2.5 rounded-2xl bg-white border border-black/10 text-sm font-bold text-[#181a2e]"
              />
              <span className="text-xs text-[#707973] block mt-1">
                Deducted automatically from Gross Sales for provider settlement. (Default: 15%)
              </span>
            </div>
          </div>

          {/* Section 2: Cancellation & Penalties */}
          <div className="space-y-4 pb-6 border-b border-black/5">
            <h3 className="font-heading font-bold text-lg text-[#181a2e]">
              2. Cancellation & Penalty Rules
            </h3>

            {/* Configurable Conflict: 20% vs 30% */}
            <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{t('admin.pending_decision_note')}</span>
              </div>
              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1">
                  {t('admin.penalty_setting')}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={settings.provider_late_cancellation_penalty_percent}
                    onChange={(e) => handleChange('provider_late_cancellation_penalty_percent', e.target.value)}
                    className="w-36 px-4 py-2 rounded-xl bg-white border border-amber-300 text-sm font-bold font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleChange('provider_late_cancellation_penalty_percent', '20')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${settings.provider_late_cancellation_penalty_percent === '20' ? 'bg-amber-600 text-white' : 'bg-white text-amber-900 border'}`}
                    >
                      Set 20%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange('provider_late_cancellation_penalty_percent', '30')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${settings.provider_late_cancellation_penalty_percent === '30' ? 'bg-amber-600 text-white' : 'bg-white text-amber-900 border'}`}
                    >
                      Set 30%
                    </button>
                  </div>
                </div>
                <span className="text-[11px] text-amber-800 block mt-1">
                  Applied when a kitchen cancels an order after 1 hour (+20 points customer compensation).
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1">
                  Customer Early Cancellation Deduction (%)
                </label>
                <input
                  type="number"
                  value={settings.customer_early_cancellation_deduction_percent}
                  onChange={(e) => handleChange('customer_early_cancellation_deduction_percent', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-black/10 text-sm font-bold"
                />
                <span className="text-[11px] text-[#707973] mt-1 block">Deduction if cancelled within 1 hour (Default: 10%)</span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1">
                  Delivery Failure Penalty (%)
                </label>
                <input
                  type="number"
                  value={settings.delivery_failure_penalty_percent}
                  onChange={(e) => handleChange('delivery_failure_penalty_percent', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-black/10 text-sm font-bold"
                />
                <span className="text-[11px] text-[#707973] mt-1 block">Penalty deducted on unfulfilled delivery (Default: 20%)</span>
              </div>
            </div>
          </div>

          {/* Section 3: Rewards & Advance Window */}
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-lg text-[#181a2e]">
              3. Loyalty Milestones & Timing Controls
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1">
                  Reward Milestone Threshold (Points)
                </label>
                <input
                  type="number"
                  value={settings.reward_point_threshold}
                  onChange={(e) => handleChange('reward_point_threshold', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-black/10 text-sm font-bold"
                />
                <span className="text-[11px] text-[#707973] mt-1 block">Points needed for 1 Free Meal voucher (Default: 100)</span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1">
                  Minimum Advance Ordering Window (Hours)
                </label>
                <input
                  type="number"
                  value={settings.min_order_advance_hours}
                  onChange={(e) => handleChange('min_order_advance_hours', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-black/10 text-sm font-bold"
                />
                <span className="text-[11px] text-[#707973] mt-1 block">Enforced server-side before delivery slot (Default: 3 hrs)</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto btn-pill btn-primary px-8 py-3.5 text-sm font-bold shadow-lg cursor-pointer"
          >
            {saving ? t('common.loading') : (
              <>
                <Save className="w-4 h-4" />
                <span>{t('admin.save_settings')}</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Language Preferences & Session for Admin */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <div className="glass-panel p-6 rounded-3xl shadow-xl space-y-4 border border-black/5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-black/5">
            <Globe className="w-5 h-5 text-[#2d6a4f]" />
            <h2 className="font-heading font-bold text-base text-[#181a2e]">
              Display Language / भाषा
            </h2>
          </div>
          <p className="text-xs text-[#707973]">
            Select your preferred display language for Aapna Tiffin Admin:
          </p>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <button
              onClick={() => changeLanguage('en')}
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
              onClick={() => changeLanguage('mr')}
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
              onClick={() => changeLanguage('hi')}
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

        <div className="glass-panel p-6 rounded-3xl shadow-xl space-y-4 border border-rose-100 bg-gradient-to-b from-white to-rose-50/30 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 pb-2 border-b border-rose-100">
              <LogOut className="w-5 h-5 text-rose-600" />
              <h2 className="font-heading font-bold text-base text-rose-950">
                Admin Session & Logout
              </h2>
            </div>
            <p className="text-xs text-[#707973]">
              Sign out from your Aapna Tiffin administrative session on this device.
            </p>
          </div>

          <button
            onClick={() => { logout(); if (setActiveTab) setActiveTab('landing'); }}
            className="w-full btn-pill bg-rose-600 hover:bg-rose-700 text-white text-xs py-2.5 flex items-center justify-center gap-2 cursor-pointer font-bold shadow-md transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out Admin Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
