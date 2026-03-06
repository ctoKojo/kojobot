import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Star } from 'lucide-react';
import { LeaderboardFilters } from '@/components/leaderboard/LeaderboardFilters';
import { LeaderboardPodium } from '@/components/leaderboard/LeaderboardPodium';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { getLeaderboard, type LeaderboardScope, type LeaderboardPeriod, type LeaderboardEntry } from '@/lib/leaderboardService';

const PAGE_SIZE = 20;

export default function Leaderboard() {
  const { t } = useLanguage();
  const [scope, setScope] = useState<LeaderboardScope>('group');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time');
  const [groupId, setGroupId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');

  const handleScopeChange = useCallback((newScope: LeaderboardScope) => {
    setScope(newScope);
    const needsGroup = newScope === 'group' || newScope === 'session';
    const needsSession = newScope === 'session';
    const needsLevel = newScope === 'level' || newScope === 'level_age_group';
    const needsAgeGroup = newScope === 'age_group' || newScope === 'level_age_group';

    if (!needsGroup) { setGroupId(''); setSessionId(''); }
    else if (!needsSession) { setSessionId(''); }
    if (!needsLevel) { setLevelId(''); }
    if (!needsAgeGroup) { setAgeGroupId(''); }
  }, []);

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const canFetch = useCallback(() => {
    if (scope === 'group' && !groupId) return false;
    if (scope === 'session' && (!groupId || !sessionId)) return false;
    if (scope === 'level' && !levelId) return false;
    if (scope === 'age_group' && !ageGroupId) return false;
    if (scope === 'level_age_group' && (!levelId || !ageGroupId)) return false;
    return true;
  }, [scope, groupId, sessionId, levelId, ageGroupId]);

  const fetchData = useCallback(async () => {
    if (!canFetch()) return;
    setLoading(true);
    const data = await getLeaderboard({
      scope, period, groupId: groupId || undefined, sessionId: sessionId || undefined,
      levelId: levelId || undefined, ageGroupId: ageGroupId || undefined,
      limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE,
    });
    setEntries(data);
    setTotalCount(data.length > 0 ? Number(data[0].total_count) : 0);
    setLoading(false);
  }, [scope, period, groupId, sessionId, levelId, ageGroupId, page, canFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [scope, period, groupId, sessionId, levelId, ageGroupId]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <DashboardLayout title={t.evaluation.leaderboard}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg shadow-amber-500/20">
            <Star className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{t.evaluation.leaderboard}</h1>
          </div>
        </div>

        <LeaderboardFilters
          scope={scope} period={period}
          groupId={groupId} sessionId={sessionId}
          levelId={levelId} ageGroupId={ageGroupId}
          onScopeChange={handleScopeChange} onPeriodChange={setPeriod}
          onGroupChange={setGroupId} onSessionChange={setSessionId}
          onLevelChange={setLevelId} onAgeGroupChange={setAgeGroupId}
        />

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <Star className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">{t.evaluation.noEvaluations}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <LeaderboardPodium entries={entries} />
            <Card>
              <CardContent className="pt-6">
                <LeaderboardTable entries={entries} scope={scope} />
                <DataTablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={PAGE_SIZE}
                  totalCount={totalCount}
                  hasNextPage={page < totalPages}
                  hasPreviousPage={page > 1}
                  onPageChange={setPage}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
