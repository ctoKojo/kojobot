/**
 * profileService.ts — Centralized Profile Access Layer
 * 
 * RULE: All profile operations MUST go through this service.
 * NEVER use `profiles.id` in any query — always use `user_id`.
 * NEVER query `profiles` table directly from components — use this service.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ProfileData {
  id: string;
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  specialization: string | null;
  specialization_ar: string | null;
  is_paid_trainee: boolean | null;
  hourly_rate: number | null;
  employment_status: string | null;
  level_id: string | null;
  needs_renewal: boolean | null;
  is_approved: boolean | null;
}

/**
 * Fetch a profile by auth user_id (the ONLY correct identifier).
 */
export async function getProfileByUserId(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return { data: data as ProfileData | null, error };
}

/**
 * Update a profile by auth user_id.
 * NEVER use profiles.id for updates.
 */
export async function updateProfileByUserId(
  userId: string,
  updates: Partial<Omit<ProfileData, 'id' | 'user_id'>>
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates as any)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  return { data: data as ProfileData | null, error };
}

/**
 * Fetch multiple profiles by user_ids.
 */
export async function getProfilesByUserIds(userIds: string[]) {
  if (userIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('user_id', userIds);

  return { data: (data || []) as ProfileData[], error };
}

/**
 * Fetch profile with role from the identity view.
 */
export async function getUserIdentity(userId: string) {
  const { data, error } = await supabase
    .from('vw_user_identity' as any)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return { data, error };
}
