import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Store, CalendarCheck, Bell, Pencil, Wrench, LogOut, Clock, MapPin, Image, LayoutDashboard, TrendingUp, Hourglass, CheckCircle, Key, CreditCard, AlertTriangle, Wallet, Sparkles, Gift } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAppLanguage } from "@/lib/language";

const texts = {
  ar: {
    error: "خطأ",
    passwordShort: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
    passwordMismatch: "كلمتا المرور غير متطابقتين",
    success: "تم بنجاح",
    passwordChanged: "تم تغيير كلمة المرور",
    changePassword: "تغيير كلمة المرور",
    newPassword: "كلمة المرور الجديدة",
    newPasswordPh: "أدخل كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور",
    confirmPasswordPh: "أعد إدخال كلمة المرور",
    saving: "جاري الحفظ...",
    todayBookings: "حجوزات اليوم",
    bookingWord: "حجز",
    todayRevenue: "إيرادات اليوم",
    pendingBookings: "حجوزات معلقة",
    waitingConfirm: "بانتظار التأكيد",
    completedBookings: "حجوزات مكتملة",
    totalWord: "إجمالي",
    weekRevenue: "إيرادات الأسبوع",
    last7Days: "آخر 7 أيام",
    totalBookings: "إجمالي الحجوزات",
    sinceStart: "منذ البداية",
    stats: "الإحصائيات",
    dailyRevenue: "الإيرادات اليومية — آخر 30 يوم",
    revenue: "الإيرادات",
    stationName: "اسم المحطة",
    address: "العنوان",
    detailedAddress: "العنوان التفصيلي",
    workStart: "بداية ساعات العمل",
    workEnd: "نهاية ساعات العمل",
    schedulingType: "نوع المواعيد",
    stationImage: "صورة المحطة",
    editRequestSent: "تم إرسال طلب التعديل",
    editRequestReview: "سيتم مراجعته من قبل الإدارة",
    loading: "جاري التحميل...",
    slots: "فترات ثابتة",
    instant: "فوري",
    daily: "يومي",
    imageExists: "موجودة",
    imageMissing: "غير موجودة",
    stationInfo: "معلومات المحطة",
    status: "الحالة",
    active: "مفعّلة",
    inactive: "معطلة",
    editRequestFor: "طلب تعديل:",
    editRequestSr: "طلب تعديل بيانات المحطة",
    currentValue: "القيمة الحالية",
    field: "الحقل",
    newValue: "القيمة الجديدة",
    newValuePh: "أدخل القيمة الجديدة",
    sendEditRequest: "إرسال طلب التعديل",
    stationServices: "خدمات المحطة",
    service: "الخدمة",
    price: "السعر",
    duration: "المدة",
    scope: "النطاق",
    minutes: "دقيقة",
    privateScope: "خاصة",
    publicScope: "عامة",
    noServices: "لا توجد خدمات",
    newBooking: "📢 حجز جديد!",
    bookingReceived: "تم استلام حجز جديد",
    statusUpdated: "تم تحديث الحالة",
    pending: "قيد الانتظار",
    confirmed: "مؤكد",
    completed: "مكتمل",
    cancelled: "ملغي",
    bookings: "الحجوزات",
    allStatuses: "جميع الحالات",
    customer: "العميل",
    date: "التاريخ",
    time: "الوقت",
    action: "إجراء",
    noBookings: "لا توجد حجوزات",
    notifications: "الإشعارات",
    markAllRead: "تحديد الكل كمقروء",
    noNotifications: "لا توجد إشعارات",
    editRequests: "طلبات التعديل",
    note: "ملاحظة",
    noRequests: "لا توجد طلبات",
    noSubscription: "لا يوجد اشتراك حالي لهذه المحطة.",
    contactAdminSubscription: "تواصل مع الإدارة لتفعيل اشتراك.",
    basic: "أساسي",
    pro: "متقدم",
    premium: "مميز",
    trial: "تجريبي",
    paid: "مدفوع",
    paymentPending: "معلّق",
    failed: "فاشل",
    refunded: "مسترد",
    subscriptionDetails: "تفاصيل الاشتراك",
    plan: "الخطة",
    amount: "المبلغ",
    startDate: "تاريخ البدء",
    endDate: "تاريخ الانتهاء",
    remainingDuration: "المدة المتبقية",
    day: "يوم",
    expired: "منتهي",
    expiringSoon: "اشتراكك ينتهي قريباً! تواصل مع الإدارة للتجديد قبل تعطيل المحطة تلقائياً.",
    expiredMsg: "اشتراكك منتهي. تواصل مع الإدارة لتجديد الاشتراك وإعادة تفعيل المحطة.",
    paymentsHistory: "سجل الدفعات",
    method: "الطريقة",
    notes: "ملاحظات",
    noLinkedStation: "لم يتم ربط حسابك بأي محطة.",
    portalTitle: "لوحة المحطة",
    logout: "تسجيل الخروج",
    dashboard: "الإحصائيات",
    station: "المحطة",
    subscription: "الاشتراك",
    account: "الحساب",
  },
  en: {
    error: "Error",
    passwordShort: "Password must be at least 6 characters",
    passwordMismatch: "Passwords do not match",
    success: "Done",
    passwordChanged: "Password updated successfully",
    changePassword: "Change password",
    newPassword: "New password",
    newPasswordPh: "Enter the new password",
    confirmPassword: "Confirm password",
    confirmPasswordPh: "Re-enter the password",
    saving: "Saving...",
    todayBookings: "Today's bookings",
    bookingWord: "booking",
    todayRevenue: "Today's revenue",
    pendingBookings: "Pending bookings",
    waitingConfirm: "Waiting for confirmation",
    completedBookings: "Completed bookings",
    totalWord: "total",
    weekRevenue: "Weekly revenue",
    last7Days: "Last 7 days",
    totalBookings: "Total bookings",
    sinceStart: "Since launch",
    stats: "Statistics",
    dailyRevenue: "Daily revenue — last 30 days",
    revenue: "Revenue",
    stationName: "Station name",
    address: "Address",
    detailedAddress: "Detailed address",
    workStart: "Working hours start",
    workEnd: "Working hours end",
    schedulingType: "Scheduling type",
    stationImage: "Station image",
    editRequestSent: "Edit request sent",
    editRequestReview: "The admin team will review it",
    loading: "Loading...",
    slots: "Fixed slots",
    instant: "Instant",
    daily: "Daily",
    imageExists: "Available",
    imageMissing: "Not available",
    stationInfo: "Station information",
    status: "Status",
    active: "Active",
    inactive: "Disabled",
    editRequestFor: "Edit request:",
    editRequestSr: "Request a station information change",
    currentValue: "Current value",
    field: "Field",
    newValue: "New value",
    newValuePh: "Enter the new value",
    sendEditRequest: "Send edit request",
    stationServices: "Station services",
    service: "Service",
    price: "Price",
    duration: "Duration",
    scope: "Scope",
    minutes: "minutes",
    privateScope: "Private",
    publicScope: "Public",
    noServices: "No services found",
    newBooking: "📢 New booking!",
    bookingReceived: "A new booking was received",
    statusUpdated: "Status updated",
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    bookings: "Bookings",
    allStatuses: "All statuses",
    customer: "Customer",
    date: "Date",
    time: "Time",
    action: "Action",
    noBookings: "No bookings found",
    notifications: "Notifications",
    markAllRead: "Mark all as read",
    noNotifications: "No notifications yet",
    editRequests: "Edit requests",
    note: "Note",
    noRequests: "No requests found",
    noSubscription: "There is no active subscription for this station.",
    contactAdminSubscription: "Contact the admin team to activate one.",
    basic: "Basic",
    pro: "Pro",
    premium: "Premium",
    trial: "Trial",
    paid: "Paid",
    paymentPending: "Pending",
    failed: "Failed",
    refunded: "Refunded",
    subscriptionDetails: "Subscription details",
    plan: "Plan",
    amount: "Amount",
    startDate: "Start date",
    endDate: "End date",
    remainingDuration: "Remaining time",
    day: "day",
    expired: "Expired",
    expiringSoon: "Your subscription is ending soon. Contact the admin team before the station gets disabled automatically.",
    expiredMsg: "Your subscription has expired. Contact the admin team to renew it and reactivate the station.",
    paymentsHistory: "Payment history",
    method: "Method",
    notes: "Notes",
    noLinkedStation: "Your account is not linked to any station.",
    portalTitle: "Station portal",
    logout: "Log out",
    dashboard: "Dashboard",
    station: "Station",
    subscription: "Subscription",
    account: "Account",
  },
  ku: {
    error: "هەڵە",
    passwordShort: "وشەی نهێنی دەبێت لانیکەم 6 پیت بێت",
    passwordMismatch: "وشە نهێنییەکان ناگونجێن",
    success: "سەرکەوتوو بوو",
    passwordChanged: "وشەی نهێنی نوێ کرایەوە",
    changePassword: "گۆڕینی وشەی نهێنی",
    newPassword: "وشەی نهێنی نوێ",
    newPasswordPh: "وشەی نهێنی نوێ بنووسە",
    confirmPassword: "دووبارەکردنەوەی وشەی نهێنی",
    confirmPasswordPh: "وشەی نهێنی دووبارە بنووسە",
    saving: "پاشەکەوت دەکرێت...",
    todayBookings: "حجزی ئەمڕۆ",
    bookingWord: "حجز",
    todayRevenue: "داهاتی ئەمڕۆ",
    pendingBookings: "حجزە چاوەڕوانەکان",
    waitingConfirm: "چاوەڕوانی پشتڕاستکردنەوە",
    completedBookings: "حجزە تەواوبووەکان",
    totalWord: "کۆ",
    weekRevenue: "داهاتی هەفتە",
    last7Days: "7 ڕۆژی دواوە",
    totalBookings: "کۆی حجزەکان",
    sinceStart: "لە سەرەتاوە",
    stats: "ئامارەکان",
    dailyRevenue: "داهاتی ڕۆژانە — 30 ڕۆژی دواوە",
    revenue: "داهات",
    stationName: "ناوی وێستگە",
    address: "ناونیشان",
    detailedAddress: "ناونیشانی ورد",
    workStart: "دەستی کار",
    workEnd: "کۆتایی کار",
    schedulingType: "جۆری کاتبەندی",
    stationImage: "وێنەی وێستگە",
    editRequestSent: "داواکاریی دەستکاری نێردرا",
    editRequestReview: "لە لایەن بەڕێوەبەرایەتییەوە پشکنین دەکرێت",
    loading: "بارکردن...",
    slots: "کاتی جێگیر",
    instant: "خێرا",
    daily: "ڕۆژانە",
    imageExists: "هەیە",
    imageMissing: "نییە",
    stationInfo: "زانیاریی وێستگە",
    status: "دۆخ",
    active: "چالاک",
    inactive: "ناچالاک",
    editRequestFor: "داواکاریی دەستکاری:",
    editRequestSr: "داواکاریی گۆڕینی زانیاریی وێستگە",
    currentValue: "بەهای ئێستا",
    field: "خانە",
    newValue: "بەهای نوێ",
    newValuePh: "بەهای نوێ بنووسە",
    sendEditRequest: "ناردنی داواکاریی دەستکاری",
    stationServices: "خزمەتگوزارییەکانی وێستگە",
    service: "خزمەتگوزاری",
    price: "نرخ",
    duration: "ماوە",
    scope: "مەودا",
    minutes: "خولەک",
    privateScope: "تایبەت",
    publicScope: "گشتی",
    noServices: "هیچ خزمەتگوزارییەک نییە",
    newBooking: "📢 حجزی نوێ!",
    bookingReceived: "حجزێکی نوێ وەرگیرا",
    statusUpdated: "دۆخ نوێ کرایەوە",
    pending: "چاوەڕوان",
    confirmed: "پشتڕاستکراوە",
    completed: "تەواوبوو",
    cancelled: "هەڵوەشاوە",
    bookings: "حجزەکان",
    allStatuses: "هەموو دۆخەکان",
    customer: "کڕیار",
    date: "بەروار",
    time: "کات",
    action: "کردار",
    noBookings: "هیچ حجزێک نییە",
    notifications: "ئاگادارکردنەوەکان",
    markAllRead: "هەمووی وەک خوێندراوە دیاری بکە",
    noNotifications: "هیچ ئاگادارکردنەوەیەک نییە",
    editRequests: "داواکارییەکانی دەستکاری",
    note: "تێبینی",
    noRequests: "هیچ داواکارییەک نییە",
    noSubscription: "هیچ ئابوونەیەکی چالاک بۆ ئەم وێستگەیە نییە.",
    contactAdminSubscription: "پەیوەندی بە بەڕێوەبەرایەتی بکە بۆ چالاککردنی.",
    basic: "بنەڕەتی",
    pro: "پێشکەوتوو",
    premium: "تایبەت",
    trial: "تاقیکردنەوە",
    paid: "پارەدراو",
    paymentPending: "لە چاوەڕوانیدا",
    failed: "سەرنەکەوتوو",
    refunded: "گەڕاوە",
    subscriptionDetails: "وردەکاریی ئابوونە",
    plan: "پلان",
    amount: "بڕ",
    startDate: "بەرواری دەستپێک",
    endDate: "بەرواری کۆتایی",
    remainingDuration: "ماوەی ماوەوە",
    day: "ڕۆژ",
    expired: "بەسەرچوو",
    expiringSoon: "ئابوونەکەت نزیکە لە کۆتایی. پەیوەندی بە بەڕێوەبەرایەتی بکە پێش ناچالاکبوونی خۆکار.",
    expiredMsg: "ئابوونەکەت بەسەرچووە. پەیوەندی بە بەڕێوەبەرایەتی بکە بۆ نوێکردنەوە و چالاککردنەوەی وێستگە.",
    paymentsHistory: "مێژووی پارەدان",
    method: "شێواز",
    notes: "تێبینی",
    noLinkedStation: "هەژمارەکەت بە هیچ وێستگەیەک نەبەستراوە.",
    portalTitle: "پۆرتاڵی وێستگە",
    logout: "چوونەدەرەوە",
    dashboard: "ئامارەکان",
    station: "وێستگە",
    subscription: "ئابوونە",
    account: "هەژمار",
  },
  tr: {
    error: "Hata",
    passwordShort: "Şifre en az 6 karakter olmalıdır",
    passwordMismatch: "Şifreler eşleşmiyor",
    success: "Tamamlandı",
    passwordChanged: "Şifre başarıyla değiştirildi",
    changePassword: "Şifreyi değiştir",
    newPassword: "Yeni şifre",
    newPasswordPh: "Yeni şifreyi girin",
    confirmPassword: "Şifreyi doğrula",
    confirmPasswordPh: "Şifreyi tekrar girin",
    saving: "Kaydediliyor...",
    todayBookings: "Bugünkü rezervasyonlar",
    bookingWord: "rezervasyon",
    todayRevenue: "Bugünkü gelir",
    pendingBookings: "Bekleyen rezervasyonlar",
    waitingConfirm: "Onay bekliyor",
    completedBookings: "Tamamlanan rezervasyonlar",
    totalWord: "toplam",
    weekRevenue: "Haftalık gelir",
    last7Days: "Son 7 gün",
    totalBookings: "Toplam rezervasyon",
    sinceStart: "Başlangıçtan bu yana",
    stats: "İstatistikler",
    dailyRevenue: "Günlük gelir — son 30 gün",
    revenue: "Gelir",
    stationName: "İstasyon adı",
    address: "Adres",
    detailedAddress: "Detaylı adres",
    workStart: "Çalışma başlangıcı",
    workEnd: "Çalışma bitişi",
    schedulingType: "Randevu tipi",
    stationImage: "İstasyon görseli",
    editRequestSent: "Düzenleme talebi gönderildi",
    editRequestReview: "Yönetim ekibi tarafından incelenecek",
    loading: "Yükleniyor...",
    slots: "Sabit zamanlar",
    instant: "Anlık",
    daily: "Günlük",
    imageExists: "Var",
    imageMissing: "Yok",
    stationInfo: "İstasyon bilgileri",
    status: "Durum",
    active: "Etkin",
    inactive: "Devre dışı",
    editRequestFor: "Düzenleme talebi:",
    editRequestSr: "İstasyon bilgisi düzenleme talebi",
    currentValue: "Mevcut değer",
    field: "Alan",
    newValue: "Yeni değer",
    newValuePh: "Yeni değeri girin",
    sendEditRequest: "Düzenleme talebi gönder",
    stationServices: "İstasyon hizmetleri",
    service: "Hizmet",
    price: "Fiyat",
    duration: "Süre",
    scope: "Kapsam",
    minutes: "dakika",
    privateScope: "Özel",
    publicScope: "Genel",
    noServices: "Hizmet yok",
    newBooking: "📢 Yeni rezervasyon!",
    bookingReceived: "Yeni rezervasyon alındı",
    statusUpdated: "Durum güncellendi",
    pending: "Bekliyor",
    confirmed: "Onaylandı",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    bookings: "Rezervasyonlar",
    allStatuses: "Tüm durumlar",
    customer: "Müşteri",
    date: "Tarih",
    time: "Saat",
    action: "İşlem",
    noBookings: "Rezervasyon yok",
    notifications: "Bildirimler",
    markAllRead: "Hepsini okundu işaretle",
    noNotifications: "Bildirim yok",
    editRequests: "Düzenleme talepleri",
    note: "Not",
    noRequests: "Talep yok",
    noSubscription: "Bu istasyon için aktif abonelik yok.",
    contactAdminSubscription: "Etkinleştirme için yönetimle iletişime geçin.",
    basic: "Temel",
    pro: "Pro",
    premium: "Premium",
    trial: "Deneme",
    paid: "Ödendi",
    paymentPending: "Beklemede",
    failed: "Başarısız",
    refunded: "İade edildi",
    subscriptionDetails: "Abonelik detayları",
    plan: "Plan",
    amount: "Tutar",
    startDate: "Başlangıç tarihi",
    endDate: "Bitiş tarihi",
    remainingDuration: "Kalan süre",
    day: "gün",
    expired: "Süresi doldu",
    expiringSoon: "Aboneliğiniz yakında bitecek. İstasyon otomatik olarak devre dışı kalmadan önce yönetimle iletişime geçin.",
    expiredMsg: "Aboneliğiniz sona erdi. Yenilemek ve istasyonu tekrar etkinleştirmek için yönetimle iletişime geçin.",
    paymentsHistory: "Ödeme geçmişi",
    method: "Yöntem",
    notes: "Notlar",
    noLinkedStation: "Hesabınız hiçbir istasyona bağlı değil.",
    portalTitle: "İstasyon portalı",
    logout: "Çıkış yap",
    dashboard: "İstatistikler",
    station: "İstasyon",
    subscription: "Abonelik",
    account: "Hesap",
  },
} as const;

