import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save } from "lucide-react";

interface Option {
  id?: string;
  option_text: string;
  is_correct: boolean;
  option_order: number;
}

interface Question {
  id?: string;
  question_text: string;
  question_order: number;
  options: Option[];
}

export function LectureQuizManager({ lectureId }: { lectureId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
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
        arr.push({ id: o.id, option_text: o.option_text, is_correct: o.is_correct, option_order: o.option_order });
        optsByQ.set(o.question_id, arr);
      });
    }
    setQuestions(
      (qs || []).map((q) => ({
        id: q.id,
        question_text: q.question_text,
        question_order: q.question_order,
        options: optsByQ.get(q.id) || [],
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [lectureId]);

  const addQuestion = () => {
    setQuestions((qs) => [
      ...qs,
      {
        question_text: "",
        question_order: qs.length,
        options: [
          { option_text: "", is_correct: false, option_order: 0 },
          { option_text: "", is_correct: false, option_order: 1 },
        ],
      },
    ]);
  };

  const removeQuestion = async (idx: number) => {
    const q = questions[idx];
    if (q.id) await supabase.from("lecture_quiz_questions").delete().eq("id", q.id);
    setQuestions((qs) => qs.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const addOption = (qIdx: number) => {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIdx
          ? { ...q, options: [...q.options, { option_text: "", is_correct: false, option_order: q.options.length }] }
          : q
      )
    );
  };

  const updateOption = (qIdx: number, oIdx: number, patch: Partial<Option>) => {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.map((o, j) => (j === oIdx ? { ...o, ...patch } : o)) }
          : q
      )
    );
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.filter((_, j) => j !== oIdx) } : q
      )
    );
  };

  const saveAll = async () => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        toast({ title: "خطأ", description: `السؤال ${i + 1} فارغ`, variant: "destructive" });
        return;
      }
      if (q.options.length < 2) {
        toast({ title: "خطأ", description: `السؤال ${i + 1} يحتاج خيارين على الأقل`, variant: "destructive" });
        return;
      }
      if (!q.options.some((o) => o.is_correct)) {
        toast({ title: "خطأ", description: `حدد إجابة صحيحة للسؤال ${i + 1}`, variant: "destructive" });
        return;
      }
      if (q.options.some((o) => !o.option_text.trim())) {
        toast({ title: "خطأ", description: `بعض خيارات السؤال ${i + 1} فارغة`, variant: "destructive" });
        return;
      }
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      let questionId = q.id;
      if (questionId) {
        await supabase
          .from("lecture_quiz_questions")
          .update({ question_text: q.question_text, question_order: i })
          .eq("id", questionId);
        await supabase.from("lecture_quiz_options").delete().eq("question_id", questionId);
      } else {
        const { data: inserted, error } = await supabase
          .from("lecture_quiz_questions")
          .insert({
            lecture_id: lectureId,
            question_text: q.question_text,
            question_order: i,
            created_by: user?.id,
          })
          .select()
          .single();
        if (error || !inserted) {
          toast({ title: "خطأ", description: error?.message || "فشل الحفظ", variant: "destructive" });
          return;
        }
        questionId = inserted.id;
      }
      await supabase.from("lecture_quiz_options").insert(
        q.options.map((o, j) => ({
          question_id: questionId!,
          option_text: o.option_text,
          option_order: j,
          is_correct: o.is_correct,
        }))
      );
    }
    toast({ title: "تم حفظ الكويز" });
    fetchData();
  };

  if (loading) return <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>;

  return (
    <div className="space-y-4">
      {questions.map((q, qIdx) => (
        <Card key={qIdx}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Label>السؤال {qIdx + 1}</Label>
                <Input
                  value={q.question_text}
                  onChange={(e) => updateQuestion(qIdx, { question_text: e.target.value })}
                  placeholder="نص السؤال"
                />
              </div>
              <Button variant="destructive" size="icon" onClick={() => removeQuestion(qIdx)} className="mt-6">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {q.options.map((o, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <Checkbox
                    checked={o.is_correct}
                    onCheckedChange={(v) => updateOption(qIdx, oIdx, { is_correct: !!v })}
                  />
                  <Input
                    value={o.option_text}
                    onChange={(e) => updateOption(qIdx, oIdx, { option_text: e.target.value })}
                    placeholder={`خيار ${oIdx + 1}`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeOption(qIdx, oIdx)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addOption(qIdx)}>
                <Plus className="w-4 h-4 ml-1" />إضافة خيار
              </Button>
              <p className="text-xs text-muted-foreground">حدد الإجابة الصحيحة (أو أكثر) بوضع علامة على الخيار.</p>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" onClick={addQuestion} className="flex-1">
          <Plus className="w-4 h-4 ml-1" />إضافة سؤال
        </Button>
        <Button onClick={saveAll} className="flex-1">
          <Save className="w-4 h-4 ml-1" />حفظ الكويز
        </Button>
      </div>
      {questions.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-4">لا توجد أسئلة بعد. أضف أول سؤال.</p>
      )}
    </div>
  );
}
