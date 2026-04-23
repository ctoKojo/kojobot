import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Loader2, Globe, Languages, Link2, AlertCircle, CheckCircle2 } from "lucide-react";
import { QuestionBuilder } from "./QuestionBuilder";
import { RESERVED_FIELDS, JobFormField } from "./QuestionLibrary";

type ContentLanguage = "en" | "ar" | "both";

interface JobFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  job: any | null;
  onSaved: () => void;
}

const TYPE_OPTIONS: Array<{ value: string; label_en: string; label_ar: string; isInternship?: boolean }> = [
  { value: "full_time", label_en: "Full Time", label_ar: "دوام كامل" },
  { value: "part_time", label_en: "Part Time", label_ar: "دوام جزئي" },
  { value: "freelance", label_en: "Freelance", label_ar: "عمل حر" },
  { value: "internship", label_en: "Internship / Training", label_ar: "تدريب", isInternship: true },
  { value: "volunteer", label_en: "Volunteer", label_ar: "تطوع" },
];

const SEASON_OPTIONS = [
  { value: "summer", label_en: "Summer Training", label_ar: "تدريب صيفي" },
  { value: "fall", label_en: "Fall Training", label_ar: "تدريب خريفي" },
  { value: "winter", label_en: "Winter Training", label_ar: "تدريب شتوي" },
  { value: "spring", label_en: "Spring Training", label_ar: "تدريب ربيعي" },
];

