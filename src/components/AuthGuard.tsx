import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useNavigate, useLocation } from "react-router-dom";
import Login from "@/pages/Login";

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

  // Fetch role when session changes
  useEffect(() => {
    if (!session?.user) return;
    const fetchRole = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      const userRole = data?.role || "admin"; // Default to admin for existing users
      setRole(userRole);
      setLoading(false);
    };
    fetchRole();
  }, [session?.user?.id]);

  // Redirect based on role
  useEffect(() => {
    if (loading || !session || !role) return;

    if (role === "station_owner") {
      // Station owners can only access /station-portal
      if (!location.pathname.startsWith("/station-portal")) {
        navigate("/station-portal", { replace: true });
      }
    } else if (role === "admin") {
      // If admin is on station-portal, redirect to bot-admin
      if (location.pathname.startsWith("/station-portal")) {
        navigate("/bot-admin", { replace: true });
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

  if (!session) return <Login />;

  return <>{children}</>;
};

export default AuthGuard;
