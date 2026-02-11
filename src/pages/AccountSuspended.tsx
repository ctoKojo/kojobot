import { Ban, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { KojobotLogo } from '@/components/KojobotLogo';

export default function AccountSuspended() {
  const { isRTL } = useLanguage();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <KojobotLogo size="lg" />
          </div>
          <div className="mx-auto p-4 rounded-full bg-destructive/10">
            <Ban className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">
            {isRTL ? 'حسابك موقوف' : 'Account Suspended'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            {isRTL
              ? 'تم إيقاف حسابك بسبب تأخر في سداد القسط. يرجى التواصل مع الإدارة لتسوية المبلغ المستحق واستعادة الوصول إلى حسابك.'
              : 'Your account has been suspended due to overdue payment. Please contact the administration to settle the outstanding amount and restore access to your account.'}
          </p>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>01XXXXXXXXX</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>admin@kojobot.com</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={signOut}>
            {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
