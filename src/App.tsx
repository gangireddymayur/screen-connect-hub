import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import DevicesPage from "./pages/DevicesPage";
import ContentPage from "./pages/ContentPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import SchedulePage from "./pages/SchedulePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CompaniesPage from "./pages/CompaniesPage";
import SettingsPage from "./pages/SettingsPage";
import ScreenEditorPage from "./pages/ScreenEditorPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
            <Route path="/content" element={<ProtectedRoute><ContentPage /></ProtectedRoute>} />
            <Route path="/playlists" element={<ProtectedRoute><PlaylistsPage /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/companies" element={<ProtectedRoute requiredRole="super_admin"><CompaniesPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/editor/:deviceId" element={<ProtectedRoute><ScreenEditorPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
