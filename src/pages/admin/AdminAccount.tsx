import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, KeyRound, UserPlus, ShieldCheck } from "lucide-react";

interface AdminUser {
  user_id: string;
  email?: string;
  is_self: boolean;
}

export default function AdminAccount() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // self password
  const [myNewPwd, setMyNewPwd] = useState("");
  const [myConfirmPwd, setMyConfirmPwd] = useState("");
  const [savingMyPwd, setSavingMyPwd] = useState(false);

  // create admin
  const [newEmail, setNewEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [creating, setCreating] = useState(false);

  // change other admin password
  const [pwdEdits, setPwdEdits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAdmins = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-admins", { body: { action: "list" } });
    if (error || data?.error) {
      toast({ title: "خطأ", description: data?.error || error?.message, variant: "destructive" });
    } else {
      setAdmins(data.admins || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleChangeMyPassword = async () => {
    if (myNewPwd.length < 8) {
      toast({ title: "كلمة المرور قصيرة", description: "8 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (myNewPwd !== myConfirmPwd) {
      toast({ title: "غير متطابقتين", description: "تأكد من تطابق كلمتي المرور", variant: "destructive" });
      return;
    }
    setSavingMyPwd(true);
    const { error } = await supabase.auth.updateUser({ password: myNewPwd });
    setSavingMyPwd(false);
    if (error) {
      toast({ title: "فشل التحديث", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم التحديث", description: "تم تغيير كلمة المرور بنجاح" });
      setMyNewPwd("");
      setMyConfirmPwd("");
    }
  };

  const handleCreateAdmin = async () => {
    if (!newEmail || newPwd.length < 8) {
      toast({ title: "بيانات ناقصة", description: "بريد صحيح وكلمة مرور 8 أحرف+", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("manage-admins", {
      body: { action: "create", email: newEmail, password: newPwd },
    });
    setCreating(false);
    if (error || data?.error) {
      toast({ title: "فشل الإنشاء", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "تم الإنشاء", description: "تم إضافة المسؤول الجديد" });
      setNewEmail("");
      setNewPwd("");
      loadAdmins();
    }
  };

  const handleChangeOtherPwd = async (id: string) => {
    const pwd = pwdEdits[id] || "";
    if (pwd.length < 8) {
      toast({ title: "كلمة مرور قصيرة", description: "8 أحرف على الأقل", variant: "destructive" });
      return;
    }
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("manage-admins", {
      body: { action: "change_password", target_user_id: id, password: pwd },
    });
    setBusyId(null);
    if (error || data?.error) {
      toast({ title: "فشل", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "تم", description: "تم تغيير كلمة المرور" });
      setPwdEdits((p) => ({ ...p, [id]: "" }));
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("manage-admins", {
      body: { action: "delete", target_user_id: id },
    });
    setBusyId(null);
    if (error || data?.error) {
      toast({ title: "فشل الحذف", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحذف", description: "تمت إزالة المسؤول" });
      loadAdmins();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">حساب المسؤول</h1>
        <p className="text-muted-foreground mt-1">إدارة كلمة المرور وحسابات المسؤولين المساعدين</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <KeyRound className="h-5 w-5 text-primary" />
            تغيير كلمة المرور الخاصة بك
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label>البريد الحالي</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>كلمة المرور الجديدة</Label>
            <Input type="password" value={myNewPwd} onChange={(e) => setMyNewPwd(e.target.value)} placeholder="8 أحرف على الأقل" />
          </div>
          <div className="space-y-2">
            <Label>تأكيد كلمة المرور</Label>
            <Input type="password" value={myConfirmPwd} onChange={(e) => setMyConfirmPwd(e.target.value)} />
          </div>
          <Button onClick={handleChangeMyPassword} disabled={savingMyPwd}>
            {savingMyPwd && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            حفظ كلمة المرور
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <UserPlus className="h-5 w-5 text-primary" />
            إضافة مسؤول جديد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <div className="space-y-2">
            <Label>كلمة المرور</Label>
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="8 أحرف على الأقل" />
          </div>
          <Button onClick={handleCreateAdmin} disabled={creating}>
            {creating && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            إنشاء حساب مسؤول
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <ShieldCheck className="h-5 w-5 text-primary" />
            المسؤولون الحاليون
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              {admins.map((a) => (
                <div key={a.user_id} className="flex flex-col md:flex-row md:items-center gap-3 p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{a.email || a.user_id}</div>
                    {a.is_self && <div className="text-xs text-primary mt-1">حسابك الحالي</div>}
                  </div>
                  {!a.is_self && (
                    <div className="flex gap-2 items-center flex-wrap">
                      <Input
                        type="password"
                        placeholder="كلمة مرور جديدة"
                        className="w-48"
                        value={pwdEdits[a.user_id] || ""}
                        onChange={(e) => setPwdEdits((p) => ({ ...p, [a.user_id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === a.user_id}
                        onClick={() => handleChangeOtherPwd(a.user_id)}
                      >
                        تغيير
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" disabled={busyId === a.user_id}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف المسؤول؟</AlertDialogTitle>
                            <AlertDialogDescription>
                              سيتم حذف الحساب نهائياً ولا يمكن التراجع.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(a.user_id)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
