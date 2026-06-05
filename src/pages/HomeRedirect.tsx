import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function HomeRedirect() {
  const { loading, session, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "super_admin") return <Navigate to="/dashboard" replace />;

  return <Navigate to="/login" replace />;
}
