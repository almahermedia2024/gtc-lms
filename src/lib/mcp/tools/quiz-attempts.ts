import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "./whoami";

export default defineTool({
  name: "list_quiz_attempts",
  title: "List quiz attempts",
  description:
    "List course quiz attempts visible to the signed-in user, optionally filtered by course id.",
  inputSchema: {
    course_id: z.string().optional().describe("Optional course id filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ course_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    let query = supabaseForUser(ctx)
      .from("quiz_attempts")
      .select("id, student_id, course_id, score, total_questions, completed_at, started_at")
      .order("started_at", { ascending: false })
      .limit(200);
    if (course_id) query = query.eq("course_id", course_id);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { attempts: data ?? [] },
    };
  },
});
