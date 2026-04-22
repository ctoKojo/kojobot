import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Users, GraduationCap, UserCog, Shield, Briefcase, Sparkles, FolderTree } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EmailTemplateRow } from '@/components/email/TemplateEditorDialog';

interface Props {
  isRTL: boolean;
  templates: EmailTemplateRow[];
  selectedAudience: string;
  onSelectAudience: (a: string) => void;
  selectedCategory: string | null;
  onSelectCategory: (c: string | null) => void;
  categoryCounts: Record<string, number>;
}

const AUDIENCES: { value: string; en: string; ar: string; icon: typeof Users }[] = [
  { value: 'all',        en: 'All',         ar: 'الكل',          icon: Sparkles },
  { value: 'student',    en: 'Students',    ar: 'الطلاب',         icon: GraduationCap },
  { value: 'parent',     en: 'Parents',     ar: 'أولياء الأمور',   icon: Users },
  { value: 'instructor', en: 'Instructors', ar: 'المدربين',       icon: UserCog },
  { value: 'admin',      en: 'Admins',      ar: 'الإدارة',        icon: Shield },
  { value: 'reception',  en: 'Reception',   ar: 'الاستقبال',      icon: Briefcase },
];

export function TemplatesSidebar({
  isRTL,
  templates,
  selectedAudience,
  onSelectAudience,
  selectedCategory,
  onSelectCategory,
  categoryCounts,
}: Props) {
  const [audOpen, setAudOpen] = useState(true);
  const [catOpen, setCatOpen] = useState(true);
  const [search, setSearch] = useState('');

  const audienceCounts = useMemo(() => {
    const map: Record<string, number> = { all: templates.length };
    templates.forEach((t) => {
      const a = (t as any).audience ?? 'student';
      map[a] = (map[a] ?? 0) + 1;
    });
    return map;
  }, [templates]);

  const filteredAudiences = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return AUDIENCES;
    return AUDIENCES.filter((a) =>
      a.en.toLowerCase().includes(q) || a.ar.includes(q),
    );
  }, [search]);

  const categories = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    if (!q) return list;
    return list.filter(([k]) => k.toLowerCase().includes(q));
  }, [categoryCounts, search]);

  return (
    <aside className="w-full md:w-64 shrink-0 border rounded-lg bg-card p-3 space-y-3">
      <div className="relative">
        <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={isRTL ? 'بحث...' : 'Filter...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-7 h-8 text-sm"
        />
      </div>

      {/* Audience group */}
      <div>
        <button
          onClick={() => setAudOpen((o) => !o)}
          className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 hover:text-foreground"
        >
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {isRTL ? 'الجمهور' : 'Audience'}
          </span>
          {audOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {audOpen && (
          <div className="mt-1 space-y-0.5">
            {filteredAudiences.map((a) => {
              const Icon = a.icon;
              const count = audienceCounts[a.value] ?? 0;
              const active = selectedAudience === a.value;
              return (
                <Button
                  key={a.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectAudience(a.value)}
                  className={cn(
                    'w-full justify-between h-8 px-2 font-normal',
                    active && 'bg-accent text-accent-foreground font-medium',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {isRTL ? a.ar : a.en}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Category group */}
      {categories.length > 0 && (
        <div>
          <button
            onClick={() => setCatOpen((o) => !o)}
            className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 hover:text-foreground"
          >
            <span className="flex items-center gap-1">
              <FolderTree className="h-3 w-3" />
              {isRTL ? 'الفئات' : 'Categories'}
            </span>
            {catOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          {catOpen && (
            <div className="mt-1 space-y-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectCategory(null)}
                className={cn(
                  'w-full justify-between h-8 px-2 font-normal',
                  selectedCategory === null && 'bg-accent text-accent-foreground font-medium',
                )}
              >
                <span>{isRTL ? 'كل الفئات' : 'All categories'}</span>
              </Button>
              {categories.map(([cat, count]) => (
                <Button
                  key={cat}
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectCategory(cat)}
                  className={cn(
                    'w-full justify-between h-8 px-2 font-normal',
                    selectedCategory === cat && 'bg-accent text-accent-foreground font-medium',
                  )}
                >
                  <span className="truncate">{cat}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
