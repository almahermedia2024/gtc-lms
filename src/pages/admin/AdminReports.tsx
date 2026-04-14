import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProgressRow {
  student_id: string;
  student_name: string;
  lecture_title: string;
  watched_seconds: number;
  completion_percentage: number;
  last_watched_at: string | null;
  open_count: number;
}

export default function AdminReports() {
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [lectures, setLectures] = useState<{ id: string; title: string }[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetch = async () => {
      const { data: lecs } = await supabase.from("lectures").select("id, title");
      setLectures(lecs || []);

      const { data: progress } = await supabase
        .from("watch_progress")
        .select("student_id, lecture_id, watched_seconds, completion_percentage, last_watched_at, open_count");

      const lectureMap = new Map((lecs || []).map((l) => [l.id, l.title]));

      const studentIds = [...new Set((progress || []).map((p) => p.student_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", studentIds);
      const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

      setRows(
        (progress || []).map((p) => ({
          student_id: p.student_id,
          student_name: nameMap.get(p.student_id) || p.student_id.slice(0, 8) + "...",
          lecture_title: lectureMap.get(p.lecture_id) || "غير معروف",
          watched_seconds: p.watched_seconds || 0,
          completion_percentage: p.completion_percentage || 0,
          last_watched_at: p.last_watched_at,
          open_count: p.open_count || 0,
        }))
      );
    };
    fetch();
  }, []);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.lecture_title === filter);

  // Attendance view: who entered each lecture and when
  const attendanceRows = rows.filter((r) => r.open_count > 0).sort((a, b) => {
    const dateA = a.last_watched_at ? new Date(a.last_watched_at).getTime() : 0;
    const dateB = b.last_watched_at ? new Date(b.last_watched_at).getTime() : 0;
    return dateB - dateA;
  });
  const filteredAttendance = filter === "all" ? attendanceRows : attendanceRows.filter((r) => r.lecture_title === filter);

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold">التقارير والحضور</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="كل المحاضرات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المحاضرات</SelectItem>
            {lectures.map((l) => (
              <SelectItem key={l.id} value={l.title}>{l.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="attendance" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="attendance">سجل الحضور</TabsTrigger>
          <TabsTrigger value="progress">تقدم المشاهدة</TabsTrigger>
        </TabsList>

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
                    <TableHead className="text-right">المحاضرة</TableHead>
                    <TableHead className="text-right">مرات الدخول</TableHead>
                    <TableHead className="text-right">آخر دخول</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.student_name}</TableCell>
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
                  {!filteredAttendance.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد بيانات حضور</TableCell></TableRow>
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
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
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
