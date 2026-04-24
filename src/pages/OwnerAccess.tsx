import { useEffect, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { normalizeOwnerPhone } from "@/lib/ownerAuth";
import {
  ArrowRight,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  Store,
  Trash2,
  UserRoundPlus,
  Wallet,
  Wrench,
} from "lucide-react";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const DEFAULT_CENTER = { lat: 33.3152, lng: 44.3661 };

type SchedulingType = "slots" | "instant" | "daily";

type ServiceDraft = {
  name: string;
  price: string;
  duration_minutes: string;
  customer_discount: string;
};

const emptyService = (): ServiceDraft => ({
  name: "",
  price: "",
  duration_minutes: "30",
  customer_discount: "",
});

const OwnerAccess = () => {
  const navigate = useNavigate();
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY });

  const [signupLoading, setSignupLoading] = useState(false);

  const [ownerName, setOwnerName] = useState("");
  const [ownerWhatsapp, setOwnerWhatsapp] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [stationName, setStationName] = useState("");
  const [stationAddress, setStationAddress] = useState("");
  const [detailedAddress, setDetailedAddress] = useState("");
  const [workingHoursStart, setWorkingHoursStart] = useState("08:00");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("22:00");
  const [schedulingType, setSchedulingType] = useState<SchedulingType>("slots");
  const [slotDuration, setSlotDuration] = useState("30");
  const [location, setLocation] = useState(DEFAULT_CENTER);
  const [services, setServices] = useState<ServiceDraft[]>([emptyService()]);

  const getUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    return data?.role || null;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const role = await getUserRole(session.user.id);
      if (role === "station_owner") {
        navigate("/app/station-portal", { replace: true });
      }
    });
  }, [navigate]);

  const addService = () => setServices((current) => [...current, emptyService()]);

  const removeService = (index: number) =>
    setServices((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));

  const updateService = (index: number, field: keyof ServiceDraft, value: string) => {
    setServices((current) =>
      current.map((service, i) => (i === index ? { ...service, [field]: value } : service)),
    );
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({ title: "المتصفح لا يدعم تحديد الموقع", variant: "destructive" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        toast({ title: "تم تحديد موقعك الحالي" });
      },
      () => {
        toast({ title: "تعذر تحديد الموقع", variant: "destructive" });
      },
    );
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!ownerName.trim() || !ownerWhatsapp.trim() || !password || !stationName.trim()) {
      toast({ title: "أكمل الحقول المطلوبة", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "كلمة المرور قصيرة", description: "يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }

    const validServices = services.filter((service) => service.name.trim() && Number(service.price) > 0);
    if (validServices.length === 0) {
      toast({ title: "أضف خدمة واحدة على الأقل", variant: "destructive" });
      return;
    }

    setSignupLoading(true);

    const payload = {
      owner_name: ownerName.trim(),
      owner_phone: normalizeOwnerPhone(ownerWhatsapp),
      email: ownerEmail.trim() || null,
      password,
      station: {
        name: stationName.trim(),
        address: stationAddress.trim(),
        detailed_address: detailedAddress.trim(),
        working_hours_start: workingHoursStart,
        working_hours_end: workingHoursEnd,
        scheduling_type: schedulingType,
        slot_duration_minutes: Number(slotDuration) || 30,
        latitude: location.lat,
        longitude: location.lng,
      },
      services: validServices.map((service, index) => ({
        name: service.name.trim(),
        price: Number(service.price),
        duration_minutes: Number(service.duration_minutes) || 30,
        customer_discount: service.customer_discount.trim() || null,
        sort_order: index,
      })),
    };

    const { data, error } = await supabase.functions.invoke("owner-self-register", {
      body: payload,
    });

    if (error || data?.error) {
      setSignupLoading(false);
      toast({
        title: "فشل إنشاء الحساب",
        description: data?.error || error?.message,
        variant: "destructive",
      });
      return;
    }

    const authEmail = buildOwnerEmail(ownerWhatsapp, ownerEmail);
    const loginResult = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    setSignupLoading(false);

    if (loginResult.error || !loginResult.data.user) {
      toast({
        title: "تم إنشاء الحساب",
        description: "لكن تعذر تسجيل الدخول مباشرة. استخدم واتسابك أو بريدك الإلكتروني لتسجيل الدخول.",
      });
      return;
    }

    toast({ title: "تم إنشاء الحساب والدخول بنجاح" });
    navigate("/app/station-portal", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean-50 via-background to-background p-4 md:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">بوابة أصحاب المحطات</Badge>
            <h1 className="text-3xl font-black text-foreground">سجل محطتك في صفحة واحدة</h1>
            <p className="text-muted-foreground mt-2">
              أنشئ الحساب، أضف بيانات المحطة، وحدد خدماتك وأسعارك وخصومات العملاء ثم ادخل مباشرة.
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowRight className="h-4 w-4 ml-1" />
            الرئيسية
          </Button>
        </div>

        <Tabs defaultValue="signup" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="signup">إنشاء حساب محطة</TabsTrigger>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all"
            >
              دخول المالك
            </button>
          </TabsList>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} autoComplete="off" className="grid lg:grid-cols-[1.1fr,0.9fr] gap-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserRoundPlus className="h-5 w-5 text-primary" />
                      الحساب
                    </CardTitle>
                    <CardDescription>رقم الواتساب سيكون هو معرف الدخول الأساسي. البريد الإلكتروني اختياري.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>اسم المالك</Label>
                      <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="أحمد محمد" autoComplete="name" />
                    </div>
                    <div className="space-y-2">
                      <Label>رقم الواتساب</Label>
                      <Input dir="ltr" value={ownerWhatsapp} onChange={(e) => setOwnerWhatsapp(e.target.value)} placeholder="0770xxxxxxx" autoComplete="tel" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>البريد الإلكتروني (اختياري)</Label>
                      <Input dir="ltr" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@example.com" autoComplete="off" />
                    </div>
                    <div className="space-y-2">
                      <Label>كلمة المرور</Label>
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" autoComplete="new-password" />
                    </div>
                    <div className="space-y-2">
                      <Label>تأكيد كلمة المرور</Label>
                      <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="أعد كتابة كلمة المرور" autoComplete="new-password" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-primary" />
                      بيانات المحطة
                    </CardTitle>
                    <CardDescription>أدخل اسم المحطة والعنوان وساعات العمل وموقعها على الخريطة.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>اسم المحطة</Label>
                        <Input value={stationName} onChange={(e) => setStationName(e.target.value)} placeholder="محطة عينكاوة" />
                      </div>
                      <div className="space-y-2">
                        <Label>العنوان المختصر</Label>
                        <Input value={stationAddress} onChange={(e) => setStationAddress(e.target.value)} placeholder="عينكاوة، أربيل" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>العنوان التفصيلي</Label>
                      <Textarea value={detailedAddress} onChange={(e) => setDetailedAddress(e.target.value)} placeholder="الشارع، المعلم القريب، تفاصيل الوصول..." rows={3} />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>وقت الفتح</Label>
                        <Input type="time" value={workingHoursStart} onChange={(e) => setWorkingHoursStart(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>وقت الغلق</Label>
                        <Input type="time" value={workingHoursEnd} onChange={(e) => setWorkingHoursEnd(e.target.value)} />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>نوع المواعيد</Label>
                        <Select value={schedulingType} onValueChange={(value: SchedulingType) => setSchedulingType(value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slots">فترات زمنية ثابتة</SelectItem>
                            <SelectItem value="instant">حجز فوري</SelectItem>
                            <SelectItem value="daily">اختيار اليوم فقط</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {schedulingType === "slots" && (
                        <div className="space-y-2">
                          <Label>مدة الفتحة بالدقائق</Label>
                          <Input type="number" value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          موقع المحطة
                        </Label>
                        <Button type="button" variant="outline" size="sm" onClick={handleLocateMe}>
                          <LocateFixed className="h-4 w-4 ml-1" />
                          موقعي الحالي
                        </Button>
                      </div>
                      <div className="h-72 rounded-2xl overflow-hidden border">
                        {isLoaded ? (
                          <GoogleMap
                            mapContainerStyle={{ width: "100%", height: "100%" }}
                            center={location}
                            zoom={12}
                            onClick={(event) => {
                              if (!event.latLng) return;
                              setLocation({ lat: event.latLng.lat(), lng: event.latLng.lng() });
                            }}
                            options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                          >
                            <Marker
                              position={location}
                              draggable
                              onDragEnd={(event) => {
                                if (!event.latLng) return;
                                setLocation({ lat: event.latLng.lat(), lng: event.latLng.lng() });
                              }}
                            />
                          </GoogleMap>
                        ) : (
                          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                            جاري تحميل الخريطة...
                          </div>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>خط العرض</Label>
                          <Input type="number" step="any" value={location.lat} onChange={(e) => setLocation((current) => ({ ...current, lat: Number(e.target.value) || current.lat }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>خط الطول</Label>
                          <Input type="number" step="any" value={location.lng} onChange={(e) => setLocation((current) => ({ ...current, lng: Number(e.target.value) || current.lng }))} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-primary" />
                      الخدمات
                    </CardTitle>
                    <CardDescription>أضف خدمات المحطة مع السعر والمدة والخصم الظاهر للعميل.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {services.map((service, index) => (
                      <div key={index} className="rounded-2xl border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">الخدمة #{index + 1}</div>
                          {services.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>اسم الخدمة</Label>
                          <Input value={service.name} onChange={(e) => updateService(index, "name", e.target.value)} placeholder="غسل سطحي" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>السعر</Label>
                            <Input type="number" value={service.price} onChange={(e) => updateService(index, "price", e.target.value)} placeholder="10000" />
                          </div>
                          <div className="space-y-2">
                            <Label>المدة</Label>
                            <Input type="number" value={service.duration_minutes} onChange={(e) => updateService(index, "duration_minutes", e.target.value)} placeholder="30" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-primary" />
                            الخصم الظاهر للعميل
                          </Label>
                          <Input value={service.customer_discount} onChange={(e) => updateService(index, "customer_discount", e.target.value)} placeholder="مثال: خصم 20% أو 5000 د.ع" />
                        </div>
                      </div>
                    ))}

                    <Button type="button" variant="outline" className="w-full" onClick={addService}>
                      <Plus className="h-4 w-4 ml-1" />
                      إضافة خدمة أخرى
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div className="rounded-2xl bg-ocean-50 border border-ocean-100 p-4 text-sm text-ocean-900">
                      بعد الإنشاء سيتم:
                      <ul className="mt-2 space-y-1 list-disc pr-4">
                        <li>إنشاء حساب المالك</li>
                        <li>إنشاء المحطة وربطها بالمالك</li>
                        <li>إضافة الخدمات والأسعار والخصومات</li>
                        <li>تسجيل الدخول مباشرة إلى لوحة المحطة</li>
                      </ul>
                    </div>
                    <Button type="submit" className="w-full h-12" disabled={signupLoading}>
                      {signupLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          جاري إنشاء الحساب...
                        </>
                      ) : (
                        <>
                          <UserRoundPlus className="h-4 w-4 ml-2" />
                          إنشاء الحساب والدخول مباشرة
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </form>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

export default OwnerAccess;
