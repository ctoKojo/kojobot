import { Trophy, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { KojobotLogo } from '@/components/KojobotLogo';

export default function RenewalRequired() {
  const { isRTL } = useLanguage();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <KojobotLogo size="lg" />
          </div>
          <div className="mx-auto p-4 rounded-full bg-primary/10">
            <Trophy className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-xl text-primary">
            {isRTL ? 'مبروك! نجحت في المستوى 🎉' : 'Congratulations! You passed the level 🎉'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            {isRTL
              ? 'لقد اجتزت المستوى بنجاح! يرجى تجديد اشتراكك للمستوى الجديد للاستمرار في رحلة التعلم. تواصل مع الإدارة لإتمام عملية التجديد.'
              : 'You have successfully passed the level! Please renew your subscription for the new level to continue your learning journey. Contact the administration to complete the renewal.'}
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
