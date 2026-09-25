'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  FileText,
  Pencil,
  Trash2,
  Paperclip,
  UploadCloud,
  X
} from 'lucide-react';
import { UserSession } from '../services/api';
import ApiService, { LeaveRecord, LeaveType, CompOffRecord } from '../services/api';

interface LeavesViewProps {
  session: UserSession;
  onBackToDashboard?: () => void;
}

export default function LeavesView({ session, onBackToDashboard }: LeavesViewProps) {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [compOffRequests, setCompOffRequests] = useState<CompOffRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'leaves' | 'comp-off'>('leaves');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [showCompOffForm, setShowCompOffForm] = useState(false);
  const [editingLeave, setEditingLeave] = useState<any | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    type: 'leave' | 'comp-off';
    data: any;
    title: string;
    description: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Leave Form State
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string>('');
  const [durationType, setDurationType] = useState<'Full Day' | 'Multiple' | 'First Half' | 'Second Half'>('Full Day');
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Comp Off Form State
  const [compOffLeaveTypeId, setCompOffLeaveTypeId] = useState<string>('');
  const [compOffDuration, setCompOffDuration] = useState<'single' | 'multiple' | 'first_half' | 'second_half'>('single');
  const [compOffDateWorked, setCompOffDateWorked] = useState('');
  const [compOffStartDateWorked, setCompOffStartDateWorked] = useState('');
  const [compOffEndDateWorked, setCompOffEndDateWorked] = useState('');
  const [compOffReason, setCompOffReason] = useState('');
  const [compOffFile, setCompOffFile] = useState<File | null>(null);
  const compOffFileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const isEarnedCompOffType = (type: LeaveType) => {
    const typeName = (type.type_name || '').toLowerCase();
    const leavetype = (type.leavetype || '').toLowerCase();
    return (
      leavetype === 'earned' ||
      leavetype === 'comp_off' ||
      typeName.includes('comp off') ||
      typeName.includes('comp-off') ||
      typeName.includes('com-off') ||
      typeName.includes('com off') ||
      typeName.includes('earned')
    );
  };

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMsg(null);
    try {
      const [fetchedLeaves, fetchedTypes, fetchedCompOffs] = await Promise.all([
        ApiService.getLeaves(session.baseUrl, session.token, session.userId),
        ApiService.getLeaveTypes(session.baseUrl, session.token),
        ApiService.getCompOffRequests(session.baseUrl, session.token, session.userId).catch(() => []),
      ]);
      
      setLeaves(fetchedLeaves);
      setLeaveTypes(fetchedTypes);
      setCompOffRequests(fetchedCompOffs || []);
      
      localStorage.setItem('ph_cache_leaves', JSON.stringify(fetchedLeaves));
      localStorage.setItem('ph_cache_leave_types', JSON.stringify(fetchedTypes));
      localStorage.setItem('ph_cache_comp_offs', JSON.stringify(fetchedCompOffs || []));
      
      if (fetchedTypes.length > 0) {
        setSelectedLeaveTypeId(fetchedTypes[0].id.toString());
        const compOffType = fetchedTypes.find(isEarnedCompOffType);
        if (compOffType) {
          setCompOffLeaveTypeId(compOffType.id.toString());
        } else {
          setCompOffLeaveTypeId(fetchedTypes[0].id.toString());
        }
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
    const cachedCompOffs = localStorage.getItem('ph_cache_comp_offs');
    if (cachedLeaves && cachedTypes) {
      try {
        const leavesData = JSON.parse(cachedLeaves);
        const typesData = JSON.parse(cachedTypes);
        setLeaves(leavesData);
        setLeaveTypes(typesData);
        if (cachedCompOffs) {
          setCompOffRequests(JSON.parse(cachedCompOffs));
        }
        if (typesData.length > 0) {
          setSelectedLeaveTypeId(typesData[0].id.toString());
          const compOffType = typesData.find(isEarnedCompOffType);
          if (compOffType) {
            setCompOffLeaveTypeId(compOffType.id.toString());
          }
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
          subLeaveIds: [leave.id],
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
          group.subLeaveIds.push(leave.id);
        } else {
          const newGroup = {
            ...leave,
            typeNameVisible,
            start_date: dateStr,
            end_date: dateStr,
            total_days: durationValue,
            subLeaveIds: [leave.id],
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

  const formatToYmd = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];

    try {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch {}
    return '';
  };

  const handleOpenApply = () => {
    setShowCompOffForm(false);
    setEditingLeave(null);
    setReason('');
    setSingleDate('');
    setStartDate('');
    setEndDate('');
    setDurationType('Full Day');
    if (leaveTypes.length > 0) {
      setSelectedLeaveTypeId(leaveTypes[0].id.toString());
    }
    setShowApplyForm(true);
  };

  const handleOpenCompOff = () => {
    setShowApplyForm(false);
    setEditingLeave(null);
    setCompOffReason('');
    setCompOffDateWorked('');
    setCompOffStartDateWorked('');
    setCompOffEndDateWorked('');
    setCompOffDuration('single');
    setCompOffFile(null);
    if (compOffFileInputRef.current) {
      compOffFileInputRef.current.value = '';
    }

    const earnedTypes = leaveTypes.filter(isEarnedCompOffType);
    if (earnedTypes.length > 0) {
      setCompOffLeaveTypeId(earnedTypes[0].id.toString());
    } else if (leaveTypes.length > 0) {
      setCompOffLeaveTypeId(leaveTypes[0].id.toString());
    }
    setShowCompOffForm(true);
  };

  const handleOpenEdit = (leave: any) => {
    setShowCompOffForm(false);
    setEditingLeave(leave);
    setSelectedLeaveTypeId(leave.leave_type_id ? leave.leave_type_id.toString() : (leaveTypes[0]?.id?.toString() || ''));
    setReason(leave.reason || '');

    const startYmd = formatToYmd(leave.start_date || leave.leave_date);
    const endYmd = formatToYmd(leave.end_date || leave.leave_date || leave.start_date);

    if ((leave.total_days && parseFloat(leave.total_days) > 1 && leave.start_date !== leave.end_date) || leave.duration === 'multiple days') {
      setDurationType('Multiple');
      setStartDate(startYmd);
      setEndDate(endYmd);
      setSingleDate(startYmd);
    } else if (leave.duration === 'half day') {
      const halfType = leave.half_day_type === 'second_half' ? 'Second Half' : 'First Half';
      setDurationType(halfType);
      setSingleDate(startYmd);
      setStartDate(startYmd);
      setEndDate(startYmd);
    } else {
      setDurationType('Full Day');
      setSingleDate(startYmd);
      setStartDate(startYmd);
      setEndDate(startYmd);
    }

    setShowApplyForm(true);
  };

  const handleOpenDeleteLeave = (leave: any) => {
    const dates = formatDateDisplay(leave.start_date, leave.end_date);
    setDeleteModal({
      type: 'leave',
      data: leave,
      title: 'Cancel Leave Request',
      description: `Are you sure you want to cancel the leave request for ${leave.typeNameVisible || 'Leave'}${dates ? ` (${dates})` : ''}?`,
    });
  };

  const handleOpenDeleteCompOff = (req: CompOffRecord) => {
    const typeName = req.leave_type?.type_name || 'Earned/ Comp Off';
    const dates = formatDateDisplay(req.date_worked, req.end_date_worked);
    setDeleteModal({
      type: 'comp-off',
      data: req,
      title: 'Cancel Comp Off Request',
      description: `Are you sure you want to cancel the comp off request for ${typeName}${dates ? ` (Worked: ${dates})` : ''}?`,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (deleteModal.type === 'leave') {
        const leave = deleteModal.data;
        if (leave.unique_id && Array.isArray(leave.subLeaveIds) && leave.subLeaveIds.length > 0) {
          for (const subId of leave.subLeaveIds) {
            await ApiService.deleteLeave(session.baseUrl, session.token, subId);
          }
        } else {
          await ApiService.deleteLeave(session.baseUrl, session.token, leave.id);
        }
        setSuccessMsg('Leave request cancelled successfully');
      } else {
        const compOff = deleteModal.data;
        await ApiService.deleteCompOffRequest(session.baseUrl, session.token, compOff.id);
        setSuccessMsg('Comp Off request cancelled successfully');
      }
      setDeleteModal(null);
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to cancel request');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

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

      if (editingLeave) {
        const leaveTypeId = parseInt(selectedLeaveTypeId, 10);
        const subIds = Array.isArray(editingLeave.subLeaveIds) && editingLeave.subLeaveIds.length > 0 
          ? editingLeave.subLeaveIds 
          : [editingLeave.id];

        for (const id of subIds) {
          await ApiService.updateLeave(
            session.baseUrl,
            session.token,
            id,
            leaveTypeId,
            dateInput,
            apiDuration,
            reason.trim(),
            halfDayType
          );
        }

        setSuccessMsg('Leave request updated successfully');
      } else {
        await ApiService.createLeave(
          session.baseUrl,
          session.token,
          session.userId,
          parseInt(selectedLeaveTypeId, 10),
          durationType === 'Multiple' ? startDate : singleDate,
          apiDuration,
          reason.trim(),
          durationType === 'Multiple' ? endDate : null,
          halfDayType
        );
        setSuccessMsg('Leave request submitted successfully');
      }

      // Reset form
      setReason('');
      setSingleDate('');
      setStartDate('');
      setEndDate('');
      setDurationType('Full Day');
      setEditingLeave(null);
      setShowApplyForm(false);
      
      // Reload
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || (editingLeave ? 'Failed to update leave request' : 'Failed to submit leave request'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompOffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const dateWorked = compOffDuration === 'multiple' ? compOffStartDateWorked : compOffDateWorked;
    if (!compOffLeaveTypeId || !dateWorked || !compOffReason.trim()) {
      setErrorMsg('Please fill in all required fields');
      return;
    }
    if (compOffDuration === 'multiple' && !compOffEndDateWorked) {
      setErrorMsg('Please select an end date');
      return;
    }

    if (compOffDuration === 'multiple' && compOffStartDateWorked > compOffEndDateWorked) {
      setErrorMsg('Start date cannot be after end date');
      return;
    }

    if (dateWorked > todayStr || (compOffDuration === 'multiple' && compOffEndDateWorked > todayStr)) {
      setErrorMsg('Comp Off can only be requested for past or current dates worked.');
      return;
    }

    setIsSubmitting(true);

    try {
      await ApiService.createCompOffRequest(
        session.baseUrl,
        session.token,
        session.userId,
        parseInt(compOffLeaveTypeId, 10),
        compOffDuration,
        dateWorked,
        compOffReason.trim(),
        compOffDuration === 'multiple' ? compOffEndDateWorked : null,
        compOffFile
      );

      setSuccessMsg('Comp Off request submitted successfully');

      // Reset form
      setCompOffReason('');
      setCompOffDateWorked('');
      setCompOffStartDateWorked('');
      setCompOffEndDateWorked('');
      setCompOffDuration('single');
      setCompOffFile(null);
      setShowCompOffForm(false);
      if (compOffFileInputRef.current) {
        compOffFileInputRef.current.value = '';
      }

      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to submit comp off request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateDisplay = (startStr: string, endStr?: string | null) => {
    try {
      const start = new Date(startStr);
      if (isNaN(start.getTime())) return startStr;

      if (!endStr || startStr === endStr) {
        return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      const end = new Date(endStr);
      if (isNaN(end.getTime())) return startStr;

      if (start.getFullYear() === end.getFullYear()) {
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }

      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } catch {
      return startStr;
    }
  };

  const getStatusColor = (status: string) => {
    const cleanStatus = (status || '').toLowerCase().trim();
    if (cleanStatus === 'approved') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40';
    if (cleanStatus === 'rejected') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-100 dark:border-rose-900/40';
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/40';
  };

  const balances = getLeaveBalances();
  const groupedLeaves = getGroupedLeaves();
  const earnedCompOffLeaveTypes = leaveTypes.filter(isEarnedCompOffType);
  const compOffTypesForDropdown = earnedCompOffLeaveTypes.length > 0 ? earnedCompOffLeaveTypes : leaveTypes;

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
        {showApplyForm || showCompOffForm || onBackToDashboard ? (
          <button
            onClick={() => {
              if (showApplyForm) {
                setShowApplyForm(false);
                setEditingLeave(null);
              } else if (showCompOffForm) {
                setShowCompOffForm(false);
              } else if (onBackToDashboard) {
                onBackToDashboard();
              }
            }}
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-350 cursor-pointer active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
        ) : null}

        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">
            {showApplyForm 
              ? (editingLeave ? 'Edit Leave Request' : 'Apply Leave') 
              : showCompOffForm 
                ? 'Create Comp Off Request' 
                : 'Leaves'}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
            {showApplyForm 
              ? (editingLeave ? 'Update your pending request' : 'Submit a new leave request') 
              : showCompOffForm 
                ? 'Claim comp off for working on a weekend or holiday' 
                : 'Track and manage your time off'}
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
                {editingLeave ? 'UPDATING...' : 'SUBMITTING...'}
              </>
            ) : (
              editingLeave ? 'Update Request' : 'Submit Request'
            )}
          </button>

        </form>

      ) : showCompOffForm ? (

        /* Comp Off Form Content */
        <form onSubmit={handleCompOffSubmit} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-5">
          
          {/* Leave Type Select (Earned / Comp Off only) */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Leave Type
            </label>
            <select
              value={compOffLeaveTypeId}
              onChange={(e) => setCompOffLeaveTypeId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
            >
              {compOffTypesForDropdown.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.type_name} {type.comp_off_expiry_after ? `(Expires in ${type.comp_off_expiry_after} ${type.comp_off_expiry_type || 'days'})` : ''}
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
              {[
                { label: 'Full Day', val: 'single' },
                { label: 'Multiple', val: 'multiple' },
                { label: 'First Half', val: 'first_half' },
                { label: 'Second Half', val: 'second_half' }
              ].map((opt) => {
                const isSelected = compOffDuration === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setCompOffDuration(opt.val as any)}
                    className={`py-2 rounded-lg text-[9px] font-bold text-center transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-slate-800 text-primary shadow-sm border border-slate-100/50 dark:border-slate-800'
                        : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 cursor-pointer'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker Fields */}
          {compOffDuration === 'multiple' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Start Date Worked
                </label>
                <input
                  type="date"
                  required
                  max={todayStr}
                  value={compOffStartDateWorked}
                  onChange={(e) => setCompOffStartDateWorked(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  End Date Worked
                </label>
                <input
                  type="date"
                  required
                  max={todayStr}
                  value={compOffEndDateWorked}
                  onChange={(e) => setCompOffEndDateWorked(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Date Worked
              </label>
              <input
                type="date"
                required
                max={todayStr}
                value={compOffDateWorked}
                onChange={(e) => setCompOffDateWorked(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
              />
            </div>
          )}

          {/* Reason Textarea */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Reason / Work Done
            </label>
            <textarea
              required
              rows={4}
              value={compOffReason}
              onChange={(e) => setCompOffReason(e.target.value)}
              placeholder="Describe the work done or reason for comp off..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200 resize-none"
            />
          </div>

          {/* File Upload */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Attachment (Optional)
            </label>
            <input
              type="file"
              ref={compOffFileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setCompOffFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            {compOffFile ? (
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{compOffFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCompOffFile(null);
                    if (compOffFileInputRef.current) compOffFileInputRef.current.value = '';
                  }}
                  className="text-rose-500 hover:text-rose-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => compOffFileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 px-4 border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary rounded-2xl text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors"
              >
                <UploadCloud className="w-4 h-4 text-slate-400" />
                <span>Upload supporting document / screenshot</span>
              </button>
            )}
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
                <span>SUBMITTING...</span>
              </>
            ) : (
              <span>Submit Comp Off Request</span>
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

          {/* Action Trigger Buttons: Divided into 2 equal halves */}
          <div className="grid grid-cols-2 gap-3 my-2">
            <button
              onClick={handleOpenApply}
              className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl text-xs md:text-sm tracking-wide active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-primary/10"
            >
              <Plus className="w-4.5 h-4.5 shrink-0" />
              <span className="truncate">Apply For Leave</span>
            </button>
            <button
              onClick={handleOpenCompOff}
              className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl text-xs md:text-sm tracking-wide active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-primary/10"
            >
              <Plus className="w-4.5 h-4.5 shrink-0" />
              <span className="truncate">Create Comp Off</span>
            </button>
          </div>

          {/* History Sub-Tabs (Leaves vs Comp Off Requests) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('leaves')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'leaves'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Past Leaves ({groupedLeaves.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('comp-off')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'comp-off'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Comp Off Requests ({compOffRequests.length})
                </button>
              </div>
            </div>

            {activeTab === 'leaves' ? (
              groupedLeaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
                  <FileText className="w-10 h-10 stroke-[1.5] text-slate-300 dark:text-slate-700" />
                  <h3 className="text-xs font-bold text-slate-500 mt-2">No leave history</h3>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800/80">
                  {groupedLeaves.map((leave, idx) => {
                    const status = leave.status || 'Pending';
                    const totalDays = parseFloat(leave.total_days || '1');
                    const isPending = status.toLowerCase().trim() === 'pending';

                    return (
                      <div
                        key={leave.id || idx}
                        className="p-4 flex items-start gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors"
                      >
                        {/* Left Column: Avatar + Action Icons */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center border border-slate-100/50 dark:border-slate-800 overflow-hidden mt-0.5">
                            <img 
                              src={idx % 2 === 0 ? '/1.png' : '/2.png'} 
                              alt={leave.typeNameVisible} 
                              className="w-8 h-8 object-contain" 
                            />
                          </div>

                          {/* Actions for Pending Leaves on extreme left */}
                          {isPending && (
                            <div className="flex items-center justify-center gap-1 mt-2.5">
                              <button
                                type="button"
                                title="Edit Leave"
                                onClick={() => handleOpenEdit(leave)}
                                className="p-1.5 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Cancel Leave"
                                onClick={() => handleOpenDeleteLeave(leave)}
                                className="p-1.5 text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 flex flex-col gap-1.5">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                              {leave.typeNameVisible}
                            </span>
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${getStatusColor(status)}`}>
                              {status}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                            <span>{formatDateDisplay(leave.start_date, leave.end_date)}</span>
                            <span className="font-bold text-slate-500 dark:text-slate-400">
                              {totalDays % 1 === 0 ? totalDays.toString() : totalDays.toFixed(1)} {totalDays === 1 ? 'Day' : 'Days'}
                            </span>
                          </div>

                          {leave.reason && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic bg-slate-50/50 dark:bg-slate-950/30 p-2 rounded-xl border border-slate-100/50 dark:border-slate-800/40">
                              "{leave.reason}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              compOffRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
                  <Clock className="w-10 h-10 stroke-[1.5] text-slate-300 dark:text-slate-700" />
                  <h3 className="text-xs font-bold text-slate-500 mt-2">No comp off requests</h3>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800/80">
                  {compOffRequests.map((req, idx) => {
                    const status = req.status || 'Pending';
                    const days = parseFloat((req.days || 1).toString());
                    const isPending = status.toLowerCase().trim() === 'pending';
                    const typeName = req.leave_type?.type_name || 'Earned/ Comp Off';

                    return (
                      <div
                        key={req.id || idx}
                        className="p-4 flex items-start gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors"
                      >
                        {/* Left Column: Avatar + Action Icons */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center border border-slate-100/50 dark:border-slate-800 overflow-hidden mt-0.5">
                            <Clock className="w-5 h-5 text-primary" />
                          </div>

                          {/* Actions for Pending Requests */}
                          {isPending && (
                            <div className="flex items-center justify-center gap-1 mt-2.5">
                              <button
                                type="button"
                                title="Cancel Request"
                                onClick={() => handleOpenDeleteCompOff(req)}
                                className="p-1.5 text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 flex flex-col gap-1.5">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                              {typeName}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${getStatusColor(status)}`}>
                                {status}
                              </span>
                              {req.lapsed ? (
                                <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                                  Lapsed
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                            <span>Worked: {formatDateDisplay(req.date_worked, req.end_date_worked)}</span>
                            <span className="font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              +{days % 1 === 0 ? days.toString() : days.toFixed(1)} {days === 1 ? 'Day' : 'Days'}
                            </span>
                          </div>

                          {req.expires_at && status.toLowerCase() === 'approved' && (
                            <div className="text-[11px] text-slate-400">
                              Valid Till: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatDateDisplay(req.expires_at)}</span>
                            </div>
                          )}

                          {req.reason && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic bg-slate-50/50 dark:bg-slate-950/30 p-2 rounded-xl border border-slate-100/50 dark:border-slate-800/40">
                              "{req.reason}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

        </div>
      )}

      {/* Custom Confirmation Modal for Cancelling Leaves / Comp Offs */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            {/* Header / Icon */}
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-500 shrink-0 border border-rose-100 dark:border-rose-900/50">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-slate-850 dark:text-slate-100">
                  {deleteModal.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {deleteModal.description}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 font-medium">
              This action cannot be undone and will cancel your pending request.
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 mt-1">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                No, Keep
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl text-xs shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  'Yes, Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

