/**
 * Error handling utilities for Supabase and general application errors
 */

interface ErrorMessages {
  [key: string]: { en: string; ar: string };
}

const supabaseErrorMap: ErrorMessages = {
  'duplicate key': {
    en: 'This item already exists',
    ar: 'هذا العنصر موجود بالفعل',
  },
  'violates foreign key': {
    en: 'Cannot delete due to related data',
    ar: 'لا يمكن الحذف لوجود بيانات مرتبطة',
  },
  'violates not-null': {
    en: 'Required field is missing',
    ar: 'حقل مطلوب مفقود',
  },
  'row-level security': {
    en: 'You do not have permission to perform this action',
    ar: 'ليس لديك صلاحية لتنفيذ هذا الإجراء',
  },
  'JWT expired': {
    en: 'Your session has expired. Please sign in again',
    ar: 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى',
  },
  'invalid login credentials': {
    en: 'Invalid email or password',
    ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  },
  'email already registered': {
    en: 'This email is already registered',
    ar: 'هذا البريد الإلكتروني مسجل بالفعل',
  },
  'user not found': {
    en: 'User not found',
    ar: 'المستخدم غير موجود',
  },
  'network': {
    en: 'Network error. Please check your connection',
    ar: 'خطأ في الاتصال. يرجى التحقق من اتصالك بالإنترنت',
  },
  'timeout': {
    en: 'Request timed out. Please try again',
    ar: 'انتهت مهلة الطلب. يرجى المحاولة مرة أخرى',
  },
};

const defaultError = {
  en: 'An unexpected error occurred',
  ar: 'حدث خطأ غير متوقع',
};

/**
 * Converts Supabase/API errors into user-friendly localized messages
 */
export function handleSupabaseError(error: any, isRTL: boolean): string {
  if (!error) {
    return isRTL ? defaultError.ar : defaultError.en;
  }

  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || error.error_description || '';

  const lowerMessage = errorMessage.toLowerCase();

  // Check for known error patterns
  for (const [key, messages] of Object.entries(supabaseErrorMap)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return isRTL ? messages.ar : messages.en;
    }
  }

  // Check for network errors
  if (error.name === 'TypeError' && lowerMessage.includes('fetch')) {
    return isRTL ? supabaseErrorMap.network.ar : supabaseErrorMap.network.en;
  }

  // Return original message if no match found (but sanitize it)
  if (errorMessage && errorMessage.length < 200) {
    // For development, return the original message
    if (process.env.NODE_ENV === 'development') {
      return errorMessage;
    }
  }

  return isRTL ? defaultError.ar : defaultError.en;
}

/**
 * Handles form validation errors
 */
export function handleValidationError(
  field: string, 
  errors: Record<string, string | null>, 
  isRTL: boolean
): string | null {
  const error = errors[field];
  if (!error) return null;
  return error;
}

/**
 * Creates a toast-friendly error object
 */
export function createErrorToast(error: any, isRTL: boolean) {
  return {
    variant: 'destructive' as const,
    title: isRTL ? 'خطأ' : 'Error',
    description: handleSupabaseError(error, isRTL),
  };
}

/**
 * Logs errors for debugging in development
 */
export function logError(context: string, error: any) {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  }
  // In production, this could send to an error tracking service
}
