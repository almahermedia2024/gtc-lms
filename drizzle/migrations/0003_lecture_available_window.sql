ALTER TABLE public.lectures ADD COLUMN IF NOT EXISTS available_until timestamptz;
DROP POLICY IF EXISTS "Students can view assigned lectures" ON public.lectures;
CREATE POLICY "Students can view assigned lectures" ON public.lectures FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.student_lectures sl WHERE sl.lecture_id = lectures.id AND sl.student_id = auth.uid())
  AND (available_from IS NULL OR available_from <= now())
  AND (available_until IS NULL OR available_until > now())
);