import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { getFoodImage, getProviderBannerImage } from '../../utils/foodImages';
import { Star, ShieldCheck, Clock, CheckCircle2, ChevronLeft, Plus, Minus, Tag, CreditCard, Lock, Sparkles, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CustomerProviderDetail({ providerId, setActiveTab }) {
  const { user } = useAuth();
  const { t } = useI18n();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  // Order configuration
  const [planType, setPlanType] = useState('SINGLE'); // 'SINGLE', 'WEEKLY', 'MONTHLY'
  const [mealType, setMealType] = useState('LUNCH'); // 'LUNCH', 'DINNER', 'BOTH'
  const [extraRotiCount, setExtraRotiCount] = useState(0);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successOrder, setSuccessOrder] = useState(null);

  useEffect(() => {
    if (!providerId) return;
    const token = localStorage.getItem('aapna_tiffin_token');
    fetch(`/api/customer/providers/${providerId}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load provider details', err);
        setLoading(false);
      });
  }, [providerId]);

  if (loading) {
    return <div className="text-center py-20 font-semibold text-gray-500">{t('common.loading')}</div>;
  }

  if (!data || !data.provider) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="font-bold text-lg text-gray-700">Kitchen profile not found.</p>
        <button onClick={() => setActiveTab('customer-dashboard')} className="btn-pill btn-primary text-xs px-5 py-2">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { provider, todaysMenu = [], menuHistory = [], prepFrequency = [], reviews = [], coverage } = data;
  const isServingLocation = coverage ? coverage.isServingLocation : true;
  const providerBanner = getProviderBannerImage(provider);

  // Price calculations
  let basePrice = 110.0;
  if (planType === 'SINGLE') {
    basePrice = mealType === 'DINNER' ? (provider.single_meal_dinner_price || 110) : (provider.single_meal_lunch_price || 110);
  } else if (planType === 'WEEKLY') {
    basePrice = mealType === 'BOTH' ? (provider.weekly_both_sub_price || 1380) : (provider.weekly_lunch_sub_price || 720);
  } else if (planType === 'MONTHLY') {
    basePrice = mealType === 'BOTH' ? (provider.monthly_both_sub_price || 5600) : (provider.monthly_lunch_sub_price || 2900);
  }

  const rotiMultiplier = planType === 'SINGLE' ? 1 : (planType === 'WEEKLY' ? 7 : 30);
  const extraRotiPrice = extraRotiCount * (provider.extra_roti_unit_price || 10) * rotiMultiplier;
  const isVoucherApplied = voucherCode.trim().toUpperCase().includes('FREE-MEAL');
  const discountAmount = isVoucherApplied ? 110.0 : 0.0;
  const grossTotal = basePrice + extraRotiPrice;
  const finalPayable = Math.max(0, grossTotal - discountAmount);

  const handleCreateOrder = async () => {
    if (!user) {
      setActiveTab('common-login');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider_id: provider.id,
          meal_type: mealType,
          plan_type: planType,
          extra_roti_count: extraRotiCount,
          special_instructions: specialInstructions,
          voucher_code: isVoucherApplied ? voucherCode.trim() : null,
          payment_method: paymentMethod
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to place order');

      // Confetti celebration!
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });

      setSuccessOrder(resData.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <button
        onClick={() => setActiveTab('customer-dashboard')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#404943] hover:text-[#181a2e] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to Kitchens</span>
      </button>

      {/* Out of Service Radius Alert Banner */}
      {!isServingLocation && (
        <div className="p-4 bg-amber-50/90 border border-amber-300/80 rounded-2xl flex items-start sm:items-center gap-3 text-amber-900 text-xs shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1">
            <span className="font-extrabold text-sm block text-amber-950">
              ⚠️ Delivery not available at your current location
            </span>
            <p className="text-[#404943] mt-0.5">
              This kitchen is {coverage?.distanceKm !== undefined ? `${coverage.distanceKm} KM away` : 'outside service area'}, which exceeds their maximum delivery coverage of {coverage?.radiusKm || provider.service_radius_km} KM. You may browse their culinary menu for discovery, but online orders cannot be placed for this delivery address.
            </p>
          </div>
        </div>
      )}

      {/* Provider Hero Header with Photography */}
      <div className="glass-panel rounded-3xl shadow-xl overflow-hidden bg-white border border-black/5">
        <div className="relative h-56 sm:h-72 w-full overflow-hidden">
          <img src={providerBanner} alt={provider.kitchen_name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row md:items-end justify-between gap-4 text-white">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge-pill text-xs font-bold ${provider.food_type === 'Veg' ? 'badge-veg' : 'badge-nonveg'}`}>
                  ● {provider.food_type}
                </span>
                {provider.has_fssai === 1 && (
                  <span className="badge-pill bg-white/20 backdrop-blur-md text-white border border-white/30 text-xs font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                    <span>FSSAI: {provider.fssai_number}</span>
                  </span>
                )}
                <div className="bg-amber-400 text-amber-950 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>{provider.total_reviews > 0 ? `${provider.rating_avg} (${provider.total_reviews} ${provider.total_reviews === 1 ? 'review' : 'reviews'})` : 'No ratings yet'}</span>
                </div>
              </div>

              <h1 className="font-heading font-extrabold text-2xl sm:text-4xl text-white">
                {provider.kitchen_name}
              </h1>

              <p className="text-xs sm:text-sm text-gray-200">
                Chef {provider.provider_name} • {provider.experience_years}+ Years Culinary Experience • 📍 {provider.kitchen_address}
              </p>
            </div>

            {/* Quick Action Button */}
            {isServingLocation ? (
              <button
                onClick={() => setOrderModalOpen(true)}
                className="btn-pill btn-primary text-sm px-6 py-3 shadow-xl shrink-0 self-start md:self-auto"
              >
                <span>Order Meal / Subscribe</span>
              </button>
            ) : (
              <button
                disabled
                className="btn-pill bg-gray-200 text-gray-500 cursor-not-allowed text-xs px-5 py-3 font-bold shadow-xs shrink-0 self-start md:self-auto flex items-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Delivery Unavailable</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-6 bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-black/5">
          <p className="text-xs sm:text-sm text-[#404943] leading-relaxed max-w-3xl">
            {provider.bio || 'Wholesome, hot homestyle meals prepared daily with care and fresh ingredients.'}
          </p>
          <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-200 shrink-0">
            <span className="text-[10px] font-bold text-[#707973] uppercase block">1-Day Lunch Thali</span>
            <span className="text-xl font-black text-[#2d6a4f]">₹{provider.single_meal_lunch_price || 110}</span>
          </div>
        </div>
      </div>

      {/* TODAY'S MENU ITEMS */}
      <div className="space-y-4">
        <h2 className="font-heading font-bold text-2xl text-[#181a2e]">
          Today's Fresh Menu
        </h2>

        {todaysMenu.length === 0 ? (
          <div className="glass-panel p-8 rounded-3xl text-center text-[#707973] font-semibold">
            Today's menu is being prepared by the chef.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {todaysMenu.map((dish) => {
              const dishImg = getFoodImage(dish.name, provider.food_type, dish.meal_type);
              return (
                <div key={dish.id} className="glass-panel rounded-3xl overflow-hidden flex flex-col justify-between group border border-black/5 bg-white shadow-md">
                  <div className="relative h-44 overflow-hidden">
                    <img src={dishImg} alt={dish.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#0f5238] shadow-xs">
                      {dish.meal_type}
                    </div>
                    {dish.is_speciality === 1 && (
                      <div className="absolute top-3 right-3 bg-[#e9c46a] text-[#775b06] px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Speciality
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <h3 className="font-heading font-bold text-base text-[#181a2e] group-hover:text-[#2d6a4f] transition-colors">
                        {dish.name}
                      </h3>
                      <p className="text-xs text-[#404943] leading-relaxed line-clamp-2">
                        {dish.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-black/5 flex items-center justify-between">
                      <span className="text-base font-bold text-[#2d6a4f]">₹{dish.price}</span>
                      {isServingLocation ? (
                        <button
                          onClick={() => {
                            setMealType(dish.meal_type);
                            setOrderModalOpen(true);
                          }}
                          className="btn-pill btn-outline text-xs px-3.5 py-1.5 hover:bg-[#2d6a4f] hover:text-white hover:border-[#2d6a4f]"
                        >
                          <span>Select Dish</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                          Out of Range
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Prepared Dishes Section (with authentic food images & frequency) */}
      {prepFrequency.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-md">
          <div>
            <h3 className="font-heading font-bold text-lg sm:text-xl text-[#181a2e]">
              Top Prepared Dishes
            </h3>
            <p className="text-xs text-[#707973]">
              Most frequently prepared homestyle dishes from Chef {provider.provider_name}'s kitchen
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {prepFrequency.map((item, idx) => {
              const dishImg = getFoodImage(item.name, provider.food_type, item.meal_type);
              const freqLabel = item.frequency || (item.total_preps >= 50 ? 'Daily' : item.total_preps >= 40 ? '5 times/week' : item.total_preps >= 30 ? '4 times/week' : item.total_preps >= 20 ? '3 times/week' : item.total_preps >= 10 ? '2 times/week' : 'Weekly');
              return (
                <div key={idx} className="bg-white rounded-2xl overflow-hidden border border-black/5 shadow-xs flex flex-col justify-between group hover:shadow-md transition-all">
                  <div className="relative h-28 overflow-hidden bg-gray-100">
                    <img 
                      src={dishImg} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded-full text-[9px] font-bold">
                      {freqLabel}
                    </div>
                  </div>
                  <div className="p-3 text-center space-y-1">
                    <span className="text-xs font-bold text-[#181a2e] block truncate" title={item.name}>
                      {item.name}
                    </span>
                    <span className="text-[11px] text-[#2d6a4f] font-extrabold block">
                      {freqLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Customer Reviews Section */}
      <div className="space-y-4">
        <h3 className="font-heading font-bold text-xl text-[#181a2e]">
          Customer Reviews ({reviews.length})
        </h3>
        {reviews.length === 0 ? (
          <p className="text-xs text-[#707973]">No reviews yet. Be the first to try and review!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="glass-panel p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#181a2e]">{r.customer_name}</span>
                  <div className="flex text-[#e9c46a]">
                    {[...Array(r.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-[#404943] leading-relaxed">
                  "{r.review_text}"
                </p>
                <span className="text-[10px] text-gray-400 block">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ORDER & SUBSCRIPTION MODAL */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 my-8">
            {!successOrder ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-black/10">
                  <div>
                    <h3 className="font-heading font-extrabold text-xl text-[#181a2e]">
                      Confirm Your Tiffin Order
                    </h3>
                    <p className="text-xs text-[#404943]">{provider.kitchen_name}</p>
                  </div>
                  <button onClick={() => setOrderModalOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Plan Type Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#181a2e] uppercase tracking-wider block">
                    Choose Meal Plan:
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPlanType('SINGLE')}
                      className={`p-2.5 rounded-xl border transition-all ${planType === 'SINGLE' ? 'bg-[#2d6a4f] text-white border-[#2d6a4f]' : 'bg-white text-[#404943] border-black/10'}`}
                    >
                      {t('customer.single_meal')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanType('WEEKLY')}
                      className={`p-2.5 rounded-xl border transition-all ${planType === 'WEEKLY' ? 'bg-[#2d6a4f] text-white border-[#2d6a4f]' : 'bg-white text-[#404943] border-black/10'}`}
                    >
                      {t('customer.weekly_plan')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanType('MONTHLY')}
                      className={`p-2.5 rounded-xl border transition-all ${planType === 'MONTHLY' ? 'bg-[#2d6a4f] text-white border-[#2d6a4f]' : 'bg-white text-[#404943] border-black/10'}`}
                    >
                      {t('customer.monthly_plan')}
                    </button>
                  </div>
                </div>

                {/* Meal Slot Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#181a2e] uppercase tracking-wider block">
                    Meal Timing Slot:
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setMealType('LUNCH')}
                      className={`p-2 rounded-xl border transition-all ${mealType === 'LUNCH' ? 'bg-[#e07a5f] text-white border-[#e07a5f]' : 'bg-white text-[#404943] border-black/10'}`}
                    >
                      {t('customer.lunch')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMealType('DINNER')}
                      className={`p-2 rounded-xl border transition-all ${mealType === 'DINNER' ? 'bg-[#e07a5f] text-white border-[#e07a5f]' : 'bg-white text-[#404943] border-black/10'}`}
                    >
                      {t('customer.dinner')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMealType('BOTH')}
                      className={`p-2 rounded-xl border transition-all ${mealType === 'BOTH' ? 'bg-[#e07a5f] text-white border-[#e07a5f]' : 'bg-white text-[#404943] border-black/10'}`}
                    >
                      {t('customer.both_lunch_dinner')}
                    </button>
                  </div>
                </div>

                {/* Extra Roti Stepper */}
                <div className="p-3 bg-white/80 rounded-2xl border border-black/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#181a2e] block">{t('customer.add_extra_roti')}</span>
                    <span className="text-[11px] text-[#707973]">₹10 per piece</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setExtraRotiCount(Math.max(0, extraRotiCount - 1))}
                      className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono font-bold text-sm">{extraRotiCount}</span>
                    <button
                      type="button"
                      onClick={() => setExtraRotiCount(extraRotiCount + 1)}
                      className="w-7 h-7 rounded-full bg-[#2d6a4f] text-white flex items-center justify-center font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Voucher input */}
                <div>
                  <label className="text-xs font-bold text-[#181a2e] uppercase tracking-wider block mb-1">
                    {t('customer.apply_voucher')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      placeholder={t('customer.voucher_placeholder')}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setVoucherCode('FREE-MEAL-100-DELIGHT')}
                      className="text-[11px] font-bold text-[#2d6a4f] bg-[#2d6a4f]/10 px-3 py-1.5 rounded-xl shrink-0"
                    >
                      Try Code
                    </button>
                  </div>
                  {isVoucherApplied && (
                    <span className="text-[11px] text-emerald-700 font-bold mt-1 block">
                      ✓ Free Meal Voucher Applied: ₹110 Discount!
                    </span>
                  )}
                </div>

                {/* 3-Hour Advance Notice */}
                <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-snug">
                  {t('customer.min_advance_notice')}
                </div>

                {/* Bill Breakdown */}
                <div className="p-4 bg-[#f4f2ff] rounded-2xl border border-black/5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#404943]">
                    <span>{t('customer.base_price')}:</span>
                    <span>₹{basePrice.toFixed(2)}</span>
                  </div>
                  {extraRotiCount > 0 && (
                    <div className="flex justify-between text-[#404943]">
                      <span>Extra Roti ({extraRotiCount} pcs):</span>
                      <span>₹{extraRotiPrice.toFixed(2)}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>{t('customer.discount')}:</span>
                      <span>-₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-black/10 flex justify-between font-bold text-sm text-[#181a2e]">
                    <span>{t('customer.final_total')}:</span>
                    <span className="text-base text-[#2d6a4f]">₹{finalPayable.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment method selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#181a2e] block">Payment Method:</label>
                  <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('UPI')}
                      className={`p-2 rounded-xl border ${paymentMethod === 'UPI' ? 'bg-[#2d6a4f] text-white' : 'bg-white'}`}
                    >
                      UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Card')}
                      className={`p-2 rounded-xl border ${paymentMethod === 'Card' ? 'bg-[#2d6a4f] text-white' : 'bg-white'}`}
                    >
                      Debit/Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('NetBanking')}
                      className={`p-2 rounded-xl border ${paymentMethod === 'NetBanking' ? 'bg-[#2d6a4f] text-white' : 'bg-white'}`}
                    >
                      NetBanking
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={submitting}
                  className="w-full btn-pill btn-primary py-3.5 text-sm font-bold shadow-lg"
                >
                  {submitting ? t('common.loading') : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>{t('customer.pay_and_order')} (₹{finalPayable.toFixed(2)})</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              /* Order Confirmation State */
              <div className="text-center space-y-4 py-4 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-md">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-heading font-black text-2xl text-[#181a2e]">
                  Order Placed Successfully!
                </h3>
                <p className="text-xs text-[#404943]">
                  Your order <span className="font-bold text-[#2d6a4f]">#{successOrder.orderNumber}</span> has been confirmed.
                </p>

                {/* Big OTP Display */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                  <span className="text-xs font-bold text-emerald-900 uppercase">Your Delivery OTP:</span>
                  <div className="text-3xl font-mono font-black text-emerald-800 tracking-widest">
                    {successOrder.deliveryOtp}
                  </div>
                  <p className="text-[11px] text-emerald-700">Share this with chef upon delivery.</p>
                </div>

                <button
                  onClick={() => {
                    setOrderModalOpen(false);
                    setActiveTab('customer-dashboard');
                  }}
                  className="w-full btn-pill btn-primary py-3 text-sm font-bold"
                >
                  View in Active Orders
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
