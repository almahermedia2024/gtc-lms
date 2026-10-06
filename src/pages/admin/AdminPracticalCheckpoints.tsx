import { useEffect, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Pencil, ArrowRight, Clock, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionType, OptionItem } from "@/components/practical/QuestionRenderer";
import { AnnotatedImage, CaseText, type Annotation, type ContentType } from "@/components/practical/PracticalContent";

interface Video {
  id: string; title: string; youtube_url: string;
  content_type: ContentType; case_text: string | null; image_url: string | null; annotations: Annotation[];
}
interface Checkpoint {
  id: string; video_id: string; stop_time: number; order_index: number;
  question_type: QuestionType; question_text: string;
  options: OptionItem[]; correct_answer: unknown;
  correct_feedback: string | null; wrong_feedback: string | null;
  replay_from: number; continue_from: number | null;
  score: number; attempts_allowed: number;
}

const emptyForm = () => ({
  stop_time: 0, question_type: "multiple_choice" as QuestionType, question_text: "",
  options: [{ id: crypto.randomUUID(), text: "" }, { id: crypto.randomUUID(), text: "" }] as OptionItem[],
  correctSingle: "" as string, correctMulti: [] as string[], correctTF: "true" as "true" | "false",
  correctOrder: [] as string[],
  correct_feedback: "أحسنت!", wrong_feedback: "حاول مرة أخرى",
  replay_from: 0, continue_from: "" as string,
  score: 1, attempts_allowed: 3,
});

