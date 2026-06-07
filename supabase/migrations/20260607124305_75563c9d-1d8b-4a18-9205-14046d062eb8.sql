
CREATE TABLE public.lecture_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id uuid NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lecture_quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.lecture_quiz_questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  option_order integer NOT NULL DEFAULT 0,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_quiz_questions TO authenticated;
GRANT ALL ON public.lecture_quiz_questions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_quiz_options TO authenticated;
GRANT ALL ON public.lecture_quiz_options TO service_role;

ALTER TABLE public.lecture_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_quiz_options ENABLE ROW LEVEL SECURITY;

-- Questions policies
CREATE POLICY "Admins manage lecture quiz questions"
ON public.lecture_quiz_questions FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Assigned students view lecture quiz questions"
ON public.lecture_quiz_questions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.student_lectures sl
  WHERE sl.lecture_id = lecture_quiz_questions.lecture_id
    AND sl.student_id = auth.uid()
));

-- Options policies
CREATE POLICY "Admins manage lecture quiz options"
ON public.lecture_quiz_options FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Assigned students view lecture quiz options"
ON public.lecture_quiz_options FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.lecture_quiz_questions q
  JOIN public.student_lectures sl ON sl.lecture_id = q.lecture_id
  WHERE q.id = lecture_quiz_options.question_id
    AND sl.student_id = auth.uid()
));

CREATE TRIGGER update_lecture_quiz_questions_updated_at
BEFORE UPDATE ON public.lecture_quiz_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
