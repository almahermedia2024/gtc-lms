CREATE OR REPLACE FUNCTION public.get_quiz_question_stats(_course_id uuid)
RETURNS TABLE(
  question_id uuid,
  question_text text,
  question_order integer,
  question_type question_type,
  total_attempts integer,
  correct_count integer,
  wrong_count integer,
  correct_percentage real,
  wrong_percentage real
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH per_attempt AS (
    -- One row per (attempt, question) with overall correctness for that question in that attempt
    SELECT
      qa.attempt_id,
      qa.question_id,
      bool_and(qa.is_correct) AS is_correct
    FROM public.quiz_answers qa
    JOIN public.quiz_attempts att ON att.id = qa.attempt_id
    JOIN public.quiz_questions q ON q.id = qa.question_id
    WHERE q.course_id = _course_id
      AND att.completed_at IS NOT NULL
    GROUP BY qa.attempt_id, qa.question_id
  ),
  agg AS (
    SELECT
      question_id,
      COUNT(*)::int AS total_attempts,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct_count
    FROM per_attempt
    GROUP BY question_id
  )
  SELECT
    q.id AS question_id,
    q.question_text,
    q.question_order,
    q.question_type,
    COALESCE(a.total_attempts, 0) AS total_attempts,
    COALESCE(a.correct_count, 0) AS correct_count,
    COALESCE(a.total_attempts, 0) - COALESCE(a.correct_count, 0) AS wrong_count,
    CASE WHEN COALESCE(a.total_attempts, 0) > 0
         THEN (a.correct_count::real / a.total_attempts::real) * 100
         ELSE 0 END AS correct_percentage,
    CASE WHEN COALESCE(a.total_attempts, 0) > 0
         THEN ((a.total_attempts - a.correct_count)::real / a.total_attempts::real) * 100
         ELSE 0 END AS wrong_percentage
  FROM public.quiz_questions q
  LEFT JOIN agg a ON a.question_id = q.id
  WHERE q.course_id = _course_id
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY wrong_percentage DESC, total_attempts DESC, q.question_order ASC;
$$;