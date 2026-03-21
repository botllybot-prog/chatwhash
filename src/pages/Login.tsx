import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Lock, Mail, LogIn, Car, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // If already logged in, redirect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigateByRole(session.user.id);
      }
    });
  }, []);

  const navigateByRole = async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
    if (data?.role === "station_owner") {
      navigate("/app/station-portal", { replace: true });
    } else if (data?.role === "admin") {
      navigate("/app/admin/dashboard", { replace: true });
    } else {
      navigate("/app", { replace: true });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        title: "فشل تسجيل الدخول",
        description: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-ocean-50 to-background p-4 relative" dir="rtl">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="absolute top-4 right-4 text-muted-foreground hover:text-ocean-500"
      >
        <ArrowRight className="h-4 w-4 ml-1" />
        الرئيسية
      </Button>

      <Card className="w-full max-w-md shadow-xl border-border">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-ocean-500 flex items-center justify-center shadow-lg shadow-ocean-500/30">
            <Car className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold font-cairo text-foreground">تسجيل الدخول</CardTitle>
          <p className="text-sm text-muted-foreground">أدخل بياناتك للوصول إلى لوحة التحكم</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="pr-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-ocean-500 hover:bg-ocean-600 text-white" disabled={loading}>
              <LogIn className="h-4 w-4 ml-2" />
              {loading ? "جاري الدخول..." : "دخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
