import { useEffect, useMemo, useState } from "react";
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
import { useAppLanguage } from "@/lib/language";
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

const texts = {
  ar: {
    badge: "بوابة أصحاب المحطات",
    title: "سجل محطتك في صفحة واحدة",
    subtitle: "أنشئ الحساب، أضف بيانات المحطة، وحدد خدماتك وأسعارك وخصومات العملاء ثم ادخل مباشرة.",
    home: "الرئيسية",
    signupTab: "إنشاء حساب محطة",
    ownerLogin: "دخول المالك",
    account: "الحساب",
    accountDesc: "رقم الواتساب سيكون هو معرف الدخول الأساسي. البريد الإلكتروني اختياري.",
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
    creationSummary: "بعد الإنشاء سيتم:",
    summaryItems: [
      "إنشاء حساب المالك",
      "إنشاء المحطة وربطها بالمالك",
      "إضافة الخدمات والأسعار والخصومات",
      "تسجيل الدخول مباشرة إلى لوحة المحطة",
    ],
    createAndLogin: "إنشاء الحساب والدخول مباشرة",
    creating: "جاري إنشاء الحساب...",
    fillRequired: "أكمل الحقول المطلوبة",
    passwordShort: "كلمة المرور قصيرة",
    passwordShortDesc: "يجب أن تكون 6 أحرف على الأقل",
    passwordsMismatch: "كلمتا المرور غير متطابقتين",
    addOneService: "أضف خدمة واحدة على الأقل",
    accountFailed: "فشل إنشاء الحساب",
    accountCreated: "تم إنشاء الحساب",
    accountCreatedLoginLater: "لكن تعذر تسجيل الدخول مباشرة. استخدم واتسابك أو بريدك الإلكتروني لتسجيل الدخول.",
    success: "تم إنشاء الحساب والدخول بنجاح",
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
    browserNoLocation: "المتصفح لا يدعم تحديد الموقع",
    locateFailed: "تعذر تحديد الموقع",
    located: "تم تحديد موقعك الحالي",
  },
  en: {
    badge: "Station owners portal",
    title: "Register your station in one page",
    subtitle: "Create the account, add station details, set services, prices, and customer discounts, then sign in directly.",
    home: "Home",
    signupTab: "Create station account",
    ownerLogin: "Owner login",
    account: "Account",
    accountDesc: "WhatsApp number is the main login identifier. Email is optional.",
    ownerName: "Owner name",
    ownerWhatsapp: "WhatsApp number",
    email: "Email (optional)",
    password: "Password",
    confirmPassword: "Confirm password",
    stationDetails: "Station details",
    stationDetailsDesc: "Enter the station name, address, working hours, and location on the map.",
    stationName: "Station name",
    shortAddress: "Short address",
    detailedAddress: "Detailed address",
    openingTime: "Opening time",
    closingTime: "Closing time",
    schedulingType: "Scheduling type",
    slotDuration: "Slot duration in minutes",
    slots: "Fixed time slots",
    instant: "Instant booking",
    daily: "Day only",
    stationLocation: "Station location",
    currentLocation: "My current location",
    latitude: "Latitude",
    longitude: "Longitude",
    loadingMap: "Loading map...",
    services: "Services",
    servicesDesc: "Add station services with price, duration, and customer-facing discount.",
    serviceNumber: "Service #",
    serviceName: "Service name",
    price: "Price",
    duration: "Duration",
    customerDiscount: "Customer-visible discount",
    addService: "Add another service",
    creationSummary: "After creation, the system will:",
    summaryItems: [
      "Create the owner account",
      "Create the station and link it to the owner",
      "Add services, prices, and discounts",
      "Sign in directly to the station dashboard",
    ],
    createAndLogin: "Create account and sign in",
    creating: "Creating account...",
    fillRequired: "Please complete the required fields",
    passwordShort: "Password is too short",
    passwordShortDesc: "It must be at least 6 characters",
    passwordsMismatch: "Passwords do not match",
    addOneService: "Add at least one service",
    accountFailed: "Account creation failed",
    accountCreated: "Account created",
    accountCreatedLoginLater: "Direct sign-in failed. Use your WhatsApp or email to sign in.",
    success: "Account created and signed in successfully",
    placeholders: {
      ownerName: "Ahmad Mohammed",
      whatsapp: "0770xxxxxxx",
      email: "owner@example.com",
      password: "At least 6 characters",
      confirmPassword: "Re-enter password",
      stationName: "Ainkawa Station",
      shortAddress: "Ainkawa, Erbil",
      detailedAddress: "Street, nearby landmark, directions...",
      serviceName: "Basic wash",
      price: "10000",
      discount: "Example: 20% off or 5000 IQD",
    },
    browserNoLocation: "This browser does not support location access",
    locateFailed: "Unable to determine your location",
    located: "Your current location was detected",
  },
  ku: {
    badge: "دەروازەی خاوەن وێستگەکان",
    title: "وێستگەکەت لە یەک پەڕەدا تۆمار بکە",
    subtitle: "هەژمار دروست بکە، زانیاریی وێستگە زیاد بکە، خزمەتگوزاری و نرخ و داشکاندن دیاری بکە، پاشان ڕاستەوخۆ بچۆ ژوورەوە.",
    home: "سەرەکی",
    signupTab: "دروستکردنی هەژماری وێستگە",
    ownerLogin: "چوونەژوورەوەی خاوەن",
    account: "هەژمار",
    accountDesc: "ژمارەی واتساپ ناسنامەی سەرەکی چوونەژوورەوە دەبێت. ئیمەیڵ هەڵبژاردەییە.",
    ownerName: "ناوی خاوەن",
    ownerWhatsapp: "ژمارەی واتساپ",
    email: "ئیمەیڵ (هەڵبژاردەیی)",
    password: "وشەی نهێنی",
    confirmPassword: "دووبارەکردنەوەی وشەی نهێنی",
    stationDetails: "زانیاریی وێستگە",
    stationDetailsDesc: "ناوی وێستگە و ناونیشان و کاتی کار و شوێنی لەسەر نەخشە بنووسە.",
    stationName: "ناوی وێستگە",
    shortAddress: "ناونیشانی کورت",
    detailedAddress: "ناونیشانی ورد",
    openingTime: "کاتی کردنەوە",
    closingTime: "کاتی داخستن",
    schedulingType: "جۆری موعید",
    slotDuration: "ماوەی فاصلەکە بە خولەک",
    slots: "کاتە فاصلەییەکان",
    instant: "حجزی خێرا",
    daily: "تەنها ڕۆژ",
    stationLocation: "شوێنی وێستگە",
    currentLocation: "شوێنی ئێستام",
    latitude: "هێڵی پانی",
    longitude: "هێڵی درێژی",
    loadingMap: "نەخشە بار دەکرێت...",
    services: "خزمەتگوزارییەکان",
    servicesDesc: "خزمەتگوزارییەکانی وێستگە لەگەڵ نرخ و ماوە و داشکاندنی پیشانکراو زیاد بکە.",
    serviceNumber: "خزمەتگوزاری #",
    serviceName: "ناوی خزمەتگوزاری",
    price: "نرخ",
    duration: "ماوە",
    customerDiscount: "داشکاندنی پیشانکراو بۆ کڕیار",
    addService: "زیادکردنی خزمەتگوزارییەکی تر",
    creationSummary: "دوای دروستکردن، سیستەم ئەمانە دەکات:",
    summaryItems: [
      "هەژماری خاوەن دروست دەکات",
      "وێستگەکە دروست دەکات و بە خاوەنەکەوە دەبەستێتەوە",
      "خزمەتگوزاری و نرخ و داشکاندن زیاد دەکات",
      "ڕاستەوخۆ دەچیتە ناو داشبۆردی وێستگە",
    ],
    createAndLogin: "هەژمار دروست بکە و بچۆ ژوورەوە",
    creating: "هەژمار دروست دەکرێت...",
    fillRequired: "تکایە خانە پێویستەکان پڕ بکەوە",
    passwordShort: "وشەی نهێنی کورته",
    passwordShortDesc: "دەبێت لانیکەم 6 پیت بێت",
    passwordsMismatch: "دوو وشەی نهێنییەکە یەکسان نین",
    addOneService: "لانیکەم یەک خزمەتگوزاری زیاد بکە",
    accountFailed: "دروستکردنی هەژمار سەرکەوتوو نەبوو",
    accountCreated: "هەژمار دروست بوو",
    accountCreatedLoginLater: "بەڵام چوونەژوورەوەی ڕاستەوخۆ سەرکەوتوو نەبوو. واتساپ یان ئیمەیڵەکەت بەکاربهێنە.",
    success: "هەژمار دروست بوو و بە سەرکەوتوویی چوویتە ژوورەوە",
    placeholders: {
      ownerName: "ئەحمەد محەمەد",
      whatsapp: "0770xxxxxxx",
      email: "owner@example.com",
      password: "لانیکەم 6 پیت",
      confirmPassword: "وشەی نهێنی دووبارە بنووسە",
      stationName: "وێستگەی عینکاوە",
      shortAddress: "عینکاوە، هەولێر",
      detailedAddress: "شەقام، نیشانەی نزیک، ڕێنمایی...",
      serviceName: "شۆردنی بنەڕەتی",
      price: "10000",
      discount: "نمونە: 20% داشکاندن یان 5000 د.ع",
    },
    browserNoLocation: "ئەم وێبگەڕە پشتگیری دیاریکردنی شوێن ناکات",
    locateFailed: "نەتوانرا شوێنەکەت دیاری بکرێت",
    located: "شوێنی ئێستات دیاری کرا",
  },
  tr: {
    badge: "İstasyon sahibi portalı",
    title: "İstasyonunu tek sayfada kaydet",
    subtitle: "Hesabı oluştur, istasyon bilgilerini ekle, hizmetleri, fiyatları ve müşteri indirimlerini belirle, sonra doğrudan giriş yap.",
    home: "Ana sayfa",
    signupTab: "İstasyon hesabı oluştur",
    ownerLogin: "İstasyon sahibi girişi",
    account: "Hesap",
    accountDesc: "WhatsApp numarası ana giriş kimliği olacaktır. E-posta isteğe bağlıdır.",
    ownerName: "Sahip adı",
    ownerWhatsapp: "WhatsApp numarası",
    email: "E-posta (isteğe bağlı)",
    password: "Şifre",
    confirmPassword: "Şifreyi onayla",
    stationDetails: "İstasyon bilgileri",
    stationDetailsDesc: "İstasyon adı, adresi, çalışma saatleri ve haritadaki konumunu girin.",
    stationName: "İstasyon adı",
    shortAddress: "Kısa adres",
    detailedAddress: "Detaylı adres",
    openingTime: "Açılış saati",
    closingTime: "Kapanış saati",
    schedulingType: "Planlama türü",
    slotDuration: "Dakika cinsinden slot süresi",
    slots: "Sabit zaman aralıkları",
    instant: "Anlık rezervasyon",
    daily: "Sadece gün seçimi",
    stationLocation: "İstasyon konumu",
    currentLocation: "Mevcut konumum",
    latitude: "Enlem",
    longitude: "Boylam",
    loadingMap: "Harita yükleniyor...",
    services: "Hizmetler",
    servicesDesc: "İstasyon hizmetlerini fiyat, süre ve müşteriye görünen indirimle ekleyin.",
    serviceNumber: "Hizmet #",
    serviceName: "Hizmet adı",
    price: "Fiyat",
    duration: "Süre",
    customerDiscount: "Müşteriye görünen indirim",
    addService: "Başka hizmet ekle",
    creationSummary: "Oluşturma sonrası sistem şunları yapar:",
    summaryItems: [
      "Sahip hesabını oluşturur",
      "İstasyonu oluşturur ve sahibiyle bağlar",
      "Hizmetleri, fiyatları ve indirimleri ekler",
      "Doğrudan istasyon paneline giriş yapar",
    ],
    createAndLogin: "Hesabı oluştur ve giriş yap",
    creating: "Hesap oluşturuluyor...",
    fillRequired: "Lütfen gerekli alanları tamamlayın",
    passwordShort: "Şifre çok kısa",
    passwordShortDesc: "En az 6 karakter olmalıdır",
    passwordsMismatch: "Şifreler eşleşmiyor",
    addOneService: "En az bir hizmet ekleyin",
    accountFailed: "Hesap oluşturulamadı",
    accountCreated: "Hesap oluşturuldu",
    accountCreatedLoginLater: "Doğrudan giriş başarısız oldu. Giriş yapmak için WhatsApp veya e-posta kullanın.",
    success: "Hesap oluşturuldu ve giriş yapıldı",
    placeholders: {
      ownerName: "Ahmad Mohammed",
      whatsapp: "0770xxxxxxx",
      email: "owner@example.com",
      password: "En az 6 karakter",
      confirmPassword: "Şifreyi tekrar yazın",
      stationName: "Ainkawa İstasyonu",
      shortAddress: "Ainkawa, Erbil",
      detailedAddress: "Cadde, yakın işaret, yol tarifi...",
      serviceName: "Temel yıkama",
      price: "10000",
      discount: "Örnek: %20 indirim veya 5000 IQD",
    },
    browserNoLocation: "Bu tarayıcı konum desteği vermiyor",
    locateFailed: "Konum tespit edilemedi",
    located: "Mevcut konumunuz belirlendi",
  },
} as const;

