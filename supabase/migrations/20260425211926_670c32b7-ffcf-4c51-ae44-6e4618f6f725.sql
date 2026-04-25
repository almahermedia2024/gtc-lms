-- Remove duplicate completed attempts, keeping the earliest one
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, course_id
           ORDER BY completed_at ASC, started_at ASC
         ) AS rn
  FROM public.quiz_attempts
  WHERE completed_at IS NOT NULL
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.quiz_answers
WHERE attempt_id IN (SELECT id FROM to_delete);

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, course_id
           ORDER BY completed_at ASC, started_at ASC
         ) AS rn
  FROM public.quiz_attempts
  WHERE completed_at IS NOT NULL
)
DELETE FROM public.quiz_attempts
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Now enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_one_per_student_course
  ON public.quiz_attempts (student_id, course_id)
  WHERE completed_at IS NOT NULL;