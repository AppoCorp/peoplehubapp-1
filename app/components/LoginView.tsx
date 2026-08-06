'use client';

import React, { useState } from 'react';
import { Mail, Lock, Globe, Building2, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { UserSession } from '../services/api';

interface LoginViewProps {
  onLoginSuccess: (session: UserSession) => void;
  loginFn: (url: string, email: string, password: string) => Promise<UserSession>;
}

export default function LoginView({ onLoginSuccess, loginFn }: LoginViewProps) {
  const [url, setUrl] = useState('appo.co.in');
  const [showServerUrl, setShowServerUrl] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' | 'warning') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !email.trim() || !password) {
      showNotification('Please fill in all fields', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const session = await loginFn(url, email, password);
      onLoginSuccess(session);
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'Authentication failed. Please check your credentials.';
      showNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans">

      {/* Dynamic Notifications Banner (Toast) */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border text-sm font-semibold transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400'
            : 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* ── Gradient banner — full-width, flush to the very top edge ── */}
      <div className="w-full bg-gradient-to-br from-primary to-indigo-600 px-8 pt-16 pb-20 shadow-lg text-white relative overflow-hidden">
        <div className="absolute right-[-40px] top-[-40px] w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute left-[-20px] bottom-[-20px] w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4 max-w-md mx-auto">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
            <p className="text-white/80 text-sm mt-1">Log in to access your HR workspace</p>
          </div>
        </div>
      </div>

      {/* ── Form card overlapping the banner bottom ── */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-md px-6 -mt-10 relative z-20">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 transition-all duration-300">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">

              {/* Portal Settings */}
              {showServerUrl && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                    Portal Settings
                  </span>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Globe className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="example.com"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-100 transition-all"
                    />
                    <label className="absolute left-10 -top-2 px-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 pointer-events-none">
                      Portal URL
                    </label>
                  </div>
                </div>
              )}

              {/* Credentials */}
              <div className="flex flex-col gap-4">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                  Credentials
                </span>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-100 transition-all"
                  />
                  <label className="absolute left-10 -top-2 px-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 pointer-events-none">
                    Email Address
                  </label>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-100 transition-all"
                  />
                  <label className="absolute left-10 -top-2 px-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 pointer-events-none">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>



              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-primary text-white rounded-2xl text-sm font-bold tracking-wider hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SIGNING IN...
                  </>
                ) : (
                  'SIGN IN'
                )}
              </button>

              <div className="flex justify-center mt-1">
                <button
                  type="button"
                  onClick={() => setShowServerUrl(!showServerUrl)}
                  className="text-xs text-primary hover:text-primary-hover font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {showServerUrl ? 'Use Default Server' : 'Change Server URL'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <button className="mt-6 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 underline transition-colors">
          Forgot your password?
        </button>
      </div>

      <div className="py-6 text-center text-[10px] text-slate-300 dark:text-slate-700">
        © {new Date().getFullYear()} PeopleHub. All rights reserved.
      </div>
    </div>
  );
}
