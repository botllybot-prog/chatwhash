import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Settings as SettingsIcon, Eye, EyeOff, Save, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SETTINGS_KEYS = [
  {
    key: "WHATSAPP_ACCESS_TOKEN",
    label: "Access Token",
    description: "من Meta for Developers → إعدادات التطبيق",
    sensitive: true,
  },
  {
    key: "WHATSAPP_PHONE_NUMBER_ID",
    label: "Phone Number ID",
    description: "معرّف رقم الهاتف من إعدادات WhatsApp Business",
    sensitive: false,
  },
  {
    key: "WHATSAPP_VERIFY_TOKEN",
    label: "Verify Token (تم إنشاؤه تلقائياً)",
    description: "رمز التحقق - انسخه وأضفه في إعدادات Webhook بـ Meta",
    sensitive: false,
    readOnly: true,
  },
  {
    key: "WHATSAPP_APP_SECRET",
    label: "App Secret",
    description: "من Meta for Developers → إعدادات التطبيق → App Secret",
    sensitive: true,
  },
];

interface SettingConfig {
  key: string;
  label: string;
  description: string;
  sensitive: boolean;
  readOnly?: boolean;
}

interface AppSetting {
  id: string;
  key: string;
  value: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("app_settings").select("key, value");
    if (data) {
      const map: Record<string, string> = {};
      for (const row of data as AppSetting[]) {
        map[row.key] = row.value;
      }
      setValues(map);
    }
    if (error) console.error("Error loading settings:", error);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const setting of SETTINGS_KEYS) {
        const val = values[setting.key] || "";
        if (!val.trim()) continue;

        const { data: existing } = await (supabase as any)
          .from("app_settings")
          .select("id")
          .eq("key", setting.key)
          .maybeSingle();

        if (existing) {
          await (supabase as any)
            .from("app_settings")
            .update({ value: val.trim(), updated_at: new Date().toISOString() })
            .eq("key", setting.key);
        } else {
          await (supabase as any)
            .from("app_settings")
            .insert({ key: setting.key, value: val.trim() });
        }
      }
      toast({ title: "تم الحفظ", description: "تم حفظ الإعدادات بنجاح" });
    } catch (e) {
      console.error(e);
      toast({ title: "خطأ", description: "فشل في حفظ الإعدادات", variant: "destructive" });
    }
    setSaving(false);
  };

  const webhookUrl = `https://snnajdsrvufjynzblkmd.supabase.co/functions/v1/whatsapp-webhook`;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">إعدادات WhatsApp</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/conversations")}>
            المحادثات
            <ArrowRight className="h-4 w-4 mr-2" />
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">مفاتيح WhatsApp Business API</CardTitle>
            <CardDescription>
              أدخل بيانات الاتصال من حساب Meta for Developers لتفعيل إرسال واستقبال الرسائل
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <p className="text-muted-foreground text-center py-8">جاري التحميل...</p>
            ) : (
              <>
                {SETTINGS_KEYS.map((setting) => (
                  <div key={setting.key} className="space-y-2">
                    <Label htmlFor={setting.key} className="text-sm font-medium">
                      {setting.label}
                    </Label>
                    <div className="relative flex gap-2">
                      <Input
                        id={setting.key}
                        type={setting.sensitive && !showValues[setting.key] ? "password" : "text"}
                        value={values[setting.key] || ""}
                        onChange={(e) => !setting.readOnly && setValues({ ...values, [setting.key]: e.target.value })}
                        placeholder={setting.description}
                        className={cn("pl-10", setting.readOnly && "bg-muted")}
                        readOnly={setting.readOnly}
                      />
                      {setting.sensitive && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowValues({ ...showValues, [setting.key]: !showValues[setting.key] })
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showValues[setting.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                      {setting.readOnly && values[setting.key] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(values[setting.key]);
                            toast({ title: "تم النسخ" });
                          }}
                        >
                          نسخ
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                  </div>
                ))}

                <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
                  <Save className="h-4 w-4 ml-2" />
                  {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">رابط الـ Webhook</CardTitle>
            <CardDescription>
              انسخ هذا الرابط وأضفه في إعدادات Webhook بـ Meta for Developers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-md p-3 font-mono text-sm break-all text-foreground">
              {webhookUrl}
            </div>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                toast({ title: "تم النسخ", description: "تم نسخ رابط الـ Webhook" });
              }}
            >
              نسخ الرابط
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
