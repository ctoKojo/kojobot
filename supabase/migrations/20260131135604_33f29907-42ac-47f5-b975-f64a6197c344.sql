-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Create storage bucket for assignment files
INSERT INTO storage.buckets (id, name, public) VALUES ('assignments', 'assignments', false);

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete their avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Storage policies for assignments
CREATE POLICY "Users can view assignment files" ON storage.objects FOR SELECT USING (bucket_id = 'assignments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can upload assignment files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assignments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update assignment files" ON storage.objects FOR UPDATE USING (bucket_id = 'assignments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete assignment files" ON storage.objects FOR DELETE USING (bucket_id = 'assignments' AND auth.role() = 'authenticated');

-- Groups table (without student policy for now)
CREATE TABLE public.groups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    age_group_id UUID REFERENCES public.age_groups(id),
    level_id UUID REFERENCES public.levels(id),
    instructor_id UUID NOT NULL,
    schedule_day TEXT NOT NULL,
    schedule_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage groups" ON public.groups FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can view their groups" ON public.groups FOR SELECT USING (public.has_role(auth.uid(), 'instructor') AND instructor_id = auth.uid());
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Group students junction table
CREATE TABLE public.group_students (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(group_id, student_id)
);

ALTER TABLE public.group_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage group students" ON public.group_students FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can view their group students" ON public.group_students FOR SELECT USING (
    public.has_role(auth.uid(), 'instructor') AND 
    EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND instructor_id = auth.uid())
);
CREATE POLICY "Students can view their own membership" ON public.group_students FOR SELECT USING (public.has_role(auth.uid(), 'student') AND student_id = auth.uid());

-- Now add student policy to groups
CREATE POLICY "Students can view their groups" ON public.groups FOR SELECT USING (
    public.has_role(auth.uid(), 'student') AND 
    EXISTS (SELECT 1 FROM public.group_students WHERE group_id = groups.id AND student_id = auth.uid())
);

-- Sessions table
CREATE TABLE public.sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    topic TEXT,
    topic_ar TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage sessions" ON public.sessions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can manage their sessions" ON public.sessions FOR ALL USING (
    public.has_role(auth.uid(), 'instructor') AND 
    EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND instructor_id = auth.uid())
);
CREATE POLICY "Students can view their sessions" ON public.sessions FOR SELECT USING (
    public.has_role(auth.uid(), 'student') AND 
    EXISTS (SELECT 1 FROM public.group_students gs WHERE gs.group_id = sessions.group_id AND gs.student_id = auth.uid())
);
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attendance table
CREATE TABLE public.attendance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'excused')),
    notes TEXT,
    recorded_by UUID NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(session_id, student_id)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage attendance" ON public.attendance FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can manage attendance" ON public.attendance FOR ALL USING (
    public.has_role(auth.uid(), 'instructor') AND 
    EXISTS (SELECT 1 FROM public.sessions s JOIN public.groups g ON g.id = s.group_id WHERE s.id = session_id AND g.instructor_id = auth.uid())
);
CREATE POLICY "Students can view their attendance" ON public.attendance FOR SELECT USING (public.has_role(auth.uid(), 'student') AND student_id = auth.uid());

-- Warnings table
CREATE TABLE public.warnings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL,
    issued_by UUID NOT NULL,
    reason TEXT NOT NULL,
    reason_ar TEXT,
    warning_type TEXT NOT NULL DEFAULT 'attendance' CHECK (warning_type IN ('attendance', 'behavior', 'assignment', 'other')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage warnings" ON public.warnings FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can manage warnings" ON public.warnings FOR ALL USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Students can view their warnings" ON public.warnings FOR SELECT USING (public.has_role(auth.uid(), 'student') AND student_id = auth.uid());

-- Subscriptions table
CREATE TABLE public.subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    remaining_amount DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students can view their subscription" ON public.subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'student') AND student_id = auth.uid());
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quizzes (Question Bank)
CREATE TABLE public.quizzes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    description TEXT,
    description_ar TEXT,
    level_id UUID REFERENCES public.levels(id),
    age_group_id UUID REFERENCES public.age_groups(id),
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    passing_score INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage quizzes" ON public.quizzes FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can view quizzes" ON public.quizzes FOR SELECT USING (public.has_role(auth.uid(), 'instructor'));
CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quiz Questions
CREATE TABLE public.quiz_questions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_text_ar TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
    options JSONB,
    correct_answer TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage quiz questions" ON public.quiz_questions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can view quiz questions" ON public.quiz_questions FOR SELECT USING (public.has_role(auth.uid(), 'instructor'));

-- Quiz Assignments
CREATE TABLE public.quiz_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    student_id UUID,
    assigned_by UUID NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CHECK (group_id IS NOT NULL OR student_id IS NOT NULL)
);

