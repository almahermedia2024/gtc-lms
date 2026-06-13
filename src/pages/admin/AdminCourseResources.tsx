import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Pencil, Link as LinkIcon, FileText, ExternalLink, Eye, EyeOff } from "lucide-react";

interface Course {
  id: string;
  title: string;
}

interface Resource {
  id: string;
  course_id: string;
  title: string;
  url: string;
  is_visible: boolean;
  display_order: number;
}

export default function AdminCourseResources() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState({ course_id: "", title: "", url: "", is_visible: true });
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from("courses").select("id, title").order("title"),
      supabase.from("course_resources").select("*").order("display_order").order("created_at"),
    ]);
    setCourses(c || []);
    setResources((r as Resource[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ course_id: selectedCourse !== "all" ? selectedCourse : (courses[0]?.id || ""), title: "", url: "", is_visible: true });
    setDialogOpen(true);
  };

  const openEdit = (r: Resource) => {
    setEditing(r);
    setForm({ course_id: r.course_id, title: r.title, url: r.url, is_visible: r.is_visible });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.course_id || !form.title.trim() || !form.url.trim()) {
      toast({ title: "خطأ", description: "يرجى تعبئة جميع الحقول", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from("course_resources").update({
        course_id: form.course_id,
        title: form.title.trim(),
        url: form.url.trim(),
        is_visible: form.is_visible,
      }).eq("id", editing.id);
      if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
      else toast({ title: "تم تحديث الملف" });
    } else {
      const { error } = await supabase.from("course_resources").insert({
        course_id: form.course_id,
        title: form.title.trim(),
        url: form.url.trim(),
        is_visible: form.is_visible,
        created_by: user?.id,
      });
      if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
      else toast({ title: "تمت إضافة الملف" });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("course_resources").delete().eq("id", id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم الحذف" }); fetchAll(); }
  };

  const toggleVisibility = async (r: Resource) => {
    const { error } = await supabase.from("course_resources").update({ is_visible: !r.is_visible }).eq("id", r.id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      setResources(prev => prev.map(x => x.id === r.id ? { ...x, is_visible: !r.is_visible } : x));
    }
  };

  const courseMap = new Map(courses.map(c => [c.id, c.title]));
  const filtered = selectedCourse === "all" ? resources : resources.filter(r => r.course_id === selectedCourse);

  // Group by course
  const grouped = filtered.reduce<Record<string, Resource[]>>((acc, r) => {
    (acc[r.course_id] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">ملفات الكورسات</h1>
          <p className="text-sm text-muted-foreground mt-1">أضف روابط تحميل لملفات متعددة لكل كورس وتحكم في ظهورها للطلاب</p>
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
            <Plus className="w-4 h-4 ml-2" />إضافة ملف
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>أضف كورساً أولاً من صفحة الكورسات.</p>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <LinkIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>لا توجد ملفات بعد. اضغط "إضافة ملف" للبدء.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cid, items]) => (
            <Card key={cid} className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-heading flex items-center justify-between">
                  <span>{courseMap.get(cid) || "كورس محذوف"}</span>
                  <Badge variant="secondary">{items.length} ملف</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-md border border-border/50 bg-card/50 flex-wrap">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-sm font-medium">{r.title}</p>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 break-all">
                        {r.url} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.is_visible ? "default" : "outline"} className="text-xs">
                        {r.is_visible ? <><Eye className="w-3 h-3 ml-1" />ظاهر</> : <><EyeOff className="w-3 h-3 ml-1" />مخفي</>}
                      </Badge>
                      <Switch checked={r.is_visible} onCheckedChange={() => toggleVisibility(r)} />
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل الملف" : "إضافة ملف جديد"}</DialogTitle>
            <DialogDescription>أدخل بيانات رابط التحميل</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الكورس</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الكورس" /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>عنوان الملف</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="مثال: ملخص المحاضرة الأولى" />
            </div>
            <div>
              <Label>رابط التحميل</Label>
              <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." dir="ltr" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-md border border-border/50">
              <div>
                <Label>ظهور الملف للطلاب</Label>
                <p className="text-xs text-muted-foreground mt-1">عند الإيقاف لن يظهر الملف للطلاب</p>
              </div>
              <Switch checked={form.is_visible} onCheckedChange={(v) => setForm({ ...form, is_visible: v })} />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
              {editing ? "حفظ التعديلات" : "إضافة الملف"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
