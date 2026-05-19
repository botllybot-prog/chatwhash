import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowRight, Car, LogIn, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppLanguage } from "@/lib/language";

const texts = {
  ar: {
    home: "الرئيسية",
    title: "تسجيل الدخول",
    subtitle: "أدخل بياناتك للوصول إلى لوحة التحكم",
    email: "البريد الإلكتروني أو رقم الموبايل",
    password: "كلمة المرور",
    login: "دخول",
    loggingIn: "جاري الدخول...",
    ownerInfo: "إذا كنت صاحب محطة جديدة، أنشئ حسابك ومحطتك وخدماتك من صفحة واحدة.",
    ownerButton: "إنشاء حساب صاحب محطة",
    failedTitle: "فشل تسجيل الدخول",
    failedDescription: "البريد الإلكتروني أو رقم الموبايل أو كلمة المرور غير صحيحة",
    lookupFailedTitle: "تعذر العثور على الحساب",
    lookupFailedDescription: "تأكد من رقم الموبايل المسجل للمحطة، أو استخدم البريد الإلكتروني.",
  },
  en: {
    home: "Home",
    title: "Login",
    subtitle: "Enter your details to access the dashboard",
    email: "Email or mobile number",
    password: "Password",
    login: "Login",
    loggingIn: "Logging in...",
    ownerInfo: "If you are a new station owner, create your account, station, and services from one page.",
    ownerButton: "Create station owner account",
    failedTitle: "Login failed",
    failedDescription: "The email, mobile number, or password is incorrect",
    lookupFailedTitle: "Account not found",
    lookupFailedDescription: "Check the station mobile number, or use the email address.",
  },
  ku: {
    home: "سەرەکی",
    title: "چوونەژوورەوە",
    subtitle: "زانیاریەکانت بنووسە بۆ چوونە ناو داشبۆرد",
    email: "ئیمەیڵ یان ژمارەی مۆبایل",
    password: "وشەی نهێنی",
    login: "چوونەژوورەوە",
    loggingIn: "چوونەژوورەوە لە کاردایە...",
    ownerInfo: "ئەگەر خاوەنی وێستگەیەکی نوێیت، هەژمار و وێستگە و خزمەتگوزاریەکانت لە یەک پەڕە دروست بکە.",
    ownerButton: "دروستکردنی هەژماری خاوەنی وێستگە",
    failedTitle: "چوونەژوورەوە سەرکەوتوو نەبوو",
    failedDescription: "ئیمەیڵ، ژمارەی مۆبایل، یان وشەی نهێنی هەڵەیە",
    lookupFailedTitle: "هەژمارەکە نەدۆزرایەوە",
    lookupFailedDescription: "ژمارەی مۆبایلی وێستگەکە بپشکنە، یان ئیمەیڵ بەکاربهێنە.",
  },
  tr: {
    home: "Ana sayfa",
    title: "Giriş yap",
    subtitle: "Yönetim paneline erişmek için bilgilerinizi girin",
    email: "E-posta veya telefon",
    password: "Şifre",
    login: "Giriş",
    loggingIn: "Giriş yapılıyor...",
    ownerInfo: "Yeni bir istasyon sahibiyseniz hesabınızı, istasyonunuzu ve hizmetlerinizi tek sayfadan oluşturun.",
    ownerButton: "İstasyon sahibi hesabı oluştur",
    failedTitle: "Giriş başarısız",
    failedDescription: "E-posta, telefon veya şifre yanlış",
    lookupFailedTitle: "Hesap bulunamadı",
    lookupFailedDescription: "İstasyon telefon numarasını kontrol edin veya e-posta kullanın.",
  },
} as const;

type OwnerLoginLookupResponse = {
  success?: boolean;
  email?: string;
  error?: string;
};

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];

  const navigateByRole = useCallback(async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
    if (data?.role === "station_owner") {
      navigate("/app/station-portal", { replace: true });
    } else if (data?.role === "admin") {
      navigate("/app/admin/dashboard", { replace: true });
    } else {
      navigate("/app", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        void navigateByRole(session.user.id);
      }
    });
  }, [navigateByRole]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const trimmedIdentifier = identifier.trim();
    let resolvedEmail = trimmedIdentifier;

    if (!trimmedIdentifier.includes("@")) {
      const { data: lookupData, error: lookupError } = await supabase.functions.invoke<OwnerLoginLookupResponse>(
        "owner-login-lookup",
        { body: { identifier: trimmedIdentifier } },
      );

      if (lookupError || lookupData?.error || !lookupData?.email) {
        toast({
          title: t.lookupFailedTitle,
          description: t.lookupFailedDescription,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      resolvedEmail = lookupData.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail.trim().toLowerCase(),
      password,
    });

    if (error) {
      toast({
        title: t.failedTitle,
        description: t.failedDescription,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (data.user) {
      await navigateByRole(data.user.id);
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-ocean-50 to-background p-4" dir={isRtl ? "rtl" : "ltr"}>
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className={`absolute top-4 text-muted-foreground hover:text-ocean-500 ${isRtl ? "right-4" : "left-4"}`}
      >
        <ArrowRight className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1 rotate-180"}`} />
        {t.home}
      </Button>

      <Card className="w-full max-w-md border-border shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ocean-500 shadow-lg shadow-ocean-500/30">
            <Car className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">{t.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <div className="relative">
                <UserRound className={`${isRtl ? "right-3" : "left-3"} absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground`} />
                <Input
                  id="email"
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="admin@example.com أو 0770xxxxxxx"
                  className={isRtl ? "pr-10" : "pl-10"}
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-ocean-500 text-white hover:bg-ocean-600" disabled={loading}>
              <LogIn className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
              {loading ? t.loggingIn : t.login}
            </Button>
          </form>

          <div className="mt-4 rounded-xl border border-dashed p-4 text-center">
            <p className="mb-3 text-sm text-muted-foreground">{t.ownerInfo}</p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/owner")}>
              {t.ownerButton}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
