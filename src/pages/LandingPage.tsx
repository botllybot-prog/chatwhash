import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, Bell, Car, CheckCircle, Clock, Droplets, MapPin, MessageSquare, Shield, Sparkles, Star, Users, Waves, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppLanguage } from "@/lib/language";
import { supabase } from "@/integrations/supabase/client";

const texts = {
  ar: {
    badge: "منصة ذكية لغسيل السيارات",
    heroTitle1: "سيارتك تستحق",
    heroTitle2: "عناية استثنائية",
    heroDescription: "احجز موعد غسيل سيارتك خلال ثوانٍ. اختر المحطة الأقرب، حدد الخدمة المناسبة، واستلم سيارتك نظيفة بدون انتظار.",
    exploreStations: "اكتشف المحطات القريبة",
    registerStation: "سجل محطتك الآن",
    howItWorksButton: "كيف يعمل؟",
    stats: [
      { value: "50+", label: "محطة متاحة" },
      { value: "1,200+", label: "حجز مكتمل" },
      { value: "98%", label: "رضا العملاء" },
      { value: "3", label: "ثوانٍ للحجز" },
    ],
    featuresBadge: "لماذا واشللي",
    featuresTitle: "تجربة أسرع للعميل وإدارة أوضح للمحطة",
    featuresDescription: "كل ما يحتاجه العميل وصاحب المحطة في مسار واحد من الخريطة إلى التأكيد والإشعار والمتابعة.",
    features: [
      { title: "حجز سريع", desc: "اختر المحطة والخدمة والوقت من الخريطة بخطوات واضحة.", icon: Clock },
      { title: "موقع مباشر", desc: "شاهد المحطات الأقرب لك وتفاصيل كل محطة قبل الحجز.", icon: MapPin },
      { title: "واتساب تلقائي", desc: "إشعارات فورية للعميل وصاحب المحطة بعد كل إجراء.", icon: MessageSquare },
      { title: "أمان ووضوح", desc: "تأكيدات واضحة، إلغاء مباشر، وتتبع أسهل للحجز.", icon: Shield },
      { title: "خدمات متعددة", desc: "كل محطة تعرض خدماتها وأسعارها وخصوماتها بشكل واضح.", icon: Droplets },
      { title: "إدارة ذكية", desc: "لوحة تحكم للمحطة مع الحجوزات والإيرادات والتنبيهات.", icon: Zap },
    ],
    ownersBadge: "لأصحاب المحطات",
    ownersTitle1: "أدر محطتك",
    ownersTitle2: "باحترافية كاملة",
    ownersDescription: "أنشئ حسابك، أضف موقع المحطة، حدّد خدماتك وأسعارك، واستقبل الحجوزات من الخريطة مع موافقات فورية عبر واتساب.",
    ownersList: [
      "ظهور محطتك على الخريطة مباشرة",
      "إدارة الخدمات والأسعار وساعات العمل",
      "تنبيهات واتساب للحجوزات والتأكيد والإلغاء",
      "لوحة إدارة للإيرادات والأداء",
    ],
    howBadge: "خطوات بسيطة",
    howTitle: "كيف يعمل واشللي؟",
    howDescription: "ثلاث خطوات فقط من اختيار المحطة إلى استلام سيارة نظيفة.",
    howSteps: [
      { title: "اختر المحطة", desc: "افتح الخريطة وحدد المحطة الأقرب أو الأنسب لك." },
      { title: "اختر الخدمة والوقت", desc: "راجع الخدمات والأسعار ثم حدد اليوم والوقت المناسب." },
      { title: "أكد واستلم الإشعار", desc: "يصل الطلب إلى صاحب المحطة ويصلك إشعار النتيجة على واتساب." },
    ],
    ctaTitle1: "جاهز لتجربة",
    ctaTitle2: "واشللي",
    ctaDescription: "سواء كنت عميلاً تريد حجزاً أسرع أو صاحب محطة يريد إدارة أوضح، كل شيء جاهز الآن.",
    bookNow: "احجز الآن",
    footerDescription: "منصة تربط أصحاب السيارات بمحطات الغسيل بحجز سهل، متابعة واضحة، وإدارة متكاملة.",
    quickLinks: "روابط سريعة",
    contactUs: "تواصل معنا",
    links: ["المميزات", "أصحاب المحطات", "كيف يعمل", "الخريطة"],
    copyright: "جميع الحقوق محفوظة.",
    dashboardLabel: "لوحة تحكم المحطة",
    bookingsToday: "حجوزات اليوم",
    revenueToday: "إيرادات اليوم",
    rating: "تقييم",
    latestBookings: "آخر الحجوزات",
    confirmed: "مؤكد",
    pending: "معلق",
    completed: "مكتمل",
    newBooking: "حجز جديد!",
    fullWash: "غسيل شامل",
    now: "الآن",
  },
  en: {
    badge: "Smart car wash platform",
    heroTitle1: "Your car deserves",
    heroTitle2: "exceptional care",
    heroDescription: "Book your car wash in seconds. Choose the nearest station, pick the right service, and get your car back clean without waiting.",
    exploreStations: "Explore nearby stations",
    registerStation: "Register your station",
    howItWorksButton: "How it works",
    stats: [
      { value: "50+", label: "Available stations" },
      { value: "1,200+", label: "Completed bookings" },
      { value: "98%", label: "Customer satisfaction" },
      { value: "3", label: "Seconds to book" },
    ],
    featuresBadge: "Why Washlly",
    featuresTitle: "Faster booking for customers and clearer management for stations",
    featuresDescription: "Everything the customer and station owner need in one smooth flow from map to confirmation and notifications.",
    features: [
      { title: "Fast booking", desc: "Choose the station, service, and time from the map in clear steps.", icon: Clock },
      { title: "Live location", desc: "See the nearest stations and their details before booking.", icon: MapPin },
      { title: "Automatic WhatsApp", desc: "Instant notifications for customers and station owners after every action.", icon: MessageSquare },
      { title: "Secure and clear", desc: "Clear confirmations, direct cancellation, and easier booking tracking.", icon: Shield },
      { title: "Multiple services", desc: "Every station shows its services, prices, and discounts clearly.", icon: Droplets },
      { title: "Smart management", desc: "A control panel for bookings, revenue, and alerts.", icon: Zap },
    ],
    ownersBadge: "For station owners",
    ownersTitle1: "Manage your station",
    ownersTitle2: "professionally",
    ownersDescription: "Create your account, add your station location, define services and prices, and receive map bookings with instant WhatsApp approvals.",
    ownersList: [
      "Show your station directly on the map",
      "Manage services, prices, and working hours",
      "WhatsApp alerts for booking, confirmation, and cancellation",
      "A dashboard for revenue and performance",
    ],
    howBadge: "Simple steps",
    howTitle: "How Washlly works",
    howDescription: "Only three steps from choosing a station to receiving a clean car.",
    howSteps: [
      { title: "Choose the station", desc: "Open the map and select the nearest or best station for you." },
      { title: "Choose service and time", desc: "Review prices and services, then choose the day and time that fit you." },
      { title: "Confirm and get notified", desc: "The request goes to the station owner and you receive the result on WhatsApp." },
    ],
    ctaTitle1: "Ready to try",
    ctaTitle2: "Washlly",
    ctaDescription: "Whether you are a customer who wants faster booking or a station owner who wants better management, everything is ready now.",
    bookNow: "Book now",
    footerDescription: "A platform connecting car owners with wash stations through easy booking, clear follow-up, and complete management.",
    quickLinks: "Quick links",
    contactUs: "Contact us",
    links: ["Features", "Station owners", "How it works", "Map"],
    copyright: "All rights reserved.",
    dashboardLabel: "Station dashboard",
    bookingsToday: "Today's bookings",
    revenueToday: "Today's revenue",
    rating: "Rating",
    latestBookings: "Latest bookings",
    confirmed: "Confirmed",
    pending: "Pending",
    completed: "Completed",
    newBooking: "New booking!",
    fullWash: "Full wash",
    now: "Now",
  },
  ku: {
    badge: "پلاتفۆرمی زیرەکی شۆردنی ئۆتۆمبێل",
    heroTitle1: "ئۆتۆمبێلەکەت شایەنی",
    heroTitle2: "چاودێری تایبەتە",
    heroDescription: "چند چرکەیەکدا کاتی شۆردن حجز بکە. نزیکترین وێستگە هەڵبژێرە، خزمەتگوزارییەکە دیاری بکە و بێ چاوەڕوانی ئۆتۆمبێلەکەت پاک وەرگرە.",
    exploreStations: "وێستگە نزیکەکان ببینە",
    registerStation: "وێستگەکەت تۆمار بکە",
    howItWorksButton: "چۆن کار دەکات؟",
    stats: [
      { value: "50+", label: "وێستگەی بەردەست" },
      { value: "1,200+", label: "حجزی تەواوبوو" },
      { value: "98%", label: "ڕازیبوونی کڕیار" },
      { value: "3", label: "چرکە بۆ حجز" },
    ],
    featuresBadge: "بۆچی واشللی",
    featuresTitle: "حجزی خێراتر بۆ کڕیار و بەڕێوەبردنی ڕوونتر بۆ وێستگە",
    featuresDescription: "هەموو ئەوەی کڕیار و خاوەن وێستگە پێویستیانە لە یەک ڕێگادا لە نەخشە تا پشتڕاستکردنەوە و ئاگادارکردنەوە.",
    features: [
      { title: "حجزی خێرا", desc: "وێستگە و خزمەتگوزاری و کات لەسەر نەخشە بە هەنگاوە ڕوونەکان هەڵبژێرە.", icon: Clock },
      { title: "شوێنی ڕاستەوخۆ", desc: "وێستگە نزیکەکان و وردەکارییەکانیان پێش حجز ببینە.", icon: MapPin },
      { title: "واتساپی خۆکار", desc: "ئاگادارکردنەوەی خێرا بۆ کڕیار و خاوەن وێستگە دوای هەر کردارێک.", icon: MessageSquare },
      { title: "پاراستن و ڕوونی", desc: "پشتڕاستکردنەوەی ڕوون، هەڵوەشاندنەوەی ڕاستەوخۆ، و شوێنکەوتنی ئاسانتر.", icon: Shield },
      { title: "خزمەتگوزاریی جۆراوجۆر", desc: "هەر وێستگەیەک خزمەتگوزاری و نرخ و داشکاندنی خۆی بە ڕوونی پیشان دەدات.", icon: Droplets },
      { title: "بەڕێوەبردنی زیرەک", desc: "داشبۆردێک بۆ حجز و داهات و ئاگادارکردنەوە.", icon: Zap },
    ],
    ownersBadge: "بۆ خاوەن وێستگەکان",
    ownersTitle1: "وێستگەکەت بەڕێوە بەرە",
    ownersTitle2: "بە شێوەیەکی پیشەیی",
    ownersDescription: "هەژمارەکەت دروست بکە، شوێنی وێستگە زیاد بکە، خزمەتگوزاری و نرخ دیاری بکە و حجزەکانی نەخشە وەرگرە لەگەڵ پشتڕاستکردنەوەی خێرای واتساپ.",
    ownersList: [
      "پیشاندانی وێستگەکەت ڕاستەوخۆ لەسەر نەخشە",
      "بەڕێوەبردنی خزمەتگوزاری و نرخ و کاتی کار",
      "ئاگادارکردنەوەی واتساپ بۆ حجز و پشتڕاستکردنەوە و هەڵوەشاندنەوە",
      "داشبۆرد بۆ داهات و کارایی",
    ],
    howBadge: "هەنگاوە سادەکان",
    howTitle: "Washlly چۆن کار دەکات",
    howDescription: "تەنها سێ هەنگاو لە هەڵبژاردنی وێستگە تا وەرگرتنی ئۆتۆمبێلێکی پاک.",
    howSteps: [
      { title: "وێستگە هەڵبژێرە", desc: "نەخشە بکەرەوە و نزیکترین یان گونجاوترین وێستگە هەڵبژێرە." },
      { title: "خزمەتگوزاری و کات هەڵبژێرە", desc: "نرخ و خزمەتگوزاری ببینە و ڕۆژ و کاتێک دیاری بکە کە بۆت گونجاوە." },
      { title: "پشتڕاست بکە و ئاگاداربە", desc: "داواکارییەکە دەگاتە خاوەن وێستگە و تۆ لە واتساپ ئەنجامەکە وەردەگریت." },
    ],
    ctaTitle1: "ئامادەیت بۆ تاقیکردنەوەی",
    ctaTitle2: "Washlly",
    ctaDescription: "ئەگەر کڕیاری خێراتر دەوێت یان خاوەن وێستگەیەکی بەڕێوەبردنی باشتر، هەموو شتێک ئامادەیە.",
    bookNow: "ئێستا حجز بکە",
    footerDescription: "پلاتفۆرمێک کە خاوەن ئۆتۆمبێل بە وێستگەکانی شۆردن دەبەستێتەوە بە حجزی ئاسان و شوێنکەوتنی ڕوون و بەڕێوەبردنی تەواو.",
    quickLinks: "بەستەرە خێراکان",
    contactUs: "پەیوەندیمان پێوە بکە",
    links: ["تایبەتمەندییەکان", "خاوەن وێستگەکان", "چۆن کار دەکات", "نەخشە"],
    copyright: "هەموو مافەکان پارێزراون.",
    dashboardLabel: "داشبۆردی وێستگە",
    bookingsToday: "حجزەکانی ئەمڕۆ",
    revenueToday: "داهاتی ئەمڕۆ",
    rating: "هەڵسەنگاندن",
    latestBookings: "دوایین حجزەکان",
    confirmed: "پشتڕاستکراوە",
    pending: "چاوەڕوان",
    completed: "تەواوبوو",
    newBooking: "حجزی نوێ!",
    fullWash: "شۆردنی تەواو",
    now: "ئێستا",
  },
  tr: {
    badge: "Akıllı araç yıkama platformu",
    heroTitle1: "Aracınız",
    heroTitle2: "özel bakımı hak ediyor",
    heroDescription: "Araba yıkamanızı saniyeler içinde ayırtın. En yakın istasyonu seçin, uygun hizmeti belirleyin ve aracınızı beklemeden tertemiz teslim alın.",
    exploreStations: "Yakındaki istasyonları keşfet",
    registerStation: "İstasyonunu kaydet",
    howItWorksButton: "Nasıl çalışır?",
    stats: [
      { value: "50+", label: "Müsait istasyon" },
      { value: "1,200+", label: "Tamamlanan rezervasyon" },
      { value: "98%", label: "Müşteri memnuniyeti" },
      { value: "3", label: "Rezervasyon için saniye" },
    ],
    featuresBadge: "Neden Washlly",
    featuresTitle: "Müşteri için daha hızlı rezervasyon, istasyon için daha net yönetim",
    featuresDescription: "Haritadan onaya ve bildirime kadar müşteri ve istasyon sahibi için gereken her şey tek akışta.",
    features: [
      { title: "Hızlı rezervasyon", desc: "İstasyonu, hizmeti ve saati harita üzerinden net adımlarla seçin.", icon: Clock },
      { title: "Canlı konum", desc: "Rezervasyon öncesi size en yakın istasyonları ve detaylarını görün.", icon: MapPin },
      { title: "Otomatik WhatsApp", desc: "Her işlemden sonra müşteri ve istasyon sahibine anında bildirim gider.", icon: MessageSquare },
      { title: "Güvenli ve net", desc: "Net onaylar, doğrudan iptal ve daha kolay rezervasyon takibi.", icon: Shield },
      { title: "Birden fazla hizmet", desc: "Her istasyon hizmetlerini, fiyatlarını ve indirimlerini açıkça gösterir.", icon: Droplets },
      { title: "Akıllı yönetim", desc: "Rezervasyonlar, gelirler ve bildirimler için kontrol paneli.", icon: Zap },
    ],
    ownersBadge: "İstasyon sahipleri için",
    ownersTitle1: "İstasyonunu yönet",
    ownersTitle2: "profesyonelce",
    ownersDescription: "Hesabını oluştur, istasyon konumunu ekle, hizmetlerini ve fiyatlarını belirle, anlık WhatsApp onaylarıyla harita rezervasyonlarını al.",
    ownersList: [
      "İstasyonun haritada hemen görünsün",
      "Hizmetleri, fiyatları ve çalışma saatlerini yönet",
      "Rezervasyon, onay ve iptal için WhatsApp uyarıları",
      "Gelir ve performans için yönetim paneli",
    ],
    howBadge: "Basit adımlar",
    howTitle: "Washlly nasıl çalışır",
    howDescription: "İstasyon seçiminden temiz aracınızı almaya kadar sadece üç adım.",
    howSteps: [
      { title: "İstasyonu seç", desc: "Haritayı aç ve sana en yakın ya da en uygun istasyonu seç." },
      { title: "Hizmet ve saati seç", desc: "Fiyatları ve hizmetleri incele, sonra sana uygun gün ve saati belirle." },
      { title: "Onayla ve bildirimi al", desc: "Talep istasyon sahibine gider ve sonucu WhatsApp üzerinden alırsın." },
    ],
    ctaTitle1: "Denemeye hazır mısın",
    ctaTitle2: "Washlly",
    ctaDescription: "İster daha hızlı rezervasyon isteyen bir müşteri olun, ister daha iyi yönetim isteyen bir istasyon sahibi; her şey hazır.",
    bookNow: "Şimdi ayırt",
    footerDescription: "Araç sahiplerini yıkama istasyonlarıyla kolay rezervasyon, net takip ve tam yönetimle buluşturan platform.",
    quickLinks: "Hızlı bağlantılar",
    contactUs: "Bize ulaşın",
    links: ["Özellikler", "İstasyon sahipleri", "Nasıl çalışır", "Harita"],
    copyright: "Tüm hakları saklıdır.",
    dashboardLabel: "İstasyon paneli",
    bookingsToday: "Bugünkü rezervasyonlar",
    revenueToday: "Bugünkü gelir",
    rating: "Puan",
    latestBookings: "Son rezervasyonlar",
    confirmed: "Onaylandı",
    pending: "Beklemede",
    completed: "Tamamlandı",
    newBooking: "Yeni rezervasyon!",
    fullWash: "Tam yıkama",
    now: "Şimdi",
  },
} as const;

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];
  const [footerInfo, setFooterInfo] = useState({
    whatsapp: "+9647736939153",
    email: "info@washlly.com",
  });

  const [liveStats, setLiveStats] = useState({
    activeStations: 50,
    completedBookings: 1200,
  });

  useEffect(() => {
    const loadPublicData = async () => {
      const [{ data: settingsData }, { count: activeStations }, { count: completedBookings }] = await Promise.all([
        (supabase as any)
          .from("app_settings")
          .select("key, value")
          .in("key", ["PUBLIC_CONTACT_WHATSAPP", "PUBLIC_CONTACT_EMAIL"]),
        (supabase as any)
          .from("stations")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        (supabase as any)
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed"),
      ]);

      if (settingsData) {
        const map = Object.fromEntries((settingsData as { key: string; value: string }[]).map((row) => [row.key, row.value]));
        setFooterInfo({
          whatsapp: map.PUBLIC_CONTACT_WHATSAPP || "+9647736939153",
          email: map.PUBLIC_CONTACT_EMAIL || "info@washlly.com",
        });
      }

      setLiveStats({
        activeStations: activeStations || 50,
        completedBookings: completedBookings || 1200,
      });
    };

    loadPublicData();
  }, []);

  const statsToRender = t.stats.map((item, index) => {
    if (index === 0) return { ...item, value: `+${liveStats.activeStations}` };
    if (index === 1) return { ...item, value: `+${liveStats.completedBookings}` };
    return item;
  });

  return (
    <div className="bg-background overflow-x-hidden" dir={isRtl ? "rtl" : "ltr"}>
      <section className="relative overflow-hidden bg-gradient-to-b from-ocean-50 via-background to-background">
        <div className="absolute inset-0 opacity-60">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-ocean-200 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-ocean-100 blur-3xl" />
          <div className="absolute right-0 top-1/4 h-56 w-56 rounded-full bg-sky-100 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 md:py-28">
          <motion.div {...fadeUp} className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-ocean-200 bg-ocean-100 px-4 py-2 text-sm font-medium text-ocean-700">
              <Sparkles className="h-4 w-4" />
              {t.badge}
            </div>
            <h1 className="mb-6 text-4xl font-black leading-[1.12] text-foreground sm:text-5xl md:text-7xl">
              {t.heroTitle1}
              <span className="relative -mt-1 block bg-gradient-to-l from-ocean-400 via-ocean-500 to-ocean-600 bg-clip-text pt-2 text-transparent md:-mt-2 md:pt-3">
                {t.heroTitle2}
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {t.heroDescription}
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/map")} className="rounded-2xl bg-ocean-500 px-8 py-6 text-base text-white shadow-xl shadow-ocean-500/30 hover:bg-ocean-600">
                <MapPin className="ml-2 h-5 w-5" />
                {t.exploreStations}
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate("/owner")} className="rounded-2xl border-ocean-200 px-8 py-6 text-base text-ocean-700 hover:bg-ocean-50">
                <Users className="ml-2 h-5 w-5" />
                {t.registerStation}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} className="rounded-2xl px-6 py-6 text-base text-ocean-700">
                {t.howItWorksButton}
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>

          <motion.div {...fadeUp} transition={{ delay: 0.15, duration: 0.6 }} className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-4 rounded-[2rem] border border-border/60 bg-card/80 p-6 shadow-xl shadow-ocean-500/10 backdrop-blur md:grid-cols-4">
            {statsToRender.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-3xl font-black text-ocean-500 md:text-5xl">{item.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <motion.div {...fadeUp} className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ocean-200 bg-ocean-100 px-4 py-1.5 text-sm font-medium text-ocean-700">
              <Waves className="h-4 w-4" />
              {t.featuresBadge}
            </div>
            <h2 className="mb-4 text-3xl font-black text-foreground md:text-4xl">{t.featuresTitle}</h2>
            <p className="mx-auto max-w-3xl text-muted-foreground">{t.featuresDescription}</p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {t.features.map((feature, index) => (
              <motion.div key={feature.title} {...fadeUp} transition={{ duration: 0.5, delay: index * 0.06 }} className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ocean-100 text-ocean-600">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ocean-900 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-2">
          <motion.div {...fadeUp} className="order-2 lg:order-1">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
              <div className="mb-5 flex items-center gap-3 rounded-2xl bg-ocean-600 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold">{t.dashboardLabel}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t.bookingsToday, value: "12" },
                  { label: t.revenueToday, value: "180K" },
                  { label: t.rating, value: "4.8" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-white/10 p-4 text-center">
                    <p className="text-2xl font-black text-white">{item.value}</p>
                    <p className="mt-1 text-xs text-ocean-100">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-white/5 p-4">
                <p className="mb-3 text-sm font-bold">{t.latestBookings}</p>
                {[
                  { name: "أحمد م.", service: t.fullWash, status: t.confirmed },
                  { name: "سارة ع.", service: "Exterior", status: t.pending },
                  { name: "محمد ك.", service: "Polish", status: t.completed },
                ].map((booking, index) => (
                  <div key={`${booking.name}-${index}`} className="flex items-center justify-between border-b border-white/10 py-3 last:border-b-0">
                    <span className="text-sm">{booking.name}</span>
                    <span className="text-xs text-ocean-100">{booking.service}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[11px]">{booking.status}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <Bell className="h-4 w-4 text-yellow-300" />
                <div>
                  <p className="text-sm font-bold">{t.newBooking}</p>
                  <p className="text-xs text-ocean-100">{t.fullWash} - {t.now}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeUp} className="order-1 lg:order-2">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-ocean-100">
              <Users className="h-4 w-4" />
              {t.ownersBadge}
            </div>
            <h2 className="mb-6 text-3xl font-black md:text-5xl">
              {t.ownersTitle1}
              <span className="text-ocean-300"> {t.ownersTitle2}</span>
            </h2>
            <p className="mb-8 leading-relaxed text-ocean-100">{t.ownersDescription}</p>
            <div className="space-y-3">
              {t.ownersList.map((item, index) => (
                <motion.div key={item} {...fadeUp} transition={{ duration: 0.45, delay: index * 0.06 }} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-ocean-300" />
                  <span className="text-sm text-white">{item}</span>
                </motion.div>
              ))}
            </div>
            <Button size="lg" onClick={() => navigate("/owner")} className="mt-8 rounded-2xl bg-white px-8 py-6 text-base text-ocean-700 hover:bg-ocean-50">
              {t.registerStation}
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <motion.div {...fadeUp} className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ocean-200 bg-ocean-100 px-4 py-1.5 text-sm font-medium text-ocean-700">
              <Sparkles className="h-4 w-4" />
              {t.howBadge}
            </div>
            <h2 className="mb-4 text-3xl font-black text-foreground md:text-4xl">{t.howTitle}</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">{t.howDescription}</p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-3">
            {t.howSteps.map((step, index) => (
              <motion.div key={step.title} {...fadeUp} transition={{ duration: 0.5, delay: index * 0.07 }} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ocean-500 text-lg font-black text-white">
                  {index + 1}
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4">
          <motion.div {...fadeUp} className="rounded-[2rem] border border-border bg-gradient-to-br from-ocean-50 to-card p-8 text-center shadow-xl shadow-ocean-500/10 md:p-12">
            <h2 className="mb-4 text-3xl font-black text-foreground md:text-5xl">
              {t.ctaTitle1} <span className="text-ocean-500">{t.ctaTitle2}</span>
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-muted-foreground">{t.ctaDescription}</p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/map")} className="rounded-2xl bg-ocean-500 px-8 py-6 text-base text-white hover:bg-ocean-600">
                <Car className="ml-2 h-5 w-5" />
                {t.bookNow}
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate("/owner")} className="rounded-2xl border-ocean-200 px-8 py-6 text-base text-ocean-700 hover:bg-ocean-50">
                <Users className="ml-2 h-5 w-5" />
                {t.registerStation}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50 py-12 text-slate-900">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-500">
                <Car className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-950">Washlly</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-800">{t.footerDescription}</p>
          </div>
          <div>
            <h4 className="mb-3 font-bold text-slate-950">{t.quickLinks}</h4>
            <ul className="space-y-2 text-sm text-slate-800">
              {t.links.map((link) => (
                <li key={link}>{link}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-bold text-slate-950">{t.contactUs}</h4>
            <div className="space-y-2 text-sm text-slate-900">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-ocean-600" />
                <span dir="ltr">WhatsApp: {footerInfo.whatsapp}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-ocean-600" />
                <span dir="ltr">{footerInfo.email}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-slate-200 px-4 pt-6 text-center text-xs text-slate-700">
          © {new Date().getFullYear()} Washlly. {t.copyright}
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

