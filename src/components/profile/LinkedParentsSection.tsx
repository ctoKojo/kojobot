import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Users, Phone, Mail } from 'lucide-react';

interface ParentInfo {
  parent_id: string;
  relationship: string;
  full_name: string;
  full_name_ar: string | null;
  phone: string | null;
  email: string;
}

export function LinkedParentsSection() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [parents, setParents] = useState<ParentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetch = async () => {
      const { data: links } = await supabase
        .from('parent_students')
        .select('parent_id, relationship')
        .eq('student_id', user.id);

      if (!links?.length) {
        setLoading(false);
        return;
      }

      const parentIds = links.map(l => l.parent_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar, phone, email')
        .in('user_id', parentIds);

      const enriched: ParentInfo[] = links.map(link => {
        const profile = profiles?.find(p => p.user_id === link.parent_id);
        return {
          parent_id: link.parent_id,
          relationship: link.relationship,
          full_name: profile?.full_name || '',
          full_name_ar: profile?.full_name_ar || null,
          phone: profile?.phone || null,
          email: profile?.email || '',
        };
      });

      setParents(enriched);
      setLoading(false);
    };

    fetch();
  }, [user?.id]);

  const getRelLabel = (rel: string) => {
    if (isRTL) {
      switch (rel) { case 'father': return 'أب'; case 'mother': return 'أم'; case 'guardian': return 'وصي'; default: return 'ولي أمر'; }
    }
    switch (rel) { case 'father': return 'Father'; case 'mother': return 'Mother'; case 'guardian': return 'Guardian'; default: return 'Parent'; }
  };

  if (loading || parents.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          {isRTL ? 'أولياء الأمور المرتبطين' : 'Linked Parents'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {parents.map(p => (
          <div key={p.parent_id} className="flex items-start gap-3 p-3 rounded-lg border">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {isRTL ? p.full_name_ar || p.full_name : p.full_name}
              </p>
              <p className="text-xs text-muted-foreground">{getRelLabel(p.relationship)}</p>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {p.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />{p.phone}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />{p.email}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
