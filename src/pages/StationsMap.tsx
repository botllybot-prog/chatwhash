import { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import {
  CalendarCheck,
  Car,
  CheckCircle2,
  Clock,
  Gift,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCw,
  Search,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const DEFAULT_CENTER = { lat: 33.3152, lng: 44.3661 };
const SEGMENT_ANGLE = 72;

const SPIN_SEGMENTS = [
  { key: "discount_5", label: "5%", color: "#0ea5e9", discountPercent: 5 },
  { key: "discount_10", label: "10%", color: "#0284c7", discountPercent: 10 },
  { key: "discount_15", label: "15%", color: "#0369a1", discountPercent: 15 },
  { key: "retry", label: "أعد", color: "#f59e0b", discountPercent: 0 },
  { key: "discount_0", label: "0%", color: "#94a3b8", discountPercent: 0 },
] as const;

const WHEEL_BACKGROUND = `conic-gradient(from -126deg, ${SPIN_SEGMENTS.map((segment, index) => {
  const start = index * SEGMENT_ANGLE;
  const end = start + SEGMENT_ANGLE;
  return `${segment.color} ${start}deg ${end}deg`;
}).join(", ")})`;

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

function isStationOpen(station: Station): boolean {
  const now = new Date();
  const [sh, sm] = station.working_hours_start.split(":").map(Number);
  const [eh, em] = station.working_hours_end.split(":").map(Number);
  const currentMin = now.getHours() * 60 + now.getMinutes();
  return currentMin >= sh * 60 + sm && currentMin < eh * 60 + em;
}

function generateTimeSlots(start: string, end: string, duration: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;

  while (current + duration <= endMin) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
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

function calculateSpinRotation(currentRotation: number, segmentIndex: number) {
  const currentNormalized = ((currentRotation % 360) + 360) % 360;
  const targetNormalized = ((360 - segmentIndex * SEGMENT_ANGLE) % 360 + 360) % 360;
  let delta = targetNormalized - currentNormalized;

  if (delta <= 0) delta += 360;

  return currentRotation + 360 * 5 + delta;
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
  const [spinHint, setSpinHint] = useState("لف العجلة مرة واحدة لكل حجز قبل تأكيد الطلب.");
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

  const canSubmit = canSpin && !!spinResult && !spinning && !loadingServices;

  const discountAmount = selectedService && spinResult
    ? (selectedService.price * spinResult.discountPercent) / 100
    : 0;
  const finalPrice = selectedService ? selectedService.price - discountAmount : 0;

  const resetSpinState = () => {
    setSpinResult(null);
    setNeedsRespin(false);
    setSpinHint("لف العجلة مرة واحدة لكل حجز قبل تأكيد الطلب.");
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
          title: "تعذر تحميل المواعيد",
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
      const currentMin = now.getHours() * 60 + now.getMinutes();

      const filteredSlots = allSlots.filter((slot) => {
        const [h, m] = slot.split(":").map(Number);
        const slotMin = h * 60 + m;

        if (bookedSet.has(slot)) return false;
        if (isToday && slotMin <= currentMin) return false;
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
        title: "أكمل بيانات الحجز أولاً",
        description: "اختر الخدمة والموعد وأدخل الاسم ورقم الهاتف قبل تدوير العجلة.",
        variant: "destructive",
      });
      return;
    }

    if (spinResult && !needsRespin) return;

    setSpinning(true);
    setSpinHint("جاري تدوير عجلة الخصم...");

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
      setSpinHint("تعذر تدوير العجلة الآن.");
      toast({
        title: "فشل تدوير العجلة",
        description: data?.error || error?.message || "حاول مرة أخرى بعد قليل.",
        variant: "destructive",
      });
      return;
    }

    const segmentIndex = SPIN_SEGMENTS.findIndex((segment) => segment.key === data.segmentKey);
    const nextRotation = calculateSpinRotation(spinRotation, segmentIndex >= 0 ? segmentIndex : 0);
    setSpinRotation(nextRotation);

    window.setTimeout(() => {
      setSpinning(false);

      if (data.requiresRespin) {
        setSpinResult(null);
        setNeedsRespin(true);
        setSpinHint("ظهرت لك محاولة إضافية. اضغط مرة أخرى لتدوير العجلة.");
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
      setSpinHint(`تم حفظ الخصم لهذا الحجز: (${resolvedResult.discountPercent})%`);
    }, 4000);
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
        description: "يرجى اختيار وقت مناسب من المواعيد المتاحة.",
        variant: "destructive",
      });
      return;
    }

    if (!spinResult?.token) {
      toast({
        title: "لف عجلة الخصم أولاً",
        description: "العرض يثبت مرة واحدة لكل حجز قبل إرسال الطلب.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      station_id: station.id,
      service_id: selectedService.id,
      customer_name: customerName.trim(),
      customer_phone: normalizedPhone,
      booking_date: bookingDate,
      booking_time: isSlotsFlow ? selectedSlot : null,
      spin_discount_percent: spinResult.discountPercent,
      spin_token: spinResult.token,
    };

    const { data, error } = await supabase.functions.invoke("create-map-booking", {
      body: payload,
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
      title: "تم إرسال الحجز بنجاح",
      description: `رقم الحجز #${data.bookingNumber}`,
    });

    if (isSlotsFlow) {
      setAvailableSlots((currentSlots) => currentSlots.filter((slot) => slot !== selectedSlot));
      setSelectedSlot(null);
    }
  };

  return (
    <div className="absolute top-0 left-0 h-full w-full sm:w-[430px] z-[1000] bg-background border-l shadow-2xl" dir="rtl">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <Badge variant={open ? "default" : "destructive"}>
              {open ? "مفتوحة الآن" : "مغلقة الآن"}
            </Badge>
          </div>

          {station.image_url ? (
            <div className="rounded-2xl overflow-hidden border border-border">
              <img src={station.image_url} alt={station.name} className="h-44 w-full object-cover" />
            </div>
          ) : (
            <div className="rounded-2xl bg-ocean-100 h-36 flex items-center justify-center">
              <Car className="h-12 w-12 text-ocean-300" />
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold">{station.name}</h2>
            {station.address && (
              <p className="text-sm text-muted-foreground flex items-start gap-1.5 mt-2">
                <MapPin className="h-4 w-4 mt-0.5 text-ocean-500 flex-shrink-0" />
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
              <Button variant="outline" onClick={openGoogleMaps} className="gap-2">
                <Navigation className="h-4 w-4" />
                Google Maps
              </Button>
              <Button variant="outline" onClick={openWaze} className="gap-2">
                <Navigation className="h-4 w-4" />
                Waze
              </Button>
            </div>
          )}

          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">اختر الخدمة</h3>
              </div>

              {loadingServices ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري تحميل الخدمات...
                </div>
              ) : services.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد خدمات متاحة لهذه المحطة حاليا.</p>
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
                            ? "border-ocean-500 bg-ocean-50"
                            : "border-border bg-card hover:border-ocean-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {service.duration_minutes} دقيقة
                            </p>
                          </div>
                          <Badge variant={isSelected ? "default" : "secondary"}>
                            {service.price} د.ع
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
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{isSlotsFlow ? "اختر اليوم والوقت" : "اختر اليوم"}</h3>
                </div>

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
                      <p className="text-sm text-muted-foreground">
                        لا توجد أوقات متاحة في هذا اليوم. اختر يوما آخر.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${
                              selectedSlot === slot
                                ? "border-ocean-500 bg-ocean-500 text-white"
                                : "border-border hover:border-ocean-300"
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
            <CardContent className="pt-4 space-y-3">
              <h3 className="font-semibold">بيانات الحجز</h3>
              <Input
                placeholder="الاسم"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
              <Input
                dir="ltr"
                placeholder="رقم الهاتف"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">عجلة الخصم</h3>
              </div>

              <div className="rounded-2xl border bg-slate-50/80 p-4">
                <div className="relative mx-auto h-64 w-64">
                  <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
                    <div className="h-0 w-0 border-l-[14px] border-r-[14px] border-b-[22px] border-l-transparent border-r-transparent border-b-rose-500" />
                  </div>

                  <div
                    className="relative h-full w-full rounded-full border-[10px] border-white shadow-xl"
                    style={{
                      background: WHEEL_BACKGROUND,
                      transform: `rotate(${spinRotation}deg)`,
                      transition: spinning ? "transform 4s cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
                    }}
                  >
                    {SPIN_SEGMENTS.map((segment, index) => (
                      <div
                        key={segment.key}
                        className="absolute left-1/2 top-1/2 w-16 -translate-x-1/2 -translate-y-1/2 text-center text-sm font-bold text-white"
                        style={{
                          transform: `translate(-50%, -50%) rotate(${index * SEGMENT_ANGLE}deg) translateY(-98px) rotate(-${index * SEGMENT_ANGLE}deg)`,
                        }}
                      >
                        {segment.label}
                      </div>
                    ))}

                    <div className="absolute inset-[28%] rounded-full bg-white/95 shadow-inner flex flex-col items-center justify-center text-center px-4">
                      <Sparkles className="h-5 w-5 text-ocean-500 mb-2" />
                      <div className="text-sm text-muted-foreground">العرض الحالي</div>
                      <div className="mt-1 text-2xl font-extrabold text-ocean-700">
                        {spinResult ? `${spinResult.discountPercent}%` : needsRespin ? "↻" : "؟"}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 rounded-2xl bg-white px-3 py-2 text-sm text-slate-700">
                  {spinHint}
                </p>

                {selectedService && spinResult && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-2xl bg-white p-2">
                      <div className="text-muted-foreground">السعر</div>
                      <div className="font-bold">{formatCurrency(selectedService.price)}</div>
                    </div>
                    <div className="rounded-2xl bg-white p-2">
                      <div className="text-muted-foreground">الخصم</div>
                      <div className="font-bold text-emerald-700">{formatCurrency(discountAmount)}</div>
                    </div>
                    <div className="rounded-2xl bg-white p-2">
                      <div className="text-muted-foreground">بعد الخصم</div>
                      <div className="font-bold text-ocean-700">{formatCurrency(finalPrice)}</div>
                    </div>
                  </div>
                )}

                <Button
                  variant={needsRespin ? "secondary" : "default"}
                  className="mt-4 w-full gap-2"
                  disabled={spinning || !!spinResult || !canSpin}
                  onClick={handleSpin}
                >
                  {spinning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      تدور العجلة...
                    </>
                  ) : needsRespin ? (
                    <>
                      <RotateCw className="h-4 w-4" />
                      حاول مرة أخرى
                    </>
                  ) : spinResult ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      تم حفظ الخصم
                    </>
                  ) : (
                    <>
                      <Gift className="h-4 w-4" />
                      لف عجلة الخصم
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <Button
                className="w-full"
                disabled={!canSubmit || submitting}
                onClick={handleCreateBooking}
              >
                {submitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري تأكيد الحجز...
                  </>
                ) : (
                  "تأكيد الحجز من الخريطة"
                )}
              </Button>

              {!spinResult && (
                <p className="text-xs text-muted-foreground">
                  يجب تدوير عجلة الخصم أولاً. إذا ظهرت لك "أعد" يمكنك المحاولة مرة إضافية لنفس الحجز.
                </p>
              )}

              {bookingResult && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    تم إرسال طلب الحجز بنجاح
                  </div>
                  <p className="mt-2">رقم الحجز: #{bookingResult.bookingNumber}</p>
                  <p className="mt-1">الخصم المحفوظ: ({bookingResult.discountPercent})%</p>
                  <p className="mt-1 text-emerald-700">
                    تم إرسال الطلب إلى صاحب المحطة عبر واتساب، وسيظهر له الخصم قبل الضغط على تأكيد أو رفض.
                  </p>
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

    const onlyMatching = query
      ? mappedStations.filter(
          (station) =>
            station.name.toLowerCase().includes(query) ||
            station.address?.toLowerCase().includes(query) ||
            station.detailed_address?.toLowerCase().includes(query),
        )
      : mappedStations;

    return onlyMatching.sort((a, b) => {
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
    <div className="h-[100vh] w-full relative" dir="rtl">
      <div className="absolute top-4 right-4 left-4 z-[900] mx-auto max-w-xl">
        <Card className="shadow-xl border-0 bg-background/95 backdrop-blur">
          <CardContent className="p-3 space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن محطة أو منطقة"
                className="pr-9"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Button variant="outline" size="sm" onClick={handleLocateMe} className="gap-2 shrink-0">
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
        <div className="h-full w-full flex items-center justify-center">
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
