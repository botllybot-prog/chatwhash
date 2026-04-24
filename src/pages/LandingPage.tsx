import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Car, Droplets, Clock, MapPin, Star, Shield, Phone,
  MessageSquare, ChevronDown, Sparkles, Waves, CheckCircle,
  BarChart3, Bell, Users, Zap, ArrowLeft
} from "lucide-react";

/* ─── Animated Section Wrapper ─── */
const Section = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

/* ─── Floating Bubbles Background ─── */
const Bubbles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(8)].map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full bg-ocean-200/20"
        style={{
          width: `${12 + Math.random() * 30}px`,
          height: `${12 + Math.random() * 30}px`,
          left: `${10 + Math.random() * 80}%`,
          bottom: `-${10 + Math.random() * 30}px`,
          animation: `bubble ${7 + Math.random() * 6}s ease-in infinite`,
          animationDelay: `${Math.random() * 5}s`,
        }}
      />
    ))}
  </div>
);

/* ─── Wave Divider SVG ─── */
const WaveDivider = ({ flip = false, color = "hsl(var(--ocean-50))" }: { flip?: boolean; color?: string }) => (
  <div className={`w-full overflow-hidden leading-[0] ${flip ? "rotate-180" : ""}`}>
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-[60px] md:h-[100px]">
      <path
        d="M0,40 C360,100 720,0 1080,60 C1260,90 1380,40 1440,50 L1440,120 L0,120 Z"
        fill={color}
      />
    </svg>
  </div>
);

/* ─── Sparkle Effect ─── */
const SparkleEffect = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(6)].map((_, i) => (
      <Sparkles
        key={i}
        className="absolute text-sparkle animate-sparkle"
        style={{
          width: "16px",
          top: `${15 + Math.random() * 70}%`,
          left: `${5 + Math.random() * 90}%`,
          animationDelay: `${Math.random() * 3}s`,
        }}
      />
    ))}
  </div>
);

/* ─── Feature Card ─── */
const FeatureCard = ({ icon, title, desc, delay = 0 }: { icon: React.ReactNode; title: string; desc: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, boxShadow: "0 20px 40px -12px hsl(var(--ocean-500) / 0.15)" }}
      className="group relative bg-card rounded-2xl p-6 border border-border hover:border-ocean-300 transition-colors duration-300"
    >
      <div className="w-12 h-12 rounded-xl bg-ocean-100 flex items-center justify-center mb-4 group-hover:bg-ocean-200 transition-colors">
        {icon}
      </div>
      <h3 className="text-lg font-bold font-cairo text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
    </motion.div>
  );
};

/* ─── Stat Counter ─── */
const StatCounter = ({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const dur = 1800;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, value]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl md:text-4xl font-black font-cairo text-ocean-500">
        {count.toLocaleString()}{suffix}
      </p>
      <p className="text-muted-foreground text-sm mt-1">{label}</p>
    </div>
  );
};

