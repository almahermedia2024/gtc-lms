import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "./whoami";

export default defineTool({
  name: "get_watch_progress",
  title: "Get watch progress",
  description:
    "Get lecture watch progress rows visible to the signed-in user (own progress for students, all accessible rows for admins).",
  inputSchema: {
    lecture_id: z.string().optional().describe("Optional lecture id filter."),
    student_id: z
      .string()
      .optional()
      .describe("Optional student id filter (admins only; students see their own rows)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lecture_id, student_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let query = supabaseForUser(ctx)
      .from("watch_progress")
      .select(
        "id, student_id, lecture_id, watched_seconds, total_duration, completion_percentage, open_count, last_watched_at",
      )
      .order("last_watched_at", { ascending: false })
      .limit(200);
    if (lecture_id) query = query.eq("lecture_id", lecture_id);
    if (student_id) query = query.eq("student_id", student_id);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { progress: data ?? [] },
    };
  },
});
