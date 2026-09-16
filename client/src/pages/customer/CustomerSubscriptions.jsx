import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import StatusBadge from '../../components/common/StatusBadge';
import SmartSubscriptionCalendar from '../../components/customer/SmartSubscriptionCalendar';
import { getFoodImage, getProviderBannerImage } from '../../utils/foodImages';
import { Calendar, PauseCircle, PlayCircle, Utensils, CheckCircle, Clock, ChefHat, Sparkles, ChevronRight, CalendarCheck } from 'lucide-react';

export default function CustomerSubscriptions() {
  const { t } = useI18n();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubId, setSelectedSubId] = useState(null);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseTargetSubId, setPauseTargetSubId] = useState(null);
  const [resumeDate, setResumeDate] = useState('');

  const fetchSubscriptions = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/customer/subscriptions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const subs = data.subscriptions || [];
        setSubscriptions(subs);
        if (subs.length > 0 && !selectedSubId) {
          // Select first active subscription by default
          const activeSub = subs.find(s => s.status === 'ACTIVE') || subs[0];
          setSelectedSubId(activeSub.id);
        }
      }
    } catch (err) {
      console.error('Failed to load subscriptions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handlePause = async () => {
    if (!pauseTargetSubId) return;
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/customer/subscriptions/${pauseTargetSubId}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resume_date: resumeDate || '2026-09-20' })
      });
      if (!res.ok) throw new Error('Failed to pause subscription');
      setPauseModalOpen(false);
      setPauseTargetSubId(null);
      fetchSubscriptions();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResume = async (subId) => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/customer/subscriptions/${subId}/resume`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to resume subscription');
      fetchSubscriptions();
    } catch (err) {
      alert(err.message);
    }
  };

  const activeSub = subscriptions.find(s => s.id === selectedSubId) || subscriptions[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
            {t('nav.subscriptions')}
          </h1>
          <p className="text-xs sm:text-sm text-[#404943] mt-1">
            Manage your daily home kitchen meal plans, pause when traveling, and track remaining meals.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[#707973] font-semibold space-y-2">
          <Clock className="w-8 h-8 animate-spin mx-auto text-[#2d6a4f]" />
          <p>{t('common.loading')}</p>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center text-[#707973] space-y-4">
          <Calendar className="w-12 h-12 mx-auto text-gray-300" />
          <h3 className="font-heading font-bold text-lg text-[#181a2e]">No Active Subscriptions</h3>
          <p className="text-xs text-[#707973] max-w-sm mx-auto">
            You don't have an active subscription yet. Explore our home chefs on the Dashboard to start your daily tiffin plan!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* MULTI-PROVIDER SUBSCRIPTION SELECTOR TABS */}
          {subscriptions.length > 1 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#707973] uppercase tracking-wider block">
                Your Active Kitchen Subscriptions ({subscriptions.length}):
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {subscriptions.map((sub) => {
                  const isSelected = (selectedSubId === sub.id) || (!selectedSubId && sub.id === activeSub?.id);
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubId(sub.id)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 shadow-xs ${
                        isSelected
                          ? 'bg-[#2d6a4f] text-white shadow-md ring-2 ring-[#2d6a4f]/30'
                          : 'bg-white hover:bg-gray-50 text-[#181a2e] border border-black/10'
                      }`}
                    >
                      <ChefHat className={`w-4 h-4 ${isSelected ? 'text-amber-300' : 'text-[#2d6a4f]'}`} />
                      <div className="text-left">
                        <span className="block leading-tight">{sub.kitchen_name}</span>
                        <span className={`text-[10px] font-normal block ${isSelected ? 'text-emerald-100' : 'text-[#707973]'}`}>
                          {sub.plan_type} • {sub.meal_type}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DEDICATED SMART SUBSCRIPTION CALENDAR FOR THE SELECTED PROVIDER */}
          {activeSub && (
            <div className="space-y-4">
              <SmartSubscriptionCalendar 
                subscriptionId={activeSub.id} 
                onSubscriptionUpdated={fetchSubscriptions} 
              />
            </div>
          )}

          {/* ALL PROVIDER SUBSCRIPTIONS CARDS SECTION */}
          <div className="space-y-4 pt-4 border-t border-black/5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-extrabold text-xl text-[#181a2e]">
                All Kitchen Subscriptions
              </h2>
              <span className="text-xs text-[#707973] font-semibold">
                {subscriptions.length} Plan{subscriptions.length > 1 ? 's' : ''} Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {subscriptions.map((sub) => {
                const totalLunches = sub.total_lunch || 0;
                const usedLunches = sub.used_lunch || 0;
                const remLunches = Math.max(0, totalLunches - usedLunches);

                const totalDinners = sub.total_dinner || 0;
                const usedDinners = sub.used_dinner || 0;
                const remDinners = Math.max(0, totalDinners - usedDinners);

                const isCurrentlySelected = sub.id === activeSub?.id;
                const bannerImg = getProviderBannerImage({ kitchen_name: sub.kitchen_name, food_type: sub.food_type });

                return (
                  <div 
                    key={sub.id} 
                    className={`glass-panel p-6 rounded-3xl shadow-lg border transition-all space-y-5 ${
                      isCurrentlySelected 
                        ? 'border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20 bg-gradient-to-b from-emerald-50/20 to-white' 
                        : 'border-black/5 hover:border-black/15'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-black/10 shrink-0 shadow-xs">
                          <img src={bannerImg} alt={sub.kitchen_name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="badge-pill bg-[#2d6a4f] text-white text-[9px] font-bold uppercase">
                              {sub.plan_type}
                            </span>
                            <span className="badge-pill bg-amber-100 text-amber-900 text-[9px] font-bold">
                              {sub.meal_type}
                            </span>
                          </div>
                          <h3 className="font-heading font-bold text-lg text-[#181a2e] mt-0.5">
                            {sub.kitchen_name}
                          </h3>
                          <span className="text-xs text-[#707973] font-medium">
                            Chef {sub.provider_name}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={sub.status} />
                    </div>

                    {/* Validity Duration */}
                    <div className="flex items-center justify-between text-xs text-[#404943] bg-white/80 p-3 rounded-2xl border border-black/5">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#2d6a4f]" />
                        <span>Valid: <strong className="text-[#181a2e]">{sub.start_date}</strong> to <strong className="text-[#181a2e]">{sub.expiry_date}</strong></span>
                      </div>
                      {sub.extra_roti_per_meal > 0 && (
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          +{sub.extra_roti_per_meal} Roti/Meal
                        </span>
                      )}
                    </div>

                    {/* Meal Trackers */}
                    <div className="grid grid-cols-2 gap-3">
                      {totalLunches > 0 && (
                        <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs space-y-1">
                          <span className="font-bold text-amber-900 block">Lunch Tracker</span>
                          <div className="text-base font-black text-amber-950">
                            {remLunches} / {totalLunches} <span className="text-[10px] font-normal">left</span>
                          </div>
                          <div className="w-full bg-amber-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#2d6a4f] h-full" style={{ width: `${(usedLunches / Math.max(1, totalLunches)) * 100}%` }} />
                          </div>
                        </div>
                      )}

                      {totalDinners > 0 && (
                        <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200 text-xs space-y-1">
                          <span className="font-bold text-indigo-900 block">Dinner Tracker</span>
                          <div className="text-base font-black text-indigo-950">
                            {remDinners} / {totalDinners} <span className="text-[10px] font-normal">left</span>
                          </div>
                          <div className="w-full bg-indigo-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#e07a5f] h-full" style={{ width: `${(usedDinners / Math.max(1, totalDinners)) * 100}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions & Calendar Switcher */}
                    <div className="pt-3 border-t border-black/5 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setSelectedSubId(sub.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`btn-pill text-xs px-4 py-2 flex items-center gap-1.5 font-bold ${
                          isCurrentlySelected 
                            ? 'bg-emerald-100 text-[#0f5238] border border-emerald-300 cursor-default'
                            : 'btn-outline'
                        }`}
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        <span>{isCurrentlySelected ? '✓ Viewing Calendar' : 'View Calendar & Meals'}</span>
                      </button>

                      {sub.status === 'ACTIVE' ? (
                        <button
                          onClick={() => {
                            setPauseTargetSubId(sub.id);
                            setPauseModalOpen(true);
                          }}
                          className="btn-pill bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs px-3.5 py-2 flex items-center gap-1.5 font-semibold"
                        >
                          <PauseCircle className="w-3.5 h-3.5" />
                          <span>Pause Plan</span>
                        </button>
                      ) : sub.status === 'PAUSED' ? (
                        <button
                          onClick={() => handleResume(sub.id)}
                          className="btn-pill btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5 font-semibold"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Resume Plan</span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 font-semibold">Completed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {pauseModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-[#181a2e]">
              Pause Meal Subscription
            </h3>
            <p className="text-xs text-[#404943] leading-relaxed">
              Going on vacation or traveling? Pause your daily tiffin deliveries and select when you want them to automatically resume:
            </p>
            <input
              type="date"
              value={resumeDate}
              onChange={(e) => setResumeDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-xs text-[#181a2e]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPauseModalOpen(false)}
                className="btn-pill btn-outline text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handlePause}
                className="btn-pill btn-primary text-xs px-4 py-2 shadow-md"
              >
                Confirm Pause
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
