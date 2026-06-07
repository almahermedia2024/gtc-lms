import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, XCircle, RotateCcw, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  option_text: string;
  is_correct: boolean;
  option_order: number;
}
interface Question {
  id: string;
  question_text: string;
  options: Option[];
}

export default function StudentLectureQuiz() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lectureTitle, setLectureTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!lectureId) return;
    (async () => {
      setLoading(true);
      const { data: lec } = await supabase.from("lectures").select("title").eq("id", lectureId).maybeSingle();
      if (lec) setLectureTitle(lec.title);
      const { data: qs } = await supabase
        .from("lecture_quiz_questions")
        .select("*")
        .eq("lecture_id", lectureId)
        .order("question_order");
      const ids = (qs || []).map((q) => q.id);
      let optsByQ = new Map<string, Option[]>();
      if (ids.length) {
        const { data: opts } = await supabase
          .from("lecture_quiz_options")
          .select("*")
          .in("question_id", ids)
          .order("option_order");
        (opts || []).forEach((o) => {
          const arr = optsByQ.get(o.question_id) || [];
          arr.push(o);
          optsByQ.set(o.question_id, arr);
        });
      }
      setQuestions(
        (qs || []).map((q) => ({
          id: q.id,
          question_text: q.question_text,
          options: optsByQ.get(q.id) || [],
        }))
      );
      setLoading(false);
    })();
  }, [lectureId]);

  const toggle = (qid: string, oid: string) => {
    if (checked[qid]) return;
    setAnswers((prev) => {
      const set = new Set(prev[qid] || []);
      if (set.has(oid)) set.delete(oid);
      else set.add(oid);
      return { ...prev, [qid]: set };
    });
  };

  const checkQuestion = (qid: string) => {
    setChecked((prev) => ({ ...prev, [qid]: true }));
  };

  const isQuestionCorrect = (q: Question) => {
    const selected = answers[q.id] || new Set<string>();
    const correctIds = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
    if (selected.size !== correctIds.size) return false;
    for (const id of selected) if (!correctIds.has(id)) return false;
    return true;
  };

  const submit = () => {
    const allChecked: Record<string, boolean> = {};
    questions.forEach((q) => (allChecked[q.id] = true));
    setChecked(allChecked);
    setSubmitted(true);
  };

  const reset = () => {
    setAnswers({});
    setChecked({});
    setSubmitted(false);
  };

  const correctCount = questions.filter(isQuestionCorrect).length;
  const allAnswered = questions.every((q) => (answers[q.id]?.size || 0) > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div dir="rtl" className="text-center py-16">
        <p className="text-muted-foreground mb-4">لا يوجد كويز لهذه المحاضرة بعد.</p>
        <Button asChild variant="outline"><Link to="/student">← العودة للمحاضرات</Link></Button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-3xl mx-auto animate-fade-in">
      <Link to="/student" className="text-primary hover:underline text-sm font-medium">← العودة للمحاضرات</Link>
      <h1 className="text-2xl font-heading font-bold mt-2 mb-1">كويز: {lectureTitle}</h1>
      <p className="text-sm text-muted-foreground mb-6">للقياس فقط — لا يؤثر على درجاتك أو تقدمك.</p>

      {submitted && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-muted-foreground">نتيجتك</p>
              <p className="text-3xl font-heading font-bold text-primary">
                {correctCount} <span className="text-lg text-muted-foreground">من {questions.length} صحيحة</span>
              </p>
            </div>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 ml-2" />إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {questions.map((q, idx) => {
          const isChecked = checked[q.id];
          const selected = answers[q.id] || new Set<string>();
          const correct = isQuestionCorrect(q);
          return (
            <Card key={q.id} className={cn(isChecked && (correct ? "border-green-500/50" : "border-destructive/50"))}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-start gap-2">
                  <span>السؤال {idx + 1}.</span>
                  <span className="flex-1">{q.question_text}</span>
                  {isChecked && (correct
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    : <XCircle className="w-5 h-5 text-destructive shrink-0" />)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {q.options.map((o) => {
                  const isSelected = selected.has(o.id);
                  const showState = isChecked && (isSelected || o.is_correct);
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors",
                        !isChecked && "hover:bg-muted",
                        isChecked && o.is_correct && "border-green-500/50 bg-green-500/5",
                        isChecked && isSelected && !o.is_correct && "border-destructive/50 bg-destructive/5",
                        !showState && isChecked && "opacity-70"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggle(q.id, o.id)}
                        disabled={isChecked}
                      />
                      <span className="text-sm flex-1">{o.option_text}</span>
                      {isChecked && o.is_correct && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {isChecked && isSelected && !o.is_correct && <XCircle className="w-4 h-4 text-destructive" />}
                    </label>
                  );
                })}
                {!isChecked && !submitted && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={(selected.size || 0) === 0}
                    onClick={() => checkQuestion(q.id)}
                  >
                    تحقق من الإجابة
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!submitted && (
        <Button onClick={submit} className="w-full mt-6" disabled={!allAnswered}>
          إنهاء وعرض النتيجة <ArrowRight className="w-4 h-4 mr-2" />
        </Button>
      )}
    </div>
  );
}
