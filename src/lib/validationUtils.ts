// Egyptian mobile number validation: starts with 01 and has 11 digits
const EGYPTIAN_MOBILE_REGEX = /^01[0125]\d{8}$/;

// Name validation: Arabic and English letters, spaces, hyphens
const ARABIC_NAME_REGEX = /^[\u0600-\u06FF\s\-]+$/;
const ENGLISH_NAME_REGEX = /^[a-zA-Z\s\-]+$/;

// Password requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_HAS_UPPERCASE = /[A-Z]/;
const PASSWORD_HAS_LOWERCASE = /[a-z]/;
const PASSWORD_HAS_NUMBER = /[0-9]/;
const PASSWORD_HAS_SPECIAL = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/;

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
  errorAr: string | null;
}

export interface PasswordValidationDetails {
  isValid: boolean;
  errors: string[];
  errorsAr: string[];
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

/**
 * Validate Egyptian mobile number
 * Must start with 01 (then 0, 1, 2, or 5) and have exactly 11 digits
 */
export function validateMobileNumber(mobile: string): ValidationResult {
  if (!mobile || mobile.trim() === '') {
    return { isValid: true, error: null, errorAr: null }; // Optional field
  }

  const cleaned = mobile.replace(/\s/g, '');
  
  if (cleaned.length !== 11) {
    return {
      isValid: false,
      error: 'Mobile number must be exactly 11 digits',
      errorAr: 'رقم الموبايل يجب أن يكون 11 رقم بالضبط',
    };
  }

  if (!cleaned.startsWith('01')) {
    return {
      isValid: false,
      error: 'Mobile number must start with 01',
      errorAr: 'رقم الموبايل يجب أن يبدأ بـ 01',
    };
  }

  if (!EGYPTIAN_MOBILE_REGEX.test(cleaned)) {
    return {
      isValid: false,
      error: 'Invalid Egyptian mobile number format (e.g., 010XXXXXXXX)',
      errorAr: 'صيغة رقم الموبايل غير صحيحة (مثال: 010XXXXXXXX)',
    };
  }

  return { isValid: true, error: null, errorAr: null };
}

/**
 * Validate password with detailed requirements
 */
export function validatePassword(password: string): PasswordValidationDetails {
  const hasMinLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasUppercase = PASSWORD_HAS_UPPERCASE.test(password);
  const hasLowercase = PASSWORD_HAS_LOWERCASE.test(password);
  const hasNumber = PASSWORD_HAS_NUMBER.test(password);
  const hasSpecial = PASSWORD_HAS_SPECIAL.test(password);

  const errors: string[] = [];
  const errorsAr: string[] = [];

  if (!hasMinLength) {
    errors.push(`At least ${PASSWORD_MIN_LENGTH} characters`);
    errorsAr.push(`على الأقل ${PASSWORD_MIN_LENGTH} حروف`);
  }
  if (!hasUppercase) {
    errors.push('One uppercase letter');
    errorsAr.push('حرف كبير واحد على الأقل');
  }
  if (!hasLowercase) {
    errors.push('One lowercase letter');
    errorsAr.push('حرف صغير واحد على الأقل');
  }
  if (!hasNumber) {
    errors.push('One number');
    errorsAr.push('رقم واحد على الأقل');
  }
  if (!hasSpecial) {
    errors.push('One special character (!@#$%...)');
    errorsAr.push('رمز خاص واحد على الأقل (!@#$%...)');
  }

  return {
    isValid: hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial,
    errors,
    errorsAr,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
  };
}

/**
 * Simple password validation that returns a single result
 */
export function validatePasswordSimple(password: string): ValidationResult {
  const details = validatePassword(password);
  
  if (details.isValid) {
    return { isValid: true, error: null, errorAr: null };
  }

  return {
    isValid: false,
    error: `Password must have: ${details.errors.join(', ')}`,
    errorAr: `كلمة المرور يجب أن تحتوي على: ${details.errorsAr.join('، ')}`,
  };
}

/**
 * Validate English name
 */
export function validateEnglishName(name: string): ValidationResult {
  if (!name || name.trim() === '') {
    return {
      isValid: false,
      error: 'Name is required',
      errorAr: 'الاسم مطلوب',
    };
  }

  const trimmed = name.trim();

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'Name must be at least 3 characters',
      errorAr: 'الاسم يجب أن يكون 3 حروف على الأقل',
    };
  }

  if (trimmed.length > 100) {
    return {
      isValid: false,
      error: 'Name must not exceed 100 characters',
      errorAr: 'الاسم يجب ألا يتجاوز 100 حرف',
    };
  }

  if (!ENGLISH_NAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Name must contain only English letters, spaces, and hyphens',
      errorAr: 'الاسم يجب أن يحتوي على حروف إنجليزية، مسافات، وشرطات فقط',
    };
  }

  return { isValid: true, error: null, errorAr: null };
}

