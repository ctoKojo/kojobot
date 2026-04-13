import React, { Suspense } from "react";
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
import { LoadingScreen } from "@/components/LoadingScreen";

// Lazy-loaded page components for code splitting
const Index = React.lazy(() => import("./pages/Index"));
const Auth = React.lazy(() => import("./pages/Auth"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Students = React.lazy(() => import("./pages/Students"));
const Instructors = React.lazy(() => import("./pages/Instructors"));
const Groups = React.lazy(() => import("./pages/Groups"));
const AgeGroups = React.lazy(() => import("./pages/AgeGroups"));
const Levels = React.lazy(() => import("./pages/Levels"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
const ActivityLog = React.lazy(() => import("./pages/ActivityLog"));
const Settings = React.lazy(() => import("./pages/Settings"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Quizzes = React.lazy(() => import("./pages/Quizzes"));
const Assignments = React.lazy(() => import("./pages/Assignments"));
const Sessions = React.lazy(() => import("./pages/Sessions"));
const TakeQuiz = React.lazy(() => import("./pages/TakeQuiz"));
const SubmitAssignment = React.lazy(() => import("./pages/SubmitAssignment"));
const QuizEditor = React.lazy(() => import("./pages/QuizEditor"));
const GradeAssignment = React.lazy(() => import("./pages/GradeAssignment"));
const AssignmentSubmissions = React.lazy(() => import("./pages/AssignmentSubmissions"));
const StudentProfile = React.lazy(() => import("./pages/StudentProfile"));
const InstructorProfile = React.lazy(() => import("./pages/InstructorProfile"));
const GroupDetails = React.lazy(() => import("./pages/GroupDetails"));
const Profile = React.lazy(() => import("./pages/Profile"));
const InstructorSchedule = React.lazy(() => import("./pages/InstructorSchedule"));
const MyQuizzes = React.lazy(() => import("./pages/MyQuizzes"));
const QuizReports = React.lazy(() => import("./pages/QuizReports"));
const MyInstructorQuizzes = React.lazy(() => import("./pages/MyInstructorQuizzes"));
const SessionDetails = React.lazy(() => import("./pages/SessionDetails"));
const InstructorWarnings = React.lazy(() => import("./pages/InstructorWarnings"));
const StudentWarnings = React.lazy(() => import("./pages/StudentWarnings"));
const MyInstructorWarningsPage = React.lazy(() => import("./pages/MyInstructorWarnings"));
const MonthlyReports = React.lazy(() => import("./pages/MonthlyReports"));
const Materials = React.lazy(() => import("./pages/Materials"));
const MyMaterials = React.lazy(() => import("./pages/MyMaterials"));
const MakeupSessions = React.lazy(() => import("./pages/MakeupSessions"));
const MyMakeupSessions = React.lazy(() => import("./pages/MyMakeupSessions"));
const PricingPlans = React.lazy(() => import("./pages/PricingPlans"));
const Finance = React.lazy(() => import("./pages/Finance"));
const DeductionRules = React.lazy(() => import("./pages/DeductionRules"));
const AccountSuspended = React.lazy(() => import("./pages/AccountSuspended"));
const AccountTerminated = React.lazy(() => import("./pages/AccountTerminated"));
const Messages = React.lazy(() => import("./pages/Messages"));
const InstructorPerformanceDashboard = React.lazy(() => import("./pages/InstructorPerformanceDashboard"));
const CurriculumManagement = React.lazy(() => import("./pages/CurriculumManagement"));
const CurriculumSessionEdit = React.lazy(() => import("./pages/CurriculumSessionEdit"));
const MySessions = React.lazy(() => import("./pages/MySessions"));
const SSOTHealth = React.lazy(() => import("./pages/SSOTHealth"));
const Leaderboard = React.lazy(() => import("./pages/Leaderboard"));
const MyFinances = React.lazy(() => import("./pages/MyFinances"));
const Subscribe = React.lazy(() => import("./pages/Subscribe"));
const SubscriptionRequests = React.lazy(() => import("./pages/SubscriptionRequests"));
const PlacementTestSettings = React.lazy(() => import("./pages/PlacementTestSettings"));
const PlacementTestReview = React.lazy(() => import("./pages/PlacementTestReview"));
const TakePlacementTest = React.lazy(() => import("./pages/TakePlacementTest"));
const PlacementGate = React.lazy(() => import("./pages/PlacementGate"));
const FinalExams = React.lazy(() => import("./pages/FinalExams"));
const ProgressionMetrics = React.lazy(() => import("./pages/ProgressionMetrics"));
const MyCertificates = React.lazy(() => import("./pages/MyCertificates"));
const RenewalRequired = React.lazy(() => import("./pages/RenewalRequired"));
const ParentStudentView = React.lazy(() => import("./pages/ParentStudentView"));
const ParentRegister = React.lazy(() => import("./pages/ParentRegister"));
const ParentLogin = React.lazy(() => import("./pages/ParentLogin"));
const Parents = React.lazy(() => import("./pages/Parents"));
const ParentLeaveRequests = React.lazy(() => import("./pages/ParentLeaveRequests"));
const LeaveRequests = React.lazy(() => import("./pages/LeaveRequests"));
const ParentPending = React.lazy(() => import("./pages/ParentPending"));

// Component to handle admin session timeout
function AdminSessionTimeoutHandler() {
  // This component must be rendered inside AuthProvider
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
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/ar" element={<Index lang="ar" />} />
                  <Route path="/en" element={<Index lang="en" />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/students" element={<ProtectedRoute allowedRoles={['admin', 'reception']}><Students /></ProtectedRoute>} />
                  <Route path="/instructors" element={<ProtectedRoute allowedRoles={['admin']}><Instructors /></ProtectedRoute>} />
                  <Route path="/groups" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'reception']}><Groups /></ProtectedRoute>} />
                  <Route path="/quizzes" element={<ProtectedRoute allowedRoles={['admin', 'instructor']}><Quizzes /></ProtectedRoute>} />
                  <Route path="/assignments" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'student']}><Assignments /></ProtectedRoute>} />
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
                  <Route path="/messages" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'student', 'reception', 'parent']}><Messages /></ProtectedRoute>} />
                  <Route path="/parents" element={<ProtectedRoute allowedRoles={['admin', 'reception']}><Parents /></ProtectedRoute>} />
                  <Route path="/instructor-performance" element={<ProtectedRoute allowedRoles={['admin']}><InstructorPerformanceDashboard /></ProtectedRoute>} />
                  <Route path="/curriculum" element={<ProtectedRoute allowedRoles={['admin']}><CurriculumManagement /></ProtectedRoute>} />
                  <Route path="/curriculum/session/:sessionId" element={<ProtectedRoute allowedRoles={['admin']}><CurriculumSessionEdit /></ProtectedRoute>} />
                  <Route path="/my-sessions" element={<ProtectedRoute allowedRoles={['student']}><MySessions /></ProtectedRoute>} />
                  <Route path="/ssot-health" element={<ProtectedRoute allowedRoles={['admin']}><SSOTHealth /></ProtectedRoute>} />
                  <Route path="/leaderboard" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'student', 'reception']}><Leaderboard /></ProtectedRoute>} />
                  <Route path="/my-finances" element={<ProtectedRoute allowedRoles={['parent']}><MyFinances /></ProtectedRoute>} />
                  <Route path="/subscribe" element={<Subscribe />} />
                  <Route path="/subscription-requests" element={<ProtectedRoute allowedRoles={['admin', 'reception']}><SubscriptionRequests /></ProtectedRoute>} />
                  <Route path="/placement-test-settings" element={<ProtectedRoute allowedRoles={['admin']}><PlacementTestSettings /></ProtectedRoute>} />
                  <Route path="/placement-test-review" element={<ProtectedRoute allowedRoles={['admin', 'reception']}><PlacementTestReview /></ProtectedRoute>} />
                  <Route path="/placement-test" element={<ProtectedRoute allowedRoles={['student']}><TakePlacementTest /></ProtectedRoute>} />
                  <Route path="/placement-gate" element={<ProtectedRoute allowedRoles={['student']}><PlacementGate /></ProtectedRoute>} />
                  <Route path="/final-exams" element={<ProtectedRoute allowedRoles={['admin', 'reception']}><FinalExams /></ProtectedRoute>} />
                  <Route path="/progression-metrics" element={<ProtectedRoute allowedRoles={['admin']}><ProgressionMetrics /></ProtectedRoute>} />
                  <Route path="/my-certificates" element={<ProtectedRoute allowedRoles={['student']}><MyCertificates /></ProtectedRoute>} />
                  <Route path="/account-suspended" element={<AccountSuspended />} />
                  <Route path="/account-terminated" element={<AccountTerminated />} />
                  <Route path="/renewal-required" element={<RenewalRequired />} />
                  <Route path="/parent-login" element={<ParentLogin />} />
                  <Route path="/parent-register" element={<ParentRegister />} />
                  <Route path="/parent/student/:studentId" element={<ProtectedRoute allowedRoles={['parent']}><ParentStudentView /></ProtectedRoute>} />
                  <Route path="/parent-leave-requests" element={<ProtectedRoute allowedRoles={['parent']}><ParentLeaveRequests /></ProtectedRoute>} />
                  <Route path="/leave-requests" element={<ProtectedRoute allowedRoles={['admin', 'reception']}><LeaveRequests /></ProtectedRoute>} />
                  <Route path="/parent-pending" element={<ProtectedRoute allowedRoles={['parent']}><ParentPending /></ProtectedRoute>} />
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
