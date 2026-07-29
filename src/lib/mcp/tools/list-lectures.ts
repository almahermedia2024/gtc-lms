import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "./whoami";

export default defineTool({
  name: "list_lectures",
  title: "List lectures",
  description:
    "List lectures the signed-in user can access, optionally filtered by course id.",
  inputSchema: {
    course_id: z
      .string()
      .optional()
      .describe("Optional course id to filter lectures by."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ course_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let query = supabaseForUser(ctx)
      .from("lectures")
      .select("id, title, description, course_id, duration_minutes, is_locked, created_at")
      .order("created_at", { ascending: true });
    if (course_id) query = query.eq("course_id", course_id);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { lectures: data ?? [] },
    };
  },
});
