import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Video, BarChart3, Eye } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ students: 0, lectures: 0, totalWatched: 0, avgCompletion: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: studentCount }, { count: lectureCount }, { data: progress }] = await Promise.all([
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("lectures").select("*", { count: "exact", head: true }),
        supabase.from("watch_progress").select("watched_seconds, completion_percentage"),
      ]);

      const totalWatched = (progress || []).reduce((sum, p) => sum + (p.watched_seconds || 0), 0);
      const avgCompletion = progress?.length
        ? (progress.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / progress.length)
        : 0;

      setStats({
        students: studentCount || 0,
        lectures: lectureCount || 0,
        totalWatched: Math.round(totalWatched / 60),
        avgCompletion: Math.round(avgCompletion),
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "الطلاب", value: stats.students, icon: Users, color: "text-primary" },
    { title: "المحاضرات", value: stats.lectures, icon: Video, color: "text-secondary" },
    { title: "إجمالي المشاهدة (دقيقة)", value: stats.totalWatched, icon: Eye, color: "text-accent" },
    { title: "متوسط الإكمال %", value: `${stats.avgCompletion}%`, icon: BarChart3, color: "text-primary" },
  ];

  return (
    <div dir="rtl">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-6">لوحة التحكم</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
