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
import { Eye, Code, Plus, Mail, Send } from 'lucide-react';

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
  created_at: string;
  updated_at: string;
}

interface CatalogEvent {
  event_key: string;
  display_name_en: string;
  display_name_ar: string;
  available_variables: { key: string; label_en: string; label_ar: string }[];
  supported_audiences?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplateRow | null;
  onSaved: () => void;
}

const AUDIENCE_OPTIONS: { value: string; en: string; ar: string }[] = [
  { value: 'student',    en: 'Students',    ar: 'الطلاب' },
  { value: 'parent',     en: 'Parents',     ar: 'أولياء الأمور' },
  { value: 'instructor', en: 'Instructors', ar: 'المدربين' },
  { value: 'admin',      en: 'Admins',      ar: 'الإدارة' },
  { value: 'reception',  en: 'Reception',   ar: 'الاستقبال' },
];

const DEFAULT_HTML_EN = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a;">Hello {{recipientName}},</h2>
  <p style="color: #444; line-height: 1.6;">
    Your message here...
  </p>
  <p style="color: #888; font-size: 12px; margin-top: 32px;">
    Kojobot Academy
  </p>
</div>`;

const DEFAULT_HTML_AR = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;" dir="rtl">
  <h2 style="color: #1a1a1a;">مرحباً {{recipientName}}،</h2>
  <p style="color: #444; line-height: 1.6;">
    اكتب رسالتك هنا...
  </p>
  <p style="color: #888; font-size: 12px; margin-top: 32px;">
    أكاديمية كوجوبوت
  </p>
</div>`;

const DEFAULT_TELEGRAM_EN = `Hello {{recipientName}},

Your short message here.

— Kojobot Academy`;

const DEFAULT_TELEGRAM_AR = `مرحباً {{recipientName}}،

اكتب رسالتك المختصرة هنا.

— أكاديمية كوجوبوت`;

