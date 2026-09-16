import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { getProviderBannerImage } from '../../utils/foodImages';
import { 
  ChefHat, 
  Store, 
  Phone, 
  MapPin, 
  Clock, 
  Star, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Building2, 
  Truck, 
  DollarSign,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ProviderProfile({ setActiveTab }) {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useI18n();

  const [providerName, setProviderName] = useState('');
  const [kitchenName, setKitchenName] = useState('');
  const [mobile, setMobile] = useState('');
  const [kitchenAddress, setKitchenAddress] = useState('');
  const [foodType, setFoodType] = useState('Veg');
  const [experienceYears, setExperienceYears] = useState(1);
  const [bio, setBio] = useState('');
  const [isOpen, setIsOpen] = useState(1);

  const [fssai, setFssai] = useState(null);
  const [bank, setBank] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [location, setLocation] = useState(null);
  const [serviceArea, setServiceArea] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/provider/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProviderName(data.profile.provider_name || '');
          setKitchenName(data.profile.kitchen_name || '');
          setMobile(data.profile.mobile || '');
          setKitchenAddress(data.profile.kitchen_address || '');
          setFoodType(data.profile.food_type || 'Veg');
          setExperienceYears(data.profile.experience_years || 1);
          setBio(data.profile.bio || '');
          setIsOpen(data.profile.is_open ?? 1);
        }
        setFssai(data.fssai);
        setBank(data.bank);
        setPricing(data.pricing);
        setLocation(data.location);
        setServiceArea(data.serviceArea);
      }
    } catch (err) {
      console.error('Failed to load provider profile', err);
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
      const res = await fetch('/api/provider/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider_name: providerName,
          kitchen_name: kitchenName,
          mobile,
          kitchen_address: kitchenAddress,
          food_type: foodType,
          experience_years: parseInt(experienceYears, 10),
          bio,
          is_open: isOpen
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update provider profile');

      await refreshProfile();
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      setFeedback({ type: 'success', message: 'Kitchen & Chef profile updated successfully!' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const bannerImg = getProviderBannerImage({ kitchen_name: kitchenName, food_type: foodType });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
          Home Chef & Kitchen Profile
        </h1>
        <p className="text-xs sm:text-sm text-[#404943] mt-1">
          Manage your kitchen branding, chef bio, food category, and view compliance & service details.
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
          {/* PROVIDER HERO CARD */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl border border-black/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-gradient-to-r from-emerald-50/40 via-white to-amber-50/30">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-black/10 shadow-lg shrink-0">
                <img src={bannerImg} alt={kitchenName} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h2 className="font-heading font-black text-xl sm:text-2xl text-[#181a2e]">
                    {kitchenName || 'My Tiffin Center'}
                  </h2>
                  <span className="badge-pill bg-[#2d6a4f] text-white text-[10px] font-bold uppercase">
                    Provider
                  </span>
                  <span className="badge-pill bg-amber-100 text-amber-900 text-[10px] font-bold">
                    {foodType} Cuisine
                  </span>
                </div>
                <p className="text-xs text-[#404943] font-semibold flex items-center justify-center sm:justify-start gap-1.5">
                  <ChefHat className="w-4 h-4 text-[#2d6a4f]" />
                  <span>Chef: {providerName} • {experienceYears}+ yrs experience</span>
                </p>
                <p className="text-xs text-[#707973] flex items-center justify-center sm:justify-start gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#707973]" />
                  <span>{mobile} • {user?.email}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-black/5">
              <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                <Star className="w-4 h-4 text-[#e9c46a] fill-current" />
                <span className="text-xs font-black text-amber-950">{profile?.total_reviews > 0 ? profile?.rating_avg : '0.0'}</span>
                <span className="text-[10px] text-[#707973]">({profile?.total_reviews || 0} reviews)</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`badge-pill text-[10px] font-bold ${
                  isOpen ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  {isOpen ? '● Open For Orders' : '○ Kitchen Closed'}
                </span>
              </div>
            </div>
          </div>

          {/* SHORTCUTS BAR */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button
              onClick={() => setActiveTab('provider-menu')}
              className="glass-panel p-4 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 text-left transition-all hover:-translate-y-0.5"
            >
              <span className="text-[10px] font-bold text-[#707973] uppercase block">Manage</span>
              <span className="font-heading font-bold text-sm text-[#181a2e] block">Daily Menu</span>
              <span className="text-[10px] text-[#2d6a4f] font-semibold mt-1 flex items-center gap-0.5">
                Update Items <ArrowRight className="w-3 h-3" />
              </span>
            </button>

            <button
              onClick={() => setActiveTab('provider-delivery-route')}
              className="glass-panel p-4 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 text-left transition-all hover:-translate-y-0.5"
            >
              <span className="text-[10px] font-bold text-[#707973] uppercase block">Navigation</span>
              <span className="font-heading font-bold text-sm text-[#181a2e] block">Delivery Route</span>
              <span className="text-[10px] text-[#2d6a4f] font-semibold mt-1 flex items-center gap-0.5">
                OSRM Map <ArrowRight className="w-3 h-3" />
              </span>
            </button>

            <button
              onClick={() => setActiveTab('provider-service-area')}
              className="glass-panel p-4 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 text-left transition-all hover:-translate-y-0.5"
            >
              <span className="text-[10px] font-bold text-[#707973] uppercase block">Geofence</span>
              <span className="font-heading font-bold text-sm text-[#181a2e] block">Service Area</span>
              <span className="text-[10px] text-[#2d6a4f] font-semibold mt-1 flex items-center gap-0.5">
                {serviceArea?.radius_km || 5} KM Radius <ArrowRight className="w-3 h-3" />
              </span>
            </button>

            <button
              onClick={() => setActiveTab('provider-earnings')}
              className="glass-panel p-4 rounded-2xl shadow-xs border border-black/5 hover:border-[#2d6a4f]/40 text-left transition-all hover:-translate-y-0.5"
            >
              <span className="text-[10px] font-bold text-[#707973] uppercase block">Finance</span>
              <span className="font-heading font-bold text-sm text-[#181a2e] block">Earnings & Payouts</span>
              <span className="text-[10px] text-[#2d6a4f] font-semibold mt-1 flex items-center gap-0.5">
                View Ledger <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          </div>

          {/* EDIT PROVIDER FORM */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl border border-black/5 space-y-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-[#2d6a4f]" />
                <h3 className="font-heading font-bold text-xl text-[#181a2e]">
                  Kitchen & Chef Information
                </h3>
              </div>
              <span className="text-xs text-[#707973] font-semibold">Editable Kitchen Profile</span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                    Home Kitchen Name (Brand):
                  </label>
                  <input
                    type="text"
                    required
                    value={kitchenName}
                    onChange={(e) => setKitchenName(e.target.value)}
                    placeholder="e.g. Swad Maharashtra Tiffin Center"
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm text-[#181a2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                    Chef Full Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="e.g. Anita Patil"
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm text-[#181a2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                    Contact Mobile:
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

                <div>
                  <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                    Food Cuisine Category:
                  </label>
                  <select
                    value={foodType}
                    onChange={(e) => setFoodType(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm text-[#181a2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                  >
                    <option value="Veg">Veg (Pure Vegetarian)</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Both">Both (Veg & Non-Veg)</option>
                    <option value="Jain Available">Jain Available</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                    Cooking Experience (Years):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm text-[#181a2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                  Kitchen Address (Pickup / Geofence Anchor):
                </label>
                <textarea
                  rows={2}
                  value={kitchenAddress}
                  onChange={(e) => setKitchenAddress(e.target.value)}
                  placeholder="Plot/Flat, Building, Area, Landmark, City"
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm text-[#181a2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1.5">
                  Chef Bio / Speciality Story:
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell customers about your cooking style, signature dishes, cleanliness, and spices."
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-black/10 text-xs sm:text-sm text-[#181a2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-black/5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-[#181a2e] block">Kitchen Open for Daily Orders:</span>
                  <span className="text-[11px] text-[#707973]">When closed, your kitchen will not appear in customer lunch/dinner discovery.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(isOpen ? 0 : 1)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    isOpen ? 'bg-[#2d6a4f] text-white shadow-xs' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {isOpen ? 'Open (Active)' : 'Closed'}
                </button>
              </div>

              <div className="flex justify-end pt-4 border-t border-black/5">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-pill btn-primary px-6 py-3 text-xs sm:text-sm flex items-center gap-2 shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Kitchen Profile'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* COMPLIANCE & BANKING SUMMARY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-3xl shadow-md border border-black/5 space-y-3">
              <div className="flex items-center gap-2 text-[#2d6a4f]">
                <FileText className="w-5 h-5" />
                <h4 className="font-heading font-bold text-base text-[#181a2e]">FSSAI Compliance</h4>
              </div>
              <div className="text-xs text-[#404943] space-y-1.5">
                <p>Status: <span className="font-bold text-emerald-700">{fssai?.has_fssai ? '✓ Registered' : 'Exempt / Basic'}</span></p>
                <p>License No: <span className="font-mono font-bold text-[#181a2e]">{fssai?.fssai_number || 'NA-HOME-CHEF'}</span></p>
                <p>Food Safety: <span className="text-[#707973]">Daily hygienic home-cooked preparation</span></p>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl shadow-md border border-black/5 space-y-3">
              <div className="flex items-center gap-2 text-[#2d6a4f]">
                <Building2 className="w-5 h-5" />
                <h4 className="font-heading font-bold text-base text-[#181a2e]">Settlement Bank Account</h4>
              </div>
              <div className="text-xs text-[#404943] space-y-1.5">
                <p>Holder: <span className="font-bold text-[#181a2e]">{bank?.account_holder || providerName}</span></p>
                <p>Account: <span className="font-mono font-bold text-[#181a2e]">{bank?.account_number_masked || 'XXXX-XXXX-8921'}</span></p>
                <p>IFSC: <span className="font-mono text-[#707973]">{bank?.ifsc_code || 'SBIN0001234'}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
