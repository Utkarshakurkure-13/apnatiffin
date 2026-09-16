import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { Wallet, TrendingUp, Percent, AlertOctagon, CheckCircle2, ArrowDownRight } from 'lucide-react';

export default function ProviderEarnings() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('aapna_tiffin_token');
    fetch('/api/provider/earnings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load earnings', err);
        setLoading(false);
      });
  }, []);

  const summary = data?.summary || {};
  const bills = data?.bills || [];
  const payouts = data?.payouts || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
          {t('provider.earnings_title')}
        </h1>
        <p className="text-xs sm:text-sm text-[#404943]">
          Detailed financial accounting, commission deductions, penalty adjustments, and payouts.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#707973] font-semibold">{t('common.loading')}</div>
      ) : (
        <>
          {/* 4 Financial Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-panel p-6 rounded-3xl space-y-2 border border-black/5 shadow-md">
              <span className="text-[11px] font-bold text-[#707973] uppercase tracking-wider block">
                {t('provider.gross_sales')}
              </span>
              <span className="font-heading font-black text-2xl sm:text-3xl text-[#181a2e]">
                ₹{(summary.gross_income || 0).toFixed(2)}
              </span>
              <span className="text-[11px] text-[#2d6a4f] font-semibold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Total Order GMV
              </span>
            </div>

            <div className="glass-panel p-6 rounded-3xl space-y-2 border border-black/5 shadow-md">
              <span className="text-[11px] font-bold text-[#707973] uppercase tracking-wider block">
                {t('provider.platform_commission')}
              </span>
              <span className="font-heading font-black text-2xl sm:text-3xl text-purple-700">
                ₹{(summary.total_commission || 0).toFixed(2)}
              </span>
              <span className="text-[11px] text-[#707973]">
                15% Platform service fee
              </span>
            </div>

            <div className="glass-panel p-6 rounded-3xl space-y-2 border border-black/5 shadow-md">
              <span className="text-[11px] font-bold text-[#707973] uppercase tracking-wider block">
                {t('provider.penalties_deducted')}
              </span>
              <span className="font-heading font-black text-2xl sm:text-3xl text-rose-600">
                ₹{(summary.total_penalties || 0).toFixed(2)}
              </span>
              <span className="text-[11px] text-rose-700">
                Late cancellation / failure deductions
              </span>
            </div>

            <div className="glass-panel p-6 rounded-3xl space-y-2 bg-[#2d6a4f]/10 border border-[#2d6a4f]/25 shadow-lg">
              <span className="text-[11px] font-bold text-[#0f5238] uppercase tracking-wider block">
                {t('provider.net_payable')}
              </span>
              <span className="font-heading font-black text-2xl sm:text-3xl text-[#0f5238]">
                ₹{(summary.net_payout_payable || 0).toFixed(2)}
              </span>
              <span className="text-[11px] text-emerald-800 font-bold">
                Settled to your verified bank account
              </span>
            </div>
          </div>

          {/* Itemized Provider Bills */}
          <div className="space-y-4">
            <h2 className="font-heading font-bold text-xl text-[#181a2e]">
              Itemized Earnings Bills
            </h2>

            <div className="glass-panel rounded-3xl overflow-hidden shadow-lg border border-black/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#181a2e]">
                  <thead className="bg-[#f4f2ff] text-[#707973] uppercase text-[10px] tracking-wider border-b border-black/5 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Invoice #</th>
                      <th className="py-3.5 px-4">Order Details</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Gross Sale</th>
                      <th className="py-3.5 px-4">Commission (15%)</th>
                      <th className="py-3.5 px-4">Penalties</th>
                      <th className="py-3.5 px-4">Net Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {bills.map((b) => (
                      <tr key={b.id} className="hover:bg-white/50">
                        <td className="py-4 px-4 font-mono font-bold">
                          {b.bill_number}
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-bold block">#{b.order_number}</span>
                          <span className="text-[11px] text-[#404943]">{b.plan_meal_name} ({b.meal_slot})</span>
                        </td>
                        <td className="py-4 px-4 font-semibold">
                          {b.customer_name}
                        </td>
                        <td className="py-4 px-4 font-mono">
                          ₹{b.gross_amount.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 font-mono text-purple-700">
                          -₹{b.platform_commission.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 font-mono text-rose-600">
                          {b.provider_penalty > 0 ? `-₹${b.provider_penalty.toFixed(2)}` : '₹0.00'}
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-sm text-[#2d6a4f]">
                          ₹{b.final_payable.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
