import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

interface Props {
  children: React.ReactNode;
  requiredRole?: "super_admin" | "admin";
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on role if accessing wrong area
  if (requiredRole && role !== requiredRole) {
    // If admin trying to access super_admin pages, redirect to admin dashboard
    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    // If super_admin trying to access admin pages, redirect to super admin dashboard
    if (role === "super_admin") {
      return <Navigate to="/" replace />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