function fmt(s: number) {
  const m = Math.floor(s / 60); const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

function Section({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b border-border/40">
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{index}</span>
        <h4 className="text-sm font-heading font-bold">{title}</h4>
      </div>
      {children}
    </div>
  );
}

export default function AdminPracticalCheckpoints() {
  const { videoId } = useParams();
  const { toast } = useToast();
  const [video, setVideo] = useState<Video | null>(null);
  const [items, setItems] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Checkpoint | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    if (!videoId) return;
    setLoading(true);
    const [{ data: v }, { data: cps }] = await Promise.all([
      (supabase as any).from("practical_videos").select("id, title, youtube_url, content_type, case_text, image_url, annotations").eq("id", videoId).maybeSingle(),
      (supabase as any).from("practical_checkpoints").select("*").eq("video_id", videoId).order("stop_time").order("order_index"),
    ]);
    setVideo(v);
    setItems((cps as Checkpoint[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [videoId]);

  const isVideo = (video?.content_type || "video") === "video";

  const saveAnnotations = async (annotations: Annotation[]) => {
    if (!video) return;
    const { error } = await (supabase as any).from("practical_videos").update({ annotations }).eq("id", video.id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else setVideo({ ...video, annotations });
  };

  const openAdd = () => {
    setEditing(null);
    const f = emptyForm();
    if (!isVideo) f.stop_time = items.length + 1;
    setForm(f);
    setDialogOpen(true);
  };

  const openEdit = (c: Checkpoint) => {
    setEditing(c);
    const opts = (c.options as OptionItem[]) || [];
    const f = emptyForm();
    f.stop_time = c.stop_time;
    f.question_type = c.question_type;
    f.question_text = c.question_text;
    f.options = opts.length ? opts : f.options;
    f.correct_feedback = c.correct_feedback || "";
    f.wrong_feedback = c.wrong_feedback || "";
    f.replay_from = c.replay_from;
    f.continue_from = c.continue_from == null ? "" : String(c.continue_from);
    f.score = c.score;
    f.attempts_allowed = c.attempts_allowed;
    const ca = c.correct_answer;
    if (c.question_type === "true_false") f.correctTF = ca ? "true" : "false";
    else if (c.question_type === "multiple_choice") f.correctSingle = Array.isArray(ca) ? String(ca[0] || "") : "";
    else if (c.question_type === "find_error") f.correctMulti = Array.isArray(ca) ? ca.map(String) : [];
    else if (c.question_type === "order_steps") f.correctOrder = Array.isArray(ca) ? ca.map(String) : opts.map(o => o.id);
    setForm(f);
    setDialogOpen(true);
  };

  const addOption = () => setForm(f => ({ ...f, options: [...f.options, { id: crypto.randomUUID(), text: "" }] }));
  const removeOption = (id: string) => setForm(f => ({
    ...f, options: f.options.filter(o => o.id !== id),
    correctSingle: f.correctSingle === id ? "" : f.correctSingle,
    correctMulti: f.correctMulti.filter(x => x !== id),
    correctOrder: f.correctOrder.filter(x => x !== id),
  }));
  const setOption = (id: string, text: string) =>
    setForm(f => ({ ...f, options: f.options.map(o => o.id === id ? { ...o, text } : o) }));

  const moveOrder = (id: string, dir: -1 | 1) => {
    setForm(f => {
      const arr = f.correctOrder.length ? [...f.correctOrder] : f.options.map(o => o.id);
      const idx = arr.indexOf(id);
      if (idx === -1) return f;
      const ni = idx + dir;
      if (ni < 0 || ni >= arr.length) return f;
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      return { ...f, correctOrder: arr };
    });
  };

  const handleSave = async () => {
    if (!form.question_text.trim()) {
      toast({ title: "خطأ", description: "أدخل نص السؤال", variant: "destructive" }); return;
    }
    let correct_answer: unknown;
    let options = form.options.filter(o => o.text.trim());
    if (form.question_type === "true_false") {
      correct_answer = form.correctTF === "true";
      options = [];
    } else if (form.question_type === "multiple_choice") {
      if (!form.correctSingle) { toast({ title: "حدد الإجابة الصحيحة", variant: "destructive" }); return; }
      correct_answer = [form.correctSingle];
    } else if (form.question_type === "find_error") {
      if (!form.correctMulti.length) { toast({ title: "حدد إجابة صحيحة واحدة على الأقل", variant: "destructive" }); return; }
      correct_answer = form.correctMulti;
    } else {
      const order = form.correctOrder.length ? form.correctOrder : options.map(o => o.id);
      correct_answer = order;
    }

    const payload = {
      video_id: videoId,
      stop_time: Number(form.stop_time) || 0,
      question_type: form.question_type,
      question_text: form.question_text.trim(),
      options,
      correct_answer,
      correct_feedback: form.correct_feedback.trim() || null,
      wrong_feedback: form.wrong_feedback.trim() || null,
      replay_from: Number(form.replay_from) || 0,
      continue_from: form.continue_from === "" ? null : Number(form.continue_from),
      score: Number(form.score) || 1,
      attempts_allowed: Number(form.attempts_allowed) || 1,
    };

    setSaving(true);
    const op = editing
      ? (supabase as any).from("practical_checkpoints").update(payload).eq("id", editing.id)
      : (supabase as any).from("practical_checkpoints").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: editing ? "تم التحديث" : "تمت الإضافة" }); setDialogOpen(false); fetchAll(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذه النقطة؟")) return;
    const { error } = await (supabase as any).from("practical_checkpoints").delete().eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم الحذف" }); fetchAll(); }
  };

  const typeLabel: Record<QuestionType, string> = {
    multiple_choice: "اختيار من متعدد",
    true_false: "صح / خطأ",
    order_steps: "ترتيب خطوات",
    find_error: "اكتشاف الخطأ",
  };

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link to="/admin/practical" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowRight className="w-3 h-3" />العودة للفيديوهات
          </Link>
          <h1 className="text-2xl font-heading font-bold mt-1">{isVideo ? "نقاط التوقف" : "الأسئلة"} — {video?.title || "..."}</h1>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 ml-2" />{isVideo ? "إضافة نقطة توقف" : "إضافة سؤال"}</Button>
      </div>

      {video?.content_type === "case" && video.case_text && (
        <div className="mb-6"><CaseText text={video.case_text} /></div>
      )}
      {video?.content_type === "image" && (
        <Card className="mb-6 border-border/50">
          <CardContent className="p-4">
            <h3 className="font-heading font-bold mb-3 text-sm">الصورة والتعليقات</h3>
            <div className="max-w-3xl">
              <AnnotatedImage path={video.image_url} annotations={video.annotations || []} editable
                onAdd={(a) => saveAnnotations([...(video.annotations || []), a])}
                onRemove={(id) => saveAnnotations((video.annotations || []).filter(x => x.id !== id))} />
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">لا توجد نقاط توقف بعد.</div>
      ) : (
        <div className="grid gap-3">
          {items.map(c => (
            <Card key={c.id} className="border-border/50">
              <CardContent className="p-4 flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="secondary" className="font-mono">{isVideo ? <><Clock className="w-3 h-3 ml-1" />{fmt(c.stop_time)}</> : `سؤال ${c.stop_time}`}</Badge>
                    <Badge variant="outline">{typeLabel[c.question_type]}</Badge>
                    <Badge>{c.score} درجة</Badge>
                    <Badge variant="outline" className="text-xs">{c.attempts_allowed} محاولات</Badge>
                  </div>
                  <p className="font-medium">{c.question_text}</p>
                  {isVideo && <p className="text-xs text-muted-foreground mt-1">
                    عند الخطأ يعود إلى {fmt(c.replay_from)} • عند الصحة يستكمل من {fmt(c.continue_from ?? c.stop_time)}
                  </p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل نقطة التوقف" : "إضافة نقطة توقف"}</DialogTitle>
            <DialogDescription>اتبع الخطوات بالترتيب: التوقيت، نص السؤال، الخيارات، ثم الإعدادات</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Section index="١" title={isVideo ? "التوقيت ونوع السؤال" : "ترتيب السؤال ونوعه"}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{isVideo ? "وقت التوقف (بالثواني)" : "رقم السؤال"}</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} value={form.stop_time} onChange={e => setForm({ ...form, stop_time: Number(e.target.value) })} />
                    {isVideo && <Badge variant="outline" className="font-mono shrink-0 gap-1"><Clock className="w-3 h-3" />{fmt(Number(form.stop_time) || 0)}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{isVideo ? "مثال: 90 تعني دقيقة ونصف — سيتوقف الفيديو ويظهر السؤال." : "تظهر الأسئلة للمتدرب مرتبة حسب هذا الرقم."}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>نوع السؤال</Label>
                  <Select value={form.question_type} onValueChange={(v) => setForm({ ...form, question_type: v as QuestionType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">اختيار من متعدد</SelectItem>
                      <SelectItem value="true_false">صح / خطأ</SelectItem>
                      <SelectItem value="order_steps">ترتيب خطوات</SelectItem>
                      <SelectItem value="find_error">اكتشاف الخطأ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>

            <Section index="٢" title="نص السؤال">
              <Textarea value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })} rows={3} placeholder="اكتب نص السؤال بوضوح كما سيظهر للطالب…" className="leading-relaxed" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>سؤال مباشر وواضح يساعد الطالب على الفهم</span>
                <span className={form.question_text.length > 300 ? "text-destructive" : ""}>{form.question_text.length} حرف</span>
              </div>
            </Section>

            {form.question_type !== "true_false" ? (
              <Section index="٣" title="الخيارات والإجابة الصحيحة">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {form.question_type === "multiple_choice" && "اضغط على الدائرة بجانب الخيار الصحيح — سيتم تمييزه بلون مميز"}
                    {form.question_type === "find_error" && "ضع علامة على كل خيار يحتوي على خطأ"}
                    {form.question_type === "order_steps" && "استخدم الأسهم لترتيب الخطوات — الترتيب الظاهر هنا هو الترتيب الصحيح"}
                  </p>
                  <Button size="sm" variant="outline" onClick={addOption}><Plus className="w-3 h-3 ml-1" />إضافة خيار</Button>
                </div>
                <div className="space-y-2">
                  {form.options.map((o, idx) => {
                    const isCorrect = form.question_type === "multiple_choice"
                      ? form.correctSingle === o.id
                      : form.question_type === "find_error"
                        ? form.correctMulti.includes(o.id)
                        : false;
                    const orderNum = form.question_type === "order_steps"
                      ? (form.correctOrder.length ? form.correctOrder : form.options.map(x => x.id)).indexOf(o.id) + 1
                      : 0;
                    return (
                      <div key={o.id} className={cn("flex items-center gap-2 p-2 rounded-md border transition-colors", isCorrect ? "border-primary/60 bg-primary/5" : "border-border/50")}>
                        {form.question_type === "multiple_choice" && (
                          <input type="radio" name="correctSingle" className="w-4 h-4 accent-primary shrink-0" checked={form.correctSingle === o.id} onChange={() => setForm({ ...form, correctSingle: o.id })} aria-label={`تحديد الخيار ${idx + 1} كإجابة صحيحة`} />
                        )}
                        {form.question_type === "find_error" && (
                          <input type="checkbox" className="w-4 h-4 accent-primary shrink-0" checked={form.correctMulti.includes(o.id)} onChange={(e) => {
                            setForm(f => ({ ...f, correctMulti: e.target.checked ? [...f.correctMulti, o.id] : f.correctMulti.filter(x => x !== o.id) }));
                          }} aria-label={`تحديد الخيار ${idx + 1} كخطأ`} />
                        )}
                        {form.question_type === "order_steps" && (
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{orderNum}</span>
                        )}
                        <Input value={o.text} onChange={e => setOption(o.id, e.target.value)} placeholder={`نص الخيار ${idx + 1}…`} className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-1" />
                        {form.question_type === "order_steps" && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => moveOrder(o.id, -1)} aria-label="تحريك لأعلى"><ArrowUp className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => moveOrder(o.id, 1)} aria-label="تحريك لأسفل"><ArrowDown className="w-3.5 h-3.5" /></Button>
                          </div>
                        )}
                        {isCorrect && <span className="text-xs text-primary font-bold shrink-0">الإجابة الصحيحة</span>}
                        <Button size="icon" variant="ghost" className="text-destructive shrink-0 w-7 h-7" onClick={() => removeOption(o.id)} aria-label="حذف الخيار"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    );
                  })}
                </div>
              </Section>
            ) : (
              <Section index="٣" title="الإجابة الصحيحة">
                <Select value={form.correctTF} onValueChange={(v) => setForm({ ...form, correctTF: v as "true" | "false" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">صح</SelectItem>
                    <SelectItem value="false">خطأ</SelectItem>
                  </SelectContent>
                </Select>
              </Section>
            )}

            <Section index="٤" title="رسائل التغذية الراجعة">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>عند الإجابة الصحيحة</Label>
                  <Textarea rows={2} value={form.correct_feedback} onChange={e => setForm({ ...form, correct_feedback: e.target.value })} placeholder="مثال: أحسنت! إجابة صحيحة" />
                </div>
                <div className="space-y-1.5">
                  <Label>عند الإجابة الخاطئة</Label>
                  <Textarea rows={2} value={form.wrong_feedback} onChange={e => setForm({ ...form, wrong_feedback: e.target.value })} placeholder="مثال: حاول مرة أخرى بعد إعادة المشهد" />
                </div>
              </div>
            </Section>

            <Section index="٥" title="التكرار والدرجات">
              {isVideo && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>إعادة المشهد من (بالثواني)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} value={form.replay_from} onChange={e => setForm({ ...form, replay_from: Number(e.target.value) })} />
                    <Badge variant="outline" className="font-mono shrink-0">{fmt(Number(form.replay_from) || 0)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">عند الخطأ يعود الفيديو إلى هذا التوقيت لإعادة المشاهدة.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>الاستكمال من (اختياري)</Label>
                  <Input type="number" min={0} placeholder="افتراضي: من وقت التوقف" value={form.continue_from} onChange={e => setForm({ ...form, continue_from: e.target.value })} />
                  <p className="text-xs text-muted-foreground">اتركه فارغًا ليستكمل الفيديو من وقت التوقف.</p>
                </div>
              </div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>الدرجة</Label>
                  <Input type="number" min={0} value={form.score} onChange={e => setForm({ ...form, score: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground">الدرجة التي يحصل عليها الطالب عند الإجابة الصحيحة.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>المحاولات المسموحة</Label>
                  <Input type="number" min={1} value={form.attempts_allowed} onChange={e => setForm({ ...form, attempts_allowed: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground">عدد المرات التي يستطيع الطالب فيها المحاولة.</p>
                </div>
              </div>
            </Section>

            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
              {editing ? "حفظ التعديلات" : "إضافة نقطة التوقف"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
