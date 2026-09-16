import React, { useState, useRef, useEffect } from 'react';
import { useNotificationContext } from '../../context/NotificationContext';
import { useI18n } from '../../context/I18nContext';
import { 
  Bell, CheckCheck, IndianRupee, Utensils, Truck, Calendar, 
  Sparkles, Shield, AlertCircle, X, ExternalLink, Clock
} from 'lucide-react';

export default function NotificationDropdown({ isOpen, onClose, setActiveTab }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationContext();
  const { lang } = useI18n();
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD'
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredList = filter === 'UNREAD' 
    ? notifications.filter(n => n.is_read === 0) 
    : notifications;

  const getNotificationIcon = (type, soundType) => {
    if (type === 'PAYMENT' || soundType === 'payment') {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0f5238] flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
          <IndianRupee className="w-4 h-4" />
        </div>
      );
    }
    switch (type) {
      case 'ORDER':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
            <Utensils className="w-4 h-4" />
          </div>
        );
      case 'DELIVERY':
        return (
          <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
            <Truck className="w-4 h-4" />
          </div>
        );
      case 'SUBSCRIPTION':
        return (
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
            <Calendar className="w-4 h-4" />
          </div>
        );
      case 'REWARD':
        return (
          <div className="w-8 h-8 rounded-xl bg-yellow-100 text-yellow-800 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const handleItemClick = (n) => {
    if (n.is_read === 0) {
      markAsRead(n.id);
    }
    if (n.link && setActiveTab) {
      const linkMap = {
        '/customer/orders': 'customer-orders',
        '/customer/subscriptions': 'customer-subscriptions',
        '/customer/bills': 'customer-bills',
        '/customer/points': 'customer-points',
        '/provider/orders': 'provider-orders',
        '/provider/earnings': 'provider-earnings',
        '/admin/orders': 'admin-orders',
        '/admin/customers': 'admin-customers',
        '/admin/providers': 'admin-providers'
      };
      const targetTab = linkMap[n.link];
      if (targetTab) {
        setActiveTab(targetTab);
        onClose();
      }
    }
  };

  return (
    <div 
      ref={dropdownRef}
      className="absolute right-0 top-12 w-80 sm:w-96 bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-black/10 z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="p-4 border-b border-black/5 bg-[#fbf8ff]/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#2d6a4f]/15 text-[#2d6a4f] flex items-center justify-center font-bold">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <h3 className="font-heading font-extrabold text-sm text-[#181a2e]">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
              {unreadCount} New
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              title="Mark all as read"
              className="text-[11px] font-bold text-[#2d6a4f] hover:text-[#0f5238] flex items-center gap-1 hover:underline cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark read</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full hover:bg-black/5 text-gray-500 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-black/5 bg-white text-xs font-bold">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
            filter === 'ALL' 
              ? 'bg-[#2d6a4f] text-white shadow-2xs' 
              : 'text-[#404943] hover:bg-black/5'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
            filter === 'UNREAD' 
              ? 'bg-[#2d6a4f] text-white shadow-2xs' 
              : 'text-[#404943] hover:bg-black/5'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-black/5">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
              <Bell className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-[#181a2e]">No notifications</p>
            <p className="text-[11px] text-[#707973]">
              {filter === 'UNREAD' ? 'You have read all notifications.' : 'Activity updates will appear here in real-time.'}
            </p>
          </div>
        ) : (
          filteredList.map((n) => {
            const title = (lang === 'mr' ? n.title_mr : lang === 'hi' ? n.title_hi : n.title_en) || n.title_en;
            const message = (lang === 'mr' ? n.message_mr : lang === 'hi' ? n.message_hi : n.message_en) || n.message_en;
            const isUnread = n.is_read === 0;

            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`p-3.5 transition-all flex items-start gap-3 cursor-pointer group ${
                  isUnread 
                    ? 'bg-emerald-50/50 hover:bg-emerald-50/80 border-l-4 border-l-emerald-600' 
                    : 'bg-white hover:bg-gray-50/80'
                }`}
              >
                {getNotificationIcon(n.type, n.sound_type)}

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-1.5">
                    <h4 className={`text-xs truncate ${isUnread ? 'font-extrabold text-[#181a2e]' : 'font-bold text-gray-700'}`}>
                      {title}
                    </h4>
                    <span className="text-[10px] text-gray-400 font-medium shrink-0 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTimeAgo(n.created_at)}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#404943] leading-snug line-clamp-2">
                    {message}
                  </p>

                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      {n.type}
                    </span>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600 shadow-2xs" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 bg-[#fbf8ff]/60 border-t border-black/5 text-center">
        <span className="text-[10px] font-semibold text-gray-400">
          Aapna Tiffin Real-Time Notification Center
        </span>
      </div>
    </div>
  );
}
