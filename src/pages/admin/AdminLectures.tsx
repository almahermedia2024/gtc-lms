import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Users, ClipboardList, Lock, Unlock, CalendarClock } from "lucide-react";
import { Dialog as SDialog, DialogContent as SDialogContent, DialogHeader as SDialogHeader, DialogTitle as SDialogTitle, DialogDescription as SDialogDescription } from "@/components/ui/dialog";
import { AssignStudentsDialog } from "@/components/AssignStudentsDialog";
import { LectureQuizManager } from "@/components/LectureQuizManager";

interface Lecture {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  duration_minutes: number | null;
  pdf_url: string | null;
  is_locked: boolean;
  available_from: string | null;
  available_until: string | null;
  created_at: string;
}

export default function AdminLectures() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [open, setOpen] = useState(false);
  const [assignLecture, setAssignLecture] = useState<string | null>(null);
  const [quizLecture, setQuizLecture] = useState<Lecture | null>(null);
  const [form, setForm] = useState({ title: "", description: "", video_url: "", duration_minutes: "", pdf_url: "", available_from: "", available_until: "" });

  const fetchLectures = async () => {
    const { data } = await supabase.from("lectures").select("*").order("created_at", { ascending: false });
    setLectures(data || []);
  };

  useEffect(() => { fetchLectures(); }, []);

  const handleAdd = async () => {
    if (!form.title.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال عنوان المحاضرة", variant: "destructive" });
      return;
    }
    if (!form.video_url.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال رابط الفيديو", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("lectures").insert({
      title: form.title,
      description: form.description || null,
      video_url: form.video_url,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : 0,
      pdf_url: form.pdf_url.trim() || null,
      available_from: form.available_from ? new Date(form.available_from).toISOString() : null,
      available_until: form.available_until ? new Date(form.available_until).toISOString() : null,
      created_by: user?.id,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setForm({ title: "", description: "", video_url: "", duration_minutes: "", pdf_url: "", available_from: "", available_until: "" });
      setOpen(false);
      fetchLectures();
      toast({ title: "تمت الإضافة" });
    }
  };


  const handleDelete = async (id: string) => {
    await supabase.from("lectures").delete().eq("id", id);
    fetchLectures();
  };

  const [schedLecture, setSchedLecture] = useState<Lecture | null>(null);
  const [schedValue, setSchedValue] = useState("");
  const [schedUntil, setSchedUntil] = useState("");
  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const saveSchedule = async (value: string | null, until: string | null) => {
    if (!schedLecture) return;
    const available_from = value ? new Date(value).toISOString() : null;
    const available_until = until ? new Date(until).toISOString() : null;
    if (available_from && available_until && available_until <= available_from) {
      toast({ title: "خطأ", description: "موعد الانتهاء يجب أن يكون بعد موعد البداية", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("lectures").update({ available_from, available_until }).eq("id", schedLecture.id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      toast({ title: available_from || available_until ? "تم حفظ مواعيد الإتاحة" : "تم إلغاء المواعيد — المحاضرة متاحة دائمًا" });
      setLectures(prev => prev.map(x => x.id === schedLecture.id ? { ...x, available_from, available_until } : x));
      setSchedLecture(null);
    }
  };

  const handleToggleLock = async (l: Lecture) => {
    const { error } = await supabase
      .from("lectures")
      .update({ is_locked: !l.is_locked })
      .eq("id", l.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: !l.is_locked ? "تم قفل المحاضرة" : "تم فتح المحاضرة" });
      fetchLectures();
    }
  };

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold">المحاضرات</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-2" />إضافة محاضرة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إضافة محاضرة جديدة</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>العنوان</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>الوصف</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>رابط الفيديو</Label><Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} dir="ltr" /></div>
              <div><Label>المدة (بالدقائق)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
              <div><Label>موعد الإتاحة للمتدربين (اختياري)</Label><Input type="datetime-local" value={form.available_from} onChange={(e) => setForm({ ...form, available_from: e.target.value })} dir="ltr" /><p className="text-xs text-muted-foreground mt-1">اتركه فارغًا لتكون المحاضرة متاحة فورًا.</p></div>
              <div><Label>موعد انتهاء الإتاحة (اختياري)</Label><Input type="datetime-local" value={form.available_until} onChange={(e) => setForm({ ...form, available_until: e.target.value })} dir="ltr" /><p className="text-xs text-muted-foreground mt-1">بعد هذا الموعد تختفي المحاضرة من حسابات المتدربين.</p></div>
              <div><Label>رابط ملف PDF (Google Drive) - اختياري</Label><Input value={form.pdf_url} onChange={(e) => setForm({ ...form, pdf_url: e.target.value })} dir="ltr" placeholder="https://drive.google.com/..." /></div>
              <Button onClick={handleAdd} className="w-full">إضافة</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">العنوان</TableHead>
                <TableHead className="text-right">المدة</TableHead>
                <TableHead className="text-right">تاريخ الإضافة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lectures.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {l.is_locked && <Lock className="w-4 h-4 text-destructive" />}
                      <span>{l.title}</span>
                    </div>
                    {(l.available_from || l.available_until) && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                        <CalendarClock className="w-3 h-3" />
                        {l.available_from && <span>من {new Date(l.available_from).toLocaleString("ar")}</span>}
                        {l.available_until && <span>حتى {new Date(l.available_until).toLocaleString("ar")}</span>}
                        {l.available_until && new Date(l.available_until) <= new Date() && <span className="text-destructive font-bold">(منتهية)</span>}
                        {l.available_from && new Date(l.available_from) > new Date() && <span className="text-primary font-bold">(لم تبدأ)</span>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{l.duration_minutes || 0} د</TableCell>
                  <TableCell>{new Date(l.created_at).toLocaleDateString("ar")}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setAssignLecture(l.id)}>
                        <Users className="w-4 h-4 ml-1" />تخصيص
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setQuizLecture(l)}>
                        <ClipboardList className="w-4 h-4 ml-1" />الكويز
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setSchedLecture(l); setSchedValue(toLocalInput(l.available_from)); setSchedUntil(toLocalInput(l.available_until)); }}>
                        <CalendarClock className="w-4 h-4 ml-1" />موعد الإتاحة
                      </Button>
                      <Button
                        size="sm"
                        variant={l.is_locked ? "default" : "secondary"}
                        onClick={() => handleToggleLock(l)}
                      >
                        {l.is_locked ? (
                          <><Unlock className="w-4 h-4 ml-1" />فتح</>
                        ) : (
                          <><Lock className="w-4 h-4 ml-1" />قفل</>
                        )}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(l.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!lectures.length && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد محاضرات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SDialog open={!!schedLecture} onOpenChange={(o) => !o && setSchedLecture(null)}>
        <SDialogContent dir="rtl">
          <SDialogHeader>
            <SDialogTitle>موعد إتاحة المحاضرة</SDialogTitle>
            <SDialogDescription>{schedLecture?.title} — حدد فترة ظهور المحاضرة للمتدربين.</SDialogDescription>
          </SDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>تبدأ في</Label><Input type="datetime-local" value={schedValue} onChange={(e) => setSchedValue(e.target.value)} dir="ltr" /></div>
            <div className="space-y-1"><Label>تنتهي في</Label><Input type="datetime-local" value={schedUntil} onChange={(e) => setSchedUntil(e.target.value)} dir="ltr" /></div>
            <p className="text-xs text-muted-foreground">لا تظهر المحاضرة للمتدربين إلا بين هذين الموعدين. اترك أي خانة فارغة لعدم التقييد.</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => saveSchedule(schedValue || null, schedUntil || null)}>حفظ المواعيد</Button>
              <Button variant="outline" onClick={() => saveSchedule(null, null)}>إلغاء المواعيد</Button>
            </div>
          </div>
        </SDialogContent>
      </SDialog>

      {assignLecture && (
        <AssignStudentsDialog lectureId={assignLecture} onClose={() => { setAssignLecture(null); }} />
      )}


      <Dialog open={!!quizLecture} onOpenChange={(o) => { if (!o) setQuizLecture(null); }}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إدارة كويز المحاضرة: {quizLecture?.title}</DialogTitle></DialogHeader>
          {quizLecture && <LectureQuizManager lectureId={quizLecture.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
