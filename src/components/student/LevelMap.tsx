import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KojoSheet, type KojoContextMeta } from '@/components/student/KojoSheet';
import kojobotIcon from '@/assets/kojobot-icon-optimized.webp';

interface MapNode {
  sessionNumber: number;
  title: string;
  titleAr: string;
  curriculumSessionId: string;
  state: 'completed' | 'current' | 'locked';
  sessionId?: string; // actual session ID for navigation
}

interface LevelMapProps {
  groupId: string;
  levelId: string;
  ageGroupId: string;
  attendedSessionNumbers: Set<number>;
}

export function LevelMap({ groupId, levelId, ageGroupId, attendedSessionNumbers }: LevelMapProps) {
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [kojoOpen, setKojoOpen] = useState(false);
  const [kojoMeta, setKojoMeta] = useState<KojoContextMeta | undefined>();

  useEffect(() => {
    fetchCurriculum();
  }, [levelId, ageGroupId]);

  const fetchCurriculum = async () => {
    setLoading(true);
    const { data: sessions } = await supabase
      .from('curriculum_sessions')
      .select('id, session_number, title, title_ar')
      .eq('level_id', levelId)
      .eq('age_group_id', ageGroupId)
      .eq('is_active', true)
      .order('session_number', { ascending: true });

    if (sessions) {
      // Find first uncompleted session
      let foundCurrent = false;
      const mapped: MapNode[] = sessions.map((s) => {
        const completed = attendedSessionNumbers.has(s.session_number);
        let state: MapNode['state'] = 'locked';
        if (completed) {
          state = 'completed';
        } else if (!foundCurrent) {
          state = 'current';
          foundCurrent = true;
        }
        return {
          sessionNumber: s.session_number,
          title: s.title,
          titleAr: s.title_ar,
          curriculumSessionId: s.id,
          state,
        };
      });

      // If all completed, mark last as current for Kojo
      if (!foundCurrent && mapped.length > 0) {
        mapped[mapped.length - 1].state = 'current';
      }

      setNodes(mapped);
    }
    setLoading(false);
  };

  const currentNode = useMemo(() => nodes.find((n) => n.state === 'current'), [nodes]);
  const allCompleted = useMemo(() => nodes.length > 0 && nodes.every(n => attendedSessionNumbers.has(n.sessionNumber)), [nodes, attendedSessionNumbers]);

  const openKojo = useCallback((node: MapNode) => {
    const title = language === 'ar' ? node.titleAr : node.title;
    setKojoMeta({
      contextType: 'map',
      contextTitle: allCompleted
        ? (isRTL ? 'تهنئة! إيه الـ skill الجاية؟' : 'Congrats! What skill is next?')
        : title,
      contextId: node.curriculumSessionId,
    });
    setKojoOpen(true);
  }, [language, isRTL, allCompleted]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {isRTL ? 'لا يوجد منهج متاح حالياً' : 'No curriculum available'}
      </div>
    );
  }

  return (
    <>
      <div className="relative px-4 py-6">
        {/* Vertical path line */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-border rounded-full" />

        <div className="relative space-y-6">
          {nodes.map((node, idx) => {
            const isEven = idx % 2 === 0;
            const nodeTitle = language === 'ar' ? node.titleAr : node.title;

            return (
              <div key={node.sessionNumber} className="relative flex items-center">
                {/* Connector line is behind via the absolute line above */}

                {/* Node circle - centered */}
                <div className="absolute left-1/2 -translate-x-1/2 z-10">
                  <button
                    onClick={() => {
                      if (node.state === 'completed') {
                        // Navigate to session content
                        navigate('/my-sessions');
                      }
                    }}
                    disabled={node.state === 'locked'}
                    className={`
                      relative w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all
                      ${node.state === 'completed'
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 hover:scale-110 cursor-pointer'
                        : node.state === 'current'
                          ? 'kojo-gradient text-white shadow-lg shadow-primary/40 animate-pulse cursor-default ring-4 ring-primary/20'
                          : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                      }
                    `}
                  >
                    {node.sessionNumber}
                  </button>

                  {/* Kojo NPC on current node */}
                  {node.state === 'current' && (
                    <button
                      onClick={() => openKojo(node)}
                      className="absolute -top-2 -right-2 h-7 w-7 rounded-full overflow-hidden shadow-md hover:scale-110 transition-transform ring-2 ring-background z-20"
                      title={isRTL ? 'اسأل Kojo' : 'Ask Kojo'}
                    >
                      <img src={kojobotIcon} alt="Kojo" className="h-full w-full object-cover" />
                    </button>
                  )}
                </div>

                {/* Label - alternates left/right */}
                <div className={`w-1/2 ${isEven ? 'pr-10 text-right' : 'pl-10 text-left ml-auto'}`}>
                  <div className={`inline-block p-2 rounded-lg ${
                    node.state === 'completed'
                      ? 'bg-green-50 dark:bg-green-950/30'
                      : node.state === 'current'
                        ? 'bg-primary/5 dark:bg-primary/10'
                        : 'bg-muted/50'
                  }`}>
                    <p className={`text-xs font-medium ${
                      node.state === 'locked' ? 'text-muted-foreground/60' : 'text-foreground'
                    }`}>
                      {nodeTitle || (isRTL ? `سيشن ${node.sessionNumber}` : `Session ${node.sessionNumber}`)}
                    </p>
                    {node.state === 'completed' && (
                      <span className="text-[10px] text-green-600 dark:text-green-400">✓ {isRTL ? 'مكتمل' : 'Done'}</span>
                    )}
                    {node.state === 'current' && (
                      <span className="text-[10px] text-primary font-semibold">
                        {allCompleted ? (isRTL ? '🎉 مبروك!' : '🎉 Complete!') : (isRTL ? '← أنت هنا' : '← You are here')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <KojoSheet open={kojoOpen} onOpenChange={setKojoOpen} contextMeta={kojoMeta} />
    </>
  );
}
