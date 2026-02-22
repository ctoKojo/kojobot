import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Video, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/LoadingScreen';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { useProfile } from '@/hooks/useProfile';

export default function LiveSession() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { profile } = useProfile();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  const [jitsiFailed, setJitsiFailed] = useState(false);

  useEffect(() => {
    if (!user || !groupId) return;

    async function checkAccess() {
      // 1. Fetch group
      const { data: group, error } = await supabase
        .from('groups')
        .select('id, name, name_ar, instructor_id, session_link, attendance_mode')
        .eq('id', groupId)
        .single();

      if (error || !group) {
        toast({
          title: isRTL ? 'خطأ' : 'Error',
          description: isRTL ? 'المجموعة غير موجودة' : 'Group not found',
          variant: 'destructive',
        });
        navigate('/dashboard', { replace: true });
        return;
      }

      setGroupName(language === 'ar' ? group.name_ar : group.name);
      setSessionLink(group.session_link);

      // 2. Check authorization
      if (role === 'admin') {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      if (user.id === group.instructor_id) {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      // Check student membership
      const { data: membership } = await supabase
        .from('group_students')
        .select('id')
        .eq('group_id', groupId)
        .eq('student_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (membership) {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      // Not authorized
      toast({
        title: isRTL ? 'غير مصرح' : 'Unauthorized',
        description: isRTL ? 'أنت لست عضوًا في هذه المجموعة' : 'You are not a member of this group',
        variant: 'destructive',
      });
      navigate(`/group/${groupId}`, { replace: true });
    }

    checkAccess();
  }, [user, groupId, role]);

  if (loading) return <LoadingScreen />;
  if (!authorized || !groupId) return null;

  const isModerator = role === 'admin' || role === 'instructor';
  // Room name: kojobot-{first 12 chars of groupId without dashes}
  const cleanId = groupId.replace(/-/g, '').substring(0, 12);
  const roomName = `kojobot-${cleanId}`;

  const displayName = profile
    ? (language === 'ar' ? profile.full_name_ar || profile.full_name : profile.full_name)
    : user?.email || 'User';

  const handleBack = () => navigate(`/group/${groupId}`);

  const handleJitsiError = () => setJitsiFailed(true);

  // Fallback UI
  if (jitsiFailed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-bold">
              {isRTL ? 'تعذر تحميل غرفة الفيديو' : 'Failed to load video room'}
            </h2>
            <p className="text-muted-foreground">
              {isRTL
                ? 'حدث خطأ أثناء تحميل غرفة الفيديو. يمكنك المحاولة مرة أخرى أو استخدام الرابط الخارجي.'
                : 'An error occurred while loading the video room. You can try again or use the external link.'}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={() => { setJitsiFailed(false); }}>
                {isRTL ? 'إعادة المحاولة' : 'Try Again'}
              </Button>
              {sessionLink && (
                <Button variant="outline" asChild>
                  <a href={sessionLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {isRTL ? 'رابط خارجي' : 'External Link'}
                  </a>
                </Button>
              )}
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {isRTL ? 'رجوع' : 'Go Back'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">
              {groupName}
            </span>
          </div>
        </div>
        {sessionLink && (
          <Button variant="outline" size="sm" asChild>
            <a href={sessionLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">
                {isRTL ? 'رابط خارجي' : 'External Link'}
              </span>
            </a>
          </Button>
        )}
      </div>

      {/* Jitsi Container */}
      <div className="flex-1 min-h-0">
        <JitsiMeeting
          roomName={roomName}
          displayName={displayName}
          email={user?.email || undefined}
          avatarUrl={profile?.avatar_url || undefined}
          isModerator={isModerator}
          onClose={handleBack}
          onError={handleJitsiError}
        />
      </div>
    </div>
  );
}
