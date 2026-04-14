import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  lectureId: string;
  onClose: () => void;
}

interface StudentItem {
  user_id: string;
  full_name: string;
  assigned: boolean;
}

export function AssignStudentsDialog({ lectureId, onClose }: Props) {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      const studentIds = (roles || []).map((r) => r.user_id);

      const { data: assignments } = await supabase
        .from("student_lectures")
        .select("student_id")
        .eq("lecture_id", lectureId);
      const assignedIds = new Set((assignments || []).map((a) => a.student_id));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", studentIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

      setStudents(
        studentIds.map((uid) => ({
          user_id: uid,
          full_name: profileMap.get(uid) || uid.slice(0, 8) + "...",
          assigned: assignedIds.has(uid),
        }))
      );
      setLoading(false);
    };
    fetch();
  }, [lectureId]);

  const toggle = (userId: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.user_id === userId ? { ...s, assigned: !s.assigned } : s))
    );
  };

  const save = async () => {
    setSaving(true);
    await supabase.from("student_lectures").delete().eq("lecture_id", lectureId);

    const toAssign = students.filter((s) => s.assigned);
    if (toAssign.length > 0) {
      const { error } = await supabase.from("student_lectures").insert(
        toAssign.map((s) => ({ student_id: s.user_id, lecture_id: lectureId }))
      );
      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    toast({ title: "تم حفظ التخصيصات" });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تخصيص الطلاب للمحاضرة</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : students.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا يوجد طلاب مسجلين</p>
        ) : (
          <div className="space-y-3">
            {students.map((s) => (
              <label key={s.user_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                <Checkbox checked={s.assigned} onCheckedChange={() => toggle(s.user_id)} />
                <span className="text-sm font-medium">{s.full_name}</span>
              </label>
            ))}
            <Button onClick={save} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              حفظ
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
