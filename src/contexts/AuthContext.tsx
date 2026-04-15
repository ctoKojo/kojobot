import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logLogin, logLogout } from '@/lib/activityLogger';
import { resetStatusCache } from '@/components/ProtectedRoute';

type AppRole = 'admin' | 'instructor' | 'student' | 'reception' | 'parent';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  roleLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const authRequestRef = useRef(0);

  const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data?.role as AppRole | null;
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const applyAuthState = async (currentSession: Session | null) => {
      if (!isMounted) return;

      const requestId = ++authRequestRef.current;
      const nextUser = currentSession?.user ?? null;

      setSession(currentSession);
      setUser(nextUser);

      if (!nextUser) {
        setRole(null);
        setRoleLoading(false);
        setLoading(false);
        return;
      }

      setRoleLoading(true);
      const fetchedRole = await fetchUserRole(nextUser.id);

      if (!isMounted || authRequestRef.current !== requestId) return;

      setRole(fetchedRole);
      setRoleLoading(false);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        void applyAuthState(currentSession);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      setTimeout(() => logLogin(), 100);
    }
    return { error };
  };

  const signOut = async () => {
    await logLogout();
    await supabase.auth.signOut();
    resetStatusCache();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const value: AuthContextType = {
    user,
    session,
    role,
    loading,
    roleLoading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
