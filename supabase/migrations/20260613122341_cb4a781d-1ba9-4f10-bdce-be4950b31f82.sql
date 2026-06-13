
CREATE TABLE public.course_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_resources TO authenticated;
GRANT ALL ON public.course_resources TO service_role;

ALTER TABLE public.course_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage course resources"
ON public.course_resources FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Enrolled students view visible resources"
ON public.course_resources FOR SELECT
TO authenticated
USING (
  is_visible = true
  AND EXISTS (
    SELECT 1 FROM public.course_students cs
    WHERE cs.course_id = course_resources.course_id
      AND cs.student_id = auth.uid()
  )
);

CREATE INDEX idx_course_resources_course ON public.course_resources(course_id);

CREATE TRIGGER update_course_resources_updated_at
BEFORE UPDATE ON public.course_resources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
