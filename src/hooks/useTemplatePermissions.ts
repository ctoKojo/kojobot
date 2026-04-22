import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  permissionsForRole,
  type TemplatePermissions,
} from '@/lib/templatePermissions';

/**
 * Resolves the current user's role and returns the matching template permissions.
 * Uses the user_roles table (single source of truth) to avoid client-side spoofing.
 */
export function useTemplatePermissions(): {
  permissions: TemplatePermissions;
  loading: boolean;
} {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        if (!cancelled) {
          setRole(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (cancelled) return;

      // pick highest privilege if user has multiple roles
      const roles = (data ?? []).map((r: any) => r.role as string);
      const best = roles.includes('admin')
        ? 'admin'
        : roles.includes('reception')
          ? 'reception'
          : roles[0] ?? null;
      setRole(best);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    permissions: permissionsForRole(role),
    loading,
  };
}
