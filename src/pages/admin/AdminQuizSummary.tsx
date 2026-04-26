import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, ClipboardList, AlertTriangle, CheckCircle2, XCircle, Users, TrendingUp, ListChecks } from "lucide-react";
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

  const getPercentageColor = (pct: number) => {
    if (pct >= 75) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 75) return "[&>div]:bg-emerald-500";
    if (pct >= 50) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-destructive";
  };

  const getDifficultyBadge = (pct: number, attempts: number) => {
    if (attempts === 0) return null;
    if (pct >= 75) return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">سهل</Badge>;
    if (pct >= 50) return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20">متوسط</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">صعب</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary via-primary to-secondary p-6 text-primary-foreground shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.25),transparent_50%)]" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
              <ClipboardList className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading">ملخص الاختبارات</h1>
              <p className="text-sm text-primary-foreground/80 mt-1">
                ترتيب الأسئلة بحسب الأكثر تسبباً بالأخطاء
              </p>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={loadingCourses}>
              <SelectTrigger className="bg-white/15 backdrop-blur-sm border-white/20 text-primary-foreground hover:bg-white/20">
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-r-4 border-r-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground font-normal">عدد الأسئلة</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10">
              <ListChecks className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{summary.totalQuestions}</div>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-secondary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground font-normal">أسئلة تمت الإجابة عليها</CardTitle>
            <div className="p-2 rounded-lg bg-secondary/10">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">{summary.answeredQuestions}</div>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-accent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground font-normal">إجمالي المحاولات</CardTitle>
            <div className="p-2 rounded-lg bg-accent/10">
              <Users className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{summary.totalAttemptsSum}</div>
          </CardContent>
        </Card>
        <Card className={`border-r-4 shadow-sm hover:shadow-md transition-shadow ${
          summary.avgCorrect >= 75 ? "border-r-emerald-500" : summary.avgCorrect >= 50 ? "border-r-amber-500" : "border-r-destructive"
        }`}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground font-normal">متوسط نسبة الصواب</CardTitle>
            <div className={`p-2 rounded-lg ${
              summary.avgCorrect >= 75 ? "bg-emerald-500/10" : summary.avgCorrect >= 50 ? "bg-amber-500/10" : "bg-destructive/10"
            }`}>
              <TrendingUp className={`h-4 w-4 ${getPercentageColor(summary.avgCorrect)}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getPercentageColor(summary.avgCorrect)}`}>
              {summary.avgCorrect.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            الأسئلة الأكثر تسبباً بالأخطاء
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-right w-12">#</TableHead>
                    <TableHead className="text-right">السؤال</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الصعوبة</TableHead>
                    <TableHead className="text-right">المحاولات</TableHead>
                    <TableHead className="text-right">صحيح</TableHead>
                    <TableHead className="text-right">خطأ</TableHead>
                    <TableHead className="text-right w-48">نسبة الصواب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((s, idx) => (
                    <TableRow key={s.question_id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="line-clamp-2 font-medium">{s.question_text}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                          {typeLabels[s.question_type]}
                        </Badge>
                      </TableCell>
                      <TableCell>{getDifficultyBadge(s.correct_percentage, s.total_attempts)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {s.total_attempts}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {s.correct_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                          <XCircle className="h-3.5 w-3.5" />
                          {s.wrong_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        {s.total_attempts === 0 ? (
                          <span className="text-xs text-muted-foreground">لا توجد محاولات</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={s.correct_percentage}
                              className={`h-2 flex-1 ${getProgressColor(s.correct_percentage)}`}
                            />
                            <span className={`text-xs font-bold w-12 text-left ${getPercentageColor(s.correct_percentage)}`}>
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
