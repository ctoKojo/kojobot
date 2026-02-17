import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CredentialsDialog } from '@/components/CredentialsDialog';

interface ResetPasswordButtonProps {
  userId: string;
  userName: string;
  userEmail: string;
}

export function ResetPasswordButton({ userId, userName, userEmail }: ResetPasswordButtonProps) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [savedPassword, setSavedPassword] = useState('');

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { userId, newPassword },
      });

      if (error) throw error;
      if (data?.error) throw new Error(isRTL ? data.error_ar : data.error);

      setSavedPassword(newPassword);
      setShowDialog(false);
      setNewPassword('');
      setShowCredentials(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message || (isRTL ? 'فشل في إعادة تعيين كلمة المرور' : 'Failed to reset password'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          generatePassword();
          setShowDialog(true);
        }}
      >
        <KeyRound className="h-4 w-4 mr-2" />
        {isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `إعادة تعيين كلمة المرور لـ ${userName}`
                : `Reset password for ${userName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'كلمة المرور الجديدة' : 'New Password'}</Label>
              <div className="flex gap-2">
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={isRTL ? 'أدخل كلمة مرور جديدة' : 'Enter new password'}
                />
                <Button type="button" variant="secondary" onClick={generatePassword}>
                  {isRTL ? 'توليد' : 'Generate'}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleReset} disabled={loading}>
              {loading
                ? (isRTL ? 'جاري التعيين...' : 'Resetting...')
                : (isRTL ? 'تعيين كلمة المرور' : 'Set Password')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CredentialsDialog
        open={showCredentials}
        onClose={() => setShowCredentials(false)}
        email={userEmail}
        password={savedPassword}
        userName={userName}
      />
    </>
  );
}
