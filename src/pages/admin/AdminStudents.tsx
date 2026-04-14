import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, UserPlus, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

interface StudentRow {
  email: string;
  password: string;
}

interface StudentRecord {
  email: string;
  user_id: string;
  created_at: string;
}

export default function AdminStudents() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<StudentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ email: string; status: string }[]>([]);

  // Manual add state
  const [addOpen, setAddOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ email: "", password: "" });
  const [addingManual, setAddingManual] = useState(false);

  // Students list
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");

    if (data && data.length > 0) {
      // We don't have a profiles table, so just show user_ids with roles
      setStudents(data.map((d) => ({
        email: "",
        user_id: d.user_id,
        created_at: "",
      })));
    } else {
      setStudents([]);
    }
    setLoadingStudents(false);
  };

  // Fetch students on mount
  useState(() => {
    fetchStudents();
  });

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
        body: { email: manualForm.email.trim(), password: manualForm.password.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "تم إنشاء حساب الطالب بنجاح" });
      setManualForm({ email: "", password: "" });
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
      .map((r) => ({ email: String(r.email).trim(), password: String(r.password).trim() }));

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
          body: { email: s.email, password: s.password },
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
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "student");
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم حذف دور الطالب" });
      fetchStudents();
    }
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
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  placeholder="student@example.com"
                  dir="ltr"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                />
              </div>
              <div>
                <Label>كلمة المرور</Label>
                <Input
                  type="text"
                  placeholder="كلمة مرور (6 أحرف على الأقل)"
                  dir="ltr"
                  value={manualForm.password}
                  onChange={(e) => setManualForm({ ...manualForm, password: e.target.value })}
                />
              </div>
              <Button onClick={handleManualAdd} className="w-full" disabled={addingManual}>
                {addingManual ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <UserPlus className="w-4 h-4 ml-2" />}
                إنشاء حساب الطالب
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bulk upload section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">رفع ملف الطلاب (CSV/XLSX)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            يجب أن يحتوي الملف على عمودين: <strong>email</strong> و <strong>password</strong>
          </p>
          <div className="flex gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFile}
              className="hidden"
            />
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

      {/* Bulk upload results */}
      {(parsed.length > 0 || results.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">نتائج الرفع</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">البريد الإلكتروني</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(results.length > 0 ? results : parsed).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{"status" in row ? row.status : "جاهز"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Students list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">قائمة الطلاب المسجلين</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">معرّف الطالب</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.user_id}>
                  <TableCell className="font-mono text-sm">{s.user_id}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteStudent(s.user_id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {students.length === 0 && !loadingStudents && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-8">لا يوجد طلاب مسجلين</TableCell>
                </TableRow>
              )}
              {loadingStudents && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
