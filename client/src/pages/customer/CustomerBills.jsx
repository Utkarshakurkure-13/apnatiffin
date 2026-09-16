import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import StatusBadge from '../../components/common/StatusBadge';
import { Receipt, FileText, Download, CheckCircle, ArrowDownLeft, ShieldCheck } from 'lucide-react';

export default function CustomerBills() {
  const { t } = useI18n();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('aapna_tiffin_token');
    fetch('/api/customer/bills', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setBills(data.bills || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load bills', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
          {t('nav.bills')}
        </h1>
        <p className="text-xs sm:text-sm text-[#404943]">
          Complete itemized financial ledger, payments, cancellation deductions, and refund records.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#707973] font-semibold">{t('common.loading')}</div>
      ) : bills.length === 0 ? (
        <div className="glass-panel p-10 rounded-3xl text-center text-[#707973] space-y-3">
          <Receipt className="w-10 h-10 mx-auto text-gray-300" />
          <p className="font-semibold">No bills generated yet.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl overflow-hidden shadow-xl border border-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#181a2e]">
              <thead className="bg-[#f4f2ff] text-[#707973] uppercase text-[10px] tracking-wider border-b border-black/5 font-bold">
                <tr>
                  <th className="py-3.5 px-4">Invoice / Date</th>
                  <th className="py-3.5 px-4">Order & Kitchen</th>
                  <th className="py-3.5 px-4">Plan & Addons</th>
                  <th className="py-3.5 px-4">Base Amount</th>
                  <th className="py-3.5 px-4">Discount</th>
                  <th className="py-3.5 px-4">Net Paid</th>
                  <th className="py-3.5 px-4">Refund / Deduction</th>
                  <th className="py-3.5 px-4">Payment Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-white/50 transition-colors">
                    <td className="py-4 px-4">
                      <span className="font-mono font-bold text-[#181a2e] block">{b.bill_number}</span>
                      <span className="text-[10px] text-[#707973]">{new Date(b.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-bold block text-[#181a2e]">#{b.order_number}</span>
                      <span className="text-[11px] text-[#404943]">{b.kitchen_name}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-semibold block">{b.plan_meal_name} ({b.meal_slot})</span>
                      {b.extra_roti_count > 0 && (
                        <span className="text-[10px] text-[#2d6a4f] font-bold">+{b.extra_roti_count} Extra Rotis</span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-mono">
                      ₹{b.base_amount.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 font-mono text-emerald-700">
                      {b.discount > 0 ? `-₹${b.discount.toFixed(2)}` : '₹0.00'}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-sm text-[#2d6a4f]">
                      ₹{b.final_payable.toFixed(2)}
                    </td>
                    <td className="py-4 px-4">
                      {b.refund_amount > 0 ? (
                        <span className="text-orange-700 font-bold block text-[11px]">
                          Refund: ₹{b.refund_amount.toFixed(2)}
                          {b.cancellation_deduction > 0 && ` (Ded: ₹${b.cancellation_deduction.toFixed(2)})`}
                        </span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-[10px] text-gray-500 block truncate max-w-[120px]">
                        Txn: {b.transaction_id}
                      </span>
                      <span className="text-[11px] font-bold text-[#181a2e]">{b.payment_method} ({b.gateway})</span>
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
