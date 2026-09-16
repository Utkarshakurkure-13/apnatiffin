import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import StatusBadge from '../../components/common/StatusBadge';
import { Utensils, CheckCircle2, Search, Filter, AlertCircle, XCircle } from 'lucide-react';

export default function ProviderOrders() {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // Cancellation state
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Kitchen capacity full');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [cancellingLoading, setCancellingLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const url = filterStatus === 'ALL' ? '/api/provider/orders' : `/api/provider/orders?status=${filterStatus}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to load provider orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filterStatus]);

  const handleCancelOrder = async () => {
    if (!cancellingOrderId) return;
    setCancellingLoading(true);
    const finalReason = rejectReason === 'Other' ? customRejectReason : rejectReason;
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/provider/orders/${cancellingOrderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: finalReason || 'Provider cancelled order' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel order');

      setActionMsg('Order cancelled successfully.');
      setCancelModalOpen(false);
      setCancellingOrderId(null);
      setCustomRejectReason('');
      fetchOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setCancellingLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
            {t('nav.todays_orders')} & History
          </h1>
          <p className="text-xs sm:text-sm text-[#404943]">
            Complete log of all customer orders, meal plans, delivery states, and addresses.
          </p>
        </div>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 rounded-2xl bg-white border border-black/10 text-xs font-bold text-[#181a2e] shadow-xs"
        >
          <option value="ALL">All Orders</option>
          <option value="NEW">New</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="PREPARING">Preparing</option>
          <option value="READY">Ready</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {actionMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold animate-in fade-in shadow-xs">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-emerald-700 hover:text-emerald-900 font-bold px-2">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[#707973] font-semibold">{t('common.loading')}</div>
      ) : orders.length === 0 ? (
        <div className="glass-panel p-10 rounded-3xl text-center text-[#707973] space-y-3">
          <Utensils className="w-10 h-10 mx-auto text-gray-300" />
          <p className="font-semibold">No orders found for this status.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => {
            const isEligibleForCancel = ['NEW', 'ACCEPTED', 'PREPARING', 'READY'].includes(ord.order_status);
            return (
              <div key={ord.id} className="glass-panel p-5 sm:p-6 rounded-3xl shadow-md border border-black/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#181a2e]">#{ord.order_number}</span>
                    <StatusBadge status={ord.order_status} />
                    <span className="text-xs text-[#707973]">
                      • {new Date(ord.created_at).toLocaleDateString()} at {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                    {ord.customer_name} ({ord.customer_mobile})
                  </h3>

                  <p className="text-xs text-[#404943]">
                    Plan: <span className="font-bold">{ord.plan_type}</span> ({ord.meal_type}) • {ord.extra_roti_count > 0 ? `+${ord.extra_roti_count} Extra Rotis` : 'Standard Roti'}
                  </p>

                  <p className="text-xs text-[#707973]">
                    Delivery Address: {ord.delivery_address}
                  </p>

                  {ord.special_instructions && (
                    <p className="text-xs text-amber-800 bg-amber-50 p-1.5 rounded-lg inline-block">
                      Special Note: {ord.special_instructions}
                    </p>
                  )}
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-black/5">
                  <div>
                    <span className="text-[10px] text-[#707973] uppercase font-bold block md:text-right">Order Amount</span>
                    <span className="text-lg font-black text-[#2d6a4f]">₹{ord.final_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEligibleForCancel && (
                      <button
                        onClick={() => {
                          setCancellingOrderId(ord.id);
                          setCancelModalOpen(true);
                        }}
                        className="btn-pill bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs px-3.5 py-1.5 font-bold cursor-pointer transition-colors"
                      >
                        Cancel Order
                      </button>
                    )}
                    <span className="text-[11px] font-mono text-gray-400">
                      OTP: {ord.order_status === 'DELIVERED' ? 'Verified' : 'Pending Customer'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {cancelModalOpen && cancellingOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in zoom-in-95">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 bg-white text-center border border-rose-200">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-md">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-black text-xl text-[#181a2e]">
                Are you sure you want to cancel this order?
              </h3>
              <p className="text-xs text-[#707973] leading-relaxed">
                The customer will be notified and issued an immediate full refund.
              </p>
            </div>

            <div className="text-left space-y-1.5">
              <label className="text-[11px] font-bold text-[#181a2e] block">
                Select Reason for Cancellation:
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbf8ff] border border-black/10 text-xs font-semibold text-[#181a2e] focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              >
                <option value="Kitchen capacity full">Kitchen capacity full</option>
                <option value="Ingredients unavailable">Ingredients unavailable</option>
                <option value="Kitchen closed / emergency">Kitchen closed / emergency</option>
                <option value="Outside delivery radius">Outside delivery radius</option>
                <option value="Other">Other reason</option>
              </select>

              {rejectReason === 'Other' && (
                <input
                  type="text"
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  placeholder="Enter custom cancellation reason"
                  className="w-full mt-2 px-3.5 py-2.5 rounded-xl bg-[#fbf8ff] border border-black/10 text-xs text-[#181a2e] focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancellingOrderId(null);
                  setCustomRejectReason('');
                }}
                className="btn-pill btn-outline flex-1 py-2.5 text-xs font-bold cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={cancellingLoading}
                className="btn-pill bg-rose-600 hover:bg-rose-700 text-white flex-1 py-2.5 text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {cancellingLoading ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
