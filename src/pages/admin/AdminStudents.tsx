import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, UserPlus } from "lucide-react";
import * as XLSX from "xlsx";

interface StudentRow {
  email: string;
  password: string;
}

export default function AdminStudents() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<StudentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ email: string; status: string }[]>([]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);

    const students: StudentRow[] = rows
      .filter((r) => r.email && r.password)
      .map((r) => ({ email: String(r.email).trim(), password: String(r.password).trim() }));

    if (students.length === 0) {
      toast({ title: "خطأ", description: "الملف لا يحتوي على أعمدة email و password", variant: "destructive" });
      return;
    }
    setParsed(students);
    setResults([]);
  };

  const handleCreate = async () => {
    setUploading(true);
    const res: { email: string; status: string }[] = [];

    for (const s of parsed) {
      try {
        // Create user via admin edge function
        const { data, error } = await supabase.functions.invoke("create-student", {
          body: { email: s.email, password: s.password },
        });
        if (error) throw error;
        res.push({ email: s.email, status: "✅ تم الإنشاء" });
      } catch (err: any) {
        res.push({ email: s.email, status: `❌ ${err.message || "خطأ"}` });
      }
    }

    setResults(res);
    setUploading(false);
    toast({ title: "اكتمل إنشاء الحسابات" });
  };

  return (
    <div dir="rtl">
      <h1 className="text-2xl font-heading font-bold mb-6">إدارة الطلاب</h1>

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
              <Button onClick={handleCreate} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <UserPlus className="w-4 h-4 ml-2" />}
                إنشاء {parsed.length} حساب
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {(parsed.length > 0 || results.length > 0) && (
        <Card>
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
    </div>
  );
}
