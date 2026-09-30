import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED = ["reports", "students", "courses"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await userClient.from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    const body = await req.json();
    const cats: string[] = Array.isArray(body?.categories) ? body.categories : [];
    if (!cats.length || !cats.every((c) => (ALLOWED as readonly string[]).includes(c))) {
      return json({ error: "اختر نوع البيانات المراد مسحها" }, 400);
    }
    if (body?.confirm !== "حذف") return json({ error: "تأكيد الحذف غير صحيح" }, 400);

    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const wipe = async (table: string) => {
      const { error } = await db.from(table).delete().not("id", "is", null);
      if (error) throw new Error(`${table}: ${error.message}`);
    };

    const doReports = cats.includes("reports") || cats.includes("students") || cats.includes("courses");
    if (doReports) {
      for (const t of ["quiz_answers", "quiz_attempts", "practical_attempts", "watch_progress"]) await wipe(t);
    }

    if (cats.includes("courses")) {
      for (const t of [
        "lecture_quiz_options", "lecture_quiz_questions", "quiz_options", "quiz_questions",
        "practical_checkpoints", "practical_videos", "course_resources",
        "student_lectures", "course_students", "lectures", "courses",
      ]) await wipe(t);
    }

    let deletedStudents = 0;
    if (cats.includes("students")) {
      const { data: roles } = await db.from("user_roles").select("user_id, role");
      const admins = new Set((roles || []).filter((r) => r.role === "admin").map((r) => r.user_id));
      const students = [...new Set((roles || []).filter((r) => r.role === "student").map((r) => r.user_id))]
        .filter((id) => !admins.has(id));
      for (const id of students) {
        await db.from("student_lectures").delete().eq("student_id", id);
        await db.from("course_students").delete().eq("student_id", id);
        await db.from("user_roles").delete().eq("user_id", id);
        await db.from("profiles").delete().eq("user_id", id);
        const { error } = await db.auth.admin.deleteUser(id);
        if (!error) deletedStudents++;
        else console.error("delete user", id, error);
      }
    }

    return json({ success: true, deletedStudents });
  } catch (err) {
    console.error("wipe-data error:", err);
    return json({ error: "حدث خطأ أثناء المسح" }, 500);
  }
});
