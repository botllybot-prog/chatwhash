import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { clearCustomerSession, getCustomerSession, setCustomerSession } from "@/lib/customerSession";

type LoginLookupResponse = {
  success?: boolean;
  requires_verification?: boolean;
  requires_name?: boolean;
  session_token?: string;
  expires_at?: string;
  customer_phone?: string;
  customer_name?: string;
  error?: string;
};

type SendCodeResponse = {
  success?: boolean;
  expires_at?: string;
  error?: string;
};

type VerifyCodeResponse = {
  success?: boolean;
  session_token?: string;
  expires_at?: string;
  customer_phone?: string;
  customer_name?: string;
  error?: string;
};

const normalizePhone = (phone: string) => {
  const western = phone
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const cleaned = western.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
};

const normalizeCode = (value: string) =>
  value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/\D/g, "")
    .trim();

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"entry" | "send" | "verify">("entry");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const existingSession = getCustomerSession();
    if (existingSession) {
      navigate("/map", { replace: true });
    }
  }, [navigate]);

  const requestCode = async (customerName: string, normalizedPhone: string) => {
    setCode("");
    setSending(true);
    const { data, error } = await supabase.functions.invoke<SendCodeResponse>("customer-send-login-code", {
      body: { customer_name: customerName.trim(), customer_phone: normalizedPhone },
    });
    setSending(false);

    if (error || data?.error) {
      toast({
        title: "تعذر إرسال الرمز",
        description: data?.error || error?.message,
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "تم إرسال الرمز",
      description: "تحقق من واتساب وأدخل رمز التحقق خلال 10 دقائق.",
    });
    setStep("verify");
    return true;
  };

  const startLogin = async () => {
    if (!phone.trim()) {
      toast({ title: "أدخل رقم الواتساب", variant: "destructive" });
      return;
    }

    const normalized = normalizePhone(phone);
    const existingSession = getCustomerSession();
    if (existingSession?.customerPhone === normalized) {
      navigate("/map", { replace: true });
      return;
    }

    setChecking(true);
    const { data, error } = await supabase.functions.invoke<LoginLookupResponse>("customer-login-by-phone", {
      body: { customer_phone: normalized },
    });
    setChecking(false);

    if (error || data?.error) {
      toast({
        title: "تعذر تسجيل الدخول",
        description: data?.error || error?.message,
        variant: "destructive",
      });
      return;
    }

    if (data?.session_token && data.customer_phone && data.expires_at) {
      setCustomerSession({
        customerName: data.customer_name || "Customer",
        customerPhone: data.customer_phone,
        sessionToken: data.session_token,
        expiresAt: data.expires_at,
      });
      navigate("/map", { replace: true });
      return;
    }

    const savedName = String(data?.customer_name || "").trim();
    if (data?.requires_name || !savedName) {
      setName(savedName);
      setStep("send");
      toast({
        title: "تفعيل الرقم",
        description: "اكتب الاسم ثم سنرسل رمز تحقق إلى نفس رقم الواتساب.",
      });
      return;
    }

    setName(savedName);
    await requestCode(savedName, normalized);
  };

  const sendCode = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({
        title: "أكمل البيانات",
        description: "اكتب الاسم ورقم الواتساب.",
        variant: "destructive",
      });
      return;
    }

    await requestCode(name.trim(), normalizePhone(phone));
  };

  const verifyCode = async () => {
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) {
      toast({ title: "أدخل الرمز", variant: "destructive" });
      return;
    }

    setVerifying(true);
    const normalized = normalizePhone(phone);
    const { data, error } = await supabase.functions.invoke<VerifyCodeResponse>("customer-verify-login-code", {
      body: { customer_phone: normalized, code: normalizedCode },
    });
    setVerifying(false);

    if (error || data?.error || !data?.session_token || !data?.customer_phone || !data?.expires_at) {
      toast({
        title: "رمز غير صحيح",
        description: data?.error || error?.message,
        variant: "destructive",
      });
      return;
    }

    setCustomerSession({
      customerName: data.customer_name || "Customer",
      customerPhone: data.customer_phone,
      sessionToken: data.session_token,
      expiresAt: data.expires_at,
    });
    navigate("/map", { replace: true });
  };

  const replacePhone = () => {
    clearCustomerSession();
    setStep("entry");
    setName("");
    setPhone("");
    setCode("");
    setChecking(false);
    setSending(false);
    setVerifying(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>دخول الزبون</CardTitle>
          <CardDescription>
            يتم إرسال رمز تحقق إلى واتساب قبل فتح حساب الزبون.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(step === "send" || step === "verify") && (
            <Input
              placeholder="الاسم"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={step === "verify"}
            />
          )}
          <Input
            placeholder="رقم الواتساب"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            dir="ltr"
            disabled={step === "verify"}
          />
          {step === "verify" && (
            <Input
              placeholder="رمز التحقق"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
            />
          )}

          {step === "entry" ? (
            <Button className="w-full" onClick={startLogin} disabled={checking || sending}>
              {checking || sending ? "جاري إرسال الرمز..." : "دخول برقم الواتساب"}
            </Button>
          ) : step === "send" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={replacePhone} disabled={sending}>
                استبدال الرقم
              </Button>
              <Button onClick={sendCode} disabled={sending}>
                {sending ? "جاري الإرسال..." : "إرسال رمز التحقق"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={replacePhone} disabled={verifying}>
                استبدال الرقم
              </Button>
              <Button onClick={verifyCode} disabled={verifying}>
                {verifying ? "جاري التحقق..." : "تفعيل الدخول"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
