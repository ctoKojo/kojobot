import React from "react";
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

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Instructors from "./pages/Instructors";
import Groups from "./pages/Groups";
import AgeGroups from "./pages/AgeGroups";
import Levels from "./pages/Levels";
import Notifications from "./pages/Notifications";
import ActivityLog from "./pages/ActivityLog";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Quizzes from "./pages/Quizzes";
import Assignments from "./pages/Assignments";
import Attendance from "./pages/Attendance";
import Sessions from "./pages/Sessions";
import TakeQuiz from "./pages/TakeQuiz";
import SubmitAssignment from "./pages/SubmitAssignment";
import QuizEditor from "./pages/QuizEditor";
import GradeAssignment from "./pages/GradeAssignment";
import AssignmentSubmissions from "./pages/AssignmentSubmissions";
import StudentProfile from "./pages/StudentProfile";
import InstructorProfile from "./pages/InstructorProfile";
import GroupDetails from "./pages/GroupDetails";
import Profile from "./pages/Profile";
import InstructorSchedule from "./pages/InstructorSchedule";
import MyQuizzes from "./pages/MyQuizzes";
import QuizReports from "./pages/QuizReports";
import MyInstructorQuizzes from "./pages/MyInstructorQuizzes";
import SessionDetails from "./pages/SessionDetails";
import InstructorWarnings from "./pages/InstructorWarnings";
import StudentWarnings from "./pages/StudentWarnings";
import MyInstructorWarningsPage from "./pages/MyInstructorWarnings";
import MonthlyReports from "./pages/MonthlyReports";
import Materials from "./pages/Materials";
import MyMaterials from "./pages/MyMaterials";
import MakeupSessions from "./pages/MakeupSessions";
import MyMakeupSessions from "./pages/MyMakeupSessions";
import PricingPlans from "./pages/PricingPlans";
import Finance from "./pages/Finance";
import DeductionRules from "./pages/DeductionRules";
import AccountSuspended from "./pages/AccountSuspended";
import AccountTerminated from "./pages/AccountTerminated";
import Messages from "./pages/Messages";
import InstructorPerformanceDashboard from "./pages/InstructorPerformanceDashboard";

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
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/students" element={<ProtectedRoute allowedRoles={['admin', 'reception']}><Students /></ProtectedRoute>} />
                  <Route path="/instructors" element={<ProtectedRoute allowedRoles={['admin']}><Instructors /></ProtectedRoute>} />
                  <Route path="/groups" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'reception']}><Groups /></ProtectedRoute>} />
                  <Route path="/quizzes" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><Quizzes /></ProtectedRoute>} />
                  <Route path="/assignments" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'student']}><Assignments /></ProtectedRoute>} />
                  <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'student', 'reception']}><Attendance /></ProtectedRoute>} />
                  <Route path="/sessions" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'reception']}><Sessions /></ProtectedRoute>} />
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
                  <Route path="/student/:studentId" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'reception']}><StudentProfile /></ProtectedRoute>} />
                  <Route path="/instructor/:instructorId" element={<ProtectedRoute allowedRoles={['admin']}><InstructorProfile /></ProtectedRoute>} />
                  <Route path="/group/:groupId" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'reception']}><GroupDetails /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/instructor-schedule/:instructorId?" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'reception']}><InstructorSchedule /></ProtectedRoute>} />
                  <Route path="/session/:sessionId" element={<ProtectedRoute><SessionDetails /></ProtectedRoute>} />
                  <Route path="/instructor-warnings" element={<ProtectedRoute allowedRoles={['admin']}><InstructorWarnings /></ProtectedRoute>} />
                  <Route path="/my-warnings" element={<ProtectedRoute allowedRoles={['student']}><StudentWarnings /></ProtectedRoute>} />
                  <Route path="/my-instructor-warnings" element={<ProtectedRoute allowedRoles={['instructor']}><MyInstructorWarningsPage /></ProtectedRoute>} />
                  <Route path="/monthly-reports" element={<ProtectedRoute allowedRoles={['admin', 'student']}><MonthlyReports /></ProtectedRoute>} />
                  <Route path="/materials" element={<ProtectedRoute allowedRoles={['admin']}><Materials /></ProtectedRoute>} />
                  <Route path="/my-materials" element={<ProtectedRoute allowedRoles={['student']}><MyMaterials /></ProtectedRoute>} />
                  <Route path="/makeup-sessions" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'reception']}><MakeupSessions /></ProtectedRoute>} />
                  <Route path="/my-makeup-sessions" element={<ProtectedRoute allowedRoles={['student']}><MyMakeupSessions /></ProtectedRoute>} />
                  <Route path="/pricing-plans" element={<ProtectedRoute allowedRoles={['admin', 'reception']}><PricingPlans /></ProtectedRoute>} />
                  <Route path="/finance" element={<ProtectedRoute allowedRoles={['admin', 'reception']}><Finance /></ProtectedRoute>} />
                  <Route path="/deduction-rules" element={<ProtectedRoute allowedRoles={['admin']}><DeductionRules /></ProtectedRoute>} />
                  <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                  <Route path="/instructor-performance" element={<ProtectedRoute allowedRoles={['admin']}><InstructorPerformanceDashboard /></ProtectedRoute>} />
                  <Route path="/account-suspended" element={<AccountSuspended />} />
                  <Route path="/account-terminated" element={<AccountTerminated />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
