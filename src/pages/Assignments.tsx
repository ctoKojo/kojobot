import { useState, useEffect, useMemo } from 'react';
import { formatDateTime } from '@/lib/timeUtils';
import { useNavigate } from 'react-router-dom';
import { Search, MoreHorizontal, Trash2, ClipboardList, Eye, FileText, Image, Video, CheckCircle, Filter } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Assignment {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  group_id: string | null;
  student_id: string | null;
  assigned_by: string;
  due_date: string;
  max_score: number | null;
  attachment_url: string | null;
  attachment_type: string | null;
  is_active: boolean | null;
  created_at: string;
  session_id: string | null;
  sessions?: { session_number: number | null; group_id: string | null } | null;
}

interface Group {
  id: string;
  name: string;
  name_ar: string;
}

export default function AssignmentsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<Map<string, { status: string; score: number | null }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assignmentsRes, groupsRes] = await Promise.all([
        supabase.from('assignments').select('*, sessions(session_number, group_id)').eq('is_auto_generated', false).order('due_date', { ascending: false }),
        supabase.from('groups').select('id, name, name_ar, status').eq('is_active', true).neq('status', 'frozen'),
      ]);

      setAssignments(assignmentsRes.data || []);
      setGroups(groupsRes.data || []);

      if (role === 'student' && user) {
        const { data: submissionsData } = await supabase
          .from('assignment_submissions')
          .select('assignment_id, status, score')
          .eq('student_id', user.id);

        if (submissionsData) {
          const submissionsMap = new Map<string, { status: string; score: number | null }>();
          submissionsData.forEach(sub => {
            submissionsMap.set(sub.assignment_id, { status: sub.status, score: sub.score });
          });
          setStudentSubmissions(submissionsMap);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionStatus = (assignmentId: string) => {
    return studentSubmissions.get(assignmentId);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: t.common.success,
        description: isRTL ? 'تم حذف الاساينمنت' : 'Assignment deleted successfully',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حذف الاساينمنت' : 'Failed to delete assignment',
      });
    }
  };

  // Resolve effective group_id for each assignment
  const getEffectiveGroupId = (a: Assignment): string | null => {
    return a.group_id || a.sessions?.group_id || null;
  };

  const getSessionNumber = (a: Assignment): number | null => {
    return a.sessions?.session_number ?? null;
  };

  // Filter by search + group
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.title_ar.includes(searchQuery);
      const effectiveGroupId = getEffectiveGroupId(a);
      const matchesGroup = selectedGroupId === 'all' || effectiveGroupId === selectedGroupId || (selectedGroupId === 'none' && !effectiveGroupId);
      return matchesSearch && matchesGroup;
    });
  }, [assignments, searchQuery, selectedGroupId]);

  // Group assignments by group_id
  const groupedAssignments = useMemo(() => {
    const grouped = new Map<string, Assignment[]>();
    filteredAssignments.forEach(a => {
      const gid = getEffectiveGroupId(a) || '__none__';
      if (!grouped.has(gid)) grouped.set(gid, []);
      grouped.get(gid)!.push(a);
    });
    return grouped;
  }, [filteredAssignments]);

  const getGroupName = (id: string | null) => {
    if (!id || id === '__none__') return isRTL ? 'بدون مجموعة' : 'No Group';
    const group = groups.find((g) => g.id === id);
    return group ? (language === 'ar' ? group.name_ar : group.name) : '-';
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  // Available groups for filter (only groups that have assignments)
  const availableGroupIds = useMemo(() => {
    const ids = new Set<string>();
    let hasNoGroup = false;
    assignments.forEach(a => {
      const gid = getEffectiveGroupId(a);
      if (gid) ids.add(gid);
      else hasNoGroup = true;
    });
    return { ids: Array.from(ids), hasNoGroup };
  }, [assignments]);

  const renderAssignmentActions = (assignment: Assignment) => {
    if (role === 'student') {
      const submissionStatus = getSubmissionStatus(assignment.id);
      if (submissionStatus) {
        if (submissionStatus.status === 'revision_requested') {
          return (
            <Button size="sm" variant="outline" className="border-orange-500 text-orange-600" onClick={(e) => { e.stopPropagation(); navigate(`/assignment/${assignment.id}`); }}>
              {isRTL ? 'إعادة التسليم' : 'Resubmit'}
            </Button>
          );
        }
        return (
          <Badge variant="outline" className={`cursor-pointer hover:opacity-80 ${submissionStatus.status === 'graded' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
            onClick={(e) => { e.stopPropagation(); navigate(`/assignment/${assignment.id}`); }}>
            <CheckCircle className="w-3 h-3 mr-1" />
            {submissionStatus.status === 'graded' ? (isRTL ? `مقيّم: ${submissionStatus.score}` : `Graded: ${submissionStatus.score}`) : (isRTL ? 'تم التسليم' : 'Submitted')}
          </Badge>
        );
      }
      return (
        <Button size="sm" className="kojo-gradient" onClick={(e) => { e.stopPropagation(); navigate(`/assignment/${assignment.id}`); }}>
          {isRTL ? 'تسليم' : 'Submit'}
        </Button>
      );
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/assignment-submissions/${assignment.id}`); }}>
            <Eye className="h-4 w-4 mr-2" />{isRTL ? 'عرض التسليمات' : 'View Submissions'}
          </DropdownMenuItem>
          {role === 'admin' && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(assignment.id); }} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />{t.common.delete}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <DashboardLayout title={t.assignments.title}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t.common.search} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-full sm:w-60">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={isRTL ? 'فلتر المجموعة' : 'Filter by Group'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل المجموعات' : 'All Groups'}</SelectItem>
              {availableGroupIds.ids.map(gid => (
                <SelectItem key={gid} value={gid}>{getGroupName(gid)}</SelectItem>
              ))}
              {availableGroupIds.hasNoGroup && (
                <SelectItem value="none">{isRTL ? 'بدون مجموعة' : 'No Group'}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">{t.common.loading}</CardContent></Card>
        ) : filteredAssignments.length === 0 ? (
          <Card><CardContent className="py-8 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{isRTL ? 'لا توجد اساينمنتات' : 'No assignments found'}</p>
          </CardContent></Card>
        ) : (
          Array.from(groupedAssignments.entries()).map(([groupId, groupAssignments]) => (
            <Card key={groupId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  {getGroupName(groupId === '__none__' ? null : groupId)}
                  <Badge variant="secondary" className="text-xs">{groupAssignments.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile Cards */}
                <div className="block md:hidden space-y-3 p-4 pt-0">
                  {groupAssignments.map((assignment) => (
                    <div key={assignment.id} className="p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/assignment-submissions/${assignment.id}`)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{language === 'ar' ? assignment.title_ar : assignment.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            {getSessionNumber(assignment) && (
                              <Badge variant="outline" className="text-xs">
                                {isRTL ? `سيشن ${getSessionNumber(assignment)}` : `Session ${getSessionNumber(assignment)}`}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {renderAssignmentActions(assignment)}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">{formatDateTime(assignment.due_date, language)}</p>
                        {isOverdue(assignment.due_date) ? (
                          <Badge variant="destructive" className="text-xs">{isRTL ? 'منتهي' : 'Overdue'}</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">{isRTL ? 'نشط' : 'Active'}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.assignments.assignmentName}</TableHead>
                      <TableHead>{isRTL ? 'رقم السيشن' : 'Session #'}</TableHead>
                      <TableHead>{t.assignments.dueDate}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead className="w-[100px]">{t.common.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">{language === 'ar' ? assignment.title_ar : assignment.title}</TableCell>
                        <TableCell>
                          {getSessionNumber(assignment) ? (
                            <Badge variant="outline" className="text-xs">{getSessionNumber(assignment)}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{formatDateTime(assignment.due_date, language)}</TableCell>
                        <TableCell>
                          {isOverdue(assignment.due_date) ? (
                            <Badge variant="destructive">{isRTL ? 'منتهي' : 'Overdue'}</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-100 text-green-800">{isRTL ? 'نشط' : 'Active'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{renderAssignmentActions(assignment)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
