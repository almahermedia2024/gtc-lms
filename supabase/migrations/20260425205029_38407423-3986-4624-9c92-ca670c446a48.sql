
-- 1. Restrict students from seeing quiz answer correctness
-- Drop the existing policy that exposes is_correct to students
DROP POLICY IF EXISTS "Enrolled students can view quiz options" ON public.quiz_options;

-- Create a security definer function that returns options WITHOUT is_correct for students
CREATE OR REPLACE FUNCTION public.get_quiz_options_for_student(_course_id uuid)
RETURNS TABLE (
  id uuid,
  question_id uuid,
  option_text text,
  option_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.question_id, o.option_text, o.option_order
  FROM public.quiz_options o
  JOIN public.quiz_questions q ON q.id = o.question_id
  JOIN public.course_students cs ON cs.course_id = q.course_id
  WHERE q.course_id = _course_id
    AND cs.student_id = auth.uid()
  ORDER BY o.question_id, o.option_order;
$$;

-- 2. Server-side quiz submission via security definer function
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  _course_id uuid,
  _answers jsonb  -- array of { question_id, selected_option_id }
)
RETURNS TABLE (
  attempt_id uuid,
  total_questions integer,
  correct_answers integer,
  percentage real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid := auth.uid();
  _enrolled boolean;
  _all_completed boolean;
  _total integer;
  _correct integer := 0;
  _attempt_id uuid;
  _pct real;
  _answer jsonb;
  _q_id uuid;
  _opt_id uuid;
  _is_correct boolean;
BEGIN
  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify enrollment
  SELECT EXISTS (
    SELECT 1 FROM public.course_students
    WHERE course_id = _course_id AND student_id = _student_id
  ) INTO _enrolled;

  IF NOT _enrolled THEN
    RAISE EXCEPTION 'Not enrolled in course';
  END IF;

  -- Verify all lectures watched (>= 90%)
  SELECT NOT EXISTS (
    SELECT 1 FROM public.lectures l
    LEFT JOIN public.watch_progress wp
      ON wp.lecture_id = l.id AND wp.student_id = _student_id
    WHERE l.course_id = _course_id
      AND COALESCE(wp.completion_percentage, 0) < 90
  ) INTO _all_completed;

  IF NOT _all_completed THEN
    RAISE EXCEPTION 'Must complete all lectures first';
  END IF;

  -- Count total questions
  SELECT COUNT(*) INTO _total
  FROM public.quiz_questions
  WHERE course_id = _course_id;

  IF _total = 0 THEN
    RAISE EXCEPTION 'No questions for this course';
  END IF;

  -- Create attempt
  INSERT INTO public.quiz_attempts (
    student_id, course_id, total_questions, correct_answers, score, percentage, completed_at
  ) VALUES (
    _student_id, _course_id, _total, 0, 0, 0, now()
  ) RETURNING id INTO _attempt_id;

  -- Process each answer; only count answers for questions in this course
  FOR _answer IN SELECT * FROM jsonb_array_elements(_answers)
  LOOP
    _q_id := (_answer->>'question_id')::uuid;
    _opt_id := NULLIF(_answer->>'selected_option_id', '')::uuid;
    _is_correct := false;

    -- Verify question belongs to this course
    IF NOT EXISTS (
      SELECT 1 FROM public.quiz_questions
      WHERE id = _q_id AND course_id = _course_id
    ) THEN
      CONTINUE;
    END IF;

    -- Check correctness server-side
    IF _opt_id IS NOT NULL THEN
      SELECT is_correct INTO _is_correct
      FROM public.quiz_options
      WHERE id = _opt_id AND question_id = _q_id;
      _is_correct := COALESCE(_is_correct, false);
    END IF;

    IF _is_correct THEN
      _correct := _correct + 1;
    END IF;

    INSERT INTO public.quiz_answers (attempt_id, question_id, selected_option_id, is_correct)
    VALUES (_attempt_id, _q_id, _opt_id, _is_correct);
  END LOOP;

  _pct := CASE WHEN _total > 0 THEN (_correct::real / _total::real) * 100 ELSE 0 END;

  -- Update attempt with final score
  UPDATE public.quiz_attempts
  SET correct_answers = _correct,
      score = _correct,
      percentage = _pct
  WHERE id = _attempt_id;

  RETURN QUERY SELECT _attempt_id, _total, _correct, _pct;
END;
$$;

-- 3. Function to get review (correct answers) only AFTER attempt completed
CREATE OR REPLACE FUNCTION public.get_quiz_review(_attempt_id uuid)
RETURNS TABLE (
  question_id uuid,
  question_text text,
  selected_option_id uuid,
  is_correct boolean,
  correct_option_id uuid,
  correct_option_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id AS question_id,
    q.question_text,
    qa.selected_option_id,
    qa.is_correct,
    co.id AS correct_option_id,
    co.option_text AS correct_option_text
  FROM public.quiz_attempts att
  JOIN public.quiz_answers qa ON qa.attempt_id = att.id
  JOIN public.quiz_questions q ON q.id = qa.question_id
  LEFT JOIN public.quiz_options co ON co.question_id = q.id AND co.is_correct = true
  WHERE att.id = _attempt_id
    AND att.student_id = auth.uid()
    AND att.completed_at IS NOT NULL;
$$;

-- 4. Remove student INSERT/UPDATE on quiz_attempts (only via the SECURITY DEFINER fn)
DROP POLICY IF EXISTS "Students can create own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Students can update own attempts" ON public.quiz_attempts;

-- 5. Remove student INSERT on quiz_answers (only via SECURITY DEFINER fn)
DROP POLICY IF EXISTS "Students can create own answers" ON public.quiz_answers;

-- 6. Tighten profiles UPDATE policy: students cannot change is_active
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.user_id = auth.uid())
);
