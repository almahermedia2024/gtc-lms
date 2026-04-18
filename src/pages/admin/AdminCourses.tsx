import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Video, Users, Loader2, Pencil, BookOpen, UserMinus } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  lecture_count: number;
  student_count: number;
}

interface LectureItem {
  id: string;
  title: string;
  assigned: boolean;
}

interface StudentItem {
  user_id: string;
  full_name: string;
  enrolled: boolean;
}

export default function AdminCourses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Add course dialog
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [adding, setAdding] = useState(false);

  // Edit course dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "" });
  const [saving, setSaving] = useState(false);

  // Manage lectures dialog
  const [lecturesDialogCourse, setLecturesDialogCourse] = useState<string | null>(null);
  const [lectureItems, setLectureItems] = useState<LectureItem[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [savingLectures, setSavingLectures] = useState(false);

  // Manage students dialog
  const [studentsDialogCourse, setStudentsDialogCourse] = useState<string | null>(null);
  const [studentItems, setStudentItems] = useState<StudentItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingStudents, setSavingStudents] = useState(false);

  // Remove all students confirmation
  const [removeAllCourse, setRemoveAllCourse] = useState<Course | null>(null);
  const [removingAll, setRemovingAll] = useState(false);

  const handleRemoveAllStudents = async () => {
    if (!removeAllCourse) return;
    setRemovingAll(true);

    // Get enrolled students of this course
    const { data: enrollments } = await supabase
      .from("course_students")
      .select("student_id")
      .eq("course_id", removeAllCourse.id);
    const studentIds = Array.from(new Set((enrollments || []).map(e => e.student_id)));

    if (studentIds.length === 0) {
      toast({ title: "لا يوجد طلاب لمسحهم" });
      setRemovingAll(false);
      setRemoveAllCourse(null);
      return;
    }

    // Permanently delete each student account from the system (auth + all data)
    let successCount = 0;
    let failCount = 0;
    for (const sid of studentIds) {
      const { error } = await supabase.functions.invoke("delete-student", {
        body: { user_id: sid },
      });
      if (error) {
        failCount++;
        console.error("Failed to delete student", sid, error);
      } else {
        successCount++;
      }
    }

    if (failCount > 0) {
      toast({
        title: "تم المسح مع وجود أخطاء",
        description: `تم حذف ${successCount} طالب وفشل حذف ${failCount}`,
        variant: "destructive",
      });
    } else {
      toast({ title: `تم حذف ${successCount} طالب نهائياً من النظام` });
    }
    fetchCourses();
    setRemovingAll(false);
    setRemoveAllCourse(null);
  };

  const fetchCourses = async () => {
    setLoading(true);
    const { data: coursesData } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (!coursesData) { setCourses([]); setLoading(false); return; }

    const courseIds = coursesData.map(c => c.id);

    const { data: lectures } = await supabase
      .from("lectures")
      .select("id, course_id")
      .in("course_id", courseIds.length > 0 ? courseIds : ["__none__"]);

    const { data: enrollments } = await supabase
      .from("course_students")
      .select("id, course_id")
      .in("course_id", courseIds.length > 0 ? courseIds : ["__none__"]);

    const lectureCounts = new Map<string, number>();
    (lectures || []).forEach(l => lectureCounts.set(l.course_id!, (lectureCounts.get(l.course_id!) || 0) + 1));

    const studentCounts = new Map<string, number>();
    (enrollments || []).forEach(e => studentCounts.set(e.course_id, (studentCounts.get(e.course_id) || 0) + 1));

    setCourses(coursesData.map(c => ({
      ...c,
      lecture_count: lectureCounts.get(c.id) || 0,
      student_count: studentCounts.get(c.id) || 0,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleAdd = async () => {
    if (!form.title.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم الكورس", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("courses").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      created_by: user?.id,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setForm({ title: "", description: "" });
      setAddOpen(false);
      fetchCourses();
      toast({ title: "تم إنشاء الكورس" });
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      fetchCourses();
      toast({ title: "تم حذف الكورس" });
    }
  };

  const handleEditSave = async () => {
    if (!editCourse || !editForm.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("courses").update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
    }).eq("id", editCourse.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setEditOpen(false);
      fetchCourses();
      toast({ title: "تم تحديث الكورس" });
    }
    setSaving(false);
  };

  // --- Lectures management ---
  const openLecturesDialog = async (courseId: string) => {
    setLecturesDialogCourse(courseId);
    setLoadingLectures(true);
    const { data: allLectures } = await supabase.from("lectures").select("id, title, course_id");
    setLectureItems(
      (allLectures || []).map(l => ({
        id: l.id,
        title: l.title,
        assigned: l.course_id === courseId,
      }))
    );
    setLoadingLectures(false);
  };

  const toggleLecture = (id: string) => {
    setLectureItems(prev => prev.map(l => l.id === id ? { ...l, assigned: !l.assigned } : l));
  };

  const saveLectures = async () => {
    if (!lecturesDialogCourse) return;
    setSavingLectures(true);
    // Unassign all from this course, then assign selected
    const toAssign = lectureItems.filter(l => l.assigned).map(l => l.id);
    const toUnassign = lectureItems.filter(l => !l.assigned).map(l => l.id);

    if (toUnassign.length > 0) {
      await supabase.from("lectures").update({ course_id: null }).in("id", toUnassign).eq("course_id", lecturesDialogCourse);
    }
    if (toAssign.length > 0) {
      for (const lid of toAssign) {
        await supabase.from("lectures").update({ course_id: lecturesDialogCourse }).eq("id", lid);
      }
    }
    toast({ title: "تم حفظ المحاضرات" });
    setSavingLectures(false);
    setLecturesDialogCourse(null);
    fetchCourses();
  };

  // --- Students management ---
  const openStudentsDialog = async (courseId: string) => {
    setStudentsDialogCourse(courseId);
    setLoadingStudents(true);

    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
    const studentIds = (roles || []).map(r => r.user_id);

    const { data: enrollments } = await supabase.from("course_students").select("student_id").eq("course_id", courseId);
    const enrolledIds = new Set((enrollments || []).map(e => e.student_id));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, is_active")
      .in("user_id", studentIds.length > 0 ? studentIds : ["__none__"]);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    setStudentItems(
      studentIds
        .filter(uid => profileMap.get(uid)?.is_active !== false)
        .map(uid => ({
          user_id: uid,
          full_name: profileMap.get(uid)?.full_name || uid.slice(0, 8) + "...",
          enrolled: enrolledIds.has(uid),
        }))
    );
    setLoadingStudents(false);
  };

  const toggleStudent = (userId: string) => {
    setStudentItems(prev => prev.map(s => s.user_id === userId ? { ...s, enrolled: !s.enrolled } : s));
  };

  const selectAllStudents = () => {
    const allEnrolled = studentItems.every(s => s.enrolled);
    setStudentItems(prev => prev.map(s => ({ ...s, enrolled: !allEnrolled })));
  };

  const saveStudents = async () => {
    if (!studentsDialogCourse) return;
    setSavingStudents(true);
    // Delete all enrollments for this course, then insert selected
    await supabase.from("course_students").delete().eq("course_id", studentsDialogCourse);
    const toEnroll = studentItems.filter(s => s.enrolled);
    if (toEnroll.length > 0) {
      const { error } = await supabase.from("course_students").insert(
        toEnroll.map(s => ({ course_id: studentsDialogCourse, student_id: s.user_id }))
      );
      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
        setSavingStudents(false);
        return;
      }
    }

    // Also assign enrolled students to all lectures in this course via student_lectures
    const { data: courseLectures } = await supabase
      .from("lectures")
      .select("id")
      .eq("course_id", studentsDialogCourse);

    if (courseLectures && courseLectures.length > 0 && toEnroll.length > 0) {
      const assignments = toEnroll.flatMap(s =>
        courseLectures.map(l => ({ student_id: s.user_id, lecture_id: l.id }))
      );
      // Delete old assignments for these lectures, then insert
      for (const l of courseLectures) {
        await supabase.from("student_lectures").delete().eq("lecture_id", l.id);
      }
      if (assignments.length > 0) {
        await supabase.from("student_lectures").insert(assignments);
      }
    }

    toast({ title: "تم حفظ تسجيل الطلاب" });
    setSavingStudents(false);
    setStudentsDialogCourse(null);
    fetchCourses();
  };

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold">الكورسات</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-2" />إضافة كورس</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة كورس جديد</DialogTitle>
              <DialogDescription>أدخل بيانات الكورس</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>اسم الكورس</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>الوصف</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <Button onClick={handleAdd} className="w-full" disabled={adding}>
                {adding ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
                إنشاء الكورس
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>لا توجد كورسات. أضف كورس جديد للبدء.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(c => (
            <Card key={c.id} className="border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-heading">{c.title}</CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditCourse(c); setEditForm({ title: c.title, description: c.description || "" }); setEditOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      title="مسح جميع الطلاب من الكورس"
                      disabled={c.student_count === 0}
                      onClick={() => setRemoveAllCourse(c)}
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {c.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{c.description}</p>}
                <div className="flex gap-3 mb-3">
                  <Badge variant="secondary"><Video className="w-3 h-3 ml-1" />{c.lecture_count} محاضرة</Badge>
                  <Badge variant="outline"><Users className="w-3 h-3 ml-1" />{c.student_count} طالب</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openLecturesDialog(c.id)}>
                    <Video className="w-4 h-4 ml-1" />المحاضرات
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openStudentsDialog(c.id)}>
                    <Users className="w-4 h-4 ml-1" />الطلاب
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Course Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الكورس</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>اسم الكورس</Label><Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} /></div>
            <div><Label>الوصف</Label><Textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} /></div>
            <Button onClick={handleEditSave} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حفظ التعديلات
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Lectures Dialog */}
      <Dialog open={!!lecturesDialogCourse} onOpenChange={() => setLecturesDialogCourse(null)}>
        <DialogContent dir="rtl" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إدارة محاضرات الكورس</DialogTitle>
            <DialogDescription>اختر المحاضرات التي تنتمي لهذا الكورس</DialogDescription>
          </DialogHeader>
          {loadingLectures ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : lectureItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد محاضرات. أضف محاضرات أولاً من صفحة المحاضرات.</p>
          ) : (
            <div className="space-y-3">
              {lectureItems.map(l => (
                <label key={l.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                  <Checkbox checked={l.assigned} onCheckedChange={() => toggleLecture(l.id)} />
                  <span className="text-sm font-medium">{l.title}</span>
                </label>
              ))}
              <Button onClick={saveLectures} className="w-full" disabled={savingLectures}>
                {savingLectures ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                حفظ
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Students Dialog */}
      <Dialog open={!!studentsDialogCourse} onOpenChange={() => setStudentsDialogCourse(null)}>
        <DialogContent dir="rtl" className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تسجيل الطلاب في الكورس</DialogTitle>
            <DialogDescription>اختر الطلاب المسجلين في هذا الكورس</DialogDescription>
          </DialogHeader>
          {loadingStudents ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : studentItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا يوجد طلاب نشطين</p>
          ) : (
            <div className="space-y-3">
              <Button variant="outline" size="sm" onClick={selectAllStudents} className="w-full">
                <Users className="w-4 h-4 ml-2" />
                {studentItems.every(s => s.enrolled) ? "إلغاء تحديد الكل" : "تحديد جميع الطلاب"}
              </Button>
              {studentItems.map(s => (
                <label key={s.user_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                  <Checkbox checked={s.enrolled} onCheckedChange={() => toggleStudent(s.user_id)} />
                  <span className="text-sm font-medium">{s.full_name}</span>
                </label>
              ))}
              <Button onClick={saveStudents} className="w-full" disabled={savingStudents}>
                {savingStudents ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                حفظ
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm remove all students */}
      <AlertDialog open={!!removeAllCourse} onOpenChange={(open) => !open && setRemoveAllCourse(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف جميع طلاب الكورس نهائياً</AlertDialogTitle>
            <AlertDialogDescription>
              ⚠️ تحذير: سيتم حذف جميع الطلاب ({removeAllCourse?.student_count}) المسجلين في كورس "{removeAllCourse?.title}" نهائياً من النظام بالكامل، بما في ذلك حساباتهم وبياناتهم وتقدمهم في جميع الكورسات الأخرى. هذا يسمح بإعادة استخدام بريدهم الإلكتروني لاحقاً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingAll}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAllStudents}
              disabled={removingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingAll ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              مسح الجميع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
