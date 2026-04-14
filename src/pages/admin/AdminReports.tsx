import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

      // Get student names
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

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold">التقارير</h1>
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
    </div>
  );
}
