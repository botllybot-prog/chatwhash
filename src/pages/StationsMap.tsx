import { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import {
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
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const DEFAULT_CENTER = { lat: 33.3152, lng: 44.3661 };

const SPIN_SEGMENTS = [
  { key: "discount_5", label: "5%", subtitle: "خصم فوري", color: "#2ea7ff", discountPercent: 5, size: 88, textColor: "#ffffff" },
  { key: "discount_10", label: "10%", subtitle: "خصم فوري", color: "#1c6ce5", discountPercent: 10, size: 88, textColor: "#ffffff" },
  { key: "discount_15", label: "15%", subtitle: "خصم فوري", color: "#0b47b5", discountPercent: 15, size: 88, textColor: "#ffffff" },
  { key: "retry", label: "أعد", subtitle: "المحاولة", color: "#1f7ae0", discountPercent: 0, size: 76, textColor: "#ffffff" },
  { key: "discount_0", label: "0%", subtitle: "بدون خصم", color: "#f5f7fb", discountPercent: 0, size: 20, textColor: "#111827" },
] as const;

const SPIN_SEGMENT_ARCS = SPIN_SEGMENTS.reduce<
  Array<(typeof SPIN_SEGMENTS)[number] & { startAngle: number; endAngle: number; midAngle: number }>
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

const WHEEL_BACKGROUND = `conic-gradient(from -90deg, ${SPIN_SEGMENT_ARCS.map((segment) => {
  return `${segment.color} ${segment.startAngle}deg ${segment.endAngle}deg`;
}).join(", ")})`;

const WHEEL_LIGHTS = Array.from({ length: 12 }, (_, index) => index);

interface Station {
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
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  station_id: string | null;
}

interface BookingResult {
  bookingId: string;
  bookingNumber: number;
  discountPercent: number;
}

interface SpinResult {
  segmentKey: string;
  discountPercent: number;
  label: string;
  token: string;
}

interface SpinDiscountResponse {
  segmentKey?: string;
  discountPercent?: number;
  label?: string;
  token?: string;
  requiresRespin?: boolean;
  error?: string;
}

interface CancelBookingResponse {
  success?: boolean;
  error?: string;
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

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function formatCurrency(amount: number) {
  return `${Math.round(amount)} د.ع`;
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
}: {
  station: Station;
  onClose: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [spinRotation, setSpinRotation] = useState(0);
  const [spinHint, setSpinHint] = useState("لف العجلة مرة واحدة قبل تأكيد الحجز، وإذا ظهرت لك محاولة إضافية يمكنك الدوران مرة أخرى لنفس الطلب فقط.");
  const [needsRespin, setNeedsRespin] = useState(false);

  const open = isStationOpen(station);
  const isSlotsFlow = station.scheduling_type === "slots";
  const isDailyFlow = station.scheduling_type === "daily";
  const bookingDate = isDailyFlow || isSlotsFlow ? selectedDate : getTodayDate();
  const normalizedPhone = normalizePhone(customerPhone);

  const schedulingLabels: Record<Station["scheduling_type"], string> = {
    slots: "حجز بموعد",
    instant: "حجز فوري",
    daily: "حجز يومي",
  };

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

  const resetSpinState = () => {
    setSpinResult(null);
    setNeedsRespin(false);
    setSpinHint("لف العجلة مرة واحدة قبل تأكيد الحجز، وإذا ظهرت لك محاولة إضافية يمكنك الدوران مرة أخرى لنفس الطلب فقط.");
  };

  const resetSelectionAndClose = () => {
    setSelectedService(null);
    setSelectedDate(getTodayDate());
    setSelectedSlot(null);
    setAvailableSlots([]);
    setCustomerName("");
    setCustomerPhone("");
    setBookingResult(null);
    setSpinRotation(0);
    resetSpinState();
    onClose();
  };

  useEffect(() => {
    setSelectedService(null);
    setSelectedSlot(null);
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
          title: "تعذر تحميل الخدمات",
          description: error.message,
          variant: "destructive",
        });
      }

      setServices((data || []) as Service[]);
      setLoadingServices(false);
    };

    void loadServices();
  }, [station]);

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
          title: "تعذر تحميل الأوقات",
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
      const isToday = selectedDate === getTodayDate();
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
  }, [isSlotsFlow, selectedDate, station]);

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
        title: "أكمل البيانات أولاً",
        description: "اختر الخدمة والموعد وأدخل اسمك ورقم هاتفك قبل تدوير عجلة الخصم.",
        variant: "destructive",
      });
      return;
    }

    if (spinResult && !needsRespin) return;

    setSpinning(true);
    setSpinHint("جاري تدوير عجلة الخصم الآن...");

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
      setSpinning(false);
      setSpinHint("تعذر تدوير العجلة الآن. حاول مرة أخرى بعد قليل.");
      toast({
        title: "فشل تدوير العجلة",
        description: data?.error || error?.message || "حاول مرة أخرى بعد قليل.",
        variant: "destructive",
      });
      return;
    }

    const selectedArc = SPIN_SEGMENT_ARCS.find((segment) => segment.key === data.segmentKey) || SPIN_SEGMENT_ARCS[0];
    const nextRotation = calculateSpinRotation(spinRotation, selectedArc.midAngle);
    setSpinRotation(nextRotation);

    window.setTimeout(() => {
      setSpinning(false);

      if (data.requiresRespin) {
        setSpinResult(null);
        setNeedsRespin(true);
        setSpinHint("ظهرت لك محاولة إضافية. اضغط مرة أخرى لتدوير العجلة لنفس الحجز.");
        return;
      }

      const resolvedResult = {
        segmentKey: data.segmentKey!,
        discountPercent: data.discountPercent || 0,
        label: data.label || `${data.discountPercent || 0}%`,
        token: data.token || "",
      };

      setSpinResult(resolvedResult);
      setNeedsRespin(false);
      setSpinHint(`تم تثبيت الخصم لهذا الحجز: (${resolvedResult.discountPercent})%`);
    }, 3800);
  };

  const handleCreateBooking = async () => {
    if (!selectedService) return;

    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: "أكمل البيانات أولاً",
        description: "يرجى إدخال الاسم ورقم الهاتف قبل تأكيد الحجز.",
        variant: "destructive",
      });
      return;
    }

    if (isSlotsFlow && !selectedSlot) {
      toast({
        title: "اختر الموعد",
        description: "يرجى اختيار وقت مناسب من الأوقات المتاحة.",
        variant: "destructive",
      });
      return;
    }

    if (!spinResult?.token) {
      toast({
        title: "لف عجلة الخصم أولاً",
        description: "يجب تثبيت نتيجة العجلة قبل إرسال طلب الحجز للمحطة.",
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
        booking_date: bookingDate,
        booking_time: isSlotsFlow ? selectedSlot : null,
        spin_discount_percent: spinResult.discountPercent,
        spin_token: spinResult.token,
      },
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: "فشل إنشاء الحجز",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data?.error) {
      toast({
        title: "تعذر إكمال الحجز",
        description: data.error,
        variant: "destructive",
      });
      return;
    }

    setBookingResult({
      bookingId: data.bookingId,
      bookingNumber: data.bookingNumber,
      discountPercent: spinResult.discountPercent,
    });

    toast({
      title: "تم إرسال طلب الحجز",
      description: `رقم الحجز #${data.bookingNumber} والخصم (${spinResult.discountPercent})%`,
    });
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
        title: "تعذر إلغاء الحجز",
        description: data?.error || error?.message || "حاول مرة أخرى بعد قليل.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "تم إلغاء الحجز",
      description: `أرسلنا إشعار الإلغاء عبر واتساب للحجز #${bookingResult.bookingNumber}.`,
    });

    resetSelectionAndClose();
  };

  return (
    <div className="absolute left-0 top-0 z-[1000] h-full w-full bg-background shadow-2xl sm:w-[440px]" dir="rtl">
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <Badge variant={open ? "default" : "destructive"}>
              {open ? "المحطة مفتوحة الآن" : "المحطة مغلقة الآن"}
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
            <Badge variant="secondary">{schedulingLabels[station.scheduling_type]}</Badge>
          </div>

          {station.latitude && station.longitude && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2" onClick={openGoogleMaps}>
                <Navigation className="h-4 w-4" />
                Google Maps
              </Button>
              <Button variant="outline" className="gap-2" onClick={openWaze}>
                <Navigation className="h-4 w-4" />
                Waze
              </Button>
            </div>
          )}

          <Card>
            <CardContent className="space-y-4 pt-4">
              <StepHeader
                number="1"
                title="اختر الخدمة"
                description="ابدأ بتحديد الخدمة المناسبة. بعدها سنحسب الخصم والسعر النهائي بوضوح."
              />

              {loadingServices ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري تحميل الخدمات...
                </div>
              ) : services.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد خدمات متاحة لهذه المحطة حالياً.</p>
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
                          isSelected
                            ? "border-sky-500 bg-sky-50"
                            : "border-border bg-card hover:border-sky-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{service.duration_minutes} دقيقة</p>
                          </div>
                          <Badge variant={isSelected ? "default" : "secondary"}>{formatCurrency(service.price)}</Badge>
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
                  title={isSlotsFlow ? "اختر اليوم والوقت" : "اختر اليوم"}
                  description="اختر اليوم المناسب، وإذا كانت المحطة تعمل بالمواعيد ستظهر لك الأوقات المتاحة فقط."
                />

                <Input
                  type="date"
                  min={getTodayDate()}
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedSlot(null);
                    setBookingResult(null);
                  }}
                />

                {isSlotsFlow && (
                  <>
                    {loadingSlots ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري تحميل الأوقات المتاحة...
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">لا توجد أوقات متاحة في هذا اليوم. اختر يوماً آخر.</p>
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

          <Card>
            <CardContent className="space-y-4 pt-4">
              <StepHeader
                number="3"
                title="بيانات الحجز"
                description="أدخل اسمك ورقم واتساب الصحيح. هذا الرقم سيصلك عليه تأكيد أو إلغاء الحجز."
              />

              <Input placeholder="الاسم" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              <Input
                dir="ltr"
                placeholder="رقم الهاتف"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
              />

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                <div className="flex items-start gap-2 font-medium">
                  <ShieldCheck className="mt-0.5 h-4 w-4" />
                  <span>تنبيه مهم</span>
                </div>
                <p className="mt-2">
                  يمكنك الاحتفاظ بحجزين نشطين فقط على نفس الرقم. إذا أردت إنشاء حجز جديد بعد ذلك، يجب أولاً إلغاء أحد الحجوزات القديمة.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 bg-[#070b13] text-white shadow-2xl">
            <CardContent className="space-y-5 pt-5">
              <StepHeader
                number="4"
                title="عجلة الخصم"
                description="لف العجلة الآن لتثبيت الخصم لهذا الحجز. إذا ظهرت لك محاولة إضافية فمعناها يمكنك الدوران مرة أخرى لنفس الطلب."
              />

              <div className="rounded-[30px] border border-white/10 bg-[#0d1526] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="relative mx-auto h-[290px] w-[290px] max-w-full">
                  {WHEEL_LIGHTS.map((lightIndex) => {
                    const angle = (360 / WHEEL_LIGHTS.length) * lightIndex;
                    return (
                      <div
                        key={lightIndex}
                        className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300 shadow-[0_0_14px_rgba(253,224,71,0.95)]"
                        style={{
                          transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-146px)`,
                        }}
                      />
                    );
                  })}

                  <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2">
                    <div className="h-0 w-0 border-l-[18px] border-r-[18px] border-b-[34px] border-l-transparent border-r-transparent border-b-yellow-400 drop-shadow-[0_6px_12px_rgba(250,204,21,0.45)]" />
                  </div>

                  <div className="absolute inset-0 rounded-full border-[14px] border-white/10 bg-white/5 shadow-[0_0_0_2px_rgba(255,255,255,0.06),0_18px_55px_rgba(0,0,0,0.5)]" />

                  <div
                    className="absolute inset-[16px] rounded-full border-[6px] border-white/20 shadow-[inset_0_2px_16px_rgba(255,255,255,0.08)]"
                    style={{
                      background: WHEEL_BACKGROUND,
                      transform: `rotate(${spinRotation}deg)`,
                      transition: spinning ? "transform 3.8s cubic-bezier(0.18, 0.92, 0.24, 1)" : undefined,
                    }}
                  >
                    {SPIN_SEGMENT_ARCS.map((segment) => {
                      const radius = segment.size <= 24 ? -78 : segment.key === "retry" ? -88 : -98;
                      const labelSize = segment.size <= 24 ? "text-[18px]" : segment.key === "retry" ? "text-[22px]" : "text-[28px]";
                      const subtitleSize = segment.size <= 24 ? "text-[10px]" : "text-sm";

                      return (
                        <div
                          key={segment.key}
                          className="absolute left-1/2 top-1/2 w-24 -translate-x-1/2 -translate-y-1/2 text-center"
                          style={{
                            transform: `translate(-50%, -50%) rotate(${segment.midAngle}deg) translateY(${radius}px) rotate(-${segment.midAngle}deg)`,
                            color: segment.textColor,
                          }}
                        >
                          <div className={`${labelSize} font-black leading-none`}>{segment.label}</div>
                          <div className={`mt-1 ${subtitleSize} font-semibold leading-4`}>{segment.subtitle}</div>
                        </div>
                      );
                    })}

                    <div className="absolute inset-[33%] flex flex-col items-center justify-center rounded-full border-4 border-white/15 bg-[#09111e] text-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.06),0_12px_30px_rgba(0,0,0,0.45)]">
                      <div className="text-[10px] font-bold tracking-[0.3em] text-yellow-300">WASHLLY</div>
                      <div className="mt-2 text-xs text-slate-300">خصم الحجز الحالي</div>
                      <div className="mt-2 text-2xl font-black text-white">
                        {spinResult ? `${spinResult.discountPercent}%` : needsRespin ? "↻" : "؟"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-sm text-slate-200">
                  {spinHint}
                </div>

                {selectedService && spinResult && (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                      <div className="text-slate-300">السعر</div>
                      <div className="font-bold text-white">{formatCurrency(selectedService.price)}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-2">
                      <div className="text-emerald-200">الخصم</div>
                      <div className="font-bold text-emerald-100">{formatCurrency(discountAmount)}</div>
                    </div>
                    <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-2">
                      <div className="text-sky-200">بعد الخصم</div>
                      <div className="font-bold text-white">{formatCurrency(finalPrice)}</div>
                    </div>
                  </div>
                )}

                <Button
                  className="mt-5 h-12 w-full gap-2 bg-gradient-to-l from-yellow-400 via-amber-400 to-yellow-300 text-slate-950 hover:from-yellow-300 hover:to-amber-300"
                  disabled={spinning || !!spinResult || !canSpin}
                  onClick={handleSpin}
                >
                  {spinning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      تدور العجلة الآن...
                    </>
                  ) : needsRespin ? (
                    <>
                      <RotateCw className="h-4 w-4" />
                      حاول مرة أخرى
                    </>
                  ) : spinResult ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      تم تثبيت الخصم
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4" />
                      اضغط للف العجلة
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-4">
              <StepHeader
                number="5"
                title="الخطوة الأخيرة"
                description="راجع التفاصيل ثم اختر إما تأكيد الحجز ليصل للمحطة عبر واتساب، أو إلغاء الحجز للعودة إلى الخريطة بدون حفظ الاختيارات."
              />

              <div className="rounded-2xl border bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                <p>بعد تأكيد الحجز سيصل طلبك إلى صاحب المحطة عبر واتساب مع الخصم الذي حصلت عليه.</p>
                <p className="mt-1">إذا ألغيت الحجز بعد إنشائه سنرسل إشعار إلغاء عبر واتساب لك ولصاحب المحطة.</p>
              </div>

              {!bookingResult ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full" disabled={!canSubmit || submitting} onClick={handleCreateBooking}>
                    {submitting ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري تأكيد الحجز...
                      </>
                    ) : (
                      "تأكيد الحجز"
                    )}
                  </Button>

                  <Button variant="outline" className="w-full" disabled={submitting} onClick={handleCancelBooking}>
                    إلغاء الحجز
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      تم إرسال طلب الحجز بنجاح
                    </div>
                    <p className="mt-2">رقم الحجز: #{bookingResult.bookingNumber}</p>
                    <p className="mt-1">الخصم المثبت: ({bookingResult.discountPercent})%</p>
                    <p className="mt-1">الطلب الآن بانتظار موافقة المحطة. إذا رغبت بإلغائه يمكنك فعل ذلك من هنا مباشرة.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="w-full" onClick={resetSelectionAndClose}>
                      العودة إلى الخريطة
                    </Button>

                    <Button variant="destructive" className="w-full" disabled={cancelling} onClick={handleCancelBooking}>
                      {cancelling ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          جاري الإلغاء...
                        </>
                      ) : (
                        "إلغاء الحجز"
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

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
  });

  useEffect(() => {
    const loadStations = async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("*")
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (error) {
        toast({
          title: "تعذر تحميل المحطات",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setStations(data as Station[]);
    };

    void loadStations();
  }, []);

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
        title: "المتصفح لا يدعم الموقع",
        description: "تعذر الوصول إلى موقعك الحالي من هذا المتصفح.",
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
          title: "تعذر تحديد الموقع",
          description: "اسمح بالوصول إلى الموقع لعرض أقرب المحطات إليك.",
          variant: "destructive",
        });
      },
    );
  };

  return (
    <div className="relative h-[100vh] w-full" dir="rtl">
      <div className="absolute left-4 right-4 top-4 z-[900] mx-auto max-w-xl">
        <Card className="border-0 bg-background/95 shadow-xl backdrop-blur">
          <CardContent className="space-y-3 p-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث عن محطة أو منطقة"
                className="pr-9"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={handleLocateMe}>
                <LocateFixed className="h-4 w-4" />
                موقعي
              </Button>

              {filteredStations.slice(0, 5).map((station) => (
                <Button
                  key={station.id}
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleMarkerClick(station)}
                >
                  {station.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
          {filteredStations.map((station) => (
            <Marker
              key={station.id}
              position={{ lat: station.latitude!, lng: station.longitude! }}
              onClick={() => handleMarkerClick(station)}
            />
          ))}
        </GoogleMap>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري تحميل الخريطة...
          </div>
        </div>
      )}

      {selectedStation && (
        <StationCard station={selectedStation} onClose={() => setSelectedStation(null)} />
      )}
    </div>
  );
};

export default StationsMap;
