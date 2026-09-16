import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { getFoodImage } from '../../utils/foodImages';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Truck, 
  Utensils, 
  ChefHat, 
  Sparkles, 
  AlertCircle, 
  ChevronRight, 
  Info,
  CalendarCheck,
  ShieldAlert,
  ArrowRight,
  Star
} from 'lucide-react';

export default function SmartSubscriptionCalendar({ subscriptionId, onSubscriptionUpdated }) {
  const { t, language } = useI18n();
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDateItem, setSelectedDateItem] = useState(null);
  const [dateDetailsModalOpen, setDateDetailsModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedMealSlot, setSelectedMealSlot] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionFeedback, setActionFeedback] = useState('');

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const url = subscriptionId 
        ? `/api/customer/subscriptions/${subscriptionId}/calendar`
        : `/api/customer/subscriptions/active-calendar`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCalendarData(data);
      } else {
        setCalendarData(null);
      }
    } catch (err) {
      console.error('Failed to load subscription calendar', err);
      setCalendarData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [subscriptionId]);

  const handleOpenDateDetails = (dateItem) => {
    setSelectedDateItem(dateItem);
    setDateDetailsModalOpen(true);
  };

  const handleCancelDateMeal = async () => {
    if (!calendarData?.subscription?.id || !selectedDateItem || !selectedMealSlot) return;

    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/customer/subscriptions/${calendarData.subscription.id}/cancel-date`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          meal_date: selectedDateItem.date,
          meal_type: selectedMealSlot.mealType,
          reason: cancelReason || 'Customer requested date cancellation'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel meal');

      setActionFeedback(`Meal on ${selectedDateItem.date} cancelled. Refund of ₹${data.refundAmount.toFixed(2)} credited!`);
      setCancelModalOpen(false);
      setDateDetailsModalOpen(false);
      setCancelReason('');
      fetchCalendar();
      if (onSubscriptionUpdated) onSubscriptionUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>{t('calendar.status_delivered')}</span>
          </span>
        );
      case 'EN_ROUTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            <Truck className="w-3 h-3 text-amber-700" />
            <span>{t('calendar.status_out')}</span>
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300">
            <Utensils className="w-3 h-3 text-orange-700" />
            <span>{t('calendar.status_preparing')}</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 line-through">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>{t('calendar.status_cancelled')}</span>
          </span>
        );
      case 'CONFIRMED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
            <CalendarCheck className="w-3 h-3 text-teal-600" />
            <span>{t('calendar.status_confirmed')}</span>
          </span>
        );
    }
  };

  const formatDateLabel = (dateStr) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return {
        dayNum: d.getDate(),
        monthShort: d.toLocaleDateString(language === 'mr' ? 'mr-IN' : (language === 'hi' ? 'hi-IN' : 'en-US'), { month: 'short' }),
        weekdayShort: d.toLocaleDateString(language === 'mr' ? 'mr-IN' : (language === 'hi' ? 'hi-IN' : 'en-US'), { weekday: 'short' })
      };
    } catch (e) {
      return { dayNum: dateStr, monthShort: '', weekdayShort: '' };
    }
  };

  if (loading) {
    return (
      <div className="glass-panel p-8 rounded-3xl text-center text-[#707973] font-semibold space-y-2">
        <Clock className="w-8 h-8 animate-spin mx-auto text-[#2d6a4f]" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!calendarData?.subscription) {
    return (
      <div className="glass-panel p-8 rounded-3xl text-center space-y-3 border border-black/5">
        <CalendarIcon className="w-10 h-10 mx-auto text-gray-300" />
        <h3 className="font-heading font-bold text-lg text-[#181a2e]">
          {t('calendar.title')}
        </h3>
        <p className="text-xs text-[#404943] max-w-md mx-auto">
          {t('calendar.no_active_sub_calendar')}
        </p>
      </div>
    );
  }

  const { subscription, calendarDates } = calendarData;

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {actionFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold animate-in fade-in">
          <span>{actionFeedback}</span>
          <button onClick={() => setActionFeedback('')} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {/* SUBSCRIPTION SUMMARY CARD */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl border border-[#2d6a4f]/20 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/5 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="badge-pill bg-[#2d6a4f] text-white text-[11px] font-bold uppercase tracking-wider">
                {subscription.planType} PLAN
              </span>
              <span className="badge-pill bg-[#e9c46a]/30 text-[#775b06] text-[11px] font-bold">
                {subscription.mealType}
              </span>
              {subscription.extraRotiPerMeal > 0 && (
                <span className="badge-pill bg-amber-100 text-amber-900 text-[11px] font-bold">
                  +{subscription.extraRotiPerMeal} Extra Roti
                </span>
              )}
            </div>
            <h2 className="font-heading font-black text-2xl sm:text-3xl text-[#181a2e]">
              {subscription.kitchenName}
            </h2>
            <p className="text-xs text-[#707973] font-semibold">
              Chef {subscription.providerName} • Order #{subscription.orderNumber}
            </p>
          </div>

          <div className="bg-white/80 border border-black/8 p-3.5 rounded-2xl flex items-center gap-4 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#707973] uppercase">{t('calendar.start_date')}</span>
              <span className="font-bold text-[#181a2e]">{subscription.startDate}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#707973] uppercase">{t('calendar.end_date')}</span>
              <span className="font-bold text-[#2d6a4f]">{subscription.endDate}</span>
            </div>
          </div>
        </div>

        {/* METRICS TRACKERS (Meals, Lunch, Dinner Remaining) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white/70 border border-black/5 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#707973] uppercase">{t('calendar.meals_remaining')}</span>
              <Sparkles className="w-4 h-4 text-[#e9c46a]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-heading font-black text-[#181a2e]">{subscription.remainingMeals}</span>
              <span className="text-xs text-[#707973]">/ {subscription.totalMeals} total</span>
            </div>
            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-2">
              <div 
                className="bg-[#2d6a4f] h-full transition-all duration-500" 
                style={{ width: `${(subscription.remainingMeals / Math.max(1, subscription.totalMeals)) * 100}%` }}
              />
            </div>
          </div>

          {subscription.totalLunch > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase">{t('calendar.lunch_remaining')}</span>
                <span className="text-sm">☀️</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-black text-amber-950">{subscription.remainingLunch}</span>
                <span className="text-xs text-amber-800">/ {subscription.totalLunch}</span>
              </div>
              <div className="w-full bg-amber-200 h-1.5 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-[#2d6a4f] h-full transition-all duration-500" 
                  style={{ width: `${(subscription.remainingLunch / Math.max(1, subscription.totalLunch)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {subscription.totalDinner > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase">{t('calendar.dinner_remaining')}</span>
                <span className="text-sm">🌙</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-heading font-black text-indigo-950">{subscription.remainingDinner}</span>
                <span className="text-xs text-indigo-800">/ {subscription.totalDinner}</span>
              </div>
              <div className="w-full bg-indigo-200 h-1.5 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-[#e07a5f] h-full transition-all duration-500" 
                  style={{ width: `${(subscription.remainingDinner / Math.max(1, subscription.totalDinner)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SMART SUBSCRIPTION CALENDAR CONTAINER */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl border border-black/5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#2d6a4f]" />
              <h3 className="font-heading font-bold text-xl text-[#181a2e]">
                {subscription.kitchenName} • {t('calendar.title')}
              </h3>
            </div>
            <p className="text-xs text-[#707973] font-medium mt-0.5">
              Click any date to view today's live menu, delivered meal receipts, or manage upcoming scheduled deliveries.
            </p>
          </div>

          {/* STATUS LEGEND BAR */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold bg-white/70 p-2 rounded-2xl border border-black/5">
            <span className="text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 text-[10px]">
              {t('calendar.legend_delivered')}
            </span>
            <span className="text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 text-[10px]">
              {t('calendar.legend_en_route')}
            </span>
            <span className="text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 text-[10px]">
              {t('calendar.legend_confirmed')}
            </span>
            <span className="text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300 text-[10px]">
              {t('calendar.legend_cancelled')}
            </span>
          </div>
        </div>

        {/* DATE CARDS GRID (Showing only past subscription days + TODAY. Future days are hidden) */}
        {(() => {
          const todayStr = new Date().toISOString().split('T')[0];
          const visibleDates = (calendarDates || []).filter(d => d.date <= todayStr);

          if (visibleDates.length === 0) {
            return (
              <div className="col-span-full py-8 text-center text-[#707973] text-xs">
                No delivery days recorded yet for this subscription.
              </div>
            );
          }

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {visibleDates.map((dateItem) => {
                const { dayNum, monthShort, weekdayShort } = formatDateLabel(dateItem.date);

            let cardBorder = 'border-black/8 hover:border-[#2d6a4f]/50';
            let cardBg = 'bg-white/80';

            if (dateItem.isToday) {
              cardBorder = 'border-2 border-[#2d6a4f] shadow-md';
              cardBg = 'bg-gradient-to-b from-[#2d6a4f]/10 to-white';
            } else if (dateItem.isYesterday) {
              cardBorder = 'border-emerald-200';
              cardBg = 'bg-emerald-50/40';
            } else if (dateItem.isTomorrow) {
              cardBorder = 'border-teal-200';
              cardBg = 'bg-teal-50/40';
            }

            const hasDelivered = dateItem.meals.some(m => m.displayStatus === 'DELIVERED');
            const hasCancelled = dateItem.meals.every(m => m.displayStatus === 'CANCELLED');

            return (
              <div
                key={dateItem.date}
                onClick={() => handleOpenDateDetails(dateItem)}
                className={`p-3.5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3 hover:-translate-y-0.5 hover:shadow-lg ${cardBg} ${cardBorder}`}
              >
                {/* Header: Date + Day + Context Tag */}
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#707973] uppercase tracking-wider">
                      {weekdayShort}
                    </span>
                    <span className="text-xl font-heading font-black text-[#181a2e] leading-tight">
                      {dayNum} {monthShort}
                    </span>
                  </div>

                  {dateItem.isToday && (
                    <span className="bg-[#2d6a4f] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      {t('calendar.today')}
                    </span>
                  )}
                  {dateItem.isYesterday && (
                    <span className="bg-emerald-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {t('calendar.yesterday')}
                    </span>
                  )}
                  {dateItem.isTomorrow && (
                    <span className="bg-teal-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {t('calendar.tomorrow')}
                    </span>
                  )}
                </div>

                {/* Meals per Date */}
                <div className="space-y-1.5">
                  {dateItem.meals.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-1 text-[10px]">
                      <span className="font-bold text-[#404943]">
                        {m.mealType === 'LUNCH' ? '☀️ Lunch' : '🌙 Dinner'}
                      </span>
                      {getStatusBadge(m.displayStatus)}
                    </div>
                  ))}
                </div>

                {/* Footer details prompt according to Menu Visibility Rules */}
                <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[10px] font-medium">
                  {dateItem.isToday ? (
                    <span className="text-[#2d6a4f] font-bold flex items-center gap-1">
                      <span>☀️ Today's Menu</span>
                    </span>
                  ) : dateItem.isPast && hasDelivered ? (
                    <span className="text-emerald-800 font-semibold flex items-center gap-1">
                      <span>✓ Delivered Menu</span>
                    </span>
                  ) : hasCancelled ? (
                    <span className="text-rose-600 font-medium">✕ Cancelled</span>
                  ) : dateItem.isFuture ? (
                    <span className="text-[#707973]">📅 Scheduled</span>
                  ) : (
                    <span className="text-[#707973]">View Details</span>
                  )}
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                </div>
              </div>
            );
          })}
        </div>
      );
    })()}
    </div>

      {/* DATE DETAILS MODAL */}
      {dateDetailsModalOpen && selectedDateItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-black/5 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#707973] uppercase tracking-wider">
                    {formatDateLabel(selectedDateItem.date).weekdayShort}, {selectedDateItem.date}
                  </span>
                  {selectedDateItem.isToday && (
                    <span className="badge-pill bg-[#2d6a4f] text-white text-[10px] font-bold">
                      {t('calendar.today')}
                    </span>
                  )}
                  {selectedDateItem.isFuture && (
                    <span className="badge-pill bg-teal-100 text-teal-800 text-[10px] font-bold">
                      Upcoming Delivery
                    </span>
                  )}
                </div>
                <h3 className="font-heading font-black text-2xl text-[#181a2e]">
                  {selectedDateItem.isToday
                    ? "Today's Live Meal & Menu"
                    : selectedDateItem.isPast
                    ? "Delivered Meal Details"
                    : "Scheduled Delivery Details"}
                </h3>
              </div>
              <button
                onClick={() => setDateDetailsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Kitchen & Chef Info */}
            <div className="p-4 bg-white/80 rounded-2xl border border-black/5 space-y-1">
              <span className="text-[10px] font-bold text-[#707973] uppercase">{t('nav.chefs')}</span>
              <div className="font-heading font-bold text-base text-[#181a2e]">
                {subscription.kitchenName}
              </div>
              <p className="text-xs text-[#404943]">
                Chef: {subscription.providerName} • Contact: {subscription.providerMobile}
              </p>
            </div>

            {/* Meals on this Date */}
            <div className="space-y-4">
              {selectedDateItem.meals.map((meal) => (
                <div key={meal.id} className="p-4 rounded-2xl bg-white/90 border border-black/8 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-black/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-[#181a2e]">
                        {meal.mealType === 'LUNCH' ? '☀️ ' + t('calendar.lunch') : '🌙 ' + t('calendar.dinner')}
                      </span>
                      {meal.extraRoti > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                          +{meal.extraRoti} {t('calendar.extra_roti')}
                        </span>
                      )}
                    </div>
                    {getStatusBadge(meal.displayStatus)}
                  </div>

                  {/* Delivery details if available */}
                  {meal.deliveryTime && (
                    <div className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{t('calendar.delivery_time')}: {meal.deliveryTime}</span>
                    </div>
                  )}

                  {/* Today's Delivery OTP if today and not yet delivered */}
                  {selectedDateItem.isToday && meal.displayStatus !== 'DELIVERED' && meal.displayStatus !== 'CANCELLED' && (
                    <div className="p-3 bg-gradient-to-r from-[#2d6a4f]/10 to-[#e9c46a]/20 rounded-xl border border-[#2d6a4f]/20 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-[#0f5238] uppercase block">
                          {t('calendar.delivery_otp')}
                        </span>
                        <span className="text-[11px] text-[#404943]">Give OTP to chef upon arrival</span>
                      </div>
                      <span className="font-mono font-black text-xl text-[#0f5238] bg-white px-3 py-1 rounded-lg shadow-xs">
                        {meal.deliveryOtp}
                      </span>
                    </div>
                  )}

                  {/* Photo Delivery Proof */}
                  {meal.deliveryProofUrl && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-[#707973] uppercase">{t('calendar.delivery_proof')}</span>
                      <img src={meal.deliveryProofUrl} alt="Doorstep delivery proof" className="w-full h-32 object-cover rounded-xl border border-black/10" />
                    </div>
                  )}

                  {/* MENU VISIBILITY RULES:
                      1. TODAY: Show Today's Menu with Stitch food images.
                      2. PAST + DELIVERED: Show Delivered Menu with Stitch food images.
                      3. FUTURE: STRICTLY NEVER SHOW MENU OR FOOD IMAGES.
                      4. CANCELLED: NO MENU DISPLAYED.
                  */}
                  {selectedDateItem.isToday && !meal.cancellationStatus && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-[#2d6a4f] uppercase flex items-center gap-1">
                        <Utensils className="w-3.5 h-3.5" />
                        Today's Live Menu
                      </span>
                      {meal.menuSnapshot && meal.menuSnapshot.length > 0 ? (
                        <div className="space-y-2">
                          {meal.menuSnapshot.map((dish, idx) => {
                            const dishImg = getFoodImage(dish.name, subscription.foodType, meal.mealType);
                            return (
                              <div key={idx} className="p-2.5 bg-gray-50/90 rounded-2xl border border-black/5 flex items-center gap-3">
                                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-black/10 shadow-xs">
                                  <img src={dishImg} alt={dish.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="font-bold text-xs text-[#181a2e] flex items-center gap-1.5 flex-wrap">
                                    <span>{dish.name}</span>
                                    {dish.isSpeciality && (
                                      <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 rounded-full">Chef Special</span>
                                    )}
                                  </div>
                                  {dish.description && (
                                    <p className="text-[11px] text-[#707973] line-clamp-1">{dish.description}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50/80 rounded-xl text-xs text-amber-900 border border-amber-200">
                          🍳 Fresh daily homestyle menu is currently being cooked by Chef {subscription.providerName}.
                        </div>
                      )}
                    </div>
                  )}

                  {selectedDateItem.isPast && meal.displayStatus === 'DELIVERED' && !meal.cancellationStatus && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Delivered Menu
                      </span>
                      {meal.menuSnapshot && meal.menuSnapshot.length > 0 ? (
                        <div className="space-y-2">
                          {meal.menuSnapshot.map((dish, idx) => {
                            const dishImg = getFoodImage(dish.name, subscription.foodType, meal.mealType);
                            return (
                              <div key={idx} className="p-2.5 bg-emerald-50/40 rounded-2xl border border-emerald-200/60 flex items-center gap-3">
                                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-black/10 shadow-xs">
                                  <img src={dishImg} alt={dish.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="font-bold text-xs text-[#181a2e] flex items-center gap-1.5 flex-wrap">
                                    <span>{dish.name}</span>
                                    {dish.isSpeciality && (
                                      <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 rounded-full">Chef Special</span>
                                    )}
                                  </div>
                                  {dish.description && (
                                    <p className="text-[11px] text-[#707973] line-clamp-1">{dish.description}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-[#707973] italic">Delivered meal from {subscription.kitchenName}.</p>
                      )}
                    </div>
                  )}

                  {/* FUTURE DATES: Strictly NO menu, no food images */}
                  {selectedDateItem.isFuture && !meal.cancellationStatus && (
                    <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200/80 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-teal-900">
                        <CalendarCheck className="w-4 h-4 text-teal-700" />
                        <span>Confirmed Daily Tiffin Delivery</span>
                      </div>
                      <p className="text-[#404943] leading-relaxed">
                        Our home chefs arrange and cook fresh seasonal menus daily. The dish menu for this date will be announced by <strong>Chef {subscription.providerName}</strong> on the morning of preparation.
                      </p>
                    </div>
                  )}

                  {/* Cancellation & Refund info if cancelled */}
                  {meal.cancellationStatus && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>{t('calendar.cancellation_reason')}: {meal.cancellationReason || 'Cancelled by customer'}</span>
                      </div>
                      {meal.refundAmount > 0 && (
                        <p className="text-[11px] text-rose-800 pl-5">
                          ✓ {t('calendar.refund_credited')}: <span className="font-bold">₹{meal.refundAmount.toFixed(2)}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Meal Cancellation Option (if future and not already delivered/cancelled) */}
                  {selectedDateItem.isFuture && !meal.cancellationStatus && meal.displayStatus !== 'DELIVERED' && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setSelectedMealSlot(meal);
                          setCancelModalOpen(true);
                        }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-full transition-colors"
                      >
                        {t('calendar.cancel_meal_btn')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDateDetailsModalOpen(false)}
                className="btn-pill btn-primary text-xs px-5 py-2.5 shadow-md"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL DATE CONFIRMATION MODAL */}
      {cancelModalOpen && selectedMealSlot && selectedDateItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                {t('calendar.cancel_meal_btn')} ({selectedMealSlot.mealType})
              </h3>
            </div>
            
            <p className="text-xs text-[#404943] leading-relaxed">
              {t('calendar.cancel_meal_confirm')}
            </p>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
              <span className="font-bold">Date:</span> {selectedDateItem.date} ({selectedMealSlot.mealType})
            </div>

            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('calendar.cancel_reason_placeholder')}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-xs text-[#181a2e]"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="btn-pill btn-outline text-xs px-4 py-2"
              >
                {t('calendar.keep_meal')}
              </button>
              <button
                onClick={handleCancelDateMeal}
                className="btn-pill bg-rose-600 hover:bg-rose-700 text-white text-xs px-4 py-2 shadow-md"
              >
                {t('calendar.confirm_cancel_date')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
