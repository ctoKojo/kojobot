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
import { Loader2, AlertCircle } from "lucide-react";

const DEFAULT_FORM_FIELDS = [
  { key: "full_name", type: "short_text", label_en: "Full Name", label_ar: "الاسم الكامل", required: true },
  { key: "email", type: "email", label_en: "Email", label_ar: "البريد الإلكتروني", required: true },
  { key: "phone", type: "phone", label_en: "Phone", label_ar: "رقم الهاتف", required: true },
  { key: "cv", type: "file_upload", label_en: "CV / Resume", label_ar: "السيرة الذاتية", required: true, accept: ".pdf,.doc,.docx" },
  { key: "motivation", type: "long_text", label_en: "Why do you want to join us?", label_ar: "لماذا ترغب في الانضمام إلينا؟", required: true },
];

interface JobFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  job: any | null;
  onSaved: () => void;
}

export function JobFormDialog({ open, onOpenChange, job, onSaved }: JobFormDialogProps) {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formFieldsText, setFormFieldsText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title_en: "", title_ar: "", slug: "",
    type: "full_time", status: "draft",
    location_en: "", location_ar: "",
    salary_range: "",
    description_en: "", description_ar: "",
    requirements_en: "", requirements_ar: "",
    benefits_en: "", benefits_ar: "",
    deadline_at: "",
    is_featured: false,
  });

  useEffect(() => {
    if (job) {
      setForm({
        title_en: job.title_en || "", title_ar: job.title_ar || "",
        slug: job.slug || "",
        type: job.type || "full_time",
        status: job.status || "draft",
        location_en: job.location_en || "", location_ar: job.location_ar || "",
        salary_range: job.salary_range || "",
        description_en: job.description_en || "", description_ar: job.description_ar || "",
        requirements_en: job.requirements_en || "", requirements_ar: job.requirements_ar || "",
        benefits_en: job.benefits_en || "", benefits_ar: job.benefits_ar || "",
        deadline_at: job.deadline_at ? job.deadline_at.split("T")[0] : "",
        is_featured: !!job.is_featured,
      });
      setFormFieldsText(JSON.stringify(job.form_fields || DEFAULT_FORM_FIELDS, null, 2));
    } else {
      setForm({
        title_en: "", title_ar: "", slug: "",
        type: "full_time", status: "draft",
        location_en: "", location_ar: "", salary_range: "",
        description_en: "", description_ar: "",
        requirements_en: "", requirements_ar: "",
        benefits_en: "", benefits_ar: "",
        deadline_at: "",
        is_featured: false,
      });
      setFormFieldsText(JSON.stringify(DEFAULT_FORM_FIELDS, null, 2));
    }
    setJsonError(null);
  }, [job, open]);

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

  const handleSave = async () => {
    if (!form.title_en.trim() || !form.title_ar.trim()) {
      toast({ title: isRTL ? "العنوان مطلوب" : "Title required", variant: "destructive" });
      return;
    }
    if (!form.description_en.trim() || !form.description_ar.trim()) {
      toast({ title: isRTL ? "الوصف مطلوب" : "Description required", variant: "destructive" });
      return;
    }
    let parsedFields: any;
    try {
      parsedFields = JSON.parse(formFieldsText);
      if (!Array.isArray(parsedFields)) throw new Error("must be an array");
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
      return;
    }

    setSaving(true);
    const slug = form.slug.trim() || slugify(form.title_en);
    const payload: any = {
      title_en: form.title_en.trim(),
      title_ar: form.title_ar.trim(),
      slug,
      type: form.type,
      status: form.status,
      location_en: form.location_en.trim() || null,
      location_ar: form.location_ar.trim() || null,
      salary_range: form.salary_range.trim() || null,
      description_en: form.description_en.trim(),
      description_ar: form.description_ar.trim(),
      requirements_en: form.requirements_en.trim() || null,
      requirements_ar: form.requirements_ar.trim() || null,
      benefits_en: form.benefits_en.trim() || null,
      benefits_ar: form.benefits_ar.trim() || null,
      deadline_at: form.deadline_at ? new Date(form.deadline_at).toISOString() : null,
      is_featured: form.is_featured,
      form_fields: parsedFields,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? (isRTL ? "تعديل الوظيفة" : "Edit Job") : (isRTL ? "وظيفة جديدة" : "New Job")}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="basic">{isRTL ? "أساسي" : "Basic"}</TabsTrigger>
            <TabsTrigger value="content">{isRTL ? "المحتوى" : "Content"}</TabsTrigger>
            <TabsTrigger value="form">{isRTL ? "نموذج التقديم" : "Application Form"}</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "العنوان (إنجليزي)" : "Title (English)"}*</Label>
                <Input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value, slug: form.slug || slugify(e.target.value) })} />
              </div>
              <div>
                <Label>{isRTL ? "العنوان (عربي)" : "Title (Arabic)"}*</Label>
                <Input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="auto" />
              </div>
              <div>
                <Label>{isRTL ? "النوع" : "Type"}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                    <SelectItem value="summer_training">Summer Training</SelectItem>
                    <SelectItem value="volunteer">Volunteer</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "الموقع (إنجليزي)" : "Location (English)"}</Label>
                <Input value={form.location_en} onChange={(e) => setForm({ ...form, location_en: e.target.value })} placeholder="Cairo / Remote" />
              </div>
              <div>
                <Label>{isRTL ? "الموقع (عربي)" : "Location (Arabic)"}</Label>
                <Input value={form.location_ar} onChange={(e) => setForm({ ...form, location_ar: e.target.value })} placeholder="القاهرة / عن بُعد" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "نطاق الراتب" : "Salary Range"}</Label>
                <Input value={form.salary_range} onChange={(e) => setForm({ ...form, salary_range: e.target.value })} placeholder="5000-8000 EGP" />
              </div>
              <div>
                <Label>{isRTL ? "آخر يوم تقديم" : "Deadline"}</Label>
                <Input type="date" value={form.deadline_at} onChange={(e) => setForm({ ...form, deadline_at: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
                <Label>{isRTL ? "مميزة (Featured)" : "Featured"}</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "الوصف (إنجليزي)" : "Description (English)"}*</Label>
                <Textarea rows={5} value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} />
              </div>
              <div>
                <Label>{isRTL ? "الوصف (عربي)" : "Description (Arabic)"}*</Label>
                <Textarea rows={5} value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "المتطلبات (إنجليزي)" : "Requirements (English)"}</Label>
                <Textarea rows={4} value={form.requirements_en} onChange={(e) => setForm({ ...form, requirements_en: e.target.value })} />
              </div>
              <div>
                <Label>{isRTL ? "المتطلبات (عربي)" : "Requirements (Arabic)"}</Label>
                <Textarea rows={4} value={form.requirements_ar} onChange={(e) => setForm({ ...form, requirements_ar: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "المميزات (إنجليزي)" : "Benefits (English)"}</Label>
                <Textarea rows={4} value={form.benefits_en} onChange={(e) => setForm({ ...form, benefits_en: e.target.value })} />
              </div>
              <div>
                <Label>{isRTL ? "المميزات (عربي)" : "Benefits (Arabic)"}</Label>
                <Textarea rows={4} value={form.benefits_ar} onChange={(e) => setForm({ ...form, benefits_ar: e.target.value })} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="form" className="space-y-3 mt-4">
            <div className="text-sm text-muted-foreground">
              {isRTL
                ? "حدّد الأسئلة كـ JSON. الحقول المحجوزة: full_name, email, phone, cv. الأنواع المتاحة: short_text, long_text, email, phone, number, date, url, file_upload, single_choice."
                : "Define questions as JSON. Reserved keys: full_name, email, phone, cv. Available types: short_text, long_text, email, phone, number, date, url, file_upload, single_choice."}
            </div>
            <Textarea
              rows={20}
              value={formFieldsText}
              onChange={(e) => setFormFieldsText(e.target.value)}
              className="font-mono text-xs"
            />
            {jsonError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4" /> {jsonError}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setFormFieldsText(JSON.stringify(DEFAULT_FORM_FIELDS, null, 2))}>
              {isRTL ? "إعادة للافتراضي" : "Reset to default"}
            </Button>
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
