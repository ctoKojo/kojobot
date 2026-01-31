import { supabase } from '@/integrations/supabase/client';

export type ActionType = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'assign' | 'submit';
export type EntityType = 'user' | 'student' | 'instructor' | 'group' | 'session' | 'quiz' | 'assignment' | 'attendance' | 'subscription' | 'age_group' | 'level' | 'notification';

interface LogActivityParams {
  action: ActionType;
  entityType: EntityType;
  entityId?: string | null;
  details?: Record<string, any> | null;
}

export async function logActivity({ action, entityType, entityId, details }: LogActivityParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Cannot log activity: No authenticated user');
      return;
    }

    const { error } = await supabase.from('activity_logs').insert({
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details: details || null,
    });

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Convenience functions for common actions
export const logCreate = (entityType: EntityType, entityId?: string, details?: Record<string, any>) =>
  logActivity({ action: 'create', entityType, entityId, details });

export const logUpdate = (entityType: EntityType, entityId?: string, details?: Record<string, any>) =>
  logActivity({ action: 'update', entityType, entityId, details });

export const logDelete = (entityType: EntityType, entityId?: string, details?: Record<string, any>) =>
  logActivity({ action: 'delete', entityType, entityId, details });

export const logView = (entityType: EntityType, entityId?: string) =>
  logActivity({ action: 'view', entityType, entityId });

export const logAssign = (entityType: EntityType, entityId?: string, details?: Record<string, any>) =>
  logActivity({ action: 'assign', entityType, entityId, details });

export const logSubmit = (entityType: EntityType, entityId?: string, details?: Record<string, any>) =>
  logActivity({ action: 'submit', entityType, entityId, details });

export const logLogin = () =>
  logActivity({ action: 'login', entityType: 'user' });

export const logLogout = () =>
  logActivity({ action: 'logout', entityType: 'user' });
