'use client';

import { useEffect, useCallback } from 'react';
import ApiService, { UserSession, ExpenseCategory } from '../services/api';

export function useBackgroundSync(session: UserSession | null, isAuthenticated: boolean) {
  const syncData = useCallback(async () => {
    if (!isAuthenticated || !session) return;

    const { baseUrl, token, userId } = session;

    console.log('[BackgroundSync] Starting sync of all core data...');

    // 1. Fetch & cache today's attendance status
    try {
      const record = await ApiService.getTodayAttendance(baseUrl, token);
      localStorage.setItem('ph_cache_today_attendance', JSON.stringify(record));
      console.log('[BackgroundSync] Synced today attendance');
    } catch (e) {
      console.warn('[BackgroundSync] Failed to sync today attendance:', e);
    }

    // 2. Fetch & cache holidays
    try {
      const list = await ApiService.getHolidays(baseUrl, token);
      list.sort((a, b) => {
        const dateA = new Date(a.date).getTime() || 0;
        const dateB = new Date(b.date).getTime() || 0;
        return dateB - dateA;
      });
      localStorage.setItem('ph_cache_holidays', JSON.stringify(list));
      console.log('[BackgroundSync] Synced holidays');
    } catch (e) {
      console.warn('[BackgroundSync] Failed to sync holidays:', e);
    }

    // 3. Fetch & cache leaves and types
    try {
      const leaves = await ApiService.getLeaves(baseUrl, token, userId);
      const leaveTypes = await ApiService.getLeaveTypes(baseUrl, token);
      localStorage.setItem('ph_cache_leaves', JSON.stringify(leaves));
      localStorage.setItem('ph_cache_leave_types', JSON.stringify(leaveTypes));
      console.log('[BackgroundSync] Synced leaves and leave types');
    } catch (e) {
      console.warn('[BackgroundSync] Failed to sync leaves data:', e);
    }

    // 4. Fetch & cache expenses, categories, and currencies
    try {
      // Gracefully fetch currencies metadata
      try {
        await ApiService.fetchCurrencies(baseUrl, token);
      } catch (err) {
        console.warn('[BackgroundSync] Failed to fetch currencies metadata:', err);
      }

      const expenses = await ApiService.getExpenses(baseUrl, token, userId);
      
      // Learn currencies metadata from history records matching ExpenseView logic
      if (Array.isArray(expenses)) {
        for (const exp of expenses) {
          const curr = exp.currency;
          if (curr) {
            const code = curr.currency_code?.toString().toUpperCase();
            const id = curr.id;
            const rate = parseFloat(curr.exchange_rate?.toString() || '1.0') || 1.0;
            if (code && id) {
              ApiService.updateCurrencyMetadata(code, id, rate);
            }
          }
        }
      }

      let categoriesList: ExpenseCategory[] = [];
      try {
        categoriesList = await ApiService.getExpenseCategories(baseUrl, token);
      } catch (err) {
        console.warn('[BackgroundSync] Failed to load expense categories:', err);
      }

      localStorage.setItem('ph_cache_expenses', JSON.stringify(expenses));
      localStorage.setItem('ph_cache_expense_categories', JSON.stringify(categoriesList));
      console.log('[BackgroundSync] Synced expenses and categories');
    } catch (e) {
      console.warn('[BackgroundSync] Failed to sync expenses data:', e);
    }

    // 5. Fetch & cache attendance logs
    try {
      const records = await ApiService.getAttendance(baseUrl, token, userId);
      records.sort((a, b) => {
        const dateA = new Date(a.clock_in_time).getTime() || 0;
        const dateB = new Date(b.clock_in_time).getTime() || 0;
        return dateB - dateA;
      });
      localStorage.setItem('ph_cache_attendance_logs', JSON.stringify(records));
      console.log('[BackgroundSync] Synced attendance logs');
    } catch (e) {
      console.warn('[BackgroundSync] Failed to sync attendance logs:', e);
    }

    console.log('[BackgroundSync] Sync complete.');
  }, [session, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !session) return;

    // Trigger sync immediately on mount or login
    syncData();

    // Refresh every 60 seconds
    const interval = setInterval(syncData, 60000);

    // Refresh when the app window/tab gets focused
    const handleFocus = () => {
      console.log('[BackgroundSync] Window focused, triggering refresh...');
      syncData();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session, isAuthenticated, syncData]);
}
