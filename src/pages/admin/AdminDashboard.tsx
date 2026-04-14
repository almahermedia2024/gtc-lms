import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Video, BarChart3, Eye, BookOpen } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

interface CourseStats {
  id: string;
  title: string;
  lectureCount: number;
  studentCount: number;
  avgCompletion: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ students: 0, lectures: 0, courses: 0, totalWatched: 0, avgCompletion: 0 });
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: studentCount }, { count: lectureCount }, { count: courseCount }, { data: progress }, { data: courses }, { data: lectures }, { data: courseStudents }] = await Promise.all([
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("lectures").select("*", { count: "exact", head: true }),
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("watch_progress").select("watched_seconds, completion_percentage, lecture_id"),
        supabase.from("courses").select("id, title"),
        supabase.from("lectures").select("id, course_id"),
        supabase.from("course_students").select("course_id, student_id"),
      ]);

      const totalWatched = (progress || []).reduce((sum, p) => sum + (p.watched_seconds || 0), 0);
      const avgCompletion = progress?.length
        ? (progress.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / progress.length)
        : 0;

      setStats({
        students: studentCount || 0,
        lectures: lectureCount || 0,
        courses: courseCount || 0,
        totalWatched: Math.round(totalWatched / 60),
        avgCompletion: Math.round(avgCompletion),
      });

      // Build per-course stats
      const lecturesByCourse = new Map<string, string[]>();
      (lectures || []).forEach(l => {
        if (l.course_id) {
          const arr = lecturesByCourse.get(l.course_id) || [];
          arr.push(l.id);
          lecturesByCourse.set(l.course_id, arr);
        }
      });

      const studentsByCourse = new Map<string, number>();
      (courseStudents || []).forEach(cs => {
        studentsByCourse.set(cs.course_id, (studentsByCourse.get(cs.course_id) || 0) + 1);
      });

      const cStats: CourseStats[] = (courses || []).map(c => {
        const lecIds = lecturesByCourse.get(c.id) || [];
        const relevantProgress = (progress || []).filter(p => lecIds.includes(p.lecture_id));
        const avg = relevantProgress.length
          ? relevantProgress.reduce((s, p) => s + (p.completion_percentage || 0), 0) / relevantProgress.length
          : 0;
        return {
          id: c.id,
          title: c.title,
          lectureCount: lecIds.length,
          studentCount: studentsByCourse.get(c.id) || 0,
          avgCompletion: Math.round(avg),
        };
      });
      setCourseStats(cStats);
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "الكورسات", value: stats.courses, icon: BookOpen, color: "text-primary" },
    { title: "الطلاب", value: stats.students, icon: Users, color: "text-secondary" },
    { title: "المحاضرات", value: stats.lectures, icon: Video, color: "text-accent" },
    { title: "إجمالي المشاهدة (دقيقة)", value: stats.totalWatched, icon: Eye, color: "text-primary" },
    { title: "متوسط الإكمال %", value: `${stats.avgCompletion}%`, icon: BarChart3, color: "text-secondary" },
  ];

  return (
    <div dir="rtl">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-6">لوحة التحكم</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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

      {courseStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">إحصائيات الكورسات</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الكورس</TableHead>
                  <TableHead className="text-right">المحاضرات</TableHead>
                  <TableHead className="text-right">الطلاب</TableHead>
                  <TableHead className="text-right">متوسط الإكمال</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseStats.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{c.lectureCount}</TableCell>
                    <TableCell>{c.studentCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={c.avgCompletion} className="w-20 h-2" />
                        <span className="text-xs">{c.avgCompletion}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
