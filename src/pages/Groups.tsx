import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Users, UserPlus, UserMinus, Eye, TrendingUp, CalendarIcon, Snowflake, Play, Rocket, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCairoToday } from '@/lib/timeUtils';
import { SessionTimeDisplay } from '@/components/shared/SessionTimeDisplay';
import { notificationService } from '@/lib/notificationService';
import { logCreate, logUpdate, logDelete, logFreeze, logActivate } from '@/lib/activityLogger';
import { GROUP_TYPES_LIST, DAYS_OF_WEEK, type GroupType, type AttendanceMode, type GroupStatus } from '@/lib/constants';
import { getGroupStatusBadge } from '@/lib/statusBadges';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsGrid } from '@/components/shared/StatsGrid';

interface Group {
  id: string;
  name: string;
  name_ar: string;
  age_group_id: string | null;
  level_id: string | null;
  instructor_id: string | null;
  schedule_day: string;
  schedule_time: string;
  duration_minutes: number;
  is_active: boolean;
  group_type: GroupType;
  attendance_mode: AttendanceMode | null;
  session_link: string | null;
  status: GroupStatus;
  has_started: boolean;
}

interface AgeGroup {
  id: string;
  name: string;
  name_ar: string;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
}

interface Instructor {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  avatar_url: string | null;
}

interface InstructorScheduleData {
  instructor_id: string;
  day_of_week: string;
  is_working_day: boolean;
  start_time: string | null;
  end_time: string | null;
}

interface Student {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  subscription_type: GroupType | null;
  age_group_id: string | null;
  level_id: string | null;
  attendance_mode: AttendanceMode | null;
}

interface GroupStudent {
  id: string;
  student_id: string;
  group_id: string;
  is_active: boolean;
}

interface GroupStudentCount {
  [groupId: string]: number;
}

interface TransferWarning {
  studentId: string;
  studentName: string;
  gap: number;
  studentLast: number;
  groupLast: number;
  groupId: string;
  fromGroupId: string | null;
  // Track remaining students to process after this warning
  remainingStudents: string[];
}

