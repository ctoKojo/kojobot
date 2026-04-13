import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'instructor' | 'student' | 'reception' | 'parent')[];
}

// Routes students can access even without level_id (placement flow only)
const STUDENT_ALLOWED_WITHOUT_LEVEL = ['/placement-gate', '/placement-test', '/account-suspended', '/renewal-required', '/profile'];

// Module-level cache shared across all ProtectedRoute instances
const statusCache: {
  userId: string | null;
  isSuspended: boolean;
  isTerminated: boolean;
  hasLevel: boolean;
  needsRenewal: boolean;
  fetchedAt: number;
} = { userId: null, isSuspended: false, isTerminated: false, hasLevel: true, needsRenewal: false, fetchedAt: 0 };

const CACHE_TTL_MS = 60_000; // 1 minute

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading, roleLoading } = useAuth();
  const location = useLocation();
  const [isSuspended, setIsSuspended] = useState<boolean | null>(null);
  const [isTerminated, setIsTerminated] = useState<boolean | null>(null);
  const [hasLevel, setHasLevel] = useState<boolean | null>(null);
  const [needsRenewal, setNeedsRenewal] = useState<boolean | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setIsSuspended(false);
      setIsTerminated(false);
      setHasLevel(true);
      setNeedsRenewal(false);
      return;
    }

    // Use cache if same user and within TTL
    const now = Date.now();
    if (statusCache.userId === user.id && now - statusCache.fetchedAt < CACHE_TTL_MS) {
      setIsSuspended(statusCache.isSuspended);
      setIsTerminated(statusCache.isTerminated);
      setHasLevel(statusCache.hasLevel);
      setNeedsRenewal(statusCache.needsRenewal);
      return;
    }

    // Prevent duplicate concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (role === 'instructor' || role === 'reception') {
      supabase
        .from('profiles')
        .select('employment_status')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const terminated = data?.employment_status === 'terminated';
          statusCache.userId = user.id;
          statusCache.isSuspended = false;
          statusCache.isTerminated = terminated;
          statusCache.hasLevel = true;
          statusCache.needsRenewal = false;
          statusCache.fetchedAt = Date.now();
          setIsTerminated(terminated);
          setIsSuspended(false);
          setHasLevel(true);
          setNeedsRenewal(false);
          fetchingRef.current = false;
        });
    } else if (role === 'student') {
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
          .select('level_id, needs_renewal')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]).then(([subRes, profileRes]) => {
        const suspended = subRes.data?.is_suspended ?? false;
        const level = !!profileRes.data?.level_id;
        const renewal = !!(profileRes.data as any)?.needs_renewal;
        statusCache.userId = user.id;
        statusCache.isSuspended = suspended;
        statusCache.isTerminated = false;
        statusCache.hasLevel = level;
        statusCache.needsRenewal = renewal;
        statusCache.fetchedAt = Date.now();
        setIsSuspended(suspended);
        setIsTerminated(false);
        setHasLevel(level);
        setNeedsRenewal(renewal);
        fetchingRef.current = false;
      });
    } else if (role === 'parent') {
      // Parents don't need suspension/level checks
      statusCache.userId = user.id;
      statusCache.isSuspended = false;
      statusCache.isTerminated = false;
      statusCache.hasLevel = true;
      statusCache.needsRenewal = false;
      statusCache.fetchedAt = Date.now();
      setIsSuspended(false);
      setIsTerminated(false);
      setHasLevel(true);
      setNeedsRenewal(false);
      fetchingRef.current = false;
    } else {
      statusCache.userId = user.id;
      statusCache.isSuspended = false;
      statusCache.isTerminated = false;
      statusCache.hasLevel = true;
      statusCache.needsRenewal = false;
      statusCache.fetchedAt = Date.now();
      setIsSuspended(false);
      setIsTerminated(false);
      setHasLevel(true);
      setNeedsRenewal(false);
      fetchingRef.current = false;
    }
  }, [user, role]);

  if (loading || roleLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // User is authenticated but has no role — redirect to parent registration (likely a Google OAuth user)
  if (!role) {
    if (location.pathname !== '/parent-register') {
      return <Navigate to="/parent-register" replace />;
    }
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if ((role === 'instructor' || role === 'reception') && isTerminated === true) {
    return <Navigate to="/account-terminated" replace />;
  }

  if (role === 'student' && needsRenewal === true) {
    return <Navigate to="/renewal-required" replace />;
  }

  if (role === 'student' && isSuspended === true) {
    return <Navigate to="/account-suspended" replace />;
  }

  if (role === 'student' && hasLevel === false) {
    const isAllowed = STUDENT_ALLOWED_WITHOUT_LEVEL.some(path => location.pathname.startsWith(path));
    if (!isAllowed) {
      return <Navigate to="/placement-gate" replace />;
    }
  }

  return <>{children}</>;
}