type PortalTexts = typeof texts.ar;

const AccountTab = ({ t }: { t: PortalTexts }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: t.error, description: t.passwordShort, variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t.error, description: t.passwordMismatch, variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast({ title: t.error, description: error.message, variant: "destructive" });
    } else {
      toast({ title: t.success, description: t.passwordChanged });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{t.changePassword}</h3>
      <Card className="max-w-md">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2"><Label>{t.newPassword}</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t.newPasswordPh} /></div>
          <div className="space-y-2"><Label>{t.confirmPassword}</Label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.confirmPasswordPh} /></div>
          <Button onClick={handleChangePassword} disabled={saving || !newPassword || !confirmPassword} className="w-full">{saving ? t.saving : t.changePassword}</Button>
        </CardContent>
      </Card>
    </div>
  );
};

const StatsDashboard = ({ stationId, t, locale, isRtl }: { stationId: string; t: PortalTexts; locale: string; isRtl: boolean }) => {
  const [stats, setStats] = useState({ todayBookings: 0, todayRevenue: 0, pendingBookings: 0, completedBookings: 0, weekRevenue: 0, totalBookings: 0 });
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [todayRes, pendingRes, completedRes, weekRes, totalRes, last30Res] = await Promise.all([
        supabase.from("bookings").select("id, services(price)").eq("station_id", stationId).eq("booking_date", today).in("status", ["pending", "confirmed", "completed"] as any),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("station_id", stationId).eq("status", "pending" as any),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("station_id", stationId).eq("status", "completed" as any),
        supabase.from("bookings").select("id, services(price)").eq("station_id", stationId).gte("booking_date", weekAgo).in("status", ["confirmed", "completed"] as any),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("station_id", stationId),
        supabase.from("bookings").select("booking_date, services(price)").eq("station_id", stationId).gte("booking_date", thirtyDaysAgo).in("status", ["confirmed", "completed"] as any),
      ]);

      const todayBookings = todayRes.data?.length || 0;
      const todayRevenue = todayRes.data?.reduce((sum: number, b: any) => sum + ((b as any).services?.price || 0), 0) || 0;
      const weekRevenue = weekRes.data?.reduce((sum: number, b: any) => sum + ((b as any).services?.price || 0), 0) || 0;

      setStats({ todayBookings, todayRevenue, pendingBookings: pendingRes.count || 0, completedBookings: completedRes.count || 0, weekRevenue, totalBookings: totalRes.count || 0 });

      const revenueMap: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        revenueMap[d] = 0;
      }
      last30Res.data?.forEach((b: any) => {
        const date = b.booking_date;
        if (revenueMap[date] !== undefined) revenueMap[date] += b.services?.price || 0;
      });
      setDailyRevenue(Object.entries(revenueMap).map(([date, revenue]) => ({ date: new Date(date).toLocaleDateString(locale, { day: "numeric", month: "short" }), revenue })));
      setLoading(false);
    };
    load();
  }, [stationId, locale]);

  if (loading) return <p className="text-muted-foreground">{t.loading}</p>;

  const cards = [
    { title: t.todayBookings, value: stats.todayBookings, icon: <CalendarCheck className="h-5 w-5 text-primary" />, subtitle: t.bookingWord },
    { title: t.todayRevenue, value: `${stats.todayRevenue.toLocaleString()} د.ع`, icon: <TrendingUp className="h-5 w-5 text-primary" />, subtitle: "" },
    { title: t.pendingBookings, value: stats.pendingBookings, icon: <Hourglass className="h-5 w-5 text-amber-500" />, subtitle: t.waitingConfirm },
    { title: t.completedBookings, value: stats.completedBookings, icon: <CheckCircle className="h-5 w-5 text-emerald-500" />, subtitle: t.totalWord },
    { title: t.weekRevenue, value: `${stats.weekRevenue.toLocaleString()} د.ع`, icon: <TrendingUp className="h-5 w-5 text-primary" />, subtitle: t.last7Days },
    { title: t.totalBookings, value: stats.totalBookings, icon: <CalendarCheck className="h-5 w-5 text-muted-foreground" />, subtitle: t.sinceStart },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">{t.stats}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{cards.map((c, i) => <Card key={i}><CardContent className="pt-5 pb-4 px-5"><div className="flex items-center justify-between mb-2"><span className="text-sm text-muted-foreground">{c.title}</span>{c.icon}</div><p className="text-2xl font-bold text-foreground">{c.value}</p>{c.subtitle && <p className="text-xs text-muted-foreground mt-1">{c.subtitle}</p>}</CardContent></Card>)}</div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t.dailyRevenue}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyRevenue} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" interval={2} />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", direction: isRtl ? "rtl" : "ltr" }} labelStyle={{ color: "hsl(var(--foreground))" }} formatter={(value: number) => [`${value.toLocaleString()} د.ع`, t.revenue]} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StationInfoTab = ({ stationId, t }: { stationId: string; t: PortalTexts }) => {
  const [station, setStation] = useState<any>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("stations").select("*").eq("id", stationId).single();
    if (data) setStation(data);
  }, [stationId]);

  useEffect(() => { load(); }, [load]);

  const fieldLabels: Record<string, string> = {
    name: t.stationName,
    address: t.address,
    detailed_address: t.detailedAddress,
    working_hours_start: t.workStart,
    working_hours_end: t.workEnd,
    scheduling_type: t.schedulingType,
    image_url: t.stationImage,
  };

  const requestEdit = async () => {
    if (!editField || !editValue.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("edit_requests").insert({ station_id: stationId, requested_by: user.id, field_name: editField, old_value: station?.[editField] || "", new_value: editValue });
    toast({ title: t.editRequestSent, description: t.editRequestReview });
    setDialogOpen(false);
    setEditField(null);
    setEditValue("");
  };

  const openEditDialog = (field: string) => {
    setEditField(field);
    setEditValue(station?.[field] || "");
    setDialogOpen(true);
  };

  if (!station) return <p className="text-muted-foreground">{t.loading}</p>;

  const schedulingLabels: Record<string, string> = { slots: t.slots, instant: t.instant, daily: t.daily };
  const fields = [
    { key: "name", value: station.name, icon: <Store className="h-4 w-4" /> },
    { key: "address", value: station.address || "-", icon: <MapPin className="h-4 w-4" /> },
    { key: "detailed_address", value: station.detailed_address || "-", icon: <MapPin className="h-4 w-4" /> },
    { key: "working_hours_start", value: station.working_hours_start?.substring(0, 5), icon: <Clock className="h-4 w-4" /> },
    { key: "working_hours_end", value: station.working_hours_end?.substring(0, 5), icon: <Clock className="h-4 w-4" /> },
    { key: "scheduling_type", value: schedulingLabels[station.scheduling_type] || station.scheduling_type, icon: <CalendarCheck className="h-4 w-4" /> },
    { key: "image_url", value: station.image_url ? t.imageExists : t.imageMissing, icon: <Image className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{t.stationInfo}</h3>
      {station.image_url && <div className="w-full max-w-md rounded-lg overflow-hidden border border-border"><img src={station.image_url} alt={station.name} className="w-full h-48 object-cover" /></div>}
      <Card>
        <CardContent className="pt-6 space-y-3">
          {fields.map((f) => <div key={f.key} className="flex items-center justify-between py-2 border-b border-border last:border-0"><div className="flex items-center gap-2">{f.icon}<span className="text-muted-foreground text-sm">{fieldLabels[f.key]}</span></div><div className="flex items-center gap-2"><span className="font-medium text-foreground">{f.value}</span><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(f.key)}><Pencil className="h-3 w-3" /></Button></div></div>)}
          <div className="flex items-center justify-between py-2"><span className="text-muted-foreground text-sm">{t.status}</span><Badge variant={station.is_active ? "default" : "destructive"}>{station.is_active ? t.active : t.inactive}</Badge></div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{t.editRequestFor} {editField ? fieldLabels[editField] : ""}</DialogTitle><DialogDescription className="sr-only">{t.editRequestSr}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.currentValue}</Label><Input value={editField ? (station[editField] || "") : ""} disabled /></div>
            <div><Label>{t.newValue}</Label><Input value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder={t.newValuePh} /></div>
            <Button onClick={requestEdit} className="w-full">{t.sendEditRequest}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StationServicesTab = ({ stationId, t }: { stationId: string; t: PortalTexts }) => {
  const [services, setServices] = useState<any[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("services").select("*").or(`station_id.eq.${stationId},station_id.is.null`).eq("is_active", true).order("sort_order");
      if (data) setServices(data);
    };
    load();
  }, [stationId]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{t.stationServices}</h3>
      <Table>
        <TableHeader><TableRow><TableHead>{t.service}</TableHead><TableHead>{t.price}</TableHead><TableHead>{t.duration}</TableHead><TableHead>{t.scope}</TableHead></TableRow></TableHeader>
        <TableBody>
          {services.map((s) => <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.price} د.ع</TableCell><TableCell>{s.duration_minutes} {t.minutes}</TableCell><TableCell>{s.station_id ? t.privateScope : t.publicScope}</TableCell></TableRow>)}
          {services.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t.noServices}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

