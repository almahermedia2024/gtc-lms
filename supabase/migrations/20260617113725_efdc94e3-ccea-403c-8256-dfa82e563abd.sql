
-- Question types enum
CREATE TYPE public.practical_question_type AS ENUM ('multiple_choice', 'true_false', 'order_steps', 'find_error');

-- Videos
CREATE TABLE public.practical_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  youtube_url text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  is_locked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practical_videos TO authenticated;
GRANT ALL ON public.practical_videos TO service_role;
ALTER TABLE public.practical_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage practical_videos" ON public.practical_videos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students view enrolled practical_videos" ON public.practical_videos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_students cs
      WHERE cs.course_id = practical_videos.course_id AND cs.student_id = auth.uid()
    )
  );

CREATE TRIGGER trg_practical_videos_updated
  BEFORE UPDATE ON public.practical_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checkpoints
CREATE TABLE public.practical_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.practical_videos(id) ON DELETE CASCADE,
  stop_time integer NOT NULL, -- seconds
  order_index integer NOT NULL DEFAULT 0,
  question_type public.practical_question_type NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,         -- array of {id, text}
  correct_answer jsonb NOT NULL,                       -- mc/find_error: [id]; true_false: bool; order_steps: [id,id,...]
  correct_feedback text,
  wrong_feedback text,
  replay_from integer NOT NULL DEFAULT 0,              -- seconds to seek on wrong
  continue_from integer,                               -- seconds to seek on correct (null = continue from stop_time)
  score integer NOT NULL DEFAULT 1,
  attempts_allowed integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practical_checkpoints TO authenticated;
GRANT ALL ON public.practical_checkpoints TO service_role;
ALTER TABLE public.practical_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage practical_checkpoints" ON public.practical_checkpoints
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_practical_checkpoints_updated
  BEFORE UPDATE ON public.practical_checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Safe view function for students that strips correct_answer
