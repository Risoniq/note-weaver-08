import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { TourProvider } from "@/components/onboarding/TourProvider";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { QuickRecordingProvider } from "@/contexts/QuickRecordingContext";
import { RecordingBanner } from "@/components/recording/RecordingBanner";
import { ScreenBorderOverlay } from "@/components/recording/ScreenBorderOverlay";
import { WebcamPreview } from "@/components/recording/WebcamPreview";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CalendarCallback from "./pages/CalendarCallback";
import MeetingDetail from "./pages/MeetingDetail";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Recordings from "./pages/Recordings";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TourProvider>
      <ImpersonationProvider>
      <QuickRecordingProvider>
      <TooltipProvider>
      <Sonner />
      <RecordingBanner />
      <ScreenBorderOverlay />
      <WebcamPreview />
      <BrowserRouter>
        <OnboardingTour />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/calendar" element={<Navigate to="/settings" replace />} />
          <Route path="/recordings" element={<ProtectedRoute><Recordings /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
          <Route path="/meeting/:id" element={<ProtectedRoute><MeetingDetail /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/transcripts" element={<Navigate to="/recordings" replace />} />
          {/* OAuth callback must be reachable even if auth session refreshes during redirect */}
          <Route path="/calendar-callback" element={<CalendarCallback />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </TooltipProvider>
      </QuickRecordingProvider>
      </ImpersonationProvider>
      </TourProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
