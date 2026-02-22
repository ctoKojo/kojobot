import { useState } from 'react';
import { Copy, Check, KeyRound, CreditCard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { generateStudentCard } from '@/lib/pdfReports';

interface CredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
  password: string;
  userName: string;
}

export function CredentialsDialog({ open, onClose, email, password, userName }: CredentialsDialogProps) {
  const { t, isRTL } = useLanguage();
  const [copiedField, setCopiedField] = useState<'email' | 'password' | 'both' | null>(null);

  const handleCopy = async (text: string, field: 'email' | 'password') => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAll = async () => {
    const text = isRTL
      ? `الإيميل: ${email}\nكلمة المرور: ${password}`
      : `Email: ${email}\nPassword: ${password}`;
    await navigator.clipboard.writeText(text);
    setCopiedField('both');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {isRTL ? 'بيانات الدخول' : 'Login Credentials'}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? `تم إنشاء حساب ${userName} بنجاح. انسخ بيانات الدخول قبل إغلاق النافذة.`
              : `Account for ${userName} created successfully. Copy the credentials before closing.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {isRTL ? 'الإيميل' : 'Email'}
            </label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <span className="flex-1 font-mono text-sm select-all" dir="ltr">
                {email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleCopy(email, 'email')}
              >
                {copiedField === 'email' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {isRTL ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <span className="flex-1 font-mono text-sm select-all" dir="ltr">
                {password}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handleCopy(password, 'password')}
              >
                {copiedField === 'password' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className={isRTL ? 'flex-row-reverse gap-2' : 'gap-2'}>
          {password && (
            <Button
              variant="outline"
              onClick={() => {
                if (!password) return;
                generateStudentCard({ name: userName, email }, { password, isRTL });
              }}
            >
              <CreditCard className="h-4 w-4 me-2" />
              {isRTL ? 'طباعة البطاقة' : 'Print Card'}
            </Button>
          )}
          <Button variant="outline" onClick={handleCopyAll}>
            {copiedField === 'both' ? (
              <Check className="h-4 w-4 me-2 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 me-2" />
            )}
            {isRTL ? 'نسخ الكل' : 'Copy All'}
          </Button>
          <Button onClick={onClose}>
            {isRTL ? 'إغلاق' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
