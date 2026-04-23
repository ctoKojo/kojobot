import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserCheck, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  application: { id: string; applicant_name: string; applicant_email: string; converted_employee_id?: string | null } | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConverted: () => void;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
  let pw = "";
  for (let i = 0; i < 14; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export function HireApplicationDialog({ application, open, onOpenChange, onConverted }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [hireRole, setHireRole] = useState<"instructor" | "reception">("instructor");
  const [startDate, setStartDate] = useState("");
  const [baseSalary, setBaseSalary] = useState<string>("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const today = new Date();
      setStartDate(today.toISOString().split("T")[0]);
      setHireRole("instructor");
      setBaseSalary("");
      setPassword(generatePassword());
    }
  }, [open]);

  const handleHire = async () => {
    if (!application) return;
    if (!startDate) {
      toast({ title: isRTL ? "حدد تاريخ البداية" : "Pick a start date", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: isRTL ? "كلمة المرور قصيرة" : "Password too short", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("convert-application-to-employee", {
      body: {
        application_id: application.id,
        password,
        hire_role: hireRole,
        hire_start_date: startDate,
        base_salary: baseSalary ? parseFloat(baseSalary) : undefined,
      },
    });
    setSubmitting(false);

    if (error || data?.error) {
      toast({
        title: isRTL ? "فشل التحويل" : "Conversion failed",
        description: error?.message || data?.error || "Unknown error",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: isRTL ? "تم إنشاء حساب الموظف" : "Employee account created",
      description: isRTL
        ? `كلمة المرور: ${password}` 
        : `Password: ${password}`,
      duration: 15000,
    });
    onConverted();
    onOpenChange(false);
  };

  if (!application) return null;
  const alreadyConverted = !!application.converted_employee_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <UserCheck className="w-5 h-5" />
            {isRTL ? "تحويل لموظف" : "Hire & create employee"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-sm">
            <div className="font-medium">{application.applicant_name}</div>
            <div className="text-muted-foreground text-xs">{application.applicant_email}</div>
          </div>

          {alreadyConverted ? (
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{isRTL ? "تم تحويل هذا المتقدم بالفعل" : "This applicant has already been converted"}</AlertDescription>
            </Alert>
          ) : (
            <>
              <div>
                <Label>{isRTL ? "الدور" : "Role"}</Label>
                <Select value={hireRole} onValueChange={(v: any) => setHireRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instructor">{isRTL ? "مدرب" : "Instructor"}</SelectItem>
                    <SelectItem value="reception">{isRTL ? "موظف استقبال" : "Reception"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start-date">{isRTL ? "تاريخ البداية" : "Start date"}</Label>
                  <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="salary">{isRTL ? "الراتب الأساسي" : "Base salary"}</Label>
                  <Input id="salary" type="number" min="0" placeholder={isRTL ? "اختياري" : "Optional"} value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} />
                </div>
              </div>

              <div>
                <Label htmlFor="pw">{isRTL ? "كلمة المرور المؤقتة" : "Temporary password"}</Label>
                <div className="flex gap-2">
                  <Input id="pw" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-sm" />
                  <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
                    {isRTL ? "توليد" : "Generate"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isRTL ? "ستظهر لك كلمة المرور بعد الإنشاء — احفظها وأرسلها للموظف الجديد" : "Password will be shown after creation — save it and share with the new employee"}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {isRTL ? "إلغاء" : "Cancel"}
          </Button>
          {!alreadyConverted && (
            <Button onClick={handleHire} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {isRTL ? "إنشاء حساب الموظف" : "Create employee account"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
