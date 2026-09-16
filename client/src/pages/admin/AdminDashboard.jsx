import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { Users, ChefHat, ShoppingBag, DollarSign, AlertTriangle, TrendingUp, ShieldCheck, ChevronRight } from 'lucide-react';

export default function AdminDashboard({ setActiveTab }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('aapna_tiffin_token');
    fetch('/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load admin metrics', err);
        setLoading(false);
      });
  }, []);

  const customers = data?.customers || {};
  const providers = data?.providers || {};
  const orders = data?.orders || {};
  const finance = data?.finance || {};
  const complaints = data?.complaints || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
          {t('admin.hub_title')}
        </h1>
        <p className="text-xs sm:text-sm text-[#404943]">
          Central platform governance, financial reconciliation, provider oversight, and automated safety controls.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#707973] font-semibold">{t('common.loading')}</div>
      ) : (
        <>
          {/* Main KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Customers */}
            <div 
              onClick={() => setActiveTab('admin-customers')}
              className="glass-panel p-6 rounded-3xl space-y-3 shadow-md hover:shadow-xl transition-all cursor-pointer group border border-black/5"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-[#2d6a4f]/10 text-[#2d6a4f] flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#707973] uppercase tracking-wider block">
                  {t('admin.total_customers')}
                </span>
                <span className="font-heading font-black text-3xl text-[#181a2e]">
                  {customers.total_customers || 0}
                </span>
              </div>
              <p className="text-xs text-[#404943]">
                {customers.blocked_customers || 0} Blocked / Restricted
              </p>
            </div>

            {/* Providers (NO KYC Approval Queue) */}
            <div 
              onClick={() => setActiveTab('admin-providers')}
              className="glass-panel p-6 rounded-3xl space-y-3 shadow-md hover:shadow-xl transition-all cursor-pointer group border border-black/5"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-[#e07a5f]/15 text-[#9a442d] flex items-center justify-center">
                  <ChefHat className="w-6 h-6" />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#707973] uppercase tracking-wider block">
                  {t('admin.active_providers')}
                </span>
                <span className="font-heading font-black text-3xl text-[#181a2e]">
                  {providers.active_providers || 0} / {providers.total_providers || 0}
                </span>
              </div>
              <p className="text-xs text-[#2d6a4f] font-semibold">
                ✓ Auto-KYC Self-Declaration Verified
              </p>
            </div>

            {/* Orders */}
            <div 
              onClick={() => setActiveTab('admin-orders')}
              className="glass-panel p-6 rounded-3xl space-y-3 shadow-md hover:shadow-xl transition-all cursor-pointer group border border-black/5"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#707973] uppercase tracking-wider block">
                  {t('admin.today_orders')}
                </span>
                <span className="font-heading font-black text-3xl text-[#181a2e]">
                  {orders.total_orders || 0}
                </span>
              </div>
              <p className="text-xs text-[#404943]">
                {orders.delivered_orders || 0} Delivered • {orders.active_orders || 0} In Progress
              </p>
            </div>
          </div>

          {/* Financial Reconciliation Overview */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl border border-black/5">
            <h2 className="font-heading font-bold text-xl text-[#181a2e] flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#2d6a4f]" />
              <span>Financial Settlement & Commission Ledger</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white/80 rounded-2xl border border-black/5 space-y-1">
                <span className="text-[11px] font-bold text-[#707973] uppercase tracking-wider block">
                  {t('admin.gross_revenue')}
                </span>
                <span className="font-heading font-black text-2xl text-[#181a2e]">
                  ₹{(finance.total_collected || 0).toFixed(2)}
                </span>
              </div>

              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-1">
                <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider block">
                  {t('admin.net_commission')}
                </span>
                <span className="font-heading font-black text-2xl text-purple-800">
                  ₹{(finance.total_commission_earned || 0).toFixed(2)}
                </span>
              </div>

              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-1">
                <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider block">
                  Refunds Processed
                </span>
                <span className="font-heading font-black text-2xl text-rose-700">
                  ₹{(finance.total_refunds_processed || 0).toFixed(2)}
                </span>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                  Provider Payable Balance
                </span>
                <span className="font-heading font-black text-2xl text-emerald-800">
                  ₹{(finance.provider_payable_balance || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
