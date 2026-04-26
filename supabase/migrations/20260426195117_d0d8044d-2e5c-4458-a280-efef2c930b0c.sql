-- 1. Add question_type enum and column
DO $$ BEGIN
  CREATE TYPE public.question_type AS ENUM ('single', 'multiple', 'true_false');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS question_type public.question_type NOT NULL DEFAULT 'single';

-- 2. Recreate submit_quiz_attempt to support arrays of selected options
--    Answer payload format per item:
--      { "question_id": "uuid", "selected_option_ids": ["uuid", ...] }
--    Backwards compatible: also reads "selected_option_id" (string) as a single-element array.
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(_course_id uuid, _answers jsonb)
 RETURNS TABLE(attempt_id uuid, total_questions integer, correct_answers integer, percentage real)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  _selected_ids uuid[];
  _selected_id uuid;
  _is_correct boolean;
  _correct_set uuid[];
  _wrong_picked integer;
  _already_attempted boolean;
BEGIN
  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Prevent duplicate attempts
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_attempts
    WHERE student_id = _student_id
      AND course_id = _course_id
      AND completed_at IS NOT NULL
  ) INTO _already_attempted;
  IF _already_attempted THEN
    RAISE EXCEPTION 'Quiz already attempted';
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

  SELECT COUNT(*) INTO _total
  FROM public.quiz_questions
  WHERE course_id = _course_id;

  IF _total = 0 THEN
    RAISE EXCEPTION 'No questions for this course';
  END IF;

  INSERT INTO public.quiz_attempts (
    student_id, course_id, total_questions, correct_answers, score, percentage, completed_at
  ) VALUES (
    _student_id, _course_id, _total, 0, 0, 0, now()
  ) RETURNING id INTO _attempt_id;

  FOR _answer IN SELECT * FROM jsonb_array_elements(_answers)
  LOOP
    _q_id := (_answer->>'question_id')::uuid;
    _is_correct := false;
    _selected_ids := ARRAY[]::uuid[];

    -- Verify question belongs to this course
    IF NOT EXISTS (
      SELECT 1 FROM public.quiz_questions
      WHERE id = _q_id AND course_id = _course_id
    ) THEN
      CONTINUE;
    END IF;

    -- Parse selected_option_ids (array) OR fallback to selected_option_id (single)
    IF jsonb_typeof(_answer->'selected_option_ids') = 'array' THEN
      SELECT COALESCE(array_agg((v)::uuid), ARRAY[]::uuid[])
        INTO _selected_ids
      FROM jsonb_array_elements_text(_answer->'selected_option_ids') AS v
      WHERE v IS NOT NULL AND v <> '';
    ELSIF (_answer->>'selected_option_id') IS NOT NULL AND (_answer->>'selected_option_id') <> '' THEN
      _selected_ids := ARRAY[(_answer->>'selected_option_id')::uuid];
    END IF;

    -- Restrict selected ids to those that actually belong to this question
    SELECT COALESCE(array_agg(o.id), ARRAY[]::uuid[])
      INTO _selected_ids
    FROM public.quiz_options o
    WHERE o.question_id = _q_id
      AND o.id = ANY(_selected_ids);

    -- All correct option ids for this question
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO _correct_set
    FROM public.quiz_options
    WHERE question_id = _q_id AND is_correct = true;

    -- Count selected wrong options
    SELECT COUNT(*) INTO _wrong_picked
    FROM unnest(_selected_ids) AS sid
    WHERE sid <> ALL(_correct_set);

    -- Question is correct iff: every correct option is selected AND no wrong option selected
    IF array_length(_correct_set, 1) IS NOT NULL
       AND _correct_set <@ _selected_ids
       AND _wrong_picked = 0
       AND array_length(_selected_ids, 1) IS NOT NULL THEN
      _is_correct := true;
    END IF;

    IF _is_correct THEN
      _correct := _correct + 1;
    END IF;

    -- Persist answers: one row per selected option (or one NULL row if none selected)
    IF array_length(_selected_ids, 1) IS NULL THEN
      INSERT INTO public.quiz_answers (attempt_id, question_id, selected_option_id, is_correct)
      VALUES (_attempt_id, _q_id, NULL, _is_correct);
    ELSE
      FOREACH _selected_id IN ARRAY _selected_ids LOOP
        INSERT INTO public.quiz_answers (attempt_id, question_id, selected_option_id, is_correct)
        VALUES (_attempt_id, _q_id, _selected_id, _is_correct);
      END LOOP;
    END IF;
  END LOOP;

  _pct := CASE WHEN _total > 0 THEN (_correct::real / _total::real) * 100 ELSE 0 END;

  UPDATE public.quiz_attempts
  SET correct_answers = _correct,
      score = _correct,
      percentage = _pct
  WHERE id = _attempt_id;

  RETURN QUERY SELECT _attempt_id, _total, _correct, _pct;
END;
$function$;

-- 3. Update get_quiz_review to return aggregated arrays of selected & correct option ids/texts
DROP FUNCTION IF EXISTS public.get_quiz_review(uuid);
CREATE OR REPLACE FUNCTION public.get_quiz_review(_attempt_id uuid)
 RETURNS TABLE(
   question_id uuid,
   question_text text,
   question_type public.question_type,
   selected_option_ids uuid[],
   selected_option_texts text[],
   correct_option_ids uuid[],
   correct_option_texts text[],
   is_correct boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH att AS (
    SELECT id, student_id
    FROM public.quiz_attempts
    WHERE id = _attempt_id
      AND student_id = auth.uid()
      AND completed_at IS NOT NULL
  ),
  selected AS (
    SELECT
      q.id AS question_id,
      q.question_text,
      q.question_type,
      COALESCE(array_agg(qa.selected_option_id) FILTER (WHERE qa.selected_option_id IS NOT NULL), ARRAY[]::uuid[]) AS selected_option_ids,
      COALESCE(array_agg(o_sel.option_text ORDER BY o_sel.option_order)
        FILTER (WHERE qa.selected_option_id IS NOT NULL), ARRAY[]::text[]) AS selected_option_texts,
      bool_and(qa.is_correct) AS is_correct
    FROM att
    JOIN public.quiz_answers qa ON qa.attempt_id = att.id
    JOIN public.quiz_questions q ON q.id = qa.question_id
    LEFT JOIN public.quiz_options o_sel ON o_sel.id = qa.selected_option_id
    GROUP BY q.id, q.question_text, q.question_type
  ),
  correct AS (
    SELECT
      o.question_id,
      array_agg(o.id ORDER BY o.option_order) AS correct_option_ids,
      array_agg(o.option_text ORDER BY o.option_order) AS correct_option_texts
    FROM public.quiz_options o
    WHERE o.is_correct = true
      AND o.question_id IN (SELECT question_id FROM selected)
    GROUP BY o.question_id
  )
  SELECT
    s.question_id,
    s.question_text,
    s.question_type,
    s.selected_option_ids,
    s.selected_option_texts,
    COALESCE(c.correct_option_ids, ARRAY[]::uuid[]),
    COALESCE(c.correct_option_texts, ARRAY[]::text[]),
    COALESCE(s.is_correct, false)
  FROM selected s
  LEFT JOIN correct c ON c.question_id = s.question_id;
$function$;