/**
 * Validate Arabic name
 */
export function validateArabicName(name: string): ValidationResult {
  if (!name || name.trim() === '') {
    return { isValid: true, error: null, errorAr: null }; // Optional field
  }

  const trimmed = name.trim();

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'Arabic name must be at least 3 characters',
      errorAr: 'الاسم بالعربي يجب أن يكون 3 حروف على الأقل',
    };
  }

  if (trimmed.length > 100) {
    return {
      isValid: false,
      error: 'Arabic name must not exceed 100 characters',
      errorAr: 'الاسم بالعربي يجب ألا يتجاوز 100 حرف',
    };
  }

  if (!ARABIC_NAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Arabic name must contain only Arabic letters, spaces, and hyphens',
      errorAr: 'الاسم بالعربي يجب أن يحتوي على حروف عربية، مسافات، وشرطات فقط',
    };
  }

  return { isValid: true, error: null, errorAr: null };
}

/**
 * Validate date of birth (cannot be in the future)
 */
export function validateDateOfBirth(dateStr: string): ValidationResult {
  if (!dateStr || dateStr.trim() === '') {
    return { isValid: true, error: null, errorAr: null }; // Optional field
  }

  const selectedDate = new Date(dateStr);
  const today = new Date();
  
  // Set hours to 0 for accurate date comparison
  today.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);

  if (selectedDate > today) {
    return {
      isValid: false,
      error: 'Date of birth cannot be in the future',
      errorAr: 'تاريخ الميلاد لا يمكن أن يكون في المستقبل',
    };
  }

  // Check for reasonable age (not more than 120 years ago)
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 120);
  
  if (selectedDate < minDate) {
    return {
      isValid: false,
      error: 'Please enter a valid date of birth',
      errorAr: 'يرجى إدخال تاريخ ميلاد صحيح',
    };
  }

  return { isValid: true, error: null, errorAr: null };
}

/**
 * Validate that end time is after start time
 */
export function validateTimeRange(
  startTime: string,
  endTime: string
): ValidationResult {
  if (!startTime || !endTime) {
    return { isValid: true, error: null, errorAr: null }; // Both optional
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (end <= start) {
    return {
      isValid: false,
      error: 'End time must be after start time',
      errorAr: 'وقت النهاية يجب أن يكون بعد وقت البداية',
    };
  }

  return { isValid: true, error: null, errorAr: null };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === '') {
    return {
      isValid: false,
      error: 'Email is required',
      errorAr: 'البريد الإلكتروني مطلوب',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email.trim())) {
    return {
      isValid: false,
      error: 'Please enter a valid email address',
      errorAr: 'يرجى إدخال بريد إلكتروني صحيح',
    };
  }

  return { isValid: true, error: null, errorAr: null };
}

/**
 * Get the localized error message based on language
 */
export function getLocalizedError(
  result: ValidationResult,
  isRTL: boolean
): string | null {
  if (result.isValid) return null;
  return isRTL ? result.errorAr : result.error;
}
