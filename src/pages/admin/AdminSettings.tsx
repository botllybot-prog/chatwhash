import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Bot, Bell, MessageSquare, Link2, Eye, EyeOff, Save, ShieldCheck, Wallet } from "lucide-react";

const ALL_KEYS = [
  "BOT_ENABLED",
  "BOT_WELCOME_MESSAGE",
  "BOT_UNKNOWN_MESSAGE",
  "BOT_CONFIRMATION_MESSAGE",
  "BOT_CANCELLATION_MESSAGE",
  "REMINDERS_ENABLED",
  "REMINDER_HOURS_BEFORE",
  "REMINDER_MESSAGE",
  "BOT_AFTER_HOURS_ENABLED",
  "BOT_AFTER_HOURS_MESSAGE",
  "BOT_FULLY_BOOKED_MESSAGE",
  "BOT_THANK_YOU_ENABLED",
  "BOT_THANK_YOU_MESSAGE",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
  "ADMIN_WHATSAPP_PHONE",
  "ADMIN_TELEGRAM_CHAT_ID",
  "PAYMENT_ZAIN_CASH",
  "PAYMENT_SUPER_KEY",
  "PAYMENT_NAS_WALLET",
  "PAYMENT_CARD_URL",
  "PUBLIC_CONTACT_WHATSAPP",
  "PUBLIC_CONTACT_EMAIL",
];

const DEFAULTS: Record<string, string> = {
  BOT_ENABLED: "true",
  BOT_WELCOME_MESSAGE: "مرحباً بك في خدمة غسيل السيارات! 🚗✨\nاختر الخدمة التي تحتاجها.",
  BOT_UNKNOWN_MESSAGE: "عذراً، لم أفهم طلبك. أرسل 'ابدأ' للبدء من جديد.",
  BOT_CONFIRMATION_MESSAGE:
    "✅ تم تأكيد حجزك!\n📍 المحطة: {station}\n🔧 الخدمة: {service}\n📅 التاريخ: {date}\n🕐 الوقت: {time}\n📋 رقم الحجز: #{booking_number}",
  BOT_CANCELLATION_MESSAGE: "تم إلغاء الحجز رقم #{booking_number}. شكراً لتفهمك.",
  REMINDERS_ENABLED: "true",
  REMINDER_HOURS_BEFORE: "1",
  REMINDER_MESSAGE:
    "تذكير: لديك موعد حجز قريب.\n📍 المحطة: {station}\n🔧 الخدمة: {service}\n🕐 الوقت: {time}\n📋 رقم الحجز: #{booking_number}",
  BOT_AFTER_HOURS_ENABLED: "true",
  BOT_AFTER_HOURS_MESSAGE: "عذراً، المحطة مغلقة حالياً. ساعات العمل: {working_hours_start} - {working_hours_end}",
  BOT_FULLY_BOOKED_MESSAGE: "عذراً، لا توجد مواعيد متاحة اليوم. يرجى اختيار يوم آخر.",
  BOT_THANK_YOU_ENABLED: "true",
  BOT_THANK_YOU_MESSAGE: "شكراً لاستخدامك خدمتنا! نتمنى لك تجربة رائعة.",
  PUBLIC_CONTACT_WHATSAPP: "+9647736939153",
  PUBLIC_CONTACT_EMAIL: "info@washlly.com",
  PAYMENT_CARD_URL: "",
};

