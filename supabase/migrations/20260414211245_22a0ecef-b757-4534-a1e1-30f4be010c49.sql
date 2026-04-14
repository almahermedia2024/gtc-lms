
-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage courses"
ON public.courses FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create course_students table BEFORE referencing it in policy
CREATE TABLE public.course_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);

ALTER TABLE public.course_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage course students"
ON public.course_students FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view own enrollments"
ON public.course_students FOR SELECT
USING (auth.uid() = student_id);

-- Now safe to reference course_students
CREATE POLICY "Students can view enrolled courses"
ON public.courses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.course_students cs
  WHERE cs.course_id = courses.id AND cs.student_id = auth.uid()
));

-- Add course_id to lectures
ALTER TABLE public.lectures ADD COLUMN course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

-- Trigger for courses updated_at
CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
