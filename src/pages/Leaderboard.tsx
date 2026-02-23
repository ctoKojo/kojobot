import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, Star, TrendingUp, Loader2 } from 'lucide-react';

interface LeaderboardEntry {
  student_id: string;
  student_name: string;
  student_name_ar: string;
  total_score: number;
  max_total_score: number;
  percentage: number;
  rank: number;
}

interface GroupOption {
  id: string;
  name: string;
  name_ar: string;
  age_group_id: string | null;
}

export default function Leaderboard() {
  const { language, isRTL, t } = useLanguage();
  const { role } = useAuth();
  const [tab, setTab] = useState('last_session');
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) loadLeaderboard();
  }, [selectedGroup, tab]);

  const loadGroups = async () => {
    const { data } = await supabase
      .from('groups')
      .select('id, name, name_ar, age_group_id')
      .eq('is_active', true)
      .order('name');
    
    if (data && data.length > 0) {
      setGroups(data);
      setSelectedGroup(data[0].id);
    }
    setLoading(false);
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('session_evaluations')
        .select(`
          student_id,
          total_score,
          max_total_score,
          percentage,
          created_at,
          sessions!inner(id, group_id, session_date)
        `)
        .eq('sessions.group_id', selectedGroup);

      if (tab === 'last_session') {
        // Get last session's evaluations
        const { data: lastSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('group_id', selectedGroup)
          .eq('status', 'completed')
          .order('session_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastSession) {
          const { data } = await supabase
            .from('session_evaluations')
            .select('student_id, total_score, max_total_score, percentage')
            .eq('session_id', lastSession.id)
            .order('percentage', { ascending: false });

          await buildEntries(data || []);
        } else {
          setEntries([]);
        }
      } else if (tab === 'monthly') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

        const { data } = await supabase
          .from('session_evaluations')
          .select('student_id, total_score, max_total_score, percentage, sessions!inner(group_id)')
          .eq('sessions.group_id', selectedGroup)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth);

        if (data) {
          // Group by student, average percentage
          const grouped: Record<string, { total: number; count: number; sumScore: number; sumMax: number }> = {};
          data.forEach(d => {
            if (!grouped[d.student_id]) grouped[d.student_id] = { total: 0, count: 0, sumScore: 0, sumMax: 0 };
            grouped[d.student_id].total += Number(d.percentage || 0);
            grouped[d.student_id].count += 1;
            grouped[d.student_id].sumScore += Number(d.total_score || 0);
            grouped[d.student_id].sumMax += Number(d.max_total_score || 0);
          });

          const avgEntries = Object.entries(grouped).map(([id, g]) => ({
            student_id: id,
            total_score: g.sumScore,
            max_total_score: g.sumMax,
            percentage: Math.round(g.total / g.count),
          }));
          avgEntries.sort((a, b) => b.percentage - a.percentage);
          await buildEntries(avgEntries);
        } else {
          setEntries([]);
        }
      } else {
        // By level - all evaluations in this group
        const { data } = await supabase
          .from('session_evaluations')
          .select('student_id, total_score, max_total_score, percentage, sessions!inner(group_id)')
          .eq('sessions.group_id', selectedGroup);

        if (data) {
          const grouped: Record<string, { total: number; count: number; sumScore: number; sumMax: number }> = {};
          data.forEach(d => {
            if (!grouped[d.student_id]) grouped[d.student_id] = { total: 0, count: 0, sumScore: 0, sumMax: 0 };
            grouped[d.student_id].total += Number(d.percentage || 0);
            grouped[d.student_id].count += 1;
            grouped[d.student_id].sumScore += Number(d.total_score || 0);
            grouped[d.student_id].sumMax += Number(d.max_total_score || 0);
          });

          const avgEntries = Object.entries(grouped).map(([id, g]) => ({
            student_id: id,
            total_score: g.sumScore,
            max_total_score: g.sumMax,
            percentage: Math.round(g.total / g.count),
          }));
          avgEntries.sort((a, b) => b.percentage - a.percentage);
          await buildEntries(avgEntries);
        } else {
          setEntries([]);
        }
      }
    } catch (err) {
      console.error('Leaderboard error:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const buildEntries = async (data: Array<{ student_id: string; total_score: number; max_total_score: number; percentage: number }>) => {
    if (data.length === 0) { setEntries([]); return; }

    const ids = [...new Set(data.map(d => d.student_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, full_name_ar')
      .in('user_id', ids);

    const result: LeaderboardEntry[] = data.map((d, idx) => {
      const profile = profiles?.find(p => p.user_id === d.student_id);
      return {
        student_id: d.student_id,
        student_name: profile?.full_name || 'Unknown',
        student_name_ar: profile?.full_name_ar || profile?.full_name || 'غير معروف',
        total_score: d.total_score,
        max_total_score: d.max_total_score,
        percentage: d.percentage,
        rank: idx + 1,
      };
    });
    setEntries(result);
  };

  const getGrade = (pct: number) => {
    if (pct >= 90) return { label: 'A', color: 'bg-primary text-primary-foreground' };
    if (pct >= 80) return { label: 'B', color: 'bg-secondary text-secondary-foreground' };
    if (pct >= 70) return { label: 'C', color: 'bg-muted text-muted-foreground' };
    return { label: 'D', color: 'bg-destructive text-destructive-foreground' };
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-primary" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-secondary" />;
    return <span className="text-sm font-medium text-muted-foreground">{rank}</span>;
  };

  return (
    <DashboardLayout title={t.evaluation.leaderboard}>
      <div className="space-y-6">
        {/* Group Filter */}
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder={isRTL ? 'اختر المجموعة' : 'Select Group'} />
              </SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    {language === 'ar' ? g.name_ar : g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="last_session">{t.evaluation.lastSession}</TabsTrigger>
            <TabsTrigger value="monthly">{t.evaluation.monthly}</TabsTrigger>
            <TabsTrigger value="by_level">{t.evaluation.byLevel}</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
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
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px] text-center">{t.evaluation.rank}</TableHead>
                        <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                        <TableHead className="text-center">{t.evaluation.points}</TableHead>
                        <TableHead className="text-center">%</TableHead>
                        <TableHead className="text-center">{t.evaluation.gap}</TableHead>
                        <TableHead className="text-center">{t.evaluation.grade}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry, idx) => {
                        const grade = getGrade(entry.percentage);
                        const gap = idx > 0 ? entry.percentage - entries[idx - 1].percentage : 0;
                        return (
                          <TableRow key={entry.student_id} className={idx < 3 ? 'bg-muted/30' : ''}>
                            <TableCell className="text-center">
                              <div className="flex justify-center">{getRankIcon(entry.rank)}</div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {language === 'ar' ? entry.student_name_ar : entry.student_name}
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {entry.total_score}/{entry.max_total_score}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{entry.percentage}%</Badge>
                            </TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {gap !== 0 ? gap : '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={grade.color}>{grade.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
