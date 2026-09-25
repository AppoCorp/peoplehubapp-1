'use client';

import React, { useState, useEffect } from 'react';
import { 
  Palmtree, 
  RefreshCw, 
  Calendar,
  Search,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import { UserSession } from '../services/api';
import ApiService, { HolidayRecord } from '../services/api';

interface HolidaysViewProps {
  session: UserSession;
}

export default function HolidaysView({ session }: HolidaysViewProps) {
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchHolidays = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const list = await ApiService.getHolidays(session.baseUrl, session.token);
      setHolidays(list);
      localStorage.setItem('ph_cache_holidays', JSON.stringify(list));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to fetch holiday list');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('ph_cache_holidays');
    if (cached) {
      try {
        setHolidays(JSON.parse(cached));
        setIsLoading(false);
      } catch (e) {
        console.error('Failed to parse cached holidays', e);
      }
    }
    fetchHolidays(!!cached);
  }, [session]);

  const formatDateBox = (dateStr: string) => {
    try {
      const dt = new Date(dateStr);
      if (isNaN(dt.getTime())) return { day: '--', month: '---', year: '', fullDate: dateStr };
      const day = dt.getDate().toString().padStart(2, '0');
      const month = dt.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const year = dt.getFullYear();
      const fullDate = dt.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return { day, month, year, fullDate };
    } catch {
      return { day: '--', month: '---', year: '', fullDate: dateStr };
    }
  };

  const isPastHoliday = (dateStr: string) => {
    try {
      const holidayDate = new Date(dateStr);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return holidayDate < yesterday;
    } catch {
      return false;
    }
  };

  const filteredHolidays = holidays.filter((h) => {
    const query = searchQuery.trim().toLowerCase();
    const occasionLower = (h.occassion || '').toLowerCase();
    if (['sunday', 'saturday', 'weekly off'].includes(occasionLower)) {
      return false;
    }
    if (!query) return true;
    return occasionLower.includes(query) || (h.date || '').toLowerCase().includes(query);
  });

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 pt-2 md:pt-4 pb-24 md:pb-6 font-sans">
      
      {/* Header View */}
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">
            Holiday List
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
            Public and company holidays
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchHolidays(true)}
          disabled={isLoading || isRefreshing}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-sm hover:shadow"
        >
          {isRefreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{isRefreshing ? 'REFRESHING...' : 'REFRESH'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-start justify-between gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 rounded-2xl text-xs border border-rose-100 dark:border-rose-900/50">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <span className="leading-snug break-words">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-1 -mr-1 -mt-1 rounded-lg text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 hover:bg-rose-100/50 dark:hover:bg-rose-900/50 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Filter Bar */}
      {!isLoading && holidays.length > 0 && (
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4.5 h-4.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search occasion or date..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-100 shadow-sm"
          />
        </div>
      )}

      {/* Main List Section */}
      {isLoading ? (
        <div className="flex flex-col gap-4 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/60 animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredHolidays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-600 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
          <Palmtree className="w-12 h-12 stroke-[1.5] text-slate-350 dark:text-slate-700" />
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-3">No upcoming holidays</h3>
          <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
            {searchQuery ? 'Adjust your search queries.' : 'Public holiday listings will show up here.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filteredHolidays.map((holiday) => {
            const dateInfo = formatDateBox(holiday.date);
            const isPast = isPastHoliday(holiday.date);

            return (
              <div 
                key={holiday.id}
                className={`bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800/60 flex relative overflow-hidden transition-all duration-200 hover:translate-y-[-1px] ${
                  isPast ? 'opacity-60' : ''
                }`}
              >
                {/* Left colored border indicator */}
                <div className={`w-1.5 shrink-0 ${isPast ? 'bg-slate-300 dark:bg-slate-700' : 'bg-primary'}`} />

                <div className="flex-1 p-4 flex items-center gap-4">
                  {/* Calendar Icon Box */}
                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex flex-col items-center justify-center shrink-0">
                    <span className={`text-sm font-extrabold leading-none ${isPast ? 'text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                      {dateInfo.day}
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">
                      {dateInfo.month}
                    </span>
                  </div>

                  {/* Occasion / Name */}
                  <div className="flex-1 flex flex-col text-left">
                    <span className={`text-sm font-extrabold tracking-tight ${
                      isPast ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'
                    }`}>
                      {holiday.occassion || 'Holiday'}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
                      {dateInfo.fullDate}
                    </span>
                  </div>

                  {/* Badges */}
                  {!isPast && (
                    <div className="shrink-0 flex items-center">
                      <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-primary-light/40 text-primary border border-primary-light dark:bg-slate-800/40 dark:border-slate-800/60 dark:text-slate-350">
                        Upcoming
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