const StationBookingsTab = ({ stationId, t }: { stationId: string; t: PortalTexts }) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const statusLabels: Record<string, string> = { pending: t.pending, confirmed: t.confirmed, completed: t.completed, cancelled: t.cancelled };
  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pending: "secondary", confirmed: "default", completed: "outline", cancelled: "destructive" };

  const load = useCallback(async () => {
    let q = supabase.from("bookings").select("*, services(name, price)").eq("station_id", stationId).order("created_at", { ascending: false }).limit(100);
    if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
    const { data } = await q;
    if (data) setBookings(data);
  }, [stationId, filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel("station-bookings").on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings", filter: `station_id=eq.${stationId}` }, () => { load(); toast({ title: t.newBooking, description: t.bookingReceived }); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [stationId, load, t]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status: status as any }).eq("id", id);
    load();
    toast({ title: t.statusUpdated });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center flex-wrap">
        <h3 className="text-lg font-semibold text-foreground">{t.bookings}</h3>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t.status} /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t.allStatuses}</SelectItem><SelectItem value="pending">{t.pending}</SelectItem><SelectItem value="confirmed">{t.confirmed}</SelectItem><SelectItem value="completed">{t.completed}</SelectItem><SelectItem value="cancelled">{t.cancelled}</SelectItem></SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t.customer}</TableHead><TableHead>{t.service}</TableHead><TableHead>{t.date}</TableHead><TableHead>{t.time}</TableHead><TableHead>{t.status}</TableHead><TableHead>{t.action}</TableHead></TableRow></TableHeader>
        <TableBody>
          {bookings.map((b) => <TableRow key={b.id}><TableCell>#{b.booking_number}</TableCell><TableCell>{b.customer_name || b.customer_phone}</TableCell><TableCell>{(b as any).services?.name} - {(b as any).services?.price} د.ع</TableCell><TableCell>{b.booking_date}</TableCell><TableCell>{b.booking_time?.substring(0, 5) || "-"}</TableCell><TableCell><Badge variant={statusColors[b.status] || "secondary"}>{statusLabels[b.status] || b.status}</Badge></TableCell><TableCell><Select value={b.status} onValueChange={(v) => updateStatus(b.id, v)}><SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">{t.pending}</SelectItem><SelectItem value="confirmed">{t.confirmed}</SelectItem><SelectItem value="completed">{t.completed}</SelectItem><SelectItem value="cancelled">{t.cancelled}</SelectItem></SelectContent></Select></TableCell></TableRow>)}
          {bookings.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t.noBookings}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

const NotificationsTab = ({ t, locale, isRtl }: { t: PortalTexts; locale: string; isRtl: boolean }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setNotifications(data);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel("my-notifications").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => { load(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  };
  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    load();
  };
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{t.notifications} {unreadCount > 0 && <Badge className="mr-2">{unreadCount}</Badge>}</h3>
        {unreadCount > 0 && <Button variant="outline" size="sm" onClick={markAllRead}>{t.markAllRead}</Button>}
      </div>
      <div className="space-y-2">
        {notifications.map((n) => <Card key={n.id} className={`cursor-pointer transition-colors ${!n.is_read ? "border-primary bg-primary/5" : ""}`} onClick={() => !n.is_read && markRead(n.id)}><CardContent className="py-3 px-4"><div className="flex items-center justify-between"><div><p className="font-medium text-foreground text-sm">{n.title}</p><p className="text-muted-foreground text-xs mt-1">{n.body}</p></div><div className="text-xs text-muted-foreground whitespace-nowrap mr-4">{new Date(n.created_at).toLocaleDateString(locale)} {new Date(n.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</div></div></CardContent></Card>)}
        {notifications.length === 0 && <p className="text-center text-muted-foreground py-8">{t.noNotifications}</p>}
      </div>
    </div>
  );
};

const MyEditRequestsTab = ({ stationId, t, locale }: { stationId: string; t: PortalTexts; locale: string }) => {
  const [requests, setRequests] = useState<any[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("edit_requests").select("*").eq("requested_by", user.id).order("created_at", { ascending: false });
      if (data) setRequests(data);
    };
    load();
  }, [stationId]);

  const statusLabels: Record<string, string> = { pending: t.pending, approved: t.confirmed, rejected: t.cancelled };
  const statusColors: Record<string, "default" | "secondary" | "destructive"> = { pending: "secondary", approved: "default", rejected: "destructive" };
  const fieldLabels: Record<string, string> = { name: t.stationName, address: t.address, detailed_address: t.detailedAddress, working_hours_start: t.workStart, working_hours_end: t.workEnd, scheduling_type: t.schedulingType, image_url: t.stationImage };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{t.editRequests}</h3>
      <Table>
        <TableHeader><TableRow><TableHead>{t.field ?? "Field"}</TableHead><TableHead>{t.currentValue}</TableHead><TableHead>{t.newValue}</TableHead><TableHead>{t.status}</TableHead><TableHead>{t.note}</TableHead><TableHead>{t.date}</TableHead></TableRow></TableHeader>
        <TableBody>
          {requests.map((r) => <TableRow key={r.id}><TableCell>{fieldLabels[r.field_name] || r.field_name}</TableCell><TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{r.old_value || "-"}</TableCell><TableCell className="text-sm max-w-[150px] truncate">{r.new_value}</TableCell><TableCell><Badge variant={statusColors[r.status]}>{statusLabels[r.status]}</Badge></TableCell><TableCell className="text-sm">{r.admin_note || "-"}</TableCell><TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString(locale)}</TableCell></TableRow>)}
          {requests.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t.noRequests}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

const OWNER_PACKAGE_TEXTS = {
  ar: {
    title: "الاشتراكات والباقات",
    subtitle: "اختر الباقة المناسبة لمحطتك، وفعّلها لمدة 30 يوماً لتحافظ على ظهورك في الخريطة واستقبال الحجوزات الجديدة.",
    freeTitle: "الطلبات المجانية",
    freeHint: "يتم احتساب الطلبات المجانية أولاً، وبعد انتهائها تنتقل المحطة إلى الباقات المدفوعة.",
    used: "المستخدم",
    remaining: "المتبقي",
    total: "الإجمالي",
    packageTitle: "باقات الطلبات",
    packageHint: "كل باقة تبدأ من تاريخ الدفع وتبقى فعالة لمدة 30 يوماً.",
    validity: "مدة التفعيل",
    validityValue: "30 يوم",
    activePackage: "الباقة الحالية",
    requests: "الطلبات",
    requestProgress: "استهلاك الطلبات",
    expiresAt: "ينتهي في",
    noPackage: "لا توجد باقة فعالة حالياً. يمكنك اختيار باقة وتجديد الظهور في الخريطة بسهولة.",
    unlimited: "غير محدود",
    activeNow: "مفعلة الآن",
    choosePackage: "اختر باقتك التالية",
    paymentMethods: "طرق الدفع",
    paymentHint: "بعد الدفع، يقوم فريق Washlly بتفعيل الباقة على حسابك مباشرة. يمكنك أيضاً استخدام رابط البطاقة إن كان مفعلاً.",
    zainCash: "زين كاش",
    superKey: "سوبر كي",
    nasWallet: "ناس والت",
    cardLink: "الدفع بالبطاقة",
    openLink: "فتح الرابط",
    contactCompany: "التواصل مع الشركة",
    renewNow: "جدد باقتك الآن",
    selectPackage: "اختيار هذه الباقة",
    selectedPackage: "الباقة المختارة",
    choosePaymentMethod: "اختر طريقة الدفع",
    selectedPaymentMethod: "طريقة الدفع المختارة",
    paymentReference: "مرجع الدفع (اختياري)",
    paymentReferencePlaceholder: "مثال: آخر 4 أرقام أو اسم التحويل",
    cardPayNow: "ادفع الآن بالبطاقة",
    sendActivationRequest: "إرسال طلب التفعيل",
    requestHint: "اختر الباقة أولاً ثم اختر وسيلة الدفع. بعد التحويل اضغط إرسال طلب التفعيل ليصل طلبك إلى الشركة مباشرة.",
    requestReadyTitle: "جاهز لإرسال الطلب",
    requestReadyBody: "سيتم تضمين اسم الباقة وطريقة الدفع واسم المحطة في الرسالة المرسلة إلى الشركة.",
    history: "سجل الدفعات",
    noPayments: "لا توجد دفعات مسجلة حتى الآن.",
    packageEndedTitle: "انتهت الباقة الحالية",
    packageEndedBody: "تم إيقاف ظهور محطتك مؤقتاً إلى حين تجديد الباقة. جدد الآن للوصول إلى عدد أكبر من الزبائن.",
    freeEndedTitle: "انتهت الطلبات المجانية",
    freeEndedBody: "انتهت الطلبات المجانية الممنوحة لمحطتك. اختر إحدى الباقات للعودة إلى الخريطة واستقبال حجوزات جديدة.",
    expiredTitle: "انتهت مدة الاشتراك",
    expiredBody: "انتهت مدة الباقة الحالية. يمكنك التجديد الآن ليستمر ظهور محطتك واستقبال الطلبات الجديدة.",
    manualTitle: "المحطة موقوفة إدارياً",
    manualBody: "هذا الإيقاف يدوي من قبل الإدارة، لذلك لا يلزم الدفع من هذه الصفحة. يرجى التواصل مع الشركة لمعرفة السبب وإعادة التفعيل.",
    stationVisible: "المحطة ظاهرة في الخريطة",
    stationHidden: "المحطة مخفية مؤقتاً",
    freeRemainingOnly: "المتبقي من المجاني",
  },
  en: {
    title: "Plans & subscriptions",
    subtitle: "Choose the right plan for your station and activate it for 30 days to keep your map visibility and new bookings flowing.",
    freeTitle: "Free requests",
    freeHint: "Free requests are consumed first. Once they end, the station switches to paid plans.",
    used: "Used",
    remaining: "Remaining",
    total: "Total",
    packageTitle: "Request packages",
    packageHint: "Each package starts from the payment date and stays active for 30 days.",
    validity: "Activation period",
    validityValue: "30 days",
    activePackage: "Current package",
    requests: "Requests",
    requestProgress: "Request usage",
    expiresAt: "Expires on",
    noPackage: "There is no active package yet. Choose a package to restore your visibility on the map.",
    unlimited: "Unlimited",
    activeNow: "Active now",
    choosePackage: "Choose your next package",
    paymentMethods: "Payment methods",
    paymentHint: "After payment, the Washlly team activates your package directly. If card payment is enabled, you can also use the direct link.",
    zainCash: "Zain Cash",
    superKey: "Super Key",
    nasWallet: "Nas Wallet",
    cardLink: "Card payment",
    openLink: "Open link",
    contactCompany: "Contact company",
    renewNow: "Renew your package now",
    selectPackage: "Choose this package",
    selectedPackage: "Selected package",
    choosePaymentMethod: "Choose a payment method",
    selectedPaymentMethod: "Selected payment method",
    paymentReference: "Payment reference (optional)",
    paymentReferencePlaceholder: "Example: last 4 digits or transfer name",
    cardPayNow: "Pay by card now",
    sendActivationRequest: "Send activation request",
    requestHint: "Choose a package first, then choose a payment method. After paying, send the activation request so the company receives your request directly.",
    requestReadyTitle: "Ready to send",
    requestReadyBody: "The message will include the package name, payment method, and station name.",
    history: "Payment history",
    noPayments: "No payments recorded yet.",
    packageEndedTitle: "Current package ended",
    packageEndedBody: "Your station visibility is paused until you renew the package. Renew now to reach more customers.",
    freeEndedTitle: "Free requests finished",
    freeEndedBody: "The free requests for your station have finished. Choose a package to return to the map and receive new bookings.",
    expiredTitle: "Subscription period ended",
    expiredBody: "The current package duration ended. Renew now to keep your station visible and continue receiving requests.",
    manualTitle: "Station manually suspended",
    manualBody: "This is an administrative suspension, so you do not need to pay from this page. Please contact the company for details and reactivation.",
    stationVisible: "Station is visible on the map",
    stationHidden: "Station is temporarily hidden",
    freeRemainingOnly: "Free requests left",
  },
  ku: {
    title: "ئاشتراک و پاکێجەکان",
    subtitle: "پاکێجی گونجاو بۆ وێستگەکەت هەڵبژێرە و بۆ 30 ڕۆژ چالاکی بکە بۆ ئەوەی لە نەخشەدا دەرکەویت و داواکارییە نوێکان وەربگریت.",
    freeTitle: "داواکارییە خۆڕاییەکان",
    freeHint: "سەرەتا داواکارییە خۆڕاییەکان ژمێردەکرێن. دوای تەواوبوونیان، وێستگەکە دەچێتە پاکێجە پارەدراوەکان.",
    used: "بەکارهاتوو",
    remaining: "ماوە",
    total: "کۆی گشتی",
    packageTitle: "پاکێجی داواکاری",
    packageHint: "هەر پاکێجێک لە بەرواری پارەدان دەست پێدەکات و بۆ 30 ڕۆژ چالاک دەبێت.",
    validity: "ماوەی چالاکبوون",
    validityValue: "30 ڕۆژ",
    activePackage: "پاکێجی ئێستا",
    requests: "داواکارییەکان",
    requestProgress: "بەکارهێنانی داواکاری",
    expiresAt: "کۆتایی دێت لە",
    noPackage: "هێشتا هیچ پاکێجێکی چالاک نییە. پاکێجێک هەڵبژێرە بۆ گەڕانەوەی دەرکەوتن لە نەخشەدا.",
    unlimited: "بێ سنوور",
    activeNow: "ئێستا چالاکە",
    choosePackage: "پاکێجی داهاتووت هەڵبژێرە",
    paymentMethods: "ڕێگاکانی پارەدان",
    paymentHint: "دوای پارەدان، تیمی Washlly پاکێجەکەت ڕاستەوخۆ لەسەر هەژمارەکەت چالاک دەکات. ئەگەر پارەدانی کارت چالاک بێت، دەتوانیت لینکی ڕاستەوخۆش بەکاربهێنیت.",
    zainCash: "Zain Cash",
    superKey: "Super Key",
    nasWallet: "Nas Wallet",
    cardLink: "پارەدان بە کارت",
    openLink: "کردنەوەی لینک",
    contactCompany: "پەیوەندی بە کۆمپانیا",
    renewNow: "ئێستا پاکێجەکەت نوێ بکەرەوە",
    selectPackage: "ئەم پاکێجە هەڵبژێرە",
    selectedPackage: "پاکێجی هەڵبژێردراو",
    choosePaymentMethod: "ڕێگای پارەدان هەڵبژێرە",
    selectedPaymentMethod: "ڕێگای پارەدانی هەڵبژێردراو",
    paymentReference: "ئاماژەی پارەدان (ئیختیاری)",
    paymentReferencePlaceholder: "نمونە: 4 ژمارەی کۆتایی یان ناوی حوالە",
    cardPayNow: "ئێستا بە کارت پارە بدە",
    sendActivationRequest: "داوای چالاککردن بنێرە",
    requestHint: "سەرەتا پاکێجێک هەڵبژێرە، پاشان ڕێگای پارەدان. دوای پارەدان، داوای چالاککردن بنێرە بۆ ئەوەی کۆمپانیا ڕاستەوخۆ داواکە وەربگرێت.",
    requestReadyTitle: "ئامادەی ناردنی داوا",
    requestReadyBody: "ناوی پاکێج، ڕێگای پارەدان و ناوی وێستگە لە پەیامەکەدا دەخرێتە ناو.",
    history: "مێژووی پارەدان",
    noPayments: "هێشتا هیچ پارەدانێک تۆمار نەکراوە.",
    packageEndedTitle: "پاکێجی ئێستا تەواو بوو",
    packageEndedBody: "دەرکەوتنی وێستگەکەت کاتیاً وەستێندراوە تا پاکێجەکە نوێ بکەیتەوە. ئێستا نوێی بکەرەوە بۆ گەیشتن بە زبونە زیاتر.",
    freeEndedTitle: "داواکارییە خۆڕاییەکان تەواو بوون",
    freeEndedBody: "داواکارییە خۆڕاییەکانی وێستگەکەت تەواو بوون. یەکێک لە پاکێجەکان هەڵبژێرە بۆ گەڕانەوە بۆ نەخشە و وەرگرتنی حجزە نوێکان.",
    expiredTitle: "ماوەی ئاشتراک کۆتایی هات",
    expiredBody: "ماوەی پاکێجی ئێستا کۆتایی هات. ئێستا نوێی بکەرەوە بۆ بەردەوامبوونی دەرکەوتنی وێستگەکەت و وەرگرتنی داواکاری نوێ.",
    manualTitle: "وێستگەکە بە دەستی ئیدارە وەستێندراوە",
    manualBody: "ئەم وەستاندنە ئیدارییە، بۆیە پێویستت بە پارەدان لەم پەڕەیە نییە. تکایە پەیوەندی بە کۆمپانیا بکە بۆ زانیاری زیاتر و چالاککردنەوە.",
    stationVisible: "وێستگەکە لە نەخشەدا دەردەکەوێت",
    stationHidden: "وێستگەکە کاتیاً شاردراوەتەوە",
    freeRemainingOnly: "ماوەی خۆڕایی",
  },
  tr: {
    title: "Paketler ve abonelikler",
    subtitle: "İstasyonunuz için uygun paketi seçin ve 30 gün boyunca etkinleştirerek haritadaki görünürlüğünüzü ve yeni rezervasyon akışınızı koruyun.",
    freeTitle: "Ücretsiz talepler",
    freeHint: "Önce ücretsiz talepler kullanılır. Bunlar bittiğinde istasyon ücretli paketlere geçer.",
    used: "Kullanılan",
    remaining: "Kalan",
    total: "Toplam",
    packageTitle: "Talep paketleri",
    packageHint: "Her paket ödeme tarihinden itibaren başlar ve 30 gün boyunca aktif kalır.",
    validity: "Aktif süre",
    validityValue: "30 gün",
    activePackage: "Mevcut paket",
    requests: "Talepler",
    requestProgress: "Talep kullanımı",
    expiresAt: "Bitiş tarihi",
    noPackage: "Şu anda aktif bir paket yok. Haritadaki görünürlüğünüzü geri kazanmak için bir paket seçin.",
    unlimited: "Sınırsız",
    activeNow: "Şu anda aktif",
    choosePackage: "Sonraki paketinizi seçin",
    paymentMethods: "Ödeme yöntemleri",
    paymentHint: "Ödeme sonrasında Washlly ekibi paketinizi hesabınıza doğrudan tanımlar. Kart bağlantısı açıksa onu da kullanabilirsiniz.",
    zainCash: "Zain Cash",
    superKey: "Super Key",
    nasWallet: "Nas Wallet",
    cardLink: "Kartla ödeme",
    openLink: "Bağlantıyı aç",
    contactCompany: "Şirketle iletişime geç",
    renewNow: "Paketinizi şimdi yenileyin",
    selectPackage: "Bu paketi seç",
    selectedPackage: "Seçilen paket",
    choosePaymentMethod: "Ödeme yöntemini seç",
    selectedPaymentMethod: "Seçilen ödeme yöntemi",
    paymentReference: "Ödeme referansı (isteğe bağlı)",
    paymentReferencePlaceholder: "Örnek: son 4 hane veya transfer adı",
    cardPayNow: "Şimdi kartla öde",
    sendActivationRequest: "Aktivasyon talebi gönder",
    requestHint: "Önce bir paket seçin, ardından ödeme yöntemini seçin. Ödeme sonrası aktivasyon talebini gönderin ki şirket talebinizi doğrudan alsın.",
    requestReadyTitle: "Gönderime hazır",
    requestReadyBody: "Mesajda paket adı, ödeme yöntemi ve istasyon adı yer alacaktır.",
    history: "Ödeme geçmişi",
    noPayments: "Henüz kayıtlı bir ödeme yok.",
    packageEndedTitle: "Mevcut paket sona erdi",
    packageEndedBody: "Paket yenilenene kadar istasyon görünürlüğünüz geçici olarak duraklatıldı. Daha fazla müşteriye ulaşmak için şimdi yenileyin.",
    freeEndedTitle: "Ücretsiz talepler bitti",
    freeEndedBody: "İstasyonunuza tanımlanan ücretsiz talepler bitti. Haritaya dönmek ve yeni rezervasyonlar almak için bir paket seçin.",
    expiredTitle: "Abonelik süresi bitti",
    expiredBody: "Mevcut paket süresi sona erdi. İstasyonun görünürlüğünü korumak ve yeni talepler almaya devam etmek için şimdi yenileyin.",
    manualTitle: "İstasyon yönetim tarafından durduruldu",
    manualBody: "Bu durum yönetimsel bir durdurmadır; bu sayfadan ödeme yapmanız gerekmez. Sebebi öğrenmek ve yeniden etkinleştirmek için lütfen şirketle iletişime geçin.",
    stationVisible: "İstasyon haritada görünür",
    stationHidden: "İstasyon geçici olarak gizli",
    freeRemainingOnly: "Kalan ücretsiz talep",
  },
} as const;

const OWNER_PACKAGES = [
  {
    code: "starter_20",
    requests: 20,
    priceUsd: 5,
    gradient: "from-sky-500 to-blue-600",
  },
  {
    code: "growth_50",
    requests: 50,
    priceUsd: 10,
    gradient: "from-blue-600 to-indigo-700",
  },
  {
    code: "scale_110",
    requests: 110,
    priceUsd: 20,
    gradient: "from-indigo-700 to-slate-900",
  },
  {
    code: "unlimited_30",
    requests: null,
    priceUsd: 50,
    gradient: "from-amber-500 to-orange-600",
  },
] as const;

const normalizeWhatsappLink = (phone?: string | null) => {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
};

const SubscriptionTab = ({
  stationId,
  t,
  locale,
  language,
  ownerMeta,
}: {
  stationId: string;
  t: PortalTexts;
  locale: string;
  language: keyof typeof OWNER_PACKAGE_TEXTS;
  ownerMeta: any;
}) => {
  const copy = OWNER_PACKAGE_TEXTS[language] || OWNER_PACKAGE_TEXTS.ar;
  const [sub, setSub] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPackageCode, setSelectedPackageCode] = useState<string>("starter_20");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");

  useEffect(() => {
    const load = async () => {
      const [{ data: subData }, { data: settingsRows }] = await Promise.all([
        (supabase as any).from("subscriptions").select("*").eq("station_id", stationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from("app_settings").select("key, value"),
      ]);
      setSub(subData);
      const settingsMap: Record<string, string> = {};
      for (const row of settingsRows || []) settingsMap[row.key] = row.value;
      setSettings(settingsMap);
      if (subData) {
        const { data: payData } = await (supabase as any).from("payments").select("*").eq("subscription_id", subData.id).order("payment_date", { ascending: false });
        setPayments(payData || []);
      }
      setLoading(false);
    };
    load();
  }, [stationId]);

  const activeSub = sub && ["active", "trial"].includes(sub.status) ? sub : null;
  const statusLabels: Record<string, string> = { active: t.active, trial: t.trial, expired: t.expired, cancelled: t.cancelled };
  const paymentStatusLabels: Record<string, string> = { paid: t.paid, pending: t.paymentPending, failed: t.failed, refunded: t.refunded };

  const startDate = activeSub ? new Date(activeSub.start_date) : null;
  const endDate = activeSub ? new Date(activeSub.end_date) : null;
  const now = new Date();
  const totalDays = startDate && endDate ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) : 30;
  const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const progressPercent = Math.min(100, Math.max(0, ((totalDays - daysRemaining) / totalDays) * 100));
  const isExpiringSoon = daysRemaining <= 3 && daysRemaining > 0 && !!activeSub;
  const freeQuota = Number(ownerMeta?.free_requests_quota || 0);
  const freeUsed = Number(ownerMeta?.free_requests_used || 0);
  const freeRemaining = Math.max(0, freeQuota - freeUsed);
  const requestLimit = activeSub?.request_limit === null ? null : Number(activeSub?.request_limit ?? 0);
  const requestsUsed = Number(activeSub?.requests_used || 0);
  const requestRemaining = requestLimit === null ? null : Math.max(0, requestLimit - requestsUsed);
  const requestProgress = requestLimit ? Math.min(100, Math.max(0, (requestsUsed / requestLimit) * 100)) : 0;
  const suspensionReason = ownerMeta?.suspension_reason || null;
  const cardUrl = settings.PAYMENT_CARD_URL || "";
  const companyWhatsapp = normalizeWhatsappLink(settings.PUBLIC_CONTACT_WHATSAPP || settings.ADMIN_WHATSAPP_PHONE || "");
  const companyWhatsappLink = companyWhatsapp
    ? `https://wa.me/${companyWhatsapp}?text=${encodeURIComponent(`${copy.renewNow} - ${ownerMeta?.station_name || ""}`)}`
    : "";
  const activePackageCode = (activeSub?.package_code || "") as string;
  const selectedPackage = OWNER_PACKAGES.find((pkg) => pkg.code === selectedPackageCode) || OWNER_PACKAGES[0];
  const paymentMethodCards = [
    settings.PAYMENT_ZAIN_CASH ? { code: "zain_cash", label: copy.zainCash, value: settings.PAYMENT_ZAIN_CASH } : null,
    settings.PAYMENT_SUPER_KEY ? { code: "super_key", label: copy.superKey, value: settings.PAYMENT_SUPER_KEY } : null,
    settings.PAYMENT_NAS_WALLET ? { code: "nas_wallet", label: copy.nasWallet, value: settings.PAYMENT_NAS_WALLET } : null,
    cardUrl ? { code: "card", label: copy.cardLink, value: cardUrl } : null,
  ].filter(Boolean) as { code: string; label: string; value: string }[];
  const selectedPayment = paymentMethodCards.find((method) => method.code === selectedPaymentMethod) || null;
  const packageRequestWhatsappLink =
    companyWhatsapp && selectedPackage && selectedPayment
      ? `https://wa.me/${companyWhatsapp}?text=${encodeURIComponent(
          [
            copy.sendActivationRequest,
            `المحطة: ${ownerMeta?.station_name || "-"}`,
            `الباقة: ${selectedPackage.requests === null ? copy.unlimited : `${selectedPackage.requests} ${copy.requests}`}`,
            `السعر: $${selectedPackage.priceUsd}`,
            `طريقة الدفع: ${selectedPayment.label}`,
            paymentReference.trim() ? `مرجع الدفع: ${paymentReference.trim()}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        )}`
      : "";
  const packageEnded = suspensionReason === "package_exhausted";
  const freeEnded = suspensionReason === "free_quota_exhausted";
  const expiredByDate = suspensionReason === "subscription_expired";
  const manualSuspended = suspensionReason === "manual";

  useEffect(() => {
    if (!selectedPackageCode) {
      setSelectedPackageCode(activePackageCode || OWNER_PACKAGES[0].code);
    }
  }, [activePackageCode, selectedPackageCode]);

  useEffect(() => {
    if (!selectedPaymentMethod && paymentMethodCards.length > 0) {
      setSelectedPaymentMethod(paymentMethodCards[0].code);
    }
  }, [paymentMethodCards, selectedPaymentMethod]);

  if (loading) return <p className="text-muted-foreground">{t.loading}</p>;

  const renderBanner = () => {
    if (manualSuspended) {
      return (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-5 text-amber-950">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">{copy.manualTitle}</p>
                <p className="mt-1 text-sm leading-7">{copy.manualBody}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (freeEnded) {
      return (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-5 text-blue-950">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">{copy.freeEndedTitle}</p>
                <p className="mt-1 text-sm leading-7">{copy.freeEndedBody}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (packageEnded) {
      return (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-5 text-blue-950">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">{copy.packageEndedTitle}</p>
                <p className="mt-1 text-sm leading-7">{copy.packageEndedBody}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (expiredByDate) {
      return (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-5 text-blue-950">
            <div className="flex items-start gap-3">
              <Hourglass className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">{copy.expiredTitle}</p>
                <p className="mt-1 text-sm leading-7">{copy.expiredBody}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-6 py-8 text-white shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="mb-4 bg-white/10 text-white hover:bg-white/10">{copy.title}</Badge>
            <h3 className="text-2xl font-bold">{copy.title}</h3>
            <p className="mt-3 text-sm leading-7 text-blue-100">{copy.subtitle}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
              <p className="text-xs text-blue-100">{copy.freeRemainingOnly}</p>
              <p className="mt-2 text-3xl font-bold">{freeRemaining}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
              <p className="text-xs text-blue-100">{ownerMeta?.station_active ? copy.stationVisible : copy.stationHidden}</p>
              <p className="mt-2 text-sm font-semibold">{ownerMeta?.station_name || "-"}</p>
            </div>
          </div>
        </div>
      </div>

      {renderBanner()}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <Card className="border-blue-100">
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <h4 className="font-bold text-foreground">{copy.freeTitle}</h4>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">{copy.freeHint}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">{copy.used}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{freeUsed}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">{copy.remaining}</p>
                <p className="mt-2 text-2xl font-bold text-primary">{freeRemaining}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">{copy.total}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{freeQuota}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h4 className="font-bold text-foreground">{copy.activePackage}</h4>
            </div>

            {activeSub ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {OWNER_PACKAGES.find((pkg) => pkg.code === activePackageCode)?.requests === null
                        ? `${copy.unlimited} - $${activeSub.amount}`
                        : `${requestLimit} ${copy.requests} - $${activeSub.amount}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {copy.expiresAt}: {endDate?.toLocaleDateString(locale)}
                    </p>
                  </div>
                  <Badge>{statusLabels[activeSub.status] || activeSub.status}</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground">{copy.validity}</p>
                    <p className="mt-2 text-lg font-bold text-foreground">{copy.validityValue}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground">{copy.used}</p>
                    <p className="mt-2 text-lg font-bold text-foreground">{requestsUsed}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground">{copy.remaining}</p>
                    <p className="mt-2 text-lg font-bold text-primary">
                      {requestRemaining === null ? copy.unlimited : requestRemaining}
                    </p>
                  </div>
                </div>

                {requestLimit !== null && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{copy.requestProgress}</span>
                      <span className="font-medium text-foreground">{requestsUsed}/{requestLimit}</span>
                    </div>
                    <Progress value={requestProgress} className="h-2" />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.remainingDuration}</span>
                    <span className={`font-medium ${isExpiringSoon ? "text-destructive" : "text-foreground"}`}>
                      {daysRemaining > 0 ? `${daysRemaining} ${t.day}` : t.expired}
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-5 text-blue-950">
                <p className="font-semibold">{copy.noPackage}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-xl font-bold text-foreground">{copy.choosePackage}</h4>
          <p className="mt-2 text-sm text-muted-foreground">{copy.packageHint}</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
          {OWNER_PACKAGES.map((pkg) => {
            const isCurrent = activePackageCode === pkg.code && !!activeSub;
            const isSelected = selectedPackageCode === pkg.code;
            return (
              <Card
                key={pkg.code}
                className={`overflow-hidden border-blue-100 transition-all ${isCurrent ? "ring-2 ring-primary" : ""} ${isSelected ? "border-primary shadow-lg shadow-primary/15" : ""}`}
              >
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${pkg.gradient} p-5 text-white`}>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-white/15 text-white hover:bg-white/15">
                        {pkg.requests === null ? copy.unlimited : `${pkg.requests} ${copy.requests}`}
                      </Badge>
                      {isCurrent && <Badge className="bg-white text-slate-900 hover:bg-white">{copy.activeNow}</Badge>}
                    </div>
                    <p className="mt-6 text-4xl font-black">${pkg.priceUsd}</p>
                    <p className="mt-2 text-sm text-white/90">{copy.validityValue}</p>
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
                      <p className="text-sm text-foreground">
                        {pkg.requests === null ? copy.unlimited : `${pkg.requests} ${copy.requests}`}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
                      <p className="text-sm text-foreground">{copy.validity}: {copy.validityValue}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
                      <p className="text-sm text-foreground">{copy.renewNow}</p>
                    </div>
                    <Button
                      type="button"
                      className="mt-2 w-full"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => setSelectedPackageCode(pkg.code)}
                    >
                      {copy.selectPackage}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-blue-100 bg-blue-50/60">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h5 className="font-bold text-foreground">{copy.selectedPackage}</h5>
                <p className="mt-1 text-sm text-muted-foreground">{copy.requestReadyBody}</p>
              </div>
              <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                {selectedPackage.requests === null ? copy.unlimited : `${selectedPackage.requests} ${copy.requests}`}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-background p-4 text-center">
                <p className="text-xs text-muted-foreground">{copy.selectedPackage}</p>
                <p className="mt-2 text-lg font-bold text-foreground">${selectedPackage.priceUsd}</p>
              </div>
              <div className="rounded-2xl bg-background p-4 text-center">
                <p className="text-xs text-muted-foreground">{copy.validity}</p>
                <p className="mt-2 text-lg font-bold text-foreground">{copy.validityValue}</p>
              </div>
              <div className="rounded-2xl bg-background p-4 text-center">
                <p className="text-xs text-muted-foreground">{copy.selectedPaymentMethod}</p>
                <p className="mt-2 text-sm font-bold text-primary">{selectedPayment?.label || copy.choosePaymentMethod}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!manualSuspended && (
        <Card className="border-blue-100">
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h4 className="font-bold text-foreground">{copy.paymentMethods}</h4>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">{copy.paymentHint}</p>
            <p className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-7 text-blue-950">
              {copy.requestHint}
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {paymentMethodCards.map((method) => (
                <button
                  key={method.code}
                  type="button"
                  onClick={() => setSelectedPaymentMethod(method.code)}
                  className={`rounded-2xl border p-4 text-right transition-all ${selectedPaymentMethod === method.code ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "border-border bg-muted/30"}`}
                >
                  <p className="text-sm font-semibold text-foreground">{method.label}</p>
                  <p className="mt-2 text-lg font-bold text-primary break-all">
                    {method.code === "card" ? cardUrl : method.value}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="space-y-2">
                <Label>{copy.paymentReference}</Label>
                <Input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder={copy.paymentReferencePlaceholder}
                />
              </div>
              {selectedPaymentMethod === "card" && cardUrl && (
                <Button asChild size="lg" className="self-end">
                  <a href={cardUrl} target="_blank" rel="noreferrer">{copy.cardPayNow}</a>
                </Button>
              )}
              <Button
                asChild={!!packageRequestWhatsappLink}
                size="lg"
                variant="outline"
                className="self-end"
                disabled={!packageRequestWhatsappLink}
              >
                {packageRequestWhatsappLink ? (
                  <a href={packageRequestWhatsappLink} target="_blank" rel="noreferrer">{copy.sendActivationRequest}</a>
                ) : (
                  <span>{copy.sendActivationRequest}</span>
                )}
              </Button>
            </div>

            {companyWhatsappLink && (
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href={companyWhatsappLink} target="_blank" rel="noreferrer">{copy.contactCompany}</a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href={companyWhatsappLink} target="_blank" rel="noreferrer">{copy.renewNow}</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-foreground">{copy.history}</h4>
        {payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.date}</TableHead>
                <TableHead>{t.amount}</TableHead>
                <TableHead>{t.method}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead>{t.notes}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.payment_date).toLocaleDateString(locale)}</TableCell>
                  <TableCell>{Number(p.amount).toLocaleString()} د.ع</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"}>{paymentStatusLabels[p.status] || p.status}</Badge></TableCell>
                  <TableCell className="text-sm">{p.notes || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Card className="border-blue-100">
            <CardContent className="pt-6 text-sm text-muted-foreground">{copy.noPayments}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

const StationPortal = () => {
  const navigate = useNavigate();
  const [stationId, setStationId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [ownerMeta, setOwnerMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState("dashboard");
  const { language, locale, isRtl } = useAppLanguage();
  const t = texts[language];

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: ownerData } = await (supabase as any)
        .from("station_owners")
        .select("station_id, owner_name, owner_phone, is_active, outstanding_debt, free_requests_quota, free_requests_used, stations(id, name, is_active, suspension_reason, suspended_at)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (ownerData) {
        setStationId(ownerData.station_id);
        setOwnerName(ownerData.owner_name);
        const suspensionReason = ownerData?.stations?.suspension_reason || null;
        setOwnerMeta({
          ...ownerData,
          station_name: ownerData?.stations?.name || "",
          station_active: ownerData?.stations?.is_active ?? true,
          suspension_reason: suspensionReason,
          suspended_at: ownerData?.stations?.suspended_at || null,
        });
        if (["free_quota_exhausted", "package_exhausted", "subscription_expired"].includes(suspensionReason)) {
          setActiveTab("subscription");
        } else {
          setActiveTab("dashboard");
        }
      }
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
      setUnreadCount(count || 0);
      setLoading(false);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!stationId) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">{t.noLinkedStation}</p></div>;

  return (
    <div className="min-h-screen bg-background" dir={isRtl ? "rtl" : "ltr"}>
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><Store className="h-6 w-6 text-primary" /><h1 className="text-xl font-bold text-foreground">{t.portalTitle}</h1><span className="text-sm text-muted-foreground">({ownerName})</span></div>
          <Button variant="ghost" onClick={handleLogout}><LogOut className="h-4 w-4 ml-1" />{t.logout}</Button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {ownerMeta?.suspension_reason === "manual" && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardContent className="pt-5 text-sm leading-7 text-amber-950">
              تم إيقاف هذه المحطة يدوياً من قبل الإدارة. يرجى التواصل مع الشركة لمعرفة السبب وإعادة التفعيل، ولا يلزمك التوجه إلى صفحة الدفع لهذا النوع من الإيقاف.
            </CardContent>
          </Card>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab} dir={isRtl ? "rtl" : "ltr"}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard" className="gap-1"><LayoutDashboard className="h-4 w-4" />{t.dashboard}</TabsTrigger>
            <TabsTrigger value="info" className="gap-1"><Store className="h-4 w-4" />{t.station}</TabsTrigger>
            <TabsTrigger value="services" className="gap-1"><Wrench className="h-4 w-4" />{t.stationServices}</TabsTrigger>
            <TabsTrigger value="bookings" className="gap-1"><CalendarCheck className="h-4 w-4" />{t.bookings}</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1 relative"><Bell className="h-4 w-4" />{t.notifications}{unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">{unreadCount}</span>}</TabsTrigger>
            <TabsTrigger value="edit-requests" className="gap-1"><Pencil className="h-4 w-4" />{t.editRequests}</TabsTrigger>
            <TabsTrigger value="subscription" className="gap-1"><CreditCard className="h-4 w-4" />{t.subscription}</TabsTrigger>
            <TabsTrigger value="account" className="gap-1"><Key className="h-4 w-4" />{t.account}</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><StatsDashboard stationId={stationId} t={t} locale={locale} isRtl={isRtl} /></TabsContent>
          <TabsContent value="info"><StationInfoTab stationId={stationId} t={t} /></TabsContent>
          <TabsContent value="services"><StationServicesTab stationId={stationId} t={t} /></TabsContent>
          <TabsContent value="bookings"><StationBookingsTab stationId={stationId} t={t} /></TabsContent>
          <TabsContent value="notifications"><NotificationsTab t={t} locale={locale} isRtl={isRtl} /></TabsContent>
          <TabsContent value="edit-requests"><MyEditRequestsTab stationId={stationId} t={t} locale={locale} /></TabsContent>
          <TabsContent value="subscription"><SubscriptionTab stationId={stationId} t={t} locale={locale} language={language as keyof typeof OWNER_PACKAGE_TEXTS} ownerMeta={ownerMeta} /></TabsContent>
          <TabsContent value="account"><AccountTab t={t} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StationPortal;

