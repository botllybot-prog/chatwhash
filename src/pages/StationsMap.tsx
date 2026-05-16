import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import { useCallback } from "react";
import { Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useAppLanguage } from "@/lib/language";
import InstallAppButton from "@/components/InstallAppButton";
import { clearCustomerSession, getCustomerSession } from "@/lib/customerSession";
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Gift,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCw,
  Search,
  Star,
  ThumbsUp,
  Wrench,
  X,
} from "lucide-react";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const DEFAULT_CENTER = { lat: 33.3152, lng: 44.3661 };

type Language = "ar" | "en" | "ku" | "tr";

const translations = {
  ar: {
    locale: "ar-IQ",
    currency: "د.ع",
    dir: "rtl",
    languageLabel: "اللغة",
    languagePlaceholder: "اختر اللغة",
    searchPlaceholder: "ابحث عن محطة أو منطقة",
    myLocation: "موقعي",
    loadingMap: "جاري تحميل الخريطة...",
    stationOpen: "المحطة مفتوحة الآن",
    stationClosed: "المحطة مغلقة الآن",
    googleMaps: "Google Maps",
    waze: "Waze",
    searchLoadErrorTitle: "تعذر تحميل المحطات",
    browserLocationTitle: "المتصفح لا يدعم الموقع",
    browserLocationDescription: "تعذر الوصول إلى موقعك الحالي من هذا المتصفح.",
    locationErrorTitle: "تعذر تحديد الموقع",
    locationErrorDescription: "اسمح بالوصول إلى الموقع لعرض أقرب المحطات إليك.",
    schedulingLabels: {
      slots: "حجز بموعد",
      instant: "حجز فوري",
      daily: "حجز يومي",
    },
    step1Title: "اختر الخدمة",
    step1Description: "ابدأ بتحديد الخدمة المناسبة. بعدها سنحسب الخصم والسعر النهائي بوضوح.",
    step2TitleSlots: "اختر اليوم والوقت",
    step2TitleDaily: "اختر اليوم",
    step2Description: "اختر اليوم المناسب، وإذا كانت المحطة تعمل بالمواعيد ستظهر لك الأوقات المتاحة فقط.",
    step3Title: "بيانات الحجز",
    step3Description: "أدخل اسمك ورقم واتساب الصحيح. هذا الرقم سيصلك عليه تأكيد أو إلغاء الحجز.",
    step4Title: "عجلة الخصم",
    step4Description: "اختر الخدمة أولاً ثم لف العجلة. النسبة التي يقف عندها المؤشر هي الخصم المعتمد لهذا الحجز.",
    step5Title: "الخطوة الأخيرة",
    step5Description: "راجع التفاصيل ثم اختر إما تأكيد الحجز أو إلغاءه. بعد كل إجراء ستعود الخريطة بدون الاختيارات القديمة.",
    loadingServices: "جاري تحميل الخدمات...",
    noServices: "لا توجد خدمات متاحة لهذه المحطة حالياً.",
    loadingSlots: "جاري تحميل الأوقات المتاحة...",
    noSlots: "لا توجد أوقات متاحة في هذا اليوم. اختر يوماً آخر.",
    namePlaceholder: "الاسم",
    phonePlaceholder: "رقم الهاتف",
    importantNotice: "تنبيه مهم",
    bookingLimitNotice: "يمكنك الاحتفاظ بثلاثة حجوزات نشطة فقط على نفس الرقم. إذا أردت إنشاء حجز جديد بعد ذلك، يجب أولاً إلغاء أحد الحجوزات القديمة.",
    wheelHintDefault: "لف العجلة مرة واحدة قبل تأكيد الحجز. الخصم المعتمد يكون 0% أو 5% أو 10% أو 15%.",
    wheelHintSpinning: "جاري تدوير عجلة الخصم الآن...",
    wheelHintRetry: "لف العجلة مرة واحدة فقط لهذا الحجز.",
    wheelHintSaved: "تم تثبيت الخصم لهذا الحجز",
    wheelCurrentBookingDiscount: "خصم الحجز الحالي",
    wheelButton: "اضغط للف العجلة",
    wheelSpinningButton: "تدور العجلة الآن...",
    wheelRetryButton: "حاول مرة أخرى",
    wheelSavedButton: "تم تثبيت الخصم",
    price: "السعر",
    discount: "الخصم",
    afterDiscount: "بعد الخصم",
    summaryBoxLine1: "بعد تأكيد الحجز سيصل طلبك إلى صاحب المحطة عبر واتساب مع الخصم الذي حصلت عليه.",
    summaryBoxLine2: "إذا ألغيت الحجز بعد إنشائه سنرسل إشعار إلغاء عبر واتساب لك ولصاحب المحطة.",
    confirmBooking: "تأكيد الحجز",
    confirmingBooking: "جاري تأكيد الحجز...",
    cancelBooking: "إلغاء الحجز",
    returnToMap: "العودة إلى الخريطة",
    cancellingBooking: "جاري الإلغاء...",
    bookingSentTitle: "تم إرسال طلب الحجز بنجاح",
    bookingNumber: "رقم الحجز",
    fixedDiscount: "الخصم المثبت",
    waitingApproval: "الطلب الآن بانتظار موافقة المحطة. إذا رغبت بإلغائه يمكنك فعل ذلك من هنا مباشرة.",
    successResetNote: "بعد الإلغاء أو العودة ستظهر الخريطة من جديد بدون الاختيارات السابقة.",
    serviceDuration: "دقيقة",
    completeDataTitle: "أكمل البيانات أولاً",
    completeSpinDataDescription: "اختر الخدمة والموعد وأدخل اسمك ورقم هاتفك قبل تدوير عجلة الخصم.",
    completeBookingDataDescription: "يرجى إدخال الاسم ورقم الهاتف قبل تأكيد الحجز.",
    chooseTimeTitle: "اختر الموعد",
    chooseTimeDescription: "يرجى اختيار وقت مناسب من الأوقات المتاحة.",
    spinFirstTitle: "لف عجلة الخصم أولاً",
    spinFirstDescription: "يجب تثبيت نتيجة العجلة قبل إرسال طلب الحجز للمحطة.",
    spinFailedTitle: "فشل تدوير العجلة",
    spinFailedDescription: "حاول مرة أخرى بعد قليل.",
    bookingFailedTitle: "فشل إنشاء الحجز",
    bookingBlockedTitle: "تعذر إكمال الحجز",
    bookingCancelledTitle: "تم إلغاء الحجز",
    bookingCancelledDescription: "أرسلنا إشعار الإلغاء عبر واتساب.",
    bookingCreatedToastTitle: "تم إرسال طلب الحجز",
    bookingCreatedToastDescription: "والخصم المثبت هو",
    cancelFailedTitle: "تعذر إلغاء الحجز",
    spinSegments: {
      discount0Label: "0%",
      discount0Subtitle: "بدون خصم",
      discount5Label: "5%",
      discount5Subtitle: "خصم فوري",
      discount10Label: "10%",
      discount10Subtitle: "خصم فوري",
      discount15Label: "15%",
      discount15Subtitle: "خصم فوري",
      retryLabel: "",
      retrySubtitle: "",
    },
  },
  en: {
    locale: "en-US",
    currency: "IQD",
    dir: "ltr",
    languageLabel: "Language",
    languagePlaceholder: "Choose language",
    searchPlaceholder: "Search for a station or area",
    myLocation: "My location",
    loadingMap: "Loading map...",
    stationOpen: "Station open now",
    stationClosed: "Station closed now",
    googleMaps: "Google Maps",
    waze: "Waze",
    searchLoadErrorTitle: "Could not load stations",
    browserLocationTitle: "Browser location unavailable",
    browserLocationDescription: "Your browser could not access your current location.",
    locationErrorTitle: "Could not detect location",
    locationErrorDescription: "Allow location access to show the nearest stations.",
    schedulingLabels: {
      slots: "Timed booking",
      instant: "Instant booking",
      daily: "Daily booking",
    },
    step1Title: "Choose service",
    step1Description: "Start by selecting the service you want. We will then show the discount and final price clearly.",
    step2TitleSlots: "Choose day and time",
    step2TitleDaily: "Choose day",
    step2Description: "Pick the suitable date. If the station works with time slots, only available times will appear.",
    step3Title: "Booking details",
    step3Description: "Enter your name and correct WhatsApp number. Approval or cancellation updates will be sent to this number.",
    step4Title: "Discount wheel",
    step4Description: "Choose the service first, then spin the wheel. The slice under the pointer is the saved discount for this booking.",
    step5Title: "Final step",
    step5Description: "Review everything, then confirm or cancel. After either action, the map returns without the previous selection.",
    loadingServices: "Loading services...",
    noServices: "No services are currently available for this station.",
    loadingSlots: "Loading available times...",
    noSlots: "No available times for this day. Please choose another day.",
    namePlaceholder: "Name",
    phonePlaceholder: "Phone number",
    importantNotice: "Important notice",
    bookingLimitNotice: "You can keep only 3 active reservations per phone number. To make another one, cancel one of your older bookings first.",
    wheelHintDefault: "Spin once before confirming. The saved discount is 0%, 5%, 10%, or 15%.",
    wheelHintSpinning: "Spinning the discount wheel now...",
    wheelHintRetry: "The wheel can be spun once for this booking.",
    wheelHintSaved: "Discount saved for this booking",
    wheelCurrentBookingDiscount: "Current booking discount",
    wheelButton: "Spin the wheel",
    wheelSpinningButton: "Wheel is spinning...",
    wheelRetryButton: "Try again",
    wheelSavedButton: "Discount saved",
    price: "Price",
    discount: "Discount",
    afterDiscount: "After discount",
    summaryBoxLine1: "After you confirm, your request is sent to the station owner on WhatsApp with the saved discount.",
    summaryBoxLine2: "If you cancel after creating the booking, a WhatsApp cancellation message will be sent to you and the station owner.",
    confirmBooking: "Confirm booking",
    confirmingBooking: "Confirming booking...",
    cancelBooking: "Cancel booking",
    returnToMap: "Back to map",
    cancellingBooking: "Cancelling...",
    bookingSentTitle: "Booking request sent successfully",
    bookingNumber: "Booking number",
    fixedDiscount: "Saved discount",
    waitingApproval: "Your request is now waiting for station approval. You can still cancel it from here.",
    successResetNote: "After cancel or return, the map will appear again without the previous selection.",
    serviceDuration: "min",
    completeDataTitle: "Complete the details first",
    completeSpinDataDescription: "Choose the service and time, then enter your name and phone before spinning the wheel.",
    completeBookingDataDescription: "Please enter your name and phone number before confirming the booking.",
    chooseTimeTitle: "Choose a time",
    chooseTimeDescription: "Please choose one of the available times.",
    spinFirstTitle: "Spin the discount wheel first",
    spinFirstDescription: "The wheel result must be saved before the booking request can be sent.",
    spinFailedTitle: "Spin failed",
    spinFailedDescription: "Please try again in a moment.",
    bookingFailedTitle: "Booking failed",
    bookingBlockedTitle: "Could not complete booking",
    bookingCancelledTitle: "Booking cancelled",
    bookingCancelledDescription: "We sent the cancellation notice through WhatsApp.",
    bookingCreatedToastTitle: "Booking request sent",
    bookingCreatedToastDescription: "Saved discount",
    cancelFailedTitle: "Could not cancel booking",
    spinSegments: {
      discount0Label: "0%",
      discount0Subtitle: "No discount",
      discount5Label: "5%",
      discount5Subtitle: "Instant off",
      discount10Label: "10%",
      discount10Subtitle: "Instant off",
      discount15Label: "15%",
      discount15Subtitle: "Instant off",
      retryLabel: "",
      retrySubtitle: "",
    },
  },
  ku: {
    locale: "ckb-IQ",
    currency: "د.ع",
    dir: "rtl",
    languageLabel: "زمان",
    languagePlaceholder: "زمان هەڵبژێرە",
    searchPlaceholder: "گەڕان بۆ وێستگە یان ناوچە",
    myLocation: "شوێنی من",
    loadingMap: "نەخشە بار دەکرێت...",
    stationOpen: "وێستگەکە ئێستا کراوەیە",
    stationClosed: "وێستگەکە ئێستا داخراوە",
    googleMaps: "Google Maps",
    waze: "Waze",
    searchLoadErrorTitle: "ناتوانرێت وێستگەکان بار بکرێن",
    browserLocationTitle: "وێبگەڕ شوێن ناسین پشتگیری ناکات",
    browserLocationDescription: "ناتوانرا شوێنی ئێستات بخوێنرێتەوە.",
    locationErrorTitle: "ناتوانرا شوێن دیاری بکرێت",
    locationErrorDescription: "ڕێگە بدە بە شوێن ناسین بۆ پیشاندانی نزیکترین وێستگەکان.",
    schedulingLabels: {
      slots: "حجز بە کات",
      instant: "حجزی خێرا",
      daily: "حجزی ڕۆژانە",
    },
    step1Title: "خزمەتگوزاری هەڵبژێرە",
    step1Description: "یەکەم خزمەتگوزارییەکە هەڵبژێرە. دوای ئەوە داشکاندن و نرخی کۆتایی بە ڕوونی پیشان دەدرێت.",
    step2TitleSlots: "ڕۆژ و کات هەڵبژێرە",
    step2TitleDaily: "ڕۆژ هەڵبژێرە",
    step2Description: "ڕۆژی گونجاو هەڵبژێرە. ئەگەر وێستگەکە بە کات کار بکات تەنها کاتە بەردەستەکان دەردەکەون.",
    step3Title: "زانیاری حجز",
    step3Description: "ناو و ژمارەی واتساپی دروست بنووسە. پەیامی پشتڕاستکردنەوە یان هەڵوەشاندنەوە بۆ ئەم ژمارەیە دێت.",
    step4Title: "گەردی داشکاندن",
    step4Description: "سەرەتا خزمەتگوزارییەکە هەڵبژێرە، پاشان گەردەکە بگێڕە. ئەو بەشەی کە ژێر نیشاندەرەکەیە داشکاندنی تۆیە.",
    step5Title: "قۆناغی کۆتایی",
    step5Description: "وردبینی لە هەموو شتێک بکە، پاشان حجزەکە پشتڕاست بکەرەوە یان هەڵیبوەشێنەوە. دوای هەردوو هەڵبژاردەکە نەخشەکە بەبێ هەڵبژاردنی پێشوو دەگەڕێتەوە.",
    loadingServices: "خزمەتگوزاریەکان بار دەکرێن...",
    noServices: "ئەم وێستگەیە ئێستا هیچ خزمەتگوزارییەکی بەردەستی نییە.",
    loadingSlots: "کاتە بەردەستەکان بار دەکرێن...",
    noSlots: "بۆ ئەم ڕۆژە هیچ کاتێکی بەردەست نییە. تکایە ڕۆژێکی تر هەڵبژێرە.",
    namePlaceholder: "ناو",
    phonePlaceholder: "ژمارەی تەلەفۆن",
    importantNotice: "ئاگاداری گرنگ",
    bookingLimitNotice: "تەنها دەتوانیت 3 حجزی چالاکت هەبێت بۆ هەمان ژمارە. بۆ دروستکردنی حجزێکی نوێ، یەکێک لە حجزەکانی پێشوو هەڵبوەشێنەوە.",
    wheelHintDefault: "پێش پشتڕاستکردنەوە یەکجار گەردەکە بگێڕە. داشکاندن 0%، 5%، 10%، یان 15% دەبێت.",
    wheelHintSpinning: "گەردی داشکاندن ئێستا دەسووڕێت...",
    wheelHintRetry: "گەردەکە تەنها یەکجار بۆ ئەم حجزە دەسووڕێت.",
    wheelHintSaved: "داشکاندن بۆ ئەم حجزە پاشەکەوت کرا",
    wheelCurrentBookingDiscount: "داشکاندنی حجزی ئێستا",
    wheelButton: "گەردەکە بگێڕە",
    wheelSpinningButton: "گەردەکە دەسووڕێت...",
    wheelRetryButton: "دووبارە هەوڵ بدە",
    wheelSavedButton: "داشکاندن پاشەکەوت کرا",
    price: "نرخ",
    discount: "داشکاندن",
    afterDiscount: "دوای داشکاندن",
    summaryBoxLine1: "دوای پشتڕاستکردنەوە، داواکارییەکەت لەگەڵ داشکاندنی پاشەکەوتکراودا بۆ خاوەنی وێستگە لە واتساپ دەنێردرێت.",
    summaryBoxLine2: "ئەگەر دوای دروستکردنی حجزەکە هەڵیبوەشێنیتەوە، پەیامی واتساپی هەڵوەشاندنەوە بۆ تۆ و خاوەنی وێستگەکە دەنێردرێت.",
    confirmBooking: "پشتڕاستکردنەوەی حجز",
    confirmingBooking: "حجزەکە پشتڕاست دەکرێتەوە...",
    cancelBooking: "هەڵوەشاندنەوەی حجز",
    returnToMap: "گەڕانەوە بۆ نەخشە",
    cancellingBooking: "هەڵوەشاندنەوە...",
    bookingSentTitle: "داواکاری حجز بە سەرکەوتوویی نێردرا",
    bookingNumber: "ژمارەی حجز",
    fixedDiscount: "داشکاندنی پاشەکەوتکراو",
    waitingApproval: "داواکارییەکە ئێستا چاوەڕێی پەسەندکردنی وێستگەیە. دەتوانیت لێرەوە هەڵیبوەشێنیتەوە.",
    successResetNote: "دوای هەڵوەشاندنەوە یان گەڕانەوە، نەخشەکە دوبارە بەبێ هەڵبژاردنی پێشوو دەردەکەوێت.",
    serviceDuration: "خولەک",
    completeDataTitle: "سەرەتا زانیاریەکان تەواو بکە",
    completeSpinDataDescription: "خزمەتگوزاری و کات هەڵبژێرە، پاشان ناو و ژمارەی تەلەفۆن بنووسە پێش سووڕاندنی گەردەکە.",
    completeBookingDataDescription: "تکایە ناو و ژمارەی تەلەفۆن بنووسە پێش پشتڕاستکردنی حجزەکە.",
    chooseTimeTitle: "کات هەڵبژێرە",
    chooseTimeDescription: "تکایە یەکێک لە کاتە بەردەستەکان هەڵبژێرە.",
    spinFirstTitle: "سەرەتا گەردی داشکاندن بگێڕە",
    spinFirstDescription: "دەبێت ئەنجامی گەردەکە پاشەکەوت بکرێت پێش ناردنی داواکاریی حجز.",
    spinFailedTitle: "سووڕاندنی گەردەکە سەرکەوتوو نەبوو",
    spinFailedDescription: "تکایە دوای کەمێک دووبارە هەوڵ بدە.",
    bookingFailedTitle: "حجز سەرکەوتوو نەبوو",
    bookingBlockedTitle: "نەتوانرا حجزەکە تەواو بکرێت",
    bookingCancelledTitle: "حجزەکە هەڵوەشێنرایەوە",
    bookingCancelledDescription: "ئاگادارکردنەوەی هەڵوەشاندنەوەمان لە واتساپ نارد.",
    bookingCreatedToastTitle: "داواکاری حجز نێردرا",
    bookingCreatedToastDescription: "داشکاندنی پاشەکەوتکراو",
    cancelFailedTitle: "نەتوانرا حجزەکە هەڵبوەشێندرێتەوە",
    spinSegments: {
      discount0Label: "0%",
      discount0Subtitle: "بێ داشکاندن",
      discount5Label: "5%",
      discount5Subtitle: "داشکاندنی خێرا",
      discount10Label: "10%",
      discount10Subtitle: "داشکاندنی خێرا",
      discount15Label: "15%",
      discount15Subtitle: "داشکاندنی خێرا",
      retryLabel: "",
      retrySubtitle: "",
    },
  },
  tr: {
    locale: "tr-TR",
    currency: "IQD",
    dir: "ltr",
    languageLabel: "Dil",
    languagePlaceholder: "Dil seçin",
    searchPlaceholder: "İstasyon veya bölge ara",
    myLocation: "Konumum",
    loadingMap: "Harita yükleniyor...",
    stationOpen: "İstasyon şu anda açık",
    stationClosed: "İstasyon şu anda kapalı",
    googleMaps: "Google Maps",
    waze: "Waze",
    searchLoadErrorTitle: "İstasyonlar yüklenemedi",
    browserLocationTitle: "Tarayıcı konumu desteklemiyor",
    browserLocationDescription: "Tarayıcı mevcut konumunuza erişemedi.",
    locationErrorTitle: "Konum alınamadı",
    locationErrorDescription: "En yakın istasyonları göstermek için konum erişimine izin verin.",
    schedulingLabels: {
      slots: "Saatli rezervasyon",
      instant: "Hızlı rezervasyon",
      daily: "Günlük rezervasyon",
    },
    step1Title: "Hizmeti seçin",
    step1Description: "Önce istediğiniz hizmeti seçin. Ardından indirim ve son fiyat net şekilde gösterilir.",
    step2TitleSlots: "Gün ve saat seçin",
    step2TitleDaily: "Gün seçin",
    step2Description: "Uygun günü seçin. İstasyon saatli çalışıyorsa sadece uygun saatler görünür.",
    step3Title: "Rezervasyon bilgileri",
    step3Description: "Adınızı ve doğru WhatsApp numaranızı girin. Onay veya iptal bildirimleri bu numaraya gönderilir.",
    step4Title: "İndirim çarkı",
    step4Description: "Önce hizmeti seçin, sonra çarkı çevirin. Gösterge hangi dilimde durursa o indirim kaydedilir.",
    step5Title: "Son adım",
    step5Description: "Bilgileri kontrol edin, sonra rezervasyonu onaylayın veya iptal edin. Her iki işlemden sonra harita eski seçimler olmadan geri gelir.",
    loadingServices: "Hizmetler yükleniyor...",
    noServices: "Bu istasyon için şu anda uygun hizmet yok.",
    loadingSlots: "Uygun saatler yükleniyor...",
    noSlots: "Bu gün için uygun saat yok. Lütfen başka bir gün seçin.",
    namePlaceholder: "Ad",
    phonePlaceholder: "Telefon numarası",
    importantNotice: "Önemli not",
    bookingLimitNotice: "Aynı numara ile en fazla 3 aktif rezervasyon tutabilirsiniz. Yeni rezervasyon için önce eski rezervasyonlardan birini iptal edin.",
    wheelHintDefault: "Onaylamadan önce çarkı bir kez çevirin. İndirim 0%, 5%, 10% veya 15% olur.",
    wheelHintSpinning: "İndirim çarkı dönüyor...",
    wheelHintRetry: "Çark bu rezervasyon için yalnızca bir kez çevrilir.",
    wheelHintSaved: "Bu rezervasyon için indirim kaydedildi",
    wheelCurrentBookingDiscount: "Mevcut rezervasyon indirimi",
    wheelButton: "Çarkı çevir",
    wheelSpinningButton: "Çark dönüyor...",
    wheelRetryButton: "Tekrar dene",
    wheelSavedButton: "İndirim kaydedildi",
    price: "Fiyat",
    discount: "İndirim",
    afterDiscount: "İndirim sonrası",
    summaryBoxLine1: "Onaydan sonra talebiniz kaydedilen indirim ile birlikte WhatsApp üzerinden istasyon sahibine gönderilir.",
    summaryBoxLine2: "Rezervasyonu oluşturduktan sonra iptal ederseniz size ve istasyon sahibine WhatsApp iptal bildirimi gönderilir.",
    confirmBooking: "Rezervasyonu onayla",
    confirmingBooking: "Rezervasyon onaylanıyor...",
    cancelBooking: "Rezervasyonu iptal et",
    returnToMap: "Haritaya dön",
    cancellingBooking: "İptal ediliyor...",
    bookingSentTitle: "Rezervasyon talebi başarıyla gönderildi",
    bookingNumber: "Rezervasyon numarası",
    fixedDiscount: "Kaydedilen indirim",
    waitingApproval: "Talebiniz istasyon onayını bekliyor. Buradan yine iptal edebilirsiniz.",
    successResetNote: "İptal veya dönüşten sonra harita eski seçimler olmadan tekrar görünür.",
    serviceDuration: "dk",
    completeDataTitle: "Önce bilgileri tamamlayın",
    completeSpinDataDescription: "Çarkı çevirmeden önce hizmeti ve saati seçin, sonra adınızı ve telefonunuzu girin.",
    completeBookingDataDescription: "Lütfen rezervasyonu onaylamadan önce adınızı ve telefon numaranızı girin.",
    chooseTimeTitle: "Saat seçin",
    chooseTimeDescription: "Lütfen uygun saatlerden birini seçin.",
    spinFirstTitle: "Önce indirim çarkını çevirin",
    spinFirstDescription: "Rezervasyon isteği gönderilmeden önce çark sonucu kaydedilmelidir.",
    spinFailedTitle: "Çark döndürülemedi",
    spinFailedDescription: "Lütfen biraz sonra tekrar deneyin.",
    bookingFailedTitle: "Rezervasyon başarısız oldu",
    bookingBlockedTitle: "Rezervasyon tamamlanamadı",
    bookingCancelledTitle: "Rezervasyon iptal edildi",
    bookingCancelledDescription: "WhatsApp üzerinden iptal bildirimi gönderdik.",
    bookingCreatedToastTitle: "Rezervasyon talebi gönderildi",
    bookingCreatedToastDescription: "Kaydedilen indirim",
    cancelFailedTitle: "Rezervasyon iptal edilemedi",
    spinSegments: {
      discount0Label: "0%",
      discount0Subtitle: "İndirim yok",
      discount5Label: "5%",
      discount5Subtitle: "Anında indirim",
      discount10Label: "10%",
      discount10Subtitle: "Anında indirim",
      discount15Label: "15%",
      discount15Subtitle: "Anında indirim",
      retryLabel: "",
      retrySubtitle: "",
    },
  },
} as const;

