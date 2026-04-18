-- Indexes for watch_progress (most heavily written/read table during concurrent viewing)
CREATE INDEX IF NOT EXISTS idx_watch_progress_student_lecture ON public.watch_progress(student_id, lecture_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_lecture ON public.watch_progress(lecture_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_student ON public.watch_progress(student_id);

-- Indexes for student_lectures (used in RLS check on every lecture fetch)
CREATE INDEX IF NOT EXISTS idx_student_lectures_student ON public.student_lectures(student_id);
CREATE INDEX IF NOT EXISTS idx_student_lectures_lecture ON public.student_lectures(lecture_id);
CREATE INDEX IF NOT EXISTS idx_student_lectures_student_lecture ON public.student_lectures(student_id, lecture_id);

-- Indexes for course_students
CREATE INDEX IF NOT EXISTS idx_course_students_student ON public.course_students(student_id);
CREATE INDEX IF NOT EXISTS idx_course_students_course ON public.course_students(course_id);

-- Indexes for user_roles (called on EVERY RLS check via has_role function)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Index for lectures by course
CREATE INDEX IF NOT EXISTS idx_lectures_course ON public.lectures(course_id);

-- Add unique constraint on watch_progress to prevent duplicates and speed up upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_progress_unique ON public.watch_progress(student_id, lecture_id);