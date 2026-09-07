'use client';

import React, { useState, useEffect } from 'react';
import { 
  CalendarDays, 
  Plus, 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  HelpCircle,
  Umbrella,
  CalendarDays as CalendarIcon,
  Heart,
  FileText
} from 'lucide-react';
import { UserSession } from '../services/api';
import ApiService, { LeaveRecord, LeaveType } from '../services/api';

interface LeavesViewProps {
  session: UserSession;
  onBackToDashboard?: () => void;
}

export default function LeavesView({ session, onBackToDashboard }: LeavesViewProps) {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string>('');
  const [durationType, setDurationType] = useState<'Full Day' | 'Multiple' | 'First Half' | 'Second Half'>('Full Day');
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMsg(null);
    try {
      const fetchedLeaves = await ApiService.getLeaves(session.baseUrl, session.token, session.userId);
      const fetchedTypes = await ApiService.getLeaveTypes(session.baseUrl, session.token);
      
      setLeaves(fetchedLeaves);
      setLeaveTypes(fetchedTypes);
      
      localStorage.setItem('ph_cache_leaves', JSON.stringify(fetchedLeaves));
      localStorage.setItem('ph_cache_leave_types', JSON.stringify(fetchedTypes));
      
      if (fetchedTypes.length > 0) {
        setSelectedLeaveTypeId(fetchedTypes[0].id.toString());
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to fetch leaves data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const cachedLeaves = localStorage.getItem('ph_cache_leaves');
    const cachedTypes = localStorage.getItem('ph_cache_leave_types');
    if (cachedLeaves && cachedTypes) {
      try {
        const leavesData = JSON.parse(cachedLeaves);
        const typesData = JSON.parse(cachedTypes);
        setLeaves(leavesData);
        setLeaveTypes(typesData);
        if (typesData.length > 0) {
          setSelectedLeaveTypeId(typesData[0].id.toString());
        }
        setIsLoading(false);
      } catch (e) {
        console.error('Failed to parse cached leaves', e);
      }
    }
    loadData(!!(cachedLeaves && cachedTypes));
  }, [session]);

  // Frontend Grouping Logic for stability
  const getGroupedLeaves = () => {
    const groups: Record<string, any> = {};
    const result: any[] = [];

    for (const leave of leaves) {
      const uniqueId = leave.unique_id?.toString();
      const dateStr = leave.leave_date;
      if (!dateStr) continue;

      // Lookup leave type name locally
      const typeData = leaveTypes.find((t) => t.id.toString() === leave.leave_type_id?.toString());
      const typeNameVisible = typeData ? (typeData.type_name || 'Leave') : 'Leave';
      const durationValue = leave.duration === 'half day' ? 0.5 : 1.0;

      if (!uniqueId) {
        result.push({
          ...leave,
          typeNameVisible,
          start_date: dateStr,
          end_date: dateStr,
          total_days: durationValue,
        });
      } else {
        if (groups[uniqueId]) {
          const group = groups[uniqueId];
          const currentStart = new Date(group.start_date);
          const currentEnd = new Date(group.end_date);
          const newDate = new Date(dateStr);

          if (newDate < currentStart) group.start_date = dateStr;
          if (newDate > currentEnd) group.end_date = dateStr;

          group.total_days += durationValue;
        } else {
          const newGroup = {
            ...leave,
            typeNameVisible,
            start_date: dateStr,
            end_date: dateStr,
            total_days: durationValue,
          };
          groups[uniqueId] = newGroup;
          result.push(newGroup);
        }
      }
    }

    // Sort by start date descending
    result.sort((a, b) => b.start_date.localeCompare(a.start_date));
    return result;
  };

  // Leaves balance calculations: quota_leaves - used_leaves
  const getLeaveBalances = () => {
    return leaveTypes.map((type) => {
      let quota = parseFloat(type.quota_leaves || '0') || 0;
      let taken = parseFloat(type.used_leaves || '0') || 0;

      let monthlyLimit = parseFloat(type.monthly_limit || '0');

      if (monthlyLimit > 0) {
        quota = monthlyLimit;
        
        // Calculate taken leaves specifically for the current month
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        taken = leaves
          .filter(l => 
            l.leave_type_id?.toString() === type.id.toString() && 
            l.status === 'approved' &&
            new Date(l.leave_date).getMonth() === currentMonth &&
            new Date(l.leave_date).getFullYear() === currentYear
          )
          .reduce((sum, l) => sum + (l.duration === 'half day' ? 0.5 : 1), 0);
      }

      let available = quota - taken;
      if (available < 0) available = 0;

      return {
        id: type.id,
        name: type.type_name || 'Leave',
        quota,
        available,
        color: type.color || '#1a237e'
      };
    });
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation
    const dateInput = durationType === 'Multiple' ? startDate : singleDate;
    if (!selectedLeaveTypeId || !dateInput || !reason.trim()) {
      setErrorMsg('Please fill in all required fields');
      return;
    }
    if (durationType === 'Multiple' && !endDate) {
      setErrorMsg('Please select an end date');
      return;
    }

    setIsSubmitting(true);

    try {
      let apiDuration = 'full day';
      if (durationType === 'First Half' || durationType === 'Second Half') {
        apiDuration = 'half day';
      } else if (durationType === 'Multiple') {
        apiDuration = 'multiple days';
      }

      const halfDayType = durationType === 'First Half' 
        ? 'first_half' 
        : durationType === 'Second Half' 
          ? 'second_half' 
          : null;

      await ApiService.createLeave(
        session.baseUrl,
        session.token,
        session.userId,
        parseInt(selectedLeaveTypeId, 10),
        durationType === 'Multiple' ? startDate : singleDate,
        apiDuration,
        reason,
        durationType === 'Multiple' ? endDate : null,
        halfDayType
      );

      // Reset form
      setReason('');
      setSingleDate('');
      setStartDate('');
      setEndDate('');
      setDurationType('Full Day');
      
      setSuccessMsg('Leave request submitted successfully');
      setShowApplyForm(false);
      
      // Reload
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateDisplay = (startStr: string, endStr: string) => {
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (isNaN(start.getTime())) return startStr;

      if (startStr === endStr) {
        return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (start.getFullYear() === end.getFullYear()) {
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }

      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } catch {
      return startStr;
    }
  };

  const getStatusColor = (status: string) => {
    const cleanStatus = status.toLowerCase().trim();
    if (cleanStatus === 'approved') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40';
    if (cleanStatus === 'rejected') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-100 dark:border-rose-900/40';
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/40';
  };

  const getLeaveIcon = (name: string, color: string) => {
    const cleanName = name.toLowerCase();
    let IconComponent = CalendarIcon;
    if (cleanName.includes('sick') || cleanName.includes('medical')) {
      IconComponent = Heart;
    } else if (cleanName.includes('casual')) {
      IconComponent = CalendarDays;
    } else if (cleanName.includes('annual') || cleanName.includes('holiday')) {
      IconComponent = Umbrella;
    }
    return <IconComponent className="w-5 h-5" style={{ color }} />;
  };

  const balances = getLeaveBalances();
  const groupedLeaves = getGroupedLeaves();

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 pt-10 pb-24 md:pb-6 font-sans">
      
      {/* Dynamic Notifications */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border bg-emerald-50 border-emerald-100 text-emerald-750 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400 text-sm font-semibold transition-all duration-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-2 font-bold cursor-pointer text-emerald-450 hover:text-emerald-600">×</button>
        </div>
      )}

      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border bg-rose-50 border-rose-100 text-rose-750 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 text-sm font-semibold transition-all duration-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-2 font-bold cursor-pointer text-rose-450 hover:text-rose-600">×</button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        {showApplyForm || onBackToDashboard ? (
          <button
            onClick={() => {
              if (showApplyForm) setShowApplyForm(false);
              else if (onBackToDashboard) onBackToDashboard();
            }}
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-350 cursor-pointer active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
        ) : null}

        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">
            {showApplyForm ? 'Apply Leave' : 'Leaves'}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
            {showApplyForm ? 'Submit a new request' : 'Track and manage your time off'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-6 py-8">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[1, 2].map((i) => (
              <div key={i} className="w-48 h-32 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/60 shrink-0 animate-pulse" />
            ))}
          </div>
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/4 animate-pulse mt-4" />
          <div className="h-40 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/60 animate-pulse" />
        </div>
      ) : showApplyForm ? (
        
        /* Apply Form Content */
        <form onSubmit={handleApplySubmit} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-5">
          
          {/* Leave Type Select */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Leave Type
            </label>
            <select
              value={selectedLeaveTypeId}
              onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
            >
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.type_name}
                </option>
              ))}
            </select>
          </div>

          {/* Duration Type selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Duration Type
            </label>
            <div className="grid grid-cols-4 gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
              {(['Full Day', 'Multiple', 'First Half', 'Second Half'] as const).map((opt) => {
                const isSelected = durationType === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDurationType(opt)}
                    className={`py-2 rounded-lg text-[9px] font-bold text-center transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm border border-slate-100/50 dark:border-slate-800'
                        : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 cursor-pointer'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker Fields */}
          {durationType === 'Multiple' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Select Date
              </label>
              <input
                type="date"
                required
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
              />
            </div>
          )}

          {/* Reason Textarea */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Reason
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you taking leave?"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl text-sm tracking-wider active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary/10 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                SUBMITTING...
              </>
            ) : (
              'Submit Request'
            )}
          </button>

        </form>

      ) : (
        
        /* Main Dashboard view */
        <div className="flex flex-col gap-8">
          
          {/* Balance scroll section */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-baseline px-1">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Leave Balances
              </h3>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Balances as of {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {balances.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-600 text-xs">
                No leave categories configured.
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                {balances.map((bal, idx) => {
                  // Alternating backgrounds matching Flutter cards
                  const cardBg = idx % 2 === 0 
                    ? 'bg-blue-50/50 dark:bg-slate-900 border-blue-100/30' 
                    : 'bg-indigo-50/40 dark:bg-slate-900 border-indigo-100/30';
                  
                  return (
                    <div
                      key={bal.id}
                      className={`w-48 p-4 rounded-3xl border shadow-sm shrink-0 flex flex-col gap-4 ${cardBg}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm border border-slate-50 dark:border-slate-800 shrink-0 overflow-hidden">
                          <img 
                            src={idx % 2 === 0 ? '/1.png' : '/2.png'} 
                            alt={bal.name} 
                            className="w-7 h-7 object-contain" 
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {bal.name}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-left pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Total</span>
                          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-300 mt-0.5">
                            {bal.quota % 1 === 0 ? bal.quota.toString() : bal.quota.toFixed(1)} <span className="text-[9px] font-bold">Days</span>
                          </span>
                        </div>
                        <div className="flex flex-col pl-2 border-l border-slate-200 dark:border-slate-800">
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Avail</span>
                          <span className="text-sm font-extrabold mt-0.5" style={{ color: bal.color }}>
                            {bal.available % 1 === 0 ? bal.available.toString() : bal.available.toFixed(1)} <span className="text-[9px] font-bold">Days</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Trigger Button */}
          <div className="my-2">
            <button
              onClick={() => setShowApplyForm(true)}
              className="w-full py-4 bg-primary text-white font-bold rounded-2xl text-sm tracking-wider active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-primary/10"
            >
              <Plus className="w-5 h-5" />
              <span>Apply For Leave</span>
            </button>
          </div>

          {/* Past Leaves Lists */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Past Leaves
            </h3>

            {groupedLeaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
                <FileText className="w-10 h-10 stroke-[1.5] text-slate-300 dark:text-slate-700" />
                <h3 className="text-xs font-bold text-slate-500 mt-2">No leave history</h3>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800/80">
                {groupedLeaves.map((leave, idx) => {
                  const status = leave.status || 'Pending';
                  const totalDays = parseFloat(leave.total_days || '1');

                  return (
                    <div
                      key={leave.id || idx}
                      className="p-4 flex items-start gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors"
                    >
                      {/* Avatar shape */}
                      <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center shrink-0 border border-slate-100/50 dark:border-slate-800 overflow-hidden">
                        <img 
                          src={idx % 2 === 0 ? '/1.png' : '/2.png'} 
                          alt={leave.typeNameVisible} 
                          className="w-8 h-8 object-contain" 
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                            {leave.typeNameVisible}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${getStatusColor(status)}`}>
                            {status}
                          </span>
                        </div>

                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                          {formatDateDisplay(leave.start_date, leave.end_date)}
                        </span>

                        <span className="text-xs font-bold text-slate-400 dark:text-slate-600 mt-0.5">
                          {totalDays % 1 === 0 ? totalDays.toString() : totalDays.toFixed(1)} Days
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>



        </div>
      )}

    </div>
  );
}
