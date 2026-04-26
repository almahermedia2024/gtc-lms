import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, ClipboardList, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Course {
  id: string;
  title: string;
}

interface QuestionStat {
  question_id: string;
  question_text: string;
  question_order: number;
  question_type: "single" | "multiple" | "true_false";
  total_attempts: number;
  correct_count: number;
  wrong_count: number;
  correct_percentage: number;
  wrong_percentage: number;
}

const typeLabels: Record<QuestionStat["question_type"], string> = {
  single: "اختيار واحد",
  multiple: "اختيار متعدد",
  true_false: "صح / خطأ",
};

export default function AdminQuizSummary() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [stats, setStats] = useState<QuestionStat[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("فشل تحميل الكورسات");
      } else {
        setCourses(data || []);
        if (data && data.length > 0) setSelectedCourse(data[0].id);
      }
      setLoadingCourses(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    (async () => {
      setLoadingStats(true);
      const { data, error } = await supabase.rpc("get_quiz_question_stats", {
        _course_id: selectedCourse,
      });
      if (error) {
        toast.error("فشل تحميل الإحصائيات");
        setStats([]);
      } else {
        setStats((data || []) as QuestionStat[]);
      }
      setLoadingStats(false);
    })();
  }, [selectedCourse]);

  const summary = useMemo(() => {
    const totalQuestions = stats.length;
    const answeredQuestions = stats.filter((s) => s.total_attempts > 0).length;
    const totalAttemptsSum = stats.reduce((acc, s) => acc + s.total_attempts, 0);
    const totalCorrectSum = stats.reduce((acc, s) => acc + s.correct_count, 0);
    const avgCorrect =
      totalAttemptsSum > 0 ? (totalCorrectSum / totalAttemptsSum) * 100 : 0;
    return { totalQuestions, answeredQuestions, totalAttemptsSum, avgCorrect };
  }, [stats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">ملخص الاختبارات</h1>
            <p className="text-sm text-muted-foreground">
              ترتيب الأسئلة بحسب الأكثر تسبباً بالأخطاء
            </p>
          </div>
        </div>

        <div className="w-full sm:w-72">
          <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={loadingCourses}>
            <SelectTrigger>
              <SelectValue placeholder="اختر كورس" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">عدد الأسئلة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalQuestions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">أسئلة تمت الإجابة عليها</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.answeredQuestions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">إجمالي المحاولات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAttemptsSum}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">متوسط نسبة الصواب</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgCorrect.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            الأسئلة الأكثر تسبباً بالأخطاء
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : stats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              لا توجد أسئلة لهذا الكورس
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-12">#</TableHead>
                    <TableHead className="text-right">السؤال</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المحاولات</TableHead>
                    <TableHead className="text-right">صحيح</TableHead>
                    <TableHead className="text-right">خطأ</TableHead>
                    <TableHead className="text-right w-48">نسبة الصواب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((s, idx) => (
                    <TableRow key={s.question_id}>
                      <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="line-clamp-2">{s.question_text}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[s.question_type]}</Badge>
                      </TableCell>
                      <TableCell>{s.total_attempts}</TableCell>
                      <TableCell className="text-green-600 font-medium">{s.correct_count}</TableCell>
                      <TableCell className="text-destructive font-medium">{s.wrong_count}</TableCell>
                      <TableCell>
                        {s.total_attempts === 0 ? (
                          <span className="text-xs text-muted-foreground">لا توجد محاولات</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Progress value={s.correct_percentage} className="h-2 flex-1" />
                            <span className="text-xs font-medium w-12 text-left">
                              {s.correct_percentage.toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
