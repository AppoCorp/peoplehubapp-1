'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Receipt, 
  Plus, 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Upload,
  Calendar,
  X,
  FileText,
  DollarSign
} from 'lucide-react';
import { UserSession } from '../services/api';
import ApiService, { ExpenseRecord, ExpenseCategory } from '../services/api';

interface ExpensesViewProps {
  session: UserSession;
  onBackToDashboard?: () => void;
}

export default function ExpensesView({ session, onBackToDashboard }: ExpensesViewProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [itemName, setItemName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [price, setPrice] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasedFrom, setPurchasedFrom] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, any>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMsg(null);
    try {
      // Fetch currencies (gracefully ignore errors)
      try {
        await ApiService.fetchCurrencies(session.baseUrl, session.token);
      } catch (e) {
        console.warn('Failed to fetch currencies metadata:', e);
      }

      let expensesList: ExpenseRecord[] = [];
      try {
        expensesList = await ApiService.getExpenses(session.baseUrl, session.token);
      } catch (e: any) {
        console.error('Failed to load expenses list:', e);
        setErrorMsg(e.message || 'Failed to load expenses history');
      }

      let categoriesList: ExpenseCategory[] = [];
      try {
        categoriesList = await ApiService.getExpenseCategories(session.baseUrl, session.token);
      } catch (e) {
        console.warn('Failed to load expense categories (unsupported backend endpoint):', e);
      }

      let customFieldsList: any[] = [];
      try {
        customFieldsList = await ApiService.getExpenseCustomFields(session.baseUrl, session.token);
        console.log('Expense custom fields fetched:', customFieldsList);
      } catch (e) {
        console.warn('Failed to load expense custom fields:', e);
      }
      
      console.log('Expense categories fetched:', categoriesList);

      // Learn currencies metadata from history records if missing, matching Flutter logic
      if (Array.isArray(expensesList)) {
        for (const exp of expensesList) {
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

      setExpenses(expensesList);
      setCategories(categoriesList);
      setCustomFields(customFieldsList);
      
      localStorage.setItem('ph_cache_expenses', JSON.stringify(expensesList));
      localStorage.setItem('ph_cache_expense_categories', JSON.stringify(categoriesList));
      localStorage.setItem('ph_cache_expense_custom_fields', JSON.stringify(customFieldsList));

      if (categoriesList.length > 0) {
        setSelectedCategoryId(categoriesList[0].id.toString());
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to fetch expenses claims data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const cachedExpenses = localStorage.getItem('ph_cache_expenses');
    const cachedCategories = localStorage.getItem('ph_cache_expense_categories');
    const cachedCustomFields = localStorage.getItem('ph_cache_expense_custom_fields');
    if (cachedExpenses && cachedCategories) {
      try {
        const expensesData = JSON.parse(cachedExpenses);
        const categoriesData = JSON.parse(cachedCategories);
        setExpenses(expensesData);
        setCategories(categoriesData);
        if (cachedCustomFields) {
          setCustomFields(JSON.parse(cachedCustomFields));
        }
        if (categoriesData.length > 0) {
          setSelectedCategoryId(categoriesData[0].id.toString());
        }
        setIsLoading(false);
      } catch (e) {
        console.error('Failed to parse cached expenses', e);
      }
    }
    loadData(!!(cachedExpenses && cachedCategories));
  }, [session]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Form validations
    if (!itemName.trim() || !price || !purchaseDate) {
      setErrorMsg('Please fill in all required fields');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Please enter a valid expense amount');
      return;
    }

    // Custom Fields validation
    for (const field of customFields) {
      const fieldKey = `field_${field.id}`;
      const isRequired = field.required === 'yes';
      if (isRequired) {
        const val = customFieldsValues[fieldKey];
        if (!val || (Array.isArray(val) && val.length === 0)) {
          setErrorMsg(`Please fill in the required field: ${field.label}`);
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      await ApiService.createExpense(
        session.baseUrl,
        session.token,
        session.userId,
        itemName,
        priceNum,
        purchaseDate,
        purchasedFrom,
        selectedCategoryId || null,
        currency,
        receiptFile,
        customFieldsValues
      );

      // Reset form
      setItemName('');
      setPrice('');
      setPurchasedFrom('');
      setReceiptFile(null);
      setCustomFieldsValues({});
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccessMsg('Expense claim submitted successfully');
      setShowApplyForm(false);
      
      // Reload
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to submit expense claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHeicFile = (file: File): boolean => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    return type === 'image/heic' || type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
  };

  const compressImageIfNeeded = async (file: File): Promise<File> => {
    if (!file) return file;
    const isHeic = isHeicFile(file);
    if (!isHeic && !file.type.startsWith('image/')) return file;
    // HEIC/HEIF must always be converted to JPEG (unviewable in most browsers used by approvers),
    // even when small enough to skip the usual size-based compression.
    if (!isHeic && file.size <= 1.5 * 1024 * 1024) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1600;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(file);

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.8
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const processed = await compressImageIfNeeded(files[0]);
      setReceiptFile(processed);
    }
  };

  const getStatusColor = (status: string) => {
    const cleanStatus = status.toLowerCase().trim();
    if (cleanStatus === 'approved') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40';
    if (cleanStatus === 'rejected') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-100 dark:border-rose-900/40';
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/40';
  };

  const formatDate = (dateStr: string) => {
    try {
      const dt = new Date(dateStr);
      if (isNaN(dt.getTime())) return dateStr;
      return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const ensureISODate = (val: string): string => {
    if (!val) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return val;
  };


  const getCurrencySymbol = (exp: ExpenseRecord) => {
    // If currency id is present, query metadata
    if (exp.currency?.id) {
      const sym = ApiService.getCurrencySymbolById(exp.currency.id);
      if (sym) return sym;
    }
    
    // Fallbacks based on code
    const code = exp.currency?.currency_code || 'INR';
    if (code.toUpperCase() === 'USD') return '$';
    if (code.toUpperCase() === 'EUR') return '€';
    return '₹';
  };

  const getCurrencyLabel = (code: string) => {
    if (code === 'USD') return '$ USD';
    if (code === 'EUR') return '€ EUR';
    return '₹ INR';
  };

  // Stats calculation
  const pendingCount = expenses.filter((e) => e.status?.toLowerCase() === 'pending').length;
  const totalClaims = expenses.length;

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 pt-10 pb-24 md:pb-6 font-sans">
      
      {/* Dynamic Notifications */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border bg-emerald-50 border-emerald-100 text-emerald-750 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400 text-sm font-semibold transition-all duration-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-2 font-bold cursor-pointer text-emerald-450 hover:text-emerald-605">×</button>
        </div>
      )}

      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border bg-rose-50 border-rose-100 text-rose-750 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 text-sm font-semibold transition-all duration-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-2 font-bold cursor-pointer text-rose-450 hover:text-rose-605">×</button>
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
            {showApplyForm ? 'Add Expense' : 'Expenses'}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
            {showApplyForm ? 'Upload your receipt to submit' : 'Track and manage your claims history'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-6 py-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/60 animate-pulse" />
            <div className="h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/60 animate-pulse" />
          </div>
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/4 animate-pulse mt-4" />
          <div className="h-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/60 animate-pulse" />
        </div>
      ) : showApplyForm ? (
        
        /* New Expense Form Layout */
        <form noValidate onSubmit={handleApplySubmit} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-5">
          
          {/* Item Name input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Item Name
            </label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Flight Ticket"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
            />
          </div>

          {/* Currency and Amount Fields */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
              >
                <option value="INR">₹ INR</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>
            
            <div className="col-span-2 flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
              />
            </div>
          </div>

          {/* Category Select */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Category
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>

          {/* Purchase Date picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Purchase Date
            </label>
            <input
              type="date"
              required
              value={ensureISODate(purchaseDate)}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
            />
          </div>

          {/* Vendor/Purchased From input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Vendor (Purchased From)
            </label>
            <input
              type="text"
              value={purchasedFrom}
              onChange={(e) => setPurchasedFrom(e.target.value)}
              placeholder="Where did you buy it?"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
            />
          </div>

          {/* Custom Fields */}
          {customFields.map((field) => {
            const fieldKey = `field_${field.id}`;
            const isRequired = field.required === 'yes';
            let options: string[] = [];
            if (field.values) {
              try {
                options = typeof field.values === 'string' ? JSON.parse(field.values) : field.values;
              } catch (e) {
                options = typeof field.values === 'string' ? field.values.split(',') : [];
              }
            }

            return (
              <div key={field.id} className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {field.label} {isRequired && <span className="text-red-500">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    required={isRequired}
                    value={customFieldsValues[fieldKey] || ''}
                    onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [fieldKey]: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
                    rows={3}
                  />
                ) : field.type === 'select' ? (
                  <select
                    required={isRequired}
                    value={customFieldsValues[fieldKey] || ''}
                    onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [fieldKey]: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
                  >
                    <option value="">Select {field.label.toLowerCase()}</option>
                    {options.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'radio' ? (
                  <div className="flex flex-wrap gap-4 mt-1">
                    {options.map((opt, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-350 cursor-pointer">
                        <input
                          type="radio"
                          name={fieldKey}
                          required={isRequired}
                          checked={customFieldsValues[fieldKey] === opt}
                          onChange={() => setCustomFieldsValues({ ...customFieldsValues, [fieldKey]: opt })}
                          className="text-primary focus:ring-primary focus:ring-2 border-slate-300"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : field.type === 'checkbox' ? (
                  <div className="flex flex-wrap gap-4 mt-1">
                    {options.map((opt, i) => {
                      const currentVal = Array.isArray(customFieldsValues[fieldKey]) ? customFieldsValues[fieldKey] : [];
                      return (
                        <label key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-350 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentVal.includes(opt)}
                            onChange={(e) => {
                              const newVal = e.target.checked
                                ? [...currentVal, opt]
                                : currentVal.filter((v: any) => v !== opt);
                              setCustomFieldsValues({ ...customFieldsValues, [fieldKey]: newVal });
                            }}
                            className="text-primary focus:ring-primary focus:ring-2 border-slate-300 rounded"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : field.type === 'date' ? (
                  <input
                    type="date"
                    required={isRequired}
                    value={ensureISODate(customFieldsValues[fieldKey] || '')}
                    onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [fieldKey]: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
                  />
                ) : field.type === 'file' ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      id={`file-${field.id}`}
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const processed = await compressImageIfNeeded(file);
                          setCustomFieldsValues({ ...customFieldsValues, [fieldKey]: processed });
                        }
                      }}
                    />
                    <div 
                      onClick={() => document.getElementById(`file-${field.id}`)?.click()}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-950/20 hover:border-primary/50 transition-all text-center"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary-light dark:bg-slate-800 flex items-center justify-center text-primary">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {customFieldsValues[fieldKey] ? 'Change File' : 'Attach File'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        {customFieldsValues[fieldKey] ? customFieldsValues[fieldKey].name : 'Upload JPEG, PNG or PDF (Max 5MB)'}
                      </span>
                    </div>
                    
                    {customFieldsValues[fieldKey] && (
                      <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-350">
                        <span className="truncate max-w-[85%]">{customFieldsValues[fieldKey].name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newVals = { ...customFieldsValues };
                            delete newVals[fieldKey];
                            setCustomFieldsValues(newVals);
                            const inp = document.getElementById(`file-${field.id}`) as HTMLInputElement;
                            if (inp) inp.value = '';
                          }}
                          className="text-red-500 hover:text-red-750 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    required={isRequired}
                    value={customFieldsValues[fieldKey] || ''}
                    onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [fieldKey]: e.target.value })}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-slate-200"
                  />
                )}
              </div>
            );
          })}

          {/* Receipt File upload block */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Receipt Attachment
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              className="hidden"
            />

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-950/20 hover:border-primary/50 transition-all text-center"
            >
              <div className="w-10 h-10 rounded-full bg-primary-light dark:bg-slate-800 flex items-center justify-center text-primary">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {receiptFile ? 'Change Receipt' : 'Attach Receipt'}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                {receiptFile ? receiptFile.name : 'Upload JPEG, PNG or PDF (Max 5MB)'}
              </span>
            </div>
            
            {receiptFile && (
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-350">
                <span className="truncate max-w-[85%]">{receiptFile.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReceiptFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-red-500 hover:text-red-750 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
                SUBMITTING CLAIM...
              </>
            ) : (
              'Submit Claim'
            )}
          </button>

        </form>

      ) : (
        
        /* Main Expense Dashboard layout */
        <div className="flex flex-col gap-8">
          
          {/* Stats Boxes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-1 transition-all hover:translate-y-[-1px]">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Pending
              </span>
              <span className="text-2xl font-black text-amber-500">
                {pendingCount}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-1 transition-all hover:translate-y-[-1px]">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Total Claims
              </span>
              <span className="text-2xl font-black text-primary dark:text-slate-200">
                {totalClaims}
              </span>
            </div>
          </div>

          {/* Float Action Trigger */}
          <div className="my-2">
            <button
              onClick={() => setShowApplyForm(true)}
              className="w-full py-4 bg-primary text-white font-bold rounded-2xl text-sm tracking-wider active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-primary/10"
            >
              <Plus className="w-5 h-5" />
              <span>New Expense Claim</span>
            </button>
          </div>

          {/* Expense History List */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Expense Claims History
            </h3>

            {expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
                <FileText className="w-10 h-10 stroke-[1.5] text-slate-350 dark:text-slate-700" />
                <h3 className="text-xs font-bold text-slate-500 mt-2">No expenses recorded</h3>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {expenses.map((expense) => {
                  const status = expense.status || 'Pending';
                  const symbol = getCurrencySymbol(expense);

                  return (
                    <div
                      key={expense.id}
                      className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-4 transition-transform hover:translate-y-[-1px] duration-150"
                    >
                      {/* Left Receipt avatar wrapper */}
                      <div className="w-10 h-10 rounded-full bg-primary-light/40 dark:bg-slate-800/80 text-primary dark:text-slate-350 flex items-center justify-center shrink-0 border border-slate-50 dark:border-slate-800 shadow-sm">
                        <Receipt className="w-5 h-5" />
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 flex flex-col min-w-0">
                        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200 truncate">
                          {expense.item_name || 'Expense'}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                          {formatDate(expense.purchase_date)}
                        </span>
                        {Array.isArray(expense.custom_fields) && expense.custom_fields.map((f: any) => {
                          const fKey = `field_${f.id}`;
                          const val = expense.custom_fields_data ? expense.custom_fields_data[fKey] : null;
                          if (val) {
                            return (
                              <span key={f.id} className="text-[10px] text-slate-500 dark:text-slate-450 mt-1 font-semibold">
                                {f.label}: <span className="font-extrabold text-slate-600 dark:text-slate-350">{Array.isArray(val) ? val.join(', ') : val}</span>
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>

                      {/* Right Amount details & status */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${getStatusColor(status)}`}>
                          {status}
                        </span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                          {symbol} {parseFloat(expense.price || '0').toFixed(2)}
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
