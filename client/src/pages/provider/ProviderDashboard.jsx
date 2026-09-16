import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import StatusBadge from '../../components/common/StatusBadge';
import { ChefHat, Power, ShieldAlert, CheckCircle2, Clock, Key, Camera, XCircle, AlertCircle, TrendingUp, Sparkles, ChevronRight, Truck } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ProviderDashboard({ setActiveTab }) {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useI18n();

  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // OTP Verification Modal
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [inputOtp, setInputOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  // Photo Proof Modal
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  // Reject Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Capacity full');
  const [customRejectReason, setCustomRejectReason] = useState('');

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [ovRes, ordRes] = await Promise.all([
        fetch('/api/provider/overview', { headers }),
        fetch('/api/provider/orders', { headers })
      ]);

      if (ovRes.ok) {
        const ovData = await ovRes.json();
        setOverview(ovData);
      }
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(ordData.orders || []);
      }
    } catch (err) {
      console.error('Failed to load provider dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleShopStatus = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const newStatus = overview?.profile?.is_open === 1 ? false : true;
      const res = await fetch('/api/provider/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_open: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActionMsg(data.message);
      fetchDashboard();
      refreshProfile();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateOrderStatus = async (orderId, status, rejectionReason = null) => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/provider/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, rejection_reason: rejectionReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order');

      setActionMsg(`Order status updated to ${status}.`);
      fetchDashboard();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyOtp = async () => {
    if (!inputOtp || !activeOrderId) return;
    setVerifyingOtp(true);
    setOtpError('');
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/provider/orders/${activeOrderId}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ otp: inputOtp.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP');

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      setActionMsg(data.message);
      setOtpModalOpen(false);
      setInputOtp('');
      setActiveOrderId(null);
      fetchDashboard();
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleUploadProof = async () => {
    if (!activeOrderId) return;
    setUploadingProof(true);
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      const res = await fetch(`/api/provider/orders/${activeOrderId}/upload-proof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photo_url: photoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload proof');

      setActionMsg(data.message);
      setPhotoModalOpen(false);
      setPhotoUrl('');
      setActiveOrderId(null);
      fetchDashboard();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingProof(false);
    }
  };

  const isOpen = overview?.profile?.is_open === 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner: Kitchen Info & Shop Open/Close Toggle */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
              {overview?.profile?.kitchen_name || 'Kitchen Dashboard'}
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'}`} />
              {isOpen ? 'OPEN FOR ORDERS' : 'CLOSED'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#404943]">
            Chef {overview?.profile?.provider_name} • Rating: {overview?.profile?.total_reviews > 0 ? `${overview?.profile?.rating_avg}★ (${overview?.profile?.total_reviews} ${overview?.profile?.total_reviews === 1 ? 'review' : 'reviews'})` : 'No ratings yet (0 reviews)'}
          </p>
        </div>

        {/* Open / Close Toggle Button */}
        <button
          onClick={handleToggleShopStatus}
          className={`btn-pill px-6 py-3 text-sm font-bold shadow-lg transition-all ${isOpen ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-700 hover:bg-emerald-800 text-white'}`}
        >
          <Power className="w-4 h-4" />
          <span>{isOpen ? t('provider.close_shop') : t('provider.open_shop')}</span>
        </button>
      </div>

      {actionMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between text-sm animate-in fade-in">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* TODAY'S OVERVIEW STAT CARDS */}
      <div className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-[#181a2e]">
          Today's Order Overview
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="glass-panel p-4 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-[#707973] uppercase tracking-wider block">New Orders</span>
            <span className="text-2xl font-black text-blue-600">{overview?.stats?.new_orders || 0}</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-[#707973] uppercase tracking-wider block">Accepted</span>
            <span className="text-2xl font-black text-purple-600">{overview?.stats?.accepted_orders || 0}</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-[#707973] uppercase tracking-wider block">Preparing</span>
            <span className="text-2xl font-black text-amber-600">{overview?.stats?.preparing_orders || 0}</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-[#707973] uppercase tracking-wider block">Ready</span>
            <span className="text-2xl font-black text-teal-600">{overview?.stats?.ready_orders || 0}</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-[#707973] uppercase tracking-wider block">Delivered</span>
            <span className="text-2xl font-black text-emerald-600">{overview?.stats?.delivered_orders || 0}</span>
          </div>
          <div className="glass-panel p-4 rounded-2xl text-center space-y-1">
            <span className="text-[10px] font-bold text-[#707973] uppercase tracking-wider block">Cancelled</span>
            <span className="text-2xl font-black text-rose-600">{overview?.stats?.cancelled_orders || 0}</span>
          </div>
        </div>
      </div>

      {/* TODAY'S ACTIVE ORDERS MANAGEMENT */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-xl text-[#181a2e]">
            Live Orders Queue
          </h2>
          <button
            onClick={() => setActiveTab('provider-orders')}
            className="text-xs font-bold text-[#2d6a4f] hover:underline"
          >
            View All Order History →
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#707973] font-semibold">{t('common.loading')}</div>
        ) : orders.length === 0 ? (
          <div className="glass-panel p-8 rounded-3xl text-center text-[#707973]">
            No live orders right now.
          </div>
        ) : (
          <div className="space-y-4">
            {orders.slice(0, 8).map((ord) => (
              <div key={ord.id} className="glass-panel p-5 sm:p-6 rounded-3xl shadow-md border border-black/5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-[#181a2e]">#{ord.order_number}</span>
                      <StatusBadge status={ord.order_status} />
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/5 text-[#404943]">
                        {ord.plan_type} • {ord.meal_type}
                      </span>
                    </div>
                    <p className="text-xs text-[#404943]">
                      Customer: <span className="font-bold text-[#181a2e]">{ord.customer_name}</span> ({ord.customer_mobile}) • Addr: {ord.delivery_address}
                    </p>
                    {ord.extra_roti_count > 0 && (
                      <span className="text-xs font-bold text-[#2d6a4f] block">
                        +{ord.extra_roti_count} Extra Rotis included
                      </span>
                    )}
                    {ord.special_instructions && (
                      <p className="text-xs text-amber-800 bg-amber-50 p-1.5 rounded-lg">
                        Note: {ord.special_instructions}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[#707973] uppercase font-bold block">Gross Amount</span>
                    <span className="text-lg font-black text-[#181a2e]">₹{ord.final_amount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Workflow Action Buttons: Strictly Out for Delivery & Cancel Order */}
                <div className="pt-3 border-t border-black/5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {['NEW', 'ACCEPTED', 'PREPARING'].includes(ord.order_status) && (
                      <>
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, 'READY')}
                          className="btn-pill bg-[#e07a5f] hover:bg-[#c96348] text-white text-xs px-4 py-2 font-bold flex items-center gap-1.5 shadow-xs"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Out for Delivery</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveOrderId(ord.id);
                            setRejectModalOpen(true);
                          }}
                          className="btn-pill bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs px-4 py-2 font-bold flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Cancel Order</span>
                        </button>
                      </>
                    )}

                    {ord.order_status === 'READY' && (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#c96348] bg-[#e07a5f]/15 border border-[#e07a5f]/30 px-3 py-1.5 rounded-full animate-pulse">
                          <Truck className="w-3.5 h-3.5 text-[#e07a5f]" />
                          <span>Out for Delivery</span>
                        </span>

                        <button
                          onClick={() => {
                            setActiveOrderId(ord.id);
                            setOtpModalOpen(true);
                            setOtpError('');
                          }}
                          className="btn-pill btn-primary text-xs px-4 py-2 shadow-md flex items-center gap-1"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>{t('provider.verify_delivery_otp')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveOrderId(ord.id);
                            setPhotoModalOpen(true);
                          }}
                          className="btn-pill btn-outline text-xs px-3.5 py-2 flex items-center gap-1"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Doorstep Photo Proof</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveOrderId(ord.id);
                            setRejectModalOpen(true);
                          }}
                          className="btn-pill bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs px-3.5 py-2 font-bold"
                        >
                          <span>Cancel Order</span>
                        </button>
                      </>
                    )}

                    {ord.order_status === 'DELIVERED' && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Delivered & Verified
                      </span>
                    )}

                    {ord.order_status === 'CANCELLED' && (
                      <span className="text-xs font-bold text-rose-600 flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200">
                        <XCircle className="w-4 h-4 text-rose-600" /> Order Cancelled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DELIVERY OTP MODAL */}
      {otpModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2d6a4f]/10 text-[#2d6a4f] mx-auto flex items-center justify-center">
              <Key className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-extrabold text-lg text-[#181a2e]">
              {t('provider.verify_delivery_otp')}
            </h3>
            <p className="text-xs text-[#404943]">
              {t('provider.enter_otp_prompt')}
            </p>

            {otpError && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl font-bold">
                {otpError}
              </div>
            )}

            <input
              type="text"
              maxLength={4}
              value={inputOtp}
              onChange={(e) => setInputOtp(e.target.value)}
              placeholder="4-digit OTP"
              className="w-full px-4 py-3 rounded-2xl bg-white border border-black/15 text-center text-2xl font-mono font-black tracking-widest text-[#2d6a4f]"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOtpModalOpen(false)}
                className="w-1/2 btn-pill btn-outline text-xs py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || inputOtp.length < 4}
                className="w-1/2 btn-pill btn-primary text-xs py-2.5 shadow-md"
              >
                {verifyingOtp ? t('common.loading') : 'Verify & Deliver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PROOF MODAL */}
      {photoModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="glass-modal rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/10">
              <h3 className="font-heading font-bold text-lg text-[#181a2e]">
                {t('provider.upload_proof_btn')}
              </h3>
              <button onClick={() => setPhotoModalOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>
            <p className="text-xs text-[#404943]">
              If customer is unavailable, place tiffin securely at doorstep and upload photo proof.
            </p>

            <div>
              <label className="text-xs font-bold text-[#181a2e] block mb-1">
                Photo URL / Mock Camera Snap:
              </label>
              <input
                type="text"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://example.com/doorstep-photo.jpg"
                className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-xs text-[#181a2e]"
              />
            </div>

            <button
              onClick={handleUploadProof}
              disabled={uploadingProof}
              className="w-full btn-pill btn-primary py-3 text-xs font-bold shadow-md"
            >
              {uploadingProof ? t('common.loading') : 'Submit Delivery Photo Proof'}
            </button>
          </div>
        </div>
      )}

      {/* CANCEL / REJECT ORDER MODAL */}
      {rejectModalOpen && (
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
                  setRejectModalOpen(false);
                  setActiveOrderId(null);
                  setCustomRejectReason('');
                }}
                className="btn-pill btn-outline flex-1 py-2.5 text-xs font-bold cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={async () => {
                  const finalR = rejectReason === 'Other' ? customRejectReason : rejectReason;
                  try {
                    const token = localStorage.getItem('aapna_tiffin_token');
                    const res = await fetch(`/api/provider/orders/${activeOrderId}/cancel`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ reason: finalR || 'Provider cancelled order' })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to cancel order');

                    setActionMsg('Order cancelled successfully.');
                    setRejectModalOpen(false);
                    setActiveOrderId(null);
                    setCustomRejectReason('');
                    fetchDashboard();
                  } catch (err) {
                    alert(err.message);
                  }
                }}
                className="btn-pill bg-rose-600 hover:bg-rose-700 text-white flex-1 py-2.5 text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
