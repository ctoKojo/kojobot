import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const SECTIONS = ['section_a', 'section_b', 'section_c'] as const;
const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'needs_revision'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

const SECTION_SKILLS: Record<string, string[]> = {
  section_a: ['computer_basics', 'operating_system', 'files_folders', 'internet_browser', 'cloud_basics', 'digital_safety', 'keyboard_mouse', 'scratch_readiness', 'basic_logic'],
  section_b: ['variables', 'data_types', 'input_output', 'conditions', 'loops', 'functions_basics', 'lists', 'tuples', 'dictionaries', 'problem_solving'],
  section_c: ['algorithmic_thinking', 'code_logic', 'code_tracing', 'problem_solving_sw', 'sensors', 'io_devices', 'circuits_basics', 'iot_thinking', 'physical_systems'],
};

const SECTION_LABELS: Record<string, { en: string; ar: string }> = {
  section_a: { en: 'Section A — Level 0 Gate', ar: 'القسم A — بوابة Level 0' },
  section_b: { en: 'Section B — Level 1 Gate', ar: 'القسم B — بوابة Level 1' },
  section_c: { en: 'Section C — Track Inclination', ar: 'القسم C — ميول المسار' },
};

const REVIEW_LABELS: Record<string, { en: string; ar: string }> = {
  pending: { en: 'Pending', ar: 'قيد المراجعة' },
  approved: { en: 'Approved', ar: 'معتمد' },
  rejected: { en: 'Rejected', ar: 'مرفوض' },
  needs_revision: { en: 'Needs Revision', ar: 'يحتاج تعديل' },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQ: any;
  saving: boolean;
  onSave: () => void;
  onUpdateField: (field: string, value: any) => void;
  onUpdateOption: (key: string, value: string) => void;
  isRTL: boolean;
}

export default function QuestionEditDialog({ open, onOpenChange, editQ, saving, onSave, onUpdateField, onUpdateOption, isRTL }: Props) {
  if (!editQ) return null;

  const currentSection = editQ.section || 'section_a';
  const skills = SECTION_SKILLS[currentSection] || [];
  const isC = currentSection === 'section_c';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editQ?.id ? (isRTL ? 'تعديل سؤال' : 'Edit Question') : (isRTL ? 'سؤال جديد' : 'New Question')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Section, Skill, Difficulty, Track Category */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>{isRTL ? 'القسم' : 'Section'}</Label>
              <Select value={currentSection} onValueChange={v => {
                onUpdateField('section', v);
                // Reset skill and track_category on section change
                const newSkills = SECTION_SKILLS[v] || [];
                onUpdateField('skill', newSkills[0] || '');
                if (v !== 'section_c') onUpdateField('track_category', null);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTIONS.map(s => (
                    <SelectItem key={s} value={s}>{isRTL ? SECTION_LABELS[s].ar : SECTION_LABELS[s].en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? 'المهارة' : 'Skill'}</Label>
              <Select value={editQ.skill || ''} onValueChange={v => onUpdateField('skill', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {skills.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? 'الصعوبة' : 'Difficulty'}</Label>
              <Select value={editQ.difficulty || 'medium'} onValueChange={v => onUpdateField('difficulty', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isC && (
              <div>
                <Label>{isRTL ? 'فئة المسار' : 'Track Category'}</Label>
                <Select value={editQ.track_category || 'software'} onValueChange={v => onUpdateField('track_category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="hardware">Hardware</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Review Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{isRTL ? 'حالة المراجعة' : 'Review Status'}</Label>
              <Select value={editQ.review_status || 'pending'} onValueChange={v => onUpdateField('review_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVIEW_STATUSES.map(r => (
                    <SelectItem key={r} value={r}>{isRTL ? REVIEW_LABELS[r].ar : REVIEW_LABELS[r].en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={editQ.is_active ?? true} onCheckedChange={v => onUpdateField('is_active', v)} />
              <Label>{isRTL ? 'مفعل' : 'Active'}</Label>
            </div>
          </div>

          {/* Question text */}
          <div>
            <Label>{isRTL ? 'نص السؤال (عربي)' : 'Question Text (Arabic)'}</Label>
            <Textarea value={editQ.question_text_ar || ''} rows={3}
              onChange={e => onUpdateField('question_text_ar', e.target.value)} />
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            {['A', 'B', 'C', 'D'].map(key => (
              <div key={key}>
                <Label>{isRTL ? `الإجابة ${key}` : `Option ${key}`}</Label>
                <Input value={(editQ.options as any)?.[key] || ''}
                  onChange={e => onUpdateOption(key, e.target.value)} />
              </div>
            ))}
          </div>

          {/* Correct answer */}
          <div>
            <Label>{isRTL ? 'الإجابة الصحيحة' : 'Correct Answer'}</Label>
            <Select value={editQ.correct_answer || 'A'} onValueChange={v => onUpdateField('correct_answer', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['A', 'B', 'C', 'D'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Explanation */}
          <div>
            <Label>{isRTL ? 'الشرح (عربي)' : 'Explanation (Arabic)'}</Label>
            <Textarea value={editQ.explanation_ar || ''} rows={2}
              onChange={e => onUpdateField('explanation_ar', e.target.value)} />
          </div>

          {/* Code snippet */}
          <div>
            <Label>{isRTL ? 'كود (اختياري)' : 'Code Snippet (optional)'}</Label>
            <Textarea value={editQ.code_snippet || ''} rows={3} className="font-mono text-sm"
              onChange={e => onUpdateField('code_snippet', e.target.value)} />
          </div>

          {/* Image URL */}
          <div>
            <Label>{isRTL ? 'رابط صورة (اختياري)' : 'Image URL (optional)'}</Label>
            <Input value={editQ.image_url || ''}
              onChange={e => onUpdateField('image_url', e.target.value)} />
          </div>

          <Button onClick={onSave} disabled={saving} className="w-full">
            {saving ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