const quickBookingTranslations = {
  ar: {
    cta: "حجز سريع",
    cancelAllCta: "إلغاء كل الحجوزات",
    cardTitle: "الحجز السريع (بدون تحديد السعر)",
    cardHint: "أسرع محطة توافق على الطلب تستلم الحجز. بدون عجلة خصم في هذا النوع.",
    customerName: "اسم العميل",
    customerPhone: "رقم واتساب العميل",
    servicePlaceholder: "نوع الغسل",
    serviceSurface: "غسل سطحي",
    serviceJack: "غسل جك",
    submit: "إرسال الحجز السريع",
    submitting: "جاري الإرسال...",
    completeTitle: "أكمل البيانات",
    completeDesc: "يرجى ملء كل حقول الحجز السريع أولاً.",
    failTitle: "تعذر إرسال الحجز السريع",
    failDesc: "حدث خطأ غير متوقع.",
    okTitle: "تم إرسال الحجز السريع",
    okDesc: "تم إرسال الطلب لأقرب 3 محطات، وأسرع رد سيحصل على الحجز.",
    cancelAllNeedPhoneTitle: "أدخل رقم الواتساب",
    cancelAllNeedPhoneDesc: "أدخل رقم العميل أولاً لإلغاء كل الحجوزات النشطة لهذا الرقم.",
    cancelAllSubmitting: "جاري الإلغاء...",
    cancelAllOkTitle: "تم إلغاء جميع الحجوزات",
    cancelAllOkDesc: "تم إلغاء كل الحجوزات النشطة وإرسال إشعارات واتساب حسب لغة كل حجز.",
    cancelAllFailTitle: "تعذر إلغاء الحجوزات",
    cancelAllFailDesc: "حدث خطأ أثناء إلغاء الحجوزات.",
  },
  en: {
    cta: "Quick booking",
    cancelAllCta: "Cancel all bookings",
    cardTitle: "Quick booking (price not fixed yet)",
    cardHint: "The first station to approve gets the booking. No discount wheel for this flow.",
    customerName: "Customer name",
    customerPhone: "Customer WhatsApp",
    servicePlaceholder: "Wash type",
    serviceSurface: "Surface wash",
    serviceJack: "Jack wash",
    submit: "Send quick booking",
    submitting: "Sending...",
    completeTitle: "Complete details",
    completeDesc: "Please fill all quick-booking fields first.",
    failTitle: "Quick booking failed",
    failDesc: "Unexpected error occurred.",
    okTitle: "Quick booking sent",
    okDesc: "Request sent to the nearest 3 stations. Fastest reply wins the booking.",
    cancelAllNeedPhoneTitle: "Enter WhatsApp number",
    cancelAllNeedPhoneDesc: "Enter customer phone first to cancel all active bookings for this number.",
    cancelAllSubmitting: "Cancelling...",
    cancelAllOkTitle: "All bookings cancelled",
    cancelAllOkDesc: "All active bookings were cancelled and WhatsApp notices were sent in each booking language.",
    cancelAllFailTitle: "Could not cancel bookings",
    cancelAllFailDesc: "An error occurred while cancelling bookings.",
  },
  ku: {
    cta: "حجزی خێرا",
    cancelAllCta: "هەڵوەشاندنەوەی هەموو حجزەکان",
    cardTitle: "حجزی خێرا (نرخ دیاری نەکراوە)",
    cardHint: "ئەو وێستگەیەی زوو وەڵام بدات حجزەکە وەردەگرێت. لەم جۆرەدا گەردی داشکاندن نییە.",
    customerName: "ناوی کڕیار",
    customerPhone: "واتساپی کڕیار",
    servicePlaceholder: "جۆری شۆردن",
    serviceSurface: "شۆردنی سەرەوە",
    serviceJack: "شۆردنی جەک",
    submit: "ناردنی حجزی خێرا",
    submitting: "لە ناردندایە...",
    completeTitle: "زانیاری تەواو بکە",
    completeDesc: "تکایە هەموو خانەکانی حجزی خێرا پڕ بکە.",
    failTitle: "ناردنی حجزی خێرا سەرکەوتوو نەبوو",
    failDesc: "هەڵەیەکی نەناسراو ڕوویدا.",
    okTitle: "حجزی خێرا نێردرا",
    okDesc: "داواکارییەکە بۆ 3 وێستگەی نزیک نێردرا. خێراترین وەڵام حجزەکە وەردەگرێت.",
    cancelAllNeedPhoneTitle: "ژمارەی واتساپ بنووسە",
    cancelAllNeedPhoneDesc: "سەرەتا ژمارەی کڕیار بنووسە بۆ هەڵوەشاندنەوەی هەموو حجزە چالاکەکان.",
    cancelAllSubmitting: "هەڵوەشاندنەوە...",
    cancelAllOkTitle: "هەموو حجزەکان هەڵوەشێندرایەوە",
    cancelAllOkDesc: "هەموو حجزە چالاکەکان هەڵوەشێندرایەوە و ئاگادارکردنەوەی واتساپ بە زمانی هەر حجزێک نێردرا.",
    cancelAllFailTitle: "هەڵوەشاندنەوە سەرکەوتوو نەبوو",
    cancelAllFailDesc: "هەڵەیەک ڕوویدا لە کاتی هەڵوەشاندنەوە.",
  },
  tr: {
    cta: "Hızlı rezervasyon",
    cancelAllCta: "Tüm rezervasyonları iptal et",
    cardTitle: "Hızlı rezervasyon (fiyat henüz sabit değil)",
    cardHint: "İlk onay veren istasyon rezervasyonu alır. Bu akışta indirim çarkı yok.",
    customerName: "Müşteri adı",
    customerPhone: "Müşteri WhatsApp",
    servicePlaceholder: "Yıkama türü",
    serviceSurface: "Yüzey yıkama",
    serviceJack: "Kriko yıkama",
    submit: "Hızlı rezervasyon gönder",
    submitting: "Gönderiliyor...",
    completeTitle: "Bilgileri tamamlayın",
    completeDesc: "Lütfen önce hızlı rezervasyon alanlarını doldurun.",
    failTitle: "Hızlı rezervasyon gönderilemedi",
    failDesc: "Beklenmeyen bir hata oluştu.",
    okTitle: "Hızlı rezervasyon gönderildi",
    okDesc: "Talep en yakın 3 istasyona gönderildi. En hızlı yanıt rezervasyonu alır.",
    cancelAllNeedPhoneTitle: "WhatsApp numarası girin",
    cancelAllNeedPhoneDesc: "Önce müşteri numarasını girin, sonra bu numaranın tüm aktif rezervasyonları iptal edilir.",
    cancelAllSubmitting: "İptal ediliyor...",
    cancelAllOkTitle: "Tüm rezervasyonlar iptal edildi",
    cancelAllOkDesc: "Tüm aktif rezervasyonlar iptal edildi ve her rezervasyon diline göre WhatsApp bildirimi gönderildi.",
    cancelAllFailTitle: "Rezervasyonlar iptal edilemedi",
    cancelAllFailDesc: "İptal sırasında bir hata oluştu.",
  },
} as const;

