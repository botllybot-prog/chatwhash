import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Bot, Bell, MessageSquare, Link2, Eye, EyeOff, Save } from "lucide-react";

const ALL_KEYS = [
  "BOT_ENABLED", "BOT_WELCOME_MESSAGE", "BOT_UNKNOWN_MESSAGE",
  "BOT_CONFIRMATION_MESSAGE", "BOT_CANCELLATION_MESSAGE",
  "REMINDERS_ENABLED", "REMINDER_HOURS_BEFORE", "REMINDER_MESSAGE",
  "BOT_AFTER_HOURS_ENABLED", "BOT_AFTER_HOURS_MESSAGE",
  "BOT_FULLY_BOOKED_MESSAGE", "BOT_THANK_YOU_ENABLED", "BOT_THANK_YOU_MESSAGE",
  "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET",
];

const DEFAULTS: Record<string, string> = {
  BOT_ENABLED: "true",
  BOT_WELCOME_MESSAGE: "مرحباً بك في خدمة غسيل السيارات! 🚗✨\nاختر المحطة للبدء بالحجز.",
  BOT_UNKNOWN_MESSAGE: "عذراً، لم أفهم طلبك. أرسل 'مرحبا' للبدء من جديد.",
  BOT_CONFIRMATION_MESSAGE: "✅ تم تأكيد حجزك!\n📍 المحطة: {station}\n🔧 الخدمة: {service}\n📅 التاريخ: {date}\n🕐 الوقت: {time}\n📋 رقم الحجز: #{booking_number}",
  BOT_CANCELLATION_MESSAGE: "تم إلغاء حجزك رقم #{booking_number}. نتمنى خدمتك مستقبلاً!",
  REMINDERS_ENABLED: "true",
  REMINDER_HOURS_BEFORE: "1",
  REMINDER_MESSAGE: "تذكير: لديك حجز غسيل سيارة خلال ساعة.\n📍 المحطة: {station}\n🔧 الخدمة: {service}\n🕐 الوقت: {time}\n📋 رقم الحجز: #{booking_number}",
  BOT_AFTER_HOURS_ENABLED: "true",
  BOT_AFTER_HOURS_MESSAGE: "عذراً، المحطة مغلقة حالياً. ساعات العمل: {working_hours_start} - {working_hours_end}",
  BOT_FULLY_BOOKED_MESSAGE: "عذراً، جميع المواعيد محجوزة لهذا اليوم. يرجى اختيار يوم آخر.",
  BOT_THANK_YOU_ENABLED: "true",
  BOT_THANK_YOU_MESSAGE: "شكراً لاستخدامك خدمتنا! 🚗✨ نتمنى أن تكون الخدمة نالت رضاك.",
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
      if (data) for (const row of data as { key: string; value: string }[]) map[row.key] = row.value;
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
        (supabase as any).from("app_settings").upsert({ key: k, value: values[k] || "" }, { onConflict: "key" })
      );
      await Promise.all(upserts);
      toast({ title: "تم الحفظ بنجاح ✅" });
    } catch {
      toast({ title: "خطأ في الحفظ", variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) return <p className="text-muted-foreground text-center py-12">جاري التحميل...</p>;

  const webhookUrl = `https://yhklvtzonvgzkodysawu.supabase.co/functions/v1/whatsapp-webhook`;

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-xl font-bold text-foreground">الإعدادات</h2>

      {/* Bot Core */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />إعدادات البوت الأساسية</CardTitle>
          <CardDescription>تخصيص رسائل البوت الآلية والردود التلقائية</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>تفعيل البوت</Label>
            <Switch checked={values.BOT_ENABLED === "true"} onCheckedChange={() => toggle("BOT_ENABLED")} />
          </div>
          <div className="space-y-1">
            <Label>رسالة الترحيب</Label>
            <Textarea value={values.BOT_WELCOME_MESSAGE || ""} onChange={(e) => set("BOT_WELCOME_MESSAGE", e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <Label>رسالة عند عدم الفهم</Label>
            <Textarea value={values.BOT_UNKNOWN_MESSAGE || ""} onChange={(e) => set("BOT_UNKNOWN_MESSAGE", e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>رسالة تأكيد الحجز</Label>
            <Textarea value={values.BOT_CONFIRMATION_MESSAGE || ""} onChange={(e) => set("BOT_CONFIRMATION_MESSAGE", e.target.value)} rows={4} />
            <p className="text-xs text-muted-foreground">المتغيرات: {"{station}"} {"{service}"} {"{time}"} {"{date}"} {"{booking_number}"}</p>
          </div>
          <div className="space-y-1">
            <Label>رسالة إلغاء الحجز</Label>
            <Textarea value={values.BOT_CANCELLATION_MESSAGE || ""} onChange={(e) => set("BOT_CANCELLATION_MESSAGE", e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />إعدادات التذكير</CardTitle>
          <CardDescription>إرسال تذكير للعملاء قبل موعد الحجز</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>تفعيل التذكير</Label>
            <Switch checked={values.REMINDERS_ENABLED === "true"} onCheckedChange={() => toggle("REMINDERS_ENABLED")} />
          </div>
          <div className="space-y-1">
            <Label>وقت التذكير قبل الموعد</Label>
            <Select value={values.REMINDER_HOURS_BEFORE || "1"} onValueChange={(v) => set("REMINDER_HOURS_BEFORE", v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">قبل ساعة</SelectItem>
                <SelectItem value="2">قبل ساعتين</SelectItem>
                <SelectItem value="3">قبل 3 ساعات</SelectItem>
                <SelectItem value="24">قبل يوم</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>رسالة التذكير</Label>
            <Textarea value={values.REMINDER_MESSAGE || ""} onChange={(e) => set("REMINDER_MESSAGE", e.target.value)} rows={4} />
            <p className="text-xs text-muted-foreground">المتغيرات: {"{station}"} {"{service}"} {"{time}"} {"{date}"} {"{booking_number}"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Auto replies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />الردود التلقائية</CardTitle>
          <CardDescription>رسائل يتم إرسالها تلقائياً في حالات معينة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <Label>رسالة خارج ساعات العمل</Label>
              <Switch checked={values.BOT_AFTER_HOURS_ENABLED === "true"} onCheckedChange={() => toggle("BOT_AFTER_HOURS_ENABLED")} />
            </div>
            <Textarea value={values.BOT_AFTER_HOURS_MESSAGE || ""} onChange={(e) => set("BOT_AFTER_HOURS_MESSAGE", e.target.value)} rows={2} />
            <p className="text-xs text-muted-foreground">المتغيرات: {"{working_hours_start}"} {"{working_hours_end}"}</p>
          </div>

          <div className="space-y-3 p-4 rounded-lg border border-border">
            <Label>رسالة عند امتلاء المواعيد</Label>
            <Textarea value={values.BOT_FULLY_BOOKED_MESSAGE || ""} onChange={(e) => set("BOT_FULLY_BOOKED_MESSAGE", e.target.value)} rows={2} />
          </div>

          <div className="space-y-3 p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <Label>رسالة شكر بعد الحجز</Label>
              <Switch checked={values.BOT_THANK_YOU_ENABLED === "true"} onCheckedChange={() => toggle("BOT_THANK_YOU_ENABLED")} />
            </div>
            <Textarea value={values.BOT_THANK_YOU_MESSAGE || ""} onChange={(e) => set("BOT_THANK_YOU_MESSAGE", e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" />ربط واتساب API</CardTitle>
          <CardDescription>بيانات الاتصال من Meta for Developers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {[
            { key: "WHATSAPP_ACCESS_TOKEN", label: "Access Token", sensitive: true },
            { key: "WHATSAPP_PHONE_NUMBER_ID", label: "Phone Number ID", sensitive: false },
            { key: "WHATSAPP_VERIFY_TOKEN", label: "Verify Token", sensitive: false, readOnly: true },
            { key: "WHATSAPP_APP_SECRET", label: "App Secret", sensitive: true },
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
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(values[field.key]); toast({ title: "تم النسخ" }); }}>نسخ</Button>
                )}
              </div>
            </div>
          ))}

          <div className="space-y-2 pt-2">
            <Label>رابط الـ Webhook</Label>
            <div className="bg-muted rounded-md p-3 font-mono text-sm break-all text-foreground">{webhookUrl}</div>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: "تم نسخ الرابط" }); }}>نسخ الرابط</Button>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
        <Save className="h-4 w-4 ml-2" />
        {saving ? "جاري الحفظ..." : "حفظ جميع الإعدادات"}
      </Button>
    </div>
  );
};

export default AdminSettings;
