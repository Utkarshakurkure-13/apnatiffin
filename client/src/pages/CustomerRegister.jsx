import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { UserPlus, Mail, Key, Phone, MapPin, CheckCircle, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

export default function CustomerRegister({ setActiveTab }) {
  const { registerCustomer } = useAuth();
  const { t, lang } = useI18n();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [password, setPassword] = useState('');
  
  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setOtpSent(true);
      setDevOtp(data.devOtp || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      setError('Please enter the verification OTP.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP verification failed');
      setOtpVerified(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !mobile || !deliveryAddress || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await registerCustomer({
        full_name: fullName,
        email,
        password,
        mobile,
        delivery_address: deliveryAddress,
        preferred_language: lang,
        otp: otpVerified ? otp : undefined
      });

      setActiveTab('customer-dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl shadow-2xl border border-white/80 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-[#2d6a4f]/10 text-[#2d6a4f] mx-auto flex items-center justify-center shadow-xs">
              <UserPlus className="w-7 h-7" />
            </div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
              {t('reg_customer.title')}
            </h2>
            <p className="text-xs sm:text-sm text-[#404943]">
              {t('reg_customer.subtitle')}
            </p>
          </div>

          {/* Welcome points banner */}
          <div className="p-3 bg-[#e9c46a]/20 border border-[#e9c46a]/40 rounded-2xl flex items-center gap-2.5 text-xs text-[#775b06] font-semibold">
            <Sparkles className="w-4 h-4 shrink-0 text-[#775b06]" />
            <span>Bonus: Earn 10 Free Welcome Points immediately on registration!</span>
          </div>

          {/* Error alert */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-2xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                {t('reg_customer.full_name')} *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rohit Sharma"
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
              />
            </div>

            {/* Email + OTP Row */}
            <div>
              <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                {t('auth.email_label')} *
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  disabled={otpVerified}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rohit@gmail.com"
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e] disabled:bg-gray-100"
                />
                {!otpVerified && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || !email}
                    className="btn-pill btn-primary text-xs px-4 py-2 shrink-0"
                  >
                    {otpSent ? 'Resend' : t('auth.send_otp')}
                  </button>
                )}
              </div>
            </div>

            {/* OTP Input if sent */}
            {otpSent && !otpVerified && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs text-blue-900">
                  <span>Enter verification code {devOtp ? `(Dev Code: ${devOtp})` : ''}:</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full px-4 py-2 rounded-xl bg-white border border-blue-300 text-sm text-center font-bold tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading || !otp}
                    className="btn-pill btn-primary text-xs px-4 shrink-0"
                  >
                    {t('auth.verify_otp')}
                  </button>
                </div>
              </div>
            )}

            {otpVerified && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Email verified successfully!</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                {t('reg_customer.mobile')} *
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 9819001122"
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                {t('reg_customer.address')} *
              </label>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Flat / Floor, Wing, Society Name, Street / Landmark, City"
                required
                rows={2}
                className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                {t('reg_customer.password')} *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-pill btn-primary py-3.5 text-sm font-bold shadow-lg mt-2"
            >
              {loading ? t('common.loading') : (
                <>
                  <span>{t('reg_customer.submit')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-[#404943]">
            <span>Already have an account? </span>
            <button
              onClick={() => setActiveTab('common-login')}
              className="font-bold text-[#2d6a4f] hover:underline"
            >
              {t('nav.login')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
