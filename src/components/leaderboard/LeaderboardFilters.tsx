import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { LeaderboardScope, LeaderboardPeriod } from '@/lib/leaderboardService';

interface FilterOption { id: string; name: string; name_ar: string; }
interface SessionOption { id: string; session_number: number; session_date: string; }

interface LeaderboardFiltersProps {
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  groupId: string;
  sessionId: string;
  levelId: string;
  ageGroupId: string;
  onScopeChange: (s: LeaderboardScope) => void;
  onPeriodChange: (p: LeaderboardPeriod) => void;
  onGroupChange: (id: string) => void;
  onSessionChange: (id: string) => void;
  onLevelChange: (id: string) => void;
  onAgeGroupChange: (id: string) => void;
}

export function LeaderboardFilters({
  scope, period, groupId, sessionId, levelId, ageGroupId,
  onScopeChange, onPeriodChange, onGroupChange, onSessionChange, onLevelChange, onAgeGroupChange,
}: LeaderboardFiltersProps) {
  const { language, t } = useLanguage();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isAr = language === 'ar';

  const [groups, setGroups] = useState<FilterOption[]>([]);
  const [levels, setLevels] = useState<FilterOption[]>([]);
  const [ageGroups, setAgeGroups] = useState<FilterOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);

  useEffect(() => {
    loadDropdowns();
  }, []);

  useEffect(() => {
    if (scope === 'session' && groupId) loadSessions(groupId);
  }, [scope, groupId]);

  // Auto-select first available value when scope changes and data is ready
  useEffect(() => {
    if (needsGroup && !groupId && groups.length > 0) {
      onGroupChange(groups[0].id);
    }
  }, [scope, groups.length]);

  useEffect(() => {
    if (needsLevel && !levelId && levels.length > 0) {
      onLevelChange(levels[0].id);
    }
  }, [scope, levels.length]);

  useEffect(() => {
    if (needsAgeGroup && !ageGroupId && ageGroups.length > 0) {
      onAgeGroupChange(ageGroups[0].id);
    }
  }, [scope, ageGroups.length]);

  const loadDropdowns = async () => {
    const [gRes, lRes, agRes] = await Promise.all([
      supabase.from('groups').select('id, name, name_ar').eq('is_active', true).order('name'),
      supabase.from('levels').select('id, name, name_ar').eq('is_active', true).order('level_order'),
      supabase.from('age_groups').select('id, name, name_ar').eq('is_active', true).order('min_age'),
    ]);
    const g = gRes.data || [];
    setGroups(g);
    setLevels(lRes.data || []);
    setAgeGroups(agRes.data || []);
    if (g.length > 0 && !groupId) onGroupChange(g[0].id);
  };

  const loadSessions = async (gId: string) => {
    const { data } = await supabase
      .from('sessions')
      .select('id, session_number, session_date')
      .eq('group_id', gId)
      .eq('status', 'completed')
      .order('session_date', { ascending: false })
      .limit(50);
    const s = data || [];
    setSessions(s);
    if (s.length > 0) onSessionChange(s[0].id);
  };

  const scopeOptions: { value: LeaderboardScope; label: string }[] = isAdmin
    ? [
        { value: 'group', label: t.evaluation.group },
        { value: 'session', label: t.evaluation.session },
        { value: 'level_age_group', label: t.evaluation.levelInAgeGroup },
        { value: 'level', label: t.evaluation.levelGlobal },
        { value: 'age_group', label: t.evaluation.ageGroupGlobal },
        { value: 'all', label: t.evaluation.allStudents },
      ]
    : [{ value: 'group' as LeaderboardScope, label: t.evaluation.group }];

  const periodOptions: { value: LeaderboardPeriod; label: string }[] = [
    { value: 'all_time', label: t.evaluation.allTime },
    { value: 'monthly', label: t.evaluation.thisMonth },
    { value: 'weekly', label: t.evaluation.thisWeek },
  ];

  const needsGroup = scope === 'group' || scope === 'session';
  const needsSession = scope === 'session';
  const needsLevel = scope === 'level' || scope === 'level_age_group';
  const needsAgeGroup = scope === 'age_group' || scope === 'level_age_group';
  const hasSubFilters = needsGroup || needsLevel || needsAgeGroup;

  const label = (o: FilterOption) => isAr ? o.name_ar : o.name;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* Row 1: Scope + Period — always visible */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {isAr ? 'النطاق' : 'Scope'}
            </label>
            <Select value={scope} onValueChange={(v) => onScopeChange(v as LeaderboardScope)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {isAr ? 'الفترة' : 'Period'}
            </label>
            <Select value={period} onValueChange={(v) => onPeriodChange(v as LeaderboardPeriod)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Sub-filters based on scope */}
        {hasSubFilters && (
          <div className="flex flex-wrap items-end gap-4">
            {needsGroup && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {isAr ? 'المجموعة' : 'Group'}
                </label>
                <Select value={groupId} onValueChange={onGroupChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t.evaluation.selectGroup} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{label(g)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsSession && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {isAr ? 'السيشن' : 'Session'}
                </label>
                <Select value={sessionId} onValueChange={onSessionChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t.evaluation.selectSession} />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        #{s.session_number} — {s.session_date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsLevel && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {isAr ? 'الليفل' : 'Level'}
                </label>
                <Select value={levelId} onValueChange={onLevelChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t.evaluation.selectLevel} />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map(l => (
                      <SelectItem key={l.id} value={l.id}>{label(l)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsAgeGroup && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {isAr ? 'الفئة العمرية' : 'Age Group'}
                </label>
                <Select value={ageGroupId} onValueChange={onAgeGroupChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t.evaluation.selectAgeGroup} />
                  </SelectTrigger>
                  <SelectContent>
                    {ageGroups.map(a => (
                      <SelectItem key={a.id} value={a.id}>{label(a)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
