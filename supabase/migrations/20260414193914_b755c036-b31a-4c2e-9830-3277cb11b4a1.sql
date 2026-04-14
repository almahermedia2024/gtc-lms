
DROP POLICY "Students can view assigned lectures" ON public.lectures;

CREATE POLICY "Students can view assigned lectures"
ON public.lectures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM student_lectures sl
    WHERE sl.lecture_id = lectures.id
    AND sl.student_id = auth.uid()
  )
);
