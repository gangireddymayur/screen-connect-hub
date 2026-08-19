import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "super_admin" | "admin";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  company: any | null;
  isTrialExpired: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  company: null,
  isTrialExpired: false,
  loading: true,
  signOut: async () => {},
});

export function getTrialInfo(company: any) {
  if (!company) return { isExpired: false, text: "Active", variant: "default", trialEndsAt: null, isTrial: false };

  const parseDate = (dateStr: string) => {
    if (!dateStr || dateStr === "null") return null;
    const formatted = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
    const d = new Date(formatted);
    return isNaN(d.getTime()) ? null : d;
  };

  const trialEnd = parseDate(company.trial_ends_at);
  const createdAt = parseDate(company.created_at);

  if (company.subscription_status === "active") {
    if (trialEnd) {
      const isPast = Date.now() > trialEnd.getTime();
      return {
        isExpired: isPast,
        text: isPast ? "Access Expired" : `Full Access until ${trialEnd.toLocaleDateString()}`,
        variant: isPast ? "destructive" : "default",
        trialEndsAt: trialEnd.toISOString(),
        isTrial: false,
      };
    }
    return {
      isExpired: false,
      text: "Active (Lifetime)",
      variant: "default",
      trialEndsAt: null,
      isTrial: false,
    };
  }

  if (company.subscription_status === "expired") {
    return {
      isExpired: true,
      text: "Access Expired",
      variant: "destructive",
      trialEndsAt: trialEnd ? trialEnd.toISOString() : null,
      isTrial: false,
    };
  }

  // Trial calculation
  const calculatedEnd =
    trialEnd ||
    (createdAt
      ? new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const diff = calculatedEnd.getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  const isExpired = diff <= 0;

  return {
    isExpired,
    text: isExpired ? "Trial Expired" : `Trial expires: ${calculatedEnd.toLocaleDateString()}`,
    variant: isExpired ? "destructive" : "warning",
    trialEndsAt: calculatedEnd.toISOString(),
    daysLeft: days,
    isTrial: true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [company, setCompany] = useState<any | null>(null);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const fetchRoleAndCompany = async (userObj: User) => {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userObj.id)
        .single();

      const userRole = (roleData?.role as AppRole) ?? null;
      console.log("[fetchRoleAndCompany] userRole:", userRole);
      setRole(userRole);

      const companyId = userObj.user_metadata?.company_id;
      console.log("[fetchRoleAndCompany] companyId:", companyId);
      if (companyId) {
        const { data: compData } = await supabase
          .from("companies")
          .select("*")
          .eq("id", companyId)
          .single();
        console.log("[fetchRoleAndCompany] compData:", JSON.stringify(compData));
        setCompany(compData ?? null);
        const trialInfo = getTrialInfo(compData);
        console.log("[fetchRoleAndCompany] trialInfo:", JSON.stringify(trialInfo));
        setIsTrialExpired(trialInfo.isExpired);
      } else {
        setCompany(null);
        setIsTrialExpired(false);
      }
    } catch {
      setRole(null);
      setCompany(null);
      setIsTrialExpired(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        initialized.current = true;
      }
    }, 3000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchRoleAndCompany(session.user);
      }
      setLoading(false);
      initialized.current = true;
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
      initialized.current = true;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!initialized.current) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchRoleAndCompany(session.user);
        } else {
          setRole(null);
          setCompany(null);
          setIsTrialExpired(false);
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
    setCompany(null);
    setIsTrialExpired(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, company, isTrialExpired, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
