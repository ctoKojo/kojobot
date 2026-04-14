import { useState } from 'react';
import { Copy, Check, KeyRound, Download, Loader2, Link2 } from 'lucide-react';
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
import { generateStudentBusinessCard } from '@/lib/generateIdCard';

interface CredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
  password: string;
  userName: string;
  avatarUrl?: string | null;
  levelName?: string;
  subscriptionType?: string;
  attendanceMode?: string;
  ageGroupName?: string;
  linkCode?: string | null;
}

export function CredentialsDialog({ open, onClose, email, password, userName, avatarUrl, levelName, subscriptionType, attendanceMode, ageGroupName, linkCode }: CredentialsDialogProps) {
  const { t, isRTL } = useLanguage();
  const [copiedField, setCopiedField] = useState<'email' | 'password' | 'both' | 'linkCode' | 'linkUrl' | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadCard = async () => {
    if (!password || downloading) return;
    setDownloading(true);
    try {
      await generateStudentBusinessCard({ name: userName, email, password, avatarUrl, levelName, subscriptionType, attendanceMode, ageGroupName });
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async (text: string, field: 'email' | 'password' | 'linkCode' | 'linkUrl') => {
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

  const parentRegisterLink = linkCode ? `${window.location.origin}/auth?code=${linkCode}` : '';

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

          {/* Link Code field */}
          {linkCode && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" />
                {isRTL ? 'كود ربط ولي الأمر' : 'Parent Link Code'}
              </label>
              <div className="flex items-center gap-2 rounded-md border bg-primary/5 border-primary/20 p-3">
                <code className="flex-1 font-mono text-sm font-bold tracking-wider select-all" dir="ltr">
                  {linkCode}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleCopy(linkCode, 'linkCode')}
                >
                  {copiedField === 'linkCode' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleCopy(parentRegisterLink, 'linkUrl')}
                >
                  {copiedField === 'linkUrl' ? (
                    <Check className="h-3.5 w-3.5 me-1 text-green-500" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5 me-1" />
                  )}
                  {isRTL ? 'نسخ رابط التسجيل لولي الأمر' : 'Copy parent registration link'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'صالح لمدة 7 أيام — أرسله لولي الأمر عبر واتساب' : 'Valid for 7 days — send to parent via WhatsApp'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className={isRTL ? 'flex-row-reverse gap-2' : 'gap-2'}>
          {password && (
            <Button variant="outline" onClick={handleDownloadCard} disabled={downloading}>
              {downloading ? (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 me-2" />
              )}
              {isRTL ? 'تحميل كارت الطالب' : 'Download ID Card'}
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
