'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginView from './components/LoginView';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import DashboardView from './components/DashboardView';
import AttendanceView from './components/AttendanceView';
import HolidaysView from './components/HolidaysView';
import LeavesView from './components/LeavesView';
import ExpensesView from './components/ExpensesView';
import ProfileView from './components/ProfileView';
import { useBackgroundSync } from './hooks/useBackgroundSync';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { session, isAuthenticated, loading, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Trigger background prefetching and syncing
  useBackgroundSync(session, isAuthenticated);

  // Register the PWA service worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);
        })
        .catch((err) => {
          console.error('[PWA] Service Worker registration failed:', err);
        });
    }
  }, []);

  // System Hardware Back Button & Browser Navigation Sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.replace('#', '');
    const validTabs = ['dashboard', 'attendance', 'holidays', 'leaves', 'expenses', 'profile'];
    const initialTab = validTabs.includes(hash) ? hash : 'dashboard';

    window.history.replaceState({ tab: initialTab }, '', '#' + initialTab);
    setActiveTab(initialTab);

    const handlePopState = (e: PopStateEvent) => {
      const tab = e.state?.tab || 'dashboard';
      setActiveTab(tab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigateToTab = useCallback((tab: string) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const currentTab = window.history.state?.tab;
      if (currentTab !== tab) {
        window.history.pushState({ tab }, '', '#' + tab);
      }
    }
  }, []);

  const handleBackToDashboard = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.state?.tab && window.history.state.tab !== 'dashboard') {
      window.history.back();
    } else {
      handleNavigateToTab('dashboard');
    }
  }, [handleNavigateToTab]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-primary">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin stroke-[1.5]" />
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Loading Workspace...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !session) {
    return <LoginView onLoginSuccess={() => handleNavigateToTab('dashboard')} loginFn={login} />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'attendance':
        return <AttendanceView session={session} />;
      case 'holidays':
        return <HolidaysView session={session} />;
      case 'leaves':
        return <LeavesView session={session} onBackToDashboard={handleBackToDashboard} />;
      case 'expenses':
        return <ExpensesView session={session} onBackToDashboard={handleBackToDashboard} />;
      case 'profile':
        return (
          <ProfileView 
            session={session} 
            onLogout={logout} 
          />
        );
      default:
        return <DashboardView session={session} onNavigateToTab={handleNavigateToTab} />;
    }
  };

  return (
    <div className="h-screen h-[100dvh] w-screen overflow-hidden flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans">
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleNavigateToTab} 
        session={session} 
        onLogout={logout}
      />

      {/* Main View Area with Safe Area Padding */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 pt-[calc(14px+env(safe-area-inset-top,0px))] pb-28 md:pb-6 relative no-scrollbar">
        <div className="w-full max-w-3xl mx-auto">
          {renderActiveView()}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={handleNavigateToTab} />
    </div>
  );
}
