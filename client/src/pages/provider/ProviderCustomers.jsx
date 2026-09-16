import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { Users, Phone, MapPin, ShoppingBag, Utensils } from 'lucide-react';

export default function ProviderCustomers() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('aapna_tiffin_token');
    fetch('/api/provider/customers', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setCustomers(data.customers || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load customers', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
          {t('nav.customers')}
        </h1>
        <p className="text-xs sm:text-sm text-[#404943]">
          Customer contacts, active meal subscriptions, extra roti preferences, and order history.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#707973] font-semibold">{t('common.loading')}</div>
      ) : customers.length === 0 ? (
        <div className="glass-panel p-10 rounded-3xl text-center text-[#707973] space-y-3">
          <Users className="w-10 h-10 mx-auto text-gray-300" />
          <p className="font-semibold">No customers yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map((c) => (
            <div key={c.id} className="glass-panel p-6 rounded-3xl space-y-4 shadow-md border border-black/5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#2d6a4f]/15 text-[#2d6a4f] font-bold text-sm flex items-center justify-center">
                  {c.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-[#181a2e]">
                    {c.full_name}
                  </h3>
                  <span className="text-xs text-[#707973] flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {c.mobile}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-[#404943] bg-white/70 p-3.5 rounded-2xl border border-black/5">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#e07a5f] shrink-0 mt-0.5" />
                  <span className="leading-snug">{c.delivery_address}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-black/5">
                  <span>Total Orders:</span>
                  <span className="font-bold text-[#181a2e]">{c.total_orders} meals</span>
                </div>
                {c.total_extra_rotis > 0 && (
                  <div className="flex justify-between text-[#2d6a4f] font-bold">
                    <span>Extra Rotis Ordered:</span>
                    <span>{c.total_extra_rotis} pcs</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
