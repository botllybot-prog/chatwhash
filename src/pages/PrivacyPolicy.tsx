import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppLanguage } from "@/lib/language";

const updatedAt = "2026-05-25";

const content = {
  ar: {
    back: "العودة إلى المزيد",
    title: "سياسة الخصوصية",
    subtitle: "توضح هذه السياسة كيف تجمع واشلي البيانات وتستخدمها لحجز خدمات غسل السيارات وإدارة المحطات.",
    lastUpdated: "آخر تحديث",
    sections: [
      {
        title: "1. البيانات التي نجمعها",
        body: "نجمع اسم الزبون، رقم الهاتف، موقع الحجز عند استخدام الخريطة أو الحجز السريع، تفاصيل الحجز، الخدمة المطلوبة، تقييمات الخدمة، وبيانات الجهاز الأساسية اللازمة لتشغيل الويب كتفضيل اللغة وحالة الجلسة. بالنسبة لصاحب المحطة قد نجمع الاسم، رقم الهاتف، معلومات المحطة، العنوان، الموقع على الخريطة، أوقات العمل، الخدمات، الأسعار، وصورة المحطة عند إضافتها.",
      },
      {
        title: "2. طريقة استخدام البيانات",
        body: "نستخدم البيانات لإنشاء الحسابات، إظهار المحطات القريبة، إرسال الحجوزات للمحطات، عرض حالة القبول أو الرفض أو التأجيل داخل صندوق البريد، تشغيل التنبيهات داخل التطبيق أو الويب، حساب التقييمات، تحسين جودة الخدمة، منع سوء الاستخدام، وتقديم دعم فني أو رسائل إدارية عند الحاجة.",
      },
      {
        title: "3. الموقع الجغرافي",
        body: "يطلب واشلي إذن الوصول للموقع فقط عندما يضغط المستخدم على زر تحديد الموقع أو يبدأ حجزا يحتاج إلى معرفة المحطات القريبة. لا يتم استخدام الموقع لتتبع مستمر في الخلفية. يمكن للمستخدم إيقاف إذن الموقع من إعدادات المتصفح أو الهاتف في أي وقت.",
      },
      {
        title: "4. مشاركة البيانات",
        body: "نشارك بيانات الحجز الضرورية فقط بين الزبون والمحطة المختارة، مثل الاسم ورقم الهاتف ورقم الحجز ووقت الحجز والخدمة. لا نبيع بيانات المستخدمين. قد نستخدم مزودي خدمات مثل Supabase وخرائط Google وخدمات الإشعارات لتشغيل المنصة وحفظ البيانات بصورة آمنة.",
      },
      {
        title: "5. الإشعارات والرسائل",
        body: "تعمل الإشعارات داخل الويب أو التطبيق لإبلاغ الزبون وصاحب المحطة بالحجوزات والتأكيدات والإلغاء والتأجيل. قد تستخدم واشلي واتساب أو رسائل إدارية فقط لأغراض مثل الاشتراكات، التفعيل، التنبيهات الإدارية، أو الدعم عند الحاجة.",
      },
      {
        title: "6. حفظ البيانات وأمانها",
        body: "نحتفظ بالبيانات طالما كانت لازمة لتشغيل الحسابات والحجوزات والتقارير والدعم. يتم حفظ البيانات في قاعدة بيانات محمية، ونستخدم صلاحيات وصول محددة حتى لا يصل كل طرف إلا للبيانات اللازمة لدوره.",
      },
      {
        title: "7. حقوق المستخدم",
        body: "يمكن للمستخدم طلب تعديل اسمه، تحديث بيانات المحطة، حذف أو تعطيل حسابه عند الإمكان، أو التواصل مع الإدارة بشأن أي خطأ في البيانات. قد نحتفظ ببعض السجلات إذا كانت لازمة للأمان أو الالتزامات التشغيلية.",
      },
      {
        title: "8. التواصل",
        body: "لأي استفسار بخصوص الخصوصية أو حذف البيانات أو تصحيحها، يمكن التواصل مع إدارة واشلي على الرقم: 07836635435.",
      },
    ],
  },
  en: {
    back: "Back to More",
    title: "Privacy Policy",
    subtitle: "This policy explains how Washlly collects and uses data for car wash booking and station management.",
    lastUpdated: "Last updated",
    sections: [
      {
        title: "1. Data We Collect",
        body: "We collect customer name, phone number, booking location when using the map or quick booking, booking details, requested service, service ratings, and basic web data such as language preference and session state. For station owners, we may collect owner name, phone number, station information, address, map location, working hours, services, prices, and station image when provided.",
      },
      {
        title: "2. How We Use Data",
        body: "We use data to create accounts, show nearby stations, send bookings to stations, display approval, rejection, cancellation, or postponement status in the inbox, run in-app/web notifications, calculate ratings, improve service quality, prevent misuse, and provide support or administrative messages when needed.",
      },
      {
        title: "3. Location",
        body: "Washlly asks for location permission only when the user taps the location button or starts a booking that needs nearby stations. We do not use continuous background location tracking. Users can disable location permission from browser or device settings at any time.",
      },
      {
        title: "4. Data Sharing",
        body: "We share only necessary booking data between the customer and selected station, such as name, phone number, booking number, booking time, and service. We do not sell user data. We may use providers such as Supabase, Google Maps, and notification services to operate the platform securely.",
      },
      {
        title: "5. Notifications and Messages",
        body: "Web or app notifications inform customers and station owners about bookings, confirmations, cancellations, and postponements. Washlly may use WhatsApp or administrative messages only for subscriptions, activation, administrative alerts, or support when needed.",
      },
      {
        title: "6. Retention and Security",
        body: "We keep data as long as needed to operate accounts, bookings, reports, and support. Data is stored in a protected database, and access permissions are limited so each party can access only the data needed for its role.",
      },
      {
        title: "7. User Rights",
        body: "Users can request name correction, station information updates, account deletion or deactivation where possible, or contact administration about inaccurate data. Some records may be retained when needed for security or operational obligations.",
      },
      {
        title: "8. Contact",
        body: "For privacy questions, data deletion, or correction requests, contact Washlly administration at: 07836635435.",
      },
    ],
  },
} as const;

const PrivacyPolicy = () => {
  const { language, isRtl } = useAppLanguage();
  const t = language === "ar" || language === "ku" ? content.ar : content.en;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-4xl space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to="/more" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            {t.back}
          </Link>
        </Button>

        <section className="rounded-3xl bg-gradient-to-br from-blue-700 via-sky-700 to-cyan-600 p-6 text-white shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-3xl font-black">{t.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50">{t.subtitle}</p>
          <p className="mt-4 text-xs text-blue-100">
            {t.lastUpdated}: {updatedAt}
          </p>
        </section>

        <Card className="border-blue-100 shadow-sm">
          <CardContent className="space-y-6 p-5 md:p-8">
            {t.sections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
                <p className="leading-8 text-muted-foreground">{section.body}</p>
              </section>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
