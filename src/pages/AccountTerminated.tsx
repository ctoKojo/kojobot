import { Heart, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { KojobotLogo } from '@/components/KojobotLogo';

export default function AccountTerminated() {
  const { isRTL } = useLanguage();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <KojobotLogo size="lg" />
          </div>
          <div className="mx-auto p-4 rounded-full bg-muted">
            <Heart className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-xl">
            {isRTL ? 'شكراً لك على فترة عملك معنا' : 'Thank You for Your Service'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            {isRTL
              ? 'تم إنهاء تعاقدك مع كوجوبوت. نشكرك على جهودك ومساهماتك خلال فترة عملك معنا ونتمنى لك التوفيق في مسيرتك المهنية.'
              : 'Your contract with KojoBot has been terminated. We appreciate your efforts and contributions during your time with us and wish you the best in your future endeavors.'}
          </p>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground font-medium">
              {isRTL ? 'للاستفسارات تواصل معنا:' : 'For inquiries, contact us:'}
            </p>
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
