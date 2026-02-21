/**
 * Convert 24-hour time format to 12-hour format with AM/PM
 * @param time24 - Time in 24-hour format (HH:MM or HH:MM:SS)
 * @param isRTL - Whether to use Arabic labels
 * @returns Formatted time string in 12-hour format
 */
export function formatTime12Hour(time24: string, isRTL: boolean = false): string {
  if (!time24) return '';
  
  // Handle both HH:MM and HH:MM:SS formats
  const [hoursStr, minutesStr] = time24.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr;
  
  if (isNaN(hours)) return time24;
  
  const ampm = hours >= 12 
    ? (isRTL ? 'م' : 'PM') 
    : (isRTL ? 'ص' : 'AM');
  
  hours = hours % 12;
  hours = hours ? hours : 12; // Handle midnight (0 hours)
  
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Format a date string to localized date (short format)
 * @param date - Date string or ISO date string
 * @param language - 'ar' or 'en'
 * @returns Formatted date string (e.g. "Jan 15, 2025" or "١٥ يناير ٢٠٢٥")
 */
export function formatDate(date: string, language: string = 'en', timezone?: string): string {
  if (!date) return '-';
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  };
  return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', options);
}

/**
 * Format a date string to localized date with time
 * @param date - Date string or ISO date string
 * @param language - 'ar' or 'en'
 * @returns Formatted date+time string (e.g. "Jan 15, 2025, 02:30 PM")
 */
export function formatDateTime(date: string, language: string = 'en', timezone?: string): string {
  if (!date) return '-';
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  };
  return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', options);
}

/**
 * Format a date string to localized time in 12-hour format
 * @param dateString - ISO date string
 * @param isRTL - Whether to use Arabic format
 * @returns Formatted time string
 */
export function formatDateTime12Hour(dateString: string, isRTL: boolean = false): string {
  const date = new Date(dateString);
  
  return date.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
