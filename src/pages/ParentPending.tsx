import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ParentPending() {
  const { isRTL } = useLanguage();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              {isRTL ? 'حسابك قيد المراجعة' : 'Account Under Review'}
            </h1>
            <p className="text-muted-foreground">
              {isRTL
                ? 'تم استلام طلب تسجيلك بنجاح. سيتم مراجعة حسابك من قبل الإدارة وإخطارك فور التفعيل.'
                : 'Your registration request has been received. Your account will be reviewed by the administration and you will be notified once activated.'}
            </p>
          </div>

          <Button variant="outline" onClick={() => signOut()} className="gap-2">
            <LogOut className="h-4 w-4" />
            {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
