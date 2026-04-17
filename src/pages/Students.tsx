/**
 * Students.tsx — Page orchestration ONLY (ARCHITECTURE.md §Layer 4: UI).
 *
 * No supabase. No fetching. No business logic.
 * Data flows from `useStudentsList` (hook) → `StudentsTable` (pure UI).
 * Realtime is wired through `subscribeToStudentsList`, never directly.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Users, AlertCircle, TrendingUp, UserPlus } from 'lucide-react';

import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsGrid, type StatItem } from '@/components/shared/StatsGrid';
import { type ColumnDef } from '@/components/shared/TableToolbar';
import { useTableSort } from '@/components/shared/SortableTableHead';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

import { useStudentsList } from '@/features/students';
import {
  StudentsFilters,
  StudentsTable,
  StudentFormDialog,
  DeleteStudentDialog,
  type StudentsTableColumnVisibility,
} from '@/features/students/components';
import type { StudentListItem, StudentsListParams } from '@/features/students/types';
import { subscribeToStudentsList } from '@/services/realtime';

const PAGE_SIZE = 20;

export default function StudentsPage() {
  const { t, isRTL } = useLanguage();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === 'admin' || role === 'reception';

  // ── Local UI state only ──
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingStudent, setEditingStudent] = useState<StudentListItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentListItem | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<StudentsTableColumnVisibility>({
    name: true, email: true, ageGroup: true, level: true,
    subscription: true, payment: true, attendance: true,
  });
  const { sortKey, sortDirection, handleSort } = useTableSort();

  // ── Reset page when search changes ──
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // ── Realtime: invalidate list cache on any profile/subscription change ──
  useEffect(() => subscribeToStudentsList(queryClient), [queryClient]);

  // ── Data fetching via hook (single source) ──
  const params: StudentsListParams = useMemo(() => ({
    filters: { search: searchQuery || undefined },
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    sort_by: (sortKey === 'full_name' || sortKey === 'email') ? sortKey : 'created_at',
    sort_dir: sortDirection ?? 'desc',
  }), [searchQuery, currentPage, sortKey, sortDirection]);

  const { data, isLoading } = useStudentsList(params);
  const rows = data?.items ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Stats (derived from current page; full counts would require a dedicated RPC) ──
  const stats: StatItem[] = [
    { label: isRTL ? 'إجمالي الطلاب' : 'Total Students', value: isLoading ? '...' : totalCount, icon: GraduationCap, gradient: 'from-blue-500 to-blue-600' },
    { label: isRTL ? 'في مجموعات' : 'In Groups', value: isLoading ? '...' : rows.filter(r => r.group_id).length, icon: Users, gradient: 'from-emerald-500 to-emerald-600' },
    { label: isRTL ? 'غير مسكّن' : 'No Group', value: isLoading ? '...' : rows.filter(r => !r.group_id).length, icon: AlertCircle, gradient: 'from-amber-500 to-orange-500' },
    { label: isRTL ? 'اشتراك فعال' : 'Active Subs', value: isLoading ? '...' : rows.filter(r => r.subscription_status === 'active').length, icon: TrendingUp, gradient: 'from-purple-500 to-purple-600' },
  ];

  const columns: ColumnDef[] = [
    { key: 'name', label: isRTL ? 'الاسم' : 'Name', visible: columnVisibility.name },
    { key: 'email', label: isRTL ? 'البريد' : 'Email', visible: columnVisibility.email },
    { key: 'ageGroup', label: isRTL ? 'الفئة العمرية' : 'Age Group', visible: columnVisibility.ageGroup },
    { key: 'level', label: isRTL ? 'المستوى' : 'Level', visible: columnVisibility.level },
    { key: 'subscription', label: isRTL ? 'الاشتراك' : 'Subscription', visible: columnVisibility.subscription },
    { key: 'payment', label: isRTL ? 'الدفع' : 'Payment', visible: columnVisibility.payment },
    { key: 'attendance', label: isRTL ? 'الحضور' : 'Attendance', visible: columnVisibility.attendance },
  ];

  return (
    <DashboardLayout title={t.students.title}>
      <div className="space-y-6">
        <PageHeader
          title={t.students.title}
          subtitle={isRTL ? 'إدارة الطلاب والاشتراكات' : 'Manage students and subscriptions'}
          icon={GraduationCap}
          gradient="from-blue-500 to-blue-600"
          actions={
            <Button className="kojo-gradient shadow-md" onClick={() => { setEditingStudent(null); setIsDialogOpen(true); }}>
              <UserPlus className="h-4 w-4 me-2" />
              {t.students.addStudent}
            </Button>
          }
        />

        <StatsGrid stats={stats} />

        <StudentsFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          columns={columns}
          onColumnToggle={(key) => setColumnVisibility((p) => ({ ...p, [key]: !p[key as keyof StudentsTableColumnVisibility] }))}
        />

        <StudentsTable
          rows={rows}
          loading={isLoading}
          isAdmin={isAdmin}
          columnVisibility={columnVisibility}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
          onEdit={(s) => { setEditingStudent(s); setIsDialogOpen(true); }}
          onDelete={setDeleteTarget}
        />

        <StudentFormDialog
          open={isDialogOpen}
          onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingStudent(null); }}
          editingStudent={editingStudent}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['students', 'list'] })}
        />

        <DeleteStudentDialog
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => queryClient.invalidateQueries({ queryKey: ['students', 'list'] })}
        />
      </div>
    </DashboardLayout>
  );
}