const t = {
  pageTitle: "الإعدادات",
  loading: "جاري التحميل...",
  saveSuccess: "تم الحفظ بنجاح",
  saveError: "حدث خطأ أثناء الحفظ",
  saveAll: "حفظ جميع الإعدادات",
  saving: "جاري الحفظ...",
  botCoreTitle: "إعدادات البوت الأساسية",
  botCoreDesc: "تخصيص رسائل البوت والردود التلقائية الأساسية",
  botEnabled: "تفعيل البوت",
  welcome: "رسالة الترحيب",
  unknown: "رسالة الطلب غير المفهوم",
  confirmation: "رسالة تأكيد الحجز",
  cancelMsg: "رسالة إلغاء الحجز",
  variablesBooking: "المتغيرات المتاحة: {station} {service} {time} {date} {booking_number}",
  remindersTitle: "إعدادات التذكير",
  remindersDesc: "إرسال تذكير للعميل قبل موعد الحجز",
  remindersEnabled: "تفعيل التذكيرات",
  reminderBefore: "وقت التذكير قبل الحجز",
  reminderMsg: "رسالة التذكير",
  oneHour: "قبل ساعة",
  twoHours: "قبل ساعتين",
  threeHours: "قبل 3 ساعات",
  oneDay: "قبل يوم",
  autoRepliesTitle: "الردود التلقائية",
  autoRepliesDesc: "رسائل يتم إرسالها تلقائياً في حالات محددة",
  afterHours: "رسالة خارج وقت العمل",
  afterHoursMsg: "المتغيرات المتاحة: {working_hours_start} {working_hours_end}",
  fullBooked: "رسالة امتلاء المواعيد",
  thankYou: "رسالة الشكر بعد الحجز",
  adminNotifyTitle: "تنبيهات الإدارة",
  adminNotifyDesc: "استلام نسخة من كل الحجوزات الجديدة على هاتف الإدارة",
  adminWhatsapp: "رقم واتساب الإدارة مع رمز الدولة",
  adminWhatsappHint: "سيتم إرسال إشعار لكل حجز جديد إلى هذا الرقم",
  adminTelegram: "معرف تيليجرام للإدارة",
  adminTelegramHint: "سيتم إرسال إشعار لكل حجز جديد إلى هذا المعرف",
  whatsappApiTitle: "ربط WhatsApp API",
  whatsappApiDesc: "بيانات الربط القادمة من Meta for Developers",
  accessToken: "Access Token",
  phoneNumberId: "Phone Number ID",
  verifyToken: "Verify Token",
  appSecret: "App Secret",
  copy: "نسخ",
  copied: "تم النسخ",
  webhook: "رابط Webhook",
  webhookCopied: "تم نسخ رابط Webhook",
  paymentsTitle: "حسابات الدفع",
  paymentsDesc: "هذه الحسابات تظهر لصاحب المحطة عند إيقاف الحساب بشكل مؤقت",
  zainCash: "زين كاش - رقم الحساب",
  superKey: "سوبر كي - رقم الحساب",
  nasWallet: "ناس والِت - رقم الحساب",
  cardUrl: "رابط الدفع بالبطاقة",
  paymentHint: "تظهر هذه الحسابات لصاحب المحطة عندما يكون حسابه موقوفاً مؤقتاً.",
  cardUrlHint: "يمكنك إضافة رابط دفع مباشر بالبطاقة ليظهر ضمن خيارات الاشتراك لصاحب المحطة.",
  publicContactTitle: "بيانات التواصل في الواجهة الرئيسية",
  publicContactDesc: "يمكنك تعديل رقم واتساب والإيميل الظاهرين في أسفل الصفحة الرئيسية.",
  publicWhatsapp: "رقم واتساب الظاهر في الفوتر",
  publicEmail: "الإيميل الظاهر في الفوتر",
};

