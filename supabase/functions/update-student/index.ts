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

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
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

    const { user_id, full_name, email, password, phone, is_active } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Update is_active if provided; revoke session when deactivating
    if (typeof is_active === "boolean") {
      const { error: actErr } = await adminClient
        .from("profiles")
        .update({ is_active })
        .eq("user_id", user_id);
      if (actErr) {
        console.error("Update is_active error:", actErr);
        return new Response(JSON.stringify({ error: "Failed to update status" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (is_active === false) {
        // Revoke any active sessions so the disabled user is logged out everywhere
        try {
          await adminClient.auth.admin.signOut(user_id, "global");
        } catch (e) {
          console.error("signOut error:", e);
        }
      }
    }

    // Update auth user (email/password) if provided
    const authUpdates: Record<string, string> = {};
    if (email) authUpdates.email = email;
    if (password) authUpdates.password = password;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, authUpdates);
      if (authError) {
        console.error("Update auth error:", authError);
        return new Response(JSON.stringify({ error: "Failed to update credentials" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update profile (name/phone) if provided
    const profileUpdates: Record<string, string> = {};
    if (full_name !== undefined) profileUpdates.full_name = full_name;
    if (phone !== undefined) profileUpdates.phone = phone;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", user_id);
      if (profileError) {
        console.error("Update profile error:", profileError);
        return new Response(JSON.stringify({ error: "Failed to update profile" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Update student error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
