import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { Plus, Edit2, Trash2, Sparkles, CheckCircle2, Utensils, Lock, BarChart2 } from 'lucide-react';

export default function ProviderMenu() {
  const { t } = useI18n();
  const [menuItems, setMenuItems] = useState([]);
  const [prepFrequency, setPrepFrequency] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit dish modal
  const [dishModalOpen, setDishModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [mealType, setMealType] = useState('LUNCH');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(110);
  const [isSpeciality, setIsSpeciality] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);

  const [actionMsg, setActionMsg] = useState('');

  const fetchMenuData = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [mRes, pRes] = await Promise.all([
        fetch('/api/provider/menu', { headers }),
        fetch('/api/provider/prep-frequency', { headers })
      ]);

      if (mRes.ok) {
        const mData = await mRes.json();
        setMenuItems(mData.menuItems || []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPrepFrequency(pData.prepFrequency || []);
      }
    } catch (err) {
      console.error('Failed to load menu data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
  }, []);

  const handleOpenAdd = () => {
    setEditingItemId(null);
    setMealType('LUNCH');
    setName('');
    setDescription('');
    setPrice(110);
    setIsSpeciality(false);
    setIsAvailable(true);
    setDishModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItemId(item.id);
    setMealType(item.meal_type);
    setName(item.name);
    setDescription(item.description || '');
    setPrice(item.price);
    setIsSpeciality(item.is_speciality === 1);
    setIsAvailable(item.is_available === 1);
    setDishModalOpen(true);
  };

  const handleSaveDish = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const url = editingItemId ? `/api/provider/menu/item/${editingItemId}` : '/api/provider/menu/item';
      const method = editingItemId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          meal_type: mealType,
          name,
          description,
          price: parseFloat(price),
          is_speciality: isSpeciality,
          is_available: isAvailable
        })
      });

      if (!res.ok) throw new Error('Failed to save dish');

      setActionMsg(editingItemId ? 'Dish updated.' : 'New dish added to today\'s menu!');
      setDishModalOpen(false);
      fetchMenuData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteDish = async (id) => {
    if (!confirm('Are you sure you want to remove this dish?')) return;
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/provider/menu/item/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete dish');
      setActionMsg('Dish removed from menu.');
      fetchMenuData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleConfirmLock = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/provider/menu/confirm', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setActionMsg(data.message);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
            {t('nav.menu')}
          </h1>
          <p className="text-xs sm:text-sm text-[#404943]">
            Manage today's lunch and dinner items, speciality recommendations, and confirm menu lock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="btn-pill btn-primary text-xs px-5 py-2.5 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>{t('provider.add_dish')}</span>
          </button>

          <button
            onClick={handleConfirmLock}
            className="btn-pill bg-amber-500 hover:bg-amber-600 text-white text-xs px-5 py-2.5 shadow-md"
          >
            <Lock className="w-4 h-4" />
            <span>{t('provider.confirm_menu_lock')}</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-sm animate-in fade-in">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* DISHES LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => (
          <div key={item.id} className="glass-panel p-5 rounded-3xl space-y-3 flex flex-col justify-between shadow-md border border-black/5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${item.meal_type === 'LUNCH' ? 'bg-amber-100 text-amber-900' : 'bg-indigo-100 text-indigo-900'}`}>
                  {item.meal_type}
                </span>
                {item.is_speciality === 1 && (
                  <span className="text-[10px] font-bold bg-[#e9c46a]/20 text-[#775b06] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Speciality
                  </span>
                )}
              </div>

              <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                {item.name}
              </h3>

              <p className="text-xs text-[#404943] leading-relaxed line-clamp-2">
                {item.description || 'Prepared fresh with pure authentic spices.'}
              </p>
            </div>

            <div className="pt-3 border-t border-black/5 flex items-center justify-between">
              <span className="text-base font-black text-[#2d6a4f]">₹{item.price}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="p-1.5 rounded-full hover:bg-black/5 text-[#404943]"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteDish(item.id)}
                  className="p-1.5 rounded-full hover:bg-rose-50 text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FOOD PREPARATION FREQUENCY ANALYTICS */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-[#2d6a4f]" />
            <div>
              <h2 className="font-heading font-bold text-xl text-[#181a2e]">
                {t('provider.prep_frequency_title')}
              </h2>
              <p className="text-xs text-[#707973]">
                Individual food item preparation schedule & cooking frequency
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {prepFrequency.map((f, i) => {
            const freqLabel = f.frequency || (f.count >= 50 ? 'Daily' : f.count >= 40 ? '5 times/week' : f.count >= 30 ? '4 times/week' : f.count >= 20 ? '3 times/week' : f.count >= 10 ? '2 times/week' : 'Weekly');
            return (
              <div key={i} className="p-4 bg-white/90 rounded-2xl border border-black/5 shadow-xs space-y-2 hover:border-[#2d6a4f]/30 transition-all">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-bold text-[#181a2e] truncate">{f.name}</span>
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-[#0f5238] border border-emerald-200 shrink-0">
                    {freqLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#707973]">
                  <span>Item Schedule:</span>
                  <span className="font-semibold text-[#181a2e]">{f.name} → {freqLabel}</span>
                </div>
                <div className="w-full bg-black/5 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#2d6a4f] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(20, (f.count || 1) * 2))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD/EDIT DISH MODAL */}
      {dishModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/10">
              <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                {editingItemId ? 'Edit Menu Dish' : t('provider.add_dish')}
              </h3>
              <button onClick={() => setDishModalOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveDish} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1">Meal Slot:</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setMealType('LUNCH')}
                    className={`p-2 rounded-xl border ${mealType === 'LUNCH' ? 'bg-[#2d6a4f] text-white' : 'bg-white text-[#404943]'}`}
                  >
                    Lunch
                  </button>
                  <button
                    type="button"
                    onClick={() => setMealType('DINNER')}
                    className={`p-2 rounded-xl border ${mealType === 'DINNER' ? 'bg-[#2d6a4f] text-white' : 'bg-white text-[#404943]'}`}
                  >
                    Dinner
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1">
                  {t('provider.dish_name')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Yellow Dal Tadka with Steamed Rice"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-xs text-[#181a2e]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1">
                  {t('provider.dish_desc')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ingredients, preparation style..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-xs text-[#181a2e]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#181a2e] block mb-1">
                  {t('provider.dish_price')} *
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="110"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-xs text-[#181a2e]"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#181a2e]">
                  <input
                    type="checkbox"
                    checked={isSpeciality}
                    onChange={(e) => setIsSpeciality(e.target.checked)}
                    className="w-4 h-4 text-[#2d6a4f] rounded"
                  />
                  <span>{t('provider.is_speciality')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#181a2e]">
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="w-4 h-4 text-[#2d6a4f] rounded"
                  />
                  <span>Dish Available for Ordering Today</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full btn-pill btn-primary py-3 text-xs font-bold shadow-md mt-2"
              >
                Save Dish to Menu
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
