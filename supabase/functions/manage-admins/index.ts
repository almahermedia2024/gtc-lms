import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "list") {
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const ids = (roles ?? []).map((r) => r.user_id);
      const admins: { user_id: string; email: string | undefined; is_self: boolean }[] = [];
      for (const id of ids) {
        const { data: u } = await adminClient.auth.admin.getUserById(id);
        admins.push({ user_id: id, email: u.user?.email, is_self: id === user.id });
      }
      return new Response(JSON.stringify({ admins }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { email, password } = body;
      if (!email || !password || password.length < 8) {
        return new Response(JSON.stringify({ error: "البريد وكلمة مرور (8 أحرف+) مطلوبة" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !newUser.user) {
        return new Response(JSON.stringify({ error: createError?.message || "فشل الإنشاء" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role: "admin" });
      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change_password") {
      const { target_user_id, password } = body;
      if (!target_user_id || !password || password.length < 8) {
        return new Response(JSON.stringify({ error: "معرف المستخدم وكلمة مرور (8 أحرف+) مطلوبة" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: tRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", target_user_id)
        .eq("role", "admin")
        .maybeSingle();
      if (!tRole) {
        return new Response(JSON.stringify({ error: "المستخدم ليس مسؤولاً" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: updErr } = await adminClient.auth.admin.updateUserById(target_user_id, { password });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { target_user_id } = body;
      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "معرف المستخدم مطلوب" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (target_user_id === user.id) {
        return new Response(JSON.stringify({ error: "لا يمكنك حذف حسابك" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { count } = await adminClient
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return new Response(JSON.stringify({ error: "يجب أن يبقى مسؤول واحد على الأقل" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await adminClient.from("user_roles").delete().eq("user_id", target_user_id).eq("role", "admin");
      await adminClient.auth.admin.deleteUser(target_user_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "إجراء غير معروف" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-admins error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
