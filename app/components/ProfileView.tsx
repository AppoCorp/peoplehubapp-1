'use client';

import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Globe, 
  Phone, 
  Building, 
  LogOut, 
  ChevronRight,
  Shield,
  Trash2,
  X
} from 'lucide-react';
import { UserSession } from '../services/api';

interface ProfileViewProps {
  session: UserSession;
  onLogout: () => void;
}

export default function ProfileView({ session, onLogout }: ProfileViewProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const cleanPortalUrl = (url: string) => {
    return url.replace('https://', '').replace('http://', '').replace(/\/+$/, '');
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 pt-2 md:pt-4 pb-24 md:pb-6 font-sans">
      
      {/* Header View */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">
          My Profile
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
          Your personal account details
        </p>
      </div>

      {/* Profile Header Avatar */}
      <div className="flex flex-col items-center py-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm gap-4 transition-all">
        
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full bg-primary/10 dark:bg-slate-800 border-4 border-primary/25 dark:border-slate-800 overflow-hidden relative shadow flex items-center justify-center shrink-0">
          {session.userImage ? (
            <img 
              src={session.userImage} 
              alt={session.userName} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <User className="w-12 h-12 text-primary" />
          )}
        </div>

        {/* User basic details */}
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {session.userName}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {session.userEmail}
          </span>
        </div>
      </div>

      {/* Info Cards details */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-4">
        <h4 className="text-xs font-bold text-slate-405 dark:text-slate-500 uppercase tracking-wider">
          Workspace Information
        </h4>

        <div className="flex flex-col gap-3.5 divide-y divide-slate-50 dark:divide-slate-800/50">
          
          {/* Row: Portal URL */}
          <div className="flex items-center gap-4 pt-1">
            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0">
              <Globe className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Portal URL
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                {cleanPortalUrl(session.baseUrl)}
              </span>
            </div>
          </div>

          {/* Row: Mobile Number */}
          {session.userMobile && (
            <div className="flex items-center gap-4 pt-3.5">
              <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0">
                <Phone className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  Mobile Number
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                  {session.userMobile}
                </span>
              </div>
            </div>
          )}

          {/* Row: Company Name */}
          <div className="flex items-center gap-4 pt-3.5">
            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0">
              <Building className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Company Name
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                {session.companyName}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Logout button */}
      <div className="mt-4">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full py-4 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50/50 dark:hover:bg-rose-950/10 text-rose-650 dark:text-rose-400 font-bold rounded-2xl text-sm tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm bg-white dark:bg-slate-900"
        >
          <LogOut className="w-4.5 h-4.5" />
          <span>LOGOUT</span>
        </button>
      </div>

      {/* App Version indicator */}
      <div className="text-center text-[11px] text-slate-400 dark:text-slate-600 font-medium py-2">
        Version 1.0.0
      </div>

      {/* Logout Confirmation Dialog Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-500 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 text-left">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Confirm Logout
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Are you sure you want to log out from this HR workspace? You will need to log in again to access details.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="py-3 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-sm shadow-rose-200 dark:shadow-none"
              >
                LOGOUT
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
