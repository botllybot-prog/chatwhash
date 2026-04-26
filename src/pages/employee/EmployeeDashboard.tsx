import { useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
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
  Gift,
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

const texts = {
  title: "لوحة الموظف",
  subtitle: "أنشئ حساب صاحب المحطة، وأضف المحطة والخدمات وعدد الطلبات المجانية من صفحة واحدة.",
  account: "بيانات صاحب المحطة",
  accountDesc: "يمكن للموظف إدخال بيانات الحساب الأولية مباشرة لصاحب المحطة.",
  ownerName: "اسم المالك",
  ownerWhatsapp: "رقم الواتساب",
  email: "البريد الإلكتروني (اختياري)",
  password: "كلمة المرور",
  confirmPassword: "تأكيد كلمة المرور",
  stationDetails: "بيانات المحطة",
  stationDetailsDesc: "أدخل اسم المحطة والعنوان وساعات العمل وموقعها على الخريطة.",
  stationName: "اسم المحطة",
  shortAddress: "العنوان المختصر",
  detailedAddress: "العنوان التفصيلي",
  openingTime: "وقت الفتح",
  closingTime: "وقت الغلق",
  schedulingType: "نوع المواعيد",
  slotDuration: "مدة الفتحة بالدقائق",
  slots: "فترات زمنية ثابتة",
  instant: "حجز فوري",
  daily: "اختيار اليوم فقط",
  stationLocation: "موقع المحطة",
  currentLocation: "موقعي الحالي",
  latitude: "خط العرض",
  longitude: "خط الطول",
  loadingMap: "جاري تحميل الخريطة...",
  services: "الخدمات",
  servicesDesc: "أضف خدمات المحطة مع السعر والمدة والخصم الظاهر للعميل.",
  serviceNumber: "الخدمة #",
  serviceName: "اسم الخدمة",
  price: "السعر",
  duration: "المدة",
  customerDiscount: "الخصم الظاهر للعميل",
  addService: "إضافة خدمة أخرى",
  freeQuota: "الطلبات المجانية الممنوحة",
  freeQuotaDesc: "هذا الرقم يُحفظ على الحساب ويحدد عدد الطلبات المجانية قبل الانتقال إلى الاشتراك.",
  createSummary: "بعد الحفظ سيتم:",
  summaryItems: [
    "إنشاء حساب صاحب المحطة",
    "إنشاء المحطة وربطها بالحساب",
    "إضافة الخدمات والأسعار والخصومات",
    "حفظ عدد الطلبات المجانية على الحساب ليراه الأدمن لاحقاً",
  ],
  submit: "إنشاء الحساب والمحطة",
  submitting: "جاري الإنشاء...",
  fillRequired: "أكمل الحقول المطلوبة",
  passwordShort: "كلمة المرور قصيرة",
  passwordShortDesc: "يجب أن تكون 6 أحرف على الأقل",
  passwordsMismatch: "كلمتا المرور غير متطابقتين",
  addOneService: "أضف خدمة واحدة على الأقل",
  success: "تم إنشاء الحساب والمحطة بنجاح",
  failed: "فشل إنشاء الحساب أو المحطة",
  browserNoLocation: "المتصفح لا يدعم تحديد الموقع",
  locateFailed: "تعذر تحديد الموقع",
  located: "تم تحديد موقعك الحالي",
  placeholders: {
    ownerName: "أحمد محمد",
    whatsapp: "0770xxxxxxx",
    email: "owner@example.com",
    password: "6 أحرف على الأقل",
    confirmPassword: "أعد كتابة كلمة المرور",
    stationName: "محطة عينكاوة",
    shortAddress: "عينكاوة، أربيل",
    detailedAddress: "الشارع، المعلم القريب، تفاصيل الوصول...",
    serviceName: "غسل سطحي",
    price: "10000",
    discount: "مثال: خصم 20% أو 5000 د.ع",
  },
} as const;

const EmployeeDashboard = () => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY });
  const [saving, setSaving] = useState(false);
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
  const [freeRequestsQuota, setFreeRequestsQuota] = useState("0");
  const [location, setLocation] = useState(DEFAULT_CENTER);
  const [services, setServices] = useState<ServiceDraft[]>([emptyService()]);

  const addService = () => setServices((current) => [...current, emptyService()]);
  const removeService = (index: number) =>
    setServices((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  const updateService = (index: number, field: keyof ServiceDraft, value: string) => {
    setServices((current) => current.map((service, i) => (i === index ? { ...service, [field]: value } : service)));
  };

  const resetForm = () => {
    setOwnerName("");
    setOwnerWhatsapp("");
    setOwnerEmail("");
    setPassword("");
    setConfirmPassword("");
    setStationName("");
    setStationAddress("");
    setDetailedAddress("");
    setWorkingHoursStart("08:00");
    setWorkingHoursEnd("22:00");
    setSchedulingType("slots");
    setSlotDuration("30");
    setFreeRequestsQuota("0");
    setLocation(DEFAULT_CENTER);
    setServices([emptyService()]);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({ title: texts.browserNoLocation, variant: "destructive" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        toast({ title: texts.located });
      },
      () => toast({ title: texts.locateFailed, variant: "destructive" }),
    );
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!ownerName.trim() || !ownerWhatsapp.trim() || !password || !stationName.trim()) {
      toast({ title: texts.fillRequired, variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: texts.passwordShort, description: texts.passwordShortDesc, variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: texts.passwordsMismatch, variant: "destructive" });
      return;
    }

    const validServices = services.filter((service) => service.name.trim() && Number(service.price) > 0);
    if (validServices.length === 0) {
      toast({ title: texts.addOneService, variant: "destructive" });
      return;
    }

    setSaving(true);

    const payload = {
      owner_name: ownerName.trim(),
      owner_phone: normalizeOwnerPhone(ownerWhatsapp),
      email: ownerEmail.trim() || null,
      password,
      free_requests_quota: Math.max(0, Number(freeRequestsQuota) || 0),
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

    setSaving(false);

    if (error || data?.error) {
      toast({
        title: texts.failed,
        description: data?.error || error?.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: texts.success });
    resetForm();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <Badge variant="secondary" className="mb-3">بوابة الموظف</Badge>
        <h1 className="text-3xl font-black text-foreground">{texts.title}</h1>
        <p className="mt-2 text-muted-foreground">{texts.subtitle}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <form onSubmit={handleCreate} autoComplete="off" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRoundPlus className="h-5 w-5 text-primary" />
                {texts.account}
              </CardTitle>
              <CardDescription>{texts.accountDesc}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{texts.ownerName}</Label>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder={texts.placeholders.ownerName} />
              </div>
              <div className="space-y-2">
                <Label>{texts.ownerWhatsapp}</Label>
                <Input dir="ltr" value={ownerWhatsapp} onChange={(e) => setOwnerWhatsapp(e.target.value)} placeholder={texts.placeholders.whatsapp} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{texts.email}</Label>
                <Input dir="ltr" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder={texts.placeholders.email} />
              </div>
              <div className="space-y-2">
                <Label>{texts.password}</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={texts.placeholders.password} />
              </div>
              <div className="space-y-2">
                <Label>{texts.confirmPassword}</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={texts.placeholders.confirmPassword} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                {texts.freeQuota}
              </CardTitle>
              <CardDescription>{texts.freeQuotaDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>{texts.freeQuota}</Label>
                <Input type="number" min={0} value={freeRequestsQuota} onChange={(e) => setFreeRequestsQuota(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                {texts.stationDetails}
              </CardTitle>
              <CardDescription>{texts.stationDetailsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{texts.stationName}</Label>
                <Input value={stationName} onChange={(e) => setStationName(e.target.value)} placeholder={texts.placeholders.stationName} />
              </div>
              <div className="space-y-2">
                <Label>{texts.shortAddress}</Label>
                <Input value={stationAddress} onChange={(e) => setStationAddress(e.target.value)} placeholder={texts.placeholders.shortAddress} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{texts.detailedAddress}</Label>
                <Textarea value={detailedAddress} onChange={(e) => setDetailedAddress(e.target.value)} placeholder={texts.placeholders.detailedAddress} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>{texts.openingTime}</Label>
                <Input type="time" value={workingHoursStart} onChange={(e) => setWorkingHoursStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{texts.closingTime}</Label>
                <Input type="time" value={workingHoursEnd} onChange={(e) => setWorkingHoursEnd(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{texts.schedulingType}</Label>
                <Select value={schedulingType} onValueChange={(value: SchedulingType) => setSchedulingType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slots">{texts.slots}</SelectItem>
                    <SelectItem value="instant">{texts.instant}</SelectItem>
                    <SelectItem value="daily">{texts.daily}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{texts.slotDuration}</Label>
                <Input type="number" min={5} step={5} value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                {texts.stationLocation}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={handleLocateMe}>
                  <LocateFixed className="ml-2 h-4 w-4" />
                  {texts.currentLocation}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{texts.latitude}</Label>
                  <Input dir="ltr" value={location.lat} onChange={(e) => setLocation((current) => ({ ...current, lat: Number(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>{texts.longitude}</Label>
                  <Input dir="ltr" value={location.lng} onChange={(e) => setLocation((current) => ({ ...current, lng: Number(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border">
                {!isLoaded ? (
                  <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">{texts.loadingMap}</div>
                ) : (
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "320px" }}
                    center={location}
                    zoom={13}
                    onClick={(event) => {
                      if (!event.latLng) return;
                      setLocation({
                        lat: event.latLng.lat(),
                        lng: event.latLng.lng(),
                      });
                    }}
                    options={{
                      fullscreenControl: false,
                      streetViewControl: false,
                      mapTypeControl: false,
                    }}
                  >
                    <Marker position={location} />
                  </GoogleMap>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                {texts.services}
              </CardTitle>
              <CardDescription>{texts.servicesDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {services.map((service, index) => (
                <div key={index} className="rounded-2xl border border-border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">{texts.serviceNumber}{index + 1}</h3>
                    {services.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>{texts.serviceName}</Label>
                      <Input value={service.name} onChange={(e) => updateService(index, "name", e.target.value)} placeholder={texts.placeholders.serviceName} />
                    </div>
                    <div className="space-y-2">
                      <Label>{texts.price}</Label>
                      <Input type="number" min={0} value={service.price} onChange={(e) => updateService(index, "price", e.target.value)} placeholder={texts.placeholders.price} />
                    </div>
                    <div className="space-y-2">
                      <Label>{texts.duration}</Label>
                      <Input type="number" min={5} step={5} value={service.duration_minutes} onChange={(e) => updateService(index, "duration_minutes", e.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>{texts.customerDiscount}</Label>
                      <Input value={service.customer_discount} onChange={(e) => updateService(index, "customer_discount", e.target.value)} placeholder={texts.placeholders.discount} />
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" className="w-full" onClick={addService}>
                <Plus className="ml-2 h-4 w-4" />
                {texts.addService}
              </Button>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full bg-ocean-500 text-white hover:bg-ocean-600" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                {texts.submitting}
              </>
            ) : (
              <>
                <UserRoundPlus className="ml-2 h-4 w-4" />
                {texts.submit}
              </>
            )}
          </Button>
        </form>

        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                {texts.createSummary}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {texts.summaryItems.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
