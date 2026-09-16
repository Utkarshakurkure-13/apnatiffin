import React, { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import StatusBadge from '../../components/common/StatusBadge';
import { getFoodImage } from '../../utils/foodImages';
import { Star, MessageSquare, Utensils, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CustomerOrders({ setActiveTab }) {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  // Cancellation state
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingOrderLoading, setCancellingOrderLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/customer/orders', {
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
  }, []);

  const handleOpenReview = (order) => {
    setSelectedOrder(order);
    setRating(order.rating || 5);
    setReviewText(order.review_text || '');
    setReviewModalOpen(true);
    setReviewMessage('');
  };

  const handleSubmitReview = async () => {
    if (!selectedOrder) return;
    setSubmittingReview(true);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch('/api/customer/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          rating,
          review_text: reviewText
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit review');

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      setReviewMessage('Thank you! Review saved and +5 Loyalty Points awarded.');
      fetchOrders();
      setTimeout(() => setReviewModalOpen(false), 1500);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancellingOrderId) return;
    setCancellingOrderLoading(true);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/customer/orders/${cancellingOrderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: cancelReason || 'Customer requested cancellation' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel order');

      setActionMessage('Order cancelled successfully.');
      setCancelModalOpen(false);
      setCancellingOrderId(null);
      setCancelReason('');
      fetchOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setCancellingOrderLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
            {t('nav.orders')}
          </h1>
          <p className="text-xs sm:text-sm text-[#404943]">
            Track your meal orders, delivery status, and share feedback.
          </p>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold animate-in fade-in shadow-xs">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage('')} className="text-emerald-700 hover:text-emerald-900 font-bold px-2">✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[#707973] font-semibold">{t('common.loading')}</div>
      ) : orders.length === 0 ? (
        <div className="glass-panel p-10 rounded-3xl text-center text-[#707973] space-y-3">
          <Utensils className="w-10 h-10 mx-auto text-gray-300" />
          <p className="font-semibold">You have not placed any orders yet.</p>
          <button onClick={() => setActiveTab('customer-dashboard')} className="btn-pill btn-primary text-xs px-5 py-2">
            Explore Menus
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => {
            const foodImg = getFoodImage(ord.plan_type, ord.meal_type);
            const isEligibleForCancel = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'EN_ROUTE'].includes(ord.order_status);
            return (
              <div key={ord.id} className="glass-panel p-5 sm:p-6 rounded-3xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-sm shrink-0 border border-black/10">
                    <img src={foodImg} alt={ord.kitchen_name} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#181a2e]">
                        #{ord.order_number}
                      </span>
                      <StatusBadge status={ord.order_status} />
                      <span className="text-xs text-[#707973]">
                        • {new Date(ord.created_at).toLocaleDateString()} at {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                      {ord.kitchen_name} ({ord.plan_type} - {ord.meal_type})
                    </h3>

                    <p className="text-xs text-[#404943]">
                      Meals: {ord.num_meals} • Extra Rotis: {ord.extra_roti_count} pcs • Chef: {ord.provider_name}
                    </p>

                    {ord.order_status === 'DELIVERED' && (
                      <div className="pt-1 text-xs text-emerald-800 font-semibold flex items-center gap-1">
                        <span>✓ Delivered with OTP verification</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Price & Action button */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-black/5">
                  <div>
                    <span className="text-[10px] text-[#707973] uppercase font-bold block md:text-right">Total Paid</span>
                    <span className="text-lg font-black text-[#2d6a4f]">₹{ord.final_amount.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isEligibleForCancel && (
                      <button
                        onClick={() => {
                          setCancellingOrderId(ord.id);
                          setCancelModalOpen(true);
                        }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
                      >
                        Cancel Order
                      </button>
                    )}

                    {ord.order_status === 'DELIVERED' && (
                      <button
                        onClick={() => handleOpenReview(ord)}
                        className="btn-pill btn-outline text-xs px-4 py-2 flex items-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5 text-[#e9c46a] fill-current" />
                        <span>{ord.rating ? `Reviewed (${ord.rating}★)` : t('customer.rate_order')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/10">
              <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                {t('customer.rate_order')}
              </h3>
              <button onClick={() => setReviewModalOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            {reviewMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
                {reviewMessage}
              </div>
            )}

            <div className="text-center space-y-2 py-2">
              <span className="text-xs text-[#404943] block">How was the food from {selectedOrder.kitchen_name}?</span>
              {/* Star Picker */}
              <div className="flex items-center justify-center gap-2 text-[#e9c46a]">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 hover:scale-125 transition-transform"
                  >
                    <Star className={`w-8 h-8 ${star <= rating ? 'fill-current' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#181a2e] block mb-1">
                Your Review / Taste Experience:
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder={t('customer.write_review')}
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-xs text-[#181a2e]"
              />
            </div>

            <button
              onClick={handleSubmitReview}
              disabled={submittingReview}
              className="w-full btn-pill btn-primary py-3 text-xs font-bold shadow-lg"
            >
              {submittingReview ? t('common.loading') : t('customer.submit_review')}
            </button>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {cancelModalOpen && cancellingOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in zoom-in-95">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 bg-white text-center border border-rose-200">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-md">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="font-heading font-black text-xl text-[#181a2e]">
                Are you sure you want to cancel this order?
              </h3>
              <p className="text-xs text-[#707973] leading-relaxed">
                If cancelled within 60 minutes of placing, you will receive a 90% instant refund as per cancellation policy.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#181a2e] block text-left mb-1.5">
                Cancellation Reason (Optional):
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Changed meal plans, emergency"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbf8ff] border border-black/10 text-xs text-[#181a2e] focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancellingOrderId(null);
                  setCancelReason('');
                }}
                className="btn-pill btn-outline flex-1 py-2.5 text-xs font-bold cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={cancellingOrderLoading}
                className="btn-pill bg-rose-600 hover:bg-rose-700 text-white flex-1 py-2.5 text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {cancellingOrderLoading ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
