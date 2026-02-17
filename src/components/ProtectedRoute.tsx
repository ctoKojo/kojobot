import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'instructor' | 'student' | 'reception')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const [isSuspended, setIsSuspended] = useState<boolean | null>(null);
  const [isTerminated, setIsTerminated] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsSuspended(false);
      setIsTerminated(false);
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
    } else if (role === 'student') {
      supabase
        .from('subscriptions')
        .select('is_suspended')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          setIsSuspended(data?.is_suspended ?? false);
        });
      setIsTerminated(false);
    } else {
      setIsSuspended(false);
      setIsTerminated(false);
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

  return <>{children}</>;
}
