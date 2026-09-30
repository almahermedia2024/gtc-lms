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

interface Video { id: string; title: string; youtube_url: string; }
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
      (supabase as any).from("practical_videos").select("id, title, youtube_url").eq("id", videoId).maybeSingle(),
      (supabase as any).from("practical_checkpoints").select("*").eq("video_id", videoId).order("stop_time").order("order_index"),
    ]);
    setVideo(v);
    setItems((cps as Checkpoint[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [videoId]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
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
          <h1 className="text-2xl font-heading font-bold mt-1">نقاط التوقف — {video?.title || "..."}</h1>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 ml-2" />إضافة نقطة توقف</Button>
      </div>

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
                    <Badge variant="secondary" className="font-mono"><Clock className="w-3 h-3 ml-1" />{fmt(c.stop_time)}</Badge>
                    <Badge variant="outline">{typeLabel[c.question_type]}</Badge>
                    <Badge>{c.score} درجة</Badge>
                    <Badge variant="outline" className="text-xs">{c.attempts_allowed} محاولات</Badge>
                  </div>
                  <p className="font-medium">{c.question_text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    عند الخطأ يعود إلى {fmt(c.replay_from)} • عند الصحة يستكمل من {fmt(c.continue_from ?? c.stop_time)}
                  </p>
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
            <DialogDescription>حدد التوقيت ونوع السؤال والإجابات</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>وقت التوقف (ثواني)</Label>
                <Input type="number" min={0} value={form.stop_time} onChange={e => setForm({ ...form, stop_time: Number(e.target.value) })} />
              </div>
              <div>
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

            <div>
              <Label>نص السؤال</Label>
              <Textarea value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })} rows={2} />
            </div>

            {form.question_type !== "true_false" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>الخيارات</Label>
                  <Button size="sm" variant="outline" onClick={addOption}><Plus className="w-3 h-3 ml-1" />خيار</Button>
                </div>
                {form.options.map((o, idx) => (
                  <div key={o.id} className="flex items-center gap-2">
                    {form.question_type === "multiple_choice" && (
                      <input type="radio" name="correctSingle" checked={form.correctSingle === o.id} onChange={() => setForm({ ...form, correctSingle: o.id })} />
                    )}
                    {form.question_type === "find_error" && (
                      <input type="checkbox" checked={form.correctMulti.includes(o.id)} onChange={(e) => {
                        setForm(f => ({ ...f, correctMulti: e.target.checked ? [...f.correctMulti, o.id] : f.correctMulti.filter(x => x !== o.id) }));
                      }} />
                    )}
                    {form.question_type === "order_steps" && (
                      <span className="text-xs font-mono w-6">{(form.correctOrder.length ? form.correctOrder : form.options.map(x => x.id)).indexOf(o.id) + 1}.</span>
                    )}
                    <Input value={o.text} onChange={e => setOption(o.id, e.target.value)} placeholder={`خيار ${idx + 1}`} />
                    {form.question_type === "order_steps" && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => moveOrder(o.id, -1)}>↑</Button>
                        <Button size="icon" variant="ghost" onClick={() => moveOrder(o.id, 1)}>↓</Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeOption(o.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                {form.question_type === "multiple_choice" && <p className="text-xs text-muted-foreground">اختر دائرة الإجابة الصحيحة</p>}
                {form.question_type === "find_error" && <p className="text-xs text-muted-foreground">حدد كل الإجابات التي تحتوي على خطأ</p>}
                {form.question_type === "order_steps" && <p className="text-xs text-muted-foreground">الترتيب الظاهر هنا هو الترتيب الصحيح المطلوب</p>}
              </div>
            )}

            {form.question_type === "true_false" && (
              <div>
                <Label>الإجابة الصحيحة</Label>
                <Select value={form.correctTF} onValueChange={(v) => setForm({ ...form, correctTF: v as "true" | "false" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">صح</SelectItem>
                    <SelectItem value="false">خطأ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تغذية راجعة عند الصحة</Label>
                <Input value={form.correct_feedback} onChange={e => setForm({ ...form, correct_feedback: e.target.value })} />
              </div>
              <div>
                <Label>تغذية راجعة عند الخطأ</Label>
                <Input value={form.wrong_feedback} onChange={e => setForm({ ...form, wrong_feedback: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>إعادة المشهد من (ثواني)</Label>
                <Input type="number" min={0} value={form.replay_from} onChange={e => setForm({ ...form, replay_from: Number(e.target.value) })} />
              </div>
              <div>
                <Label>الاستكمال من (اختياري)</Label>
                <Input type="number" min={0} placeholder="افتراضي: من وقت التوقف" value={form.continue_from} onChange={e => setForm({ ...form, continue_from: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الدرجة</Label>
                <Input type="number" min={0} value={form.score} onChange={e => setForm({ ...form, score: Number(e.target.value) })} />
              </div>
              <div>
                <Label>المحاولات المسموحة</Label>
                <Input type="number" min={1} value={form.attempts_allowed} onChange={e => setForm({ ...form, attempts_allowed: Number(e.target.value) })} />
              </div>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
              {editing ? "حفظ" : "إضافة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
