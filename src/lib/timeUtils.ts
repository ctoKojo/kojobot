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
