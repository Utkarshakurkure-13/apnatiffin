import React, { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { STITCH_FOOD_ASSETS, getProviderBannerImage } from '../utils/foodImages';
import { ShieldCheck, Heart, Sparkles, Star, ChevronRight, Lock, UserPlus, ChefHat, Clock, CheckCircle2 } from 'lucide-react';

export default function LandingPage({ setActiveTab, setSelectedProviderId }) {
  const { t, lang, changeLanguage } = useI18n();
  const { user, isCustomer, isProvider, isAdmin } = useAuth();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/customer/providers')
      .then(res => res.json())
      .then(data => {
        if (data.providers) setProviders(data.providers);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load featured providers', err);
        setLoading(false);
      });
  }, []);

  const handleProviderClick = (providerId) => {
    if (setSelectedProviderId) {
      setSelectedProviderId(providerId);
    }
    setActiveTab('customer-provider-detail');
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Multi-lingual Banner & Region Notice */}
      <section className="w-full bg-[#FFF0F3] border-b border-black/5 px-4 sm:px-8 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-[#404943]">
          <span className="inline-flex p-1 rounded-full bg-[#ffdbd2] text-[#9a442d]">
            <span className="material-symbols-outlined text-xs">near_me_disabled</span>
          </span>
          <p className="leading-snug">
            <span className="font-bold text-[#e07a5f] uppercase tracking-wider mr-1">Phase I Route Notice:</span>
            {t('phase_notice')}
          </p>
        </div>

        {/* Language Switcher Strip */}
        <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-full shadow-2xs border border-black/5">
          <span className="material-symbols-outlined text-xs text-[#707973] ml-1">translate</span>
          <button
            onClick={() => changeLanguage('en')}
            className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all ${
              lang === 'en' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#404943] hover:text-[#181a2e]'
            }`}
          >
            English
          </button>
          <button
            onClick={() => changeLanguage('mr')}
            className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all ${
              lang === 'mr' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#404943] hover:text-[#181a2e]'
            }`}
          >
            मराठी
          </button>
          <button
            onClick={() => changeLanguage('hi')}
            className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all ${
              lang === 'hi' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#404943] hover:text-[#181a2e]'
            }`}
          >
            हिंदी
          </button>
        </div>
      </section>

      {/* Hero Section with Warm Culinary Bento */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Narrative */}
          <div className="lg:col-span-7 flex flex-col items-start space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2d6a4f]/10 text-[#2d6a4f] border border-[#2d6a4f]/15">
              <Sparkles className="w-4 h-4 text-[#e9c46a]" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {t('landing.badge')}
              </span>
            </div>

            <h1 className="font-heading font-extrabold text-3xl sm:text-5xl lg:text-6xl text-[#181a2e] leading-[1.15] tracking-tight">
              {t('landing.hero_title')}
            </h1>

            <p className="text-base sm:text-lg text-[#404943] leading-relaxed max-w-2xl">
              {t('landing.hero_desc')}
            </p>

            {/* CTA Cluster */}
            <div className="w-full flex flex-wrap items-center gap-3 pt-2">
              {!user ? (
                <>
                  <button
                    onClick={() => setActiveTab('common-login')}
                    className="btn-pill btn-primary px-6 py-3.5 text-sm sm:text-base shadow-lg"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{t('landing.cta_login')}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('register-customer')}
                    className="btn-pill btn-secondary px-5 py-3.5 text-sm sm:text-base shadow-md"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{t('landing.cta_cust')}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('register-provider')}
                    className="btn-pill btn-outline px-5 py-3.5 text-sm sm:text-base"
                  >
                    <ChefHat className="w-4 h-4" />
                    <span>{t('landing.cta_prov')}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    if (isCustomer) setActiveTab('customer-dashboard');
                    else if (isProvider) setActiveTab('provider-dashboard');
                    else if (isAdmin) setActiveTab('admin-dashboard');
                  }}
                  className="btn-pill btn-primary px-8 py-4 text-base shadow-lg"
                >
                  <span className="material-symbols-outlined text-xl">space_dashboard</span>
                  <span>Go to My {user.role} Dashboard</span>
                </button>
              )}
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-4 pt-4 border-t border-black/5 w-full">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#b1f0ce] text-[#002114] flex items-center justify-center font-bold text-xs border-2 border-white shadow-xs">
                  RS
                </div>
                <div className="w-10 h-10 rounded-full bg-[#ffdbd2] text-[#3c0800] flex items-center justify-center font-bold text-xs border-2 border-white shadow-xs">
                  PP
                </div>
                <div className="w-10 h-10 rounded-full bg-[#ffdf96] text-[#251a00] flex items-center justify-center font-bold text-xs border-2 border-white shadow-xs">
                  AK
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-[#e9c46a]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                  <span className="text-xs font-bold text-[#181a2e] ml-1">4.92 / 5</span>
                </div>
                <span className="text-xs text-[#404943]">
                  {t('landing.social_proof')}
                </span>
              </div>
            </div>
          </div>

          {/* Right Visual Bento Card */}
          <div className="lg:col-span-5 relative">
            <div className="glass-panel p-4 sm:p-6 rounded-3xl relative overflow-hidden shadow-2xl bg-white">
              {/* Special Thali Image from Stitch */}
              <div className="relative h-72 sm:h-80 w-full rounded-2xl overflow-hidden mb-4 group">
                <img
                  src={STITCH_FOOD_ASSETS.ROYAL_VEG_THALI}
                  alt="Special Indian Thali Tiffin"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 bg-[#2d6a4f]/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-[#e9c46a] animate-ping" />
                  {t('landing.special_thali')}
                </div>
                <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md text-[#181a2e] px-3.5 py-1.5 rounded-full text-sm font-bold shadow-lg border border-black/5">
                  {t('landing.per_dabba')}
                </div>
              </div>

              {/* Kitchen preview card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                    Shri Krishna Maa Annapurna
                  </h3>
                  <div className="badge-rating px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>4.9</span>
                  </div>
                </div>
                <p className="text-xs text-[#404943]">
                  Pure Ghee Rotis • Yellow Dal Tadka • Shahi Paneer • Steamed Basmati
                </p>

                <div className="pt-3 border-t border-black/5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#2d6a4f] flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Verified Satvik Home Chef
                  </span>
                  <button
                    onClick={() => setActiveTab('common-login')}
                    className="text-xs font-bold text-[#e07a5f] hover:underline flex items-center gap-0.5"
                  >
                    <span>View Today's Menu</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillar Features */}
      <section className="w-full bg-[#f4f2ff]/60 py-16 border-y border-black/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-panel p-6 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#2d6a4f]/10 text-[#2d6a4f] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                {t('landing.feature_1_title')}
              </h3>
              <p className="text-sm text-[#404943] leading-relaxed">
                {t('landing.feature_1_desc')}
              </p>
            </div>

            <div className="glass-panel p-6 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#e07a5f]/10 text-[#e07a5f] flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                {t('landing.feature_2_title')}
              </h3>
              <p className="text-sm text-[#404943] leading-relaxed">
                {t('landing.feature_2_desc')}
              </p>
            </div>

            <div className="glass-panel p-6 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#e9c46a]/20 text-[#775b06] flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                {t('landing.feature_3_title')}
              </h3>
              <p className="text-sm text-[#404943] leading-relaxed">
                {t('landing.feature_3_desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Home Kitchens Section */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-[#181a2e]">
              {t('landing.explore_section_title')}
            </h2>
            <p className="text-sm text-[#404943] mt-1">
              {t('landing.explore_section_desc')}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('common-login')}
            className="btn-pill btn-outline text-xs sm:text-sm px-5 py-2.5 self-start sm:self-auto"
          >
            <span>{t('nav.explore')}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#707973] font-semibold">
            {t('common.loading')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {providers.slice(0, 3).map((p) => {
              const bannerImg = getProviderBannerImage(p);
              return (
                <div
                  key={p.id}
                  onClick={() => handleProviderClick(p.id)}
                  className="glass-panel rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between group bg-white border border-black/5"
                >
                  <div className="relative h-44 overflow-hidden">
                    <img src={bannerImg} alt={p.kitchen_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#0f5238] shadow-xs">
                      ● {p.food_type}
                    </div>
                    <div className="absolute top-3 right-3 bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-xs">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{p.total_reviews > 0 ? `${p.rating_avg}` : 'New'}</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-lg text-[#181a2e] group-hover:text-[#2d6a4f] transition-colors">
                        {p.kitchen_name}
                      </h3>
                      <p className="text-xs text-[#707973] mb-2 font-medium">
                        Chef: {p.provider_name} • {p.experience_years}+ yrs exp.
                      </p>
                      <p className="text-xs text-[#404943] line-clamp-2 leading-relaxed">
                        {p.bio || 'Authentic homestyle dishes made fresh with traditional recipes.'}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-black/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#707973] uppercase font-bold block">1-Day Meal</span>
                        <span className="text-sm font-bold text-[#2d6a4f]">₹{p.single_meal_lunch_price || 110}</span>
                      </div>
                      <button className="btn-pill btn-primary text-xs px-4 py-2 group-hover:bg-[#0f5238]">
                        <span>Order Now</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
