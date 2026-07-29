
-- 1. Revoke anon/public access to practical SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_practical_checkpoints_for_student(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_practical_answer(uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_practical_report(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_practical_checkpoints_for_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_practical_answer(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_practical_report(uuid) TO authenticated;

-- 2. Rewrite get_practical_report with enrollment check
CREATE OR REPLACE FUNCTION public.get_practical_report(_video_id uuid)
 RETURNS TABLE(total_checkpoints integer, answered_checkpoints integer, correct_count integer, wrong_count integer, total_score integer, max_score integer, total_attempts integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _student uuid := auth.uid();
  _enrolled boolean;
BEGIN
  IF _student IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.practical_videos v
    JOIN public.course_students cs ON cs.course_id = v.course_id
    WHERE v.id = _video_id AND cs.student_id = _student
  ) INTO _enrolled;

  IF NOT _enrolled AND NOT public.has_role(_student, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not enrolled';
  END IF;

  RETURN QUERY
  WITH cps AS (
    SELECT id, score FROM public.practical_checkpoints WHERE video_id = _video_id
  ),
  att AS (
    SELECT a.* FROM public.practical_attempts a
    WHERE a.video_id = _video_id AND a.student_id = _student
  )
  SELECT
    (SELECT COUNT(*)::int FROM cps),
    (SELECT COUNT(*)::int FROM att WHERE completed_at IS NOT NULL),
    (SELECT COUNT(*)::int FROM att WHERE is_correct),
    (SELECT COUNT(*)::int FROM att WHERE completed_at IS NOT NULL AND NOT is_correct),
    (SELECT COALESCE(SUM(score_earned), 0)::int FROM att),
    (SELECT COALESCE(SUM(score), 0)::int FROM cps),
    (SELECT COALESCE(SUM(attempts_count), 0)::int FROM att);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_practical_report(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_practical_report(uuid) TO authenticated;

-- 3. Tighten watch_progress RLS: prevent fabricating completion
DROP POLICY IF EXISTS "Students can manage own progress" ON public.watch_progress;

CREATE POLICY "Students select own progress"
ON public.watch_progress FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students insert own progress bounded"
ON public.watch_progress FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND watched_seconds >= 0
  AND (
    total_duration IS NULL
    OR total_duration = 0
    OR watched_seconds <= total_duration + 5
  )
  AND EXISTS (
    SELECT 1 FROM public.student_lectures sl
    WHERE sl.student_id = auth.uid() AND sl.lecture_id = watch_progress.lecture_id
  )
);

CREATE POLICY "Students update own progress bounded"
ON public.watch_progress FOR UPDATE
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (
  auth.uid() = student_id
  AND watched_seconds >= 0
  AND (
    total_duration IS NULL
    OR total_duration = 0
    OR watched_seconds <= total_duration + 5
  )
);

-- Admins keep full manage rights
CREATE POLICY "Admins manage watch_progress"
ON public.watch_progress FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