/* ─── Step Component ─── */
const Step = ({ number, title, desc, delay = 0 }: { number: number; title: string; desc: string; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="flex gap-4 items-start"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-ocean-500 text-primary-foreground flex items-center justify-center font-bold font-cairo text-lg shadow-lg shadow-ocean-500/30">
        {number}
      </div>
      <div>
        <h4 className="font-bold font-cairo text-foreground text-base mb-1">{title}</h4>
        <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════ MAIN LANDING PAGE ═══════════════════════ */
const LandingPage = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <div className="bg-background overflow-x-hidden" dir="rtl">

      {/* ─── Hero Section ─── */}
      <section ref={heroRef} className="relative min-h-[80vh] flex items-center justify-center pt-8 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-ocean-50 via-background to-background" />

        {/* Animated waves background */}
        <div className="absolute bottom-0 left-0 right-0 h-64 overflow-hidden">
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full animate-wave-slow opacity-20" preserveAspectRatio="none">
            <path fill="hsl(var(--ocean-300))" d="M0,192L48,186.7C96,181,192,171,288,186.7C384,203,480,245,576,250.7C672,256,768,224,864,192C960,160,1056,128,1152,133.3C1248,139,1344,181,1392,202.7L1440,224L1440,320L0,320Z" />
          </svg>
          <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full animate-wave-medium opacity-15" preserveAspectRatio="none">
            <path fill="hsl(var(--ocean-400))" d="M0,256L48,240C96,224,192,192,288,181.3C384,171,480,181,576,202.7C672,224,768,256,864,261.3C960,267,1056,245,1152,224C1248,203,1344,181,1392,170.7L1440,160L1440,320L0,320Z" />
          </svg>
        </div>

        <Bubbles />
        <SparkleEffect />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 bg-ocean-100 border border-ocean-200 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="h-4 w-4 text-ocean-500" />
              <span className="text-sm font-medium text-ocean-700">منصة ذكية لغسيل السيارات</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-4xl sm:text-5xl md:text-7xl font-black font-cairo text-foreground leading-tight mb-6"
          >
            سيارتك تستحق
            <span className="block bg-gradient-to-l from-ocean-400 via-ocean-500 to-ocean-600 bg-clip-text text-transparent">
              عناية استثنائية
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            احجز موعد غسيل سيارتك عبر واتساب بثوانٍ معدودة. اختر المحطة الأقرب، 
            حدد الخدمة المناسبة، واستلم سيارتك نظيفة بدون أي انتظار.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button
              size="lg"
              onClick={() => navigate("/map")}
              className="bg-ocean-500 hover:bg-ocean-600 text-white text-base px-8 py-6 rounded-2xl shadow-xl shadow-ocean-500/30 hover:shadow-ocean-500/40 transition-all"
            >
              <MapPin className="h-5 w-5 ml-2" />
              اكتشف المحطات القريبة
            </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/owner")}
                className="text-ocean-600 border-ocean-200 hover:bg-ocean-50 text-base px-8 py-6 rounded-2xl"
              >
                <Users className="h-5 w-5 ml-2" />
                سجل محطتك الآن
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                const el = document.getElementById("how-it-works");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-ocean-600 border-ocean-200 hover:bg-ocean-50 text-base px-8 py-6 rounded-2xl"
            >
              كيف يعمل؟
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-16"
          >
            <ChevronDown className="h-6 w-6 text-ocean-300 mx-auto animate-bounce" />
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Stats Bar ─── */}
      <Section className="relative z-10 -mt-8 mb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-xl border border-border p-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCounter value={50} suffix="+" label="محطة متاحة" />
            <StatCounter value={1200} suffix="+" label="حجز مكتمل" />
            <StatCounter value={98} suffix="%" label="رضا العملاء" />
            <StatCounter value={3} label="ثوانٍ للحجز" />
          </div>
        </div>
      </Section>

      {/* ─── Features Section ─── */}
      <section id="features" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4">
          <Section className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-ocean-100 border border-ocean-200 rounded-full px-4 py-1.5 mb-4">
              <Zap className="h-4 w-4 text-ocean-500" />
              <span className="text-sm font-medium text-ocean-700">لماذا واشلي؟</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black font-cairo text-foreground mb-4">مميزات تجعلنا مختلفين</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">نوفر تجربة متكاملة لأصحاب السيارات ومحطات الغسيل</p>
          </Section>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={<MessageSquare className="h-6 w-6 text-ocean-500" />} title="حجز عبر واتساب" desc="احجز موعدك مباشرة عبر واتساب بمحادثة ذكية تفاعلية. بدون تحميل تطبيقات إضافية." delay={0} />
            <FeatureCard icon={<MapPin className="h-6 w-6 text-ocean-500" />} title="أقرب محطة لك" desc="خريطة تفاعلية تعرض جميع محطات الغسيل القريبة مع تفاصيل الخدمات والأسعار." delay={0.1} />
            <FeatureCard icon={<Clock className="h-6 w-6 text-ocean-500" />} title="بدون انتظار" desc="حدد موعدك مسبقاً واستلم سيارتك جاهزة. لا طوابير ولا تأخير." delay={0.2} />
            <FeatureCard icon={<Shield className="h-6 w-6 text-ocean-500" />} title="خدمة مضمونة" desc="محطات مختارة بعناية مع تقييمات العملاء لضمان أعلى مستوى جودة." delay={0.3} />
            <FeatureCard icon={<Bell className="h-6 w-6 text-ocean-500" />} title="تذكير تلقائي" desc="إشعارات تذكيرية قبل موعدك لضمان عدم نسيان حجزك." delay={0.4} />
            <FeatureCard icon={<Droplets className="h-6 w-6 text-ocean-500" />} title="خدمات متنوعة" desc="من الغسيل الخارجي البسيط إلى التنظيف الداخلي الشامل والتلميع." delay={0.5} />
          </div>
        </div>
      </section>

      <WaveDivider color="hsl(var(--ocean-50))" />

      {/* ─── For Car Owners ─── */}
      <section id="car-owners" className="py-20 bg-ocean-50 relative">
        <SparkleEffect />
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Section>
              <div className="inline-flex items-center gap-2 bg-ocean-200/60 rounded-full px-4 py-1.5 mb-4">
                <Car className="h-4 w-4 text-ocean-600" />
                <span className="text-sm font-medium text-ocean-700">لأصحاب السيارات</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black font-cairo text-foreground mb-6">
                غسيل سيارتك
                <span className="text-ocean-500"> أسهل من أي وقت</span>
              </h2>
              <div className="space-y-4">
                {[
                  { icon: <MessageSquare className="h-5 w-5" />, text: "أرسل رسالة واتساب واحجز في ثوانٍ" },
                  { icon: <MapPin className="h-5 w-5" />, text: "اعثر على أقرب محطة بسهولة عبر الخريطة" },
                  { icon: <Clock className="h-5 w-5" />, text: "اختر الوقت المناسب لك بدون انتظار" },
                  { icon: <Star className="h-5 w-5" />, text: "خدمات متنوعة وأسعار شفافة" },
                  { icon: <Bell className="h-5 w-5" />, text: "تذكيرات تلقائية قبل الموعد" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 bg-card rounded-xl px-4 py-3 border border-border"
                  >
                    <div className="w-9 h-9 rounded-lg bg-ocean-100 flex items-center justify-center text-ocean-500 flex-shrink-0">
                      {item.icon}
                    </div>
                    <span className="text-foreground text-sm font-medium">{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </Section>

            <Section delay={0.2} className="flex justify-center">
              {/* Decorative phone mockup */}
              <div className="relative">
                <div className="w-64 h-[500px] bg-ocean-800 rounded-[2.5rem] p-3 shadow-2xl shadow-ocean-900/40 relative overflow-hidden">
                  {/* Phone screen */}
                  <div className="w-full h-full rounded-[2rem] bg-gradient-to-b from-ocean-600 to-ocean-700 overflow-hidden relative">
                    {/* Status bar */}
                    <div className="flex justify-between items-center px-6 pt-4 pb-2">
                      <span className="text-white/80 text-[10px]">9:41</span>
                      <div className="w-20 h-5 bg-ocean-900 rounded-full" />
                      <span className="text-white/80 text-[10px]">100%</span>
                    </div>
                    {/* WhatsApp-like chat */}
                    <div className="px-3 pt-2 space-y-2">
                      <div className="bg-white/20 backdrop-blur rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%] mr-auto">
                        <p className="text-white text-xs">مرحباً! أريد حجز غسيل لسيارتي 🚗</p>
                      </div>
                      <div className="bg-ocean-400/50 backdrop-blur rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%] ml-auto">
                        <p className="text-white text-xs">أهلاً بك! 👋 اختر المحطة:</p>
                        <div className="mt-1 space-y-1">
                          {["محطة الكرادة", "محطة المنصور", "محطة الزيونة"].map((s, i) => (
                            <div key={i} className="bg-white/15 rounded-lg px-2 py-1 text-[10px] text-white/90">{i + 1}. {s}</div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white/20 backdrop-blur rounded-2xl rounded-tr-sm px-3 py-2 max-w-[60%] mr-auto">
                        <p className="text-white text-xs">1</p>
                      </div>
                      <div className="bg-ocean-400/50 backdrop-blur rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%] ml-auto">
                        <p className="text-white text-xs">تم حجزك بنجاح! ✅</p>
                        <p className="text-white/70 text-[10px] mt-1">📅 الأحد 20 مارس - 10:00 ص</p>
                      </div>
                    </div>
                    {/* Sparkle overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-ocean-800/30 to-transparent pointer-events-none" />
                  </div>
                </div>
                {/* Floating decorations */}
                <div className="absolute -top-4 -right-4 w-16 h-16 bg-ocean-200 rounded-2xl rotate-12 animate-float opacity-60" />
                <div className="absolute -bottom-3 -left-3 w-12 h-12 bg-sparkle/30 rounded-full animate-float" style={{ animationDelay: "2s" }} />
              </div>
            </Section>
          </div>
        </div>
      </section>

      <WaveDivider flip color="hsl(var(--ocean-50))" />

      {/* ─── For Stations ─── */}
      <section id="stations" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Section delay={0.1} className="order-2 lg:order-1 flex justify-center">
              {/* Dashboard mockup */}
              <div className="relative w-full max-w-md">
                <div className="bg-card rounded-2xl border border-border shadow-2xl shadow-ocean-500/10 overflow-hidden">
                  {/* Header */}
                  <div className="bg-ocean-600 px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-white font-bold text-sm font-cairo">لوحة تحكم المحطة</span>
                  </div>
                  {/* Stats */}
                  <div className="p-4 grid grid-cols-3 gap-3">
                    {[
                      { label: "حجوزات اليوم", val: "12" },
                      { label: "إيرادات اليوم", val: "180K" },
                      { label: "تقييم", val: "4.8⭐" },
                    ].map((s, i) => (
                      <div key={i} className="bg-ocean-50 rounded-xl p-3 text-center">
                        <p className="text-ocean-600 font-bold font-cairo text-lg">{s.val}</p>
                        <p className="text-muted-foreground text-[10px]">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Recent bookings */}
                  <div className="px-4 pb-4">
                    <p className="text-xs font-bold text-foreground mb-2 font-cairo">آخر الحجوزات</p>
                    {[
                      { name: "أحمد م.", service: "غسيل شامل", status: "مؤكد" },
                      { name: "سارة ع.", service: "غسيل خارجي", status: "معلق" },
                      { name: "محمد ك.", service: "تلميع", status: "مكتمل" },
                    ].map((b, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-xs">
                        <span className="font-medium text-foreground">{b.name}</span>
                        <span className="text-muted-foreground">{b.service}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${b.status === "مؤكد" ? "bg-ocean-100 text-ocean-700" : b.status === "معلق" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Floating notifications */}
                <motion.div
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="absolute -left-6 top-10 bg-card border border-border rounded-xl p-3 shadow-xl flex items-center gap-2 max-w-[180px]"
                >
                  <div className="w-7 h-7 bg-ocean-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bell className="h-3.5 w-3.5 text-ocean-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-foreground">حجز جديد!</p>
                    <p className="text-[9px] text-muted-foreground">غسيل شامل — الآن</p>
                  </div>
                </motion.div>
              </div>
            </Section>

            <Section className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-ocean-100 border border-ocean-200 rounded-full px-4 py-1.5 mb-4">
                <Users className="h-4 w-4 text-ocean-600" />
                <span className="text-sm font-medium text-ocean-700">لأصحاب المحطات</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black font-cairo text-foreground mb-6">
                أدر محطتك
                <span className="text-ocean-500"> باحترافية كاملة</span>
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                لوحة تحكم ذكية تمنحك رؤية شاملة لحجوزاتك، إيراداتك، وخدماتك. 
                استقبل الإشعارات فوراً وتابع أداء محطتك بسهولة.
              </p>
              <div className="space-y-3">
                {[
                  "لوحة تحكم شاملة بالإحصائيات والرسوم البيانية",
                  "إشعارات فورية عبر واتساب لكل حجز جديد",
                  "إدارة الخدمات والأسعار وساعات العمل",
                  "تقارير مفصلة للإيرادات والأداء",
                  "ظهور محطتك على خريطة التطبيق التفاعلية",
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle className="h-5 w-5 text-ocean-500 flex-shrink-0" />
                    <span className="text-foreground text-sm">{item}</span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-8">
                <Button
                  size="lg"
                  onClick={() => navigate("/owner")}
                  className="bg-ocean-500 hover:bg-ocean-600 text-white px-8 py-6 rounded-2xl shadow-lg shadow-ocean-500/25"
                >
                  سجّل محطتك الآن
                  <ArrowLeft className="h-4 w-4 mr-2" />
                </Button>
              </div>
            </Section>
          </div>
        </div>
      </section>

      <WaveDivider color="hsl(var(--ocean-800))" />

      {/* ─── How it Works ─── */}
      <section id="how-it-works" className="py-20 bg-ocean-800 text-white relative overflow-hidden">
        <Bubbles />
        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <Section className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-4">
              <Waves className="h-4 w-4 text-ocean-300" />
              <span className="text-sm font-medium text-ocean-200">خطوات بسيطة</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black font-cairo mb-4">كيف يعمل واشلي؟</h2>
            <p className="text-ocean-200 max-w-lg mx-auto">ثلاث خطوات فقط تفصلك عن سيارة نظيفة ولامعة</p>
          </Section>

          <div className="space-y-8 max-w-md mx-auto">
            <Step number={1} title="أرسل رسالة واتساب" desc="افتح واتساب وأرسل 'مرحبا' لرقمنا. البوت الذكي سيرحب بك ويعرض المحطات المتاحة." delay={0.1} />
            <Step number={2} title="اختر المحطة والخدمة" desc="حدد المحطة الأقرب لك، اختر الخدمة المناسبة (غسيل خارجي، شامل، تلميع...)، ثم اختر الموعد." delay={0.2} />
            <Step number={3} title="استلم سيارتك نظيفة!" desc="اذهب في الموعد المحدد، لا انتظار ولا طوابير. ستصلك رسالة تذكير قبل الموعد." delay={0.3} />
          </div>
        </div>
      </section>

      <WaveDivider flip color="hsl(var(--ocean-800))" />

      {/* ─── CTA Section ─── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-ocean-50/50 to-background" />
        <SparkleEffect />
        <Section className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-black font-cairo text-foreground mb-6">
            جاهز تجرب
            <span className="text-ocean-500"> واشلي</span>؟
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            انضم لآلاف العملاء الذين يحجزون مواعيد غسيل سياراتهم بسهولة تامة. 
            أو سجّل محطتك وابدأ باستقبال الحجوزات اليوم.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/map")}
              className="bg-ocean-500 hover:bg-ocean-600 text-white text-base px-10 py-6 rounded-2xl shadow-xl shadow-ocean-500/30 hover:shadow-ocean-500/40"
            >
              <Car className="h-5 w-5 ml-2" />
              احجز الآن
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/owner")}
              className="text-ocean-600 border-ocean-200 hover:bg-ocean-50 text-base px-10 py-6 rounded-2xl"
            >
              <Users className="h-5 w-5 ml-2" />
              سجّل محطتك
            </Button>
          </div>
        </Section>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-ocean-900 text-ocean-200 py-12 border-t border-ocean-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-ocean-500 flex items-center justify-center">
                  <Car className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold font-cairo text-white">واشلي</span>
              </div>
              <p className="text-ocean-300 text-sm leading-relaxed">
                منصة ذكية تربط أصحاب السيارات بمحطات الغسيل، 
                توفر تجربة حجز سلسة وإدارة متكاملة.
              </p>
            </div>
            <div>
              <h4 className="font-bold font-cairo text-white mb-3">روابط سريعة</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">المميزات</a></li>
                <li><a href="#car-owners" className="hover:text-white transition-colors">أصحاب السيارات</a></li>
                <li><a href="#stations" className="hover:text-white transition-colors">أصحاب المحطات</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">كيف يعمل</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold font-cairo text-white mb-3">تواصل معنا</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>+964 XXX XXX XXXX</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>واتساب: +964 XXX XXX XXXX</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-ocean-800 pt-6 text-center text-xs text-ocean-400">
            <p>© {new Date().getFullYear()} واشلي. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
