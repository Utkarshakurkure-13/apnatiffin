import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { useLocationContext } from '../../context/LocationContext';
import StatusBadge from '../../components/common/StatusBadge';
import StitchCarousel from '../../components/customer/StitchCarousel';
import { getFoodImage, getProviderBannerImage } from '../../utils/foodImages';
import { 
  Star, ShieldCheck, Sparkles, Clock, AlertCircle, ChefHat, 
  ChevronRight, XCircle, Gift, MessageSquare, Utensils, 
  CheckCircle2, MapPin, Navigation, Map, Info, Compass,
  Truck, ArrowRight, ThumbsUp, X, Minus, Plus, CreditCard,
  Banknote, QrCode, Check, ShoppingBag
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CustomerDashboard({ setActiveTab, setSelectedProviderId }) {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const { deliveryLocation } = useLocationContext();

  const [activeOrders, setActiveOrders] = useState([]);
  const [deliveredTodayOrders, setDeliveredTodayOrders] = useState([]);
  const [todaysSpecialMenus, setTodaysSpecialMenus] = useState([]);
  const [servingProviders, setServingProviders] = useState([]);
  const [otherProviders, setOtherProviders] = useState([]);
  const [pointsSummary, setPointsSummary] = useState(null);
  const [foodTypeFilter, setFoodTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('DISTANCE_LOW');
  const [loading, setLoading] = useState(true);

  // Cancellation State
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  // Rating & Review State for Today's Delivered Meals
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingOrder, setReviewingOrder] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Direct Item Order State for Today's Fresh Special
  const [directOrderModalOpen, setDirectOrderModalOpen] = useState(false);
  const [selectedSpecialItem, setSelectedSpecialItem] = useState(null);
  const [specialOrderQty, setSpecialOrderQty] = useState(1);
  const [specialOrderPayment, setSpecialOrderPayment] = useState('UPI');
  const [specialOrderNotes, setSpecialOrderNotes] = useState('');
  const [specialOrderVoucher, setSpecialOrderVoucher] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherApplied, setVoucherApplied] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [placingSpecialOrder, setPlacingSpecialOrder] = useState(false);
  const [specialOrderSuccess, setSpecialOrderSuccess] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const lat = deliveryLocation?.latitude || 18.5314;
      const lon = deliveryLocation?.longitude || 73.8446;

      const [todayRes, provLocRes, ptsRes] = await Promise.all([
        fetch(`/api/customer/dashboard/today?lat=${lat}&lon=${lon}`, { headers }),
        fetch(`/api/customer/providers-by-location?lat=${lat}&lon=${lon}&food_type=${foodTypeFilter}&sort_by=${sortBy}`, { headers }),
        fetch('/api/customer/points', { headers })
      ]);

      if (todayRes.ok) {
        const todayData = await todayRes.json();
        setActiveOrders(todayData.activeOrders || []);
        setDeliveredTodayOrders(todayData.deliveredTodayOrders || []);
        setTodaysSpecialMenus(todayData.todaysSpecialMenus || []);
      }
      if (provLocRes.ok) {
        const locData = await provLocRes.json();
        setServingProviders(locData.servingYourLocation || []);
        setOtherProviders(locData.otherAvailableProviders || []);
      }
      if (ptsRes.ok) {
        const ptsData = await ptsRes.json();
        setPointsSummary(ptsData);
      }
    } catch (err) {
      console.error('Failed to load customer dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Polling for live status
    return () => clearInterval(interval);
  }, [deliveryLocation, foodTypeFilter, sortBy]);

  const handleOpenDirectOrder = (item, e) => {
    if (e) e.stopPropagation();
    setSelectedSpecialItem(item);
    setSpecialOrderQty(1);
    setSpecialOrderPayment('UPI');
    setSpecialOrderNotes('');
    setSpecialOrderVoucher('');
    setVoucherDiscount(0);
    setVoucherApplied(false);
    setVoucherError('');
    setDirectOrderModalOpen(true);
  };

  const handleApplyVoucher = async () => {
    if (!specialOrderVoucher.trim()) return;
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/customer/rewards', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const reward = (data.availableRewards || []).find(
          r => r.reward_code.toUpperCase() === specialOrderVoucher.trim().toUpperCase()
        );
        if (reward) {
          setVoucherDiscount(reward.free_meal_value || 50);
          setVoucherApplied(true);
          setVoucherError('');
        } else {
          setVoucherError('Invalid or unredeemed voucher code');
          setVoucherApplied(false);
          setVoucherDiscount(0);
        }
      }
    } catch (err) {
      setVoucherError('Failed to validate voucher code');
    }
  };

  const handleConfirmSpecialOrder = async () => {
    if (!selectedSpecialItem) return;
    setPlacingSpecialOrder(true);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider_id: selectedSpecialItem.provider_id,
          meal_type: selectedSpecialItem.meal_type || 'LUNCH',
          plan_type: 'SINGLE',
          menu_item_id: selectedSpecialItem.id,
          quantity: specialOrderQty,
          voucher_code: voucherApplied ? specialOrderVoucher.trim() : null,
          payment_method: specialOrderPayment,
          special_instructions: specialOrderNotes,
          delivery_lat: deliveryLocation?.latitude,
          delivery_lon: deliveryLocation?.longitude,
          delivery_address: deliveryLocation?.address || profile?.delivery_address
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');

      confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
      setDirectOrderModalOpen(false);
      setSpecialOrderSuccess({
        orderNumber: data.order?.orderNumber || 'APT-SUCCESS',
        deliveryOtp: data.order?.deliveryOtp || '0000',
        finalAmount: data.order?.finalPayable,
        itemName: selectedSpecialItem.name,
        kitchenName: selectedSpecialItem.kitchen_name,
        mealType: selectedSpecialItem.meal_type,
        address: deliveryLocation?.address || profile?.delivery_address
      });

      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    } finally {
      setPlacingSpecialOrder(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancellingOrderId) return;
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/customer/orders/${cancellingOrderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: cancelReason || 'Customer requested cancellation' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel order');

      setActionMessage(`Order cancelled successfully. Refund of ₹${data.refundAmount !== undefined ? data.refundAmount.toFixed(2) : '0.00'} initiated.`);
      setCancelModalOpen(false);
      setCancellingOrderId(null);
      setCancelReason('');
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewingOrder) return;
    setSubmittingReview(true);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/customer/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: reviewingOrder.id,
          rating: ratingValue,
          review_text: reviewText
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit review');

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      setActionMessage('⭐ Thank you for rating today\'s meal! +5 Bonus Points earned.');
      setReviewModalOpen(false);
      setReviewingOrder(null);
      setReviewText('');
      fetchDashboardData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Action Feedback Banner */}
      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage('')} className="text-emerald-700 hover:text-emerald-900 font-bold px-2">✕</button>
        </div>
      )}

      {/* 1. Top Welcome & Loyalty Points Bar */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
              {t('customer.welcome')}, {profile?.full_name || user?.email.split('@')[0]}!
            </h1>
            <span className="text-xl">🍲</span>
          </div>
          <p className="text-xs sm:text-sm text-[#404943]">
            Enjoy freshly cooked homestyle meals delivered straight from local home chefs.
          </p>
        </div>

        {/* Loyalty Points Pill Card */}
        <div 
          onClick={() => setActiveTab('customer-points')}
          className="bg-white/90 border border-black/8 px-5 py-3 rounded-2xl flex items-center gap-4 cursor-pointer hover:shadow-md transition-all shadow-xs group"
        >
          <div className="w-10 h-10 rounded-full bg-[#e9c46a]/20 text-[#775b06] flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5 text-[#e9c46a] group-hover:rotate-12 transition-transform" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-[#707973] uppercase tracking-wider">
              {t('customer.points_balance')}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-heading font-black text-[#181a2e]">
                {pointsSummary?.totalPoints || 0}
              </span>
              <span className="text-xs font-bold text-[#2d6a4f]">Pts</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* Stitch 3D Auto-Sliding Carousel Showcase */}
      <StitchCarousel setActiveTab={setActiveTab} />

      {/* 2. TODAY'S ACTIVE ORDER TRACKER */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#2d6a4f] animate-ping" />
            <h2 className="font-heading font-bold text-xl text-[#181a2e]">
              {t('customer.active_order_title')}
            </h2>
          </div>
          {activeOrders.length > 0 && (
            <span className="text-xs text-[#707973] font-semibold">
              Auto-updating live status
            </span>
          )}
        </div>

        {activeOrders.length === 0 ? (
          <div className="glass-panel p-8 rounded-3xl text-center space-y-3">
            <Utensils className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm font-semibold text-[#404943]">
              {t('customer.no_active_orders')}
            </p>
            <button
              onClick={() => {
                const el = document.getElementById('kitchens-grid');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-pill btn-primary text-xs px-5 py-2.5 shadow-md"
            >
              {t('customer.order_now')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activeOrders.map((ord) => {
              const foodImg = getFoodImage(ord.plan_type, ord.food_type, ord.meal_type);
              return (
                <div key={ord.id} className="glass-panel p-6 rounded-3xl shadow-xl border border-[#2d6a4f]/20 space-y-5 relative overflow-hidden">
                  {/* Kitchen info, Food Photo & Status */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md shrink-0 border border-black/10">
                        <img src={foodImg} alt={ord.kitchen_name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#707973] uppercase tracking-wider block">
                          Order #{ord.order_number} • {ord.plan_type} ({ord.meal_type})
                        </span>
                        <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                          {ord.kitchen_name}
                        </h3>
                        <p className="text-xs text-[#404943]">
                          Chef: {ord.provider_name} • Ph: {ord.provider_mobile}
                        </p>
                      </div>
                    </div>
                    {['READY', 'EN_ROUTE'].includes(ord.order_status) ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#e07a5f] text-white shadow-xs animate-pulse">
                        <Truck className="w-3.5 h-3.5" />
                        <span>Out for Delivery</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#0f5238] border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Order Confirmed</span>
                      </span>
                    )}
                  </div>

                  {/* BIG 4-DIGIT DELIVERY OTP CARD */}
                  <div className="p-4 bg-gradient-to-br from-[#2d6a4f]/10 to-[#e9c46a]/15 rounded-2xl border border-[#2d6a4f]/25 flex items-center justify-between gap-4 shadow-xs">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-[#0f5238] uppercase tracking-wider block">
                        {t('customer.delivery_otp_label')}
                      </span>
                      <p className="text-[11px] text-[#404943] max-w-[200px] leading-tight">
                        {t('customer.give_otp_instruction')}
                      </p>
                    </div>

                    <div className="bg-white px-5 py-2.5 rounded-2xl shadow-md border border-[#2d6a4f]/20 text-center">
                      <span className="text-2xl sm:text-3xl font-mono font-black text-[#0f5238] tracking-widest">
                        {ord.delivery_otp}
                      </span>
                    </div>
                  </div>

                  {/* 🍱 TODAY'S TIFFIN (DYNAMIC MENU ITEMS WITH FOOD THUMBNAILS) */}
                  <div className="bg-white/95 rounded-2xl p-4 border border-black/8 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-black/5 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🍱</span>
                        <h4 className="font-heading font-extrabold text-sm text-[#181a2e]">
                          Today's Tiffin Menu
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-[#0f5238] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {ord.meal_type} Meal
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {ord.today_menu_items && ord.today_menu_items.length > 0 ? (
                        ord.today_menu_items.map((item, idx) => {
                          const itemImg = item.photo_url || getFoodImage(item.name, ord.food_type, ord.meal_type);
                          return (
                            <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl bg-[#fbf8ff] hover:bg-emerald-50/40 border border-black/5 transition-all group">
                              <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-black/10 shadow-2xs">
                                <img 
                                  src={itemImg} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {item.category && (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100/70 text-amber-900">
                                      {item.category}
                                    </span>
                                  )}
                                  {item.is_speciality && (
                                    <span className="text-[9px] font-bold text-[#e07a5f]">
                                      ★ Special
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-bold text-[#181a2e] truncate mt-0.5" title={item.name}>
                                  {item.name}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full text-xs text-[#707973] italic py-1">
                          Fresh homestyle meal being prepared by Chef {ord.provider_name}.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 🕐 EXPECTED DELIVERY TIME BANNER */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50/60 border border-emerald-200/80 p-3 sm:p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#2d6a4f]/15 text-[#2d6a4f] flex items-center justify-center font-bold text-sm shrink-0">
                        🕐
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#707973] uppercase tracking-wider block">
                          Expected Delivery
                        </span>
                        <span className="font-heading font-extrabold text-xs sm:text-sm text-[#0f5238]">
                          {ord.expected_delivery_time || '12:30 PM – 1:30 PM'}
                        </span>
                      </div>
                    </div>
                    {ord.special_instructions && (
                      <div className="hidden sm:block text-right max-w-[170px]">
                        <span className="text-[10px] text-gray-500 font-medium line-clamp-1" title={ord.special_instructions}>
                          Note: {ord.special_instructions}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Total */}
                  <div className="pt-2 border-t border-black/5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#707973] uppercase font-bold block">Amount Paid</span>
                      <span className="text-base font-bold text-[#181a2e]">₹{ord.final_amount.toFixed(2)}</span>
                    </div>

                    <button
                      onClick={() => {
                        setCancellingOrderId(ord.id);
                        setCancelModalOpen(true);
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-full transition-colors"
                    >
                      {t('customer.cancel_order')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. TODAY'S DELIVERED MEALS (STRICTLY TODAY'S MEALS ONLY) */}
      {deliveredTodayOrders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-900/10 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h2 className="font-heading font-bold text-xl text-[#181a2e]">
                Delivered Today
              </h2>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-[#0f5238] rounded-full">
              {deliveredTodayOrders.length} Meal{deliveredTodayOrders.length === 1 ? '' : 's'} Delivered
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deliveredTodayOrders.map((ord) => {
              const foodImg = getFoodImage(ord.plan_type, ord.food_type, ord.meal_type);
              return (
                <div key={ord.id} className="glass-panel p-5 rounded-3xl shadow-lg border border-emerald-200/60 bg-gradient-to-b from-white to-emerald-50/20 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden h-36 border border-black/5 shadow-inner">
                      <img src={foodImg} alt={ord.kitchen_name} className="w-full h-full object-cover" />
                      <div className="absolute top-2.5 left-2.5 bg-emerald-700/90 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Delivered Today</span>
                      </div>
                      <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                        ₹{ord.final_amount.toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-[#707973] uppercase tracking-wider block">
                        {ord.plan_type} • {ord.meal_type}
                      </span>
                      <h4 className="font-heading font-bold text-base text-[#181a2e] line-clamp-1">
                        {ord.kitchen_name}
                      </h4>
                      <p className="text-xs text-[#707973]">
                        Chef: {ord.provider_name}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-black/5 flex items-center justify-between">
                    {ord.rating ? (
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold text-amber-800">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>Rated {ord.rating} / 5</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReviewingOrder(ord);
                          setRatingValue(5);
                          setReviewModalOpen(true);
                        }}
                        className="btn-pill bg-amber-500 hover:bg-amber-600 text-white text-xs px-3.5 py-1.5 font-bold shadow-xs flex items-center gap-1.5"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Rate Meal (+5 Pts)</span>
                      </button>
                    )}

                    <span className="text-[11px] text-[#707973] font-medium">
                      Order #{ord.order_number}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. TODAY'S SPECIAL MENU SHOWCASE (DIRECT ITEM ORDER FLOW) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-black/10 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥗</span>
            <div>
              <h2 className="font-heading font-bold text-xl text-[#181a2e]">
                Today's Fresh Specials
              </h2>
              <p className="text-xs text-[#707973]">
                Freshly cooked daily dishes prepared by local home chefs serving your area today
              </p>
            </div>
          </div>
          {todaysSpecialMenus.length > 0 && (
            <span className="text-xs font-bold text-[#2d6a4f] bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full hidden sm:block">
              {todaysSpecialMenus.length} Fresh Special{todaysSpecialMenus.length === 1 ? '' : 's'} in Your Area
            </span>
          )}
        </div>

        {todaysSpecialMenus.length === 0 ? (
          <div className="glass-panel p-8 rounded-3xl text-center space-y-2 border border-dashed border-emerald-300/80 bg-emerald-50/20">
            <span className="text-3xl block">🥗</span>
            <p className="font-bold text-[#181a2e] text-sm">
              No fresh specials available in your area today.
            </p>
            <p className="text-xs text-[#707973] max-w-md mx-auto">
              Providers serving your location haven't listed special items for today yet. You can explore full kitchen menus below or check back during meal cooking hours.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {todaysSpecialMenus.map((item) => {
              const dishImg = getFoodImage(item.name, item.provider_food_type, item.meal_type);
              return (
                <div 
                  key={item.id}
                  onClick={(e) => handleOpenDirectOrder(item, e)}
                  className="glass-panel rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between group border border-black/5 bg-white hover:border-[#2d6a4f]/40"
                >
                  <div className="relative h-44 overflow-hidden">
                    <img 
                      src={dishImg} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#0f5238] shadow-xs">
                      {item.meal_type} Special
                    </div>
                    <div className="absolute bottom-3 right-3 bg-[#0f5238] text-white px-2.5 py-0.5 rounded-full text-xs font-black shadow-md">
                      ₹{item.price}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${item.provider_food_type === 'Non-Veg' ? 'text-red-600' : 'text-emerald-700'}`}>
                        ● {item.provider_food_type || 'Homestyle'}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3 fill-current text-amber-500" />
                        <span>{item.total_reviews > 0 ? `${item.rating_avg}` : '0.0'}</span>
                      </div>
                    </div>

                    <h4 className="font-heading font-bold text-sm text-[#181a2e] group-hover:text-[#2d6a4f] transition-colors line-clamp-1">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-[#707973] line-clamp-1">
                      By {item.kitchen_name}
                    </p>

                    <div className="pt-2 border-t border-black/5 flex items-center justify-between text-xs font-bold text-[#2d6a4f]">
                      <span className="group-hover:underline">Order Today</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. DISCOVER LOCAL HOME KITCHENS & MENUS */}
      <div id="kitchens-grid" className="space-y-8 pt-2">
        {/* Filters and Sorting Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-heading font-bold text-2xl text-[#181a2e]">
              Explore Local Home Kitchens
            </h2>
            <p className="text-xs sm:text-sm text-[#404943]">
              Verified home chefs serving your location within their configured delivery radius.
            </p>
          </div>

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Food type pill filter */}
            <div className="flex bg-white/80 border border-black/10 rounded-full p-1 shadow-2xs text-xs font-bold">
              <button
                onClick={() => setFoodTypeFilter('ALL')}
                className={`px-3 py-1 rounded-full transition-all ${foodTypeFilter === 'ALL' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#404943]'}`}
              >
                {t('customer.all_types')}
              </button>
              <button
                onClick={() => setFoodTypeFilter('Veg')}
                className={`px-3 py-1 rounded-full transition-all ${foodTypeFilter === 'Veg' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#404943]'}`}
              >
                {t('customer.veg_only')}
              </button>
              <button
                onClick={() => setFoodTypeFilter('Both')}
                className={`px-3 py-1 rounded-full transition-all ${foodTypeFilter === 'Both' ? 'bg-[#2d6a4f] text-white shadow-xs' : 'text-[#404943]'}`}
              >
                Veg & Non-Veg
              </button>
            </div>

            {/* Sort selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-full bg-white/80 border border-black/10 text-xs font-bold text-[#181a2e]"
            >
              <option value="DISTANCE_LOW">Nearest First (Distance)</option>
              <option value="RATING_HIGH">{t('customer.sort_rating')}</option>
              <option value="PRICE_LOW">{t('customer.sort_price_low')}</option>
              <option value="PRICE_HIGH">{t('customer.sort_price_high')}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-[#707973] font-semibold space-y-3">
            <div className="w-10 h-10 border-4 border-[#2d6a4f] border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Matching kitchens with your delivery location...</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* SECTION 1: AVAILABLE PROVIDERS (CAN SERVE CURRENT LOCATION) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-900/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#2d6a4f] flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-xl text-[#0f5238]">
                      Available Providers
                    </h3>
                    <span className="text-xs text-[#707973]">
                      Verified home chefs within service range • Ready for daily delivery to your selected location
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-emerald-100/70 text-[#0f5238] rounded-full border border-emerald-200">
                  {servingProviders.length} Kitchen{servingProviders.length === 1 ? '' : 's'} Available
                </span>
              </div>

              {servingProviders.length === 0 ? (
                <div className="glass-panel p-8 rounded-3xl text-center text-[#707973] space-y-2 border border-dashed border-amber-300 bg-amber-50/40">
                  <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
                  <p className="font-bold text-[#181a2e]">No providers currently serve your selected location.</p>
                  <p className="text-xs text-[#404943] max-w-md mx-auto">
                    You can check other nearby platform providers below or update your delivery address in the top navigation.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {servingProviders.map((p) => {
                    const bannerImg = getProviderBannerImage(p);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (setSelectedProviderId) setSelectedProviderId(p.id);
                          setActiveTab('customer-provider-detail');
                        }}
                        className="glass-panel rounded-3xl hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between group border-2 border-emerald-500/30 hover:border-[#2d6a4f] relative overflow-hidden bg-white"
                      >
                        {/* Provider Signature Food Banner */}
                        <div className="relative h-44 overflow-hidden border-b border-black/5">
                          <img 
                            src={bannerImg} 
                            alt={p.kitchen_name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                          <div className="absolute top-3 left-3 bg-emerald-700/90 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                            <span>Serves Your Area</span>
                          </div>
                          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1 shadow-xs border border-amber-200">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span>{p.total_reviews > 0 ? `${p.rating_avg} (${p.total_reviews})` : 'No ratings yet'}</span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div>
                              <h4 className="font-heading font-bold text-lg text-[#181a2e] group-hover:text-[#2d6a4f] transition-colors line-clamp-1">
                                {p.kitchen_name}
                              </h4>
                              <p className="text-xs text-[#707973] font-semibold">
                                Chef: {p.provider_name} • {p.experience_years}+ Yrs Exp
                              </p>
                            </div>

                            {/* Distance & Service Radius Badges */}
                            <div className="grid grid-cols-2 gap-2 bg-emerald-50/60 p-2.5 rounded-2xl border border-emerald-100 text-[11px]">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-[#707973] uppercase font-bold">Distance</span>
                                <span className="font-bold text-[#0f5238]">
                                  📍 {p.distance_km !== null ? `${p.distance_km} KM away` : 'Nearby'}
                                </span>
                              </div>
                              <div className="flex flex-col text-right">
                                <span className="text-[10px] text-[#707973] uppercase font-bold">Service Area</span>
                                <span className="font-bold text-[#181a2e]">
                                  Up to {p.service_radius_km} KM
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-[#404943] line-clamp-2 leading-relaxed">
                              {p.bio || 'Wholesome, hot homestyle meals prepared daily with care and fresh spices.'}
                            </p>
                          </div>

                          <div className="space-y-3 pt-2">
                            <div className="p-2.5 bg-emerald-50/50 rounded-xl flex items-center justify-between text-xs text-[#181a2e] border border-emerald-100/70">
                              <span className="text-[#707973] font-medium">1-Day Lunch Thali:</span>
                              <span className="font-bold text-[#2d6a4f] text-sm">₹{p.single_meal_lunch_price || 110}</span>
                            </div>

                            <div className="pt-2 border-t border-black/5 flex items-center justify-between">
                              <span className={`text-xs font-bold ${p.food_type === 'Veg' ? 'text-emerald-700' : 'text-orange-700'}`}>
                                ● {p.food_type}
                              </span>
                              <button className="btn-pill btn-primary text-xs px-4 py-2 group-hover:bg-[#0f5238] shadow-xs">
                                <span>View Kitchen & Order</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 2: OTHER AVAILABLE PROVIDERS (NEARBY DISCOVERY LIMIT: 60 KM) */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-b border-black/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-xl text-[#181a2e]">
                      Other Available Providers
                    </h3>
                    <span className="text-xs text-[#707973]">
                      Nearby home chefs (15–30 KM away) outside your immediate delivery area
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                  {otherProviders.length} Nearby Kitchen{otherProviders.length === 1 ? '' : 's'}
                </span>
              </div>

              {otherProviders.length === 0 ? (
                <p className="text-xs text-[#707973] italic">No other nearby platform home chefs found within 15–30 KM.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-90 hover:opacity-100 transition-opacity">
                  {otherProviders.map((p) => {
                    const bannerImg = getProviderBannerImage(p);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (setSelectedProviderId) setSelectedProviderId(p.id);
                          setActiveTab('customer-provider-detail');
                        }}
                        className="glass-panel rounded-3xl hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between group border border-black/10 hover:border-gray-400 bg-white/80 overflow-hidden"
                      >
                        <div className="relative h-40 overflow-hidden border-b border-black/5">
                          <img 
                            src={bannerImg} 
                            alt={p.kitchen_name} 
                            className="w-full h-full object-cover grayscale-[25%] group-hover:grayscale-0 transition-all duration-300" 
                          />
                          <div className="absolute top-3 left-3 bg-gray-900/85 backdrop-blur-md text-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-xs">
                            <AlertCircle className="w-3 h-3 text-amber-300" />
                            <span>Out of Delivery Area</span>
                          </div>
                          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-xs">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span>{p.total_reviews > 0 ? `${p.rating_avg}` : 'No ratings yet'}</span>
                          </div>
                        </div>

                        <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div>
                              <h4 className="font-heading font-bold text-lg text-[#181a2e] group-hover:text-[#2d6a4f] transition-colors line-clamp-1">
                                {p.kitchen_name}
                              </h4>
                              <p className="text-xs text-[#707973]">
                                Chef: {p.provider_name} • {p.food_type}
                              </p>
                            </div>

                            <div className="bg-amber-50/50 p-2.5 rounded-2xl border border-amber-200/60 text-[11px] space-y-1">
                              <div className="flex justify-between text-[#404943]">
                                <span>Distance from you:</span>
                                <span className="font-bold text-[#181a2e]">{p.distance_km !== null ? `${p.distance_km} KM` : 'N/A'}</span>
                              </div>
                              <div className="flex justify-between text-[#707973]">
                                <span>Kitchen Delivery Radius:</span>
                                <span>{p.service_radius_km} KM max</span>
                              </div>
                              <p className="text-[10px] text-amber-800 font-semibold pt-1 border-t border-amber-200/50">
                                ⚠️ Delivery not available at current location
                              </p>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-black/5 flex items-center justify-between">
                            <span className="text-xs font-bold text-[#181a2e]">₹{p.single_meal_lunch_price || 110}</span>
                            <button className="btn-pill btn-outline text-xs px-3 py-1.5 text-gray-700 hover:bg-gray-100 border-black/15 group-hover:border-[#2d6a4f]">
                              <span>Browse Kitchen Only</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CANCEL ORDER CONFIRMATION DIALOG MODAL */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="glass-modal rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 bg-white border border-black/10">
            <div className="flex items-center justify-between pb-3 border-b border-black/10">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-heading font-extrabold text-lg text-[#181a2e]">
                  Cancel Order
                </h3>
              </div>
              <button 
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancellingOrderId(null);
                }} 
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-sm font-semibold text-[#181a2e]">
              Are you sure you want to cancel this order?
            </p>

            <p className="text-xs text-[#707973] leading-relaxed">
              Your cancellation will be processed immediately. If eligible, your refund will be credited back automatically.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-black/5">
              <button
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancellingOrderId(null);
                }}
                className="btn-pill btn-outline text-xs px-4 py-2.5 font-bold cursor-pointer"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                className="btn-pill bg-rose-600 hover:bg-rose-700 text-white text-xs px-5 py-2.5 font-bold shadow-md cursor-pointer"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RATING & REVIEW MODAL FOR TODAY'S DELIVERED MEALS */}
      {reviewModalOpen && reviewingOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="glass-modal rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 bg-white">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                Rate Today's Delivered Meal
              </h3>
              <button 
                onClick={() => setReviewModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Submit your rating to earn <strong>+5 Reward Points</strong> toward free meals!</span>
            </div>

            <div className="space-y-2 text-center">
              <span className="text-xs font-semibold text-[#707973]">Select Star Rating</span>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingValue(star)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= ratingValue
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-gray-100 text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#181a2e]">Your Review (Optional)</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Delicious meal, hot delivery, great seasoning..."
                rows={3}
                className="w-full px-3 py-2 rounded-2xl bg-white border border-black/10 text-xs text-[#181a2e] focus:outline-none focus:border-[#2d6a4f]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setReviewModalOpen(false)}
                className="btn-pill btn-outline text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="btn-pill btn-primary text-xs px-5 py-2 shadow-md"
              >
                {submittingReview ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Item Bill / Checkout Modal for Today's Fresh Special */}
      {directOrderModalOpen && selectedSpecialItem && (() => {
        const itemSubtotal = parseFloat(selectedSpecialItem.price) * specialOrderQty;
        const deliveryFee = 0.0;
        const finalPayable = Math.max(0, itemSubtotal - voucherDiscount + deliveryFee);
        const dishImg = getFoodImage(selectedSpecialItem.name, selectedSpecialItem.provider_food_type, selectedSpecialItem.meal_type);

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
            <div className="glass-modal rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 bg-white max-h-[90vh] overflow-y-auto border border-black/10">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#0f5238] flex items-center justify-center font-bold text-sm">
                    🥗
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#181a2e]">
                      Today's Fresh Special • Direct Bill
                    </h3>
                    <p className="text-[11px] text-[#707973]">
                      Instant single-meal order directly from home kitchen
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setDirectOrderModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-[#181a2e] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Item Card Overview */}
              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-emerald-50/40 border border-emerald-200/80">
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-black/10 shadow-2xs">
                  <img src={dishImg} alt={selectedSpecialItem.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-[#0f5238]">
                      {selectedSpecialItem.meal_type} Special
                    </span>
                    <span className={`text-[10px] font-bold ${selectedSpecialItem.provider_food_type === 'Non-Veg' ? 'text-rose-600' : 'text-emerald-700'}`}>
                      ● {selectedSpecialItem.provider_food_type || 'Homestyle'}
                    </span>
                  </div>
                  <h4 className="font-heading font-bold text-sm sm:text-base text-[#181a2e] truncate mt-0.5">
                    {selectedSpecialItem.name}
                  </h4>
                  <p className="text-xs text-[#707973] truncate">
                    Chef: {selectedSpecialItem.kitchen_name || selectedSpecialItem.provider_name}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-[#707973] block">Price</span>
                  <span className="font-heading font-black text-base text-[#0f5238]">
                    ₹{selectedSpecialItem.price}
                  </span>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-black/5">
                <div>
                  <span className="text-xs font-bold text-[#181a2e] block">Quantity / Portions</span>
                  <span className="text-[10px] text-[#707973]">Number of today's special meals</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSpecialOrderQty(Math.max(1, specialOrderQty - 1))}
                    disabled={specialOrderQty <= 1}
                    className="w-8 h-8 rounded-xl bg-white border border-black/10 hover:bg-emerald-50 text-[#181a2e] font-bold flex items-center justify-center disabled:opacity-40 transition-all shadow-2xs cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-heading font-black text-base text-[#181a2e] w-6 text-center">
                    {specialOrderQty}
                  </span>
                  <button
                    onClick={() => setSpecialOrderQty(Math.min(10, specialOrderQty + 1))}
                    className="w-8 h-8 rounded-xl bg-[#2d6a4f] text-white hover:bg-[#1b4332] font-bold flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Delivery Address & Time Info */}
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-2xl bg-white border border-black/8 space-y-1">
                  <div className="flex items-center gap-1.5 text-[#0f5238] font-bold">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Delivery Location</span>
                  </div>
                  <p className="text-[#181a2e] font-medium pl-5 truncate" title={deliveryLocation?.address || profile?.delivery_address}>
                    {deliveryLocation?.address || profile?.delivery_address || 'Current Detected Address'}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-center gap-2 text-[#775b06]">
                  <Clock className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Scheduled for <strong>Today's {selectedSpecialItem.meal_type} Delivery</strong> (Direct fresh preparation)</span>
                </div>
              </div>

              {/* Special Instructions */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#181a2e]">Special Cooking / Delivery Notes (Optional)</label>
                <input
                  type="text"
                  value={specialOrderNotes}
                  onChange={(e) => setSpecialOrderNotes(e.target.value)}
                  placeholder="e.g. Less spicy, leave at door, extra napkins..."
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 border border-black/10 text-xs text-[#181a2e] focus:bg-white focus:outline-none focus:border-[#2d6a4f]"
                />
              </div>

              {/* Voucher / Rewards Redemption */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#181a2e]">Apply Voucher / Reward Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={specialOrderVoucher}
                    onChange={(e) => {
                      setSpecialOrderVoucher(e.target.value);
                      if (voucherApplied) setVoucherApplied(false);
                    }}
                    placeholder="Enter promo or voucher code"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-gray-50 border border-black/10 text-xs uppercase font-mono text-[#181a2e] focus:bg-white focus:outline-none focus:border-[#2d6a4f]"
                  />
                  <button
                    onClick={handleApplyVoucher}
                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-emerald-50 hover:text-[#0f5238] border border-black/10 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {voucherApplied && (
                  <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Voucher applied: ₹{voucherDiscount} discount!
                  </p>
                )}
                {voucherError && (
                  <p className="text-[11px] font-bold text-rose-600">{voucherError}</p>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#181a2e]">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSpecialOrderPayment('UPI')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      specialOrderPayment === 'UPI' 
                        ? 'bg-[#2d6a4f]/10 border-[#2d6a4f] text-[#0f5238]' 
                        : 'bg-white border-black/10 text-[#404943] hover:bg-gray-50'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>UPI / QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpecialOrderPayment('COD')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      specialOrderPayment === 'COD' 
                        ? 'bg-[#2d6a4f]/10 border-[#2d6a4f] text-[#0f5238]' 
                        : 'bg-white border-black/10 text-[#404943] hover:bg-gray-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Cash on Delivery</span>
                  </button>
                </div>
              </div>

              {/* Bill Summary Breakdown */}
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-black/8 space-y-2">
                <div className="flex justify-between text-xs text-[#707973]">
                  <span>Item Subtotal ({specialOrderQty} × ₹{selectedSpecialItem.price})</span>
                  <span className="font-bold text-[#181a2e]">₹{itemSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#707973]">
                  <span>Delivery & Packaging Fee</span>
                  <span className="font-bold text-emerald-600">FREE</span>
                </div>
                {voucherDiscount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-700 font-bold">
                    <span>Voucher Discount</span>
                    <span>-₹{voucherDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-black/8 pt-2 flex justify-between items-center text-sm font-black text-[#181a2e]">
                  <span>Final Payable</span>
                  <span className="text-base text-[#0f5238]">₹{finalPayable.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDirectOrderModalOpen(false)}
                  className="btn-pill btn-outline flex-1 py-2.5 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSpecialOrder}
                  disabled={placingSpecialOrder}
                  className="btn-pill btn-primary flex-2 py-2.5 text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {placingSpecialOrder ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Placing Order...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Pay & Confirm (₹{finalPayable.toFixed(2)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Order Confirmed Success Modal */}
      {specialOrderSuccess && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in zoom-in-95">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 bg-white text-center border border-[#2d6a4f]/20">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#0f5238] flex items-center justify-center mx-auto shadow-md animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0f5238] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Payment Successful • Order Confirmed
              </span>
              <h3 className="font-heading font-black text-2xl text-[#181a2e]">
                Order Confirmed!
              </h3>
              <p className="text-xs text-[#707973]">
                Your fresh special <strong>{specialOrderSuccess.itemName}</strong> is being prepared by <strong>{specialOrderSuccess.kitchenName}</strong>.
              </p>
            </div>

            {/* OTP Showcase Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#2d6a4f]/10 to-[#e9c46a]/20 border border-[#2d6a4f]/25 space-y-1">
              <span className="text-[10px] font-bold text-[#0f5238] uppercase tracking-wider block">
                Your 4-Digit Delivery OTP
              </span>
              <span className="text-3xl font-mono font-black text-[#0f5238] tracking-widest block">
                {specialOrderSuccess.deliveryOtp}
              </span>
              <p className="text-[10px] text-[#707973]">
                Share this OTP with the delivery partner upon meal arrival
              </p>
            </div>

            <div className="text-xs text-[#707973] space-y-1 border-t border-black/5 pt-3 text-left">
              <div className="flex justify-between">
                <span>Order Number:</span>
                <span className="font-bold text-[#181a2e]">#{specialOrderSuccess.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span className="font-bold text-[#0f5238]">₹{specialOrderSuccess.finalAmount?.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSpecialOrderSuccess(null);
                const el = document.getElementById('kitchens-grid');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="btn-pill btn-primary w-full py-3 text-xs font-bold shadow-md cursor-pointer"
            >
              Track in Today's Active Orders
            </button>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {cancelModalOpen && cancellingOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in zoom-in-95">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 bg-white text-center border border-rose-200">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-md">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="font-heading font-black text-xl text-[#181a2e]">
                Are you sure you want to cancel this order?
              </h3>
              <p className="text-xs text-[#707973] leading-relaxed">
                If cancelled within 60 minutes of placing, you will receive a 90% instant refund as per cancellation policy.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#181a2e] block text-left mb-1.5">
                Cancellation Reason (Optional):
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Changed meal plans, emergency"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbf8ff] border border-black/10 text-xs text-[#181a2e] focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancellingOrderId(null);
                  setCancelReason('');
                }}
                className="btn-pill btn-outline flex-1 py-2.5 text-xs font-bold cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                className="btn-pill bg-rose-600 hover:bg-rose-700 text-white flex-1 py-2.5 text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
