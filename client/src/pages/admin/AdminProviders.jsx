import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { ChefHat, Search, ShieldCheck, Ban, CheckCircle } from 'lucide-react';

export default function AdminProviders() {
  const { t } = useI18n();
  const [providers, setProviders] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchProviders = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const url = search ? `/api/admin/providers?search=${encodeURIComponent(search)}` : '/api/admin/providers';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Failed to load providers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [search]);

  const handleToggleBlock = async (id) => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/admin/providers/${id}/toggle-block`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to update provider status');
      fetchProviders();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
            Home Chef & Kitchen Oversight
          </h1>
          <p className="text-xs sm:text-sm text-[#404943]">
            Verified home kitchens with automated KYC self-declarations, bank records, and penalty ledger.
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search kitchens or chefs..."
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
                  <th className="py-3.5 px-4">Kitchen & Chef</th>
                  <th className="py-3.5 px-4">KYC & Bank Account</th>
                  <th className="py-3.5 px-4">FSSAI Status</th>
                  <th className="py-3.5 px-4">Gross Sales</th>
                  <th className="py-3.5 px-4">Penalty Points</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-white/50">
                    <td className="py-4 px-4">
                      <span className="font-bold text-base text-[#181a2e] block">{p.kitchen_name}</span>
                      <span className="text-[11px] text-[#404943]">Chef {p.provider_name} • {p.email}</span>
                      <span className="text-[10px] text-[#707973] block">{p.kitchen_address}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-[11px] font-mono block text-[#181a2e]">{p.account_number_masked} ({p.ifsc_code})</span>
                      <span className="text-[10px] text-emerald-800 font-bold block">✓ KYC Self-Declaration Accepted</span>
                      <span className="text-[10px] text-gray-500 font-mono">Aadhaar: {p.aadhaar_masked}</span>
                    </td>
                    <td className="py-4 px-4">
                      {p.has_fssai === 1 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{p.fssai_number}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">Optional / Not Added</span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-sm text-[#2d6a4f]">
                      ₹{p.gross_sales.toFixed(2)}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`font-bold ${p.penalty_points > 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                        {p.penalty_points} pts
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${p.is_blocked === 1 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {p.is_blocked === 1 ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleToggleBlock(p.id)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${p.is_blocked === 1 ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
                      >
                        {p.is_blocked === 1 ? t('admin.unblock_user') : t('admin.block_user')}
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
