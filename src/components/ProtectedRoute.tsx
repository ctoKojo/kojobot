import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'instructor' | 'student' | 'reception')[];
}

// Routes students can access even without level_id (placement flow only)
const STUDENT_ALLOWED_WITHOUT_LEVEL = ['/placement-gate', '/placement-test', '/account-suspended', '/profile'];

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [isSuspended, setIsSuspended] = useState<boolean | null>(null);
  const [isTerminated, setIsTerminated] = useState<boolean | null>(null);
  const [hasLevel, setHasLevel] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsSuspended(false);
      setIsTerminated(false);
      setHasLevel(true);
      return;
    }

    // Check termination for employees (instructor/reception)
    if (role === 'instructor' || role === 'reception') {
      supabase
        .from('profiles')
        .select('employment_status')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setIsTerminated(data?.employment_status === 'terminated');
        });
      setIsSuspended(false);
      setHasLevel(true);
    } else if (role === 'student') {
      // Check suspension + level_id
      Promise.all([
        supabase
          .from('subscriptions')
          .select('is_suspended')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('level_id')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]).then(([subRes, profileRes]) => {
        setIsSuspended(subRes.data?.is_suspended ?? false);
        setHasLevel(!!profileRes.data?.level_id);
      });
      setIsTerminated(false);
    } else {
      setIsSuspended(false);
      setIsTerminated(false);
      setHasLevel(true);
    }
  }, [user, role]);

  if (loading && !user) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check termination for employees
  if ((role === 'instructor' || role === 'reception') && isTerminated === true) {
    return <Navigate to="/account-terminated" replace />;
  }

  // Check suspension for students
  if (role === 'student' && isSuspended === true) {
    return <Navigate to="/account-suspended" replace />;
  }

  // Enforce level_id for students — block ALL routes except placement flow
  if (role === 'student' && hasLevel === false) {
    const isAllowed = STUDENT_ALLOWED_WITHOUT_LEVEL.some(path => location.pathname.startsWith(path));
    if (!isAllowed) {
      return <Navigate to="/placement-gate" replace />;
    }
  }

  return <>{children}</>;
}
