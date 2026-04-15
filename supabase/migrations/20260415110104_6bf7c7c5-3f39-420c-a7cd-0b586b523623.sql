-- Prevent any UPDATE on user_roles by non-admins (block privilege escalation)
CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Drop and recreate the watch_progress ALL policy to include WITH CHECK
DROP POLICY IF EXISTS "Students can manage own progress" ON public.watch_progress;

CREATE POLICY "Students can manage own progress"
ON public.watch_progress
FOR ALL
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);
