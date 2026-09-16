import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { ChefHat, Building, CreditCard, FileCheck2, ExternalLink, CheckCircle, ArrowRight, ArrowLeft, ShieldAlert, Sparkles } from 'lucide-react';

export default function ProviderRegister({ setActiveTab }) {
  const { registerProvider } = useAuth();
  const { t, lang } = useI18n();

  const [step, setStep] = useState(1);

  // Step 1: Kitchen Info
  const [providerName, setProviderName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [kitchenName, setKitchenName] = useState('');
  const [kitchenAddress, setKitchenAddress] = useState('');
  const [foodType, setFoodType] = useState('Veg');
  const [experienceYears, setExperienceYears] = useState(3);
  const [bio, setBio] = useState('');

  // Step 2: Bank Details
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  // Step 3: KYC & Self Declaration
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [decl1, setDecl1] = useState(false);
  const [decl2, setDecl2] = useState(false);
  const [decl3, setDecl3] = useState(false);

  // Step 4: Optional FSSAI
  const [hasFssai, setHasFssai] = useState(false);
  const [fssaiNumber, setFssaiNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateStep1 = () => {
    if (!providerName || !email || !password || !mobile || !kitchenName || !kitchenAddress) {
      setError('Please fill all required kitchen details.');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!accountHolder || !accountNumber || !ifscCode) {
      setError('Please fill all bank details.');
      return false;
    }
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
    if (!ifscRegex.test(ifscCode.trim())) {
      setError('Invalid IFSC Code format (Example: SBIN0001423).');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep3 = () => {
    if (!decl1 || !decl2 || !decl3) {
      setError('You must accept all self-declaration terms to continue.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasFssai && !fssaiNumber) {
      setError('Please enter your 14-digit FSSAI License Number or select "No".');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await registerProvider({
        provider_name: providerName,
        email,
        password,
        mobile,
        kitchen_name: kitchenName,
        kitchen_address: kitchenAddress,
        food_type: foodType,
        experience_years: parseInt(experienceYears) || 1,
        bio,
        account_holder: accountHolder,
        account_number: accountNumber,
        bank_name: bankName || 'Bank of India',
        ifsc_code: ifscCode.toUpperCase().trim(),
        aadhaar_number: aadhaarNumber || 'XXXX-XXXX-9901',
        pan_number: panNumber || 'XXXXX9901P',
        self_declaration_accepted: true,
        has_fssai: hasFssai,
        fssai_number: hasFssai ? fssaiNumber : null,
        preferred_language: lang
      });

      setActiveTab('provider-dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl shadow-2xl border border-white/80 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-[#e07a5f]/15 text-[#9a442d] mx-auto flex items-center justify-center shadow-xs">
              <ChefHat className="w-7 h-7" />
            </div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#181a2e]">
              {t('reg_provider.title')}
            </h2>
            <p className="text-xs sm:text-sm text-[#404943]">
              {t('reg_provider.subtitle')}
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold pt-2">
            <div className={`p-2 rounded-xl transition-all ${step >= 1 ? 'bg-[#2d6a4f] text-white shadow-xs' : 'bg-black/5 text-[#707973]'}`}>
              {t('reg_provider.step_1')}
            </div>
            <div className={`p-2 rounded-xl transition-all ${step >= 2 ? 'bg-[#2d6a4f] text-white shadow-xs' : 'bg-black/5 text-[#707973]'}`}>
              {t('reg_provider.step_2')}
            </div>
            <div className={`p-2 rounded-xl transition-all ${step >= 3 ? 'bg-[#2d6a4f] text-white shadow-xs' : 'bg-black/5 text-[#707973]'}`}>
              {t('reg_provider.step_3')}
            </div>
            <div className={`p-2 rounded-xl transition-all ${step >= 4 ? 'bg-[#2d6a4f] text-white shadow-xs' : 'bg-black/5 text-[#707973]'}`}>
              {t('reg_provider.step_4')}
            </div>
          </div>

          {/* Error alert */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-2xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Kitchen Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                    {t('reg_provider.chef_name')} *
                  </label>
                  <input
                    type="text"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="e.g. Radha Sharma"
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                    {t('auth.email_label')} *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="radha@annapurna.com"
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                    {t('reg_customer.mobile')} *
                  </label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="9822012345"
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                    {t('auth.password_label')} *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                    {t('reg_provider.kitchen_name')} *
                  </label>
                  <input
                    type="text"
                    value={kitchenName}
                    onChange={(e) => setKitchenName(e.target.value)}
                    placeholder="e.g. Shri Krishna Maa Annapurna"
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                    {t('reg_provider.food_type')}
                  </label>
                  <select
                    value={foodType}
                    onChange={(e) => setFoodType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                  >
                    <option value="Veg">Pure Veg</option>
                    <option value="Both">Veg & Non-Veg</option>
                    <option value="Jain Available">Satvik / Jain Available</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                  {t('reg_provider.kitchen_address')} *
                </label>
                <textarea
                  value={kitchenAddress}
                  onChange={(e) => setKitchenAddress(e.target.value)}
                  placeholder="Flat No, Society, Area, City"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { if (validateStep1()) setStep(2); }}
                  className="btn-pill btn-primary px-6 py-3 text-sm"
                >
                  <span>Next: Bank Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Bank Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                  {t('reg_provider.account_holder')} *
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="e.g. Radha Sharma"
                  className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                    {t('reg_provider.account_number')} *
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 501004819201"
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                    {t('reg_provider.bank_name')}
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="State Bank of India"
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                  {t('reg_provider.ifsc_code')} *
                </label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="SBIN0001423"
                  className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 focus:ring-2 focus:ring-[#2d6a4f] text-sm text-[#181a2e] uppercase font-mono"
                />
                <span className="text-[11px] text-[#707973] mt-1 block">
                  Format: 4 letters, 0, 6 alphanumeric (e.g. SBIN0001423, HDFC0001290)
                </span>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-pill btn-outline px-5 py-2.5 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => { if (validateStep2()) setStep(3); }}
                  className="btn-pill btn-primary px-6 py-3 text-sm"
                >
                  <span>Next: KYC & Self Declaration</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: KYC & Self Declaration */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                    {t('reg_provider.aadhaar')}
                  </label>
                  <input
                    type="text"
                    value={aadhaarNumber}
                    onChange={(e) => setAadhaarNumber(e.target.value)}
                    placeholder="XXXX-XXXX-8921"
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 text-sm text-[#181a2e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#181a2e] mb-1 uppercase tracking-wider">
                    {t('reg_provider.pan')}
                  </label>
                  <input
                    type="text"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    placeholder="ABCPS8192K"
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/90 border border-black/10 text-sm text-[#181a2e] uppercase font-mono"
                  />
                </div>
              </div>

              {/* Self Declaration Checkboxes (Mandatory) */}
              <div className="p-4 bg-[#f4f2ff] rounded-2xl border border-black/5 space-y-3">
                <span className="text-xs font-bold text-[#2d6a4f] uppercase tracking-wider block">
                  Mandatory KYC Self Declaration
                </span>
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#181a2e]">
                  <input
                    type="checkbox"
                    checked={decl1}
                    onChange={(e) => setDecl1(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#2d6a4f] focus:ring-[#2d6a4f]"
                  />
                  <span>{t('reg_provider.self_decl_1')}</span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#181a2e]">
                  <input
                    type="checkbox"
                    checked={decl2}
                    onChange={(e) => setDecl2(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#2d6a4f] focus:ring-[#2d6a4f]"
                  />
                  <span>{t('reg_provider.self_decl_2')}</span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#181a2e]">
                  <input
                    type="checkbox"
                    checked={decl3}
                    onChange={(e) => setDecl3(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#2d6a4f] focus:ring-[#2d6a4f]"
                  />
                  <span>{t('reg_provider.self_decl_3')}</span>
                </label>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-pill btn-outline px-5 py-2.5 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => { if (validateStep3()) setStep(4); }}
                  className="btn-pill btn-primary px-6 py-3 text-sm"
                >
                  <span>Next: Optional FSSAI</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Optional FSSAI Details */}
          {step === 4 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-4 bg-white/90 rounded-2xl border border-black/10 space-y-3">
                <span className="text-xs font-bold text-[#181a2e] block">
                  {t('reg_provider.fssai_q')}
                </span>

                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[#181a2e]">
                    <input
                      type="radio"
                      name="fssaiOption"
                      checked={hasFssai}
                      onChange={() => setHasFssai(true)}
                      className="w-4 h-4 text-[#2d6a4f] focus:ring-[#2d6a4f]"
                    />
                    <span>{t('reg_provider.fssai_yes')}</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[#181a2e]">
                    <input
                      type="radio"
                      name="fssaiOption"
                      checked={!hasFssai}
                      onChange={() => setHasFssai(false)}
                      className="w-4 h-4 text-[#2d6a4f] focus:ring-[#2d6a4f]"
                    />
                    <span>{t('reg_provider.fssai_no')}</span>
                  </label>
                </div>

                {hasFssai ? (
                  <div className="pt-2 animate-in fade-in duration-200">
                    <label className="block text-xs font-bold text-[#181a2e] mb-1">
                      {t('reg_provider.fssai_number_label')} *
                    </label>
                    <input
                      type="text"
                      value={fssaiNumber}
                      onChange={(e) => setFssaiNumber(e.target.value)}
                      placeholder="e.g. 11521019000123"
                      className="w-full px-4 py-2.5 rounded-2xl bg-white border border-black/10 text-sm font-mono"
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5 animate-in fade-in duration-200">
                    <p>{t('reg_provider.fssai_foscos_info')}</p>
                    <a
                      href="https://foscos.fssai.gov.in/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[#2d6a4f] hover:underline"
                    >
                      <span>{t('reg_provider.fssai_link')}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2 font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Instant Activation: Your kitchen will be live and open for orders immediately after clicking submit.</span>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-pill btn-outline px-5 py-2.5 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-pill btn-primary px-8 py-3.5 text-sm font-bold shadow-lg"
                >
                  {loading ? t('common.loading') : (
                    <>
                      <span>{t('reg_provider.submit')}</span>
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="pt-2 text-center text-xs text-[#404943]">
            <span>Already registered as a provider? </span>
            <button
              onClick={() => setActiveTab('common-login')}
              className="font-bold text-[#e07a5f] hover:underline"
            >
              {t('nav.login')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
