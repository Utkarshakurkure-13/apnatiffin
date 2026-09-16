import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { Lock, Mail, ArrowRight, UserCheck, ChefHat, ShieldAlert, Sparkles } from 'lucide-react';

export default function CommonLoginPage({ setActiveTab }) {
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await login(email, password);
      // Automatic Role Routing
      if (data.user.role === 'CUSTOMER') {
        setActiveTab('customer-dashboard');
      } else if (data.user.role === 'PROVIDER') {
        setActiveTab('provider-dashboard');
      } else if (data.user.role === 'ADMIN') {
        setActiveTab('admin-dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl shadow-2xl border border-white/80 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-[#2d6a4f]/10 text-[#2d6a4f] mx-auto flex items-center justify-center shadow-xs">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
              {t('auth.login_title')}
            </h2>
            <p className="text-xs sm:text-sm text-[#404943]">
              {t('auth.login_subtitle')}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-2xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                {t('auth.email_label')}
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.email_placeholder')}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-white/90 border border-black/10 focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute right-4 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                {t('auth.password_label')}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password_placeholder')}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-white/90 border border-black/10 focus:outline-hidden focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                />
                <Lock className="w-4 h-4 text-gray-400 absolute right-4 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-pill btn-primary py-3.5 text-sm font-bold shadow-lg"
            >
              {loading ? t('common.loading') : (
                <>
                  <span>{t('auth.sign_in_button')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins Container */}
          <div className="pt-4 border-t border-black/5 space-y-2.5">
            <span className="text-[11px] font-bold text-[#707973] uppercase tracking-wider block text-center">
              {t('auth.quick_demo_logins')}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('rohit@gmail.com', 'Customer@123')}
                className="px-2.5 py-2 rounded-xl bg-[#2d6a4f]/10 hover:bg-[#2d6a4f]/20 text-[#0f5238] text-xs font-bold transition-colors flex items-center justify-center gap-1"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Customer</span>
              </button>

              <button
                type="button"
                onClick={() => fillDemo('radha@annapurna.com', 'Provider@123')}
                className="px-2.5 py-2 rounded-xl bg-[#e07a5f]/15 hover:bg-[#e07a5f]/25 text-[#9a442d] text-xs font-bold transition-colors flex items-center justify-center gap-1"
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Provider</span>
              </button>

              <button
                type="button"
                onClick={() => fillDemo('admin@aapnatiffin.com', 'Admin@123')}
                className="px-2.5 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold transition-colors flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            </div>
          </div>

          {/* Registration Links */}
          <div className="pt-2 text-center text-xs text-[#404943] space-y-1.5">
            <p>{t('auth.no_account')}</p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setActiveTab('register-customer')}
                className="text-xs font-bold text-[#2d6a4f] hover:underline"
              >
                {t('auth.register_as_customer')}
              </button>
              <span>•</span>
              <button
                onClick={() => setActiveTab('register-provider')}
                className="text-xs font-bold text-[#e07a5f] hover:underline"
              >
                {t('auth.register_as_provider')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
