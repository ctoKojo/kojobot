import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logLogin, logLogout } from '@/lib/activityLogger';

type AppRole = 'admin' | 'instructor' | 'student' | 'reception';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
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

  const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return (data?.role as AppRole) ?? null;
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      return null;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (!initialSession?.user) {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadRole = async () => {
      if (!user?.id) {
        if (isMounted) {
          setRole(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const fetchedRole = await fetchUserRole(user.id);

      if (!isMounted) return;
      setRole(fetchedRole);
      setLoading(false);
    };

    loadRole();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.session?.user) {
      setSession(data.session);
      setUser(data.session.user);

      // Log successful login
      setTimeout(() => logLogin(), 100);
    }

    return { error };
  };

  const signOut = async () => {
    await logLogout();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setLoading(false);
  };

  const value: AuthContextType = {
    user,
    session,
    role,
    loading,
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
