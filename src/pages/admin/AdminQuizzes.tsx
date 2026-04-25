import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Loader2,
  Pencil,
  ClipboardList,
  CheckCircle2,
  XCircle,
  BookOpen,
  Timer,
  Save,
} from "lucide-react";

interface Course {
  id: string;
  title: string;
  quiz_duration_minutes: number;
}

interface QuizOption {
  id?: string;
  option_text: string;
  is_correct: boolean;
  option_order: number;
}

interface Question {
  id: string;
  course_id: string;
  question_text: string;
  question_order: number;
  options: QuizOption[];
}

export default function AdminQuizzes() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<QuizOption[]>([
    { option_text: "", is_correct: true, option_order: 0 },
    { option_text: "", is_correct: false, option_order: 1 },
    { option_text: "", is_correct: false, option_order: 2 },
    { option_text: "", is_correct: false, option_order: 3 },
  ]);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteQuestion, setDeleteQuestion] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quiz duration
  const [durationInput, setDurationInput] = useState<string>("30");
  const [savingDuration, setSavingDuration] = useState(false);

  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, quiz_duration_minutes")
        .order("created_at", { ascending: false });
      if (error) {
        toast({ title: "خطأ في تحميل الكورسات", description: error.message, variant: "destructive" });
      } else {
        setCourses(data || []);
        if (data && data.length > 0 && !selectedCourseId) {
          setSelectedCourseId(data[0].id);
        }
      }
      setLoading(false);
    };
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCourseId) loadQuestions(selectedCourseId);
  }, [selectedCourseId]);

  const loadQuestions = async (courseId: string) => {
    setLoadingQuestions(true);
    const { data: qs, error } = await supabase
      .from("quiz_questions")
      .select("id, course_id, question_text, question_order")
      .eq("course_id", courseId)
      .order("question_order", { ascending: true });

    if (error) {
      toast({ title: "خطأ في تحميل الأسئلة", description: error.message, variant: "destructive" });
      setLoadingQuestions(false);
      return;
    }

    if (!qs || qs.length === 0) {
      setQuestions([]);
      setLoadingQuestions(false);
      return;
    }

    const ids = qs.map((q) => q.id);
    const { data: opts } = await supabase
      .from("quiz_options")
      .select("id, question_id, option_text, is_correct, option_order")
      .in("question_id", ids)
      .order("option_order", { ascending: true });

    const optsByQ = new Map<string, QuizOption[]>();
    (opts || []).forEach((o) => {
      const arr = optsByQ.get(o.question_id) || [];
      arr.push({
        id: o.id,
        option_text: o.option_text,
        is_correct: o.is_correct,
        option_order: o.option_order,
      });
      optsByQ.set(o.question_id, arr);
    });

    setQuestions(
      qs.map((q) => ({
        id: q.id,
        course_id: q.course_id,
        question_text: q.question_text,
        question_order: q.question_order,
        options: optsByQ.get(q.id) || [],
      }))
    );
    setLoadingQuestions(false);
  };

  const openAddDialog = () => {
    setEditingQuestion(null);
    setQuestionText("");
    setOptions([
      { option_text: "", is_correct: true, option_order: 0 },
      { option_text: "", is_correct: false, option_order: 1 },
      { option_text: "", is_correct: false, option_order: 2 },
      { option_text: "", is_correct: false, option_order: 3 },
    ]);
    setDialogOpen(true);
  };

  const openEditDialog = (q: Question) => {
    setEditingQuestion(q);
    setQuestionText(q.question_text);
    setOptions(
      q.options.length > 0
        ? q.options.map((o, i) => ({ ...o, option_order: i }))
        : [{ option_text: "", is_correct: true, option_order: 0 }]
    );
    setDialogOpen(true);
  };

  const setCorrectOption = (idx: number) => {
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
  };

  const updateOptionText = (idx: number, text: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, option_text: text } : o)));
  };

  const addOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [
      ...prev,
      { option_text: "", is_correct: false, option_order: prev.length },
    ]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => {
      const filtered = prev.filter((_, i) => i !== idx).map((o, i) => ({ ...o, option_order: i }));
      // Ensure at least one correct
      if (!filtered.some((o) => o.is_correct)) filtered[0].is_correct = true;
      return filtered;
    });
  };

  const handleSave = async () => {
    if (!selectedCourseId) return;
    if (!questionText.trim()) {
      toast({ title: "نص السؤال مطلوب", variant: "destructive" });
      return;
    }
    const validOptions = options.filter((o) => o.option_text.trim());
    if (validOptions.length < 2) {
      toast({ title: "يجب توفير خيارين على الأقل", variant: "destructive" });
      return;
    }
    if (!validOptions.some((o) => o.is_correct)) {
      toast({ title: "يجب تحديد إجابة صحيحة", variant: "destructive" });
      return;
    }

    setSaving(true);

    if (editingQuestion) {
      // Update question
      const { error: updErr } = await supabase
        .from("quiz_questions")
        .update({ question_text: questionText.trim() })
        .eq("id", editingQuestion.id);
      if (updErr) {
        toast({ title: "خطأ في حفظ السؤال", description: updErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      // Replace options: delete then insert
      await supabase.from("quiz_options").delete().eq("question_id", editingQuestion.id);
      const { error: insErr } = await supabase.from("quiz_options").insert(
        validOptions.map((o, i) => ({
          question_id: editingQuestion.id,
          option_text: o.option_text.trim(),
          is_correct: o.is_correct,
          option_order: i,
        }))
      );
      if (insErr) {
        toast({ title: "خطأ في حفظ الخيارات", description: insErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "تم تعديل السؤال" });
    } else {
      // Insert new question
      const nextOrder = questions.length;
      const { data: newQ, error: insErr } = await supabase
        .from("quiz_questions")
        .insert({
          course_id: selectedCourseId,
          question_text: questionText.trim(),
          question_order: nextOrder,
          created_by: user?.id,
        })
        .select()
        .single();
      if (insErr || !newQ) {
        toast({ title: "خطأ في إضافة السؤال", description: insErr?.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      const { error: optErr } = await supabase.from("quiz_options").insert(
        validOptions.map((o, i) => ({
          question_id: newQ.id,
          option_text: o.option_text.trim(),
          is_correct: o.is_correct,
          option_order: i,
        }))
      );
      if (optErr) {
        toast({ title: "خطأ في حفظ الخيارات", description: optErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "تم إضافة السؤال" });
    }

    setSaving(false);
    setDialogOpen(false);
    loadQuestions(selectedCourseId);
  };

  const handleDelete = async () => {
    if (!deleteQuestion) return;
    setDeleting(true);
    const { error } = await supabase.from("quiz_questions").delete().eq("id", deleteQuestion.id);
    if (error) {
      toast({ title: "خطأ في الحذف", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم حذف السؤال" });
      loadQuestions(selectedCourseId);
    }
    setDeleting(false);
    setDeleteQuestion(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            إدارة الاختبارات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            أضف أسئلة الاختبار لكل كورس بنظام الاختيار من متعدد (MCQ)
          </p>
        </div>
        <Button onClick={openAddDialog} disabled={!selectedCourseId}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة سؤال جديد
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            اختر الكورس
          </CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد كورسات. أضف كورس أولاً.</p>
          ) : (
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-full md:w-96">
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
          )}
        </CardContent>
      </Card>

      {selectedCourseId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>أسئلة الاختبار</span>
              <Badge variant="secondary">{questions.length} سؤال</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingQuestions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto opacity-30 mb-3" />
                <p>لا توجد أسئلة بعد. اضغط "إضافة سؤال جديد" للبدء.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <Card key={q.id} className="border-border/60">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-start gap-2 flex-1">
                          <Badge variant="outline" className="shrink-0 mt-0.5">
                            {idx + 1}
                          </Badge>
                          <p className="font-medium leading-relaxed">{q.question_text}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(q)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteQuestion(q)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pr-8">
                        {q.options.map((o, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 text-sm p-2 rounded-md border ${
                              o.is_correct
                                ? "bg-accent/10 border-accent/30 text-foreground"
                                : "border-border/50 text-muted-foreground"
                            }`}
                          >
                            {o.is_correct ? (
                              <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 opacity-30 shrink-0" />
                            )}
                            <span className="flex-1">{o.option_text}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "تعديل السؤال" : "إضافة سؤال جديد"}</DialogTitle>
            <DialogDescription>
              اكتب نص السؤال وحدد الخيارات، ثم اختر الإجابة الصحيحة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>نص السؤال</Label>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="اكتب السؤال هنا..."
                rows={3}
                maxLength={1000}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>الخيارات (اختر الإجابة الصحيحة)</Label>
                {options.length < 6 && (
                  <Button type="button" size="sm" variant="outline" onClick={addOption}>
                    <Plus className="w-3 h-3 ml-1" /> خيار
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {options.map((o, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={o.is_correct ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCorrectOption(idx)}
                      className="shrink-0 w-10"
                      title="حدد كإجابة صحيحة"
                    >
                      {o.is_correct ? <CheckCircle2 className="w-4 h-4" /> : String.fromCharCode(0x0623 + idx)}
                    </Button>
                    <Input
                      value={o.option_text}
                      onChange={(e) => updateOptionText(idx, e.target.value)}
                      placeholder={`الخيار ${idx + 1}`}
                      maxLength={500}
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(idx)}
                        className="text-destructive shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                اضغط على الزر بجانب الخيار لتحديده كإجابة صحيحة
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {editingQuestion ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteQuestion} onOpenChange={(o) => !o && setDeleteQuestion(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف السؤال</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا السؤال؟ سيتم حذف جميع خياراته وإجابات الطلاب المرتبطة به نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
