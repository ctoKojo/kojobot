import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Mail, Send, History as HistoryIcon, Activity, Link2, FlaskConical, Loader2 } from 'lucide-react';
import { TemplatePreviewPanel } from './TemplatePreviewPanel';
import { TemplateValidationBanner } from './TemplateValidationBanner';
import { TemplateVersionsTab } from './TemplateVersionsTab';
import { TemplateHistoryTab } from './TemplateHistoryTab';
import { TemplateLinkedEventsTab } from './TemplateLinkedEventsTab';
import { SendTestDialog } from './SendTestDialog';
import { useTemplatePermissions } from '@/hooks/useTemplatePermissions';
import { validateTemplate, type CatalogEvent } from '@/lib/templateValidation';

export interface EmailTemplateRow {
  id: string;
  name: string;
  description: string | null;
  subject_en: string;
  subject_ar: string;
  body_html_en: string;
  body_html_ar: string;
  is_active: boolean;
  audience?: string;
  subject_telegram_en?: string | null;
  subject_telegram_ar?: string | null;
  body_telegram_md_en?: string | null;
  body_telegram_md_ar?: string | null;
  validation_status?: any;
  last_test_at?: string | null;
  last_test_status?: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplateRow | null;
  onSaved: () => void;
}

const AUDIENCE_OPTIONS = [
  { value: 'student',    en: 'Students',    ar: 'الطلاب' },
  { value: 'parent',     en: 'Parents',     ar: 'أولياء الأمور' },
  { value: 'instructor', en: 'Instructors', ar: 'المدربين' },
  { value: 'admin',      en: 'Admins',      ar: 'الإدارة' },
  { value: 'reception',  en: 'Reception',   ar: 'الاستقبال' },
];

const DEFAULT_HTML_EN = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2>Hello {{recipientName}},</h2>
  <p>Your message here...</p>
</div>`;
const DEFAULT_HTML_AR = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;" dir="rtl">
  <h2>مرحباً {{recipientName}}،</h2>
  <p>اكتب رسالتك هنا...</p>
</div>`;
const DEFAULT_TG_EN = `Hello {{recipientName}},\n\nYour short message here.`;
const DEFAULT_TG_AR = `مرحباً {{recipientName}}،\n\nاكتب رسالتك المختصرة هنا.`;