const AdminSettings = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any).from("app_settings").select("key, value");
      const map: Record<string, string> = { ...DEFAULTS };
      if (data) {
        for (const row of data as { key: string; value: string }[]) map[row.key] = row.value;
      }
      setValues(map);
      setLoading(false);
    };
    load();
  }, []);

  const set = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));
  const toggle = (key: string) => set(key, values[key] === "true" ? "false" : "true");

  const handleSave = async () => {
    setSaving(true);
    try {
      const upserts = ALL_KEYS.filter((k) => values[k] !== undefined).map((k) =>
        (supabase as any).from("app_settings").upsert({ key: k, value: values[k] || "" }, { onConflict: "key" }),
      );
      await Promise.all(upserts);
      toast({ title: t.saveSuccess });
    } catch {
      toast({ title: t.saveError, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) return <p className="py-12 text-center text-muted-foreground">{t.loading}</p>;

  const webhookUrl = `https://yhklvtzonvgzkodysawu.supabase.co/functions/v1/whatsapp-webhook`;

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-bold text-foreground">{t.pageTitle}</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            {t.botCoreTitle}
          </CardTitle>
          <CardDescription>{t.botCoreDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>{t.botEnabled}</Label>
            <Switch checked={values.BOT_ENABLED === "true"} onCheckedChange={() => toggle("BOT_ENABLED")} />
          </div>
          <div className="space-y-1">
            <Label>{t.welcome}</Label>
            <Textarea value={values.BOT_WELCOME_MESSAGE || ""} onChange={(e) => set("BOT_WELCOME_MESSAGE", e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <Label>{t.unknown}</Label>
            <Textarea value={values.BOT_UNKNOWN_MESSAGE || ""} onChange={(e) => set("BOT_UNKNOWN_MESSAGE", e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>{t.confirmation}</Label>
            <Textarea value={values.BOT_CONFIRMATION_MESSAGE || ""} onChange={(e) => set("BOT_CONFIRMATION_MESSAGE", e.target.value)} rows={4} />
            <p className="text-xs text-muted-foreground">{t.variablesBooking}</p>
          </div>
          <div className="space-y-1">
            <Label>{t.cancelMsg}</Label>
            <Textarea value={values.BOT_CANCELLATION_MESSAGE || ""} onChange={(e) => set("BOT_CANCELLATION_MESSAGE", e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {t.remindersTitle}
          </CardTitle>
          <CardDescription>{t.remindersDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>{t.remindersEnabled}</Label>
            <Switch checked={values.REMINDERS_ENABLED === "true"} onCheckedChange={() => toggle("REMINDERS_ENABLED")} />
          </div>
          <div className="space-y-1">
            <Label>{t.reminderBefore}</Label>
            <Select value={values.REMINDER_HOURS_BEFORE || "1"} onValueChange={(v) => set("REMINDER_HOURS_BEFORE", v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t.oneHour}</SelectItem>
                <SelectItem value="2">{t.twoHours}</SelectItem>
                <SelectItem value="3">{t.threeHours}</SelectItem>
                <SelectItem value="24">{t.oneDay}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t.reminderMsg}</Label>
            <Textarea value={values.REMINDER_MESSAGE || ""} onChange={(e) => set("REMINDER_MESSAGE", e.target.value)} rows={4} />
            <p className="text-xs text-muted-foreground">{t.variablesBooking}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {t.autoRepliesTitle}
          </CardTitle>
          <CardDescription>{t.autoRepliesDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <Label>{t.afterHours}</Label>
              <Switch checked={values.BOT_AFTER_HOURS_ENABLED === "true"} onCheckedChange={() => toggle("BOT_AFTER_HOURS_ENABLED")} />
            </div>
            <Textarea value={values.BOT_AFTER_HOURS_MESSAGE || ""} onChange={(e) => set("BOT_AFTER_HOURS_MESSAGE", e.target.value)} rows={2} />
            <p className="text-xs text-muted-foreground">{t.afterHoursMsg}</p>
          </div>
          <div className="space-y-3 rounded-lg border border-border p-4">
            <Label>{t.fullBooked}</Label>
            <Textarea value={values.BOT_FULLY_BOOKED_MESSAGE || ""} onChange={(e) => set("BOT_FULLY_BOOKED_MESSAGE", e.target.value)} rows={2} />
          </div>
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <Label>{t.thankYou}</Label>
              <Switch checked={values.BOT_THANK_YOU_ENABLED === "true"} onCheckedChange={() => toggle("BOT_THANK_YOU_ENABLED")} />
            </div>
            <Textarea value={values.BOT_THANK_YOU_MESSAGE || ""} onChange={(e) => set("BOT_THANK_YOU_MESSAGE", e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t.adminNotifyTitle}
          </CardTitle>
          <CardDescription>{t.adminNotifyDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1">
            <Label>{t.adminWhatsapp}</Label>
            <Input value={values.ADMIN_WHATSAPP_PHONE || ""} onChange={(e) => set("ADMIN_WHATSAPP_PHONE", e.target.value)} placeholder="964750XXXXXXX" dir="ltr" />
            <p className="text-xs text-muted-foreground">{t.adminWhatsappHint}</p>
          </div>
          <div className="space-y-1">
            <Label>{t.adminTelegram}</Label>
            <Input value={values.ADMIN_TELEGRAM_CHAT_ID || ""} onChange={(e) => set("ADMIN_TELEGRAM_CHAT_ID", e.target.value)} placeholder="123456789" dir="ltr" />
            <p className="text-xs text-muted-foreground">{t.adminTelegramHint}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {t.whatsappApiTitle}
          </CardTitle>
          <CardDescription>{t.whatsappApiDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {[
            { key: "WHATSAPP_ACCESS_TOKEN", label: t.accessToken, sensitive: true },
            { key: "WHATSAPP_PHONE_NUMBER_ID", label: t.phoneNumberId, sensitive: false },
            { key: "WHATSAPP_VERIFY_TOKEN", label: t.verifyToken, sensitive: false, readOnly: true },
            { key: "WHATSAPP_APP_SECRET", label: t.appSecret, sensitive: true },
          ].map((field) => (
            <div key={field.key} className="space-y-1">
              <Label>{field.label}</Label>
              <div className="relative flex gap-2">
                <Input
                  type={field.sensitive && !showSecret[field.key] ? "password" : "text"}
                  value={values[field.key] || ""}
                  onChange={(e) => !field.readOnly && set(field.key, e.target.value)}
                  readOnly={field.readOnly}
                  className={field.readOnly ? "bg-muted" : ""}
                />
                {field.sensitive && (
                  <button
                    type="button"
                    onClick={() => setShowSecret((s) => ({ ...s, [field.key]: !s[field.key] }))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
                {field.readOnly && values[field.key] && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(values[field.key]);
                      toast({ title: t.copied });
                    }}
                  >
                    {t.copy}
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div className="space-y-2 pt-2">
            <Label>{t.webhook}</Label>
            <div className="break-all rounded-md bg-muted p-3 font-mono text-sm text-foreground">{webhookUrl}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                toast({ title: t.webhookCopied });
              }}
            >
              {t.copy}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {t.paymentsTitle}
          </CardTitle>
          <CardDescription>{t.paymentsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
              {t.zainCash}
            </Label>
            <Input value={values.PAYMENT_ZAIN_CASH || ""} onChange={(e) => set("PAYMENT_ZAIN_CASH", e.target.value)} placeholder="07XXXXXXXXX" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
              {t.superKey}
            </Label>
            <Input value={values.PAYMENT_SUPER_KEY || ""} onChange={(e) => set("PAYMENT_SUPER_KEY", e.target.value)} placeholder="07XXXXXXXXX" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-orange-500" />
              {t.nasWallet}
            </Label>
            <Input value={values.PAYMENT_NAS_WALLET || ""} onChange={(e) => set("PAYMENT_NAS_WALLET", e.target.value)} placeholder="07XXXXXXXXX" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.cardUrl}</Label>
            <Input value={values.PAYMENT_CARD_URL || ""} onChange={(e) => set("PAYMENT_CARD_URL", e.target.value)} placeholder="https://..." dir="ltr" />
            <p className="text-xs text-muted-foreground">{t.cardUrlHint}</p>
          </div>
          <p className="pt-1 text-xs text-muted-foreground">{t.paymentHint}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {t.publicContactTitle}
          </CardTitle>
          <CardDescription>{t.publicContactDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{t.publicWhatsapp}</Label>
            <Input value={values.PUBLIC_CONTACT_WHATSAPP || ""} onChange={(e) => set("PUBLIC_CONTACT_WHATSAPP", e.target.value)} placeholder="+9647736939153" dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label>{t.publicEmail}</Label>
            <Input value={values.PUBLIC_CONTACT_EMAIL || ""} onChange={(e) => set("PUBLIC_CONTACT_EMAIL", e.target.value)} placeholder="info@washlly.com" dir="ltr" />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
        <Save className="ml-2 h-4 w-4" />
        {saving ? t.saving : t.saveAll}
      </Button>
    </div>
  );
};

export default AdminSettings;
