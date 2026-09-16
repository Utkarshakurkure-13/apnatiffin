import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { Sparkles, Gift, Award, ArrowUpRight, CheckCircle2, Copy } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CustomerPoints({ setActiveTab }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('aapna_tiffin_token');
    fetch('/api/customer/points', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load points data', err);
        setLoading(false);
      });
  }, []);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
          {t('nav.points')}
        </h1>
        <p className="text-xs sm:text-sm text-[#404943]">
          Earn loyalty points on reviews & orders. Unlock 1 Free 1-Day Meal at every 100 points!
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#707973] font-semibold">{t('common.loading')}</div>
      ) : (
        <>
          {/* Top Milestone Card */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl border border-[#e9c46a]/30 relative overflow-hidden space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#775b06] uppercase tracking-wider block">
                  Current Points Balance
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading font-black text-4xl sm:text-5xl text-[#181a2e]">
                    {data?.totalPoints || 0}
                  </span>
                  <span className="text-sm font-bold text-[#2d6a4f]">Reward Points</span>
                </div>
              </div>

              <div className="p-4 bg-[#e9c46a]/15 border border-[#e9c46a]/30 rounded-2xl flex items-center gap-3">
                <Gift className="w-8 h-8 text-[#775b06]" />
                <div>
                  <span className="text-xs font-bold text-[#775b06] block">Next Reward Target</span>
                  <span className="text-sm font-black text-[#181a2e]">
                    {100 - (data?.progressToNext || 0)} pts needed for next Free Meal
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar towards next 100-point milestone */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-[#404943]">
                <span>Progress to {data?.nextMilestone || 100} Points</span>
                <span>{data?.progressToNext || 0} / 100 Points</span>
              </div>
              <div className="w-full bg-black/5 h-3 rounded-full overflow-hidden p-0.5 border border-black/5">
                <div
                  className="bg-gradient-to-r from-[#2d6a4f] to-[#e9c46a] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data?.progressToNext || 0)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Unlocked Free Meal Vouchers */}
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-xl text-[#181a2e] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#2d6a4f]" />
              <span>{t('customer.unlocked_vouchers')}</span>
            </h2>

            {data?.rewards?.length === 0 ? (
              <div className="glass-panel p-6 rounded-2xl text-center text-[#707973] text-xs font-semibold">
                No vouchers unlocked yet. Complete 100 points to receive your first free meal code!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {data?.rewards?.map((r) => (
                  <div key={r.id} className="glass-panel p-5 rounded-3xl border border-[#2d6a4f]/25 shadow-md space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                        {r.is_redeemed ? 'Redeemed' : 'Active Voucher'}
                      </span>
                      <span className="text-xs font-bold text-[#2d6a4f]">Worth ₹{r.free_meal_value}</span>
                    </div>

                    <div>
                      <h4 className="font-heading font-bold text-base text-[#181a2e]">
                        1 Free 1-Day Meal
                      </h4>
                      <p className="text-[11px] text-[#404943]">
                        {r.milestone_points} Points Milestone Reward
                      </p>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-dashed border-[#2d6a4f] flex items-center justify-between font-mono font-bold text-xs">
                      <span>{r.reward_code}</span>
                      <button
                        onClick={() => handleCopy(r.reward_code)}
                        className="text-xs text-[#2d6a4f] hover:text-[#0f5238] flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedCode === r.reward_code ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Points Transaction Ledger */}
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-xl text-[#181a2e]">
              Points Ledger & History
            </h2>

            <div className="glass-panel rounded-3xl overflow-hidden shadow-lg border border-black/5">
              <table className="w-full text-left text-xs text-[#181a2e]">
                <thead className="bg-[#f4f2ff] text-[#707973] uppercase text-[10px] tracking-wider border-b border-black/5 font-bold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Reason / Activity</th>
                    <th className="py-3 px-4">Related Order</th>
                    <th className="py-3 px-4">Points Change</th>
                    <th className="py-3 px-4">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {data?.history?.map((h) => (
                    <tr key={h.id} className="hover:bg-white/50">
                      <td className="py-3.5 px-4 text-[#707973]">
                        {new Date(h.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-semibold">
                        {h.reason}
                      </td>
                      <td className="py-3.5 px-4">
                        {h.order_number ? `#${h.order_number}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">
                        +{h.points_change} Pts
                      </td>
                      <td className="py-3.5 px-4 font-bold font-mono">
                        {h.balance_after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
