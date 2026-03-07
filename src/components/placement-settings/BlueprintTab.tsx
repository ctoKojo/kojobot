import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Blueprint {
  id: string;
  age_group: string;
  level: string;
  skill: string;
  question_count: number;
}

const AGE_GROUPS = ['6_9', '10_13', '14_18'];
const LEVELS = ['foundation', 'intermediate', 'advanced'];
const SKILLS = ['algorithms','conditions','control_flow','data_structures','data_types','debugging','events','functions','lists','logic','loops','oop','patterns','problem_solving','sequences','variables','web_basics'];

const AGE_LABELS: Record<string, string> = { '6_9': 'Kids (6-9)', '10_13': 'Juniors (10-13)', '14_18': 'Teens (14-18)' };

export default function BlueprintTab() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [selectedAge, setSelectedAge] = useState('6_9');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newLevel, setNewLevel] = useState('foundation');
  const [newCount, setNewCount] = useState(1);

  useEffect(() => { fetchBlueprints(); }, [selectedAge]);

  const fetchBlueprints = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('placement_skill_blueprint' as any)
      .select('*')
      .eq('age_group', selectedAge)
      .order('level')
      .order('skill');
    if (data) setBlueprints(data as any);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newSkill) return;
    const { error } = await supabase.from('placement_skill_blueprint' as any).insert({
      age_group: selectedAge, level: newLevel, skill: newSkill, question_count: newCount
    } as any);
    if (error) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isRTL ? 'تمت الإضافة' : 'Added' });
      fetchBlueprints();
      setNewSkill('');
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('placement_skill_blueprint' as any).delete().eq('id', id);
    fetchBlueprints();
  };

  const updateCount = (id: string, count: number) => {
    setBlueprints(prev => prev.map(b => b.id === id ? { ...b, question_count: count } : b));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    for (const b of blueprints) {
      await supabase.from('placement_skill_blueprint' as any)
        .update({ question_count: b.question_count, updated_at: new Date().toISOString() } as any)
        .eq('id', b.id);
    }
    toast({ title: isRTL ? 'تم الحفظ' : 'Saved' });
    setSaving(false);
  };

  // Group by level
  const grouped = LEVELS.reduce((acc, level) => {
    acc[level] = blueprints.filter(b => b.level === level);
    return acc;
  }, {} as Record<string, Blueprint[]>);

  // Calculate totals per level
  const levelTotals = LEVELS.reduce((acc, level) => {
    acc[level] = grouped[level].reduce((sum, b) => sum + b.question_count, 0);
    return acc;
  }, {} as Record<string, number>);

  // Existing skills for filtering available ones
  const usedSkills = new Set(blueprints.map(b => `${b.level}:${b.skill}`));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Label>{isRTL ? 'الفئة العمرية' : 'Age Group'}</Label>
        <Select value={selectedAge} onValueChange={setSelectedAge}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AGE_GROUPS.map(ag => <SelectItem key={ag} value={ag}>{AGE_LABELS[ag]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? <Skeleton className="h-64 w-full" /> : (
        <>
          {LEVELS.map(level => (
            <Card key={level}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base capitalize flex items-center gap-2">
                  {level}
                  <Badge variant="outline">{levelTotals[level]} {isRTL ? 'سؤال' : 'questions'}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {grouped[level].length === 0 ? (
                  <p className="text-muted-foreground text-sm">{isRTL ? 'لا توجد مهارات محددة' : 'No skills defined'}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'المهارة' : 'Skill'}</TableHead>
                        <TableHead>{isRTL ? 'عدد الأسئلة' : 'Question Count'}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grouped[level].map(b => (
                        <TableRow key={b.id}>
                          <TableCell className="capitalize">{b.skill.replace(/_/g, ' ')}</TableCell>
                          <TableCell>
                            <Input type="number" min={0} className="w-20" value={b.question_count}
                              onChange={e => updateCount(b.id, parseInt(e.target.value) || 0)} />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Add new skill */}
          <Card>
            <CardHeader><CardTitle className="text-base">{isRTL ? 'إضافة مهارة' : 'Add Skill'}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <Label>{isRTL ? 'المستوى' : 'Level'}</Label>
                  <Select value={newLevel} onValueChange={setNewLevel}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEVELS.map(l => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isRTL ? 'المهارة' : 'Skill'}</Label>
                  <Select value={newSkill} onValueChange={setNewSkill}>
                    <SelectTrigger className="w-48"><SelectValue placeholder={isRTL ? 'اختر مهارة' : 'Select skill'} /></SelectTrigger>
                    <SelectContent>
                      {SKILLS.filter(s => !usedSkills.has(`${newLevel}:${s}`)).map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isRTL ? 'العدد' : 'Count'}</Label>
                  <Input type="number" min={1} className="w-20" value={newCount}
                    onChange={e => setNewCount(parseInt(e.target.value) || 1)} />
                </div>
                <Button onClick={handleAdd} disabled={!newSkill}>
                  <Plus className="h-4 w-4 me-1" />{isRTL ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveAll} disabled={saving} className="w-full">
            <Save className="h-4 w-4 me-1" />
            {saving ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ الكل' : 'Save All')}
          </Button>
        </>
      )}
    </div>
  );
}
