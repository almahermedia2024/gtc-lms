import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Trophy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { YouTubePlayer, YouTubePlayerHandle, extractYouTubeId } from "@/components/practical/YouTubePlayer";
import { QuestionRenderer, CheckpointForStudent } from "@/components/practical/QuestionRenderer";

interface Video { id: string; title: string; youtube_url: string; description: string | null; }
interface Report {
  total_checkpoints: number; answered_checkpoints: number;
  correct_count: number; wrong_count: number;
  total_score: number; max_score: number; total_attempts: number;
}

export default function StudentPracticalPlayer() {
  const { videoId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointForStudent[]>([]);
  const [checkpointTimes, setCheckpointTimes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeCp, setActiveCp] = useState<CheckpointForStudent | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [attemptsMap, setAttemptsMap] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ is_correct: boolean; feedback: string; exhausted: boolean; replay_from: number; continue_from: number } | null>(null);
  const [ended, setEnded] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const triggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!videoId || !user) return;
    (async () => {
      const [{ data: v }, { data: cps }, { data: att }] = await Promise.all([
        (supabase as any).from("practical_videos").select("id, title, youtube_url, description").eq("id", videoId).maybeSingle(),
        (supabase as any).rpc("get_practical_checkpoints_for_student", { _video_id: videoId }),
        (supabase as any).from("practical_attempts").select("checkpoint_id, attempts_count, is_correct, completed_at").eq("video_id", videoId).eq("student_id", user.id),
      ]);
      setVideo(v);
      // fetch stop_time separately from practical_checkpoints (allowed for admin only via RLS) — students need stop_time too.
      // The student RPC already returns stop_time
      const all = ((cps as any[]) || []).map(c => ({
        id: c.id, question_type: c.question_type, question_text: c.question_text,
        options: c.options || [], attempts_allowed: c.attempts_allowed, score: c.score,
      })) as CheckpointForStudent[];
      const times: Record<string, number> = {};
      ((cps as any[]) || []).forEach(c => { times[c.id] = c.stop_time; });
      setCheckpoints(all);
      setCheckpointTimes(times);
      const done = new Set<string>();
      const am: Record<string, number> = {};
      (att || []).forEach((a: any) => {
        am[a.checkpoint_id] = a.attempts_count;
        if (a.completed_at) done.add(a.checkpoint_id);
      });
      setAttemptsMap(am);
      setCompletedIds(done);
      triggeredRef.current = new Set(done);
      setLoading(false);
    })();
  }, [videoId, user]);

  const handleTime = (t: number) => {
    if (activeCp) return;
    for (const cp of checkpoints) {
      if (triggeredRef.current.has(cp.id)) continue;
      const stop = checkpointTimes[cp.id] ?? 0;
      if (t >= stop) {
        triggeredRef.current.add(cp.id);
        playerRef.current?.pause();
        setActiveCp(cp);
        setFeedback(null);
        break;
      }
    }
  };

  const handleSubmit = async (answer: unknown) => {
    if (!activeCp) return;
    const { data, error } = await (supabase as any).rpc("submit_practical_answer", {
      _checkpoint_id: activeCp.id, _answer: answer,
    });
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setAttemptsMap(prev => ({ ...prev, [activeCp.id]: row.attempts_used }));
    setFeedback({
      is_correct: row.is_correct, feedback: row.feedback,
      exhausted: row.exhausted, replay_from: row.replay_from, continue_from: row.continue_from,
    });
    if (row.is_correct || row.exhausted) {
      setCompletedIds(prev => new Set(prev).add(activeCp.id));
    }
    if (!row.is_correct && !row.exhausted) {
      // Stay on question; replay on continue
    }
  };

  const handleContinue = () => {
    if (!activeCp || !feedback) return;
    const seek = feedback.is_correct ? feedback.continue_from : feedback.replay_from;
    playerRef.current?.seekTo(seek);
    // If wrong & not exhausted, allow re-trigger
    if (!feedback.is_correct && !feedback.exhausted) {
      triggeredRef.current.delete(activeCp.id);
    }
    setActiveCp(null);
    setFeedback(null);
    playerRef.current?.play();
  };

  const handleEnded = async () => {
    setEnded(true);
    const { data } = await (supabase as any).rpc("get_practical_report", { _video_id: videoId });
    const row = Array.isArray(data) ? data[0] : data;
    setReport(row);
  };

  const restart = () => {
    setEnded(false); setReport(null);
    playerRef.current?.seekTo(0);
    playerRef.current?.play();
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!video) return <div className="text-center py-16 text-muted-foreground">الفيديو غير موجود</div>;

  const youtubeId = extractYouTubeId(video.youtube_url);
  if (!youtubeId) return <div className="text-center py-16 text-destructive">رابط الفيديو غير صالح</div>;

  return (
    <div dir="rtl" className="space-y-4">
      <div>
        <Link to="/student/practical" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowRight className="w-3 h-3" />العودة
        </Link>
        <h1 className="text-2xl font-heading font-bold mt-1">{video.title}</h1>
        {video.description && <p className="text-sm text-muted-foreground mt-1">{video.description}</p>}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <YouTubePlayer
            ref={playerRef}
            videoId={youtubeId}
            onTimeUpdate={handleTime}
            onEnded={handleEnded}
          />
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Badge variant="outline">{checkpoints.length} نقطة توقف</Badge>
            <Badge variant="secondary">{completedIds.size} مكتملة</Badge>
          </div>
        </div>

        <div className="lg:col-span-1">
          {activeCp ? (
            <Card className="border-primary/40">
              <CardHeader><CardTitle className="text-base">سؤال تفاعلي</CardTitle></CardHeader>
              <CardContent>
                <QuestionRenderer
                  checkpoint={activeCp}
                  attemptsUsed={attemptsMap[activeCp.id] || 0}
                  onSubmit={handleSubmit}
                  feedback={feedback}
                  onContinue={handleContinue}
                />
              </CardContent>
            </Card>
          ) : ended && report ? (
            <Card className="border-primary/40">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" />تقرير الأداء</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="نقاط التوقف" value={`${report.answered_checkpoints} / ${report.total_checkpoints}`} />
                <Row label="إجابات صحيحة" value={String(report.correct_count)} />
                <Row label="إجابات خاطئة" value={String(report.wrong_count)} />
                <Row label="إجمالي المحاولات" value={String(report.total_attempts)} />
                <Row label="الدرجة" value={`${report.total_score} / ${report.max_score}`} />
                <div className="pt-2 border-t border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">النسبة</div>
                  <div className="text-2xl font-bold text-primary">
                    {report.max_score ? Math.round((report.total_score / report.max_score) * 100) : 0}%
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={restart}>
                  <RefreshCw className="w-4 h-4 ml-2" />مشاهدة مرة أخرى
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                شاهد الفيديو وستظهر الأسئلة عند كل نقطة توقف
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
