import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated } from "./whoami";

export default defineTool({
  name: "list_courses",
  title: "List courses",
  description:
    "List the courses visible to the signed-in user (all courses for admins, enrolled courses for students).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("courses")
      .select("id, title, description, quiz_duration_minutes, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { courses: data ?? [] },
    };
  },
});
