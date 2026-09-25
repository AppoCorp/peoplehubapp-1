'use client';

import React, { useState, useEffect } from 'react';
import { 
  History, 
  ArrowRight, 
  RefreshCw, 
  MapPin, 
  Calendar,
  Building,
  Home,
  Globe,
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import { UserSession } from '../services/api';
import ApiService, { AttendanceRecord } from '../services/api';

interface AttendanceViewProps {
  session: UserSession;
}

export default function AttendanceView({ session }: AttendanceViewProps) {
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLogs = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const records = await ApiService.getAttendance(session.baseUrl, session.token, session.userId);
      
      // Frontend sort: Latest date first
      records.sort((a, b) => {
        const dateA = new Date(a.clock_in_time).getTime() || 0;
        const dateB = new Date(b.clock_in_time).getTime() || 0;
        return dateB - dateA;
      });

      setLogs(records);
      localStorage.setItem('ph_cache_attendance_logs', JSON.stringify(records));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to fetch attendance history');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('ph_cache_attendance_logs');
    if (cached) {
      try {
        setLogs(JSON.parse(cached));
        setIsLoading(false);
      } catch (e) {
        console.error('Failed to parse cached attendance logs', e);
      }
    }
    fetchLogs(!!cached);
  }, [session]);

  const formatDateBox = (timeStr: string) => {
    try {
      const dt = new Date(timeStr);
      if (isNaN(dt.getTime())) return { day: '--', month: '---' };
      const day = dt.getDate().toString().padStart(2, '0');
      const month = dt.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      return { day, month };
    } catch {
      return { day: '--', month: '---' };
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    const cleanStr = timeStr.trim().toLowerCase();
    if (cleanStr === '' || cleanStr === 'null' || cleanStr === 'in progress') {
      return '--:--';
    }
    try {
      const dt = new Date(timeStr);
      if (isNaN(dt.getTime())) return timeStr;
      return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return timeStr;
    }
  };

  const getWorkTypeIcon = (type?: string) => {
    const cleanType = (type || 'office').trim().toLowerCase();
    if (cleanType === 'home') return <Home className="w-3 h-3 text-indigo-500" />;
    if (cleanType === 'remote') return <Globe className="w-3 h-3 text-cyan-500" />;
    return <Building className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 pt-2 md:pt-4 pb-24 md:pb-6 font-sans">
      
      {/* Header View */}
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">
            Attendance Log
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
            History of your working days
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs(true)}
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

      {/* Main List Section */}
      {isLoading ? (
        <div className="flex flex-col gap-4 py-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/60 animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-600 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
          <History className="w-12 h-12 stroke-[1.5] text-slate-300 dark:text-slate-700" />
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-3">No logs found</h3>
          <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Start clocking in to populate your log.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
            <span>Recent Activity</span>
            <span>{logs.length} Records</span>
          </div>

          <div className="flex flex-col gap-3.5">
            {logs.map((record) => {
              const dateParts = formatDateBox(record.clock_in_time);
              const inTime = formatTime(record.clock_in_time);
              const outTime = formatTime(record.clock_out_time);
              const isProgress = !record.clock_out_time || record.clock_out_time.toLowerCase() === 'in progress';

              return (
                <div 
                  key={record.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-4 transition-transform hover:translate-y-[-1px] duration-150"
                >
                  {/* Calendar day icon box */}
                  <div className="w-14 py-2 bg-primary-light/40 dark:bg-slate-800/80 rounded-2xl flex flex-col items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800 shadow-sm">
                    <span className="text-base font-black text-primary dark:text-slate-200 leading-none">
                      {dateParts.day}
                    </span>
                    <span className="text-[9px] font-extrabold text-primary dark:text-slate-400 tracking-wider mt-1">
                      {dateParts.month}
                    </span>
                  </div>

                  {/* Time columns */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      {/* Clock In */}
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          Clock In
                        </span>
                        <span className="text-sm font-extrabold text-slate-700 dark:text-slate-100 mt-0.5">
                          {inTime}
                        </span>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />

                      {/* Clock Out */}
                      <div className="flex flex-col text-right">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          Clock Out
                        </span>
                        <span className={`text-sm font-extrabold mt-0.5 ${
                          isProgress ? 'text-amber-500' : 'text-slate-700 dark:text-slate-100'
                        }`}>
                          {isProgress ? 'In Progress' : outTime}
                        </span>
                      </div>
                    </div>

                    {/* Footer Details: Coordinates if present */}
                    {(record.latitude || record.clock_out_latitude) && (
                      <div className="flex justify-between items-center pt-2 border-t border-slate-50 dark:border-slate-800/30">
                        {record.latitude && record.longitude ? (
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-slate-500 font-medium" title="Clock In Location">
                            <MapPin className="w-2.5 h-2.5 text-emerald-500" />
                            <span>In: {parseFloat(record.latitude).toFixed(4)}, {parseFloat(record.longitude).toFixed(4)}</span>
                          </div>
                        ) : <div/>}
                        
                        {record.clock_out_latitude && record.clock_out_longitude ? (
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-slate-500 font-medium" title="Clock Out Location">
                            <MapPin className="w-2.5 h-2.5 text-amber-500" />
                            <span>Out: {parseFloat(record.clock_out_latitude).toFixed(4)}, {parseFloat(record.clock_out_longitude).toFixed(4)}</span>
                          </div>
                        ) : <div/>}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