const buildOwnerEmail = (phone: string, email?: string | null) => {
  const cleanedEmail = email?.trim();
  if (cleanedEmail) return cleanedEmail;
  const digits = normalizeOwnerPhone(phone).replace(/\D/g, "");
  return `owner-${digits || "station"}@washlly.local`;
};

const OwnerAccess = () => {
  const navigate = useNavigate();
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];
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

  const loginEmail = useMemo(() => buildOwnerEmail(ownerWhatsapp, ownerEmail), [ownerWhatsapp, ownerEmail]);

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
    setServices((current) => current.map((service, i) => (i === index ? { ...service, [field]: value } : service)));
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({ title: t.browserNoLocation, variant: "destructive" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        toast({ title: t.located });
      },
      () => {
        toast({ title: t.locateFailed, variant: "destructive" });
      },
    );
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!ownerName.trim() || !ownerWhatsapp.trim() || !password || !stationName.trim()) {
      toast({ title: t.fillRequired, variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: t.passwordShort, description: t.passwordShortDesc, variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: t.passwordsMismatch, variant: "destructive" });
      return;
    }

    const validServices = services.filter((service) => service.name.trim() && Number(service.price) > 0);
    if (validServices.length === 0) {
      toast({ title: t.addOneService, variant: "destructive" });
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
        title: t.accountFailed,
        description: data?.error || error?.message,
        variant: "destructive",
      });
      return;
    }

    const loginResult = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    setSignupLoading(false);

    if (loginResult.error || !loginResult.data.user) {
      toast({
        title: t.accountCreated,
        description: t.accountCreatedLoginLater,
      });
      return;
    }

    toast({ title: t.success });
    navigate("/app/station-portal", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean-50 via-background to-background p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
          <div>
            <Badge variant="secondary" className="mb-3">{t.badge}</Badge>
            <h1 className="text-3xl font-black text-foreground">{t.title}</h1>
            <p className="mt-2 text-muted-foreground">{t.subtitle}</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowRight className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1 rotate-180"}`} />
            {t.home}
          </Button>
        </div>

        <Tabs defaultValue="signup" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="signup">{t.signupTab}</TabsTrigger>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all"
            >
              {t.ownerLogin}
            </button>
          </TabsList>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} autoComplete="off" className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserRoundPlus className="h-5 w-5 text-primary" />
                      {t.account}
                    </CardTitle>
                    <CardDescription>{t.accountDesc}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.ownerName}</Label>
                      <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder={t.placeholders.ownerName} autoComplete="name" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.ownerWhatsapp}</Label>
                      <Input dir="ltr" value={ownerWhatsapp} onChange={(e) => setOwnerWhatsapp(e.target.value)} placeholder={t.placeholders.whatsapp} autoComplete="tel" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>{t.email}</Label>
                      <Input dir="ltr" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder={t.placeholders.email} autoComplete="off" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.password}</Label>
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.placeholders.password} autoComplete="new-password" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.confirmPassword}</Label>
                      <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.placeholders.confirmPassword} autoComplete="new-password" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-primary" />
                      {t.stationDetails}
                    </CardTitle>
                    <CardDescription>{t.stationDetailsDesc}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t.stationName}</Label>
                        <Input value={stationName} onChange={(e) => setStationName(e.target.value)} placeholder={t.placeholders.stationName} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.shortAddress}</Label>
                        <Input value={stationAddress} onChange={(e) => setStationAddress(e.target.value)} placeholder={t.placeholders.shortAddress} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{t.detailedAddress}</Label>
                      <Textarea value={detailedAddress} onChange={(e) => setDetailedAddress(e.target.value)} placeholder={t.placeholders.detailedAddress} rows={3} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t.openingTime}</Label>
                        <Input type="time" value={workingHoursStart} onChange={(e) => setWorkingHoursStart(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.closingTime}</Label>
                        <Input type="time" value={workingHoursEnd} onChange={(e) => setWorkingHoursEnd(e.target.value)} />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t.schedulingType}</Label>
                        <Select value={schedulingType} onValueChange={(value: SchedulingType) => setSchedulingType(value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slots">{t.slots}</SelectItem>
                            <SelectItem value="instant">{t.instant}</SelectItem>
                            <SelectItem value="daily">{t.daily}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {schedulingType === "slots" && (
                        <div className="space-y-2">
                          <Label>{t.slotDuration}</Label>
                          <Input type="number" value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          {t.stationLocation}
                        </Label>
                        <Button type="button" variant="outline" size="sm" onClick={handleLocateMe}>
                          <LocateFixed className="h-4 w-4 ml-1" />
                          {t.currentLocation}
                        </Button>
                      </div>
                      <div className="h-72 overflow-hidden rounded-2xl border">
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
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            {t.loadingMap}
                          </div>
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t.latitude}</Label>
                          <Input type="number" step="any" value={location.lat} onChange={(e) => setLocation((current) => ({ ...current, lat: Number(e.target.value) || current.lat }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t.longitude}</Label>
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
                      {t.services}
                    </CardTitle>
                    <CardDescription>{t.servicesDesc}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {services.map((service, index) => (
                      <div key={index} className="space-y-3 rounded-2xl border p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{t.serviceNumber}{index + 1}</div>
                          {services.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>{t.serviceName}</Label>
                          <Input value={service.name} onChange={(e) => updateService(index, "name", e.target.value)} placeholder={t.placeholders.serviceName} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>{t.price}</Label>
                            <Input type="number" value={service.price} onChange={(e) => updateService(index, "price", e.target.value)} placeholder={t.placeholders.price} />
                          </div>
                          <div className="space-y-2">
                            <Label>{t.duration}</Label>
                            <Input type="number" value={service.duration_minutes} onChange={(e) => updateService(index, "duration_minutes", e.target.value)} placeholder="30" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-primary" />
                            {t.customerDiscount}
                          </Label>
                          <Input value={service.customer_discount} onChange={(e) => updateService(index, "customer_discount", e.target.value)} placeholder={t.placeholders.discount} />
                        </div>
                      </div>
                    ))}

                    <Button type="button" variant="outline" className="w-full" onClick={addService}>
                      <Plus className="h-4 w-4 ml-1" />
                      {t.addService}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="rounded-2xl border border-ocean-100 bg-ocean-50 p-4 text-sm text-ocean-900">
                      {t.creationSummary}
                      <ul className="mt-2 list-disc space-y-1 pr-4">
                        {t.summaryItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">{t.email}</div>
                      <div dir="ltr" className="mt-1 break-all">{loginEmail}</div>
                    </div>

                    <Button type="submit" className="h-12 w-full" disabled={signupLoading}>
                      {signupLoading ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          {t.creating}
                        </>
                      ) : (
                        <>
                          <UserRoundPlus className="ml-2 h-4 w-4" />
                          {t.createAndLogin}
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

