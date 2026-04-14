import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Play, Clock, CheckCircle } from "lucide-react";

interface LectureWithProgress {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  duration_minutes: number | null;
  watched_seconds: number;
  completion_percentage: number;
}

export default function StudentLectures() {
  const { user } = useAuth();
  const [lectures, setLectures] = useState<LectureWithProgress[]>([]);
  const [selected, setSelected] = useState<LectureWithProgress | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // Get assigned lectures
      const { data: assignments } = await supabase
        .from("student_lectures")
        .select("lecture_id")
        .eq("student_id", user.id);

      if (!assignments?.length) return;

      const lectureIds = assignments.map((a) => a.lecture_id);
      const { data: lecs } = await supabase
        .from("lectures")
        .select("*")
        .in("id", lectureIds);

      const { data: progress } = await supabase
        .from("watch_progress")
        .select("*")
        .eq("student_id", user.id);

      const progressMap = new Map((progress || []).map((p) => [p.lecture_id, p]));

      setLectures(
        (lecs || []).map((l) => {
          const p = progressMap.get(l.id);
          return {
            ...l,
            watched_seconds: p?.watched_seconds || 0,
            completion_percentage: p?.completion_percentage || 0,
          };
        })
      );
    };
    fetch();
  }, [user]);

  const handleOpenLecture = async (lecture: LectureWithProgress) => {
    setSelected(lecture);
    if (!user) return;

    // Increment open count
    const { data: existing } = await supabase
      .from("watch_progress")
      .select("*")
      .eq("student_id", user.id)
      .eq("lecture_id", lecture.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("watch_progress")
        .update({ open_count: (existing.open_count || 0) + 1, last_watched_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("watch_progress").insert({
        student_id: user.id,
        lecture_id: lecture.id,
        open_count: 1,
        last_watched_at: new Date().toISOString(),
      });
    }
  };

  const handleProgress = useCallback(
    async (watchedSeconds: number, totalDuration: number) => {
      if (!user || !selected) return;
      const pct = totalDuration > 0 ? (watchedSeconds / totalDuration) * 100 : 0;

      await supabase
        .from("watch_progress")
        .upsert(
          {
            student_id: user.id,
            lecture_id: selected.id,
            watched_seconds: watchedSeconds,
            total_duration: totalDuration,
            completion_percentage: Math.min(pct, 100),
            last_watched_at: new Date().toISOString(),
          },
          { onConflict: "student_id,lecture_id" }
        );
    },
    [user, selected]
  );

  if (selected) {
    return (
      <div dir="rtl">
        <button onClick={() => setSelected(null)} className="text-primary hover:underline mb-4 text-sm font-medium">
          ← العودة للمحاضرات
        </button>
        <h2 className="text-xl font-heading font-bold mb-4">{selected.title}</h2>
        {selected.description && <p className="text-muted-foreground mb-4">{selected.description}</p>}
        <VideoPlayer src={selected.video_url} title={selected.title} onProgress={handleProgress} />
      </div>
    );
  }

  return (
    <div dir="rtl">
      <h1 className="text-2xl font-heading font-bold mb-6">محاضراتي</h1>
      {lectures.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <Play className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>لا توجد محاضرات مخصصة لك بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lectures.map((l) => (
            <Card
              key={l.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-border/50"
              onClick={() => handleOpenLecture(l)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading">{l.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {l.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{l.description}</p>}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />{l.duration_minutes || 0} د
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />{Math.round(l.completion_percentage)}%
                  </span>
                </div>
                <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${l.completion_percentage}%` }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
