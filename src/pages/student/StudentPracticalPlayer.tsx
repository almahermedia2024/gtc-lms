import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ArrowRight, Trophy, RefreshCw, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { YouTubePlayer, YouTubePlayerHandle, extractYouTubeId } from "@/components/practical/YouTubePlayer";
import { QuestionRenderer, CheckpointForStudent } from "@/components/practical/QuestionRenderer";
import { AnnotatedImage, CaseText, type Annotation } from "@/components/practical/PracticalContent";

interface Video {
  id: string; title: string; youtube_url: string; description: string | null;
  case_text: string | null; image_url: string | null; annotations: Annotation[] | null;
}
interface Report {
  total_checkpoints: number; answered_checkpoints: number;
  correct_count: number; wrong_count: number;
  total_score: number; max_score: number; total_attempts: number;
}
type Cp = CheckpointForStudent & { stop_time: number; trigger_type: "video" | "timer" };
type Fb = { is_correct: boolean; feedback: string; exhausted: boolean; replay_from: number; continue_from: number };

export default function StudentPracticalPlayer() {
  const { videoId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [checkpoints, setCheckpoints] = useState<Cp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCp, setActiveCp] = useState<Cp | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [attemptsMap, setAttemptsMap] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Fb | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const triggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!videoId || !user) return;
    (async () => {
      const [{ data: v }, { data: cps }, { data: att }] = await Promise.all([
        (supabase as any).from("practical_videos").select("id, title, youtube_url, description, case_text, image_url, annotations").eq("id", videoId).maybeSingle(),
        (supabase as any).rpc("get_practical_checkpoints_for_student_v2", { _video_id: videoId }),
        (supabase as any).from("practical_attempts").select("checkpoint_id, attempts_count, completed_at").eq("video_id", videoId).eq("student_id", user.id),
      ]);
      setVideo(v);
      setCheckpoints(((cps as any[]) || []).map(c => ({
        id: c.id, question_type: c.question_type, question_text: c.question_text,
        options: c.options || [], attempts_allowed: c.attempts_allowed, score: c.score,
        stop_time: c.stop_time, trigger_type: c.trigger_type || "video",
      })));
      const done = new Set<string>();
      const am: Record<string, number> = {};
      (att || []).forEach((a: any) => { am[a.checkpoint_id] = a.attempts_count; if (a.completed_at) done.add(a.checkpoint_id); });
      setAttemptsMap(am);
      setCompletedIds(done);
      triggeredRef.current = new Set(done);
      setLoading(false);
    })();
  }, [videoId, user]);

  // Timer for popup questions (pauses while a question is open)
  useEffect(() => {
    if (loading || activeCp) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [loading, activeCp]);

  const timerCps = checkpoints.filter(c => c.trigger_type === "timer");
  const videoCps = checkpoints.filter(c => c.trigger_type === "video");

  useEffect(() => {
    if (activeCp) return;
    const next = timerCps.find(c => !triggeredRef.current.has(c.id) && elapsed >= c.stop_time);
    if (next) {
      triggeredRef.current.add(next.id);
      playerRef.current?.pause();
      setFeedback(null);
      setActiveCp(next);
    }
  }, [elapsed, activeCp, timerCps]);

  const handleTime = (t: number) => {
    if (activeCp) return;
    const cp = videoCps.find(c => !triggeredRef.current.has(c.id) && t >= c.stop_time);
    if (cp) {
      triggeredRef.current.add(cp.id);
      playerRef.current?.pause();
      setActiveCp(cp);
      setFeedback(null);
    }
  };

  const loadReport = async () => {
    const { data } = await (supabase as any).rpc("get_practical_report", { _video_id: videoId });
    setReport(Array.isArray(data) ? data[0] : data);
  };

  const handleSubmit = async (answer: unknown) => {
    if (!activeCp) return;
    const { data, error } = await (supabase as any).rpc("submit_practical_answer", { _checkpoint_id: activeCp.id, _answer: answer });
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setAttemptsMap(prev => ({ ...prev, [activeCp.id]: row.attempts_used }));
    setFeedback({ is_correct: row.is_correct, feedback: row.feedback, exhausted: row.exhausted, replay_from: row.replay_from, continue_from: row.continue_from });
    if (row.is_correct || row.exhausted) setCompletedIds(prev => new Set(prev).add(activeCp.id));
  };

  const handleContinue = () => {
    if (!activeCp || !feedback) return;
    const wasVideo = activeCp.trigger_type === "video";
    if (wasVideo) {
      const seek = feedback.is_correct ? feedback.continue_from : feedback.replay_from;
      playerRef.current?.seekTo(seek);
      if (!feedback.is_correct && !feedback.exhausted) triggeredRef.current.delete(activeCp.id);
    }
    setActiveCp(null);
    setFeedback(null);
    if (wasVideo) playerRef.current?.play();
    // Show report automatically when there is no video and all popups are done
    if (!youtubeId && timerCps.every(c => triggeredRef.current.has(c.id))) loadReport();
  };

  const restart = () => {
    setReport(null);
    playerRef.current?.seekTo(0);
    playerRef.current?.play();
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!video) return <div className="text-center py-16 text-muted-foreground">التدريب غير موجود</div>;

  const youtubeId = video.youtube_url ? extractYouTubeId(video.youtube_url) : null;
  const pendingTimers = timerCps.filter(c => !triggeredRef.current.has(c.id)).sort((a, b) => a.stop_time - b.stop_time);
  const nextIn = pendingTimers[0] ? Math.max(0, pendingTimers[0].stop_time - elapsed) : null;

  const questionBox = activeCp && (
    <QuestionRenderer
      checkpoint={activeCp}
      attemptsUsed={attemptsMap[activeCp.id] || 0}
      onSubmit={handleSubmit}
      feedback={feedback}
      onContinue={handleContinue}
      continueLabel={activeCp.trigger_type === "video" ? "متابعة الفيديو" : "متابعة"}
    />
  );

  return (
    <div dir="rtl" className="space-y-4">
      <div>
        <Link to="/student/practical" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowRight className="w-3 h-3" />العودة
        </Link>
        <h1 className="text-2xl font-heading font-bold mt-1">{video.title}</h1>
        {video.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{video.description}</p>}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {youtubeId && (
            <YouTubePlayer ref={playerRef} videoId={youtubeId} onTimeUpdate={handleTime} onEnded={loadReport} />
          )}
          {video.case_text && (
            <div className="space-y-2">
              <h2 className="font-heading font-bold">الحالة</h2>
              <CaseText text={video.case_text} />
            </div>
          )}
          {video.image_url && (
            <div className="space-y-2">
              <h2 className="font-heading font-bold">الصورة</h2>
              <AnnotatedImage path={video.image_url} annotations={video.annotations || []} />
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Badge variant="outline">{checkpoints.length} سؤال</Badge>
            <Badge variant="secondary">{completedIds.size} مكتمل</Badge>
            {nextIn !== null && !activeCp && (
              <Badge variant="outline" className="gap-1"><Timer className="w-3 h-3" />السؤال التالي بعد {nextIn} ث</Badge>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-3">
          {activeCp?.trigger_type === "video" ? (
            <Card className="border-primary/40">
              <CardHeader><CardTitle className="text-base">سؤال تفاعلي</CardTitle></CardHeader>
              <CardContent>{questionBox}</CardContent>
            </Card>
          ) : report ? (
            <Card className="border-primary/40">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" />تقرير الأداء</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="الأسئلة المجابة" value={`${report.answered_checkpoints} / ${report.total_checkpoints}`} />
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
                {youtubeId && (
                  <Button variant="outline" className="w-full" onClick={restart}>
                    <RefreshCw className="w-4 h-4 ml-2" />مشاهدة مرة أخرى
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-8 text-center text-sm text-muted-foreground space-y-3">
                <p>{youtubeId ? "شاهد الفيديو واقرأ المحتوى، وستظهر الأسئلة في أوقاتها" : "اقرأ المحتوى جيدًا، وستظهر الأسئلة في نافذة منبثقة"}</p>
                <Button variant="outline" size="sm" onClick={loadReport}>عرض تقرير الأداء</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={activeCp?.trigger_type === "timer"} onOpenChange={() => { /* must answer */ }}>
        <DialogContent dir="rtl" className="max-w-lg [&>button]:hidden" onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Timer className="w-5 h-5 text-primary" />سؤال</DialogTitle>
            <DialogDescription>أجب عن السؤال للمتابعة</DialogDescription>
          </DialogHeader>
          {activeCp?.trigger_type === "timer" && questionBox}
        </DialogContent>
      </Dialog>
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
