import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAdminSessionTimeout } from "@/hooks/useAdminSessionTimeout";
import { KojobotLogo } from "@/components/KojobotLogo";

// Auth is not lazy-loaded since it's the landing page (critical for LCP)
import Auth from "./pages/Auth";

// Lazy load all other pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Students = lazy(() => import("./pages/Students"));
const Instructors = lazy(() => import("./pages/Instructors"));
const Groups = lazy(() => import("./pages/Groups"));
const AgeGroups = lazy(() => import("./pages/AgeGroups"));
const Levels = lazy(() => import("./pages/Levels"));
const Notifications = lazy(() => import("./pages/Notifications"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Quizzes = lazy(() => import("./pages/Quizzes"));
const Assignments = lazy(() => import("./pages/Assignments"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Sessions = lazy(() => import("./pages/Sessions"));
const TakeQuiz = lazy(() => import("./pages/TakeQuiz"));
const SubmitAssignment = lazy(() => import("./pages/SubmitAssignment"));
const QuizEditor = lazy(() => import("./pages/QuizEditor"));
const GradeAssignment = lazy(() => import("./pages/GradeAssignment"));
const AssignmentSubmissions = lazy(() => import("./pages/AssignmentSubmissions"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const InstructorProfile = lazy(() => import("./pages/InstructorProfile"));
const GroupDetails = lazy(() => import("./pages/GroupDetails"));
const Profile = lazy(() => import("./pages/Profile"));
const InstructorSchedule = lazy(() => import("./pages/InstructorSchedule"));
const MyQuizzes = lazy(() => import("./pages/MyQuizzes"));
const QuizReports = lazy(() => import("./pages/QuizReports"));
const MyInstructorQuizzes = lazy(() => import("./pages/MyInstructorQuizzes"));
const SessionDetails = lazy(() => import("./pages/SessionDetails"));
const InstructorWarnings = lazy(() => import("./pages/InstructorWarnings"));
const StudentWarnings = lazy(() => import("./pages/StudentWarnings"));
const MyInstructorWarningsPage = lazy(() => import("./pages/MyInstructorWarnings"));
const MonthlyReports = lazy(() => import("./pages/MonthlyReports"));

// Minimal loading fallback - no visible loader to avoid flash during navigation
const PageLoader = () => (
  <div className="min-h-screen bg-background" />
);

// Component to handle admin session timeout
function AdminSessionTimeoutHandler() {
  useAdminSessionTimeout();
  return null;
}

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <LanguageProvider>
          <AuthProvider>
            <AdminSessionTimeoutHandler />
            <TooltipProvider>
              <Toaster />
              <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/students" element={<ProtectedRoute allowedRoles={['admin']}><Students /></ProtectedRoute>} />
                  <Route path="/instructors" element={<ProtectedRoute allowedRoles={['admin']}><Instructors /></ProtectedRoute>} />
                  <Route path="/groups" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><Groups /></ProtectedRoute>} />
                  <Route path="/quizzes" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><Quizzes /></ProtectedRoute>} />
                  <Route path="/assignments" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'student']}><Assignments /></ProtectedRoute>} />
                  <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'student']}><Attendance /></ProtectedRoute>} />
                  <Route path="/sessions" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><Sessions /></ProtectedRoute>} />
                  <Route path="/age-groups" element={<ProtectedRoute allowedRoles={['admin']}><AgeGroups /></ProtectedRoute>} />
                  <Route path="/levels" element={<ProtectedRoute allowedRoles={['admin']}><Levels /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  <Route path="/activity-log" element={<ProtectedRoute allowedRoles={['admin']}><ActivityLog /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />
                  <Route path="/quiz/:assignmentId" element={<ProtectedRoute allowedRoles={['student']}><TakeQuiz /></ProtectedRoute>} />
                  <Route path="/my-quizzes" element={<ProtectedRoute allowedRoles={['student']}><MyQuizzes /></ProtectedRoute>} />
                  <Route path="/assignment/:assignmentId" element={<ProtectedRoute allowedRoles={['student']}><SubmitAssignment /></ProtectedRoute>} />
                  <Route path="/quiz-editor/:quizId" element={<ProtectedRoute allowedRoles={['admin']}><QuizEditor /></ProtectedRoute>} />
                  <Route path="/quiz-reports" element={<ProtectedRoute allowedRoles={['admin']}><QuizReports /></ProtectedRoute>} />
                  <Route path="/my-instructor-quizzes" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><MyInstructorQuizzes /></ProtectedRoute>} />
                  <Route path="/grade-assignment/:submissionId" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><GradeAssignment /></ProtectedRoute>} />
                  <Route path="/assignment-submissions/:assignmentId" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><AssignmentSubmissions /></ProtectedRoute>} />
                  <Route path="/student/:studentId" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><StudentProfile /></ProtectedRoute>} />
                  <Route path="/instructor/:instructorId" element={<ProtectedRoute allowedRoles={['admin']}><InstructorProfile /></ProtectedRoute>} />
                  <Route path="/group/:groupId" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><GroupDetails /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/instructor-schedule/:instructorId?" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><InstructorSchedule /></ProtectedRoute>} />
                  <Route path="/session/:sessionId" element={<ProtectedRoute><SessionDetails /></ProtectedRoute>} />
                  <Route path="/instructor-warnings" element={<ProtectedRoute allowedRoles={['admin']}><InstructorWarnings /></ProtectedRoute>} />
                  <Route path="/my-warnings" element={<ProtectedRoute allowedRoles={['student']}><StudentWarnings /></ProtectedRoute>} />
                  <Route path="/my-instructor-warnings" element={<ProtectedRoute allowedRoles={['instructor']}><MyInstructorWarningsPage /></ProtectedRoute>} />
                  <Route path="/monthly-reports" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'student']}><MonthlyReports /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
