
-- Revoke EXECUTE from anon on SECURITY DEFINER functions (they require auth.uid())
REVOKE EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_quiz_review(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_quiz_question_stats(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_quiz_options_for_student(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_question_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_options_for_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Defense-in-depth: explicit restrictive policy blocking non-admins from modifying user_roles
CREATE POLICY "Block non-admin role inserts (restrictive)"
ON public.user_roles AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block non-admin role updates (restrictive)"
ON public.user_roles AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block non-admin role deletes (restrictive)"
ON public.user_roles AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Defense-in-depth: explicitly prevent students from reading quiz_options directly.
-- Students must use get_quiz_options_for_student() which hides is_correct.
CREATE POLICY "Block non-admin direct reads of quiz_options (restrictive)"
ON public.quiz_options AS RESTRICTIVE
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
