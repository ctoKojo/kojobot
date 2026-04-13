import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, X, Loader2, CheckCircle, AlertCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import kojobotLogo from '@/assets/kojobot-main-logo.png';

export default function ParentRegister() {
  const [codes, setCodes] = useState<string[]>(['']);
  const [isLinking, setIsLinking] = useState(false);
  const [results, setResults] = useState<{ code: string; status: string }[] | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, role } = useAuth();
  const { isRTL } = useLanguage();

  // If user already has parent role, go to dashboard
  useEffect(() => {
    if (user && role === 'parent') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, role, navigate]);

  // Pre-fill code from URL param
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setCodes([codeParam.trim().toUpperCase()]);
    }
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + '/parent-register' + (codes[0] ? `?code=${codes[0]}` : ''),
    });
    if (result.error) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'فشل تسجيل الدخول بـ Google' : 'Google sign-in failed' });
    }
    if (result.redirected) return;
  };

  const addCodeField = () => {
    if (codes.length < 5) setCodes([...codes, '']);
  };

  const removeCodeField = (index: number) => {
    if (codes.length > 1) setCodes(codes.filter((_, i) => i !== index));
  };

  const updateCode = (index: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const newCodes = [...codes];
    newCodes[index] = upper;
    setCodes(newCodes);
  };

  const handlePaste = (index: number, e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').trim();
    // If pasted text contains spaces/commas/newlines, split into multiple codes
    const parts = pasted.split(/[\s,\n]+/).filter(Boolean).map(p => p.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
    if (parts.length > 1) {
      e.preventDefault();
      const newCodes = [...codes];
      newCodes.splice(index, 1, ...parts.slice(0, 5));
      setCodes(newCodes.slice(0, 5));
    }
  };

  const handleLinkCodes = async () => {
    const validCodes = codes.filter(c => c.trim().length >= 8);
    if (validCodes.length === 0) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'أدخل كود واحد على الأقل' : 'Enter at least one valid code' });
      return;
    }

    setIsLinking(true);
    setResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'سجل الدخول أولاً' : 'Please sign in first' });
        setIsLinking(false);
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/register-parent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ codes: validCodes }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          setResults(data.details);
        }
        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: data.error || (isRTL ? 'حدث خطأ' : 'Something went wrong') });
      } else {
        setResults(data.details);
        toast({ title: isRTL ? 'تم بنجاح!' : 'Success!', description: isRTL ? `تم ربط ${data.linked} طالب` : `Linked ${data.linked} student(s)` });
        // Refresh auth state to get new role
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      }
    } catch (error) {
      console.error('Link error:', error);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'خطأ في الاتصال' : 'Connection error' });
    } finally {
      setIsLinking(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />{isRTL ? 'تم الربط' : 'Linked'}</Badge>;
      case 'invalid': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{isRTL ? 'كود غير صحيح' : 'Invalid code'}</Badge>;
      case 'expired': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{isRTL ? 'كود منتهي الصلاحية' : 'Code expired'}</Badge>;
      case 'already_used': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{isRTL ? 'كود مُستخدم بالفعل' : 'Already used'}</Badge>;
      default: return null;
    }
  };

  const isSignedIn = !!user;

  return (
    <div className={`min-h-screen bg-background flex items-center justify-center p-4 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img src={kojobotLogo} alt="Kojobot" className="h-16 mx-auto" />
          <CardTitle className="text-2xl font-bold">
            {isRTL ? 'بوابة أولياء الأمور' : 'Parent Portal'}
          </CardTitle>
          <CardDescription>
            {isRTL
              ? 'سجّل بحساب Google وأدخل كود الربط لمتابعة أولادك'
              : 'Sign in with Google and enter your linking code to follow your children\'s progress'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Google Sign In */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${isSignedIn ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'}`}>
                1
              </div>
              <span className="font-medium">
                {isRTL ? 'تسجيل الدخول' : 'Sign In'}
              </span>
              {isSignedIn && <CheckCircle className="h-5 w-5 text-green-500" />}
            </div>

            {!isSignedIn ? (
              <Button onClick={handleGoogleSignIn} className="w-full" size="lg">
                <LogIn className="h-5 w-5 mr-2" />
                {isRTL ? 'سجّل بحساب Google' : 'Sign in with Google'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground px-10">
                {isRTL ? `مسجّل كـ ${user.email}` : `Signed in as ${user.email}`}
              </p>
            )}
          </div>

          {/* Step 2: Enter Codes */}
          {isSignedIn && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <span className="font-medium">
                  {isRTL ? 'أدخل كود الربط' : 'Enter Linking Code'}
                </span>
              </div>

              <div className="space-y-2 px-10">
                {codes.map((code, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={code}
                      onChange={(e) => updateCode(index, e.target.value)}
                      onPaste={(e) => handlePaste(index, e)}
                      placeholder={isRTL ? 'مثال: KJB-A7X2-9P3M' : 'e.g. KJB-A7X2-9P3M'}
                      className="font-mono text-center tracking-wider"
                      maxLength={14}
                      autoFocus={index === 0}
                    />
                    {codes.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeCodeField(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {results && (
                      <div>{getStatusBadge(results.find(r => r.code === code)?.status || '')}</div>
                    )}
                  </div>
                ))}

                {codes.length < 5 && (
                  <Button variant="outline" size="sm" onClick={addCodeField} className="w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    {isRTL ? 'إضافة كود آخر' : 'Add another code'}
                  </Button>
                )}
              </div>

              <Button
                onClick={handleLinkCodes}
                disabled={isLinking || codes.every(c => c.trim().length < 8)}
                className="w-full"
                size="lg"
              >
                {isLinking ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isRTL ? 'جاري الربط...' : 'Linking...'}</>
                ) : (
                  isRTL ? 'ربط الأكواد' : 'Link Codes'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