export function TemplateEditorDialog({ open, onOpenChange, template, onSaved }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { permissions } = useTemplatePermissions();

  const [saving, setSaving] = useState(false);
  const [topTab, setTopTab] = useState<'editor' | 'linked' | 'history' | 'versions'>('editor');
  const [activeChannel, setActiveChannel] = useState<'email' | 'telegram'>('email');
  const [activeLang, setActiveLang] = useState<'en' | 'ar'>('en');
  const [catalog, setCatalog] = useState<CatalogEvent[]>([]);
  const [previewEvent, setPreviewEvent] = useState<string>('');
  const [testOpen, setTestOpen] = useState(false);

  // form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<string>('student');
  const [subjectEn, setSubjectEn] = useState('');
  const [subjectAr, setSubjectAr] = useState('');
  const [bodyEn, setBodyEn] = useState(DEFAULT_HTML_EN);
  const [bodyAr, setBodyAr] = useState(DEFAULT_HTML_AR);
  const [subjectTgEn, setSubjectTgEn] = useState('');
  const [subjectTgAr, setSubjectTgAr] = useState('');
  const [bodyTgEn, setBodyTgEn] = useState(DEFAULT_TG_EN);
  const [bodyTgAr, setBodyTgAr] = useState(DEFAULT_TG_AR);

  const readOnly = !permissions.canEdit;

  useEffect(() => {
    if (open) {
      void loadCatalog();
      if (template) {
        setName(template.name);
        setDescription(template.description ?? '');
        setAudience(template.audience ?? 'student');
        setSubjectEn(template.subject_en);
        setSubjectAr(template.subject_ar);
        setBodyEn(template.body_html_en);
        setBodyAr(template.body_html_ar);
        setSubjectTgEn(template.subject_telegram_en ?? '');
        setSubjectTgAr(template.subject_telegram_ar ?? '');
        setBodyTgEn(template.body_telegram_md_en ?? DEFAULT_TG_EN);
        setBodyTgAr(template.body_telegram_md_ar ?? DEFAULT_TG_AR);
      } else {
        setName(''); setDescription(''); setAudience('student');
        setSubjectEn(''); setSubjectAr('');
        setBodyEn(DEFAULT_HTML_EN); setBodyAr(DEFAULT_HTML_AR);
        setSubjectTgEn(''); setSubjectTgAr('');
        setBodyTgEn(DEFAULT_TG_EN); setBodyTgAr(DEFAULT_TG_AR);
      }
      setActiveLang('en'); setActiveChannel('email'); setTopTab('editor');
    }
  }, [open, template]);

  const loadCatalog = async () => {
    const { data } = await supabase
      .from('email_event_catalog')
      .select('event_key, display_name_en, display_name_ar, available_variables, preview_data, supported_audiences')
      .eq('is_active', true)
      .order('event_key');
    const list = (data ?? []) as unknown as CatalogEvent[];
    setCatalog(list);
    if (!previewEvent && list.length) setPreviewEvent(list[0].event_key);
  };

  // events relevant to this template (linked OR same audience)
  const relevantEvents = useMemo(() => {
    return catalog.filter((c) => !c.supported_audiences || c.supported_audiences.includes(audience));
  }, [catalog, audience]);

  const validation = useMemo(
    () => validateTemplate(
      {
        subject_en: subjectEn, subject_ar: subjectAr,
        body_html_en: bodyEn, body_html_ar: bodyAr,
        subject_telegram_en: subjectTgEn, subject_telegram_ar: subjectTgAr,
        body_telegram_md_en: bodyTgEn, body_telegram_md_ar: bodyTgAr,
      },
      relevantEvents,
    ),
    [subjectEn, subjectAr, bodyEn, bodyAr, subjectTgEn, subjectTgAr, bodyTgEn, bodyTgAr, relevantEvents],
  );

  const insertVariable = (key: string) => {
    const ph = `{{${key}}}`;
    if (activeChannel === 'email') {
      if (activeLang === 'en') setBodyEn((v) => v + ph);
      else setBodyAr((v) => v + ph);
    } else {
      if (activeLang === 'en') setBodyTgEn((v) => v + ph);
      else setBodyTgAr((v) => v + ph);
    }
  };

  const currentPreviewSubject =
    activeChannel === 'email'
      ? activeLang === 'en' ? subjectEn : subjectAr
      : activeLang === 'en' ? subjectTgEn : subjectTgAr;
  const currentPreviewBody =
    activeChannel === 'email'
      ? activeLang === 'en' ? bodyEn : bodyAr
      : activeLang === 'en' ? bodyTgEn : bodyTgAr;
  const currentVariables = useMemo(() => {
    const ev = catalog.find((c) => c.event_key === previewEvent);
    return ev?.available_variables ?? [];
  }, [catalog, previewEvent]);

  const handleSave = async () => {
    if (!validation.isValid) {
      toast({ title: isRTL ? 'فيه أخطاء' : 'Validation errors', description: isRTL ? 'صلح الأخطاء قبل الحفظ' : 'Fix errors before saving', variant: 'destructive' });
      return;
    }
    if (!name.trim()) {
      toast({ title: isRTL ? 'الاسم مطلوب' : 'Name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      audience,
      subject_en: subjectEn,
      subject_ar: subjectAr,
      body_html_en: bodyEn,
      body_html_ar: bodyAr,
      subject_telegram_en: subjectTgEn.trim() || null,
      subject_telegram_ar: subjectTgAr.trim() || null,
      body_telegram_md_en: bodyTgEn.trim() || null,
      body_telegram_md_ar: bodyTgAr.trim() || null,
      validation_status: {
        errors: validation.errors.length,
        warnings: validation.warnings.length,
        used_variables: validation.usedVariables,
        unknown_variables: validation.unknownVariables,
        validated_at: new Date().toISOString(),
      },
    };
    const { error } = template
      ? await supabase.from('email_templates').update(payload).eq('id', template.id)
      : await supabase.from('email_templates').insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: isRTL ? 'فشل الحفظ' : 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: isRTL ? 'تم الحفظ' : 'Saved' });
    onSaved();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>
                  {template ? (isRTL ? 'تعديل قالب' : 'Edit template') : (isRTL ? 'قالب جديد' : 'New template')}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {isRTL ? 'استخدم {{variableName}} لإدراج بيانات ديناميكية. كل save يعمل نسخة جديدة.' : 'Use {{variableName}} for dynamic data. Each save creates a new version.'}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {readOnly && <Badge variant="outline">{isRTL ? 'قراءة فقط' : 'Read only'}</Badge>}
                {template && permissions.canSendTest && (
                  <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
                    <FlaskConical className="h-4 w-4 me-1" />
                    {isRTL ? 'اختبار' : 'Test'}
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs value={topTab} onValueChange={(v) => setTopTab(v as any)}>
            <TabsList>
              <TabsTrigger value="editor"><Mail className="h-3.5 w-3.5 me-1" />{isRTL ? 'المحرر' : 'Editor'}</TabsTrigger>
              {template && (
                <>
                  <TabsTrigger value="linked"><Link2 className="h-3.5 w-3.5 me-1" />{isRTL ? 'الأحداث' : 'Linked'}</TabsTrigger>
                  <TabsTrigger value="versions"><HistoryIcon className="h-3.5 w-3.5 me-1" />{isRTL ? 'النسخ' : 'Versions'}</TabsTrigger>
                  <TabsTrigger value="history"><Activity className="h-3.5 w-3.5 me-1" />{isRTL ? 'السجل' : 'History'}</TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="editor" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{isRTL ? 'اسم القالب' : 'Template name'}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'فئة المستلم' : 'Audience'}</Label>
                  <Select value={audience} onValueChange={setAudience} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_OPTIONS.map((a) => (
                        <SelectItem key={a.value} value={a.value}>{isRTL ? a.ar : a.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'الوصف (اختياري)' : 'Description (optional)'}</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} />
              </div>

              <TemplateValidationBanner validation={validation} isRTL={isRTL} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Editor */}
                <div className="space-y-3">
                  <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as any)}>
                    <TabsList className="grid grid-cols-2 w-full">
                      <TabsTrigger value="email"><Mail className="h-3.5 w-3.5 me-1" /> {isRTL ? 'إيميل' : 'Email'}</TabsTrigger>
                      <TabsTrigger value="telegram"><Send className="h-3.5 w-3.5 me-1" /> Telegram</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as any)}>
                    <TabsList>
                      <TabsTrigger value="en">EN</TabsTrigger>
                      <TabsTrigger value="ar">عربي</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {activeChannel === 'email' ? (
                    <>
                      <div className="space-y-2">
                        <Label>{isRTL ? 'الموضوع' : 'Subject'}</Label>
                        <Input
                          value={activeLang === 'en' ? subjectEn : subjectAr}
                          onChange={(e) => activeLang === 'en' ? setSubjectEn(e.target.value) : setSubjectAr(e.target.value)}
                          dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
                          disabled={readOnly}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{isRTL ? 'محتوى HTML' : 'Body HTML'}</Label>
                        <Textarea
                          value={activeLang === 'en' ? bodyEn : bodyAr}
                          onChange={(e) => activeLang === 'en' ? setBodyEn(e.target.value) : setBodyAr(e.target.value)}
                          className="font-mono text-xs min-h-[320px]"
                          dir="ltr"
                          disabled={readOnly}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>{isRTL ? 'العنوان (اختياري)' : 'Title (optional)'}</Label>
                        <Input
                          value={activeLang === 'en' ? subjectTgEn : subjectTgAr}
                          onChange={(e) => activeLang === 'en' ? setSubjectTgEn(e.target.value) : setSubjectTgAr(e.target.value)}
                          dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
                          disabled={readOnly}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{isRTL ? 'النص (Markdown)' : 'Body (Markdown)'}</Label>
                        <Textarea
                          value={activeLang === 'en' ? bodyTgEn : bodyTgAr}
                          onChange={(e) => activeLang === 'en' ? setBodyTgEn(e.target.value) : setBodyTgAr(e.target.value)}
                          className="font-mono text-xs min-h-[260px]"
                          dir={activeLang === 'ar' ? 'rtl' : 'ltr'}
                          disabled={readOnly}
                        />
                      </div>
                    </>
                  )}

                  <Card className="p-3">
                    <Label className="text-xs">{isRTL ? 'متغيرات متاحة' : 'Available variables'}</Label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {currentVariables.length === 0 && (
                        <span className="text-xs text-muted-foreground">{isRTL ? 'اختر حدث للمعاينة' : 'Pick a preview event'}</span>
                      )}
                      {currentVariables.map((v) => (
                        <Button
                          key={v.key}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => insertVariable(v.key)}
                          disabled={readOnly}
                          type="button"
                        >
                          {`{{${v.key}}}`}
                        </Button>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* Preview */}
                <TemplatePreviewPanel
                  isRTL={isRTL}
                  channel={activeChannel}
                  lang={activeLang}
                  subject={currentPreviewSubject}
                  body={currentPreviewBody}
                  events={catalog}
                  selectedEventKey={previewEvent}
                  onEventChange={setPreviewEvent}
                />
              </div>
            </TabsContent>

            {template && (
              <>
                <TabsContent value="linked"><TemplateLinkedEventsTab templateId={template.id} /></TabsContent>
                <TabsContent value="versions"><TemplateVersionsTab templateId={template.id} onRestored={onSaved} /></TabsContent>
                <TabsContent value="history"><TemplateHistoryTab templateId={template.id} /></TabsContent>
              </>
            )}
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            {!readOnly && topTab === 'editor' && (
              <Button onClick={handleSave} disabled={saving || !validation.isValid}>
                {saving && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
                {isRTL ? 'حفظ' : 'Save'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {template && (
        <SendTestDialog open={testOpen} onOpenChange={setTestOpen} template={template} />
      )}
    </>
  );
}
