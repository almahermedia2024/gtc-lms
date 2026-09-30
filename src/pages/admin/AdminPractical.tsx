import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Pencil, Lock, Unlock, ListChecks, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { extractYouTubeId } from "@/components/practical/YouTubePlayer";

interface Course { id: string; title: string; }
interface PracticalVideo {
  id: string; course_id: string; title: string; youtube_url: string;
  description: string | null; order_index: number; is_locked: boolean;
}

export default function AdminPractical() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [videos, setVideos] = useState<PracticalVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PracticalVideo | null>(null);
  const [form, setForm] = useState({ course_id: "", title: "", youtube_url: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from("courses").select("id, title").order("title"),
      (supabase as any).from("practical_videos").select("*").order("order_index").order("created_at"),
    ]);
    setCourses(c || []);
    const vids = (v as PracticalVideo[]) || [];
    setVideos(vids);
    // Counts
    if (vids.length) {
      const { data: cps } = await (supabase as any)
        .from("practical_checkpoints").select("video_id").in("video_id", vids.map(x => x.id));
      const map: Record<string, number> = {};
      (cps || []).forEach((r: { video_id: string }) => { map[r.video_id] = (map[r.video_id] || 0) + 1; });
      setCounts(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ course_id: selectedCourse !== "all" ? selectedCourse : (courses[0]?.id || ""), title: "", youtube_url: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (v: PracticalVideo) => {
    setEditing(v);
    setForm({ course_id: v.course_id, title: v.title, youtube_url: v.youtube_url, description: v.description || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.course_id || !form.title.trim() || !form.youtube_url.trim()) {
      toast({ title: "خطأ", description: "يرجى تعبئة جميع الحقول الأساسية", variant: "destructive" });
      return;
    }
    if (!extractYouTubeId(form.youtube_url.trim())) {
      toast({ title: "رابط غير صالح", description: "تأكد من إدخال رابط يوتيوب صحيح", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await (supabase as any).from("practical_videos").update({
        course_id: form.course_id, title: form.title.trim(),
        youtube_url: form.youtube_url.trim(), description: form.description.trim() || null,
      }).eq("id", editing.id);
      if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
      else toast({ title: "تم التحديث" });
    } else {
      const { error } = await (supabase as any).from("practical_videos").insert({
        course_id: form.course_id, title: form.title.trim(),
        youtube_url: form.youtube_url.trim(), description: form.description.trim() || null,
        created_by: user?.id,
      });
      if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
      else toast({ title: "تمت الإضافة" });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا الفيديو وكل نقاط التوقف والمحاولات المرتبطة؟")) return;
    const { error } = await (supabase as any).from("practical_videos").delete().eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم الحذف" }); fetchAll(); }
  };

  const toggleLock = async (v: PracticalVideo) => {
    const { error } = await (supabase as any).from("practical_videos").update({ is_locked: !v.is_locked }).eq("id", v.id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else setVideos(prev => prev.map(x => x.id === v.id ? { ...x, is_locked: !v.is_locked } : x));
  };

  const courseMap = new Map(courses.map(c => [c.id, c.title]));
  const filtered = selectedCourse === "all" ? videos : videos.filter(v => v.course_id === selectedCourse);

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">التدريب العملي</h1>
          <p className="text-sm text-muted-foreground mt-1">فيديوهات يوتيوب تفاعلية مع نقاط توقف وأسئلة تفرعية</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="فلترة بالكورس" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الكورسات</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openAdd} disabled={courses.length === 0}>
            <Plus className="w-4 h-4 ml-2" />إضافة فيديو تدريبي
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <Youtube className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>لا توجد فيديوهات بعد. اضغط "إضافة فيديو تدريبي" للبدء.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(v => (
            <Card key={v.id} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-bold">{v.title}</h3>
                    <Badge variant="secondary">{courseMap.get(v.course_id) || "—"}</Badge>
                    <Badge variant="outline" className="text-xs">{counts[v.id] || 0} نقطة توقف</Badge>
                    {v.is_locked && <Badge variant="destructive" className="text-xs">مقفل</Badge>}
                  </div>
                  {v.description && <p className="text-sm text-muted-foreground mt-1">{v.description}</p>}
                  <a href={v.youtube_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block" dir="ltr">{v.youtube_url}</a>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild size="sm" variant="default">
                    <Link to={`/admin/practical/${v.id}`}><ListChecks className="w-4 h-4 ml-1" />نقاط التوقف</Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => toggleLock(v)} className={v.is_locked ? "text-destructive" : ""}>
                    {v.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(v)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(v.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل الفيديو" : "إضافة فيديو تدريبي"}</DialogTitle>
            <DialogDescription>أدخل رابط يوتيوب وبيانات الفيديو</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الكورس</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الكورس" /></SelectTrigger>
                <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>عنوان الفيديو</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="اكتب عنوانًا واضحًا يظهر للطالب…" />
            </div>
            <div className="space-y-1.5">
              <Label>رابط يوتيوب</Label>
              <Input value={form.youtube_url} onChange={e => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." dir="ltr" />
              <p className="text-xs text-muted-foreground">الصق رابط الفيديو من يوتيوب كما هو.</p>
            </div>
            <div className="space-y-1.5">
              <Label>وصف (اختياري)</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="اكتب وصفًا مختصرًا يوضح هدف هذا التدريب…" />
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
