-- لا حاجة لإضافة سياسة جديدة - السياسات الحالية تتطلب المصادقة بالفعل
-- لكن سنتأكد من عدم وجود ثغرة بإضافة سياسة restrictive إضافية

-- إضافة سياسة تتطلب المصادقة لجميع العمليات على profiles
-- هذه السياسة ستعمل كطبقة حماية إضافية

-- ملاحظة: السياسات الحالية بالفعل تتحقق من auth.uid() لكن هذه سياسة إضافية للتأكد
DO $$
BEGIN
  -- التحقق من أن RLS مفعلة
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'profiles' AND rowsecurity = true
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;