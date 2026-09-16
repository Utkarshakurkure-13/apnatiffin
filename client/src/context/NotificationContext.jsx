import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { playNotificationSound, playPaymentSound } from '../utils/soundEffects';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Keep track of notification IDs that have already been seen/processed
  const seenIdsRef = useRef(new Set());
  const initialLoadDoneRef = useRef(false);

  const fetchNotifications = async (silent = false) => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      seenIdsRef.current.clear();
      initialLoadDoneRef.current = false;
      return;
    }

    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem('aapna_tiffin_token');
      if (!token) return;

      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        const incomingList = data.notifications || [];
        const count = data.unreadCount || 0;

        // Check for newly arrived notifications to play the correct sound
        if (initialLoadDoneRef.current) {
          const freshArrivals = incomingList.filter(n => !seenIdsRef.current.has(n.id) && n.is_read === 0);
          if (freshArrivals.length > 0) {
            const hasPayment = freshArrivals.some(n => n.sound_type === 'payment' || n.type === 'PAYMENT');
            if (hasPayment) {
              playPaymentSound();
            } else {
              playNotificationSound();
            }
          }
        }

        // Register all current IDs into seen set
        incomingList.forEach(n => seenIdsRef.current.add(n.id));
        initialLoadDoneRef.current = true;

        setNotifications(incomingList);
        setUnreadCount(count);
      }
    } catch (err) {
      console.debug('Failed to fetch notifications', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Poll for live real-time notifications every 6 seconds when authenticated
  useEffect(() => {
    if (user) {
      fetchNotifications(false);
      const interval = setInterval(() => fetchNotifications(true), 6000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      seenIdsRef.current.clear();
      initialLoadDoneRef.current = false;
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      if (!token) return;

      // Optimistic UI update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));

      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('aapna_tiffin_token');
      if (!token) return;

      // Optimistic UI update
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);

      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      refreshNotifications: () => fetchNotifications(true)
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}
