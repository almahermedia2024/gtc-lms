import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface ProgressRow {
  student_id: string;
  student_name: string;
  course_title: string;
  lecture_title: string;
  watched_seconds: number;
  completion_percentage: number;
  last_watched_at: string | null;
  open_count: number;
}

interface CourseOverview {
  id: string;
  title: string;
  studentCount: number;
  lectureCount: number;
  avgCompletion: number;
}

interface StudentOverview {
  id: string;
  name: string;
  courseCount: number;
  lectureCount: number;
  avgCompletion: number;
  totalMinutes: number;
}

export default function AdminReports() {
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [courseFilter, setCourseFilter] = useState("all");
  const [courseOverviews, setCourseOverviews] = useState<CourseOverview[]>([]);
  const [studentOverviews, setStudentOverviews] = useState<StudentOverview[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: lecs }, { data: progress }, { data: coursesData }, { data: courseStudents }] = await Promise.all([
        supabase.from("lectures").select("id, title, course_id"),
        supabase.from("watch_progress").select("student_id, lecture_id, watched_seconds, completion_percentage, last_watched_at, open_count"),
        supabase.from("courses").select("id, title"),
        supabase.from("course_students").select("course_id, student_id"),
      ]);

      setCourses(coursesData || []);

      const lectureMap = new Map((lecs || []).map((l) => [l.id, l]));
      const courseMap = new Map((coursesData || []).map((c) => [c.id, c.title]));

      const studentIds = [...new Set((progress || []).map((p) => p.student_id))];
      const allStudentIds = [...new Set([...studentIds, ...(courseStudents || []).map(cs => cs.student_id)])];
      
      const { data: profiles } = allStudentIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", allStudentIds)
        : { data: [] };
      const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

      // Build progress rows
      const progressRows = (progress || []).map((p) => {
        const lec = lectureMap.get(p.lecture_id);
        const courseTitle = lec?.course_id ? (courseMap.get(lec.course_id) || "بدون كورس") : "بدون كورس";
        return {
          student_id: p.student_id,
          student_name: nameMap.get(p.student_id) || p.student_id.slice(0, 8) + "...",
          course_title: courseTitle,
          lecture_title: lec?.title || "غير معروف",
          watched_seconds: p.watched_seconds || 0,
          completion_percentage: p.completion_percentage || 0,
          last_watched_at: p.last_watched_at,
          open_count: p.open_count || 0,
        };
      });
      setRows(progressRows);

      // Course overviews
      const cOverviews: CourseOverview[] = (coursesData || []).map(c => {
        const lecIds = (lecs || []).filter(l => l.course_id === c.id).map(l => l.id);
        const csCount = (courseStudents || []).filter(cs => cs.course_id === c.id).length;
        const relevantProgress = (progress || []).filter(p => lecIds.includes(p.lecture_id));
        const avg = relevantProgress.length
          ? relevantProgress.reduce((s, p) => s + (p.completion_percentage || 0), 0) / relevantProgress.length
          : 0;
        return { id: c.id, title: c.title, studentCount: csCount, lectureCount: lecIds.length, avgCompletion: Math.round(avg) };
      });
      setCourseOverviews(cOverviews);

      // Student overviews
      const studentMap = new Map<string, { courseIds: Set<string>; lectureIds: Set<string>; totalSec: number; totalComp: number; count: number }>();
      (courseStudents || []).forEach(cs => {
        const entry = studentMap.get(cs.student_id) || { courseIds: new Set(), lectureIds: new Set(), totalSec: 0, totalComp: 0, count: 0 };
        entry.courseIds.add(cs.course_id);
        studentMap.set(cs.student_id, entry);
      });
      progressRows.forEach(r => {
        const entry = studentMap.get(r.student_id) || { courseIds: new Set(), lectureIds: new Set(), totalSec: 0, totalComp: 0, count: 0 };
        entry.lectureIds.add(r.lecture_title);
        entry.totalSec += r.watched_seconds;
        entry.totalComp += r.completion_percentage;
        entry.count += 1;
        studentMap.set(r.student_id, entry);
      });
      const sOverviews: StudentOverview[] = Array.from(studentMap.entries()).map(([sid, data]) => ({
        id: sid,
        name: nameMap.get(sid) || sid.slice(0, 8) + "...",
        courseCount: data.courseIds.size,
        lectureCount: data.lectureIds.size,
        avgCompletion: data.count ? Math.round(data.totalComp / data.count) : 0,
        totalMinutes: Math.round(data.totalSec / 60),
      }));
      setStudentOverviews(sOverviews);
    };
    fetchData();
  }, []);

  const filtered = courseFilter === "all" ? rows : rows.filter((r) => r.course_title === courseFilter);
  const attendanceRows = filtered.filter((r) => r.open_count > 0).sort((a, b) => {
    const dateA = a.last_watched_at ? new Date(a.last_watched_at).getTime() : 0;
    const dateB = b.last_watched_at ? new Date(b.last_watched_at).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold">التقارير والإحصائيات</h1>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="كل الكورسات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الكورسات</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.title}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="courses" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="courses">نظرة عامة - الكورسات</TabsTrigger>
          <TabsTrigger value="students">نظرة عامة - الطلاب</TabsTrigger>
          <TabsTrigger value="attendance">سجل الحضور</TabsTrigger>
          <TabsTrigger value="progress">تقدم المشاهدة</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
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
                  {courseOverviews.map((c) => (
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
                  {!courseOverviews.length && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد كورسات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">إحصائيات الطلاب</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-right">الكورسات</TableHead>
                    <TableHead className="text-right">المحاضرات</TableHead>
                    <TableHead className="text-right">وقت المشاهدة</TableHead>
                    <TableHead className="text-right">متوسط الإكمال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentOverviews.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.courseCount}</TableCell>
                      <TableCell>{s.lectureCount}</TableCell>
                      <TableCell>{s.totalMinutes} دقيقة</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={s.avgCompletion} className="w-20 h-2" />
                          <span className="text-xs">{s.avgCompletion}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!studentOverviews.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">من دخل للمحاضرة ومتى</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-right">الكورس</TableHead>
                    <TableHead className="text-right">المحاضرة</TableHead>
                    <TableHead className="text-right">مرات الدخول</TableHead>
                    <TableHead className="text-right">آخر دخول</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.student_name}</TableCell>
                      <TableCell>{r.course_title}</TableCell>
                      <TableCell>{r.lecture_title}</TableCell>
                      <TableCell>{r.open_count}</TableCell>
                      <TableCell className="text-sm">
                        {r.last_watched_at
                          ? new Date(r.last_watched_at).toLocaleString("ar", {
                              year: "numeric", month: "short", day: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.completion_percentage >= 90 ? "default" : r.completion_percentage > 0 ? "secondary" : "outline"}>
                          {r.completion_percentage >= 90 ? "مكتمل" : r.completion_percentage > 0 ? "جاري" : "دخل فقط"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!attendanceRows.length && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد بيانات حضور</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-right">الكورس</TableHead>
                    <TableHead className="text-right">المحاضرة</TableHead>
                    <TableHead className="text-right">وقت المشاهدة</TableHead>
                    <TableHead className="text-right">نسبة الإكمال</TableHead>
                    <TableHead className="text-right">آخر مشاهدة</TableHead>
                    <TableHead className="text-right">مرات الفتح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.student_name}</TableCell>
                      <TableCell>{r.course_title}</TableCell>
                      <TableCell>{r.lecture_title}</TableCell>
                      <TableCell>{Math.round(r.watched_seconds / 60)} دقيقة</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${r.completion_percentage}%` }} />
                          </div>
                          <span className="text-xs">{Math.round(r.completion_percentage)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.last_watched_at ? new Date(r.last_watched_at).toLocaleDateString("ar") : "—"}
                      </TableCell>
                      <TableCell>{r.open_count}</TableCell>
                    </TableRow>
                  ))}
                  {!filtered.length && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
