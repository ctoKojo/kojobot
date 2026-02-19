import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MoreHorizontal, Trash2, ClipboardList, Eye, FileText, Image, Video, CheckCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assignmentsRes, groupsRes] = await Promise.all([
        supabase.from('assignments').select('*').order('created_at', { ascending: false }),
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

  const getFileIcon = (type: string | null) => {
    if (!type) return <FileText className="w-6 h-6" />;
    if (type.startsWith('image')) return <Image className="w-6 h-6" />;
    if (type.startsWith('video')) return <Video className="w-6 h-6" />;
    return <FileText className="w-6 h-6" />;
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

  const filteredAssignments = assignments.filter((assignment) =>
    assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    assignment.title_ar.includes(searchQuery)
  );

  const getGroupName = (id: string | null) => {
    if (!id) return isRTL ? 'الكل' : 'All';
    const group = groups.find((g) => g.id === id);
    return group ? (language === 'ar' ? group.name_ar : group.name) : '-';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <DashboardLayout title={t.assignments.title}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t.common.loading}
              </CardContent>
            </Card>
          ) : filteredAssignments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {isRTL ? 'لا توجد اساينمنتات' : 'No assignments found'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAssignments.map((assignment) => (
              <Card 
                key={assignment.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/assignment-submissions/${assignment.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {language === 'ar' ? assignment.title_ar : assignment.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getGroupName(assignment.group_id)}
                      </p>
                    </div>
                    {role === 'student' ? (
                      (() => {
                        const submissionStatus = getSubmissionStatus(assignment.id);
                        if (submissionStatus) {
                          if (submissionStatus.status === 'revision_requested') {
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-orange-500 text-orange-600 flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); navigate(`/assignment/${assignment.id}`); }}
                              >
                                {isRTL ? 'إعادة التسليم' : 'Resubmit'}
                              </Button>
                            );
                          }
                          return (
                            <Badge 
                              variant="outline" 
                              className={`cursor-pointer hover:opacity-80 flex-shrink-0 ${
                                submissionStatus.status === 'graded' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                              onClick={(e) => { e.stopPropagation(); navigate(`/assignment/${assignment.id}`); }}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {submissionStatus.status === 'graded' 
                                ? (isRTL ? `مقيّم: ${submissionStatus.score}` : `Graded: ${submissionStatus.score}`)
                                : (isRTL ? 'تم التسليم' : 'Submitted')
                              }
                            </Badge>
                          );
                        }
                        return (
                          <Button
                            size="sm"
                            className="kojo-gradient flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); navigate(`/assignment/${assignment.id}`); }}
                          >
                            {isRTL ? 'تسليم' : 'Submit'}
                          </Button>
                        );
                      })()
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="flex-shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/assignment-submissions/${assignment.id}`); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            {isRTL ? 'عرض التسليمات' : 'View Submissions'}
                          </DropdownMenuItem>
                          {role === 'admin' && (
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); handleDelete(assignment.id); }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t.common.delete}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-muted-foreground">{formatDate(assignment.due_date)}</p>
                    {isOverdue(assignment.due_date) ? (
                      <Badge variant="destructive" className="text-xs">
                        {isRTL ? 'منتهي' : 'Overdue'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                        {isRTL ? 'نشط' : 'Active'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.assignments.assignmentName}</TableHead>
                  <TableHead>{t.students.group}</TableHead>
                  <TableHead>{t.assignments.dueDate}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead className="w-[100px]">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {isRTL ? 'لا توجد اساينمنتات' : 'No assignments found'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {language === 'ar' ? assignment.title_ar : assignment.title}
                      </TableCell>
                      <TableCell>{getGroupName(assignment.group_id)}</TableCell>
                      <TableCell>{formatDate(assignment.due_date)}</TableCell>
                      <TableCell>
                        {isOverdue(assignment.due_date) ? (
                          <Badge variant="destructive">
                            {isRTL ? 'منتهي' : 'Overdue'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            {isRTL ? 'نشط' : 'Active'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {role === 'student' ? (
                          (() => {
                            const submissionStatus = getSubmissionStatus(assignment.id);
                            if (submissionStatus) {
                              if (submissionStatus.status === 'revision_requested') {
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-orange-500 text-orange-600"
                                    onClick={() => navigate(`/assignment/${assignment.id}`)}
                                  >
                                    {isRTL ? 'إعادة التسليم' : 'Resubmit'}
                                  </Button>
                                );
                              }
                              return (
                                <Badge 
                                  variant="outline" 
                                  className={`cursor-pointer hover:opacity-80 ${
                                    submissionStatus.status === 'graded' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                  onClick={() => navigate(`/assignment/${assignment.id}`)}
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {submissionStatus.status === 'graded' 
                                    ? (isRTL ? `مقيّم: ${submissionStatus.score}` : `Graded: ${submissionStatus.score}`)
                                    : (isRTL ? 'تم التسليم' : 'Submitted')
                                  }
                                </Badge>
                              );
                            }
                            return (
                              <Button
                                size="sm"
                                className="kojo-gradient"
                                onClick={() => navigate(`/assignment/${assignment.id}`)}
                              >
                                {isRTL ? 'تسليم' : 'Submit'}
                              </Button>
                            );
                          })()
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem onClick={() => navigate(`/assignment-submissions/${assignment.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                {isRTL ? 'عرض التسليمات' : 'View Submissions'}
                              </DropdownMenuItem>
                              {role === 'admin' && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(assignment.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t.common.delete}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
