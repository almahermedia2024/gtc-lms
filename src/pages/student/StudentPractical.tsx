import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Lock, Youtube } from "lucide-react";

interface Video {
  id: string; course_id: string; title: string; description: string | null;
  is_locked: boolean; youtube_url: string;
}

export default function StudentPractical() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: enrolls } = await supabase.from("course_students").select("course_id").eq("student_id", user.id);
      const courseIds = (enrolls || []).map(e => e.course_id);
      if (!courseIds.length) { setLoading(false); return; }
      const [{ data: v }, { data: c }] = await Promise.all([
        (supabase as any).from("practical_videos").select("*").in("course_id", courseIds).order("order_index"),
        supabase.from("courses").select("id, title").in("id", courseIds),
      ]);
      setVideos((v as Video[]) || []);
      setCourseMap(Object.fromEntries((c || []).map(x => [x.id, x.title])));
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div dir="rtl">
      <h1 className="text-2xl font-heading font-bold mb-1">التدريب العملي</h1>
      <p className="text-sm text-muted-foreground mb-6">فيديوهات تفاعلية تختبر فهمك أثناء المشاهدة</p>

      {videos.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <Youtube className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>لا توجد فيديوهات تدريب عملي متاحة بعد.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {videos.map(v => (
            <Card key={v.id} className={`border-border/50 ${v.is_locked ? "opacity-70" : ""}`}>
              <CardHeader>
                <CardTitle className="text-lg font-heading flex items-center justify-between">
                  <span className="flex items-center gap-2">{v.is_locked && <Lock className="w-4 h-4 text-destructive" />}{v.title}</span>
                  <Badge variant="secondary">{courseMap[v.course_id] || "—"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {v.description && <p className="text-sm text-muted-foreground mb-3">{v.description}</p>}
                {v.is_locked ? (
                  <Badge variant="destructive">مقفل</Badge>
                ) : (
                  <Button asChild className="w-full">
                    <Link to={`/student/practical/${v.id}`}><Play className="w-4 h-4 ml-2" />ابدأ التدريب</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