function formatQuickTime12(hour24: number, minute: number): string {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

function toQuickTimeValue(hour24: number, minute: number): string {
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

type Station = {
  id: string;
  name: string;
  address: string | null;
  detailed_address: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  working_hours_start: string;
  working_hours_end: string;
  scheduling_type: "slots" | "instant" | "daily";
  slot_duration_minutes: number;
  is_active: boolean;
  rating_average?: number | null;
  rating_count?: number | null;
};

type Service = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  station_id: string | null;
};

type BookingResult = {
  bookingId: string;
  bookingNumber: number;
  discountPercent: number;
};

type TrackedBooking = {
  bookingId: string;
  bookingNumber?: number;
  source: "map" | "quick";
};

type SpinResult = {
  segmentKey: string;
  discountPercent: number;
  label: string;
  token: string;
};

type SpinDiscountResponse = {
  segmentKey?: string;
  discountPercent?: number;
  label?: string;
  token?: string;
  requiresRespin?: boolean;
  error?: string;
};

type CancelBookingResponse = {
  success?: boolean;
  error?: string;
};

type CancelAllBookingsResponse = {
  success?: boolean;
  cancelledCount?: number;
  alreadyEmpty?: boolean;
  error?: string;
};

function getSpinSegments(language: Language) {
  const t = translations[language].spinSegments;

  return [
    { key: "discount_0", label: t.discount0Label, subtitle: t.discount0Subtitle, color: "#f8fafc", discountPercent: 0, size: 90, textColor: "#0f172a" },
    { key: "discount_5", label: t.discount5Label, subtitle: t.discount5Subtitle, color: "#22d3ee", discountPercent: 5, size: 90, textColor: "#083344" },
    { key: "discount_10", label: t.discount10Label, subtitle: t.discount10Subtitle, color: "#6366f1", discountPercent: 10, size: 90, textColor: "#ffffff" },
    { key: "discount_15", label: t.discount15Label, subtitle: t.discount15Subtitle, color: "#10b981", discountPercent: 15, size: 90, textColor: "#052e16" },
  ] as const;
}

function getSpinSegmentArcs(language: Language) {
  return getSpinSegments(language).reduce<
    Array<ReturnType<typeof getSpinSegments>[number] & { startAngle: number; endAngle: number; midAngle: number }>
  >((acc, segment) => {
    const startAngle = acc.length === 0 ? 0 : acc[acc.length - 1].endAngle;
    const endAngle = startAngle + segment.size;

    acc.push({
      ...segment,
      startAngle,
      endAngle,
      midAngle: startAngle + segment.size / 2,
    });

    return acc;
  }, []);
}

function getWheelBackground(language: Language) {
  const arcs = getSpinSegmentArcs(language);

  return `conic-gradient(from -90deg, ${arcs.map((segment) => {
    return `${segment.color} ${segment.startAngle}deg ${segment.endAngle}deg`;
  }).join(", ")})`;
}

function isStationOpen(station: Station): boolean {
  const now = new Date();
  const [startHour, startMinute] = station.working_hours_start.split(":").map(Number);
  const [endHour, endMinute] = station.working_hours_end.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return currentMinutes >= startHour * 60 + startMinute && currentMinutes < endHour * 60 + endMinute;
}

function generateTimeSlots(start: string, end: string, duration: number): string[] {
  const slots: string[] = [];
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  let current = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  while (current + duration <= endMinutes) {
    const hour = Math.floor(current / 60);
    const minute = current % 60;
    slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    current += duration;
  }

  return slots;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDate() {
  return formatLocalDate(new Date());
}

function parseLocalDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function formatCurrency(amount: number, language: Language) {
  const currency = translations[language].currency;
  return language === "en" || language === "tr"
    ? `${Math.round(amount)} ${currency}`
    : `${Math.round(amount)} ${currency}`;
}

function calculateSpinRotation(currentRotation: number, targetMidAngle: number) {
  const currentNormalized = ((currentRotation % 360) + 360) % 360;
  const targetNormalized = ((360 - targetMidAngle) % 360 + 360) % 360;
  let delta = targetNormalized - currentNormalized;

  if (delta <= 0) delta += 360;

  return currentRotation + 360 * 5 + delta;
}

function StepHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {number}
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold leading-none">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StationCard({
  station,
  onClose,
  language,
  onBookingCreated,
}: {
  station: Station;
  onClose: () => void;
  language: Language;
  onBookingCreated?: (tracked: TrackedBooking, customerPhone: string) => void;
}) {
  const t = translations[language];
  const isRtl = t.dir === "rtl";
  const spinSegmentArcs = useMemo(() => getSpinSegmentArcs(language), [language]);
  const wheelBackground = useMemo(() => getWheelBackground(language), [language]);

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [currentLocalDate, setCurrentLocalDate] = useState(getTodayDate());
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [spinRotation, setSpinRotation] = useState(0);
  const [spinHint, setSpinHint] = useState(t.wheelHintDefault);
  const [needsRespin, setNeedsRespin] = useState(false);
  const customerSession = getCustomerSession();

  const open = isStationOpen(station);
  const isSlotsFlow = station.scheduling_type === "slots";
  const isDailyFlow = station.scheduling_type === "daily";
  const bookingDate = isDailyFlow || isSlotsFlow ? selectedDate : getTodayDate();
  const normalizedPhone = normalizePhone(customerPhone);

  const canSpin =
    !!selectedService &&
    !!customerName.trim() &&
    !!customerPhone.trim() &&
    (!isDailyFlow || !!selectedDate) &&
    (!isSlotsFlow || (!!selectedDate && !!selectedSlot));

  const canSubmit = canSpin && !!spinResult && !spinning && !loadingServices && !bookingResult;

  const discountAmount = selectedService && spinResult
    ? (selectedService.price * spinResult.discountPercent) / 100
    : 0;
  const finalPrice = selectedService ? selectedService.price - discountAmount : 0;

  const formatDateLabel = (dateValue: string) =>
    parseLocalDate(dateValue).toLocaleDateString(t.locale, {
      calendar: "gregory",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const resetSpinState = () => {
    setSpinResult(null);
    setNeedsRespin(false);
    setSpinHint(t.wheelHintDefault);
  };

  const resetSelectionAndClose = () => {
    setSelectedService(null);
    setCurrentLocalDate(getTodayDate());
    setSelectedDate(getTodayDate());
    setSelectedSlot(null);
    setAvailableSlots([]);
    setCustomerName(customerSession?.customerName || "");
    setCustomerPhone(customerSession?.customerPhone || "");
    setBookingResult(null);
    setSpinRotation(0);
    resetSpinState();
    onClose();
  };

  useEffect(() => {
    if (customerSession) {
      setCustomerName(customerSession.customerName || "");
      setCustomerPhone(customerSession.customerPhone || "");
    }
  }, [customerSession?.customerName, customerSession?.customerPhone]);

  useEffect(() => {
    const syncCurrentLocalDate = () => {
      setCurrentLocalDate(getTodayDate());
    };

    syncCurrentLocalDate();
    const timer = window.setInterval(syncCurrentLocalDate, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSpinHint(t.wheelHintDefault);
  }, [language]);

  useEffect(() => {
    setSelectedService(null);
    setSelectedSlot(null);
    setCurrentLocalDate(getTodayDate());
    setSelectedDate(getTodayDate());
    setBookingResult(null);
    setLoadingServices(true);
    setSpinRotation(0);
    resetSpinState();

    const loadServices = async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes, station_id")
        .or(`station_id.eq.${station.id},station_id.is.null`)
        .eq("is_active", true)
        .order("sort_order");

      if (error) {
        toast({
          title: t.searchLoadErrorTitle,
          description: error.message,
          variant: "destructive",
        });
      }

      setServices((data || []) as Service[]);
      setLoadingServices(false);
    };

    void loadServices();
  }, [station, language]);

  useEffect(() => {
    setSelectedDate((currentDate) => (!currentDate || currentDate < currentLocalDate ? currentLocalDate : currentDate));
  }, [currentLocalDate]);

  useEffect(() => {
    if (!isSlotsFlow || !selectedDate) {
      setAvailableSlots([]);
      setSelectedSlot(null);
      return;
    }

    const loadSlots = async () => {
      setLoadingSlots(true);

      const allSlots = generateTimeSlots(
        station.working_hours_start,
        station.working_hours_end,
        station.slot_duration_minutes,
      );

      const { data, error } = await supabase
        .from("bookings")
        .select("booking_time")
        .eq("station_id", station.id)
        .eq("booking_date", selectedDate)
        .in("status", ["pending", "confirmed"]);

      if (error) {
        toast({
          title: t.chooseTimeTitle,
          description: error.message,
          variant: "destructive",
        });
        setLoadingSlots(false);
        return;
      }

      const bookedSet = new Set(
        (data || []).map((booking) => booking.booking_time?.substring(0, 5)).filter(Boolean),
      );

      const now = new Date();
      const isToday = selectedDate === currentLocalDate;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const filteredSlots = allSlots.filter((slot) => {
        const [hour, minute] = slot.split(":").map(Number);
        const slotMinutes = hour * 60 + minute;

        if (bookedSet.has(slot)) return false;
        if (isToday && slotMinutes <= currentMinutes) return false;
        return true;
      });

      setAvailableSlots(filteredSlots);
      setSelectedSlot((currentSlot) => (filteredSlots.includes(currentSlot || "") ? currentSlot : null));
      setLoadingSlots(false);
    };

    void loadSlots();
  }, [isSlotsFlow, selectedDate, station, language]);

  useEffect(() => {
    setBookingResult(null);
    if (!spinning) {
      resetSpinState();
    }
  }, [selectedService?.id, selectedDate, selectedSlot, customerPhone, station.id]);

  const openGoogleMaps = () => {
    if (station.latitude && station.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`,
        "_blank",
      );
    }
  };

  const openWaze = () => {
    if (station.latitude && station.longitude) {
      window.open(
        `https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`,
        "_blank",
      );
    }
  };

  const handleSpin = async () => {
    if (!selectedService) return;

    if (!canSpin) {
      toast({
        title: t.completeDataTitle,
        description: t.completeSpinDataDescription,
        variant: "destructive",
      });
      return;
    }

    if (spinResult) return;

    setSpinning(true);
    setSpinHint(t.wheelHintSpinning);

    const { data, error } = await supabase.functions.invoke<SpinDiscountResponse>("spin-booking-discount", {
      body: {
        station_id: station.id,
        service_id: selectedService.id,
        customer_phone: normalizedPhone,
        booking_date: bookingDate,
        booking_time: isSlotsFlow ? selectedSlot : null,
      },
    });

    if (error || data?.error || !data?.segmentKey) {
      const fallbackError = error?.context && typeof error.context === "object" && "error" in error.context
        ? String((error.context as { error?: string }).error || "")
        : "";
      setSpinning(false);
      setSpinHint(t.spinFailedDescription);
      toast({
        title: t.spinFailedTitle,
        description: data?.error || fallbackError || error?.message || t.spinFailedDescription,
        variant: "destructive",
      });
      return;
    }

    const selectedArc = spinSegmentArcs.find((segment) => segment.key === data.segmentKey) || spinSegmentArcs[0];
    const nextRotation = calculateSpinRotation(spinRotation, selectedArc.midAngle);
    setSpinRotation(nextRotation);

    window.setTimeout(() => {
      setSpinning(false);

      const resolvedResult = {
        segmentKey: data.segmentKey!,
        discountPercent: data.discountPercent || 0,
        label: data.label || `${data.discountPercent || 0}%`,
        token: data.token || "",
      };

      setSpinResult(resolvedResult);
      setNeedsRespin(false);
      setSpinHint(`${t.wheelHintSaved}: (${resolvedResult.discountPercent})%`);
    }, 3800);
  };

  const handleCreateBooking = async () => {
    if (!selectedService) return;

    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: t.completeDataTitle,
        description: t.completeBookingDataDescription,
        variant: "destructive",
      });
      return;
    }

    if (isSlotsFlow && !selectedSlot) {
      toast({
        title: t.chooseTimeTitle,
        description: t.chooseTimeDescription,
        variant: "destructive",
      });
      return;
    }

    if (!spinResult?.token) {
      toast({
        title: t.spinFirstTitle,
        description: t.spinFirstDescription,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.functions.invoke("create-map-booking", {
      body: {
        station_id: station.id,
        service_id: selectedService.id,
        customer_name: customerName.trim(),
        customer_phone: normalizedPhone,
        language,
        booking_date: bookingDate,
        booking_time: isSlotsFlow ? selectedSlot : null,
        spin_discount_percent: spinResult.discountPercent,
        spin_token: spinResult.token,
      },
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: t.bookingFailedTitle,
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data?.error) {
      toast({
        title: t.bookingBlockedTitle,
        description: data.error,
        variant: "destructive",
      });
      return;
    }

    onBookingCreated?.(
      { bookingId: data.bookingId, bookingNumber: data.bookingNumber, source: "map" },
      normalizedPhone,
    );

    toast({
      title: t.bookingCreatedToastTitle,
      description: `#${data.bookingNumber} - ${t.bookingCreatedToastDescription} (${spinResult.discountPercent})%`,
    });
    resetSelectionAndClose();
  };

  const handleCancelBooking = async () => {
    if (!bookingResult) {
      resetSelectionAndClose();
      return;
    }

    setCancelling(true);

    const { data, error } = await supabase.functions.invoke<CancelBookingResponse>("cancel-map-booking", {
      body: {
        booking_id: bookingResult.bookingId,
        customer_phone: normalizedPhone,
      },
    });

    setCancelling(false);

    if (error || data?.error) {
      toast({
        title: t.cancelFailedTitle,
        description: data?.error || error?.message || t.spinFailedDescription,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t.bookingCancelledTitle,
      description: t.bookingCancelledDescription,
    });

    resetSelectionAndClose();
  };

  return (
    <div className="absolute left-0 top-0 z-[1000] h-full w-full bg-background shadow-2xl sm:w-[440px]" dir={isRtl ? "rtl" : "ltr"}>
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <Badge variant={open ? "default" : "destructive"}>
              {open ? t.stationOpen : t.stationClosed}
            </Badge>
          </div>

          {station.image_url ? (
            <div className="overflow-hidden rounded-2xl border border-border">
              <img src={station.image_url} alt={station.name} className="h-44 w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center rounded-2xl bg-sky-50">
              <MapPin className="h-10 w-10 text-sky-500" />
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-xl font-bold">{station.name}</h2>
            {station.address && (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
                <span>{station.address}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {station.working_hours_start.substring(0, 5)} - {station.working_hours_end.substring(0, 5)}
            </Badge>
            <Badge variant="secondary">{t.schedulingLabels[station.scheduling_type]}</Badge>
          </div>

          {station.latitude && station.longitude && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2" onClick={openGoogleMaps}>
                <Navigation className="h-4 w-4" />
                {t.googleMaps}
              </Button>
              <Button variant="outline" className="gap-2" onClick={openWaze}>
                <Navigation className="h-4 w-4" />
                {t.waze}
              </Button>
            </div>
          )}

          <Card>
            <CardContent className="space-y-4 pt-4">
              <StepHeader number="1" title={t.step1Title} description={t.step1Description} />

              {loadingServices ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.loadingServices}
                </div>
              ) : services.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noServices}</p>
              ) : (
                <div className="space-y-2">
                  {services.map((service) => {
                    const isSelected = selectedService?.id === service.id;

                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setSelectedService(service)}
                        className={`w-full rounded-2xl border p-3 text-right transition ${
                          isSelected ? "border-sky-500 bg-sky-50" : "border-border bg-card hover:border-sky-300"
                        } ${!isRtl ? "text-left" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {service.duration_minutes} {t.serviceDuration}
                            </p>
                          </div>
                          <Badge variant={isSelected ? "default" : "secondary"}>
                            {formatCurrency(service.price, language)}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {(isDailyFlow || isSlotsFlow) && (
            <Card>
              <CardContent className="space-y-4 pt-4">
                <StepHeader
                  number="2"
                  title={isSlotsFlow ? t.step2TitleSlots : t.step2TitleDaily}
                  description={t.step2Description}
                />

                  <Input
                    type="date"
                    min={currentLocalDate}
                    value={selectedDate}
                    onChange={(event) => {
                      const nextDate = event.target.value && event.target.value >= currentLocalDate
                        ? event.target.value
                        : currentLocalDate;
                      setSelectedDate(nextDate);
                      setSelectedSlot(null);
                      setBookingResult(null);
                    }}
                />

                {isSlotsFlow && (
                  <>
                    {loadingSlots ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loadingSlots}
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t.noSlots}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${
                              selectedSlot === slot
                                ? "border-sky-500 bg-sky-500 text-white"
                                : "border-border hover:border-sky-300"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden border border-cyan-200 bg-[radial-gradient(circle_at_top,_#ecfeff,_#eef2ff_52%,_#f8fafc)] text-slate-900 shadow-lg">
            <CardContent className="space-y-5 pt-5">
              <StepHeader number="3" title={t.step4Title} description={t.step4Description} />

              <div className="rounded-[24px] border border-cyan-200 bg-white/90 p-4 shadow-sm backdrop-blur">
                <div className="relative mx-auto h-[292px] w-[292px] max-w-full">
                  {Array.from({ length: 24 }, (_, lightIndex) => {
                    const angle = (360 / 24) * lightIndex;
                    return (
                      <div
                        key={lightIndex}
                        className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.55)] even:bg-indigo-400"
                        style={{
                          transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-146px)`,
                        }}
                      />
                    );
                  })}

                  <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2">
                    <div className="rounded-full bg-slate-950 p-1.5 shadow-lg shadow-cyan-500/20">
                      <div className="h-0 w-0 border-l-[15px] border-r-[15px] border-b-[30px] border-l-transparent border-r-transparent border-b-cyan-400" />
                    </div>
                  </div>

                  <div className="absolute inset-0 rounded-full border-[12px] border-slate-900 bg-slate-950 shadow-[0_0_0_6px_rgba(34,211,238,0.14),0_18px_45px_rgba(15,23,42,0.24)]" />

                  <div
                    className="absolute inset-[18px] rounded-full border-[6px] border-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.18),inset_0_8px_18px_rgba(255,255,255,0.2)]"
                    style={{
                      background: wheelBackground,
                      transform: `rotate(${spinRotation}deg)`,
                      transition: spinning ? "transform 3.8s cubic-bezier(0.18, 0.92, 0.24, 1)" : undefined,
                    }}
                  >
                    {spinSegmentArcs.map((segment) => {
                      const radius = -96;
                      const labelSize = "text-[30px]";
                      const subtitleSize = "text-xs";
                      const labelWidth = "w-24";

                      return (
                        <div
                          key={segment.key}
                          className={`absolute left-1/2 top-1/2 ${labelWidth} -translate-x-1/2 -translate-y-1/2 text-center`}
                          style={{
                            transform: `translate(-50%, -50%) rotate(${segment.midAngle}deg) translateY(${radius}px) rotate(-${segment.midAngle}deg)`,
                            color: segment.textColor,
                          }}
                        >
                          <div className={`${labelSize} font-extrabold leading-none`}>{segment.label}</div>
                          <div className={`mt-1 ${subtitleSize} font-semibold leading-4`}>{segment.subtitle}</div>
                        </div>
                      );
                    })}

                    <div className="absolute inset-[34%] flex flex-col items-center justify-center rounded-full border-4 border-white bg-[radial-gradient(circle,_#ffffff,_#e0f2fe)] text-center shadow-[0_10px_24px_rgba(15,23,42,0.24),inset_0_2px_12px_rgba(255,255,255,0.8)]">
                      <div className="text-[11px] font-extrabold tracking-[0.18em] text-cyan-700">WASHLLY</div>
                      <div className="mt-2 text-xs leading-5 text-slate-500">{t.wheelCurrentBookingDiscount}</div>
                      <div className="mt-2 text-2xl font-black text-slate-950">
                        {spinResult ? `${spinResult.discountPercent}%` : needsRespin ? "↻" : "?"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-center text-sm leading-7 text-cyan-950">
                  {spinHint}
                </div>

                {selectedService && spinResult && (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      <div className="text-slate-600">{t.price}</div>
                      <div className="font-bold text-slate-900">{formatCurrency(selectedService.price, language)}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-2">
                      <div className="text-emerald-700">{t.discount}</div>
                      <div className="font-bold text-emerald-900">{formatCurrency(discountAmount, language)}</div>
                    </div>
                    <div className="rounded-2xl border border-sky-300 bg-sky-50 p-2">
                      <div className="text-sky-700">{t.afterDiscount}</div>
                      <div className="font-bold text-sky-900">{formatCurrency(finalPrice, language)}</div>
                    </div>
                  </div>
                )}

                <Button
                  className="mt-5 h-12 w-full gap-2 bg-gradient-to-l from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:from-cyan-600 hover:to-indigo-700"
                  disabled={spinning || !!spinResult || !canSpin}
                  onClick={handleSpin}
                >
                  {spinning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.wheelSpinningButton}
                    </>
                  ) : needsRespin ? (
                    <>
                      <RotateCw className="h-4 w-4" />
                      {t.wheelRetryButton}
                    </>
                  ) : spinResult ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {t.wheelSavedButton}
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4" />
                      {t.wheelButton}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-4">
              <StepHeader number="4" title={t.step5Title} description={t.step5Description} />

              <div className="rounded-2xl border bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                <p>{t.summaryBoxLine1}</p>
                <p className="mt-1">{t.summaryBoxLine2}</p>
              </div>

              {!bookingResult ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full" disabled={!canSubmit || submitting} onClick={handleCreateBooking}>
                    {submitting ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        {t.confirmingBooking}
                      </>
                    ) : (
                      t.confirmBooking
                    )}
                  </Button>

                  <Button variant="outline" className="w-full" disabled={submitting} onClick={handleCancelBooking}>
                    {t.cancelBooking}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      {t.bookingSentTitle}
                    </div>
                    <p className="mt-2">{t.bookingNumber}: #{bookingResult.bookingNumber}</p>
                    <p className="mt-1">{t.fixedDiscount}: ({bookingResult.discountPercent})%</p>
                    <p className="mt-1">{t.waitingApproval}</p>
                    <p className="mt-1">{t.successResetNote}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="w-full" onClick={resetSelectionAndClose}>
                      {t.returnToMap}
                    </Button>

                    <Button variant="destructive" className="w-full" disabled={cancelling} onClick={handleCancelBooking}>
                      {cancelling ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          {t.cancellingBooking}
                        </>
                      ) : (
                        t.cancelBooking
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

const StationsMap = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showQuickBooking, setShowQuickBooking] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split("T")[0]);
  const [quickTime, setQuickTime] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickCancelSubmitting, setQuickCancelSubmitting] = useState(false);
  const [trackedBookings, setTrackedBookings] = useState<TrackedBooking[]>([]);
  const [trackedStatuses, setTrackedStatuses] = useState<Record<string, string>>({});
  const [trackedPhone, setTrackedPhone] = useState("");
  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [customerInbox, setCustomerInbox] = useState<any[]>([]);
  const inboxCountRef = useRef(0);
  const customerActivityRef = useRef("");
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [customerInboxError, setCustomerInboxError] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const [customerBookingEdits, setCustomerBookingEdits] = useState<Record<string, { date: string; time: string }>>({});
  const [customerActionBusy, setCustomerActionBusy] = useState<Record<string, boolean>>({});
  const [customerRatingBusy, setCustomerRatingBusy] = useState<Record<string, boolean>>({});
  const [showRatingForBooking, setShowRatingForBooking] = useState<Record<string, boolean>>({});
  const [showFullCustomerInbox, setShowFullCustomerInbox] = useState(false);
  const { language, isRtl } = useAppLanguage();

  const t = translations[language];
  const q = quickBookingTranslations[language];
  const TRACK_KEY = "washlly_customer_tracked_bookings_v1";
  const TRACK_PHONE_KEY = "washlly_customer_tracked_phone_v1";
  const normalizeTrackedPhone = (phone: string) => {
    const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
    return cleaned;
  };

  useEffect(() => {
    const session = getCustomerSession();
    if (session) {
      setQuickCustomerName(session.customerName || "");
      setQuickCustomerPhone(session.customerPhone || "");
      setTrackedPhone(session.customerPhone || "");
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRACK_KEY);
      const rawPhone = localStorage.getItem(TRACK_PHONE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TrackedBooking[];
        if (Array.isArray(parsed)) setTrackedBookings(parsed);
      }
      if (rawPhone) setTrackedPhone(rawPhone);
    } catch {
      // ignore storage parse errors
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(TRACK_KEY, JSON.stringify(trackedBookings));
  }, [trackedBookings]);

  useEffect(() => {
    if (trackedPhone) {
      localStorage.setItem(TRACK_PHONE_KEY, trackedPhone);
    }
  }, [trackedPhone]);

  const playInboxBell = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.25);
    } catch {
      // ignore audio errors
    }
  }, []);

  const showCustomerScreenNotice = useCallback((title: string, body?: string) => {
    toast({ title, description: body });

    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    try {
      new Notification(title, {
        body,
        icon: "/pwa-icon-192.png",
        tag: "washlly-customer-inbox",
      });
    } catch {
      // Browser notification support differs between mobile browsers.
    }
  }, []);

  const requestCustomerNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      toast({ title: "الإشعارات غير مدعومة", description: "هذا المتصفح لا يدعم إشعارات الشاشة." });
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      showCustomerScreenNotice("تم تفعيل إشعارات Washlly", "سيظهر تنبيه على الشاشة عند تحديث الحجز.");
    } else {
      toast({ title: "لم يتم تفعيل الإشعارات", description: "يمكن تفعيلها لاحقاً من إعدادات المتصفح." });
    }
  }, [showCustomerScreenNotice]);

  const refreshCustomerInbox = useCallback(async (notifyOnChange = false) => {
    const session = getCustomerSession();
    if (!session) {
      setCustomerInbox([]);
      setCustomerBookings([]);
      setCustomerInboxError("");
      return;
    }

    setLoadingInbox(true);
    setCustomerInboxError("");

    try {
      const { data, error } = await supabase.functions.invoke("customer-get-inbox", {
        body: {
          customer_phone: session.customerPhone,
          session_token: session.sessionToken,
        },
      });

      if (error || (data as any)?.error) {
        const message = (data as any)?.error || error?.message || "تعذر تحديث صندوق البريد.";
        setCustomerInboxError(message);
        if (notifyOnChange) {
          toast({ title: "تعذر تحديث صندوق البريد", description: message, variant: "destructive" });
        }
        return;
      }

      const rows = Array.isArray((data as any)?.notifications) ? (data as any).notifications : [];
      const bookings = Array.isArray((data as any)?.bookings) ? (data as any).bookings : [];
      const unreadCount = rows.filter((row: any) => !row.is_read).length;
      const activityFingerprint = [
        ...rows.map((row: any) => `${row.id}:${row.created_at || ""}`),
        ...bookings.map((booking: any) => `${booking.id}:${booking.status}:${booking.booking_date}:${booking.booking_time || ""}`),
      ].join("|");
      const hasExistingActivity = customerActivityRef.current.length > 0;
      if ((unreadCount > inboxCountRef.current || (hasExistingActivity && activityFingerprint !== customerActivityRef.current))) {
        playInboxBell();
        const latestUnread = rows.find((row: any) => !row.is_read);
        showCustomerScreenNotice(
          latestUnread?.title || "تحديث جديد على الحجز",
          latestUnread?.body || "تم تحديث حالة أحد حجوزاتك داخل صندوق البريد.",
        );
      }
      inboxCountRef.current = unreadCount;
      customerActivityRef.current = activityFingerprint;
      setCustomerInbox(rows);
      setCustomerBookings(bookings);
      setCustomerBookingEdits((prev) => {
        const next = { ...prev };
        for (const booking of bookings) {
          if (!booking?.id || next[booking.id]) continue;
          next[booking.id] = {
            date: booking.booking_date || formatLocalDate(new Date()),
            time: String(booking.booking_time || "08:00").slice(0, 5),
          };
        }
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تحديث صندوق البريد.";
      setCustomerInboxError(message);
      if (notifyOnChange) {
        toast({ title: "تعذر تحديث صندوق البريد", description: message, variant: "destructive" });
      }
    } finally {
      setLoadingInbox(false);
    }
  }, [playInboxBell, showCustomerScreenNotice]);

  useEffect(() => {
    void refreshCustomerInbox(false);
    const timer = window.setInterval(() => void refreshCustomerInbox(true), 7000);
    return () => window.clearInterval(timer);
  }, [refreshCustomerInbox]);

  const markCustomerNotificationRead = async (notificationId: string) => {
    const session = getCustomerSession();
    if (!session) return;
    await supabase.functions.invoke("customer-mark-notification-read", {
      body: {
        customer_phone: session.customerPhone,
        session_token: session.sessionToken,
        notification_id: notificationId,
      },
    });
    setCustomerInbox((prev) => prev.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item)));
  };

  const markAllCustomerNotificationsRead = async () => {
    const session = getCustomerSession();
    if (!session) return;
    await supabase.functions.invoke("customer-mark-notification-read", {
      body: {
        customer_phone: session.customerPhone,
        session_token: session.sessionToken,
        mark_all: true,
      },
    });
    setCustomerInbox((prev) => prev.map((item) => ({ ...item, is_read: true })));
  };
  const quickTimeOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    const today = formatLocalDate(now);
    const isToday = quickDate === today;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const firstAllowedMinutes = isToday ? Math.ceil(currentMinutes / 30) * 30 : 0;

    for (let totalMinutes = firstAllowedMinutes; totalMinutes < 24 * 60; totalMinutes += 30) {
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      const value = toQuickTimeValue(hour, minute);
      options.push({ value, label: formatQuickTime12(hour, minute) });
    }
    return options;
  }, [quickDate]);

  useEffect(() => {
    if (quickTime && !quickTimeOptions.some((option) => option.value === quickTime)) {
      setQuickTime(quickTimeOptions[0]?.value || "");
    }
  }, [quickTime, quickTimeOptions]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
  });

  useEffect(() => {
    const loadStations = async () => {
      const { data: ownersData, error: ownersError } = await supabase
        .from("station_owners")
        .select("station_id, is_active, created_at");

      if (ownersError) {
        toast({
          title: t.searchLoadErrorTitle,
          description: ownersError.message,
          variant: "destructive",
        });
        return;
      }

      const latestOwnerByStation = new Map<string, any>();
      for (const row of ownersData || []) {
        if (!row?.station_id) continue;
        const key = String(row.station_id);
        const prev = latestOwnerByStation.get(key);
        const rowTs = new Date(String(row?.created_at || 0)).getTime();
        const prevTs = prev ? new Date(String(prev?.created_at || 0)).getTime() : -1;
        if (!prev || rowTs >= prevTs) {
          latestOwnerByStation.set(key, row);
        }
      }

      const activeOwnerStationIds = new Set(
        [...latestOwnerByStation.entries()]
          .filter(([, row]) => row?.is_active !== false)
          .map(([stationId]) => stationId),
      );

      const { data, error } = await supabase
        .from("stations")
        .select("*")
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (error) {
        toast({
          title: t.searchLoadErrorTitle,
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const filteredByOwner = (data || []).filter((station: any) =>
        activeOwnerStationIds.has(String(station.id)),
      );
      setStations(filteredByOwner as Station[]);
    };

    void loadStations();
  }, [language]);

  const filteredStations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const mappedStations = stations.map((station) => {
      if (!userLocation || !station.latitude || !station.longitude) {
        return { ...station, distance: null };
      }

      const distance = Math.hypot(
        station.latitude - userLocation.lat,
        station.longitude - userLocation.lng,
      );

      return { ...station, distance };
    });

    const matchingStations = query
      ? mappedStations.filter(
          (station) =>
            station.name.toLowerCase().includes(query) ||
            station.address?.toLowerCase().includes(query) ||
            station.detailed_address?.toLowerCase().includes(query),
        )
      : mappedStations;

    return matchingStations.sort((a, b) => {
      if (a.distance == null && b.distance == null) return 0;
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  }, [searchQuery, stations, userLocation]);

  const handleMarkerClick = (station: Station) => {
    setSelectedStation(station);

    if (station.latitude && station.longitude && map) {
      map.panTo({ lat: station.latitude, lng: station.longitude });
      map.setZoom(15);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({
        title: t.browserLocationTitle,
        description: t.browserLocationDescription,
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = { lat: coords.latitude, lng: coords.longitude };
        setUserLocation(nextLocation);
        if (map) {
          map.panTo(nextLocation);
          map.setZoom(13);
        }
      },
      () => {
        toast({
          title: t.locationErrorTitle,
          description: t.locationErrorDescription,
          variant: "destructive",
        });
      },
    );
  };

  const handleQuickBooking = async () => {
    if (!quickCustomerName || !quickCustomerPhone || !quickDate || !quickTime) {
      toast({
        title: q.completeTitle,
        description: q.completeDesc,
        variant: "destructive",
      });
      return;
    }

    if (!userLocation) {
      toast({
        title: t.locationErrorTitle,
        description: language === "ar" ? "اضغط موقعي أولاً حتى نبحث ضمن نطاق 15 كم." : "Tap My location first so we only search within 15 km.",
        variant: "destructive",
      });
      return;
    }

    if (!quickTimeOptions.some((option) => option.value === quickTime)) {
      toast({
        title: t.chooseTimeTitle,
        description: language === "ar" ? "اختر وقتاً متاحاً بعد الوقت الحالي." : "Choose an available time after the current time.",
        variant: "destructive",
      });
      return;
    }

    setQuickSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-quick-booking", {
      body: {
        customer_name: quickCustomerName,
        customer_phone: quickCustomerPhone,
        service_kind: "quick",
        booking_date: quickDate,
        booking_time: quickTime,
        language,
        customer_lat: userLocation?.lat ?? null,
        customer_lng: userLocation?.lng ?? null,
      },
    });
    setQuickSubmitting(false);

    if (error || (data && (data as any).error)) {
      toast({
        title: q.failTitle,
        description: (data as any)?.message || error?.message || q.failDesc,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: q.okTitle,
      description: q.okDesc,
    });
    const targets = Array.isArray((data as any)?.targets) ? (data as any).targets : [];
    const quickTracked: TrackedBooking[] = targets
      .map((target: any) => ({
        bookingId: String(target.booking_id || ""),
        bookingNumber: Number(target.booking_number || 0) || undefined,
        source: "quick" as const,
      }))
      .filter((item) => item.bookingId);
    if (quickTracked.length > 0) {
      const normalizedPhone = normalizeTrackedPhone(quickCustomerPhone);
      setTrackedPhone(normalizedPhone);
      setTrackedBookings((prev) => {
        const map = new Map(prev.map((item) => [item.bookingId, item]));
        for (const next of quickTracked) map.set(next.bookingId, next);
        return [...map.values()];
      });
      setTrackedStatuses((prev) => {
        const next = { ...prev };
        for (const item of quickTracked) {
          if (!next[item.bookingId]) next[item.bookingId] = "pending";
        }
        return next;
      });
    }
    setShowQuickBooking(false);
    window.setTimeout(() => void refreshCustomerInbox(false), 500);
  };

  const handleCancelAllBookings = async () => {
    if (!quickCustomerPhone.trim()) {
      toast({
        title: q.cancelAllNeedPhoneTitle,
        description: q.cancelAllNeedPhoneDesc,
        variant: "destructive",
      });
      return;
    }

    setQuickCancelSubmitting(true);
    const { data, error } = await supabase.functions.invoke<CancelAllBookingsResponse>("cancel-all-map-bookings", {
      body: {
        customer_phone: quickCustomerPhone.trim(),
      },
    });
    setQuickCancelSubmitting(false);

    if (error || !data?.success) {
      toast({
        title: q.cancelAllFailTitle,
        description: data?.error || error?.message || q.cancelAllFailDesc,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: q.cancelAllOkTitle,
      description: data.alreadyEmpty ? q.cancelAllOkDesc : `${q.cancelAllOkDesc} (${data.cancelledCount ?? 0})`,
    });
    setTrackedBookings([]);
    setTrackedStatuses({});
  };

  const handleCustomerBookingAction = async (
    bookingId: string,
    action: "cancel" | "postpone" | "accept_postpone",
    nextDate?: string,
    nextTime?: string,
  ) => {
    const session = getCustomerSession();
    if (!session) return;
    setCustomerActionBusy((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("customer-manage-booking", {
        body: {
          booking_id: bookingId,
          action,
          booking_date: nextDate || null,
          booking_time: nextTime || null,
          customer_phone: session.customerPhone,
          session_token: session.sessionToken,
        },
      });
      if (error || (data as any)?.error) {
        toast({ title: "تعذر تعديل الحجز", description: (data as any)?.error || error?.message, variant: "destructive" });
        return;
      }
      toast({
        title:
          action === "cancel"
            ? "تم إلغاء الحجز"
            : action === "accept_postpone"
              ? "تمت الموافقة على الموعد"
              : "تم إرسال طلب التأجيل",
      });
      await refreshCustomerInbox(false);
    } finally {
      setCustomerActionBusy((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  const handleCustomerRating = async (bookingId: string, rating: number) => {
    const session = getCustomerSession();
    if (!session) return;

    setCustomerRatingBusy((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("customer-submit-rating", {
        body: {
          booking_id: bookingId,
          rating,
          customer_phone: session.customerPhone,
          session_token: session.sessionToken,
        },
      });

      if (error || (data as any)?.error) {
        toast({
          title: "تعذر إرسال التقييم",
          description: (data as any)?.error || error?.message,
          variant: "destructive",
        });
        return;
      }

      toast({ title: "شكراً لتقييمك", description: "تم إرسال تقييم الغسل إلى الإدارة." });
      setShowRatingForBooking((prev) => ({ ...prev, [bookingId]: false }));
      await refreshCustomerInbox(false);
    } finally {
      setCustomerRatingBusy((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  useEffect(() => {
    if (!trackedPhone || trackedBookings.length === 0) return;
    const ids = trackedBookings.map((b) => b.bookingId).filter(Boolean);
    if (ids.length === 0) return;

    const timer = window.setInterval(async () => {
      const { data, error } = await supabase.functions.invoke("get-booking-statuses", {
        body: {
          booking_ids: ids,
          customer_phone: trackedPhone,
        },
      });
      if (error || (data as any)?.error) return;

      const rows = Array.isArray((data as any)?.bookings) ? (data as any).bookings : [];
      const terminal = new Set(["confirmed", "cancelled", "completed"]);
      const nextStatuses: Record<string, string> = {};
      for (const row of rows) {
        const id = String(row.id || "");
        const status = String(row.status || "");
        if (!id || !status) continue;
        nextStatuses[id] = status;
        const prev = trackedStatuses[id];
        if (prev && prev !== status) {
          const bookingNo = row.booking_number ? `#${row.booking_number}` : `#${id.slice(0, 8)}`;
          if (status === "confirmed") {
            toast({ title: "تم قبول الحجز", description: `${bookingNo} تم قبوله من المحطة.` });
          } else if (status === "cancelled") {
            toast({ title: "تم رفض/إلغاء الحجز", description: `${bookingNo} تم إلغاؤه.` });
          } else if (status === "pending_customer_approval") {
            toast({ title: "تم تأجيل الموعد", description: `${bookingNo} بانتظار موافقتك على الموعد الجديد.` });
          }
        }
      }

      setTrackedStatuses((prev) => ({ ...prev, ...nextStatuses }));
      setTrackedBookings((prev) => prev.filter((item) => !terminal.has(nextStatuses[item.bookingId])));
    }, 12000);

    return () => window.clearInterval(timer);
  }, [trackedBookings, trackedPhone, trackedStatuses]);

  const uniqueCustomerBookings = useMemo(() => {
    const seen = new Set<string>();
    return customerBookings.filter((booking) => {
      const key = String(booking?.id || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [customerBookings]);

  const uniqueCustomerBookingIds = useMemo(
    () => new Set(uniqueCustomerBookings.map((booking) => String(booking?.id || "")).filter(Boolean)),
    [uniqueCustomerBookings],
  );

  const uniqueCustomerInbox = useMemo(() => {
    const seen = new Set<string>();
    return customerInbox.filter((item) => {
      const bookingRef = String(item.reference_booking_id || "");
      if (bookingRef && uniqueCustomerBookingIds.has(bookingRef)) return false;
      const key = bookingRef ? `booking:${bookingRef}` : `${item.title || ""}:${item.body || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [customerInbox, uniqueCustomerBookingIds]);

  const visibleCustomerNotifications = showFullCustomerInbox ? uniqueCustomerInbox : uniqueCustomerInbox.slice(0, 2);
  const visibleCustomerBookings = showFullCustomerInbox ? uniqueCustomerBookings : uniqueCustomerBookings.slice(0, 2);
  const hiddenCustomerInboxCount = Math.max(
    0,
    uniqueCustomerInbox.length + uniqueCustomerBookings.length
      - Math.min(uniqueCustomerInbox.length, 2)
      - Math.min(uniqueCustomerBookings.length, 2),
  );
  const unreadCustomerInboxCount = uniqueCustomerInbox.filter((item) => !item.is_read).length;
  const customerStatusLabels: Record<string, string> = {
    pending: "بانتظار موافقة المحطة",
    pending_owner_approval: "بانتظار موافقة المحطة",
    pending_customer_approval: "بانتظار موافقتك على الموعد الجديد",
    confirmed: "مؤكد",
    cancelled: "ملغي",
    completed: "مكتمل",
  };
  const customerStatusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    pending_owner_approval: "secondary",
    pending_customer_approval: "outline",
    confirmed: "default",
    cancelled: "destructive",
    completed: "outline",
  };
  const activeCustomerStatuses = new Set(["pending", "pending_owner_approval", "pending_customer_approval", "confirmed"]);

  return (
    <div className="min-h-screen w-full bg-slate-50" dir={isRtl ? "rtl" : "ltr"}>
      <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
        <Card className="border-blue-100 shadow-sm">
          <CardContent className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">بوابة الزبون</h2>
                <p className="text-sm text-muted-foreground">الاسم والرقم وصندوق البريد في واجهة واحدة.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <InstallAppButton />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearCustomerSession();
                    window.location.href = "/customer-login";
                  }}
                >
                  خروج الزبون
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Input value={quickCustomerName} readOnly className="md:col-span-2" />
              <Input value={quickCustomerPhone} readOnly dir="ltr" className="md:col-span-2" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="gap-2 bg-blue-600 text-white hover:bg-blue-700" onClick={handleLocateMe}>
                <LocateFixed className="h-4 w-4" />
                {t.myLocation}
              </Button>
              <Button variant={showQuickBooking ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setShowQuickBooking((prev) => !prev)}>
                <CalendarCheck className="h-4 w-4" />
                {q.cta}
              </Button>
              <Button variant="destructive" size="sm" className="gap-2" onClick={handleCancelAllBookings} disabled={quickCancelSubmitting}>
                {quickCancelSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                {quickCancelSubmitting ? q.cancelAllSubmitting : q.cancelAllCta}
              </Button>
            </div>
          </CardContent>
        </Card>

        {showQuickBooking && (
          <Card className="border-blue-100 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="text-sm font-semibold">{q.cardTitle}</div>
              <div className="text-xs text-muted-foreground">{q.cardHint}</div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={quickDate} onChange={(event) => setQuickDate(event.target.value)} />
                <Select value={quickTime} onValueChange={setQuickTime}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر الوقت" : "Select time"} />
                  </SelectTrigger>
                  <SelectContent side="top" align="start" avoidCollisions className="z-[2600] max-h-72">
                    {quickTimeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={quickSubmitting} onClick={handleQuickBooking}>
                {quickSubmitting ? q.submitting : q.submit}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-blue-100 shadow-sm">
          <CardContent className="p-0">
            <div className="h-[65vh] min-h-[420px] w-full">
              {isLoaded ? (
                <GoogleMap
                  onLoad={(instance) => setMap(instance)}
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  center={userLocation || DEFAULT_CENTER}
                  zoom={userLocation ? 12 : 7}
                  options={{
                    fullscreenControl: false,
                    mapTypeControl: false,
                    streetViewControl: false,
                  }}
                >
                  {userLocation && <Marker position={userLocation} />}
                  {filteredStations.map((station) => {
                    const ratingAverage = Number(station.rating_average || 0);
                    const ratingCount = Number(station.rating_count || 0);
                    const hasRating = ratingCount > 0 && ratingAverage > 0;

                    return (
                      <Fragment key={station.id}>
                        <Marker
                          position={{ lat: station.latitude!, lng: station.longitude! }}
                          onClick={() => handleMarkerClick(station)}
                        />
                        {hasRating && (
                          <OverlayView
                            position={{ lat: station.latitude!, lng: station.longitude! }}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                          >
                            <button
                              type="button"
                              onClick={() => handleMarkerClick(station)}
                              className="flex -translate-x-1/2 -translate-y-[54px] items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 shadow-lg"
                            >
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              <span>{ratingAverage.toFixed(1)}</span>
                              <span className="text-[10px] text-slate-500">({ratingCount})</span>
                            </button>
                          </OverlayView>
                        )}
                      </Fragment>
                    );
                  })}
                </GoogleMap>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.loadingMap}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <Bell className="h-5 w-5" />
                  {unreadCustomerInboxCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadCustomerInboxCount}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">صندوق البريد</h3>
                  <p className="text-xs text-muted-foreground">كل إشعارات الحجز وخيارات الإلغاء أو التأجيل تظهر هنا.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
                  <Button variant="outline" size="sm" onClick={requestCustomerNotificationPermission}>
                    تفعيل التنبيه
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-2" onClick={() => refreshCustomerInbox(false)}>
                  <RotateCw className={`h-4 w-4 ${loadingInbox ? "animate-spin" : ""}`} />
                  تحديث
                </Button>
                {unreadCustomerInboxCount > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllCustomerNotificationsRead}>
                    تحديد الكل كمقروء
                  </Button>
                )}
              </div>
            </div>

            {customerInboxError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <div className="font-semibold">تعذر تحميل صندوق البريد</div>
                <div className="mt-1 text-xs">{customerInboxError}</div>
              </div>
            )}

            {visibleCustomerNotifications.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => !item.is_read && void markCustomerNotificationRead(item.id)}
                className={`w-full rounded-xl border p-3 text-start text-sm transition ${
                  item.is_read ? "bg-white hover:border-blue-200" : "border-blue-300 bg-blue-50 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{item.title}</div>
                  {!item.is_read && <Badge variant="destructive">جديد</Badge>}
                </div>
                <div className="mt-1 text-xs leading-6 text-muted-foreground">{item.body}</div>
              </button>
            ))}

            <div className="space-y-3">
              {visibleCustomerBookings.map((b) => {
                const status = String(b.status || "");
                const edit = customerBookingEdits[b.id] || {
                  date: b.booking_date || formatLocalDate(new Date()),
                  time: String(b.booking_time || "08:00").slice(0, 5),
                };
                const canAct = activeCustomerStatuses.has(status);
                const busy = !!customerActionBusy[b.id];
                const ratingBusy = !!customerRatingBusy[b.id];
                const ratingValue = Number(b.customer_rating || 0);
                const canFinishAndRate = status === "confirmed" && !ratingValue;
                const canRateCompleted = status === "completed" && !ratingValue;
                const showRatingStars = !!showRatingForBooking[b.id] || canRateCompleted;
                const awaitingCustomerApproval = status === "pending_customer_approval";

                return (
                  <div key={b.id} className="rounded-2xl border bg-white p-3 text-sm shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-bold">#{b.booking_number} - {(b as any).stations?.name || "محطة"}</div>
                        <div className="mt-1 text-xs leading-6 text-muted-foreground">
                          {(b as any).services?.name || "-"} | {b.booking_date} {String(b.booking_time || "").slice(0, 5)}
                        </div>
                      </div>
                      <Badge variant={customerStatusVariants[status] || "secondary"}>
                        {customerStatusLabels[status] || status}
                      </Badge>
                    </div>

                    {canAct && (
                      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto_auto]">
                        <Input
                          type="date"
                          value={edit.date}
                          onChange={(event) =>
                            setCustomerBookingEdits((prev) => ({
                              ...prev,
                              [b.id]: { date: event.target.value, time: prev[b.id]?.time || edit.time },
                            }))
                          }
                        />
                        <Input
                          type="time"
                          value={edit.time}
                          onChange={(event) =>
                            setCustomerBookingEdits((prev) => ({
                              ...prev,
                              [b.id]: { date: prev[b.id]?.date || edit.date, time: event.target.value },
                            }))
                          }
                        />
                        {awaitingCustomerApproval && (
                          <Button
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={busy}
                            onClick={() => handleCustomerBookingAction(b.id, "accept_postpone")}
                          >
                            {busy ? "..." : "قبول الموعد"}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleCustomerBookingAction(b.id, "postpone", edit.date, edit.time)}
                        >
                          {busy ? "..." : awaitingCustomerApproval ? "طلب وقت آخر" : "تأجيل"}
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={busy}
                          onClick={() => handleCustomerBookingAction(b.id, "cancel")}
                        >
                          إلغاء
                        </Button>
                      </div>
                    )}

                    {ratingValue > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <span className="font-semibold">تقييمك:</span>
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }, (_, index) => (
                            <Star
                              key={index}
                              className={`h-4 w-4 ${index < ratingValue ? "fill-amber-400 text-amber-400" : "text-amber-200"}`}
                            />
                          ))}
                        </span>
                      </div>
                    )}

                    {canFinishAndRate && !showRatingStars && (
                      <Button
                        variant="outline"
                        className="mt-3 gap-2 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        disabled={ratingBusy}
                        onClick={() => setShowRatingForBooking((prev) => ({ ...prev, [b.id]: true }))}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        تأكيد إتمام المهمة
                      </Button>
                    )}

                    {showRatingStars && !ratingValue && (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-3">
                        <div className="mb-2 text-sm font-semibold text-slate-900">قيّم الغسل من 1 إلى 5 نجوم</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {Array.from({ length: 5 }, (_, index) => {
                            const rating = index + 1;
                            return (
                              <button
                                key={rating}
                                type="button"
                                disabled={ratingBusy}
                                onClick={() => handleCustomerRating(b.id, rating)}
                                className="rounded-full p-1 transition hover:scale-110 disabled:opacity-50"
                                aria-label={`تقييم ${rating}`}
                              >
                                <Star className="h-8 w-8 fill-amber-400 text-amber-400 drop-shadow-sm" />
                              </button>
                            );
                          })}
                          {ratingBusy && (
                            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              جاري إرسال التقييم...
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hiddenCustomerInboxCount > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowFullCustomerInbox((current) => !current)}
              >
                {showFullCustomerInbox ? "إخفاء الباقي" : `إظهار الباقي (${hiddenCustomerInboxCount})`}
              </Button>
            )}

            {loadingInbox && <p className="text-xs text-muted-foreground">جاري تحديث صندوق البريد...</p>}
            {uniqueCustomerBookings.length === 0 && uniqueCustomerInbox.length === 0 && !loadingInbox && (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                لا توجد إشعارات أو حجوزات حالية.
              </p>
            )}
          </CardContent>
        </Card>

      </div>

      {selectedStation && (
        <StationCard
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
          language={language}
          onBookingCreated={(tracked, customerPhone) => {
            setTrackedPhone(customerPhone);
            setTrackedBookings((prev) => {
              if (prev.some((item) => item.bookingId === tracked.bookingId)) return prev;
              return [tracked, ...prev];
            });
            setTrackedStatuses((prev) => ({ ...prev, [tracked.bookingId]: prev[tracked.bookingId] || "pending" }));
            window.setTimeout(() => void refreshCustomerInbox(false), 500);
          }}
        />
      )}
    </div>
  );
};

export default StationsMap;


