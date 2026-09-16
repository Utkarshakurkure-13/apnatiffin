import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { Users, Search, Ban, CheckCircle, ShieldAlert } from 'lucide-react';

export default function AdminCustomers() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const url = search ? `/api/admin/customers?search=${encodeURIComponent(search)}` : '/api/admin/customers';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const handleToggleBlock = async (id) => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/admin/customers/${id}/toggle-block`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to update customer status');
      fetchCustomers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
            Customer Management
          </h1>
          <p className="text-xs sm:text-sm text-[#404943]">
            View customer details, total orders, points balance, and account standing.
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone..."
            className="px-4 py-2 pl-9 rounded-2xl bg-white border border-black/10 text-xs w-64 shadow-xs"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
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
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Contact & Address</th>
                  <th className="py-3.5 px-4">Orders Placed</th>
                  <th className="py-3.5 px-4">Total Spent</th>
                  <th className="py-3.5 px-4">Reward Points</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-white/50">
                    <td className="py-4 px-4">
                      <span className="font-bold text-[#181a2e] block">{c.full_name}</span>
                      <span className="text-[11px] text-[#707973]">{c.email}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="block">{c.mobile}</span>
                      <span className="text-[10px] text-[#707973] truncate max-w-[200px] block">{c.delivery_address}</span>
                    </td>
                    <td className="py-4 px-4 font-bold">
                      {c.total_orders} meals
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-[#2d6a4f]">
                      ₹{c.total_spent.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 font-bold text-amber-700">
                      {c.reward_points} pts
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${c.is_blocked === 1 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {c.is_blocked === 1 ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleToggleBlock(c.id)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${c.is_blocked === 1 ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
                      >
                        {c.is_blocked === 1 ? t('admin.unblock_user') : t('admin.block_user')}
                      </button>
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
