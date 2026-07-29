import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";

export function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function unauthenticated() {
  return {
    content: [{ type: "text" as const, text: "Not authenticated." }],
    isError: true,
  };
}

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description:
    "Return the signed-in user's id, email and platform role (admin or student).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId!)
      .maybeSingle();
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, is_active")
      .eq("user_id", userId!)
      .maybeSingle();

    const result = {
      user_id: userId,
      email: ctx.getUserEmail(),
      role: roleRow?.role ?? "student",
      full_name: profile?.full_name ?? null,
      is_active: profile?.is_active ?? true,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
