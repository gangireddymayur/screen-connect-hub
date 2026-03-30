import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import CompaniesPage from "./pages/CompaniesPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminDevicesPage from "./pages/admin/AdminDevicesPage";
import AdminContentPage from "./pages/admin/AdminContentPage";
import AdminPlaylistsPage from "./pages/admin/AdminPlaylistsPage";
import AdminSchedulePage from "./pages/admin/AdminSchedulePage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";

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
            {/* Super Admin Routes */}
            <Route path="/" element={<ProtectedRoute requiredRole="super_admin"><DashboardPage /></ProtectedRoute>} />
            <Route path="/companies" element={<ProtectedRoute requiredRole="super_admin"><CompaniesPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredRole="super_admin"><UsersPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRole="super_admin"><SettingsPage /></ProtectedRoute>} />
            {/* Company Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboardPage /></ProtectedRoute>} />
            <Route path="/admin/devices" element={<ProtectedRoute requiredRole="admin"><AdminDevicesPage /></ProtectedRoute>} />
            <Route path="/admin/content" element={<ProtectedRoute requiredRole="admin"><AdminContentPage /></ProtectedRoute>} />
            <Route path="/admin/playlists" element={<ProtectedRoute requiredRole="admin"><AdminPlaylistsPage /></ProtectedRoute>} />
            <Route path="/admin/schedule" element={<ProtectedRoute requiredRole="admin"><AdminSchedulePage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute requiredRole="admin"><AdminSettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
