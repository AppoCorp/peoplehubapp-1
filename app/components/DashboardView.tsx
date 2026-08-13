'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  CalendarPlus, 
  ReceiptText, 
  ChevronRight, 
  Bell, 
  Loader2,
  CheckCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { UserSession } from '../services/api';
import ApiService, { AttendanceRecord } from '../services/api';

interface DashboardViewProps {
  session: UserSession;
  onNavigateToTab: (tab: string) => void;
}

export default function DashboardView({ session, onNavigateToTab }: DashboardViewProps) {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [remainingClockIn, setRemainingClockIn] = useState<number>(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [activeAttendanceRecord, setActiveAttendanceRecord] = useState<AttendanceRecord | null>(null);
  const [latitude, setLatitude] = useState<string | null>(null);
  const [longitude, setLongitude] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Time ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Formatting time (e.g. 10:14 AM)
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const minStr = minutes < 10 ? '0' + minutes : minutes;
      setTimeStr(`${hours}:${minStr} ${ampm}`);

      // Formatting date (e.g. Wednesday, 24 June)
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
      setDateStr(now.toLocaleDateString('en-US', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's attendance status
  const fetchAttendanceStatus = async () => {
    try {
      const response = await ApiService.getTodayAttendance(session.baseUrl, session.token);
      const record = response && response.attendance ? response.attendance : null;
      const remaining = response && typeof response.remaining_clock_in !== 'undefined' ? response.remaining_clock_in : 1;
      
      setActiveAttendanceRecord(record);
      setRemainingClockIn(remaining);
      
      const clockedIn = record !== null && 
        (!record.clock_out_time || 
         record.clock_out_time.toString().trim() === '' || 
         record.clock_out_time.toString().toLowerCase() === 'null');
      
      setIsClockedIn(clockedIn);
      localStorage.setItem('ph_cache_today_attendance', JSON.stringify(response));
    } catch (err) {
      console.error('Failed to load active attendance status:', err);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('ph_cache_today_attendance');
    if (cached) {
      try {
        const response = JSON.parse(cached);
        const record = response && response.attendance ? response.attendance : null;
        const remaining = response && typeof response.remaining_clock_in !== 'undefined' ? response.remaining_clock_in : 1;
        
        setActiveAttendanceRecord(record);
        setRemainingClockIn(remaining);
        
        const clockedIn = record !== null && 
          (!record.clock_out_time || 
           record.clock_out_time.toString().trim() === '' || 
           record.clock_out_time.toString().toLowerCase() === 'null');
        setIsClockedIn(clockedIn);
      } catch (e) {
        console.error('Failed to parse cached today attendance status:', e);
      }
    }
    fetchAttendanceStatus();
  }, [session]);

  const showNotification = (text: string, type: 'success' | 'error' | 'warning') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Geolocation wrapper
  const describeGeolocationError = (err: GeolocationPositionError): string => {
    return "We couldn't determine your location. Please check your location settings and Appo's location permission, then try again.";
  };

  const getCoordinates = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        resolve,
        (err) => {
          console.error('Geolocation error:', { code: err.code, message: err.message });
          reject(new Error(describeGeolocationError(err)));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  // Function to verify if valid coordinates are coming, print them, or reject
  const verifyCoordinates = async (): Promise<{ latStr: string; lngStr: string }> => {
    const position = await getCoordinates();
    const lat = position?.coords?.latitude;
    const lng = position?.coords?.longitude;

    if (lat === undefined || lat === null || lng === undefined || lng === null || isNaN(lat) || isNaN(lng)) {
      throw new Error('Coordinates are not available. Clock-in/out rejected.');
    }

    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);

    console.log('Location Coordinates:', {
      latitude: lat,
      longitude: lng,
      latitudeFormatted: latStr,
      longitudeFormatted: lngStr
    });

    return { latStr, lngStr };
  };

  const handleClockIn = async () => {
    setIsSubmitting(true);
    setIsLocationLoading(true);
    let latStr = '';
    let lngStr = '';

    try {
      const coords = await verifyCoordinates();
      latStr = coords.latStr;
      lngStr = coords.lngStr;
      setLatitude(latStr);
      setLongitude(lngStr);
    } catch (err: any) {
      console.error('Clock-in rejected:', err);
      showNotification(err.message || 'Location coordinates are required for clock-in', 'error');
      setIsLocationLoading(false);
      setIsSubmitting(false);
      return;
    } finally {
      setIsLocationLoading(false);
    }

    try {
      await ApiService.checkIn(
        session.baseUrl,
        session.token,
        latStr || undefined,
        lngStr || undefined
      );
      await fetchAttendanceStatus();
      showNotification('Clocked in successfully', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Clock-in failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    setIsSubmitting(true);
    setIsLocationLoading(true);
    let latStr = '';
    let lngStr = '';

    try {
      const coords = await verifyCoordinates();
      latStr = coords.latStr;
      lngStr = coords.lngStr;
      setLatitude(latStr);
      setLongitude(lngStr);
    } catch (err: any) {
      console.error('Clock-out rejected:', err);
      showNotification(err.message || 'Location coordinates are required for clock-out', 'error');
      setIsLocationLoading(false);
      setIsSubmitting(false);
      return;
    } finally {
      setIsLocationLoading(false);
    }

    try {
      await ApiService.checkOut(
        session.baseUrl,
        session.token,
        activeAttendanceRecord?.id?.toString(),
        latStr || undefined,
        lngStr || undefined
      );
      await fetchAttendanceStatus();
      showNotification('Clocked out successfully', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Clock-out failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGreetingText = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Format active record times for display if present
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 pb-24 md:pb-6 relative">
      
      {/* Mobile top header bar */}
      <header className="md:hidden flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 flex items-center justify-start shrink-0 overflow-hidden">
            {session.companyLogo ? (
              <img src={session.companyLogo} alt="Logo" className="max-w-[150px] max-h-full object-contain object-left" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-primary-light dark:bg-slate-900 flex items-center justify-center border border-slate-200/40 dark:border-slate-800 shadow-sm">
                <Building2 className="w-4.5 h-4.5 text-primary" />
              </div>
            )}
          </div>
        </div>
        <button className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-350 cursor-pointer active:scale-95 transition-transform">
          <Bell className="w-4.5 h-4.5" />
        </button>
      </header>

      {/* Dynamic Notifications Banner */}
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

      {/* Greeting Banner */}
      <div className="w-full bg-gradient-to-br from-indigo-50 to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/20 rounded-3xl p-6 border border-indigo-100/50 dark:border-slate-800/80 shadow-sm relative overflow-hidden flex justify-between items-center transition-all duration-300">
        <div className="flex flex-col gap-1 z-10 max-w-[65%]">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">
            {getGreetingText()}, {session.userName.split(' ')[0]}!
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Have a productive day ahead.
          </p>
        </div>
        
        {/* Visual decoration element representing the Flutter hero image */}
        <div className="absolute right-0 bottom-[-40px] w-32 h-32 pointer-events-none z-0">
          <img 
            src="/hero.png" 
            alt="Hero illustration" 
            className="w-full h-full object-contain object-bottom"
          />
        </div>
      </div>

      {/* Clock In / Out Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/60 transition-all duration-300">
        
        {/* Card Header: Date, Time & Status Pill */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {dateStr || 'Loading...'}
            </span>
            <span className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mt-1">
              {timeStr || '00:00 AM'}
            </span>
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border tracking-wider transition-all duration-300 ${
            isClockedIn 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-650 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400' 
              : 'bg-amber-50 border-amber-100 text-amber-650 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isClockedIn ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isClockedIn ? 'Clocked In' : 'Clocked Out'}
          </div>
        </div>



        {/* Geolocation visual details row */}
        {activeAttendanceRecord && (
          <div className="mt-4 px-3 py-2 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl flex flex-wrap justify-between text-[11px] text-slate-400 dark:text-slate-500 border border-slate-100/50 dark:border-slate-800/40">
            <div>Check In: <span className="font-bold text-slate-600 dark:text-slate-350">{formatTime(activeAttendanceRecord.clock_in_time)}</span></div>
            {activeAttendanceRecord.clock_out_time && (
              <div>Check Out: <span className="font-bold text-slate-600 dark:text-slate-350">{formatTime(activeAttendanceRecord.clock_out_time)}</span></div>
            )}
          </div>
        )}

        {/* Main Check-In/Out Button */}
        <div className="mt-6">
          <button
            onClick={isClockedIn ? handleClockOut : handleClockIn}
            disabled={isSubmitting || (!isClockedIn && remainingClockIn <= 0)}
            className={`w-full py-4 text-white font-bold rounded-2xl tracking-wider active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
              (!isClockedIn && remainingClockIn <= 0)
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-650 cursor-not-allowed shadow-none'
                : isClockedIn 
                  ? 'bg-red-500 hover:bg-red-600 shadow-red-200 dark:shadow-none' 
                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200 dark:shadow-none'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isLocationLoading ? 'VERIFYING LOCATION...' : 'CLOCKING IN...'}
              </>
            ) : isClockedIn ? (
              'CLOCK OUT'
            ) : remainingClockIn <= 0 ? (
              'MAX CLOCK IN REACHED'
            ) : (
              'CLOCK IN'
            )}
          </button>
        </div>
      </div>

      {/* Quick Actions Title */}
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Quick Actions
        </h3>

        {/* Quick Actions List */}
        <div className="flex flex-col gap-3">
          
          {/* Action: Apply Leave */}
          <button
            onClick={() => onNavigateToTab('leaves')}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/60 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center shrink-0">
                <CalendarPlus className="w-5.5 h-5.5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Apply Leave
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  Request time off
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Action: Submit Expenses */}
          <button
            onClick={() => onNavigateToTab('expenses')}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/60 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center shrink-0">
                <ReceiptText className="w-5.5 h-5.5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Submit Expenses
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  Submit claims
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
          </button>

        </div>
      </div>
    </div>
  );
}