# خطة بناء قسم "التدريب العملي" التفاعلي

## نظرة عامة
قسم جديد منفصل عن المحاضرات العادية، يعرض فيديوهات يوتيوب مع نقاط توقف تفاعلية. عند كل نقطة توقف يظهر سؤال، والإجابة الصحيحة تكمل الفيديو، والخاطئة تعيد المشهد من توقيت محدد. في النهاية يظهر تقرير أداء.

## التغييرات على قاعدة البيانات

ثلاث جداول جديدة:

1. **`practical_videos`** — الفيديوهات التدريبية
   - course_id (مرتبط بكورس)، title، youtube_url، description، order_index، is_locked

2. **`practical_checkpoints`** — نقاط التوقف والأسئلة
   - video_id، stop_time (بالثواني)، question_type (multiple_choice / true_false / order_steps / find_error)، question_text، options (JSONB)، correct_answer (JSONB)، correct_feedback، wrong_feedback، replay_from، continue_from، score، attempts_allowed، order_index

3. **`practical_attempts`** — محاولات الطلاب
   - student_id، video_id، checkpoint_id، attempts_count، is_correct، score_earned، completed_at
   - بالإضافة لجدول ملخص `practical_video_results` لتقرير الأداء النهائي

سياسات RLS:
- الادمن: تحكم كامل في الفيديوهات ونقاط التوقف
- الطالب: قراءة الفيديوهات الخاصة بكورساته فقط، وكتابة محاولاته الخاصة فقط
- الإجابات الصحيحة (correct_answer) لا تُعرض للطالب — يتم التحقق عبر دالة `submit_practical_answer` بصلاحيات SECURITY DEFINER

## الواجهات الجديدة

### لوحة الادمن
- **صفحة جديدة**: `/admin/practical` — قائمة الفيديوهات التدريبية
- **محرر السيناريو**: إنشاء/تعديل فيديو + إضافة نقاط توقف متعددة، تحديد نوع السؤال (4 أنواع)، الخيارات، الإجابات الصحيحة، التغذية الراجعة، توقيت إعادة المشهد، الدرجة، عدد المحاولات
- زر قفل/فتح كل فيديو
- رابط في الـ Sidebar: "التدريب العملي"

### واجهة الطالب
- **صفحة جديدة**: `/student/practical` — قائمة الفيديوهات المتاحة
- **مشغّل تفاعلي**: يستخدم YouTube IFrame API
  - يراقب التوقيت ويوقف الفيديو عند كل checkpoint
  - يعرض السؤال حسب نوعه (4 مكونات سؤال منفصلة)
  - عند الإجابة الصحيحة: feedback أخضر + استكمال من `continue_from`
  - عند الإجابة الخاطئة: feedback أحمر + إعادة من `replay_from` + خصم محاولة
  - بعد استنفاد المحاولات: السماح بالاستكمال مع تسجيل صفر
- **تقرير الأداء**: شاشة نهائية بعدد الإجابات الصحيحة/الخاطئة، الدرجة الكلية، الوقت

## التفاصيل التقنية

- مكتبة YouTube IFrame API (تحميل ديناميكي عبر script tag)
- مكون `PracticalVideoPlayer` يدير الـ player ويستمع لـ `onStateChange` و polling للوقت الحالي
- 4 مكونات أسئلة: `MultipleChoiceQuestion`، `TrueFalseQuestion`، `OrderStepsQuestion` (drag-drop عبر @dnd-kit الموجود)، `FindErrorQuestion`
- دالة قاعدة بيانات `submit_practical_answer(_checkpoint_id, _answer jsonb)` ترجع `{is_correct, correct_feedback/wrong_feedback, score_earned}` بدون كشف الإجابة الصحيحة
- دالة `get_practical_report(_video_id)` ترجع تقرير الأداء النهائي للطالب
- ملفات جديدة:
  - `src/pages/admin/AdminPractical.tsx`
  - `src/pages/admin/AdminPracticalEditor.tsx`
  - `src/pages/student/StudentPractical.tsx`
  - `src/pages/student/StudentPracticalPlayer.tsx`
  - `src/components/practical/PracticalVideoPlayer.tsx`
  - `src/components/practical/questions/*.tsx` (4 ملفات)
  - migration واحد لإنشاء الجداول والدوال
- تحديثات: `App.tsx` (routes)، `AdminSidebar.tsx`، `StudentSidebar.tsx` (روابط)

## خارج النطاق (لاحقاً إن أردت)
- ربط نتائج التدريب العملي بنظام الشهادات
- تصدير تقارير التدريب العملي إلى Excel
- إعادة استخدام نفس السيناريو على أكثر من فيديو
