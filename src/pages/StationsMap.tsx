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
  MapPin,
  Clock,
  Navigation,
  Wrench,
  CalendarCheck,
  X,
  Search,
  LocateFixed,
  Car,
  Loader2,
  CheckCircle2,
} from "lucide-react";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const DEFAULT_CENTER = { lat: 33.3152, lng: 44.3661 };

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

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  const open = isStationOpen(station);
  const isSlotsFlow = station.scheduling_type === "slots";
  const isDailyFlow = station.scheduling_type === "daily";

  const schedulingLabels: Record<Station["scheduling_type"], string> = {
    slots: "حجز بموعد",
    instant: "حجز فوري",
    daily: "حجز يومي",
  };

  useEffect(() => {
    setSelectedService(null);
    setSelectedSlot(null);
    setSelectedDate(getTodayDate());
    setBookingResult(null);
    setLoadingServices(true);

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
        station.slot_duration_minutes
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
        (data || []).map((booking) => booking.booking_time?.substring(0, 5)).filter(Boolean)
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

  const canSubmit =
    !!selectedService &&
    !!customerName.trim() &&
    !!customerPhone.trim() &&
    (!isDailyFlow || !!selectedDate) &&
    (!isSlotsFlow || (!!selectedDate && !!selectedSlot));

  const openGoogleMaps = () => {
    if (station.latitude && station.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`,
        "_blank"
      );
    }
  };

  const openWaze = () => {
    if (station.latitude && station.longitude) {
      window.open(
        `https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`,
        "_blank"
      );
    }
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

    setSubmitting(true);

    const payload = {
      station_id: station.id,
      service_id: selectedService.id,
      customer_name: customerName.trim(),
      customer_phone: normalizePhone(customerPhone),
      booking_date: isDailyFlow || isSlotsFlow ? selectedDate : getTodayDate(),
      booking_time: isSlotsFlow ? selectedSlot : null,
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
                        لا توجد أوقات متاحة في هذا اليوم. اختر يوماً آخر.
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

              <Button
                className="w-full"
                disabled={!canSubmit || submitting || loadingServices}
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

              {bookingResult && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    تم إرسال طلب الحجز بنجاح
                  </div>
                  <p className="mt-2">رقم الحجز: #{bookingResult.bookingNumber}</p>
                  <p className="mt-1 text-emerald-700">
                    تم إرسال الطلب إلى صاحب المحطة عبر واتساب. سيصل للعميل إشعار القبول أو الرفض على نفس الرقم المدخل.
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
        station.longitude - userLocation.lng
      );

      return { ...station, distance };
    });

    const onlyMatching = query
      ? mappedStations.filter(
          (station) =>
            station.name.toLowerCase().includes(query) ||
            station.address?.toLowerCase().includes(query) ||
            station.detailed_address?.toLowerCase().includes(query)
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
      }
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
