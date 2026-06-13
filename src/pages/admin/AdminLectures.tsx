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
import { Plus, Trash2, Users, ClipboardList } from "lucide-react";
import { AssignStudentsDialog } from "@/components/AssignStudentsDialog";
import { LectureQuizManager } from "@/components/LectureQuizManager";

interface Lecture {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  duration_minutes: number | null;
  pdf_url: string | null;
  created_at: string;
}

export default function AdminLectures() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [open, setOpen] = useState(false);
  const [assignLecture, setAssignLecture] = useState<string | null>(null);
  const [quizLecture, setQuizLecture] = useState<Lecture | null>(null);
  const [form, setForm] = useState({ title: "", description: "", video_url: "", duration_minutes: "", pdf_url: "" });

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
      created_by: user?.id,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setForm({ title: "", description: "", video_url: "", duration_minutes: "", pdf_url: "" });
      setOpen(false);
      fetchLectures();
      toast({ title: "تمت الإضافة" });
    }
  };


  const handleDelete = async (id: string) => {
    await supabase.from("lectures").delete().eq("id", id);
    fetchLectures();
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
                  <TableCell className="font-medium">{l.title}</TableCell>
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

      {assignLecture && (
        <AssignStudentsDialog lectureId={assignLecture} onClose={() => { setAssignLecture(null); }} />
      )}

      <Dialog open={!!pdfLecture} onOpenChange={(o) => { if (!o) { setPdfLecture(null); setPdfUrlInput(""); } }}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>رابط ملف PDF للمحاضرة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>رابط Google Drive</Label>
              <Input value={pdfUrlInput} onChange={(e) => setPdfUrlInput(e.target.value)} dir="ltr" placeholder="https://drive.google.com/..." />
              <p className="text-xs text-muted-foreground mt-1">اترك الحقل فارغاً لحذف الرابط</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSavePdf} className="flex-1">حفظ</Button>
              {pdfLecture?.pdf_url && (
                <Button variant="destructive" onClick={() => { setPdfUrlInput(""); handleSavePdf(); }}>
                  <Trash2 className="w-4 h-4 ml-1" />حذف
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!quizLecture} onOpenChange={(o) => { if (!o) setQuizLecture(null); }}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إدارة كويز المحاضرة: {quizLecture?.title}</DialogTitle></DialogHeader>
          {quizLecture && <LectureQuizManager lectureId={quizLecture.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
