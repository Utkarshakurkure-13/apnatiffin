import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import StatusBadge from '../../components/common/StatusBadge';
import { ShoppingBag, Search, AlertOctagon, CheckCircle2, Camera } from 'lucide-react';

export default function AdminOrders() {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      let url = '/api/admin/orders?';
      if (statusFilter !== 'ALL') url += `status=${statusFilter}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, search]);

  const handleFailOrder = async (orderId) => {
    if (!confirm('Are you sure you want to mark this delivery as FAILED? (This triggers a 20% Provider Penalty, 10 Penalty Points, and Full Customer Refund).')) return;
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/admin/orders/${orderId}/fail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: 'Delivery failure verified by admin' })
      });
      if (!res.ok) throw new Error('Failed to update order');
      fetchOrders();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
            Marketplace Order Oversight
          </h1>
          <p className="text-xs sm:text-sm text-[#404943]">
            Real-time monitoring of customer orders, OTP verification records, and delivery proofs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-2xl bg-white border border-black/10 text-xs font-bold text-[#181a2e]"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="PREPARING">Preparing</option>
            <option value="READY">Ready</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="FAILED">Failed</option>
          </select>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order #, customer, kitchen..."
              className="px-4 py-2 pl-9 rounded-2xl bg-white border border-black/10 text-xs w-60 shadow-xs"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#707973] font-semibold">{t('common.loading')}</div>
      ) : (
        <div className="glass-panel rounded-3xl overflow-hidden shadow-xl border border-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#181a2e]">
              <thead className="bg-[#f4f2ff] text-[#707973] uppercase text-[10px] tracking-wider border-b border-black/5 font-bold">
                <tr>
                  <th className="py-3.5 px-4">Order Number / Date</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Home Kitchen</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Delivery Verification</th>
                  <th className="py-3.5 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-white/50">
                    <td className="py-4 px-4 font-mono">
                      <span className="font-bold text-[#181a2e] block">#{ord.order_number}</span>
                      <span className="text-[10px] text-[#707973]">{new Date(ord.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-bold text-[#181a2e] block">{ord.customer_name}</span>
                      <span className="text-[11px] text-[#707973]">{ord.customer_mobile}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-bold text-[#181a2e] block">{ord.kitchen_name}</span>
                      <span className="text-[11px] text-[#707973]">Chef: {ord.provider_name}</span>
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-sm text-[#2d6a4f]">
                      ₹{ord.final_amount.toFixed(2)}
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge status={ord.order_status} />
                    </td>
                    <td className="py-4 px-4">
                      {ord.order_status === 'DELIVERED' ? (
                        <div className="space-y-0.5">
                          <span className="text-[11px] text-emerald-800 font-bold block flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> OTP Verified
                          </span>
                          {ord.delivery_proof_url && (
                            <a href={ord.delivery_proof_url} target="_blank" rel="noreferrer" className="text-[10px] text-[#e07a5f] hover:underline flex items-center gap-1">
                              <Camera className="w-3 h-3" /> View Photo Proof
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-gray-500">
                          Active OTP: {ord.delivery_otp}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {['NEW', 'ACCEPTED', 'PREPARING', 'READY'].includes(ord.order_status) && (
                        <button
                          onClick={() => handleFailOrder(ord.id)}
                          className="px-2.5 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition-colors"
                        >
                          Mark Failed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
