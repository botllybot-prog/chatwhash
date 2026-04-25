import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAppLanguage } from "@/lib/language";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallbackPath?: string;
}

const texts = {
  ar: { denied: "??? ???? ?? ??????? ???? ??????" },
  en: { denied: "You are not authorized to access this page" },
  ku: { denied: "?????????? ??? ?? ????? ???????? ??? ??????" },
  tr: { denied: "Bu sayfaya erisim yetkiniz yok" },
} as const;

const RoleGuard = ({ children, allowedRoles, fallbackPath }: RoleGuardProps) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthorized(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1).maybeSingle();
      setAuthorized(allowedRoles.includes(data?.role || ""));
    };
    check();
  }, [allowedRoles]);

  useEffect(() => {
    if (authorized === false && fallbackPath) navigate(fallbackPath, { replace: true });
  }, [authorized, fallbackPath, navigate]);

  if (authorized === null) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  if (!authorized) {
    return <div className="min-h-screen flex items-center justify-center bg-background" dir={isRtl ? "rtl" : "ltr"}><p className="text-destructive text-lg font-semibold">{t.denied}</p></div>;
  }

  return <>{children}</>;
};

export default RoleGuard;
