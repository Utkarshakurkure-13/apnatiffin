import React from 'react';
import { useI18n } from '../../context/I18nContext';

export default function StatusBadge({ status }) {
  const { t } = useI18n();

  const styles = {
    NEW: 'bg-blue-50 text-blue-700 border-blue-200',
    ACCEPTED: 'bg-purple-50 text-purple-700 border-purple-200',
    PREPARING: 'bg-amber-50 text-amber-700 border-amber-200',
    READY: 'bg-teal-50 text-teal-700 border-teal-200',
    DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
    FAILED: 'bg-red-50 text-red-700 border-red-200',
    REFUNDED: 'bg-orange-50 text-orange-700 border-orange-200',
    SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PAUSED: 'bg-amber-50 text-amber-700 border-amber-200',
    EXPIRED: 'bg-gray-100 text-gray-700 border-gray-200',
    OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
    RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };

  const classNames = styles[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  const label = t(`status.${status}`) || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${classNames}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
      {label}
    </span>
  );
}
