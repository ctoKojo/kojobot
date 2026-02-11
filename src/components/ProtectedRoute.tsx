import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'instructor' | 'student')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const [isSuspended, setIsSuspended] = useState<boolean | null>(null);

  useEffect(() => {
    if (user && role === 'student') {
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
    } else {
      setIsSuspended(false);
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

  // Check suspension for students
  if (role === 'student' && isSuspended === true) {
    return <Navigate to="/account-suspended" replace />;
  }

  return <>{children}</>;
}