export function JobFormDialog({ open, onOpenChange, job, onSaved }: JobFormDialogProps) {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>("en");
  const [formFields, setFormFields] = useState<JobFormField[]>(RESERVED_FIELDS);

  const [form, setForm] = useState({
    title_en: "",
    title_ar: "",
    slug: "",
    type: "full_time",
    training_season: "" as string,
    is_paid: true,
    status: "draft",
    location_en: "",
    location_ar: "",
    salary_range: "",
    description_en: "",
    description_ar: "",
    requirements_en: "",
    requirements_ar: "",
    benefits_en: "",
    benefits_ar: "",
    deadline_at: "",
    is_featured: false,
  });

  useEffect(() => {
    if (job) {
      setContentLanguage((job.content_language as ContentLanguage) || "both");
      setForm({
        title_en: job.title_en || "",
        title_ar: job.title_ar || "",
        slug: job.slug || "",
        type: job.type || "full_time",
        training_season: job.training_season || "",
        is_paid: job.is_paid !== false,
        status: job.status || "draft",
        location_en: job.location_en || "",
        location_ar: job.location_ar || "",
        salary_range: job.salary_range || "",
        description_en: job.description_en || "",
        description_ar: job.description_ar || "",
        requirements_en: job.requirements_en || "",
        requirements_ar: job.requirements_ar || "",
        benefits_en: job.benefits_en || "",
        benefits_ar: job.benefits_ar || "",
        deadline_at: job.deadline_at ? job.deadline_at.split("T")[0] : "",
        is_featured: !!job.is_featured,
      });
      // Merge reserved + saved custom fields
      const saved: JobFormField[] = Array.isArray(job.form_fields) ? job.form_fields : [];
      const reservedKeys = RESERVED_FIELDS.map((f) => f.key);
      const customSaved = saved.filter((f) => !reservedKeys.includes(f.key));
      setFormFields([...RESERVED_FIELDS, ...customSaved]);
    } else {
      setContentLanguage(isRTL ? "ar" : "en");
      setForm({
        title_en: "",
        title_ar: "",
        slug: "",
        type: "full_time",
        training_season: "",
        is_paid: true,
        status: "draft",
        location_en: "",
        location_ar: "",
        salary_range: "",
        description_en: "",
        description_ar: "",
        requirements_en: "",
        requirements_ar: "",
        benefits_en: "",
        benefits_ar: "",
        deadline_at: "",
        is_featured: false,
      });
      setFormFields(RESERVED_FIELDS);
    }
  }, [job, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const slugify = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

  const buildJobSlug = (...candidates: Array<string | null | undefined>) => {
    const firstValidSlug = candidates
      .map((candidate) => slugify(candidate || ""))
      .find(Boolean);

    return firstValidSlug || `job-${Date.now()}`;
  };

  // Slug validation: 3-80 chars, lowercase letters/numbers/Arabic, hyphen-separated, no leading/trailing hyphens
  const SLUG_PATTERN = /^[\p{Letter}\p{Number}]+(-[\p{Letter}\p{Number}]+)*$/u;
  const validateSlug = (value: string): { valid: boolean; error: string } => {
    if (!value) return { valid: false, error: isRTL ? "السلاج مطلوب" : "Slug is required" };
    if (value.length < 3) return { valid: false, error: isRTL ? "3 أحرف على الأقل" : "Minimum 3 characters" };
    if (value.length > 80) return { valid: false, error: isRTL ? "80 حرف كحد أقصى" : "Maximum 80 characters" };
    if (!SLUG_PATTERN.test(value)) {
      return {
        valid: false,
        error: isRTL
          ? "حروف وأرقام فقط مفصولة بـ '-' (بدون مسافات أو رموز)"
          : "Letters & numbers only, separated by '-' (no spaces or symbols)",
      };
    }
    return { valid: true, error: "" };
  };

  const slugCheck = validateSlug(form.slug);

  const isInternship = form.type === "internship";

  // Auto-fill slug only if user hasn't typed one yet
  const handleTitle = (lang: "en" | "ar", value: string) => {
    if (contentLanguage === "en") {
      setForm({ ...form, title_en: value, title_ar: value, slug: form.slug || buildJobSlug(value) });
    } else if (contentLanguage === "ar") {
      setForm({ ...form, title_ar: value, title_en: value, slug: form.slug || buildJobSlug(value) });
    } else {
      if (lang === "en") setForm({ ...form, title_en: value, slug: form.slug || buildJobSlug(value, form.title_ar) });
      else setForm({ ...form, title_ar: value, slug: form.slug || buildJobSlug(form.title_en, value) });
    }
  };

  const handleField = (lang: "en" | "ar", field: "description" | "requirements" | "benefits" | "location", value: string) => {
    const enKey = `${field}_en` as keyof typeof form;
    const arKey = `${field}_ar` as keyof typeof form;
    if (contentLanguage === "en") {
      setForm({ ...form, [enKey]: value, [arKey]: value } as typeof form);
    } else if (contentLanguage === "ar") {
      setForm({ ...form, [arKey]: value, [enKey]: value } as typeof form);
    } else {
      setForm({ ...form, [lang === "en" ? enKey : arKey]: value } as typeof form);
    }
  };

  const handleSave = async () => {
    // Title required (in primary language)
    const primaryTitle = contentLanguage === "ar" ? form.title_ar : form.title_en;
    if (!primaryTitle.trim()) {
      toast({ title: isRTL ? "العنوان مطلوب" : "Title required", variant: "destructive" });
      return;
    }
    const primaryDesc = contentLanguage === "ar" ? form.description_ar : form.description_en;
    if (!primaryDesc.trim()) {
      toast({ title: isRTL ? "الوصف مطلوب" : "Description required", variant: "destructive" });
      return;
    }
    if (isInternship && !form.training_season) {
      toast({ title: isRTL ? "اختر فصل التدريب" : "Pick training season", variant: "destructive" });
      return;
    }
    if (!slugCheck.valid) {
      toast({ title: isRTL ? "السلاج غير صحيح" : "Invalid slug", description: slugCheck.error, variant: "destructive" });
      return;
    }

    setSaving(true);
    const slug = form.slug.trim();
    const payload: any = {
      title_en: form.title_en.trim(),
      title_ar: form.title_ar.trim(),
      slug,
      type: form.type,
      training_season: isInternship ? form.training_season : null,
      is_paid: form.is_paid,
      content_language: contentLanguage,
      status: form.status,
      location_en: form.location_en.trim() || null,
      location_ar: form.location_ar.trim() || null,
      salary_range: form.is_paid ? form.salary_range.trim() || null : null,
      description_en: form.description_en.trim(),
      description_ar: form.description_ar.trim(),
      requirements_en: form.requirements_en.trim() || null,
      requirements_ar: form.requirements_ar.trim() || null,
      benefits_en: form.benefits_en.trim() || null,
      benefits_ar: form.benefits_ar.trim() || null,
      deadline_at: form.deadline_at ? new Date(form.deadline_at).toISOString() : null,
      is_featured: form.is_featured,
      form_fields: formFields,
    };
    if (form.status === "published" && !job?.posted_at) {
      payload.posted_at = new Date().toISOString();
    }

    let error;
    if (job) {
      ({ error } = await supabase.from("jobs").update(payload).eq("id", job.id));
    } else {
      payload.created_by = user?.id;
      ({ error } = await supabase.from("jobs").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: isRTL ? "فشل الحفظ" : "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isRTL ? "تم الحفظ" : "Saved" });
      onSaved();
    }
  };

  // Render single-language inputs vs both
  const renderBilingualPair = (
    labelKey: string,
    field: "description" | "requirements" | "benefits" | "location",
    rows: number = 4,
    isInput = false
  ) => {
    const Comp = isInput ? Input : Textarea;
    if (contentLanguage === "en") {
      return (
        <div>
          <Label>{labelKey}</Label>
          <Comp
            {...(isInput ? {} : { rows })}
            value={(form as any)[`${field}_en`]}
            onChange={(e: any) => handleField("en", field, e.target.value)}
          />
        </div>
      );
    }
    if (contentLanguage === "ar") {
      return (
        <div>
          <Label>{labelKey}</Label>
          <Comp
            {...(isInput ? {} : { rows })}
            dir="rtl"
            value={(form as any)[`${field}_ar`]}
            onChange={(e: any) => handleField("ar", field, e.target.value)}
          />
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{labelKey} (EN)</Label>
          <Comp
            {...(isInput ? {} : { rows })}
            value={(form as any)[`${field}_en`]}
            onChange={(e: any) => handleField("en", field, e.target.value)}
          />
        </div>
        <div>
          <Label>{labelKey} (AR)</Label>
          <Comp
            {...(isInput ? {} : { rows })}
            dir="rtl"
            value={(form as any)[`${field}_ar`]}
            onChange={(e: any) => handleField("ar", field, e.target.value)}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? (isRTL ? "تعديل الوظيفة" : "Edit Job") : (isRTL ? "وظيفة جديدة" : "New Job")}</DialogTitle>
        </DialogHeader>

        {/* Content language picker */}
        <Card className="p-3 bg-muted/40">
          <div className="flex items-start gap-3">
            <Languages className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <Label className="text-xs font-medium">
                {isRTL ? "بأي لغة هتكتب الوظيفة؟" : "What language will you write this job in?"}
              </Label>
              <RadioGroup
                value={contentLanguage}
                onValueChange={(v) => setContentLanguage(v as ContentLanguage)}
                className="flex gap-4 mt-2"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="en" />
                  <span className="text-sm">{isRTL ? "إنجليزي فقط" : "English only"}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="ar" />
                  <span className="text-sm">{isRTL ? "عربي فقط" : "Arabic only"}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="both" />
                  <span className="text-sm flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {isRTL ? "اللغتين" : "Both"}
                  </span>
                </label>
              </RadioGroup>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {contentLanguage !== "both"
                  ? isRTL
                    ? "هتكتب مرة واحدة، وهيظهر للجميع بنفس النص."
                    : "You write once, the same text will show for all visitors."
                  : isRTL
                  ? "هتكتب نسختين منفصلتين."
                  : "You'll fill both versions separately."}
              </p>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="basic">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="basic">{isRTL ? "أساسي" : "Basic"}</TabsTrigger>
            <TabsTrigger value="content">{isRTL ? "المحتوى" : "Content"}</TabsTrigger>
            <TabsTrigger value="form">
              {isRTL ? "أسئلة التقديم" : "Application Questions"}
            </TabsTrigger>
          </TabsList>

          {/* BASIC TAB */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            {contentLanguage === "both" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{isRTL ? "العنوان (إنجليزي)" : "Title (English)"}*</Label>
                  <Input value={form.title_en} onChange={(e) => handleTitle("en", e.target.value)} />
                </div>
                <div>
                  <Label>{isRTL ? "العنوان (عربي)" : "Title (Arabic)"}*</Label>
                  <Input dir="rtl" value={form.title_ar} onChange={(e) => handleTitle("ar", e.target.value)} />
                </div>
              </div>
            ) : (
              <div>
                <Label>{isRTL ? "العنوان" : "Job Title"}*</Label>
                <Input
                  dir={contentLanguage === "ar" ? "rtl" : "ltr"}
                  value={contentLanguage === "ar" ? form.title_ar : form.title_en}
                  onChange={(e) => handleTitle(contentLanguage as "en" | "ar", e.target.value)}
                  placeholder={contentLanguage === "ar" ? "مطور Frontend (تدريب صيفي)" : "Frontend Developer (Summer Internship)"}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "نوع الوظيفة" : "Job Type"}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, training_season: v === "internship" ? form.training_season || "summer" : "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {isRTL ? t.label_ar : t.label_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isInternship && (
                <div>
                  <Label>{isRTL ? "فصل التدريب" : "Training Season"}*</Label>
                  <Select value={form.training_season} onValueChange={(v) => setForm({ ...form, training_season: v })}>
                    <SelectTrigger><SelectValue placeholder={isRTL ? "اختر..." : "Pick..."} /></SelectTrigger>
                    <SelectContent>
                      {SEASON_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {isRTL ? s.label_ar : s.label_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Slug — permanent, editable, validated */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  {isRTL ? "رابط الوظيفة (Slug)" : "Job URL Slug"}*
                </Label>
                {form.slug && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, slug: buildJobSlug(form.title_en, form.title_ar) })}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {isRTL ? "توليد من العنوان" : "Generate from title"}
                  </button>
                )}
              </div>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                placeholder={isRTL ? "frontend-trainer-summer" : "frontend-trainer-summer"}
                dir="ltr"
                className={!slugCheck.valid && form.slug ? "border-destructive" : ""}
              />
              <div className="flex items-start gap-1.5 mt-1.5">
                {form.slug && slugCheck.valid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-muted-foreground" dir="ltr">
                      kojobot.com/careers/<span className="font-mono text-foreground">{form.slug}</span>
                    </p>
                  </>
                ) : form.slug ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-destructive">{slugCheck.error}</p>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {isRTL
                      ? "حروف وأرقام فقط (إنجليزي أو عربي) مفصولة بـ '-' — مثال: junior-developer"
                      : "Letters & numbers only, separated by '-' — e.g. junior-developer"}
                  </p>
                )}
              </div>
            </div>


            {/* Paid toggle + salary */}
            <Card className="p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">
                    {isInternship
                      ? isRTL ? "تدريب مدفوع؟" : "Paid Training?"
                      : isRTL ? "وظيفة مدفوعة؟" : "Paid Position?"}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.is_paid
                      ? isRTL ? "هتظهر شارة 'مدفوع' للمتقدمين" : "A 'Paid' badge will show to applicants"
                      : isRTL ? "هتظهر شارة 'غير مدفوع'" : "An 'Unpaid' badge will show"}
                  </p>
                </div>
                <Switch checked={form.is_paid} onCheckedChange={(v) => setForm({ ...form, is_paid: v })} />
              </div>
              {form.is_paid && (
                <div className="mt-3">
                  <Label className="text-xs">{isRTL ? "نطاق الراتب / المكافأة" : "Salary / Stipend Range"}</Label>
                  <Input
                    value={form.salary_range}
                    onChange={(e) => setForm({ ...form, salary_range: e.target.value })}
                    placeholder={isRTL ? "5000-8000 ج.م شهرياً" : "5000-8000 EGP / month"}
                    className="h-9 mt-1"
                  />
                </div>
              )}
            </Card>

            {renderBilingualPair(isRTL ? "الموقع" : "Location", "location", 1, true)}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "آخر يوم تقديم" : "Application Deadline"}</Label>
                <Input type="date" value={form.deadline_at} onChange={(e) => setForm({ ...form, deadline_at: e.target.value })} />
              </div>
              <div>
                <Label>{isRTL ? "الحالة" : "Status"}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{isRTL ? "مسودة" : "Draft"}</SelectItem>
                    <SelectItem value="published">{isRTL ? "منشور" : "Published"}</SelectItem>
                    <SelectItem value="closed">{isRTL ? "مغلق" : "Closed"}</SelectItem>
                    <SelectItem value="archived">{isRTL ? "مؤرشف" : "Archived"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
              <Label>{isRTL ? "وظيفة مميزة (Featured)" : "Featured Position"}</Label>
            </div>
          </TabsContent>

          {/* CONTENT TAB */}
          <TabsContent value="content" className="space-y-4 mt-4">
            {renderBilingualPair(isRTL ? "وصف الوظيفة" : "Job Description", "description", 5)}
            {renderBilingualPair(isRTL ? "المتطلبات" : "Requirements", "requirements", 4)}
            {renderBilingualPair(isRTL ? "المميزات / المزايا" : "Benefits", "benefits", 4)}
          </TabsContent>

          {/* FORM TAB */}
          <TabsContent value="form" className="mt-4">
            <QuestionBuilder
              fields={formFields}
              onChange={setFormFields}
              contentLanguage={contentLanguage}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {isRTL ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {isRTL ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
