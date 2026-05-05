import { useEffect, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useNavigate } from "react-router-dom";
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
import { useAppLanguage } from "@/lib/language";
import InstallAppButton from "@/components/InstallAppButton";
import {
  ArrowRight,
  Loader2,
  LocateFixed,
  LogIn,
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
type AccessView = "entry" | "signin" | "signup";

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
    title: "أدر محطتك من مكان واحد",
    subtitle: "ابدأ بالطريقة المناسبة لك: سجّل دخولك إذا كان لديك حساب، أو أنشئ حساباً جديداً ثم أضف المحطة والخدمات.",
    home: "الرئيسية",
    choosePath: "اختر كيف تريد المتابعة",
    choosePathDesc: "حتى لا تضيع بياناتك لاحقاً، يبدأ النظام أولاً من صفحة دخول أو إنشاء حساب ثم ينتقل إلى تفاصيل المحطة.",
    createAccount: "إنشاء حساب جديد",
    createAccountDesc: "لصاحب محطة جديد يريد إنشاء حسابه ثم إضافة المحطة والخدمات من نفس الصفحة.",
    existingAccount: "لدي حساب، تسجيل الدخول",
    existingAccountDesc: "لصاحب محطة يملك حساباً مسبقاً ويريد الدخول بسرعة إلى لوحة المحطة.",
    backToOptions: "العودة إلى خيارات الدخول",
    loginTitle: "تسجيل الدخول إلى لوحة المحطة",
    loginDesc: "يمكنك تسجيل الدخول بالإيميل، أو برقم الواتساب، أو بالاسم الذي سجلت به حسابك إذا لم تضف إيميلاً.",
    loginIdentifier: "الإيميل أو الواتساب أو الاسم",
    loginIdentifierPh: "مثال: info@washlly.com أو 0770xxxxxxx أو اسمك",
    loginPassword: "كلمة المرور",
    loginButton: "تسجيل الدخول",
    loggingIn: "جاري تسجيل الدخول...",
    loginLookupFailed: "تعذر العثور على الحساب",
    loginLookupFailedDesc: "تأكد من الاسم أو رقم الواتساب، أو استخدم الإيميل إذا كان مسجلاً.",
    loginAmbiguous: "هناك أكثر من حساب بهذا الاسم",
    loginAmbiguousDesc: "استخدم رقم الواتساب أو الإيميل لتسجيل الدخول بدقة.",
    loginFailed: "فشل تسجيل الدخول",
    loginFailedDesc: "بيانات الدخول غير صحيحة",
    signupTitle: "إنشاء حساب جديد ثم تسجيل المحطة",
    signupDesc: "أنشئ الحساب أولاً، وبعده يتم ربط المحطة والخدمات بك مباشرة.",
    account: "بيانات الحساب",
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
    createAndLogin: "إنشاء الحساب وإكمال التسجيل",
    creating: "جاري إنشاء الحساب...",
    fillRequired: "أكمل الحقول المطلوبة",
    passwordShort: "كلمة المرور قصيرة",
    passwordShortDesc: "يجب أن تكون 6 أحرف على الأقل",
    passwordsMismatch: "كلمتا المرور غير متطابقتين",
    addOneService: "أضف خدمة واحدة على الأقل",
    accountFailed: "فشل إنشاء الحساب",
    accountCreated: "تم إنشاء الحساب",
    accountCreatedLoginLater: "لكن تعذر تسجيل الدخول مباشرة. استخدم الإيميل أو الواتساب أو الاسم للدخول.",
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
    title: "Manage your station from one place",
    subtitle: "Start the right way: sign in if you already have an account, or create a new account first and then register your station and services.",
    home: "Home",
    choosePath: "Choose how you want to continue",
    choosePathDesc: "To keep your access clear for future visits, the system starts with a sign-in or sign-up step before station registration.",
    createAccount: "Create a new account",
    createAccountDesc: "For a new station owner who wants to create the account and then add the station and services from the same page.",
    existingAccount: "I already have an account, sign in",
    existingAccountDesc: "For a station owner who already has an account and wants to go straight to the station portal.",
    backToOptions: "Back to access options",
    loginTitle: "Sign in to the station portal",
    loginDesc: "You can sign in with email, WhatsApp number, or the name you used when creating the account if you did not add an email.",
    loginIdentifier: "Email, WhatsApp, or name",
    loginIdentifierPh: "Example: info@washlly.com or 0770xxxxxxx or your name",
    loginPassword: "Password",
    loginButton: "Sign in",
    loggingIn: "Signing in...",
    loginLookupFailed: "Account not found",
    loginLookupFailedDesc: "Check the name or WhatsApp number, or use your email if it was added before.",
    loginAmbiguous: "More than one account has this name",
    loginAmbiguousDesc: "Use the WhatsApp number or email to sign in accurately.",
    loginFailed: "Sign-in failed",
    loginFailedDesc: "The login details are incorrect",
    signupTitle: "Create a new account then register the station",
    signupDesc: "Create the account first, then the station and services will be linked to you directly.",
    account: "Account details",
    accountDesc: "WhatsApp number is the main login identifier. Email is optional.",
    ownerName: "Owner name",
    ownerWhatsapp: "WhatsApp number",
    email: "Email (optional)",
    password: "Password",
    confirmPassword: "Confirm password",
    stationDetails: "Station details",
    stationDetailsDesc: "Enter the station name, address, working hours, and map location.",
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
      "Sign in directly to the station portal",
    ],
    createAndLogin: "Create account and continue",
    creating: "Creating account...",
    fillRequired: "Please complete the required fields",
    passwordShort: "Password is too short",
    passwordShortDesc: "It must be at least 6 characters",
    passwordsMismatch: "Passwords do not match",
    addOneService: "Add at least one service",
    accountFailed: "Account creation failed",
    accountCreated: "Account created",
    accountCreatedLoginLater: "Direct sign-in failed. Use email, WhatsApp, or your name to sign in.",
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
    title: "بە شێوەیەکی ڕێکخراو وێستگەکەت بەڕێوەببە",
    subtitle: "ئەگەر هەژمارت هەیە بچۆ ژوورەوە، ئەگەر نوێیت سەرەتا هەژمار دروست بکە و دواتر زانیاریی وێستگە و خزمەتگوزارییەکانت زیاد بکە.",
    home: "سەرەکی",
    choosePath: "دیاری بکە چۆن بەردەوام دەبیت",
    choosePathDesc: "بۆ ئەوەی دواتر هەرکات گەڕایتەوە شوێنی چوونەژوورەوەت ڕوون بێت، سیستەم لە هەنگاوی چوونەژوورەوە یان دروستکردنی هەژمار دەست پێ دەکات.",
    createAccount: "دروستکردنی هەژماری نوێ",
    createAccountDesc: "بۆ خاوەن وێستگەیەکی نوێ کە دەیەوێت هەژمار دروست بکات و لە هەمان پەڕەدا وێستگە و خزمەتگوزارییەکانی زیاد بکات.",
    existingAccount: "هەژمارم هەیە، بچۆ ژوورەوە",
    existingAccountDesc: "بۆ خاوەن وێستگەیەک کە هەژمارێکی هەیە و دەیەوێت خێرا بچێتە ناو پۆرتاڵی وێستگە.",
    backToOptions: "گەڕانەوە بۆ هەڵبژاردەکانی چوونەژوورەوە",
    loginTitle: "چوونەژوورەوە بۆ پۆرتاڵی وێستگە",
    loginDesc: "دەتوانیت بە ئیمەیڵ، ژمارەی واتساپ، یان بەو ناوەی کە هەژمارت پێ دروست کردووە بچیتە ژوورەوە ئەگەر ئیمەیڵت زیاد نەکردووە.",
    loginIdentifier: "ئیمەیڵ یان واتساپ یان ناو",
    loginIdentifierPh: "نمونە: info@washlly.com یان 0770xxxxxxx یان ناوت",
    loginPassword: "وشەی نهێنی",
    loginButton: "چوونەژوورەوە",
    loggingIn: "چوونەژوورەوە لە کاردایە...",
    loginLookupFailed: "هەژمارەکە نەدۆزرایەوە",
    loginLookupFailedDesc: "لە ناو یان ژمارەی واتساپ دڵنیابە، یان ئیمەیڵەکەت بەکاربهێنە ئەگەر پێشتر زیادت کردووە.",
    loginAmbiguous: "بەو ناوە زیاتر لە یەک هەژمار هەیە",
    loginAmbiguousDesc: "بۆ وردی، ژمارەی واتساپ یان ئیمەیڵ بەکاربهێنە.",
    loginFailed: "چوونەژوورەوە سەرکەوتوو نەبوو",
    loginFailedDesc: "زانیارییەکانی چوونەژوورەوە هەڵەن",
    signupTitle: "هەژماری نوێ دروست بکە و پاشان وێستگەکە تۆمار بکە",
    signupDesc: "سەرەتا هەژمار دروست دەکرێت، پاشان وێستگە و خزمەتگوزارییەکانت بە تۆوە دەبەسترێن.",
    account: "زانیاریی هەژمار",
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
      "ڕاستەوخۆ دەچیتە ناو پۆرتاڵی وێستگە",
    ],
    createAndLogin: "هەژمار دروست بکە و بەردەوام بە",
    creating: "هەژمار دروست دەکرێت...",
    fillRequired: "تکایە خانە پێویستەکان پڕ بکەوە",
    passwordShort: "وشەی نهێنی کورته",
    passwordShortDesc: "دەبێت لانیکەم 6 پیت بێت",
    passwordsMismatch: "دوو وشەی نهێنییەکە یەکسان نین",
    addOneService: "لانیکەم یەک خزمەتگوزاری زیاد بکە",
    accountFailed: "دروستکردنی هەژمار سەرکەوتوو نەبوو",
    accountCreated: "هەژمار دروست بوو",
    accountCreatedLoginLater: "بەڵام چوونەژوورەوەی ڕاستەوخۆ سەرکەوتوو نەبوو. بە ئیمەیڵ یان واتساپ یان ناو بچۆ ژوورەوە.",
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
    badge: "İstasyon sahipleri portalı",
    title: "İstasyonunu tek yerden yönet",
    subtitle: "Doğru yerden başla: hesabın varsa giriş yap, yoksa önce hesap oluştur ve sonra istasyon ile hizmetlerini kaydet.",
    home: "Ana sayfa",
    choosePath: "Nasıl devam etmek istediğini seç",
    choosePathDesc: "Daha sonra geri döndüğünde giriş yolun net olsun diye sistem önce giriş veya hesap oluşturma adımıyla başlar.",
    createAccount: "Yeni hesap oluştur",
    createAccountDesc: "Yeni bir istasyon sahibiysen önce hesabını oluştur, sonra aynı sayfada istasyonunu ve hizmetlerini ekle.",
    existingAccount: "Hesabım var, giriş yap",
    existingAccountDesc: "Zaten hesabın varsa doğrudan istasyon paneline geçmek için giriş yap.",
    backToOptions: "Giriş seçeneklerine dön",
    loginTitle: "İstasyon paneline giriş yap",
    loginDesc: "E-posta ile, WhatsApp numarası ile veya e-posta eklemediysen hesabı açarken kullandığın isimle giriş yapabilirsin.",
    loginIdentifier: "E-posta, WhatsApp veya isim",
    loginIdentifierPh: "Örnek: info@washlly.com veya 0770xxxxxxx veya adın",
    loginPassword: "Şifre",
    loginButton: "Giriş yap",
    loggingIn: "Giriş yapılıyor...",
    loginLookupFailed: "Hesap bulunamadı",
    loginLookupFailedDesc: "İsim veya WhatsApp numarasını kontrol et, ya da eklediysen e-postanı kullan.",
    loginAmbiguous: "Bu isimle birden fazla hesap var",
    loginAmbiguousDesc: "Doğru hesabı bulmak için WhatsApp numarası veya e-posta kullan.",
    loginFailed: "Giriş başarısız",
    loginFailedDesc: "Giriş bilgileri yanlış",
    signupTitle: "Yeni hesap oluştur, sonra istasyonu kaydet",
    signupDesc: "Önce hesap oluşturulur, ardından istasyon ve hizmetler doğrudan sana bağlanır.",
    account: "Hesap bilgileri",
    accountDesc: "WhatsApp numarası ana giriş kimliği olacaktır. E-posta isteğe bağlıdır.",
    ownerName: "Sahip adı",
    ownerWhatsapp: "WhatsApp numarası",
    email: "E-posta (isteğe bağlı)",
    password: "Şifre",
    confirmPassword: "Şifreyi doğrula",
    stationDetails: "İstasyon bilgileri",
    stationDetailsDesc: "İstasyon adı, adresi, çalışma saatleri ve haritadaki konumunu gir.",
    stationName: "İstasyon adı",
    shortAddress: "Kısa adres",
    detailedAddress: "Detaylı adres",
    openingTime: "Açılış saati",
    closingTime: "Kapanış saati",
    schedulingType: "Randevu türü",
    slotDuration: "Dakika cinsinden slot süresi",
    slots: "Sabit zaman aralıkları",
    instant: "Anlık rezervasyon",
    daily: "Sadece gün seçimi",
    stationLocation: "İstasyon konumu",
    currentLocation: "Şu anki konumum",
    latitude: "Enlem",
    longitude: "Boylam",
    loadingMap: "Harita yükleniyor...",
    services: "Hizmetler",
    servicesDesc: "İstasyon hizmetlerini fiyat, süre ve müşteriye görünen indirimle ekle.",
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
      "Doğrudan istasyon portalına giriş yapar",
    ],
    createAndLogin: "Hesabı oluştur ve devam et",
    creating: "Hesap oluşturuluyor...",
    fillRequired: "Lütfen gerekli alanları tamamlayın",
    passwordShort: "Şifre çok kısa",
    passwordShortDesc: "En az 6 karakter olmalıdır",
    passwordsMismatch: "Şifreler eşleşmiyor",
    addOneService: "En az bir hizmet ekleyin",
    accountFailed: "Hesap oluşturulamadı",
    accountCreated: "Hesap oluşturuldu",
    accountCreatedLoginLater: "Doğrudan giriş başarısız oldu. Giriş için e-posta, WhatsApp veya ismini kullan.",
    success: "Hesap oluşturuldu ve başarıyla giriş yapıldı",
    placeholders: {
      ownerName: "Ahmad Mohammed",
      whatsapp: "0770xxxxxxx",
      email: "owner@example.com",
      password: "En az 6 karakter",
      confirmPassword: "Şifreyi tekrar yaz",
      stationName: "Ainkawa İstasyonu",
      shortAddress: "Ainkawa, Erbil",
      detailedAddress: "Cadde, yakın nokta, yol tarifi...",
      serviceName: "Temel yıkama",
      price: "10000",
      discount: "Örnek: %20 indirim veya 5000 IQD",
    },
    browserNoLocation: "Bu tarayıcı konum erişimini desteklemiyor",
    locateFailed: "Konum alınamadı",
    located: "Mevcut konumun belirlendi",
  },
} as const;

