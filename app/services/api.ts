// Client-side API Service that queries the server proxy route at /api/proxy to bypass CORS

export interface UserSession {
  token: string;
  baseUrl: string;
  userId: string;
  userName: string;
  userEmail: string;
  userMobile: string;
  userImage: string;
  companyName: string;
  companyTagline: string;
  companyLogo: string;
}

export interface AttendanceRecord {
  id: number;
  clock_in_time: string;
  clock_out_time: string | null;
  work_from_type: string;
  latitude?: string;
  longitude?: string;
  clock_out_latitude?: string;
  clock_out_longitude?: string;
}

export interface HolidayRecord {
  id: number;
  occassion: string;
  date: string;
}

export interface LeaveRecord {
  id: number;
  unique_id?: string;
  leave_date: string;
  duration: string;
  reason: string;
  status: string;
  leave_type_id: string;
}

export interface LeaveType {
  id: number;
  type_name: string;
  quota_leaves: string;
  used_leaves: string;
  color?: string;
  monthly_limit?: string;
}

export interface ExpenseRecord {
  id: number;
  item_name: string;
  purchase_date: string;
  price: string;
  status: string;
  currency?: {
    id: number;
    currency_code: string;
    currency_symbol: string;
    exchange_rate: string;
  };
  custom_fields?: any[];
  custom_fields_data?: Record<string, any>;
}

export interface ExpenseCategory {
  id: number;
  category_name: string;
}

export interface CurrencyMetadata {
  id: number;
  rate: number;
  symbol: string;
}

class ApiService {
  private static currencyMetadata: Record<string, CurrencyMetadata> = {
    USD: { id: 37, rate: 1.0, symbol: '$' },
    INR: { id: 40, rate: 1.0, symbol: '₹' },
  };

