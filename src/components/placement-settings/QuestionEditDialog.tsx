import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const AGE_GROUPS = ['6_9', '10_13', '14_18'];
const LEVELS = ['foundation', 'intermediate', 'advanced'];
const SKILLS = [
  'algorithmic_thinking', 'conditions', 'control_flow', 'data_structures',
  'data_types', 'debugging', 'debugging_basic', 'events', 'functions',
  'lists', 'logic', 'loops', 'oop', 'patterns', 'problem_solving',
  'sequence', 'variables', 'web_basics',
];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editQ?.id ? (isRTL ? 'تعديل سؤال' : 'Edit Question') : (isRTL ? 'سؤال جديد' : 'New Question')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>{isRTL ? 'الفئة' : 'Age Group'}</Label>
              <Select value={editQ.age_group} onValueChange={v => onUpdateField('age_group', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AGE_GROUPS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? 'المستوى' : 'Level'}</Label>
              <Select value={editQ.level} onValueChange={v => onUpdateField('level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? 'المهارة' : 'Skill'}</Label>
              <Select value={editQ.skill} onValueChange={v => onUpdateField('skill', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SKILLS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? 'الصعوبة' : 'Difficulty'}</Label>
              <Select value={editQ.difficulty} onValueChange={v => onUpdateField('difficulty', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>{isRTL ? 'نص السؤال (عربي)' : 'Question Text (Arabic)'}</Label>
            <Textarea value={editQ.question_text_ar || ''} rows={3}
              onChange={e => onUpdateField('question_text_ar', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {['A', 'B', 'C', 'D'].map(key => (
              <div key={key}>
                <Label>{isRTL ? `الإجابة ${key}` : `Option ${key}`}</Label>
                <Input value={(editQ.options as any)?.[key] || ''}
                  onChange={e => onUpdateOption(key, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{isRTL ? 'الإجابة الصحيحة' : 'Correct Answer'}</Label>
              <Select value={editQ.correct_answer} onValueChange={v => onUpdateField('correct_answer', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['A', 'B', 'C', 'D'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={editQ.is_active ?? true} onCheckedChange={v => onUpdateField('is_active', v)} />
              <Label>{isRTL ? 'مفعل' : 'Active'}</Label>
            </div>
          </div>

          <div>
            <Label>{isRTL ? 'الشرح (عربي)' : 'Explanation (Arabic)'}</Label>
            <Textarea value={editQ.explanation_ar || ''} rows={2}
              onChange={e => onUpdateField('explanation_ar', e.target.value)} />
          </div>

          <div>
            <Label>{isRTL ? 'كود (اختياري)' : 'Code Snippet (optional)'}</Label>
            <Textarea value={editQ.code_snippet || ''} rows={3} className="font-mono text-sm"
              onChange={e => onUpdateField('code_snippet', e.target.value)} />
          </div>

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
