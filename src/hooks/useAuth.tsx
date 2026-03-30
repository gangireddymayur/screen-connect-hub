import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "super_admin" | "admin";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const fetchRole = async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();
      if (error) {
        console.error("Failed to fetch role:", error.message);
        return null;
      }
      return (data?.role as AppRole) ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // Safety timeout — stop loading after 3s even if Supabase is unreachable
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        initialized.current = true;
      }
    }, 3000);

    // Get initial session first
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const userRole = await fetchRole(session.user.id);
        setRole(userRole);
      }
      setLoading(false);
      initialized.current = true;
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
      initialized.current = true;
    });

    // Then listen for changes — non-blocking to avoid deadlocks
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Skip if this fires before getSession completes
        if (!initialized.current) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Fire and forget — don't await inside onAuthStateChange
          fetchRole(session.user.id).then((userRole) => setRole(userRole));
        } else {
          setRole(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
