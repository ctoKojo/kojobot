import { useState, useEffect } from 'react';
import { Copy, Check, Link2, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 to avoid confusion
  const parts = [3, 4, 4]; // KJB-A7X2-9P3M format
  return parts.map(len => {
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }).join('-');
}

interface Props {
  studentId: string;
  studentName: string;
}

export function GenerateParentCodeDialog({ studentId, studentName }: Props) {
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState<any[]>([]);
  const [linkedParents, setLinkedParents] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const fetchCodes = async () => {
    const [codesRes, parentsRes] = await Promise.all([
      supabase
        .from('parent_link_codes')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
      supabase
        .from('parent_students')
        .select('*, profiles!parent_students_parent_id_fkey(full_name, full_name_ar, email)')
        .eq('student_id', studentId),
    ]);
    setCodes(codesRes.data || []);
    setLinkedParents(parentsRes.data || []);
  };

  useEffect(() => {
    if (open) fetchCodes();
  }, [open, studentId]);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    const code = generateCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error } = await supabase.from('parent_link_codes').insert({
      code,
      student_id: studentId,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    } else {
      toast({ title: isRTL ? 'تم إنشاء الكود' : 'Code Generated' });
      fetchCodes();
    }
    setGenerating(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/auth?code=${code}`;
    navigator.clipboard.writeText(link);
    setCopied(`link-${code}`);
    toast({ title: isRTL ? 'تم نسخ الرابط' : 'Link copied' });
    setTimeout(() => setCopied(null), 2000);
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="h-4 w-4 mr-2" />
          {isRTL ? 'كود ولي الأمر' : 'Parent Code'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'أكواد ربط ولي الأمر' : 'Parent Linking Codes'}</DialogTitle>
          <DialogDescription>
            {isRTL ? `أكواد الربط للطالب: ${studentName}` : `Linking codes for: ${studentName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Linked Parents */}
          {linkedParents.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">{isRTL ? 'أولياء أمور مرتبطين' : 'Linked Parents'}</h4>
              {linkedParents.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{isRTL ? 'مرتبط' : 'Linked'}</Badge>
                    <span>{p.profiles?.full_name || p.profiles?.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={async () => {
                      const { error } = await supabase
                        .from('parent_students')
                        .delete()
                        .eq('id', p.id);
                      if (error) {
                        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
                      } else {
                        toast({ title: isRTL ? 'تم فك الربط' : 'Parent unlinked' });
                        fetchCodes();
                      }
                    }}
                    title={isRTL ? 'فك الربط' : 'Unlink'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Active Codes */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium">{isRTL ? 'الأكواد' : 'Codes'}</h4>
              <Button size="sm" onClick={handleGenerate} disabled={generating}>
                <Plus className="h-3 w-3 mr-1" />
                {isRTL ? 'كود جديد' : 'New Code'}
              </Button>
            </div>

            {codes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد أكواد. أنشئ كود جديد.' : 'No codes yet. Generate one.'}</p>
            ) : (
              <div className="space-y-2">
                {codes.map((c: any) => {
                  const expired = isExpired(c.expires_at);
                  const used = !!c.used_at;
                  return (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded border bg-muted/50">
                      <div className="space-y-0.5">
                        <code className="font-mono text-sm font-bold tracking-wider">{c.code}</code>
                        <div className="flex gap-1">
                          {used && <Badge variant="outline" className="text-xs">{isRTL ? 'مُستخدم' : 'Used'}</Badge>}
                          {expired && !used && <Badge variant="destructive" className="text-xs">{isRTL ? 'منتهي' : 'Expired'}</Badge>}
                          {!used && !expired && <Badge className="text-xs bg-green-500">{isRTL ? 'نشط' : 'Active'}</Badge>}
                        </div>
                      </div>
                      {!used && !expired && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => copyCode(c.code)} title={isRTL ? 'نسخ الكود' : 'Copy code'}>
                            {copied === c.code ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => copyLink(c.code)} title={isRTL ? 'نسخ الرابط' : 'Copy link'}>
                            {copied === `link-${c.code}` ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
