import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight,
  Trophy,
  AlertCircle,
  Timer,
} from "lucide-react";

type QuestionType = "single" | "multiple" | "true_false";

interface QuestionWithOptions {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: { id: string; option_text: string }[];
}

interface ReviewItem {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  selected_option_texts: string[];
  correct_option_texts: string[];
  is_correct: boolean;
}

interface CourseInfo {
  id: string;
  title: string;
  quiz_duration_minutes: number;
}

type Stage = "loading" | "locked" | "intro" | "in_progress" | "submitted" | "no_quiz";

export default function StudentQuiz() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("loading");
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  // answers: question_id -> array of selected option ids
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    percentage: number;
    autoSubmitted?: boolean;
  } | null>(null);
  const [progressInfo, setProgressInfo] = useState<{
    completed: number;
    total: number;
  }>({ completed: 0, total: 0 });
  const [previousAttempt, setPreviousAttempt] = useState<{
    correct_answers: number;
    total_questions: number;
    percentage: number;
  } | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number>(0); // seconds
  const answersRef = useRef<Record<string, string[]>>({});
  const submittedRef = useRef(false);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!courseId || !user) return;
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user]);

  const initialize = async () => {
    if (!courseId || !user) return;
    setStage("loading");

    const { data: courseData } = await supabase
      .from("courses")
      .select("id, title, quiz_duration_minutes")
      .eq("id", courseId)
      .maybeSingle();

    if (!courseData) {
      toast({ title: "الكورس غير موجود", variant: "destructive" });
      navigate("/student");
      return;
    }
    setCourse(courseData);

    const { data: enrollment } = await supabase
      .from("course_students")
      .select("id")
      .eq("course_id", courseId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (!enrollment) {
      toast({ title: "أنت غير مسجل في هذا الكورس", variant: "destructive" });
      navigate("/student");
      return;
    }

    const { data: lectures } = await supabase
      .from("lectures")
      .select("id")
      .eq("course_id", courseId);

    const lectureIds = (lectures || []).map((l) => l.id);

    if (lectureIds.length === 0) {
      setStage("no_quiz");
      return;
    }

    const { data: progress } = await supabase
      .from("watch_progress")
      .select("lecture_id, completion_percentage")
      .eq("student_id", user.id)
      .in("lecture_id", lectureIds);

    const progressMap = new Map(
      (progress || []).map((p) => [p.lecture_id, p.completion_percentage || 0])
    );
    const completedCount = lectureIds.filter(
      (id) => (progressMap.get(id) || 0) >= 90
    ).length;

    setProgressInfo({ completed: completedCount, total: lectureIds.length });

    if (completedCount < lectureIds.length) {
      setStage("locked");
      return;
    }

    const { data: qs } = await supabase
      .from("quiz_questions")
      .select("id, question_text, question_order, question_type")
      .eq("course_id", courseId)
      .order("question_order", { ascending: true });

    if (!qs || qs.length === 0) {
      setStage("no_quiz");
      return;
    }

    const { data: opts, error: optsErr } = await supabase.rpc(
      "get_quiz_options_for_student",
      { _course_id: courseId }
    );
    if (optsErr) {
      toast({ title: "خطأ في تحميل الخيارات", description: optsErr.message, variant: "destructive" });
      navigate("/student");
      return;
    }

    const optsByQ = new Map<string, QuestionWithOptions["options"]>();
    (opts || []).forEach((o) => {
      const arr = optsByQ.get(o.question_id) || [];
      arr.push({
        id: o.id,
        option_text: o.option_text,
      });
      optsByQ.set(o.question_id, arr);
    });

    setQuestions(
      qs.map((q) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: ((q as { question_type?: QuestionType }).question_type) || "single",
        options: optsByQ.get(q.id) || [],
      }))
    );

    const { data: attempts } = await supabase
      .from("quiz_attempts")
      .select("correct_answers, total_questions, percentage, completed_at")
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1);

    if (attempts && attempts.length > 0) {
      setPreviousAttempt({
        correct_answers: attempts[0].correct_answers,
        total_questions: attempts[0].total_questions,
        percentage: attempts[0].percentage,
      });
    }

    setStage("intro");
  };

  const handleStart = () => {
    setAnswers({});
    answersRef.current = {};
    submittedRef.current = false;
    const minutes = course?.quiz_duration_minutes ?? 30;
    setTimeLeft(minutes * 60);
    setStage("in_progress");
  };

  const setSingleAnswer = (questionId: string, optionId: string) => {
    setAnswers((p) => ({ ...p, [questionId]: [optionId] }));
  };

  const toggleMultiAnswer = (questionId: string, optionId: string) => {
    setAnswers((p) => {
      const current = p[questionId] || [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...p, [questionId]: next };
    });
  };

  const handleSubmit = async (auto = false) => {
    if (!user || !courseId) return;
    if (submittedRef.current) return;

    const currentAnswers = auto ? answersRef.current : answers;

    if (!auto) {
      const unanswered = questions.filter(
        (q) => !currentAnswers[q.id] || currentAnswers[q.id].length === 0
      );
      if (unanswered.length > 0) {
        toast({
          title: `هناك ${unanswered.length} سؤال بدون إجابة`,
          variant: "destructive",
        });
        return;
      }
    }

    submittedRef.current = true;
    setSubmitting(true);

    const answersPayload = questions.map((q) => ({
      question_id: q.id,
      selected_option_ids: currentAnswers[q.id] || [],
    }));

    const { data: rpcData, error: rpcErr } = await supabase.rpc("submit_quiz_attempt", {
      _course_id: courseId,
      _answers: answersPayload,
    });

    if (rpcErr || !rpcData || rpcData.length === 0) {
      toast({
        title: "خطأ في حفظ المحاولة",
        description: rpcErr?.message,
        variant: "destructive",
      });
      submittedRef.current = false;
      setSubmitting(false);
      return;
    }

    const row = rpcData[0];
    const correctCount = row.correct_answers;
    const total = row.total_questions;
    const pct = row.percentage;

    const { data: reviewData } = await supabase.rpc("get_quiz_review", {
      _attempt_id: row.attempt_id,
    });

    const reviewItems: ReviewItem[] = (reviewData || []).map((r) => ({
      question_id: r.question_id,
      question_text: r.question_text,
      question_type: (r.question_type as QuestionType) || "single",
      selected_option_texts: r.selected_option_texts || [],
      correct_option_texts: r.correct_option_texts || [],
      is_correct: r.is_correct,
    }));
    setReview(reviewItems);

    if (auto) {
      toast({
        title: "انتهى الوقت",
        description: "تم حفظ إجاباتك تلقائياً.",
      });
    }

    setResult({ correct: correctCount, total, percentage: pct, autoSubmitted: auto });
    setStage("submitted");
    setSubmitting(false);
  };

  // Countdown timer
  useEffect(() => {
    if (stage !== "in_progress") return;
    if (timeLeft <= 0) {
      void handleSubmit(true);
      return;
    }
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          void handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const questionTypeLabel = (t: QuestionType) =>
    t === "multiple"
      ? "اختر كل الإجابات الصحيحة"
      : t === "true_false"
        ? "صح / خطأ"
        : "اختر إجابة واحدة";

  if (stage === "loading") {
    return (
      <div className="flex items-center justify-center py-20" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-4xl mx-auto animate-fade-in">
      <button
        onClick={() => navigate("/student")}
        className="text-primary hover:underline mb-4 text-sm font-medium flex items-center gap-1"
      >
        <ArrowRight className="w-4 h-4" />
        العودة للمحاضرات
      </button>

      {stage === "locked" && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-secondary" />
            </div>
            <h2 className="text-xl font-heading font-bold mb-2">الاختبار مغلق</h2>
            <p className="text-muted-foreground mb-4">
              يجب إكمال مشاهدة جميع محاضرات الكورس قبل بدء الاختبار
            </p>
            <Badge variant="secondary" className="text-base px-4 py-1">
              {progressInfo.completed} / {progressInfo.total} محاضرة مكتملة
            </Badge>
            <div className="mt-6">
              <Button onClick={() => navigate("/student")}>
                العودة للمحاضرات
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stage === "no_quiz" && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-heading font-bold mb-2">لا يوجد اختبار حالياً</h2>
            <p className="text-muted-foreground mb-4">
              لم يتم إضافة أسئلة اختبار لهذا الكورس بعد
            </p>
            <Button onClick={() => navigate("/student")}>العودة للمحاضرات</Button>
          </CardContent>
        </Card>
      )}

      {stage === "intro" && course && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-heading flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              اختبار: {course.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold font-heading text-primary">{questions.length}</p>
                <p className="text-sm text-muted-foreground">سؤال</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold font-heading text-accent">متنوعة</p>
                <p className="text-sm text-muted-foreground">أنواع الأسئلة</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold font-heading text-secondary flex items-center justify-center gap-1">
                  <Timer className="w-5 h-5" />
                  {course.quiz_duration_minutes}
                </p>
                <p className="text-sm text-muted-foreground">دقيقة</p>
              </div>
            </div>

            {previousAttempt && (
              <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">
                    لقد أجريت هذا الاختبار من قبل
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mb-1">نتيجتك:</p>
                <p className="font-semibold">
                  {previousAttempt.correct_answers} / {previousAttempt.total_questions} (
                  {Math.round(previousAttempt.percentage)}%)
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  مسموح بمحاولة واحدة فقط لكل طالب، ولا يمكن إعادة الاختبار.
                </p>
              </div>
            )}

            <div className="text-sm text-muted-foreground space-y-1">
              <p>• الأسئلة قد تكون اختيار من متعدد، اختيار متعدد الإجابات، أو صح/خطأ</p>
              <p>• في أسئلة "اختيار متعدد الإجابات" يجب اختيار جميع الإجابات الصحيحة دون أي إجابة خاطئة</p>
              <p>• مدة الاختبار {course.quiz_duration_minutes} دقيقة، يبدأ العد التنازلي عند الضغط على "بدء الاختبار"</p>
              <p>• عند انتهاء الوقت تُحفظ إجاباتك تلقائياً وتظهر النتيجة</p>
              <p className="text-destructive">• لديك محاولة واحدة فقط، لا يمكن إعادة الاختبار بعد تسليمه</p>
            </div>

            <Button
              onClick={handleStart}
              className="w-full"
              size="lg"
              disabled={!!previousAttempt}
            >
              {previousAttempt ? "تم استخدام محاولتك" : "بدء الاختبار"}
            </Button>
          </CardContent>
        </Card>
      )}

      {stage === "in_progress" && (
        <div className="space-y-4">
          <Card className="sticky top-4 z-10 backdrop-blur-sm bg-background/80">
            <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-medium">
                تم الإجابة:{" "}
                <span className="text-primary font-bold">
                  {Object.values(answers).filter((a) => a.length > 0).length} / {questions.length}
                </span>
              </span>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-mono font-bold text-base ${
                  timeLeft <= 60
                    ? "bg-destructive/10 text-destructive animate-pulse"
                    : timeLeft <= 300
                      ? "bg-secondary/15 text-secondary"
                      : "bg-primary/10 text-primary"
                }`}
              >
                <Timer className="w-4 h-4" />
                {formatTime(timeLeft)}
              </div>
            </CardContent>
          </Card>

          {questions.map((q, idx) => {
            const selected = answers[q.id] || [];
            const isMulti = q.question_type === "multiple";
            return (
              <Card key={q.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">
                      {idx + 1}
                    </Badge>
                    <div className="flex-1">
                      <span className="leading-relaxed block">{q.question_text}</span>
                      <Badge variant="secondary" className="mt-2 text-xs font-normal">
                        {questionTypeLabel(q.question_type)}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isMulti ? (
                    <div className="space-y-2" dir="rtl">
                      {q.options.map((o) => {
                        const checked = selected.includes(o.id);
                        return (
                          <div
                            key={o.id}
                            className={`flex items-center gap-3 p-3 rounded-md border transition-colors cursor-pointer ${
                              checked
                                ? "border-primary/60 bg-primary/5"
                                : "border-border/50 hover:bg-muted/50"
                            }`}
                            onClick={() => toggleMultiAnswer(q.id, o.id)}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleMultiAnswer(q.id, o.id)}
                              id={`${q.id}-${o.id}`}
                            />
                            <Label
                              htmlFor={`${q.id}-${o.id}`}
                              className="flex-1 cursor-pointer font-normal"
                            >
                              {o.option_text}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <RadioGroup
                      value={selected[0] || ""}
                      onValueChange={(val) => setSingleAnswer(q.id, val)}
                      dir="rtl"
                    >
                      {q.options.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center gap-3 p-3 rounded-md border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => setSingleAnswer(q.id, o.id)}
                        >
                          <RadioGroupItem value={o.id} id={`${q.id}-${o.id}`} />
                          <Label
                            htmlFor={`${q.id}-${o.id}`}
                            className="flex-1 cursor-pointer font-normal"
                          >
                            {o.option_text}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardContent className="py-4">
              <Button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="w-full"
                size="lg"
              >
                {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                إنهاء الاختبار وعرض النتيجة
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {stage === "submitted" && result && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <div
              className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                result.percentage >= 50
                  ? "bg-accent/10 text-accent"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {result.percentage >= 50 ? (
                <Trophy className="w-10 h-10" />
              ) : (
                <XCircle className="w-10 h-10" />
              )}
            </div>
            <h2 className="text-2xl font-heading font-bold mb-2">
              {result.percentage >= 50 ? "أحسنت!" : "حاول مرة أخرى"}
            </h2>
            {result.autoSubmitted ? (
              <div className="mb-6 p-3 rounded-lg bg-secondary/10 border border-secondary/30 text-sm flex items-center justify-center gap-2">
                <Timer className="w-4 h-4 text-secondary" />
                <span>انتهى الوقت، تم حفظ إجاباتك تلقائياً.</span>
              </div>
            ) : (
              <p className="text-muted-foreground mb-6">نتيجتك في الاختبار</p>
            )}

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold font-heading text-accent">{result.correct}</p>
                <p className="text-xs text-muted-foreground">إجابات صحيحة</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold font-heading text-destructive">
                  {result.total - result.correct}
                </p>
                <p className="text-xs text-muted-foreground">إجابات خاطئة</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold font-heading text-primary">
                  {Math.round(result.percentage)}%
                </p>
                <p className="text-xs text-muted-foreground">النسبة</p>
              </div>
            </div>

            <div className="space-y-3 text-right mb-6">
              {review.map((r, idx) => {
                const isCorrect = r.is_correct;
                const yourAnswer = r.selected_option_texts.length > 0
                  ? r.selected_option_texts.join("، ")
                  : "—";
                const correctAnswer = r.correct_option_texts.join("، ");
                return (
                  <div
                    key={r.question_id}
                    className={`p-3 rounded-lg border ${
                      isCorrect
                        ? "border-accent/30 bg-accent/5"
                        : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-1" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive shrink-0 mt-1" />
                      )}
                      <p className="text-sm font-medium">
                        {idx + 1}. {r.question_text}
                      </p>
                    </div>
                    <div className="text-xs space-y-1 pr-6">
                      <p>
                        إجابتك:{" "}
                        <span className={isCorrect ? "text-accent" : "text-destructive"}>
                          {yourAnswer}
                        </span>
                      </p>
                      {!isCorrect && correctAnswer && (
                        <p>
                          الإجابة الصحيحة:{" "}
                          <span className="text-accent">{correctAnswer}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate("/student")}>
                العودة للمحاضرات
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
