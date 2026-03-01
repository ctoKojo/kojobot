import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KojoSheet, type KojoContextMeta } from '@/components/student/KojoSheet';
import { Lock, Check } from 'lucide-react';
import kojobotIcon from '@/assets/kojobot-icon-optimized.webp';

interface MapNode {
  sessionNumber: number;
  title: string;
  titleAr: string;
  curriculumSessionId: string;
  state: 'completed' | 'current' | 'locked';
  sessionId?: string;
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

  // Generate a winding SVG path
  const nodeSpacing = 100;
  const svgHeight = nodes.length * nodeSpacing;
  const svgWidth = 280;
  const centerX = svgWidth / 2;

  const getNodeX = (idx: number) => {
    const offset = 60;
    return centerX + (idx % 2 === 0 ? -offset : offset);
  };

  const getNodeY = (idx: number) => idx * nodeSpacing + 50;

  const buildPath = () => {
    if (nodes.length < 2) return '';
    let d = `M ${getNodeX(0)} ${getNodeY(0)}`;
    for (let i = 1; i < nodes.length; i++) {
      const prevX = getNodeX(i - 1);
      const prevY = getNodeY(i - 1);
      const currX = getNodeX(i);
      const currY = getNodeY(i);
      const midY = (prevY + currY) / 2;
      d += ` C ${prevX} ${midY}, ${currX} ${midY}, ${currX} ${currY}`;
    }
    return d;
  };

  return (
    <>
      <div className="relative flex justify-center py-4 overflow-hidden">
        <svg
          width={svgWidth}
          height={svgHeight + 40}
          className="absolute top-0"
          style={{ zIndex: 0 }}
        >
          {/* Path trail */}
          <path
            d={buildPath()}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="4"
            strokeDasharray="8 6"
            strokeLinecap="round"
          />
          {/* Completed trail overlay */}
          <path
            d={buildPath()}
            fill="none"
            stroke="hsl(142 76% 36%)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={(() => {
              const completedCount = nodes.filter(n => n.state === 'completed').length;
              const totalLen = nodes.length > 1 ? (nodes.length - 1) * nodeSpacing * 1.2 : 0;
              const completedLen = nodes.length > 1 ? (completedCount / (nodes.length - 1)) * totalLen : 0;
              return `${completedLen} ${totalLen}`;
            })()}
            opacity={0.6}
          />
        </svg>

        <div className="relative" style={{ width: svgWidth, height: svgHeight + 40, zIndex: 1 }}>
          {nodes.map((node, idx) => {
            const x = getNodeX(idx);
            const y = getNodeY(idx);
            const nodeTitle = language === 'ar' ? node.titleAr : node.title;
            const isEven = idx % 2 === 0;

            return (
              <div
                key={node.sessionNumber}
                className="absolute animate-stagger-in"
                style={{
                  left: x - 24,
                  top: y - 24,
                  animationDelay: `${idx * 80}ms`,
                }}
              >
                {/* Hexagonal node */}
                <button
                  onClick={() => {
                    if (node.state === 'completed') navigate('/my-sessions');
                  }}
                  disabled={node.state === 'locked'}
                  className={`
                    relative w-12 h-12 hexagon-clip flex items-center justify-center font-bold text-sm transition-all
                    ${node.state === 'completed'
                      ? 'bg-green-500 text-white game-glow-green hover:scale-110 cursor-pointer'
                      : node.state === 'current'
                        ? 'kojo-gradient text-white animate-pulse-glow cursor-default'
                        : 'bg-muted text-muted-foreground cursor-not-allowed opacity-40'
                    }
                  `}
                >
                  {node.state === 'completed' ? (
                    <Check className="h-5 w-5" />
                  ) : node.state === 'locked' ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    node.sessionNumber
                  )}
                </button>

                {/* Kojo NPC on current node */}
                {node.state === 'current' && (
                  <button
                    onClick={() => openKojo(node)}
                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full overflow-hidden shadow-md hover:scale-110 transition-transform ring-2 ring-background z-20 animate-float"
                    title={isRTL ? 'اسأل Kojo' : 'Ask Kojo'}
                  >
                    <img src={kojobotIcon} alt="Kojo" className="h-full w-full object-cover" />
                  </button>
                )}

                {/* Label */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap ${
                    isEven ? 'right-16 text-right' : 'left-16 text-left'
                  }`}
                >
                  <div className={`inline-block px-2.5 py-1 rounded-lg ${
                    node.state === 'completed'
                      ? 'bg-green-50 dark:bg-green-950/30'
                      : node.state === 'current'
                        ? 'bg-primary/5 dark:bg-primary/10 game-glow-gold'
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