export default function GroupsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';
  const isReception = role === 'reception';
  const canManageGroups = isAdmin || isReception;
  const canDelete = role === 'admin';
  const [groups, setGroups] = useState<Group[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterInstructor, setFilterInstructor] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('all');
  const [filterGroupType, setFilterGroupType] = useState<string>('all');
  const [filterAttendanceMode, setFilterAttendanceMode] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStudentsDialogOpen, setIsStudentsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupStudents, setGroupStudents] = useState<GroupStudent[]>([]);
  const [allGroupStudentsData, setAllGroupStudentsData] = useState<GroupStudent[]>([]);
  const [instructorSchedules, setInstructorSchedules] = useState<InstructorScheduleData[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    age_group_id: '',
    level_id: '',
    instructor_id: '',
    schedule_day: '',
    schedule_time: '',
    duration_minutes: 60,
    group_type: 'kojo_squad' as GroupType,
    attendance_mode: 'offline' as AttendanceMode,
    session_link: '',
  });
  const [groupStudentCounts, setGroupStudentCounts] = useState<GroupStudentCount>({});
  
  // Transfer warning state
  const [transferWarning, setTransferWarning] = useState<TransferWarning | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  
  // Start Group Dialog state
  const [isStartGroupDialogOpen, setIsStartGroupDialogOpen] = useState(false);
  const [selectedGroupForStart, setSelectedGroupForStart] = useState<Group | null>(null);
  const [startGroupData, setStartGroupData] = useState({
    is_existing_group: false,
    starting_session_number: 1,
    start_date: null as Date | null,
  });
  const [startGroupLoading, setStartGroupLoading] = useState(false);

  const groupTypes = GROUP_TYPES_LIST;
  const days = DAYS_OF_WEEK;

  useEffect(() => {
    fetchData();
    
    // Subscribe to real-time changes on group_students
    const channel = supabase
      .channel('group-students-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_students',
        },
        () => {
          // Refresh student counts when group_students changes
          refreshStudentCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshStudentCounts = async () => {
    const { data } = await supabase
      .from('group_students')
      .select('group_id')
      .eq('is_active', true);
    
    const counts: GroupStudentCount = {};
    (data || []).forEach((gs) => {
      counts[gs.group_id] = (counts[gs.group_id] || 0) + 1;
    });
    setGroupStudentCounts(counts);
  };

  // Group session progress state
  const [groupSessionProgress, setGroupSessionProgress] = useState<{ [groupId: string]: { completed: number; total: number } }>({});

  const fetchData = async () => {
    try {
      const [groupsRes, ageGroupsRes, levelsRes, instructorRolesRes, studentRolesRes, groupStudentsRes, sessionsRes] = await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase.from('age_groups').select('id, name, name_ar').eq('is_active', true),
        supabase.from('levels').select('id, name, name_ar, expected_sessions_count').eq('is_active', true),
        supabase.from('user_roles').select('user_id').eq('role', 'instructor'),
        supabase.from('user_roles').select('user_id').eq('role', 'student'),
        supabase.from('group_students').select('group_id').eq('is_active', true),
      ]);

      const allGroups = (groupsRes.data || []) as Group[];
      const allLevels = levelsRes.data || [];
      setGroups(allGroups);
      setAgeGroups(ageGroupsRes.data || []);
      setLevels(allLevels);

      // Calculate student counts per group
      const counts: GroupStudentCount = {};
      (groupStudentsRes.data || []).forEach((gs) => {
        counts[gs.group_id] = (counts[gs.group_id] || 0) + 1;
      });
      setGroupStudentCounts(counts);

      // Calculate session progress per group based on content delivery
      const levelMap: Record<string, number> = {};
      allLevels.forEach((lv: any) => { levelMap[lv.id] = lv.expected_sessions_count ?? 12; });

      const sessionProgress: { [groupId: string]: { completed: number; total: number } } = {};
      allGroups.forEach((group: any) => {
        const total = group.level_id ? (levelMap[group.level_id] ?? 12) : 12;
        const delivered = group.last_delivered_content_number ?? 0;
        const startingNum = group.starting_session_number ?? 1;
        const completed = Math.max(0, delivered - (startingNum - 1));
        sessionProgress[group.id] = { completed, total };
      });
      setGroupSessionProgress(sessionProgress);

      // Fetch instructor profiles
      const instructorIds = instructorRolesRes.data?.map((r) => r.user_id) || [];
      if (instructorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar, avatar_url')
          .in('user_id', instructorIds)
          .neq('employment_status', 'terminated');
        setInstructors(profilesData || []);

        // Fetch instructor schedules
        const { data: schedulesData } = await supabase
          .from('instructor_schedules')
          .select('instructor_id, day_of_week, is_working_day, start_time, end_time')
          .in('instructor_id', instructorIds);
        setInstructorSchedules((schedulesData || []) as InstructorScheduleData[]);
      }

      // Fetch student profiles with subscription_type, age_group_id and level_id
      const studentIds = studentRolesRes.data?.map((r) => r.user_id) || [];
      if (studentIds.length > 0) {
        const { data: studentProfilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar, subscription_type, age_group_id, level_id, attendance_mode')
          .in('user_id', studentIds);
        setAllStudents((studentProfilesData || []) as Student[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupStudents = async (groupId: string) => {
    setStudentsLoading(true);
    try {
      // Fetch all group students to check for students in other groups
      const [currentGroupRes, allGroupsRes] = await Promise.all([
        supabase.from('group_students').select('*').eq('group_id', groupId),
        supabase.from('group_students').select('*').eq('is_active', true)
      ]);
      
      if (currentGroupRes.error) throw currentGroupRes.error;
      setGroupStudents(currentGroupRes.data || []);
      setAllGroupStudentsData(allGroupsRes.data || []);
      setSelectedStudentIds((currentGroupRes.data || []).filter(gs => gs.is_active).map(gs => gs.student_id));
    } catch (error) {
      console.error('Error fetching group students:', error);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleManageStudents = (group: Group) => {
    setSelectedGroup(group);
    fetchGroupStudents(group.id);
    setIsStudentsDialogOpen(true);
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Transfer a single student using the RPC
  const transferStudent = useCallback(async (
    studentId: string, 
    toGroupId: string, 
    fromGroupId: string | null, 
    force: boolean
  ): Promise<{ status: string; gap?: number; studentLast?: number; groupLast?: number; makeupCount?: number; missedSessions?: number[] }> => {
    const { data, error } = await supabase.rpc('transfer_student_to_group', {
      p_student_id: studentId,
      p_to_group_id: toGroupId,
      p_from_group_id: fromGroupId,
      p_force: force,
    } as any);

    if (error) throw error;
    
    const result = data as any;
    return {
      status: result.status,
      gap: result.gap,
      studentLast: result.student_canonical_last,
      groupLast: result.group_canonical_last,
      makeupCount: result.makeup_sessions_created,
      missedSessions: result.missed_session_numbers,
    };
  }, []);

  // Process adding students (handles both started and non-started groups)
  const processAddStudents = useCallback(async (
    studentIds: string[],
    group: Group,
    fromGroupId: string | null
  ) => {
    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];

      if (group.has_started) {
        // Use smart transfer RPC
        const result = await transferStudent(studentId, group.id, fromGroupId, false);

        if (result.status === 'student_ahead') {
          // Show warning dialog - pause processing
          setTransferWarning({
            studentId,
            studentName: getStudentName(studentId),
            gap: result.gap || 0,
            studentLast: result.studentLast || 0,
            groupLast: result.groupLast || 0,
            groupId: group.id,
            fromGroupId,
            remainingStudents: studentIds.slice(i + 1),
          });
          return; // Stop here, dialog will handle continuation
        }

        if (result.status === 'level_mismatch') {
          toast({
            variant: 'destructive',
            title: t.common.error,
            description: isRTL 
              ? `الطالب ${getStudentName(studentId)} في مستوى مختلف عن المجموعة`
              : `Student ${getStudentName(studentId)} is at a different level than the group`,
          });
          continue;
        }

        if (result.status === 'student_behind' && result.makeupCount && result.makeupCount > 0) {
          const sessionsList = result.missedSessions?.join(', ') || '';
          toast({
            title: isRTL ? 'تم النقل مع تعويضات' : 'Transferred with makeups',
            description: isRTL
              ? `تم إنشاء ${result.makeupCount} حصة تعويضية للطالب ${getStudentName(studentId)} (الحصص: ${sessionsList})`
              : `Created ${result.makeupCount} makeup sessions for ${getStudentName(studentId)} (sessions: ${sessionsList})`,
          });
        }

        if (result.status === 'no_progress_created') {
          toast({
            title: isRTL ? 'تم الإضافة' : 'Added',
            description: isRTL
              ? `تم إضافة ${getStudentName(studentId)} كطالب جديد بدون سجل سابق`
              : `${getStudentName(studentId)} added as a new student with no prior progress`,
          });
        }

        // equal, no_op: silent success
      } else {
        // Non-started group: simple insert/update
        const existing = groupStudents.find(gs => gs.student_id === studentId);
        if (existing) {
          await supabase
            .from('group_students')
            .update({ is_active: true })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('group_students')
            .insert({ group_id: group.id, student_id: studentId });
        }
      }
    }
  }, [groupStudents, transferStudent, toast, t, isRTL]);

  const handleSaveStudents = async () => {
    if (!selectedGroup) return;
    
    try {
      // Get current active students in the group
      const currentActiveIds = groupStudents.filter(gs => gs.is_active).map(gs => gs.student_id);
      
      // Students to add (in selectedStudentIds but not in currentActiveIds)
      const toAdd = selectedStudentIds.filter(id => !currentActiveIds.includes(id));
      
      // Students to remove (in currentActiveIds but not in selectedStudentIds)
      const toRemove = currentActiveIds.filter(id => !selectedStudentIds.includes(id));

      // Find from_group_id for transfer (student's current active group in same level)
      const fromGroupId: string | null = null; // New students being added don't have a from_group in this context

      // Add new students (uses smart transfer for started groups)
      await processAddStudents(toAdd, selectedGroup, fromGroupId);

      // Deactivate removed students
      for (const studentId of toRemove) {
        const existing = groupStudents.find(gs => gs.student_id === studentId);
        if (existing) {
          await supabase
            .from('group_students')
            .update({ is_active: false })
            .eq('id', existing.id);
        }
      }

      // Only close dialog if no transfer warning is pending
      if (!transferWarning) {
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث طلاب المجموعة' : 'Group students updated successfully',
        });
        
        setIsStudentsDialogOpen(false);
        setSelectedGroup(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error saving group students:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ طلاب المجموعة' : 'Failed to save group students',
      });
    }
  };

  // Handle transfer warning confirmation (force transfer)
  const handleForceTransfer = async () => {
    if (!transferWarning || !selectedGroup) return;
    setTransferLoading(true);
    
    try {
      await transferStudent(
        transferWarning.studentId,
        transferWarning.groupId,
        transferWarning.fromGroupId,
        true
      );

      toast({
        title: t.common.success,
        description: isRTL
          ? `تم نقل ${transferWarning.studentName} بنجاح`
          : `${transferWarning.studentName} transferred successfully`,
      });

      // Continue processing remaining students
      const remaining = transferWarning.remainingStudents;
      setTransferWarning(null);

      if (remaining.length > 0) {
        await processAddStudents(remaining, selectedGroup, transferWarning.fromGroupId);
      }

      // If no more warnings pending, close dialog
      if (!transferWarning) {
        setIsStudentsDialogOpen(false);
        setSelectedGroup(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error forcing transfer:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في نقل الطالب' : 'Failed to transfer student',
      });
    } finally {
      setTransferLoading(false);
    }
  };

  // Handle transfer warning cancellation (skip student)
  const handleSkipTransfer = async () => {
    if (!transferWarning || !selectedGroup) return;
    
    const remaining = transferWarning.remainingStudents;
    setTransferWarning(null);

    if (remaining.length > 0) {
      try {
        await processAddStudents(remaining, selectedGroup, transferWarning.fromGroupId);
      } catch (error) {
        console.error('Error processing remaining students:', error);
      }
    }

    // Close dialog after all done
    if (!transferWarning) {
      setIsStudentsDialogOpen(false);
      setSelectedGroup(null);
      fetchData();
    }
  };

  const getStudentName = (studentId: string) => {
    const student = allStudents.find(s => s.user_id === studentId);
    if (!student) return '-';
    return language === 'ar' && student.full_name_ar ? student.full_name_ar : student.full_name;
  };

  const handleSubmit = async () => {
    try {
      const payload: any = {
        name: formData.name,
        name_ar: formData.name,
        age_group_id: formData.age_group_id || null,
        level_id: formData.level_id || null,
        instructor_id: formData.instructor_id || null,
        schedule_day: formData.schedule_day,
        schedule_time: formData.schedule_time,
        duration_minutes: formData.duration_minutes,
        group_type: formData.group_type,
        attendance_mode: formData.attendance_mode,
        session_link: formData.attendance_mode === 'online' ? formData.session_link || null : null,
      };

      const previousInstructorId = editingGroup?.instructor_id;
      const isNewInstructor = formData.instructor_id && (!editingGroup || previousInstructorId !== formData.instructor_id);

      if (editingGroup) {
        const { error } = await supabase
          .from('groups')
          .update(payload)
          .eq('id', editingGroup.id);

        if (error) throw error;
        
        if (isNewInstructor) {
          await notificationService.notifyGroupAssigned(
            formData.instructor_id,
            formData.name,
            formData.name_ar,
            formData.schedule_day,
            formData.schedule_time
          );
        }
        
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث المجموعة' : 'Group updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('groups')
          .insert([payload])
          .select('id')
          .single();

        if (error) throw error;
        
        if (formData.instructor_id) {
          await notificationService.notifyGroupAssigned(
            formData.instructor_id,
            formData.name,
            formData.name_ar,
            formData.schedule_day,
            formData.schedule_time
          );
        }
        
        toast({
          title: t.common.success,
          description: isRTL ? 'تم إضافة المجموعة' : 'Group added successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingGroup(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving group:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ المجموعة' : 'Failed to save group',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      name_ar: '',
      age_group_id: '',
      level_id: '',
      instructor_id: '',
      schedule_day: '',
      schedule_time: '',
      duration_minutes: 60,
      group_type: 'kojo_squad',
      attendance_mode: 'offline',
      session_link: '',
    });
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      name_ar: group.name_ar,
      age_group_id: group.age_group_id || '',
      level_id: group.level_id || '',
      instructor_id: group.instructor_id || '',
      schedule_day: group.schedule_day,
      schedule_time: group.schedule_time,
      duration_minutes: group.duration_minutes,
      group_type: group.group_type || 'kojo_squad',
      attendance_mode: group.attendance_mode || 'offline',
      session_link: group.session_link || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const group = groups.find(g => g.id === id);
      const { error } = await supabase.from('groups').delete().eq('id', id);
      if (error) throw error;
      
      await logDelete('group', id, { name: group?.name });
      
      toast({
        title: t.common.success,
        description: isRTL ? 'تم حذف المجموعة' : 'Group deleted successfully',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حذف المجموعة' : 'Failed to delete group',
      });
    }
  };

  const handleChangeStatus = async (groupId: string, newStatus: GroupStatus) => {
    try {
      const group = groups.find(g => g.id === groupId);
      const { error } = await supabase
        .from('groups')
        .update({ status: newStatus })
        .eq('id', groupId);
      
      if (error) throw error;
      
      // Log the status change
      if (newStatus === 'frozen') {
        await logFreeze('group', groupId, { name: group?.name, status: newStatus });
      } else if (newStatus === 'active') {
        await logActivate('group', groupId, { name: group?.name, status: newStatus });
      } else {
        await logUpdate('group', groupId, { name: group?.name, status: newStatus });
      }
      
      const statusLabels: Record<GroupStatus, { en: string; ar: string }> = {
        active: { en: 'activated', ar: 'تم تفعيل' },
        frozen: { en: 'frozen', ar: 'تم تجميد' },
      };
      
      toast({
        title: t.common.success,
        description: isRTL 
          ? `${statusLabels[newStatus].ar} المجموعة بنجاح`
          : `Group ${statusLabels[newStatus].en} successfully`,
      });
      
      fetchData();
    } catch (error) {
      console.error('Error changing group status:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تغيير حالة المجموعة' : 'Failed to change group status',
      });
    }
  };

  const handleStartGroup = async () => {
    if (!selectedGroupForStart) return;
    setStartGroupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('start-group', {
        body: {
          group_id: selectedGroupForStart.id,
          start_date: startGroupData.start_date ? format(startGroupData.start_date, 'yyyy-MM-dd') : null,
          starting_session_number: startGroupData.is_existing_group ? startGroupData.starting_session_number : 1,
        },
      });

      if (error) throw error;

      toast({
        title: t.common.success,
        description: isRTL ? 'تم بدء المجموعة وإنشاء الحصص' : 'Group started and sessions created',
      });

      setIsStartGroupDialogOpen(false);
      setSelectedGroupForStart(null);
      setStartGroupData({ is_existing_group: false, starting_session_number: 1, start_date: null });
      fetchData();
    } catch (error) {
      console.error('Error starting group:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في بدء المجموعة' : 'Failed to start group',
      });
    } finally {
      setStartGroupLoading(false);
    }
  };

  const getStatusBadge = (group: Group) => {
    if (!group.has_started) {
      return { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', label: isRTL ? 'لم تبدأ' : 'Not Started' };
    }
    switch (group.status) {
      case 'active':
        return { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: isRTL ? 'نشط' : 'Active' };
      case 'frozen':
        return { className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400', label: isRTL ? 'مجمد' : 'Frozen' };
      default:
        return { className: '', label: group.status };
    }
  };

  const filteredGroups = groups.filter((group) => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.name_ar.includes(searchQuery);
    const matchesDay = filterDay === 'all' || group.schedule_day === filterDay;
    const matchesInstructor = filterInstructor === 'all' || group.instructor_id === filterInstructor;
    const matchesLevel = filterLevel === 'all' || group.level_id === filterLevel;
    const matchesAgeGroup = filterAgeGroup === 'all' || group.age_group_id === filterAgeGroup;
    const matchesGroupType = filterGroupType === 'all' || group.group_type === filterGroupType;
    const matchesAttendanceMode = filterAttendanceMode === 'all' || group.attendance_mode === filterAttendanceMode;
    return matchesSearch && matchesDay && matchesInstructor && matchesLevel && matchesAgeGroup && matchesGroupType && matchesAttendanceMode;
  });

  const getInstructorName = (id: string | null) => {
    if (!id) return isRTL ? 'لم يتم التعيين' : 'Not Assigned';
    const instructor = instructors.find((i) => i.user_id === id);
    if (!instructor) return '-';
    return language === 'ar' && instructor.full_name_ar 
      ? instructor.full_name_ar 
      : instructor.full_name;
  };

  const getInstructorAvailability = (instructorId: string) => {
    if (!formData.schedule_day || !formData.schedule_time) return 'unknown';
    
    const schedule = instructorSchedules.find(
      s => s.instructor_id === instructorId && s.day_of_week === formData.schedule_day
    );
    
    // No schedule record = default working day
    if (!schedule) return 'available';
    
    // Day off
    if (!schedule.is_working_day) return 'day_off';
    
    // Check if time is within working hours
    if (schedule.start_time && schedule.end_time && formData.schedule_time) {
      const groupTime = formData.schedule_time;
      if (groupTime < schedule.start_time || groupTime >= schedule.end_time) {
        return 'outside_hours';
      }
    }
    
    // Check if already assigned to another group at this day/time
    const conflictingGroup = groups.find(g => 
      g.instructor_id === instructorId && 
      g.schedule_day === formData.schedule_day &&
      g.schedule_time === formData.schedule_time &&
      g.id !== editingGroup?.id
    );
    if (conflictingGroup) return 'busy';
    
    return 'available';
  };

  const getAgeGroupName = (id: string | null) => {
    if (!id) return '-';
    const group = ageGroups.find((g) => g.id === id);
    return group ? (language === 'ar' ? group.name_ar : group.name) : '-';
  };

  const getLevelName = (id: string | null) => {
    if (!id) return '-';
    const level = levels.find((l) => l.id === id);
    return level ? (language === 'ar' ? level.name_ar : level.name) : '-';
  };

  const getDayName = (day: string) => {
    const found = days.find((d) => d.en === day);
    return found ? (language === 'ar' ? found.ar : found.en) : day;
  };

  const getGroupTypeInfo = (type: GroupType) => {
    return groupTypes.find(gt => gt.value === type) || groupTypes[0];
  };

  const getMaxStudents = (type: GroupType) => {
    return getGroupTypeInfo(type).maxStudents;
  };

  // Get all students that are already assigned to any group
  const getStudentsInOtherGroups = (currentGroupId: string): string[] => {
    // Get all active group_students for groups other than current
    // We need to track this from the groupStudents we fetched for all groups
    // For now, we'll check in real-time when opening the dialog
    return [];
  };

  const getEligibleStudents = (groupId: string, groupType: GroupType, groupAgeGroupId: string | null, groupLevelId: string | null, groupAttendanceMode: AttendanceMode | null, allGroupStudentsData: GroupStudent[]) => {
    // Get students already in other groups
    const studentsInOtherGroups = allGroupStudentsData
      .filter(gs => gs.group_id !== groupId && gs.is_active)
      .map(gs => gs.student_id);

    return allStudents.filter(student => {
      // Must match subscription type
      if (student.subscription_type !== groupType) return false;
      
      // If group has age_group_id, student must match it
      if (groupAgeGroupId && student.age_group_id !== groupAgeGroupId) return false;
      
      // If group has level_id, student must match it
      if (groupLevelId && student.level_id !== groupLevelId) return false;
      
      // Must match attendance mode (online/offline)
      const studentMode = student.attendance_mode || 'offline';
      const groupMode = groupAttendanceMode || 'offline';
      if (studentMode !== groupMode) return false;
      
      // Student must not be in another group (unless already in this group)
      const isInCurrentGroup = allGroupStudentsData.some(gs => gs.group_id === groupId && gs.student_id === student.user_id && gs.is_active);
      if (studentsInOtherGroups.includes(student.user_id) && !isInCurrentGroup) return false;
      
      return true;
    });
  };

  return (
    <DashboardLayout title={t.groups.title}>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title={t.groups.title}
          subtitle={isRTL ? `${groups.length} مجموعة` : `${groups.length} groups`}
          icon={Users}
          gradient="from-blue-500 to-blue-600"
          actions={canManageGroups ? (
            <Button className="kojo-gradient shadow-md" onClick={() => {
              setEditingGroup(null);
              resetForm();
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 me-2" />
              {t.groups.addGroup}
            </Button>
          ) : undefined}
        />

        {/* Summary Stats */}
        <StatsGrid
          stats={[
            { label: isRTL ? 'إجمالي المجموعات' : 'Total Groups', value: loading ? '...' : groups.length, icon: Users, gradient: 'from-blue-500 to-blue-600' },
            { label: isRTL ? 'نشطة' : 'Active', value: loading ? '...' : groups.filter(g => g.status === 'active' && g.has_started).length, icon: Play, gradient: 'from-emerald-500 to-emerald-600' },
            { label: isRTL ? 'لم تبدأ' : 'Not Started', value: loading ? '...' : groups.filter(g => !g.has_started).length, icon: Clock, gradient: 'from-amber-500 to-orange-500' },
            { label: isRTL ? 'مجمدة' : 'Frozen', value: loading ? '...' : groups.filter(g => g.status === 'frozen').length, icon: Snowflake, gradient: 'from-sky-400 to-sky-500' },
          ]}
        />

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10"
            />
          </div>

          {canManageGroups && (
            <Button className="kojo-gradient shadow-md" onClick={() => {
              setEditingGroup(null);
              resetForm();
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t.groups.addGroup}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterDay} onValueChange={setFilterDay}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={isRTL ? 'الموعد' : 'Day'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل الأيام' : 'All Days'}</SelectItem>
              {days.map(d => (
                <SelectItem key={d.en} value={d.en}>
                  {language === 'ar' ? d.ar : d.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterInstructor} onValueChange={setFilterInstructor}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder={isRTL ? 'المدرب' : 'Instructor'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل المدربين' : 'All Instructors'}</SelectItem>
              {instructors.map(i => (
                <SelectItem key={i.user_id} value={i.user_id}>
                  {language === 'ar' && i.full_name_ar ? i.full_name_ar : i.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={isRTL ? 'المستوى' : 'Level'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل المستويات' : 'All Levels'}</SelectItem>
              {levels.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {language === 'ar' ? l.name_ar : l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAgeGroup} onValueChange={setFilterAgeGroup}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={isRTL ? 'الفئة العمرية' : 'Age Group'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل الفئات' : 'All Age Groups'}</SelectItem>
              {ageGroups.map(ag => (
                <SelectItem key={ag.id} value={ag.id}>
                  {language === 'ar' ? ag.name_ar : ag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterGroupType} onValueChange={setFilterGroupType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={isRTL ? 'نوع المجموعة' : 'Group Type'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل الأنواع' : 'All Types'}</SelectItem>
              {groupTypes.map(gt => (
                <SelectItem key={gt.value} value={gt.value}>
                  {language === 'ar' ? gt.labelAr : gt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAttendanceMode} onValueChange={setFilterAttendanceMode}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={isRTL ? 'نوع الحضور' : 'Attendance'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'الكل' : 'All Modes'}</SelectItem>
              <SelectItem value="online">{isRTL ? 'أونلاين' : 'Online'}</SelectItem>
              <SelectItem value="offline">{isRTL ? 'حضوري' : 'Offline'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? t.groups.editGroup : t.groups.addGroup}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل بيانات المجموعة' : 'Enter group details'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">

              <div className="grid gap-2">
                <Label>{t.groups.groupName}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={isRTL ? 'مثال: مجموعة الاثنين' : 'e.g., Monday Juniors'}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.groups.instructor} <span className="text-muted-foreground text-xs">({isRTL ? 'اختياري' : 'Optional'})</span></Label>
                <Select
                  value={formData.instructor_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, instructor_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر المدرب' : 'Select instructor'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {isRTL ? '-- بدون مدرب --' : '-- No Instructor --'}
                    </SelectItem>
                    {(() => {
                      // Sort: available first, then others
                      const sorted = [...instructors].sort((a, b) => {
                        const aAvail = getInstructorAvailability(a.user_id);
                        const bAvail = getInstructorAvailability(b.user_id);
                        if (aAvail === 'available' && bAvail !== 'available') return -1;
                        if (aAvail !== 'available' && bAvail === 'available') return 1;
                        return 0;
                      });
                      return sorted.map((instructor) => {
                        const availability = getInstructorAvailability(instructor.user_id);
                        const name = language === 'ar' && instructor.full_name_ar 
                          ? instructor.full_name_ar 
                          : instructor.full_name;
                        const statusLabel = availability === 'day_off' 
                          ? (isRTL ? '🔴 إجازة' : '🔴 Day Off')
                          : availability === 'outside_hours'
                          ? (isRTL ? '🟡 خارج ساعات العمل' : '🟡 Outside Hours')
                          : availability === 'busy'
                          ? (isRTL ? '🟠 مشغول' : '🟠 Busy')
                          : availability === 'available'
                          ? (isRTL ? '🟢 متاح' : '🟢 Available')
                          : '';
                        return (
                          <SelectItem key={instructor.user_id} value={instructor.user_id}>
                            <span className="flex items-center gap-2">
                              <span>{name}</span>
                              {statusLabel && <span className="text-xs text-muted-foreground">{statusLabel}</span>}
                            </span>
                          </SelectItem>
                        );
                      });
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t.students.ageGroup}</Label>
                  <Select
                    value={formData.age_group_id}
                    onValueChange={(value) => setFormData({ ...formData, age_group_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اختر' : 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      {ageGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {language === 'ar' ? group.name_ar : group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t.students.level}</Label>
                  <Select
                    value={formData.level_id}
                    onValueChange={(value) => setFormData({ ...formData, level_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اختر' : 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {language === 'ar' ? level.name_ar : level.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t.groups.schedule}</Label>
                  <Select
                    value={formData.schedule_day}
                    onValueChange={(value) => setFormData({ ...formData, schedule_day: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اليوم' : 'Day'} />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((day) => (
                        <SelectItem key={day.en} value={day.en}>
                          {language === 'ar' ? day.ar : day.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'الوقت' : 'Time'}</Label>
                  <Input
                    type="time"
                    value={formData.schedule_time}
                    onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t.groups.duration} ({isRTL ? 'دقيقة' : 'minutes'})</Label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'نوع المجموعة' : 'Group Type'}</Label>
                <Select
                  value={formData.group_type}
                  onValueChange={(value) => setFormData({ ...formData, group_type: value as GroupType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {groupTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {language === 'ar' ? type.labelAr : type.label} ({isRTL ? `حد أقصى ${type.maxStudents} طالب` : `max ${type.maxStudents} students`})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t.groups.attendanceMode}</Label>
                <Select
                  value={formData.attendance_mode}
                  onValueChange={(value) => setFormData({ ...formData, attendance_mode: value as AttendanceMode })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر نوع الحضور' : 'Select attendance mode'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">{t.groups.offline}</SelectItem>
                    <SelectItem value="online">{t.groups.online}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.attendance_mode === 'online' && (
                <div className="grid gap-2">
                  <Label>{t.groups.sessionLink}</Label>
                  <Input
                    value={formData.session_link}
                    onChange={(e) => setFormData({ ...formData, session_link: e.target.value })}
                    placeholder="https://meet.google.com/..."
                    dir="ltr"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button className="kojo-gradient" onClick={handleSubmit}>
                {t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Students Management Dialog */}
        <Dialog open={isStudentsDialogOpen} onOpenChange={setIsStudentsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {isRTL ? 'إدارة طلاب المجموعة' : 'Manage Group Students'}
              </DialogTitle>
              <DialogDescription>
                {selectedGroup && (
                  <div className="space-y-1">
                    <span className="font-medium block">
                      {language === 'ar' ? selectedGroup.name_ar : selectedGroup.name}
                    </span>
                    <span className="text-xs">
                      {(() => {
                        const typeInfo = getGroupTypeInfo(selectedGroup.group_type);
                        const currentCount = groupStudentCounts[selectedGroup.id] || 0;
                        return isRTL 
                          ? `${typeInfo.labelAr} - ${currentCount}/${typeInfo.maxStudents} طالب`
                          : `${typeInfo.label} - ${currentCount}/${typeInfo.maxStudents} students`;
                      })()}
                    </span>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {studentsLoading ? (
                <div className="text-center py-8">{t.common.loading}</div>
              ) : (() => {
                const eligibleStudents = selectedGroup 
                  ? getEligibleStudents(selectedGroup.id, selectedGroup.group_type, selectedGroup.age_group_id, selectedGroup.level_id, selectedGroup.attendance_mode, allGroupStudentsData) 
                  : [];
                const maxStudents = selectedGroup ? getMaxStudents(selectedGroup.group_type) : 0;
                const isAtLimit = selectedStudentIds.length >= maxStudents;

                if (eligibleStudents.length === 0) {
                  const groupTypeName = isRTL 
                    ? getGroupTypeInfo(selectedGroup?.group_type || 'kojo_squad').labelAr
                    : getGroupTypeInfo(selectedGroup?.group_type || 'kojo_squad').label;
                  const ageGroupName = selectedGroup?.age_group_id 
                    ? getAgeGroupName(selectedGroup.age_group_id)
                    : null;
                  const levelName = selectedGroup?.level_id
                    ? getLevelName(selectedGroup.level_id)
                    : null;
                  
                  return (
                    <div className="text-center py-8 text-muted-foreground space-y-2">
                      <p className="font-medium">
                        {isRTL ? 'لا يوجد طلاب مطابقين' : 'No matching students found'}
                      </p>
                      <p className="text-sm">
                        {isRTL 
                          ? `يجب أن يكون الطالب مشتركاً في باقة "${groupTypeName}"${ageGroupName ? ` وفي الفئة العمرية "${ageGroupName}"` : ''}${levelName ? ` وفي المستوى "${levelName}"` : ''} وغير مضاف في مجموعة أخرى`
                          : `Student must be subscribed to "${groupTypeName}"${ageGroupName ? ` and in age group "${ageGroupName}"` : ''}${levelName ? ` and in level "${levelName}"` : ''} and not in another group`}
                      </p>
                    </div>
                  );
                }

                return (
                  <>
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-2">
                        {eligibleStudents.map((student) => {
                          const isSelected = selectedStudentIds.includes(student.user_id);
                          const isDisabled = !isSelected && isAtLimit;
                          
                          return (
                            <div
                              key={student.user_id}
                              className={`flex items-center space-x-3 rtl:space-x-reverse p-3 rounded-lg border ${
                                isDisabled 
                                  ? 'opacity-50 cursor-not-allowed' 
                                  : 'hover:bg-muted/50 cursor-pointer'
                              }`}
                              onClick={() => !isDisabled && handleStudentToggle(student.user_id)}
                            >
                              <Checkbox
                                checked={isSelected}
                                disabled={isDisabled}
                                onCheckedChange={() => !isDisabled && handleStudentToggle(student.user_id)}
                              />
                              <span className="flex-1">
                                {language === 'ar' && student.full_name_ar 
                                  ? student.full_name_ar 
                                  : student.full_name}
                              </span>
                              {isSelected && (
                                <Badge variant="secondary" className="text-xs">
                                  {isRTL ? 'مضاف' : 'Added'}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    {isAtLimit && (
                      <div className="mt-2 p-2 bg-destructive/10 text-destructive text-sm rounded">
                        {isRTL 
                          ? `تم الوصول للحد الأقصى (${maxStudents} طالب)`
                          : `Maximum limit reached (${maxStudents} students)`}
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {isRTL 
                    ? `${selectedStudentIds.length} طالب محدد`
                    : `${selectedStudentIds.length} student(s) selected`}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStudentsDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button className="kojo-gradient" onClick={handleSaveStudents}>
                {t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mobile Card View */}
        <div className="block lg:hidden space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center">
                {t.common.loading}
              </CardContent>
            </Card>
          ) : filteredGroups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {isRTL ? 'لا توجد مجموعات' : 'No groups found'}
              </CardContent>
            </Card>
          ) : (
            filteredGroups.map((group) => {
              const typeInfo = getGroupTypeInfo(group.group_type);
              const currentCount = groupStudentCounts[group.id] || 0;
              const isAtLimit = currentCount >= typeInfo.maxStudents;
              const progress = groupSessionProgress[group.id] || { completed: 0, total: 12 };
              const progressPercent = Math.round((progress.completed / progress.total) * 100);
              
              return (
                <Card 
                  key={group.id} 
                  className={`cursor-pointer hover:bg-muted/50 transition-colors ${group.status === 'frozen' ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800' : ''}`}
                  onClick={() => navigate(`/group/${group.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">
                            {language === 'ar' ? group.name_ar : group.name}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {language === 'ar' ? typeInfo.labelAr : typeInfo.label}
                          </Badge>
                          <Badge 
                            variant={group.attendance_mode === 'online' ? 'default' : 'outline'} 
                            className={`text-xs ${group.attendance_mode === 'online' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                          >
                            {group.attendance_mode === 'online' 
                              ? (isRTL ? 'أونلاين' : 'Online')
                              : (isRTL ? 'حضوري' : 'Offline')}
                          </Badge>
                          {/* Status Badge */}
                          <Badge className={`text-xs ${getStatusBadge(group).className}`}>
                            {getStatusBadge(group).label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                          {(() => {
                            const instructor = instructors.find(i => i.user_id === group.instructor_id);
                            return instructor ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={instructor.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px]">{instructor.full_name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span>{language === 'ar' && instructor.full_name_ar ? instructor.full_name_ar : instructor.full_name}</span>
                              </div>
                            ) : (
                              <span>{isRTL ? 'لم يتم التعيين' : 'Not Assigned'}</span>
                            );
                          })()}
                          <span>•</span>
                          <span>{getDayName(group.schedule_day)} <SessionTimeDisplay sessionDate={getCairoToday()} sessionTime={group.schedule_time} isRTL={isRTL} /></span>
                        </div>
                        
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <Badge variant={isAtLimit ? 'destructive' : 'outline'} className="text-xs">
                              {currentCount}/{typeInfo.maxStudents}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 flex-1 min-w-[80px] max-w-[120px]">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all" 
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs">{progress.completed}/{progress.total}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div onClick={(e) => e.stopPropagation()}>
                        {canManageGroups ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem onClick={() => navigate(`/group/${group.id}`)}>
                                <Eye className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {isRTL ? 'عرض التفاصيل' : 'View Details'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(group)}>
                                <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {t.common.edit}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleManageStudents(group)}>
                                <Users className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {isRTL ? 'إدارة الطلاب' : 'Manage Students'}
                              </DropdownMenuItem>
                              {/* Start Group - only for groups not yet started */}
                              {!group.has_started && (
                                <DropdownMenuItem onClick={() => {
                                  setSelectedGroupForStart(group);
                                  setStartGroupData({ is_existing_group: false, starting_session_number: 1, start_date: null });
                                  setIsStartGroupDialogOpen(true);
                                }}>
                                  <Rocket className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-primary" />
                                  {isRTL ? 'بدء المجموعة' : 'Start Group'}
                                </DropdownMenuItem>
                              )}
                              {/* Status Change Options */}
                              {group.status !== 'active' && (
                                <DropdownMenuItem onClick={() => handleChangeStatus(group.id, 'active')}>
                                  <Play className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-green-600" />
                                  {isRTL ? 'تفعيل' : 'Activate'}
                                </DropdownMenuItem>
                              )}
                              {group.status !== 'frozen' && (
                                <DropdownMenuItem onClick={() => handleChangeStatus(group.id, 'frozen')}>
                                  <Snowflake className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-sky-600" />
                                  {isRTL ? 'تجميد' : 'Freeze'}
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(group.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                  {t.common.delete}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/group/${group.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden lg:block">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>{t.groups.groupName}</TableHead>
                  <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{isRTL ? 'نوع الحضور' : 'Attendance'}</TableHead>
                  <TableHead>{t.students.ageGroup}</TableHead>
                  <TableHead>{t.students.level}</TableHead>
                  <TableHead>{isRTL ? 'التقدم' : 'Progress'}</TableHead>
                  <TableHead>{isRTL ? 'الطلاب' : 'Students'}</TableHead>
                  <TableHead>{t.groups.instructor}</TableHead>
                  <TableHead>{t.groups.schedule}</TableHead>
                  <TableHead className="w-[120px]">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا توجد مجموعات' : 'No groups found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups.map((group) => {
                    const typeInfo = getGroupTypeInfo(group.group_type);
                    const currentCount = groupStudentCounts[group.id] || 0;
                    const isAtLimit = currentCount >= typeInfo.maxStudents;
                    const progress = groupSessionProgress[group.id] || { completed: 0, total: 12 };
                    const progressPercent = Math.round((progress.completed / progress.total) * 100);
                    
                    return (
                      <TableRow 
                        key={group.id} 
                        className={`cursor-pointer hover:bg-muted/50 ${group.status === 'frozen' ? 'bg-sky-50 dark:bg-sky-950/20' : ''}`}
                        onClick={() => navigate(`/group/${group.id}`)}
                      >
                        <TableCell className="font-medium">
                          {language === 'ar' ? group.name_ar : group.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {language === 'ar' ? typeInfo.labelAr : typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(group).className}>
                            {getStatusBadge(group).label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={group.attendance_mode === 'online' ? 'default' : 'outline'}
                            className={group.attendance_mode === 'online' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                          >
                            {group.attendance_mode === 'online' 
                              ? (isRTL ? 'أونلاين' : 'Online')
                              : (isRTL ? 'حضوري' : 'Offline')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getAgeGroupName(group.age_group_id)}
                        </TableCell>
                        <TableCell>
                          {getLevelName(group.level_id)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all" 
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {progress.completed}/{progress.total}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isAtLimit ? 'destructive' : 'outline'}>
                            {currentCount}/{typeInfo.maxStudents}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const instructor = instructors.find(i => i.user_id === group.instructor_id);
                              return instructor ? (
                                <>
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={instructor.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs">{instructor.full_name.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <span>{language === 'ar' && instructor.full_name_ar ? instructor.full_name_ar : instructor.full_name}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">{isRTL ? 'لم يتم التعيين' : 'Not Assigned'}</span>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getDayName(group.schedule_day)} - <SessionTimeDisplay sessionDate={getCairoToday()} sessionTime={group.schedule_time} isRTL={isRTL} />
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {canManageGroups ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleManageStudents(group)}
                                title={isRTL ? 'إدارة الطلاب' : 'Manage Students'}
                              >
                                <Users className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                                  <DropdownMenuItem onClick={() => navigate(`/group/${group.id}`)}>
                                    <Eye className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                    {isRTL ? 'عرض التفاصيل' : 'View Details'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEdit(group)}>
                                    <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                    {t.common.edit}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleManageStudents(group)}>
                                    <Users className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                    {isRTL ? 'إدارة الطلاب' : 'Manage Students'}
                                  </DropdownMenuItem>
                                  {/* Start Group */}
                                  {!group.has_started && (
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedGroupForStart(group);
                                      setStartGroupData({ is_existing_group: false, starting_session_number: 1, start_date: null });
                                      setIsStartGroupDialogOpen(true);
                                    }}>
                                      <Rocket className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-primary" />
                                      {isRTL ? 'بدء المجموعة' : 'Start Group'}
                                    </DropdownMenuItem>
                                  )}
                                  {/* Status Change Options */}
                                  {group.status !== 'active' && (
                                    <DropdownMenuItem onClick={() => handleChangeStatus(group.id, 'active')}>
                                      <Play className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-green-600" />
                                      {isRTL ? 'تفعيل' : 'Activate'}
                                    </DropdownMenuItem>
                                  )}
                                  {group.status !== 'frozen' && (
                                    <DropdownMenuItem onClick={() => handleChangeStatus(group.id, 'frozen')}>
                                      <Snowflake className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-sky-600" />
                                      {isRTL ? 'تجميد' : 'Freeze'}
                                    </DropdownMenuItem>
                                  )}
                                   {canDelete && (
                                     <DropdownMenuItem 
                                       onClick={() => handleDelete(group.id)}
                                       className="text-destructive"
                                     >
                                       <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                       {t.common.delete}
                                     </DropdownMenuItem>
                                   )}
                                 </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/group/${group.id}`)}
                              title={isRTL ? 'عرض التفاصيل' : 'View Details'}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {/* Start Group Dialog */}
        <Dialog open={isStartGroupDialogOpen} onOpenChange={setIsStartGroupDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                {isRTL ? 'بدء المجموعة' : 'Start Group'}
              </DialogTitle>
              <DialogDescription>
                {selectedGroupForStart && (
                  <span className="font-medium">
                    {language === 'ar' ? selectedGroupForStart.name_ar : selectedGroupForStart.name}
                  </span>
                )}
                {' - '}
                {isRTL ? 'سيتم إنشاء الحصص عند البدء' : 'Sessions will be created when you start'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Group type: new or existing */}
              <div className="grid gap-2">
                <Label className="font-semibold">{isRTL ? 'نوع المجموعة' : 'Group Type'}</Label>
                <RadioGroup
                  value={startGroupData.is_existing_group ? 'existing' : 'new'}
                  onValueChange={(value) => setStartGroupData({ 
                    ...startGroupData, 
                    is_existing_group: value === 'existing',
                    starting_session_number: value === 'new' ? 1 : startGroupData.starting_session_number,
                  })}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <RadioGroupItem value="new" id="start-new-group" />
                    <Label htmlFor="start-new-group" className="cursor-pointer font-normal">
                      {isRTL ? 'مجموعة جديدة - تبدأ من السيشن 1' : 'New Group - Starts from Session 1'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <RadioGroupItem value="existing" id="start-existing-group" />
                    <Label htmlFor="start-existing-group" className="cursor-pointer font-normal">
                      {isRTL ? 'مجموعة قائمة - بدأت مسبقاً' : 'Existing Group - Already Started'}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Existing group options */}
              {startGroupData.is_existing_group && (
                <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                  <div className="grid gap-2">
                    <Label>{isRTL ? 'السيشن القادم سيكون رقم' : 'Next Session Number'}</Label>
                    <Select
                      value={startGroupData.starting_session_number.toString()}
                      onValueChange={(value) => setStartGroupData({ ...startGroupData, starting_session_number: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {isRTL ? `السيشن ${num}` : `Session ${num}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="p-2 rounded bg-background">
                      <div className="font-semibold text-muted-foreground">
                        {startGroupData.starting_session_number - 1}
                      </div>
                      <div className="text-xs text-muted-foreground">{isRTL ? 'سيشنات فاتت' : 'Passed'}</div>
                    </div>
                    <div className="p-2 rounded bg-background">
                      <div className="font-semibold text-primary">
                        {12 - startGroupData.starting_session_number + 1}
                      </div>
                      <div className="text-xs text-muted-foreground">{isRTL ? 'سيشنات باقية' : 'Remaining'}</div>
                    </div>
                    <div className="p-2 rounded bg-background">
                      <div className="font-semibold text-primary">
                        {Math.round(((startGroupData.starting_session_number - 1) / 12) * 100)}%
                      </div>
                      <div className="text-xs text-muted-foreground">{isRTL ? 'التقدم' : 'Progress'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Start date picker */}
              <div className="grid gap-2">
                <Label>{isRTL ? 'تاريخ بداية الحصص' : 'Sessions Start Date'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startGroupData.start_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                      {startGroupData.start_date ? (
                        format(startGroupData.start_date, "PPP", { locale: isRTL ? ar : enUS })
                      ) : (
                        <span>{isRTL ? 'اختياري - سيتم تحديد أقرب يوم تلقائياً' : 'Optional - defaults to next scheduled day'}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startGroupData.start_date || undefined}
                      onSelect={(date) => setStartGroupData({ ...startGroupData, start_date: date || null })}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today;
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {/* Warning if no instructor */}
              {selectedGroupForStart && !selectedGroupForStart.instructor_id && (
                <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
                  {isRTL ? '⚠️ يجب تعيين مدرب للمجموعة قبل بدئها. قم بتعديل المجموعة أولاً.' : '⚠️ An instructor must be assigned before starting the group. Edit the group first.'}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStartGroupDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button 
                className="kojo-gradient" 
                onClick={handleStartGroup} 
                disabled={startGroupLoading || !selectedGroupForStart?.instructor_id}
              >
                {startGroupLoading 
                  ? (isRTL ? 'جاري البدء...' : 'Starting...') 
                  : (isRTL ? 'بدء المجموعة' : 'Start Group')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transfer Warning AlertDialog */}
        <AlertDialog open={!!transferWarning} onOpenChange={(open) => !open && handleSkipTransfer()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {isRTL ? 'الطالب سابق المجموعة' : 'Student is ahead of group'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-start">
                {transferWarning && (
                  isRTL
                    ? `الطالب "${transferWarning.studentName}" وصل للحصة ${transferWarning.studentLast} بينما المجموعة في الحصة ${transferWarning.groupLast} (فرق ${transferWarning.gap} حصص). هل تريد المتابعة؟`
                    : `Student "${transferWarning.studentName}" has reached session ${transferWarning.studentLast} while the group is at session ${transferWarning.groupLast} (${transferWarning.gap} session gap). Do you want to proceed?`
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={transferLoading}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleForceTransfer} disabled={transferLoading}>
                {transferLoading 
                  ? (isRTL ? 'جاري النقل...' : 'Transferring...') 
                  : (isRTL ? 'متابعة' : 'Proceed')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
