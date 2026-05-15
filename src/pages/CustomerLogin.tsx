import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { setCustomerSession } from "@/lib/customerSession";

const normalizePhone = (phone: string) => {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
};

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"send" | "verify">("send");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendCode = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({ title: "أكمل البيانات", description: "اكتب الاسم ورقم الواتساب.", variant: "destructive" });
      return;
    }
    setSending(true);
    const normalized = normalizePhone(phone);
    const { data, error } = await supabase.functions.invoke("customer-send-login-code", {
      body: { customer_name: name.trim(), customer_phone: normalized },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast({ title: "تعذر إرسال الرمز", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إرسال الرمز", description: "تحقق من واتساب وأدخل الرمز." });
    setStep("verify");
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      toast({ title: "أدخل الرمز", variant: "destructive" });
      return;
    }
    setVerifying(true);
    const normalized = normalizePhone(phone);
    const { data, error } = await supabase.functions.invoke("customer-verify-login-code", {
      body: { customer_phone: normalized, code: code.trim() },
    });
    setVerifying(false);
    if (error || (data as any)?.error) {
      toast({ title: "رمز غير صحيح", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    setCustomerSession({
      customerName: (data as any).customer_name,
      customerPhone: (data as any).customer_phone,
      sessionToken: (data as any).session_token,
      expiresAt: (data as any).expires_at,
    });
    navigate("/map", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>دخول الزبون</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} disabled={step === "verify"} />
          <Input placeholder="رقم الواتساب" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" disabled={step === "verify"} />
          {step === "verify" && (
            <Input placeholder="رمز التحقق" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" />
          )}
          {step === "send" ? (
            <Button className="w-full" onClick={sendCode} disabled={sending}>
              {sending ? "جاري الإرسال..." : "إرسال رمز التحقق"}
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setStep("send")} disabled={verifying}>تغيير الرقم</Button>
              <Button onClick={verifyCode} disabled={verifying}>{verifying ? "جاري التحقق..." : "تفعيل الدخول"}</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