  private static getHeaders(baseUrl: string, token?: string, isMultipart = false) {
    const headers: Record<string, string> = {
      'x-base-url': baseUrl,
    };
    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private static async handleResponse(response: Response) {
    const text = await response.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      if (!response.ok) {
        if (text.includes('Request Entity Too Large') || response.status === 413) {
          throw new Error('The attached file/image is too large for the server. Please choose a smaller image (under 3MB).');
        }
        throw new Error(`Server Error (${response.status}): ${text.substring(0, 120) || 'Invalid server response'}`);
      }
      body = text;
    }
    
    if (!response.ok) {
      let errorMessage = typeof body === 'string' 
        ? body 
        : (body?.message || body?.error || 'Request failed');
      
      if (typeof body === 'string' && body.includes('Request Entity Too Large')) {
        errorMessage = 'The attached file/image is too large for the server. Please choose a smaller image (under 3MB).';
      }

      // Decode validation details if available from php backend
      if (body && typeof body === 'object' && body.error && body.error.details) {
        const details = body.error.details;
        const validationErrors: string[] = [];
        Object.entries(details).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            validationErrors.push(`${key}: ${value.join(', ')}`);
          } else {
            validationErrors.push(`${key}: ${value}`);
          }
        });
        if (validationErrors.length > 0) {
          errorMessage += ` (${validationErrors.join(', ')})`;
        }
      }
      throw new Error(errorMessage);
    }

    if (body && typeof body === 'object' && (body.status === 'fail' || body.status === 'error')) {
      throw new Error(body.message || 'Action failed');
    }

    return body && typeof body === 'object' && body.hasOwnProperty('data') ? body.data : body;
  }

  public static getCurrencySymbolById(id: any): string {
    if (id === null || id === undefined) return '';
    const idInt = parseInt(id.toString(), 10);
    for (const meta of Object.values(this.currencyMetadata)) {
      if (meta.id === idInt) {
        return meta.symbol;
      }
    }
    return '';
  }

  public static async login(url: string, email: string, password: string): Promise<UserSession> {
    const cleanUrl = url.trim();
    const headers = this.getHeaders(cleanUrl);
    headers['x-target-path'] = '/api/v1/auth/login';

    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: cleanUrl, email, password }),
    });

    const payload = await this.handleResponse(response);
    const token = payload.token;
    const user = payload.user || {};
    const userId = (user.id || '').toString();
    const userName = user.name || 'User';
    const userEmail = user.email || '';
    const userMobile = user.mobile || '';
    const userImage = user.image_url || user.image || '';

    // Fetch company info
    let companyName = 'HRMS';
    let companyTagline = 'Workplace Workspace';
    let companyLogo = '';

    try {
      const companyHeaders = this.getHeaders(cleanUrl, token);
      companyHeaders['x-target-path'] = '/api/v1/company';
      
      const companyRes = await fetch('/api/proxy', {
        method: 'GET',
        headers: companyHeaders,
      });
      
      if (companyRes.ok) {
        const companyData = await this.handleResponse(companyRes);
        companyName = companyData.company_name || companyName;
        companyTagline = companyData.app_name || companyTagline;
        companyLogo = companyData.logo_url || companyLogo;
      }
    } catch (e) {
      console.warn('Failed to fetch company details during login:', e);
    }

    return {
      token,
      baseUrl: cleanUrl,
      userId,
      userName,
      userEmail,
      userMobile,
      userImage,
      companyName,
      companyTagline,
      companyLogo,
    };
  }

  public static async getTodayAttendance(baseUrl: string, token: string): Promise<any> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = '/api/v1/attendance/today';

    const response = await fetch('/api/proxy', {
      method: 'GET',
      headers,
    });

    return this.handleResponse(response);
  }

  public static async checkIn(
    baseUrl: string,
    token: string,
    latitude?: string,
    longitude?: string
  ): Promise<any> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = '/api/v1/attendance/clock-in';

    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        currentLatitude: latitude || null,
        currentLongitude: longitude || null,
      }),
    });

    return this.handleResponse(response);
  }

  public static async checkOut(
    baseUrl: string,
    token: string,
    attendanceId?: string,
    latitude?: string,
    longitude?: string
  ): Promise<any> {
    const headers = this.getHeaders(baseUrl, token);
    const targetPath = attendanceId 
      ? `/api/v1/attendance/clock-out/${attendanceId}` 
      : '/api/v1/attendance/clock-out';
    headers['x-target-path'] = targetPath;

    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        currentLatitude: latitude || null,
        currentLongitude: longitude || null,
      }),
    });

    return this.handleResponse(response);
  }

  public static async getAttendance(
    baseUrl: string,
    token: string,
    userId: string
  ): Promise<AttendanceRecord[]> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = `/api/v1/attendance?limit=500&filters=user_id eq ${userId}`;

    const response = await fetch('/api/proxy', {
      method: 'GET',
      headers,
    });

    return this.handleResponse(response);
  }

  public static async getHolidays(baseUrl: string, token: string): Promise<HolidayRecord[]> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = '/api/v1/holiday?limit=200';

    const response = await fetch('/api/proxy', {
      method: 'GET',
      headers,
    });

    return this.handleResponse(response);
  }

  public static async getLeaves(baseUrl: string, token: string): Promise<LeaveRecord[]> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = '/api/v1/leave?limit=200';

    const response = await fetch('/api/proxy', {
      method: 'GET',
      headers,
    });

    return this.handleResponse(response);
  }

  public static async getLeaveTypes(baseUrl: string, token: string): Promise<LeaveType[]> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = '/api/v1/leave-type?limit=200';

    const response = await fetch('/api/proxy', {
      method: 'GET',
      headers,
    });

    return this.handleResponse(response);
  }

  public static async createLeave(
    baseUrl: string,
    token: string,
    userId: string,
    leaveTypeId: number,
    leaveDate: string,
    duration: string,
    reason: string,
    endDate?: string | null,
    halfDayType?: string | null
  ): Promise<any> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = '/api/v1/leave';

    const body: Record<string, any> = {
      user: {
        id: parseInt(userId, 10) || 0,
      },
      type: {
        id: leaveTypeId,
      },
      leave_date: leaveDate,
      duration,
      reason,
      status: 'pending',
    };

    if (endDate) {
      body.end_date = endDate;
    }
    if (halfDayType) {
      body.half_day_type = halfDayType;
    }

    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    return this.handleResponse(response);
  }

  public static async getExpenses(baseUrl: string, token: string): Promise<ExpenseRecord[]> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = '/api/v1/expense?limit=100&fields=id,item_name,purchase_date,price,status,currency,custom_fields,custom_fields_data';

    const response = await fetch('/api/proxy', {
      method: 'GET',
      headers,
    });

    return this.handleResponse(response);
  }

  public static async getExpenseCategories(baseUrl: string, token: string): Promise<ExpenseCategory[]> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = '/api/v1/expense-category?limit=200';

    const response = await fetch('/api/proxy', {
      method: 'GET',
      headers, 
    });

    return this.handleResponse(response);
  }

  public static updateCurrencyMetadata(code: string, id: number, rate: number, symbol?: string) {
    const currencyCode = code.toUpperCase();
    this.currencyMetadata[currencyCode] = {
      id,
      rate,
      symbol: symbol || this.currencyMetadata[currencyCode]?.symbol || code,
    };
  }

  public static async fetchCurrencies(baseUrl: string, token: string): Promise<void> {
    try {
      const headers = this.getHeaders(baseUrl, token);
      headers['x-target-path'] = '/api/v1/currency?fields=id,currency_code,exchange_rate,currency_symbol';

      const response = await fetch('/api/proxy', {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await this.handleResponse(response);
        if (Array.isArray(data)) {
          for (const item of data) {
            const code = item.currency_code?.toString().toUpperCase();
            const id = item.id;
            const rate = parseFloat(item.exchange_rate?.toString() || '1.0') || 1.0;
            const symbol = item.currency_symbol?.toString();
            if (code && id) {
              this.updateCurrencyMetadata(code, id, rate, symbol);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch currencies from API:', e);
    }
  }

  public static async createExpense(
    baseUrl: string,
    token: string,
    userId: string,
    itemName: string,
    price: number,
    purchaseDate: string,
    purchasedFrom: string,
    category: string | null,
    currencyCode: string,
    file: File | null,
    customFieldsData?: Record<string, any>
  ): Promise<any> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = '/api/v1/expense';
    
    // Format purchase date cleanly (YYYY-MM-DD)
    let formattedDate = purchaseDate;
    if (purchaseDate) {
      const parsedDate = new Date(purchaseDate);
      if (!isNaN(parsedDate.getTime())) {
        const yyyy = parsedDate.getFullYear();
        const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(parsedDate.getDate()).padStart(2, '0');
        formattedDate = `${yyyy}-${mm}-${dd}`;
      }
    }

    const formData = new FormData();
    formData.append('item_name', itemName);
    formData.append('price', price.toString());
    formData.append('purchase_date', formattedDate);
    
    if (purchasedFrom) {
      formData.append('purchase_from', purchasedFrom);
      formData.append('purchased_from', purchasedFrom);
    } else {
      formData.append('purchase_from', '');
    }

    const currencyMeta = this.currencyMetadata[currencyCode.toUpperCase()] || {};
    const finalCurrencyId = currencyMeta.id || (currencyCode.toUpperCase() === 'USD' ? 37 : 40);
    const finalExchangeRate = currencyMeta.rate || 1.0;

    formData.append('exchange_rate', finalExchangeRate.toString());
    formData.append('currency_code', currencyCode);
    formData.append('status', 'pending');
    formData.append('description', 'Expense submitted via mobile web app');
    formData.append('user_id', userId);
    formData.append('user[id]', userId);
    formData.append('currency_id', finalCurrencyId.toString());
    formData.append('currency[id]', finalCurrencyId.toString());

    if (category) {
      formData.append('category_id', category);
    }

    if (file) {
      formData.append('bill', file, file.name);
    }

    if (customFieldsData) {
      Object.entries(customFieldsData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          const rawId = key.replace(/^field_/, '');
          if (value instanceof File) {
            // For File objects, append only once to avoid duplicating large file uploads
            formData.append(`custom_fields_data[${rawId}]`, value, value.name);
          } else {
            formData.append(`custom_fields_data[${rawId}]`, value as any);
            if (rawId !== key) {
              formData.append(`custom_fields_data[${key}]`, value as any);
            }
          }
        }
      });
    }

    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse(response);
  }

  public static async getExpenseCustomFields(baseUrl: string, token: string): Promise<any[]> {
    const headers = this.getHeaders(baseUrl, token);
    headers['x-target-path'] = '/api/v1/expense/custom-fields';

    const response = await fetch('/api/proxy', {
      method: 'GET',
      headers,
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message || 'Failed to fetch expense custom fields');
    }
    return body.status === 'success' && body.data ? body.data : [];
  }
}

export default ApiService;
