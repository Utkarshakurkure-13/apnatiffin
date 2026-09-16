import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { Heart, ShieldCheck, Clock, MapPinOff } from 'lucide-react';

export default function Footer({ setActiveTab }) {
  const { t } = useI18n();

  return (
    <footer className="bg-[#181a2e] text-white pt-12 pb-8 border-t border-white/10 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Col 1: Brand & Mission */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2d6a4f] flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-2xl">lunch_dining</span>
              </div>
              <span className="font-heading font-bold text-2xl tracking-tight text-white">
                {t('app_name')}
              </span>
            </div>
            <p className="text-sm text-gray-300 max-w-md leading-relaxed">
              Empowering local home chefs to share wholesome, healthy, preservative-free homestyle meals with working professionals, students, and families across the city.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#e9c46a] bg-[#e9c46a]/10 px-3 py-1.5 rounded-full w-fit">
              <MapPinOff className="w-4 h-4" />
              <span>{t('phase_notice')}</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="font-heading font-semibold text-sm text-[#a8e7c5] uppercase tracking-wider">
              Marketplace
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <button onClick={() => setActiveTab('landing')} className="hover:text-white transition-colors">
                  {t('nav.explore')}
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('common-login')} className="hover:text-white transition-colors">
                  {t('nav.login')}
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('register-customer')} className="hover:text-white transition-colors">
                  {t('nav.register_cust')}
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('register-provider')} className="hover:text-white transition-colors">
                  {t('nav.register_prov')}
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Kitchen Standards */}
          <div className="space-y-3">
            <h4 className="font-heading font-semibold text-sm text-[#fc9174] uppercase tracking-wider">
              Quality & Trust
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2d6a4f]" />
                <span>KYC Self-Declaration</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#e07a5f]" />
                <span>3-Hour Advance Cooking Window</span>
              </li>
              <li className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400" />
                <span>100-Point Milestone Free Meals</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} {t('app_name')}. All rights reserved. Made with love for ghar ka swad.</p>
          <div className="flex items-center gap-4">
            <span>English</span>
            <span>•</span>
            <span>मराठी</span>
            <span>•</span>
            <span>हिंदी</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
