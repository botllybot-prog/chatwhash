import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getCustomerSession, setCustomerSession } from "@/lib/customerSession";
import { OFFER_CITY_VALUES, adminOffersTexts } from "@/lib/adminOffersTranslations";

const CUSTOMER_CITY_VALUES = OFFER_CITY_VALUES.filter((city) => city !== "All");
const cityLabels = adminOffersTexts.ar.cities;

type CustomerLoginResponse = {
  success?: boolean;
  requires_name?: boolean;
  requires_city?: boolean;
  session_token?: string;
  expires_at?: string;
  customer_phone?: string;
  customer_name?: string;
  error?: string;
};

const PROFILE_HINT_KEY = "washlly_customer_profile_hint_v1";

const normalizePhone = (phone: string) => {
  const western = phone
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
  const cleaned = western.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
};

function loadProfileHint() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_HINT_KEY) || "{}") as {
      customerName?: string;
      customerPhone?: string;
      customerCity?: string;
    };
  } catch {
    return {};
  }
}

function saveProfileHint(customerName: string, customerPhone: string, customerCity: string) {
  localStorage.setItem(PROFILE_HINT_KEY, JSON.stringify({ customerName, customerPhone, customerCity }));
}

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const existingSession = getCustomerSession();
    if (existingSession) {
      navigate("/map", { replace: true });
      return;
    }

    const hint = loadProfileHint();
    setName(hint.customerName || "");
    setPhone(hint.customerPhone || "");
    setCity(hint.customerCity || "");
  }, [navigate]);

  const startLogin = async () => {
    const normalizedPhone = normalizePhone(phone);
    const trimmedName = name.trim();

    if (!normalizedPhone) {
      toast({ title: "أدخل رقم الهاتف", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke<CustomerLoginResponse>("customer-login-by-phone", {
      body: {
        customer_phone: normalizedPhone,
        customer_name: trimmedName || undefined,
        customer_city: city || undefined,
      },
    });
    setSubmitting(false);

    if (data?.requires_name) {
      toast({
        title: "أدخل الاسم",
        description: "هذا الرقم غير مسجل بعد. اكتب اسمك مرة واحدة ثم اضغط دخول.",
        variant: "destructive",
      });
      return;
    }

    if (data?.requires_city) {
      toast({
        title: "اختر مدينتك",
        description: "اختر مدينتك لعرض العروض المتاحة عندك، ثم اضغط دخول مرة أخرى.",
        variant: "destructive",
      });
      return;
    }

    if (error || data?.error || !data?.session_token || !data.customer_phone || !data.expires_at) {
      toast({
        title: "تعذر تسجيل الدخول",
        description: data?.error || error?.message || "حاول مرة أخرى.",
        variant: "destructive",
      });
      return;
    }

    const customerName = data.customer_name || trimmedName || "Customer";
    setCustomerSession(
      {
        customerName,
        customerPhone: data.customer_phone,
        sessionToken: data.session_token,
        expiresAt: data.expires_at,
      },
      { persist: remember },
    );
    saveProfileHint(customerName, data.customer_phone, city);
    navigate("/map", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>دخول الزبون</CardTitle>
          <CardDescription>
            الدخول مباشر بدون رمز تحقق. في أول مرة اكتب الاسم ورقم الهاتف، وبعدها يكفي رقم الهاتف فقط.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="الاسم"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
          <Input
            placeholder="رقم الهاتف"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
          />
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger>
              <SelectValue placeholder="اختر مدينتك" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_CITY_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {cityLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            حفظ الدخول على هذا الجهاز
          </label>

          <Button className="w-full" onClick={startLogin} disabled={submitting}>
            {submitting ? "جاري الدخول..." : "دخول مباشر"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
