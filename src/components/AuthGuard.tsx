import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Navigate, useNavigate, useLocation } from "react-router-dom";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const fetchRole = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      setRole(data?.role || null);
      setLoading(false);
    };
    fetchRole();
  }, [session?.user?.id]);

  // Redirect based on role
  useEffect(() => {
    if (loading || !session || !role) return;
    const path = location.pathname;

    if (role === "station_owner") {
      if (!path.startsWith("/app/station-portal")) {
        navigate("/app/station-portal", { replace: true });
      }
    } else if (role === "admin") {
      if (path.startsWith("/app/station-portal")) {
        navigate("/app/admin/dashboard", { replace: true });
      }
    }
  }, [role, loading, session, location.pathname, navigate]);

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

  if (!role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4" dir="rtl">
        <p className="text-muted-foreground text-lg">حسابك غير مفعّل أو لم يتم تعيين دور لك.</p>
        <p className="text-muted-foreground text-sm">تواصل مع الإدارة لتفعيل حسابك.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-primary underline text-sm">تسجيل الخروج</button>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;
