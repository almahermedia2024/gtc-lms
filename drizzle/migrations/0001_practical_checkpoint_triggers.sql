ALTER TABLE public.practical_checkpoints ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'video';
ALTER TABLE public.practical_checkpoints ADD CONSTRAINT practical_checkpoints_trigger_chk CHECK (trigger_type IN ('video','timer'));
COMMENT ON COLUMN public.practical_videos.content_type IS 'DEPRECATED: items may combine video, case text and image';

CREATE OR REPLACE FUNCTION public.get_practical_checkpoints_for_student_v2(_video_id uuid)
RETURNS TABLE(id uuid, video_id uuid, stop_time integer, order_index integer, question_type practical_question_type, question_text text, options jsonb, score integer, attempts_allowed integer, trigger_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.id, c.video_id, c.stop_time, c.order_index, c.question_type,
         c.question_text, c.options, c.score, c.attempts_allowed, c.trigger_type
  FROM public.practical_checkpoints c
  JOIN public.practical_videos v ON v.id = c.video_id
  JOIN public.course_students cs ON cs.course_id = v.course_id
  WHERE c.video_id = _video_id AND cs.student_id = auth.uid() AND v.is_locked = false
  ORDER BY c.stop_time, c.order_index;
$$;
REVOKE EXECUTE ON FUNCTION public.get_practical_checkpoints_for_student_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_practical_checkpoints_for_student_v2(uuid) TO authenticated;