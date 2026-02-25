import { supabase } from '@/integrations/supabase/client';

export type LeaderboardScope = 'session' | 'group' | 'level_age_group' | 'level' | 'age_group' | 'all';
export type LeaderboardPeriod = 'all_time' | 'monthly' | 'weekly';

export interface LeaderboardFilter {
  scope: LeaderboardScope;
  sessionId?: string;
  groupId?: string;
  levelId?: string;
  ageGroupId?: string;
  period: LeaderboardPeriod;
  limit?: number;
  offset?: number;
}

export interface LeaderboardEntry {
  student_id: string;
  student_name: string;
  student_name_ar: string;
  avatar_url: string | null;
  sum_total_score: number;
  sum_max_total_score: number;
  percentage: number;
  rank: number;
  sessions_count: number;
  group_name: string | null;
  group_name_ar: string | null;
  level_name: string | null;
  level_name_ar: string | null;
  total_count: number;
}

export async function getLeaderboard(filter: LeaderboardFilter): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_scope: filter.scope,
    p_session_id: filter.sessionId ?? null,
    p_group_id: filter.groupId ?? null,
    p_level_id: filter.levelId ?? null,
    p_age_group_id: filter.ageGroupId ?? null,
    p_period: filter.period,
    p_limit: filter.limit ?? 50,
    p_offset: filter.offset ?? 0,
  } as any);

  if (error) {
    console.error('Leaderboard RPC error:', error);
    return [];
  }

  return (data as any[]) || [];
}
