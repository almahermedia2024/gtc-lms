import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Play, Clock, CheckCircle, BookOpen, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LectureWithProgress {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  duration_minutes: number | null;
  course_id: string | null;
  course_title: string | null;
  watched_seconds: number;
  completion_percentage: number;
  open_count: number;
  last_watched_at: string | null;
}

export default function StudentLectures() {
  const { user } = useAuth();
  const [lectures, setLectures] = useState<LectureWithProgress[]>([]);
  const [selected, setSelected] = useState<LectureWithProgress | null>(null);
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) setStudentName(profile.full_name);

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

      const courseIds = [...new Set((lecs || []).map(l => l.course_id).filter(Boolean))] as string[];
      let courseMap = new Map<string, string>();
      if (courseIds.length > 0) {
        const { data: courses } = await supabase
          .from("courses")
          .select("id, title")
          .in("id", courseIds);
        courseMap = new Map((courses || []).map(c => [c.id, c.title]));
      }

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
            course_title: l.course_id ? courseMap.get(l.course_id) || null : null,
            watched_seconds: p?.watched_seconds || 0,
            completion_percentage: p?.completion_percentage || 0,
            open_count: p?.open_count || 0,
            last_watched_at: p?.last_watched_at || null,
          };
        })
      );
    };
    fetchData();
  }, [user]);

  const handleOpenLecture = async (lecture: LectureWithProgress) => {
    setSelected(lecture);
    if (!user) return;

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

  const totalLectures = lectures.length;
  const completedLectures = lectures.filter((l) => l.completion_percentage >= 90).length;
  const avgProgress = totalLectures > 0
    ? Math.round(lectures.reduce((sum, l) => sum + l.completion_percentage, 0) / totalLectures)
    : 0;
  const totalWatchedMinutes = Math.round(lectures.reduce((sum, l) => sum + l.watched_seconds, 0) / 60);

  const grouped = lectures.reduce<Record<string, { title: string; lectures: LectureWithProgress[] }>>((acc, l) => {
    const key = l.course_id || "__uncategorized__";
    if (!acc[key]) acc[key] = { title: l.course_title || "محاضرات عامة", lectures: [] };
    acc[key].lectures.push(l);
    return acc;
  }, {});

  if (selected) {
    return (
      <div dir="rtl" className="animate-fade-in relative z-10">
        <button onClick={() => setSelected(null)} className="text-primary hover:underline mb-4 text-sm font-medium transition-colors">
          ← العودة للمحاضرات
        </button>
        <h2 className="text-xl font-heading font-bold mb-4">{selected.title}</h2>
        {selected.description && <p className="text-muted-foreground mb-4">{selected.description}</p>}
        <VideoPlayer src={selected.video_url} title={selected.title} onProgress={handleProgress} />
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative z-10">
      {/* Welcome section */}
      {studentName && (
        <div className="mb-2 animate-fade-in flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <p className="text-muted-foreground">مرحباً، <span className="font-semibold text-foreground">{studentName}</span></p>
        </div>
      )}
      <h1 className="text-2xl font-heading font-bold mb-6 animate-fade-in">محاضراتي</h1>

      {/* Stats cards */}
      {totalLectures > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 stagger-children">
          <Card className="stat-card-hover border-border/50 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="pt-4 pb-4 text-center relative">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold font-heading">{totalLectures}</p>
              <p className="text-xs text-muted-foreground">إجمالي المحاضرات</p>
            </CardContent>
          </Card>
          <Card className="stat-card-hover border-border/50 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="pt-4 pb-4 text-center relative">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-accent" />
              </div>
              <p className="text-2xl font-bold font-heading">{completedLectures}</p>
              <p className="text-xs text-muted-foreground">مكتملة</p>
            </CardContent>
          </Card>
          <Card className="stat-card-hover border-border/50 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="pt-4 pb-4 text-center relative">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-secondary" />
              </div>
              <p className="text-2xl font-bold font-heading">{avgProgress}%</p>
              <p className="text-xs text-muted-foreground">متوسط التقدم</p>
            </CardContent>
          </Card>
          <Card className="stat-card-hover border-border/50 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-muted-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="pt-4 pb-4 text-center relative">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-muted flex items-center justify-center">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold font-heading">{totalWatchedMinutes}</p>
              <p className="text-xs text-muted-foreground">دقيقة مشاهدة</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lectures */}
      {lectures.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
            <Play className="w-8 h-8 opacity-30" />
          </div>
          <p>لا توجد محاضرات مخصصة لك بعد</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([courseId, group]) => (
            <div key={courseId} className="animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-heading font-bold">{group.title}</h2>
                <Badge variant="secondary" className="text-xs">{group.lectures.length} محاضرة</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                {group.lectures.map((l) => (
                  <Card
                    key={l.id}
                    className="cursor-pointer lecture-card-animated border-border/50"
                    onClick={() => handleOpenLecture(l)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-heading">{l.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {l.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{l.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{l.duration_minutes || 0} د</span>
                        <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />{Math.round(l.completion_percentage)}%</span>
                      </div>
                      <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-accent rounded-full transition-all duration-500 ${l.completion_percentage > 0 ? 'progress-glow' : ''}`}
                          style={{ width: `${l.completion_percentage}%` }}
                        />
                      </div>
                      {l.last_watched_at && (
                        <p className="text-xs text-muted-foreground mt-2">آخر مشاهدة: {new Date(l.last_watched_at).toLocaleDateString("ar")}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