const OwnerAccess = () => {
  const navigate = useNavigate();
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY });

  const [view, setView] = useState<AccessView>("entry");
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [signinIdentifier, setSigninIdentifier] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
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
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
    return data?.role || null;
  };

  const redirectByRole = async (userId: string) => {
    const role = await getUserRole(userId);
    if (role === "station_owner") {
      navigate("/app/station-portal", { replace: true });
      return;
    }
    if (role === "admin") {
      navigate("/app/admin/dashboard", { replace: true });
      return;
    }
    navigate("/app", { replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      await redirectByRole(session.user.id);
    });
  }, [navigate]);

  const addService = () => setServices((current) => [...current, emptyService()]);
  const removeService = (index: number) => setServices((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  const updateService = (index: number, field: keyof ServiceDraft, value: string) => {
    setServices((current) => current.map((service, i) => (i === index ? { ...service, [field]: value } : service)));
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({ title: t.browserNoLocation, variant: "destructive" });
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      toast({ title: t.locateFailed, variant: "destructive" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        toast({ title: t.located });
      },
      () => toast({ title: t.locateFailed, variant: "destructive" }),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    const identifier = signinIdentifier.trim();

    if (!identifier || !signinPassword) {
      toast({ title: t.fillRequired, variant: "destructive" });
      return;
    }

    setLoginLoading(true);

    let resolvedEmail = identifier;

    if (!identifier.includes("@")) {
      const { data, error } = await supabase.functions.invoke("owner-login-lookup", {
        body: { identifier },
      });

      if (error || data?.error || !data?.email) {
        setLoginLoading(false);
        toast({
          title: data?.error === "AMBIGUOUS_OWNER_NAME" ? t.loginAmbiguous : t.loginLookupFailed,
          description: data?.error === "AMBIGUOUS_OWNER_NAME" ? t.loginAmbiguousDesc : t.loginLookupFailedDesc,
          variant: "destructive",
        });
        return;
      }

      resolvedEmail = data.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail.trim().toLowerCase(),
      password: signinPassword,
    });

    setLoginLoading(false);

    if (error || !data.user) {
      toast({
        title: t.loginFailed,
        description: t.loginFailedDesc,
        variant: "destructive",
      });
      return;
    }

    await redirectByRole(data.user.id);
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
      email: data?.email || `owner-${normalizeOwnerPhone(ownerWhatsapp)}@washlly.local`,
      password,
    });

    setSignupLoading(false);

    if (loginResult.error || !loginResult.data.user) {
      toast({
        title: t.accountCreated,
        description: t.accountCreatedLoginLater,
      });
      setView("signin");
      setSigninIdentifier(ownerEmail.trim() || ownerWhatsapp.trim() || ownerName.trim());
      setSigninPassword(password);
      return;
    }

    toast({ title: t.success });
    navigate("/app/station-portal", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean-50 via-background to-background p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">{t.badge}</Badge>
            <h1 className="text-3xl font-black text-foreground">{t.title}</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <InstallAppButton />
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowRight className={`h-4 w-4 ${isRtl ? "ml-1" : "mr-1 rotate-180"}`} />
              {t.home}
            </Button>
          </div>
        </div>

        {view === "entry" && (
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="text-center">
              <CardTitle>{t.choosePath}</CardTitle>
              <CardDescription>{t.choosePathDesc}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setView("signup")}
                className="rounded-2xl border border-border bg-card p-5 text-start transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserRoundPlus className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">{t.createAccount}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.createAccountDesc}</p>
              </button>

              <button
                type="button"
                onClick={() => setView("signin")}
                className="rounded-2xl border border-border bg-card p-5 text-start transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <LogIn className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground">{t.existingAccount}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.existingAccountDesc}</p>
              </button>
            </CardContent>
          </Card>
        )}

        {view === "signin" && (
          <div className="mx-auto max-w-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setView("entry")}>{t.backToOptions}</Button>
              <Button variant="outline" onClick={() => setView("signup")}>{t.createAccount}</Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t.loginTitle}</CardTitle>
                <CardDescription>{t.loginDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.loginIdentifier}</Label>
                    <Input
                      value={signinIdentifier}
                      onChange={(e) => setSigninIdentifier(e.target.value)}
                      placeholder={t.loginIdentifierPh}
                      autoComplete="username"
                      dir={language === "ar" || language === "ku" ? "rtl" : "ltr"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.loginPassword}</Label>
                    <Input
                      type="password"
                      value={signinPassword}
                      onChange={(e) => setSigninPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-ocean-500 text-white hover:bg-ocean-600" disabled={loginLoading}>
                    {loginLoading ? <Loader2 className={`h-4 w-4 animate-spin ${isRtl ? "ml-2" : "mr-2"}`} /> : <LogIn className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />}
                    {loginLoading ? t.loggingIn : t.loginButton}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {view === "signup" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setView("entry")}>{t.backToOptions}</Button>
              <Button variant="outline" onClick={() => setView("signin")}>{t.existingAccount}</Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
              <form onSubmit={handleSignup} autoComplete="off" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t.signupTitle}</CardTitle>
                    <CardDescription>{t.signupDesc}</CardDescription>
                  </CardHeader>
                </Card>

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
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.stationName}</Label>
                      <Input value={stationName} onChange={(e) => setStationName(e.target.value)} placeholder={t.placeholders.stationName} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.shortAddress}</Label>
                      <Input value={stationAddress} onChange={(e) => setStationAddress(e.target.value)} placeholder={t.placeholders.shortAddress} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>{t.detailedAddress}</Label>
                      <Textarea value={detailedAddress} onChange={(e) => setDetailedAddress(e.target.value)} placeholder={t.placeholders.detailedAddress} rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.openingTime}</Label>
                      <Input type="time" value={workingHoursStart} onChange={(e) => setWorkingHoursStart(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.closingTime}</Label>
                      <Input type="time" value={workingHoursEnd} onChange={(e) => setWorkingHoursEnd(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.schedulingType}</Label>
                      <Select value={schedulingType} onValueChange={(value: SchedulingType) => setSchedulingType(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="slots">{t.slots}</SelectItem>
                          <SelectItem value="instant">{t.instant}</SelectItem>
                          <SelectItem value="daily">{t.daily}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.slotDuration}</Label>
                      <Input type="number" min={5} step={5} value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      {t.stationLocation}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" onClick={handleLocateMe}>
                        <LocateFixed className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                        {t.currentLocation}
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t.latitude}</Label>
                        <Input dir="ltr" value={location.lat} onChange={(e) => setLocation((current) => ({ ...current, lat: Number(e.target.value) || 0 }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.longitude}</Label>
                        <Input dir="ltr" value={location.lng} onChange={(e) => setLocation((current) => ({ ...current, lng: Number(e.target.value) || 0 }))} />
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-border">
                      {!isLoaded ? (
                        <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">{t.loadingMap}</div>
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
                      {t.services}
                    </CardTitle>
                    <CardDescription>{t.servicesDesc}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {services.map((service, index) => (
                      <div key={index} className="rounded-2xl border border-border p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="font-semibold">{t.serviceNumber}{index + 1}</h3>
                          {services.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2 md:col-span-2">
                            <Label>{t.serviceName}</Label>
                            <Input value={service.name} onChange={(e) => updateService(index, "name", e.target.value)} placeholder={t.placeholders.serviceName} />
                          </div>
                          <div className="space-y-2">
                            <Label>{t.price}</Label>
                            <Input type="number" min={0} value={service.price} onChange={(e) => updateService(index, "price", e.target.value)} placeholder={t.placeholders.price} />
                          </div>
                          <div className="space-y-2">
                            <Label>{t.duration}</Label>
                            <Input type="number" min={5} step={5} value={service.duration_minutes} onChange={(e) => updateService(index, "duration_minutes", e.target.value)} />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>{t.customerDiscount}</Label>
                            <Input value={service.customer_discount} onChange={(e) => updateService(index, "customer_discount", e.target.value)} placeholder={t.placeholders.discount} />
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button type="button" variant="outline" className="w-full" onClick={addService}>
                      <Plus className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                      {t.addService}
                    </Button>
                  </CardContent>
                </Card>

                <Button type="submit" size="lg" className="w-full bg-ocean-500 text-white hover:bg-ocean-600" disabled={signupLoading}>
                  {signupLoading ? (
                    <>
                      <Loader2 className={`h-4 w-4 animate-spin ${isRtl ? "ml-2" : "mr-2"}`} />
                      {t.creating}
                    </>
                  ) : (
                    <>
                      <UserRoundPlus className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
                      {t.createAndLogin}
                    </>
                  )}
                </Button>
              </form>

              <div className="space-y-6">
                <Card className="sticky top-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-primary" />
                      {t.creationSummary}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      {t.summaryItems.map((item) => (
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
          </>
        )}
      </div>
    </div>
  );
};

export default OwnerAccess;