ALTER TABLE public.quiz_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage quiz assignments" ON public.quiz_assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can manage quiz assignments" ON public.quiz_assignments FOR ALL USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Students can view their quiz assignments" ON public.quiz_assignments FOR SELECT USING (
    public.has_role(auth.uid(), 'student') AND 
    (student_id = auth.uid() OR group_id IN (SELECT group_id FROM public.group_students WHERE student_id = auth.uid()))
);

-- Add student policy for quizzes now that quiz_assignments exists
CREATE POLICY "Students can view assigned quizzes" ON public.quizzes FOR SELECT USING (
    public.has_role(auth.uid(), 'student') AND 
    EXISTS (SELECT 1 FROM public.quiz_assignments WHERE quiz_id = quizzes.id AND (student_id = auth.uid() OR group_id IN (SELECT group_id FROM public.group_students WHERE student_id = auth.uid())))
);

-- Add student policy for quiz_questions
CREATE POLICY "Students can view assigned quiz questions" ON public.quiz_questions FOR SELECT USING (
    public.has_role(auth.uid(), 'student') AND 
    EXISTS (SELECT 1 FROM public.quiz_assignments qa WHERE qa.quiz_id = quiz_questions.quiz_id AND (qa.student_id = auth.uid() OR qa.group_id IN (SELECT group_id FROM public.group_students WHERE student_id = auth.uid())))
);

-- Quiz Submissions
CREATE TABLE public.quiz_submissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_assignment_id UUID NOT NULL REFERENCES public.quiz_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    answers JSONB NOT NULL,
    score INTEGER,
    max_score INTEGER,
    percentage DECIMAL(5,2),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by UUID,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
    UNIQUE(quiz_assignment_id, student_id)
);

ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage quiz submissions" ON public.quiz_submissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can manage quiz submissions" ON public.quiz_submissions FOR ALL USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Students can manage their submissions" ON public.quiz_submissions FOR ALL USING (public.has_role(auth.uid(), 'student') AND student_id = auth.uid());

-- Assignments
CREATE TABLE public.assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    description TEXT,
    description_ar TEXT,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    student_id UUID,
    assigned_by UUID NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    attachment_url TEXT,
    attachment_type TEXT CHECK (attachment_type IN ('text', 'image', 'pdf', 'video')),
    max_score INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CHECK (group_id IS NOT NULL OR student_id IS NOT NULL)
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage assignments" ON public.assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can manage assignments" ON public.assignments FOR ALL USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Students can view their assignments" ON public.assignments FOR SELECT USING (
    public.has_role(auth.uid(), 'student') AND 
    (student_id = auth.uid() OR group_id IN (SELECT group_id FROM public.group_students WHERE student_id = auth.uid()))
);
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Assignment Submissions
CREATE TABLE public.assignment_submissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    content TEXT,
    attachment_url TEXT,
    attachment_type TEXT CHECK (attachment_type IN ('text', 'image', 'pdf', 'video')),
    score INTEGER,
    feedback TEXT,
    feedback_ar TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by UUID,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned')),
    UNIQUE(assignment_id, student_id)
);

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage assignment submissions" ON public.assignment_submissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Instructors can manage assignment submissions" ON public.assignment_submissions FOR ALL USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Students can manage their submissions" ON public.assignment_submissions FOR ALL USING (public.has_role(auth.uid(), 'student') AND student_id = auth.uid());

-- Activity Logs
CREATE TABLE public.activity_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all logs" ON public.activity_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their logs" ON public.activity_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert logs" ON public.activity_logs FOR INSERT WITH CHECK (true);
CREATE INDEX idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_date ON public.activity_logs(created_at DESC);

-- Notifications
CREATE TABLE public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    message TEXT NOT NULL,
    message_ar TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'quiz', 'assignment', 'attendance', 'subscription', 'system')),
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read);

-- Add student-specific fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_group_id UUID REFERENCES public.age_groups(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES public.levels(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialization TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialization_ar TEXT;