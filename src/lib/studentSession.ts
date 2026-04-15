const STUDENT_SESSION_KEY = 'kojobot.student-session';
const PENDING_STUDENT_LOGIN_KEY = 'kojobot.pending-student-login';

const isBrowser = () => typeof window !== 'undefined';

export const markPendingStudentLogin = () => {
  if (!isBrowser()) return;
  sessionStorage.setItem(PENDING_STUDENT_LOGIN_KEY, '1');
};

export const hasPendingStudentLogin = () => {
  if (!isBrowser()) return false;
  return sessionStorage.getItem(PENDING_STUDENT_LOGIN_KEY) === '1';
};

export const clearPendingStudentLogin = () => {
  if (!isBrowser()) return;
  sessionStorage.removeItem(PENDING_STUDENT_LOGIN_KEY);
};

export const markStudentSession = (userId: string) => {
  if (!isBrowser()) return;
  sessionStorage.setItem(STUDENT_SESSION_KEY, userId);
};

export const hasActiveStudentSession = (userId: string) => {
  if (!isBrowser()) return false;
  return sessionStorage.getItem(STUDENT_SESSION_KEY) === userId;
};

export const clearStudentSessionState = () => {
  if (!isBrowser()) return;
  sessionStorage.removeItem(STUDENT_SESSION_KEY);
  sessionStorage.removeItem(PENDING_STUDENT_LOGIN_KEY);
};