import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SortableTableHead, type SortDirection } from '@/components/shared/SortableTableHead';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { GROUP_TYPES_LIST } from '@/lib/constants';
import type { StudentListItem } from '../types';

export interface StudentsTableColumnVisibility {
  name: boolean;
  email: boolean;
  ageGroup: boolean;
  level: boolean;
  subscription: boolean;
  payment: boolean;
  attendance: boolean;
}

interface StudentsTableProps {
  rows: StudentListItem[];
  loading: boolean;
  isAdmin: boolean;
  columnVisibility: StudentsTableColumnVisibility;
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onEdit: (student: StudentListItem) => void;
  onDelete: (student: StudentListItem) => void;
}

/**
 * Pure rendering component for the students list (table + mobile cards).
 * Receives ALL data via props. Owns NO state except UI primitives.
 */
export function StudentsTable({
  rows,
  loading,
  isAdmin,
  columnVisibility,
  sortKey,
  sortDirection,
  onSort,
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  onPageChange,
  onEdit,
  onDelete,
}: StudentsTableProps) {
  const { isRTL, language, t } = useLanguage();
  const navigate = useNavigate();

  const subscriptionTypes = GROUP_TYPES_LIST;

  const labelName = (s: StudentListItem) =>
    language === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name;

  const ageGroupName = (s: StudentListItem) =>
    s.age_group_id
      ? language === 'ar' && s.age_group_name_ar
        ? s.age_group_name_ar
        : s.age_group_name ?? '-'
      : '-';

  const levelName = (s: StudentListItem) =>
    s.level_id
      ? language === 'ar' && s.level_name_ar
        ? s.level_name_ar
        : s.level_name ?? '-'
      : '-';

  const subscriptionLabel = (s: StudentListItem) => {
    if (!s.subscription_type) return '-';
    const found = subscriptionTypes.find((tp) => tp.value === s.subscription_type);
    return found ? (language === 'ar' ? found.labelAr : found.label) : '-';
  };

  const attendanceLabel = (s: StudentListItem) =>
    s.attendance_mode === 'online'
      ? isRTL ? 'أونلاين' : 'Online'
      : isRTL ? 'حضوري' : 'Offline';

  const paymentBadge = (s: StudentListItem) => {
    if (!s.subscription_status) {
      return { label: isRTL ? 'لا اشتراك' : 'No Sub', variant: 'outline' as const, color: '' };
    }
    if (s.needs_renewal) {
      return { label: isRTL ? 'تجديد' : 'Renew', variant: 'destructive' as const, color: '' };
    }
    return { label: isRTL ? 'فعال' : 'Active', variant: 'secondary' as const, color: '' };
  };

  const noGroup = (s: StudentListItem) => !s.group_id;

  return (
    <>
      {/* Mobile Cards */}
      <div className="block lg:hidden space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </CardContent>
            </Card>
          ))
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {isRTL ? 'لا يوجد طلاب' : 'No students found'}
            </CardContent>
          </Card>
        ) : (
          rows.map((student) => {
            const ps = paymentBadge(student);
            return (
              <Card
                key={student.user_id}
                className={cn(
                  'cursor-pointer hover:bg-muted/50 transition-colors',
                  noGroup(student) && 'border-destructive/50 bg-destructive/25',
                )}
                onClick={() => navigate(`/student/${student.user_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={student.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {student.full_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{labelName(student)}</p>
                        <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/student/${student.user_id}`); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          {isRTL ? 'عرض الملف' : 'View Profile'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(student); }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {t.common.edit}
                        </DropdownMenuItem>
                        {isAdmin && (
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onDelete(student); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {isRTL ? 'حذف الطالب' : 'Delete Student'}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">{ageGroupName(student)}</Badge>
                    <Badge variant="outline" className="text-xs">{levelName(student)}</Badge>
                    <Badge variant="secondary" className="text-xs">{subscriptionLabel(student)}</Badge>
                    <Badge
                      variant={student.attendance_mode === 'online' ? 'default' : 'outline'}
                      className={cn('text-xs', student.attendance_mode === 'online' && 'bg-blue-500 hover:bg-blue-600')}
                    >
                      {attendanceLabel(student)}
                    </Badge>
                    <Badge variant={ps.variant} className={cn('text-xs', ps.color)}>{ps.label}</Badge>
                    {noGroup(student) && (
                      <Badge variant="destructive" className="text-xs">
                        {isRTL ? 'غير مسكّن' : 'No Group'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <Card className="hidden lg:block">
        <CardContent className="p-0">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/30">
                {columnVisibility.name && <SortableTableHead sortKey="full_name" currentSort={sortKey} currentDirection={sortDirection} onSort={onSort} className="w-[18%]">{t.students.fullName}</SortableTableHead>}
                {columnVisibility.email && <SortableTableHead sortKey="email" currentSort={sortKey} currentDirection={sortDirection} onSort={onSort} className="w-[18%]">{t.auth.email}</SortableTableHead>}
                {columnVisibility.ageGroup && <TableHead className="w-[12%]">{t.students.ageGroup}</TableHead>}
                {columnVisibility.level && <TableHead className="w-[12%]">{t.students.level}</TableHead>}
                {columnVisibility.subscription && <TableHead className="w-[13%]">{isRTL ? 'الاشتراك' : 'Subscription'}</TableHead>}
                {columnVisibility.payment && <TableHead className="w-[12%]">{isRTL ? 'حالة الدفع' : 'Payment'}</TableHead>}
                {columnVisibility.attendance && <TableHead className="w-[10%]">{isRTL ? 'نوع الحضور' : 'Attendance'}</TableHead>}
                <TableHead className="w-[5%]">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className={`h-4 ${j === 0 ? 'w-32' : 'w-20'}`} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {isRTL ? 'لا يوجد طلاب' : 'No students found'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((student) => {
                  const ps = paymentBadge(student);
                  return (
                    <TableRow
                      key={student.user_id}
                      className={cn(
                        'cursor-pointer hover:bg-muted/50',
                        noGroup(student) && 'bg-destructive/25',
                      )}
                      onClick={() => navigate(`/student/${student.user_id}`)}
                    >
                      {columnVisibility.name && (
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={student.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {student.full_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{labelName(student)}</span>
                          </div>
                        </TableCell>
                      )}
                      {columnVisibility.email && <TableCell className="truncate">{student.email}</TableCell>}
                      {columnVisibility.ageGroup && <TableCell>{ageGroupName(student)}</TableCell>}
                      {columnVisibility.level && <TableCell>{levelName(student)}</TableCell>}
                      {columnVisibility.subscription && (
                        <TableCell><Badge variant="secondary">{subscriptionLabel(student)}</Badge></TableCell>
                      )}
                      {columnVisibility.payment && (
                        <TableCell><Badge variant={ps.variant} className={ps.color}>{ps.label}</Badge></TableCell>
                      )}
                      {columnVisibility.attendance && (
                        <TableCell>
                          <Badge
                            variant={student.attendance_mode === 'online' ? 'default' : 'outline'}
                            className={cn(student.attendance_mode === 'online' && 'bg-blue-500 hover:bg-blue-600')}
                          >
                            {attendanceLabel(student)}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => navigate(`/student/${student.user_id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              {isRTL ? 'عرض الملف' : 'View Profile'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(student)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t.common.edit}
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem
                                onClick={() => onDelete(student)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {isRTL ? 'حذف الطالب' : 'Delete Student'}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            hasNextPage={currentPage < totalPages}
            hasPreviousPage={currentPage > 1}
            onPageChange={onPageChange}
          />
        </CardContent>
      </Card>
    </>
  );
}