export function TemplateEditorDialog({ open, onOpenChange, template, onSaved }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [activeChannel, setActiveChannel] = useState<'email' | 'telegram'>('email');
  const [activeLang, setActiveLang] = useState<'en' | 'ar'>('en');
  const [previewMode, setPreviewMode] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEvent[]>([]);
  const [previewEvent, setPreviewEvent] = useState<string>('');

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
  const [bodyTgEn, setBodyTgEn] = useState(DEFAULT_TELEGRAM_EN);
  const [bodyTgAr, setBodyTgAr] = useState(DEFAULT_TELEGRAM_AR);

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
        setBodyTgEn(template.body_telegram_md_en ?? DEFAULT_TELEGRAM_EN);
        setBodyTgAr(template.body_telegram_md_ar ?? DEFAULT_TELEGRAM_AR);
      } else {
        setName('');
        setDescription('');
        setAudience('student');
        setSubjectEn('');
        setSubjectAr('');
        setBodyEn(DEFAULT_HTML_EN);
        setBodyAr(DEFAULT_HTML_AR);
        setSubjectTgEn('');
        setSubjectTgAr('');
        setBodyTgEn(DEFAULT_TELEGRAM_EN);
        setBodyTgAr(DEFAULT_TELEGRAM_AR);
      }
      setActiveLang('en');
      setActiveChannel('email');
      setPreviewMode(false);
    }
  }, [open, template]);

  const loadCatalog = async () => {
    const { data } = await supabase
      .from('email_event_catalog')
      .select('event_key, display_name_en, display_name_ar, available_variables, supported_audiences')
      .eq('is_active', true)
      .order('event_key');
    setCatalog((data ?? []) as CatalogEvent[]);
    if (!previewEvent && data && data.length) setPreviewEvent(data[0].event_key);
  };

  // Filter catalog by selected audience for variable hints
  const audienceCatalog = useMemo(
    () => catalog.filter((c) => !c.supported_audiences || c.supported_audiences.includes(audience)),
    [catalog, audience],
  );

  const currentVariables = useMemo(() => {
    if (!previewEvent) return [];
    const ev = catalog.find((c) => c.event_key === previewEvent);
    return ev?.available_variables ?? [];
  }, [catalog, previewEvent]);

  const sampleData = useMemo(() => {
    const data: Record<string, string> = {};
    currentVariables.forEach((v) => {
      data[v.key] = isRTL ? `[${v.label_ar}]` : `[${v.label_en}]`;
    });
    return data;
  }, [currentVariables, isRTL]);

  const renderPreview = (tpl: string): string =>
    tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => sampleData[key] ?? `{{${key}}}`);

  const insertVariable = (key: string) => {
    const placeholder = `{{${key}}}`;
    if (activeChannel === 'email') {
      if (activeLang === 'en') setBodyEn((v) => v + placeholder);
      else setBodyAr((v) => v + placeholder);
    } else {
      if (activeLang === 'en') setBodyTgEn((v) => v + placeholder);
      else setBodyTgAr((v) => v + placeholder);
    }
  };

  const insertIntoSubject = (key: string) => {
    const placeholder = `{{${key}}}`;
    if (activeChannel === 'email') {
      if (activeLang === 'en') setSubjectEn((v) => v + placeholder);
      else setSubjectAr((v) => v + placeholder);
    } else {
      if (activeLang === 'en') setSubjectTgEn((v) => v + placeholder);
      else setSubjectTgAr((v) => v + placeholder);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !subjectEn.trim() || !subjectAr.trim() || !bodyEn.trim() || !bodyAr.trim()) {
      toast({
        title: isRTL ? 'بيانات ناقصة' : 'Missing fields',
        description: isRTL ? 'الاسم والموضوع والمحتوى بلغتين مطلوبة' : 'Name, subject, and body in both languages are required',
        variant: 'destructive',
      });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template
              ? isRTL ? 'تعديل قالب' : 'Edit template'
              : isRTL ? 'قالب جديد' : 'New template'}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? 'استخدم {{variableName}} لإدراج بيانات ديناميكية. اختر فئة المستلم وحدّث المحتوى للإيميل والتيليجرام.'
              : 'Use {{variableName}} to insert dynamic data. Pick the audience and edit content for email and Telegram.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: form */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{isRTL ? 'اسم القالب' : 'Template name'}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isRTL ? 'مثال: تذكير قسط' : 'e.g. Payment reminder'}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'فئة المستلم' : 'Audience'}</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {isRTL ? a.ar : a.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'الوصف (اختياري)' : 'Description (optional)'}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isRTL ? 'شرح مختصر' : 'Brief description'}
              />
            </div>

            <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as 'email' | 'telegram')}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="email"><Mail className="h-3.5 w-3.5 me-1" /> {isRTL ? 'إيميل' : 'Email'}</TabsTrigger>
                <TabsTrigger value="telegram"><Send className="h-3.5 w-3.5 me-1" /> Telegram</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-3 mt-3">
                <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as 'en' | 'ar')}>
                  <div className="flex items-center justify-between gap-2">
                    <TabsList>
                      <TabsTrigger value="en">English</TabsTrigger>
                      <TabsTrigger value="ar">عربي</TabsTrigger>
                    </TabsList>
                    <Button variant="outline" size="sm" onClick={() => setPreviewMode((p) => !p)}>
                      {previewMode ? (
                        <><Code className="h-4 w-4 me-1" /> {isRTL ? 'كود' : 'Source'}</>
                      ) : (
                        <><Eye className="h-4 w-4 me-1" /> {isRTL ? 'معاينة' : 'Preview'}</>
                      )}
                    </Button>
                  </div>

                  <TabsContent value="en" className="space-y-3 mt-3">
                    <div className="space-y-2">
                      <Label>Subject (English)</Label>
                      <Input value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label>Body HTML (English)</Label>
                      {previewMode ? (
                        <Card className="p-4 min-h-[300px] bg-background">
                          <div dangerouslySetInnerHTML={{ __html: renderPreview(bodyEn) }} />
                        </Card>
                      ) : (
                        <Textarea
                          value={bodyEn}
                          onChange={(e) => setBodyEn(e.target.value)}
                          className="font-mono text-xs min-h-[300px]"
                          dir="ltr"
                        />
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="ar" className="space-y-3 mt-3">
                    <div className="space-y-2">
                      <Label>الموضوع (عربي)</Label>
                      <Input value={subjectAr} onChange={(e) => setSubjectAr(e.target.value)} dir="rtl" />
                    </div>
                    <div className="space-y-2">
                      <Label>محتوى HTML (عربي)</Label>
                      {previewMode ? (
                        <Card className="p-4 min-h-[300px] bg-background">
                          <div dangerouslySetInnerHTML={{ __html: renderPreview(bodyAr) }} />
                        </Card>
                      ) : (
                        <Textarea
                          value={bodyAr}
                          onChange={(e) => setBodyAr(e.target.value)}
                          className="font-mono text-xs min-h-[300px]"
                          dir="ltr"
                        />
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="telegram" className="space-y-3 mt-3">
                <div className="text-xs text-muted-foreground">
                  {isRTL
                    ? 'النص ده يبعت على تيليجرام. لو فاضي يستخدم نسخة مبسطة من نص الإيميل.'
                    : 'This goes to Telegram. If empty, a stripped-down version of the email body is used.'}
                </div>
                <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as 'en' | 'ar')}>
                  <TabsList>
                    <TabsTrigger value="en">English</TabsTrigger>
                    <TabsTrigger value="ar">عربي</TabsTrigger>
                  </TabsList>

                  <TabsContent value="en" className="space-y-3 mt-3">
                    <div className="space-y-2">
                      <Label>{isRTL ? 'العنوان (Telegram, اختياري)' : 'Title (Telegram, optional)'}</Label>
                      <Input
                        value={subjectTgEn}
                        onChange={(e) => setSubjectTgEn(e.target.value)}
                        dir="ltr"
                        placeholder={isRTL ? 'يبقى أول سطر بـ bold' : 'Becomes the bold first line'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Body (English, plain text / markdown)</Label>
                      <Textarea
                        value={bodyTgEn}
                        onChange={(e) => setBodyTgEn(e.target.value)}
                        className="font-mono text-xs min-h-[200px]"
                        dir="ltr"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="ar" className="space-y-3 mt-3">
                    <div className="space-y-2">
                      <Label>{isRTL ? 'العنوان (تيليجرام، اختياري)' : 'Title (Telegram, optional)'}</Label>
                      <Input
                        value={subjectTgAr}
                        onChange={(e) => setSubjectTgAr(e.target.value)}
                        dir="rtl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRTL ? 'النص (عربي)' : 'Body (Arabic)'}</Label>
                      <Textarea
                        value={bodyTgAr}
                        onChange={(e) => setBodyTgAr(e.target.value)}
                        className="font-mono text-xs min-h-[200px]"
                        dir="rtl"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: variables panel */}
          <div className="space-y-3">
            <Card className="p-3 space-y-3">
              <div>
                <Label className="text-xs">{isRTL ? 'معاينة لحدث' : 'Preview for event'}</Label>
                <Select value={previewEvent} onValueChange={setPreviewEvent}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={isRTL ? 'اختر حدث' : 'Pick event'} />
                  </SelectTrigger>
                  <SelectContent>
                    {audienceCatalog.map((c) => (
                      <SelectItem key={c.event_key} value={c.event_key}>
                        {isRTL ? c.display_name_ar : c.display_name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">
                  {isRTL ? 'اضغط لإدراج في المحتوى' : 'Click to insert into body'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentVariables.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {isRTL ? 'لا توجد متغيرات' : 'No variables'}
                    </span>
                  ) : (
                    currentVariables.map((v) => (
                      <Badge
                        key={v.key}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                        onClick={() => insertVariable(v.key)}
                      >
                        <Plus className="h-3 w-3 me-1" />
                        {`{{${v.key}}}`}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              {currentVariables.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {isRTL ? 'إدراج في الموضوع:' : 'Insert into subject:'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {currentVariables.slice(0, 4).map((v) => (
                      <Badge
                        key={v.key}
                        variant="outline"
                        className="cursor-pointer text-xs"
                        onClick={() => insertIntoSubject(v.key)}
                      >
                        {v.key}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-3 text-xs text-muted-foreground space-y-1">
              <div className="font-medium text-foreground">
                {isRTL ? '💡 نصائح' : '💡 Tips'}
              </div>
              <div>
                {isRTL
                  ? '• المتغيرات بصيغة {{variableName}} يستبدلها النظام عند الإرسال'
                  : '• Variables like {{variableName}} are replaced when sending'}
              </div>
              <div>
                {isRTL
                  ? '• خلي نص التيليجرام مختصر — الإيميل يقدر يكون مفصل'
                  : '• Keep Telegram body short — email can be detailed'}
              </div>
              <div>
                {isRTL
                  ? '• فئة المستلم بتفلتر القوالب في صفحة ربط الأحداث'
                  : '• Audience filters templates in the Event Mappings tab'}
              </div>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? isRTL ? 'جارٍ الحفظ...' : 'Saving...'
              : isRTL ? 'حفظ' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
