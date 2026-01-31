import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
