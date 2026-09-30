import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

const OPTIONS = [
  { id: "reports", title: "التقارير والنتائج", desc: "تقدم المشاهدة، نتائج الاختبارات، محاولات التدريب العملي" },
  { id: "students", title: "الطلاب", desc: "حذف جميع حسابات الطلاب وتسجيلاتهم (حسابات المسؤولين لا تُحذف)" },
  { id: "courses", title: "الكورسات والبرامج", desc: "الكورسات، المحاضرات، الاختبارات، التدريب العملي، ملفات الكورسات" },
];

export default function AdminDataReset() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const all = selected.length === OPTIONS.length;

  const run = async () => {
    if (!window.confirm("هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("wipe-data", {
      body: { categories: selected, confirm },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "خطأ", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم المسح بنجاح", description: data?.deletedStudents ? `تم حذف ${data.deletedStudents} طالب` : undefined });
    setSelected([]);
    setConfirm("");
  };

  return (
    <div dir="rtl" className="max-w-2xl">
      <h1 className="text-2xl font-heading font-bold mb-6">مسح بيانات المنصة</h1>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />منطقة خطرة
          </CardTitle>
          <CardDescription>اختر البيانات المراد مسحها نهائياً. لا يمكن استرجاعها بعد الحذف.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 p-3 rounded-md border bg-muted/40 cursor-pointer">
            <Checkbox checked={all} onCheckedChange={() => setSelected(all ? [] : OPTIONS.map((o) => o.id))} />
            <span className="font-bold">مسح جميع بيانات المنصة بالكامل</span>
          </label>
          {OPTIONS.map((o) => (
            <label key={o.id} className="flex items-start gap-3 p-3 rounded-md border cursor-pointer">
              <Checkbox className="mt-1" checked={selected.includes(o.id)} onCheckedChange={() => toggle(o.id)} />
              <div>
                <div className="font-medium">{o.title}</div>
                <div className="text-xs text-muted-foreground">{o.desc}</div>
              </div>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">ملاحظة: مسح الطلاب أو الكورسات يمسح التقارير المرتبطة بها تلقائياً.</p>
          <div>
            <Label>للتأكيد اكتب كلمة: حذف</Label>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="حذف" />
          </div>
          <Button variant="destructive" className="w-full" disabled={!selected.length || confirm !== "حذف" || loading} onClick={run}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Trash2 className="w-4 h-4 ml-2" />}
            مسح البيانات المحددة
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
