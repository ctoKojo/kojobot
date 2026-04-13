import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logLogin, logLogout } from '@/lib/activityLogger';

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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const fetchUserRole = async (userId: string) => {
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setRoleLoading(true);
          fetchUserRole(session.user.id).then((fetchedRole) => {
            setRole(fetchedRole);
            setRoleLoading(false);
            if (!initialLoadComplete) {
              setLoading(false);
              setInitialLoadComplete(true);
            }
          }).catch(() => {
            setRole(null);
            setRoleLoading(false);
            if (!initialLoadComplete) {
              setLoading(false);
              setInitialLoadComplete(true);
            }
          });
        } else {
          setRole(null);
          setRoleLoading(false);
          if (!initialLoadComplete) {
            setLoading(false);
            setInitialLoadComplete(true);
          }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setRoleLoading(true);
        fetchUserRole(session.user.id).then((fetchedRole) => {
          setRole(fetchedRole);
          setRoleLoading(false);
          setLoading(false);
          setInitialLoadComplete(true);
        }).catch(() => {
          setRole(null);
          setRoleLoading(false);
          setLoading(false);
          setInitialLoadComplete(true);
        });
      } else {
        setRoleLoading(false);
        setLoading(false);
        setInitialLoadComplete(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error) {
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
