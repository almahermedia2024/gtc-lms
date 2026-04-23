-- Quiz Questions table
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Quiz Options table (MCQ choices)
CREATE TABLE public.quiz_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  option_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Quiz Attempts table
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  percentage REAL NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Quiz Answers (student's individual answers)
CREATE TABLE public.quiz_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.quiz_options(id) ON DELETE SET NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_quiz_questions_course ON public.quiz_questions(course_id);
CREATE INDEX idx_quiz_options_question ON public.quiz_options(question_id);
CREATE INDEX idx_quiz_attempts_student ON public.quiz_attempts(student_id);
CREATE INDEX idx_quiz_attempts_course ON public.quiz_attempts(course_id);
CREATE INDEX idx_quiz_answers_attempt ON public.quiz_answers(attempt_id);

-- Enable RLS
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quiz_questions
CREATE POLICY "Admins can manage quiz questions"
  ON public.quiz_questions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Enrolled students can view quiz questions"
  ON public.quiz_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.course_students cs
    WHERE cs.course_id = quiz_questions.course_id
    AND cs.student_id = auth.uid()
  ));

-- RLS Policies for quiz_options
CREATE POLICY "Admins can manage quiz options"
  ON public.quiz_options FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Enrolled students can view quiz options"
  ON public.quiz_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.quiz_questions q
    JOIN public.course_students cs ON cs.course_id = q.course_id
    WHERE q.id = quiz_options.question_id
    AND cs.student_id = auth.uid()
  ));

-- RLS Policies for quiz_attempts
CREATE POLICY "Admins can view all attempts"
  ON public.quiz_attempts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view own attempts"
  ON public.quiz_attempts FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can create own attempts"
  ON public.quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own attempts"
  ON public.quiz_attempts FOR UPDATE
  USING (auth.uid() = student_id);

-- RLS Policies for quiz_answers
CREATE POLICY "Admins can view all answers"
  ON public.quiz_answers FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view own answers"
  ON public.quiz_answers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.quiz_attempts qa
    WHERE qa.id = quiz_answers.attempt_id
    AND qa.student_id = auth.uid()
  ));

CREATE POLICY "Students can create own answers"
  ON public.quiz_answers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quiz_attempts qa
    WHERE qa.id = quiz_answers.attempt_id
    AND qa.student_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_quiz_questions_updated_at
  BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();