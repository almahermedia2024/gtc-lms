import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listCoursesTool from "./tools/list-courses";
import listLecturesTool from "./tools/list-lectures";
import watchProgressTool from "./tools/watch-progress";
import quizAttemptsTool from "./tools/quiz-attempts";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gtc-lms-mcp",
  title: "GTC LMS",
  version: "0.1.0",
  instructions:
    "Tools for the GTC learning platform. Use `whoami` to identify the signed-in user, `list_courses` and `list_lectures` to browse content, `get_watch_progress` for lecture viewing progress, and `list_quiz_attempts` for quiz results. All data access respects the signed-in user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listCoursesTool,
    listLecturesTool,
    watchProgressTool,
    quizAttemptsTool,
  ],
});
