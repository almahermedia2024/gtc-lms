import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, UserPlus, Trash2, Pencil, Ban, CheckCircle, Phone, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

interface StudentRow {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
}

interface StudentRecord {
  user_id: string;
  full_name: string;
  is_active: boolean;
  phone: string;
}

export default function AdminStudents() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<StudentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ email: string; status: string }[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ email: "", password: "", full_name: "", phone: "" });
  const [addingManual, setAddingManual] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentRecord | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [saving, setSaving] = useState(false);

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");

    if (roles && roles.length > 0) {
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, is_active, phone")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      setStudents(
        userIds.map((uid) => {
          const profile = profileMap.get(uid);
          return {
            user_id: uid,
            full_name: profile?.full_name || uid.slice(0, 8) + "...",
            is_active: profile?.is_active ?? true,
            phone: (profile as any)?.phone || "",
          };
        })
      );
    } else {
      setStudents([]);
    }
    setLoadingStudents(false);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleManualAdd = async () => {
    if (!manualForm.email.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال البريد الإلكتروني", variant: "destructive" });
      return;
    }
    if (!manualForm.password.trim() || manualForm.password.length < 6) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }

    setAddingManual(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-student", {
        body: {
          email: manualForm.email.trim(),
          password: manualForm.password.trim(),
          full_name: manualForm.full_name.trim() || undefined,
          phone: manualForm.phone.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "تم إنشاء حساب الطالب بنجاح" });
      setManualForm({ email: "", password: "", full_name: "", phone: "" });
      setAddOpen(false);
      fetchStudents();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "فشل إنشاء الحساب", variant: "destructive" });
    } finally {
      setAddingManual(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);

    const studentsData: StudentRow[] = rows
      .filter((r) => r.email && r.password)
      .map((r) => ({
        email: String(r.email).trim(),
        password: String(r.password).trim(),
        full_name: r.full_name ? String(r.full_name).trim() : r.name ? String(r.name).trim() : undefined,
        phone: r.phone ? String(r.phone).trim() : undefined,
      }));

    if (studentsData.length === 0) {
      toast({ title: "خطأ", description: "الملف لا يحتوي على أعمدة email و password", variant: "destructive" });
      return;
    }
    setParsed(studentsData);
    setResults([]);
  };

  const handleBulkCreate = async () => {
    setUploading(true);
    const res: { email: string; status: string }[] = [];

    for (const s of parsed) {
      try {
        const { data, error } = await supabase.functions.invoke("create-student", {
          body: { email: s.email, password: s.password, full_name: s.full_name, phone: s.phone },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        res.push({ email: s.email, status: "✅ تم الإنشاء" });
      } catch (err: any) {
        res.push({ email: s.email, status: `❌ ${err.message || "خطأ"}` });
      }
    }

    setResults(res);
    setUploading(false);
    fetchStudents();
    toast({ title: "اكتمل إنشاء الحسابات" });
  };

  const handleDeleteStudent = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("delete-student", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "تم حذف الطالب بالكامل" });
      fetchStudents();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "فشل حذف الطالب", variant: "destructive" });
    }
  };

  const handleToggleActive = async (student: StudentRecord) => {
    const newStatus = !student.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newStatus })
      .eq("user_id", student.user_id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newStatus ? "تم تفعيل الطالب" : "تم تعطيل الطالب" });
      fetchStudents();
    }
  };

  const handleEditSave = async () => {
    if (!editStudent) return;
    setSaving(true);
    try {
      const body: any = { user_id: editStudent.user_id };
      if (editForm.full_name.trim()) body.full_name = editForm.full_name.trim();
      if (editForm.email.trim()) body.email = editForm.email.trim();
      if (editForm.phone !== undefined) body.phone = editForm.phone.trim();
      if (editForm.password.trim()) body.password = editForm.password.trim();

      const { data, error } = await supabase.functions.invoke("update-student", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "تم تحديث بيانات الطالب" });
      setEditOpen(false);
      fetchStudents();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "فشل التحديث", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold">إدارة الطلاب</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="w-4 h-4 ml-2" />إضافة طالب</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة طالب جديد</DialogTitle>
              <DialogDescription>أدخل بيانات الطالب لإنشاء حساب جديد</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>اسم الطالب</Label>
                <Input type="text" placeholder="الاسم الكامل" value={manualForm.full_name} onChange={(e) => setManualForm({ ...manualForm, full_name: e.target.value })} />
              </div>
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input type="email" placeholder="student@example.com" dir="ltr" value={manualForm.email} onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })} />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input type="tel" placeholder="01xxxxxxxxx" dir="ltr" value={manualForm.phone} onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })} />
              </div>
              <div>
                <Label>كلمة المرور</Label>
                <Input type="password" placeholder="كلمة مرور (6 أحرف على الأقل)" dir="ltr" value={manualForm.password} onChange={(e) => setManualForm({ ...manualForm, password: e.target.value })} />
              </div>
              <Button onClick={handleManualAdd} className="w-full" disabled={addingManual}>
                {addingManual ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <UserPlus className="w-4 h-4 ml-2" />}
                إنشاء حساب الطالب
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bulk upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">رفع ملف الطلاب (CSV/XLSX)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            يجب أن يحتوي الملف على أعمدة: <strong>email</strong> و <strong>password</strong> و <strong>full_name</strong> (اختياري) و <strong>phone</strong> (اختياري)
          </p>
          <div className="flex gap-3">
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 ml-2" />اختيار ملف
            </Button>
            {parsed.length > 0 && (
              <Button onClick={handleBulkCreate} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <UserPlus className="w-4 h-4 ml-2" />}
                إنشاء {parsed.length} حساب
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {(parsed.length > 0 || results.length > 0) && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">نتائج الرفع</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">البريد الإلكتروني</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(results.length > 0 ? results.map((r, i) => ({ ...r, full_name: parsed[i]?.full_name || "", phone: parsed[i]?.phone || "" })) : parsed).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.full_name || "—"}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{(row as any).phone || "—"}</TableCell>
                    <TableCell>{"status" in row ? (row as any).status : "جاهز"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Students list */}
      <Card>
        <CardHeader><CardTitle className="text-lg">قائمة الطلاب المسجلين ({students.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">اسم الطالب</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.user_id} className={!s.is_active ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell dir="ltr" className="text-right">
                    {s.phone ? (
                      <span className="flex items-center gap-1 justify-end">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {s.phone}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "نشط" : "معطّل"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditStudent(s);
                          setEditForm({ full_name: s.full_name, email: "", phone: s.phone, password: "" });
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={s.is_active ? "secondary" : "outline"}
                        onClick={() => handleToggleActive(s)}
                        title={s.is_active ? "تعطيل" : "تفعيل"}
                      >
                        {s.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteStudent(s.user_id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {students.length === 0 && !loadingStudents && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا يوجد طلاب مسجلين</TableCell>
                </TableRow>
              )}
              {loadingStudents && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الطالب</DialogTitle>
            <DialogDescription>يمكنك تعديل أي من الحقول التالية. اترك الحقل فارغاً إذا لم ترد تغييره.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم الطالب</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div>
              <Label>البريد الإلكتروني الجديد</Label>
              <Input type="email" dir="ltr" placeholder="اترك فارغاً إذا لم ترد التغيير" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>رقم الهاتف</Label>
              <Input type="tel" dir="ltr" placeholder="01xxxxxxxxx" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <Label>كلمة المرور الجديدة</Label>
              <Input type="password" dir="ltr" placeholder="اترك فارغاً إذا لم ترد التغيير" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
            </div>
            <Button onClick={handleEditSave} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حفظ التعديلات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
