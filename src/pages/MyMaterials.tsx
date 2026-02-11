import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Video, Image, Link2, File, ExternalLink, Download, Search, FolderOpen } from 'lucide-react';
import { useState } from 'react';

const FILE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText, video: Video, image: Image, link: Link2, document: FileText, other: File,
};

export default function MyMaterials() {
  const { isRTL } = useLanguage();
  const [search, setSearch] = useState('');

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['my-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = materials.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.title.toLowerCase().includes(q) || m.title_ar.toLowerCase().includes(q);
  });

  const getIcon = (type: string) => {
    const Icon = FILE_TYPE_ICONS[type] || File;
    return <Icon className="h-6 w-6" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{isRTL ? 'موادي التعليمية' : 'My Materials'}</h1>
          <p className="text-muted-foreground text-sm">{isRTL ? 'المواد المتاحة لك' : 'Materials available to you'}</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isRTL ? 'بحث...' : 'Search...'} className="ps-10" />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{isRTL ? 'لا توجد مواد متاحة حالياً' : 'No materials available'}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <Card key={m.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="shrink-0 text-primary mt-0.5">{getIcon(m.file_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{isRTL ? m.title_ar : m.title}</p>
                    {(isRTL ? m.description_ar : m.description) && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{isRTL ? m.description_ar : m.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs capitalize">{m.file_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>
                  </div>
                  <Button size="icon" variant="outline" className="shrink-0" onClick={() => {
                    if (m.material_type === 'link') {
                      window.open(m.file_url, '_blank');
                    } else {
                      const link = document.createElement('a');
                      link.href = m.file_url;
                      link.download = m.original_filename || m.title || 'download';
                      link.target = '_blank';
                      link.rel = 'noopener noreferrer';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}>
                    {m.material_type === 'link' ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