CREATE OR REPLACE FUNCTION public.get_practical_checkpoints_for_student(_video_id uuid)
RETURNS TABLE (
  id uuid, video_id uuid, stop_time integer, order_index integer,
  question_type public.practical_question_type, question_text text,
  options jsonb, score integer, attempts_allowed integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.video_id, c.stop_time, c.order_index, c.question_type,
         c.question_text, c.options, c.score, c.attempts_allowed
  FROM public.practical_checkpoints c
  JOIN public.practical_videos v ON v.id = c.video_id
  JOIN public.course_students cs ON cs.course_id = v.course_id
  WHERE c.video_id = _video_id
    AND cs.student_id = auth.uid()
    AND v.is_locked = false
  ORDER BY c.stop_time, c.order_index;
$$;

-- Attempts
CREATE TABLE public.practical_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.practical_videos(id) ON DELETE CASCADE,
  checkpoint_id uuid NOT NULL REFERENCES public.practical_checkpoints(id) ON DELETE CASCADE,
  attempts_count integer NOT NULL DEFAULT 1,
  is_correct boolean NOT NULL DEFAULT false,
  score_earned integer NOT NULL DEFAULT 0,
  last_answer jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, checkpoint_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practical_attempts TO authenticated;
GRANT ALL ON public.practical_attempts TO service_role;
ALTER TABLE public.practical_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own attempts" ON public.practical_attempts
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage attempts" ON public.practical_attempts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_practical_attempts_updated
  BEFORE UPDATE ON public.practical_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Submit answer function: validates without leaking correct answer
CREATE OR REPLACE FUNCTION public.submit_practical_answer(_checkpoint_id uuid, _answer jsonb)
RETURNS TABLE (
  is_correct boolean,
  feedback text,
  attempts_used integer,
  attempts_allowed integer,
  score_earned integer,
  replay_from integer,
  continue_from integer,
  exhausted boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _student uuid := auth.uid();
  _cp public.practical_checkpoints%ROWTYPE;
  _enrolled boolean;
  _correct boolean := false;
  _existing public.practical_attempts%ROWTYPE;
  _new_attempts integer;
  _earned integer := 0;
  _fb text;
  _exhausted boolean := false;
  _correct_arr text[];
  _ans_arr text[];
BEGIN
  IF _student IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO _cp FROM public.practical_checkpoints WHERE id = _checkpoint_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkpoint not found'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.practical_videos v
    JOIN public.course_students cs ON cs.course_id = v.course_id
    WHERE v.id = _cp.video_id AND cs.student_id = _student AND v.is_locked = false
  ) INTO _enrolled;
  IF NOT _enrolled THEN RAISE EXCEPTION 'Not enrolled or locked'; END IF;

  -- Validate correctness by type
  IF _cp.question_type = 'true_false' THEN
    _correct := (_cp.correct_answer::text = _answer::text);
  ELSIF _cp.question_type = 'order_steps' THEN
    _correct := (_cp.correct_answer::text = _answer::text);
  ELSE
    -- multiple_choice or find_error: arrays, compare as sets
    SELECT COALESCE(array_agg(v ORDER BY v), ARRAY[]::text[]) INTO _correct_arr
      FROM jsonb_array_elements_text(_cp.correct_answer) v;
    SELECT COALESCE(array_agg(v ORDER BY v), ARRAY[]::text[]) INTO _ans_arr
      FROM jsonb_array_elements_text(_answer) v;
    _correct := (_correct_arr = _ans_arr);
  END IF;

  SELECT * INTO _existing FROM public.practical_attempts
    WHERE student_id = _student AND checkpoint_id = _checkpoint_id;

  IF FOUND THEN
    _new_attempts := _existing.attempts_count + 1;
  ELSE
    _new_attempts := 1;
  END IF;

  IF _correct THEN
    _earned := _cp.score;
    _fb := COALESCE(_cp.correct_feedback, 'إجابة صحيحة');
  ELSE
    _earned := 0;
    _fb := COALESCE(_cp.wrong_feedback, 'إجابة خاطئة');
  END IF;

  _exhausted := (NOT _correct) AND (_new_attempts >= _cp.attempts_allowed);

  INSERT INTO public.practical_attempts (
    student_id, video_id, checkpoint_id, attempts_count,
    is_correct, score_earned, last_answer, completed_at
  ) VALUES (
    _student, _cp.video_id, _checkpoint_id, _new_attempts,
    _correct, _earned, _answer,
    CASE WHEN _correct OR _exhausted THEN now() ELSE NULL END
  )
  ON CONFLICT (student_id, checkpoint_id) DO UPDATE
  SET attempts_count = _new_attempts,
      is_correct = _correct OR public.practical_attempts.is_correct,
      score_earned = GREATEST(public.practical_attempts.score_earned, _earned),
      last_answer = _answer,
      completed_at = CASE WHEN _correct OR _exhausted THEN now() ELSE public.practical_attempts.completed_at END;

  RETURN QUERY SELECT
    _correct,
    _fb,
    _new_attempts,
    _cp.attempts_allowed,
    _earned,
    _cp.replay_from,
    COALESCE(_cp.continue_from, _cp.stop_time),
    _exhausted;
END;
$$;

-- Performance report
CREATE OR REPLACE FUNCTION public.get_practical_report(_video_id uuid)
RETURNS TABLE (
  total_checkpoints integer,
  answered_checkpoints integer,
  correct_count integer,
  wrong_count integer,
  total_score integer,
  max_score integer,
  total_attempts integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cps AS (
    SELECT id, score FROM public.practical_checkpoints WHERE video_id = _video_id
  ),
  att AS (
    SELECT a.* FROM public.practical_attempts a
    WHERE a.video_id = _video_id AND a.student_id = auth.uid()
  )
  SELECT
    (SELECT COUNT(*)::int FROM cps),
    (SELECT COUNT(*)::int FROM att WHERE completed_at IS NOT NULL),
    (SELECT COUNT(*)::int FROM att WHERE is_correct),
    (SELECT COUNT(*)::int FROM att WHERE completed_at IS NOT NULL AND NOT is_correct),
    (SELECT COALESCE(SUM(score_earned), 0)::int FROM att),
    (SELECT COALESCE(SUM(score), 0)::int FROM cps),
    (SELECT COALESCE(SUM(attempts_count), 0)::int FROM att);
$$;
