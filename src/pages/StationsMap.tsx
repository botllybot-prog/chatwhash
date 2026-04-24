import { useState, useEffect, useCallback, useMemo, useRef } from "react";
<<<<<<< HEAD
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
=======
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
<<<<<<< HEAD
import { MapPin, Clock, Navigation, Wrench, CalendarCheck, X, ChevronLeft, Search } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const stationIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
=======
import { MapPin, Clock, Navigation, Wrench, CalendarCheck, X, ChevronLeft, Search, LocateFixed } from "lucide-react";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const WHATSAPP_NUMBER = "9647503132369";
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b

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
  scheduling_type: string;
  slot_duration_minutes: number;
  is_active: boolean;
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

<<<<<<< HEAD
// Component to fly to a station
const FlyToStation = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 1 });
  }, [lat, lng, map]);
  return null;
};

// Fit map to station bounds without over-zooming
const FitBounds = ({ bounds }: { bounds: L.LatLngBounds }) => {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { maxZoom: 13, padding: [40, 40] });
  }, [bounds, map]);
  return null;
};

=======
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
// Station detail card
const StationCard = ({ station, onClose }: { station: Station; onClose: () => void }) => {
  const [services, setServices] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
<<<<<<< HEAD
  const open = isStationOpen(station);

  useEffect(() => {
=======
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const open = isStationOpen(station);

  useEffect(() => {
    setSelectedService(null);
    setSelectedSlot(null);

>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
    const load = async () => {
      const { data: svc } = await supabase
        .from("services")
        .select("*")
        .or(`station_id.eq.${station.id},station_id.is.null`)
        .eq("is_active", true)
        .order("sort_order");
      if (svc) setServices(svc);

      if (station.scheduling_type === "slots") {
        const today = new Date().toISOString().split("T")[0];
<<<<<<< HEAD
        const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);
=======
        const allSlots = generateTimeSlots(
          station.working_hours_start,
          station.working_hours_end,
          station.slot_duration_minutes
        );
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
        const { data: booked } = await supabase
          .from("bookings")
          .select("booking_time")
          .eq("station_id", station.id)
          .eq("booking_date", today)
          .in("status", ["pending", "confirmed"] as any);
        const bookedSet = new Set((booked || []).map((b: any) => b.booking_time?.substring(0, 5)));
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        setAvailableSlots(
          allSlots.filter((s) => {
            const [h, m] = s.split(":").map(Number);
            return h * 60 + m > nowMin && !bookedSet.has(s);
          })
        );
      }
      setLoadingSlots(false);
    };
    load();
  }, [station]);

<<<<<<< HEAD
  const schedulingLabels: Record<string, string> = { slots: "فترات ثابتة", instant: "حجز فوري", daily: "حجز يومي" };

  const openGoogleMaps = () => {
    if (station.latitude && station.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`, "_blank");
=======
  const schedulingLabels: Record<string, string> = {
    slots: "فترات ثابتة",
    instant: "حجز فوري",
    daily: "حجز يومي",
  };

  const openGoogleMaps = () => {
    if (station.latitude && station.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`,
        "_blank"
      );
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
    }
  };

  const openWaze = () => {
    if (station.latitude && station.longitude) {
<<<<<<< HEAD
      window.open(`https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`, "_blank");
    }
  };

=======
      window.open(
        `https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`,
        "_blank"
      );
    }
  };

  const handleBookWhatsApp = () => {
    const today = new Date().toLocaleDateString("ar-IQ", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let message = `مرحباً 👋\nأريد حجز موعد في محطة: *${station.name}*\n`;
    if (station.address) message += `📍 العنوان: ${station.address}\n`;
    if (selectedService) message += `🔧 الخدمة: *${selectedService.name}* — ${selectedService.price} د.ع\n`;
    if (selectedSlot) message += `🕐 الوقت: *${selectedSlot}*\n`;
    if (station.scheduling_type === "instant") message += `⚡ نوع الحجز: فوري\n`;
    if (station.scheduling_type === "daily") message += `📅 التاريخ: ${today}\n`;
    message += `\nشكراً 🙏`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const canBook =
    station.scheduling_type === "instant" ||
    station.scheduling_type === "daily" ||
    (station.scheduling_type === "slots" && selectedService && selectedSlot);

>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
  return (
    <div className="absolute top-0 left-0 w-full sm:w-[400px] h-full z-[1000] bg-background border-l border-border shadow-xl animate-in slide-in-from-left-full duration-300">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
            <Badge variant={open ? "default" : "destructive"} className="text-xs">
              {open ? "مفتوحة الآن" : "مغلقة"}
            </Badge>
          </div>

          {/* Image */}
          {station.image_url && (
            <div className="rounded-xl overflow-hidden border border-border">
              <img src={station.image_url} alt={station.name} className="w-full h-48 object-cover" />
            </div>
          )}

          {/* Name & Address */}
          <div>
            <h2 className="text-xl font-bold text-foreground">{station.name}</h2>
            {station.address && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
<<<<<<< HEAD
                <MapPin className="h-3.5 w-3.5 shrink-0" />{station.address}
              </p>
            )}
            {station.detailed_address && (
              <p className="text-xs text-muted-foreground mt-0.5 mr-5">{station.detailed_address}</p>
=======
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {station.address}
              </p>
            )}
            {station.detailed_address && (
              <p className="text-xs text-muted-foreground mt-0.5 mr-5">
                {station.detailed_address}
              </p>
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
            )}
          </div>

          {/* Working Hours & Type */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
<<<<<<< HEAD
              {station.working_hours_start.substring(0, 5)} - {station.working_hours_end.substring(0, 5)}
=======
              {station.working_hours_start.substring(0, 5)} -{" "}
              {station.working_hours_end.substring(0, 5)}
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
            </Badge>
            <Badge variant="secondary">{schedulingLabels[station.scheduling_type]}</Badge>
          </div>

          {/* Navigation Buttons */}
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

<<<<<<< HEAD
          {/* Services */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3">
                <Wrench className="h-4 w-4 text-primary" />الخدمات
=======
          {/* Services (clickable) */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3">
                <Wrench className="h-4 w-4 text-primary" />
                الخدمات
                {selectedService && (
                  <span className="text-xs text-muted-foreground mr-auto">
                    اضغط مرة أخرى لإلغاء الاختيار
                  </span>
                )}
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
              </h3>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد خدمات</p>
              ) : (
                <div className="space-y-2">
<<<<<<< HEAD
                  {services.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-sm text-foreground">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{s.duration_minutes} دقيقة</span>
                        <Badge variant="secondary" className="text-xs font-bold">{s.price} د.ع</Badge>
                      </div>
                    </div>
                  ))}
=======
                  {services.map((s) => {
                    const isSelected = selectedService?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedService(isSelected ? null : s)}
                        className={`w-full flex items-center justify-between py-2.5 px-3 rounded-lg border transition-all text-right
                          ${isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border hover:border-primary/50 hover:bg-accent"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                              ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {s.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{s.duration_minutes} دقيقة</span>
                          <Badge variant={isSelected ? "default" : "secondary"} className="text-xs font-bold">
                            {s.price} د.ع
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
                </div>
              )}
            </CardContent>
          </Card>

<<<<<<< HEAD
          {/* Available Slots */}
=======
          {/* Time Slots (clickable) */}
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
          {station.scheduling_type === "slots" && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3">
<<<<<<< HEAD
                  <CalendarCheck className="h-4 w-4 text-primary" />المواعيد المتاحة اليوم
=======
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  المواعيد المتاحة اليوم
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
                </h3>
                {loadingSlots ? (
                  <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد مواعيد متاحة اليوم</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
<<<<<<< HEAD
                    {availableSlots.map((slot) => (
                      <Badge key={slot} variant="outline" className="px-3 py-1.5 text-sm font-mono">
                        {slot}
                      </Badge>
                    ))}
=======
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(isSelected ? null : slot)}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-mono transition-all
                            ${isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm scale-105"
                              : "border-border hover:border-primary/50 hover:bg-accent text-foreground"
                            }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {station.scheduling_type === "instant" && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3">
<<<<<<< HEAD
                  <CalendarCheck className="h-4 w-4 text-primary" />الحجز
                </h3>
                <p className="text-sm text-muted-foreground">هذه المحطة تقبل الحجز الفوري — أرسل رسالة عبر واتساب للحجز الآن</p>
=======
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  الحجز
                </h3>
                <p className="text-sm text-muted-foreground">
                  هذه المحطة تقبل الحجز الفوري — اختر الخدمة واضغط احجز الآن
                </p>
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
              </CardContent>
            </Card>
          )}

          {station.scheduling_type === "daily" && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3">
<<<<<<< HEAD
                  <CalendarCheck className="h-4 w-4 text-primary" />الحجز
                </h3>
                <p className="text-sm text-muted-foreground">هذه المحطة تقبل الحجز اليومي — أرسل رسالة عبر واتساب لاختيار اليوم</p>
              </CardContent>
            </Card>
          )}
=======
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  الحجز
                </h3>
                <p className="text-sm text-muted-foreground">
                  هذه المحطة تقبل الحجز اليومي — اختر الخدمة واضغط احجز الآن
                </p>
              </CardContent>
            </Card>
          )}

          {/* Book Now Button */}
          <div className="pb-4">
            {station.scheduling_type === "slots" && (!selectedService || !selectedSlot) && (
              <p className="text-xs text-center text-muted-foreground mb-2">
                {!selectedService && !selectedSlot
                  ? "اختر خدمة ووقتاً للحجز"
                  : !selectedService
                  ? "اختر خدمة للمتابعة"
                  : "اختر وقتاً للمتابعة"}
              </p>
            )}
            <Button
              className="w-full gap-2 text-base py-5"
              disabled={!canBook || !open}
              onClick={handleBookWhatsApp}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {!open ? "المحطة مغلقة الآن" : "احجز الآن عبر واتساب"}
            </Button>
          </div>
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
        </div>
      </ScrollArea>
    </div>
  );
};

// Main Map Page
const StationsMap = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
<<<<<<< HEAD
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

=======
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY });

>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("stations")
        .select("*")
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (data) setStations(data as Station[]);
    };
    load();
  }, []);

  const handleMarkerClick = (station: Station) => {
    setSelectedStation(station);
<<<<<<< HEAD
    if (station.latitude && station.longitude) {
      setFlyTo({ lat: station.latitude, lng: station.longitude });
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return stations.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      (s.detailed_address && s.detailed_address.toLowerCase().includes(q))
    ).slice(0, 5);
=======
    setActiveMarker(station.id);
    if (station.latitude && station.longitude && map) {
      map.panTo({ lat: station.latitude, lng: station.longitude });
      map.setZoom(15);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc = { lat: coords.latitude, lng: coords.longitude };
        setUserLocation(loc);
        if (map) {
          map.panTo(loc);
          map.setZoom(14);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return stations
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.address && s.address.toLowerCase().includes(q)) ||
          (s.detailed_address && s.detailed_address.toLowerCase().includes(q))
      )
      .slice(0, 5);
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
  }, [searchQuery, stations]);

  const handleSearchSelect = (station: Station) => {
    setSearchQuery("");
    setSearchOpen(false);
    handleMarkerClick(station);
  };

<<<<<<< HEAD
  // Close search dropdown on outside click
=======
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

<<<<<<< HEAD
  // Center on Iraq by default
  const defaultCenter: [number, number] = [33.3, 44.4];

  // Compute bounds if stations exist
  const bounds = useMemo(() => {
    if (stations.length === 0) return null;
    const lats = stations.map((s) => s.latitude!);
    const lngs = stations.map((s) => s.longitude!);
    return L.latLngBounds(
      [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05],
      [Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05]
    );
  }, [stations]);

  return (
    <div className="h-[calc(100vh-5rem)] w-full relative" dir="rtl">
      {/* Back button */}
      <div className="absolute top-4 right-4 z-[1000]">
        <Button variant="secondary" className="shadow-lg gap-1" onClick={() => window.history.back()}>
          <ChevronLeft className="h-4 w-4" />
          رجوع
        </Button>
      </div>
=======
  const defaultCenter = { lat: 33.3152, lng: 44.3661 };

  const mapOptions: google.maps.MapOptions = {
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    zoomControlOptions: { position: 7 },
    styles: [
      { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
    ],
  };

  return (
    <div className="h-[calc(100vh-5rem)] w-full relative" dir="rtl">
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b

      {/* Search bar */}
      <div ref={searchRef} className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-sm">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ابحث عن محطة بالاسم أو العنوان..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            className="pr-9 pl-9 bg-background shadow-lg border-border"
          />
          {searchQuery && (
<<<<<<< HEAD
            <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
=======
            <button
              onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {searchOpen && searchQuery.trim() && (
          <Card className="mt-1 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد نتائج</p>
              ) : (
                searchResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSearchSelect(s)}
                    className="w-full text-right px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0 flex items-start gap-2"
                  >
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      {s.address && <p className="text-xs text-muted-foreground">{s.address}</p>}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Station count badge */}
<<<<<<< HEAD
      <div className="absolute top-4 left-4 z-[1000]">
=======
      <div className="absolute top-4 right-4 z-[1000]">
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
        <Badge variant="secondary" className="shadow-lg text-sm px-3 py-1.5">
          <MapPin className="h-3.5 w-3.5 ml-1" />
          {stations.length} محطة متاحة
        </Badge>
      </div>

<<<<<<< HEAD
      {/* Map */}
      <MapContainer
        center={defaultCenter}
        zoom={6}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {stations.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude!, station.longitude!]}
            icon={stationIcon}
            eventHandlers={{ click: () => handleMarkerClick(station) }}
          >
            <Popup>
              <div className="text-center p-1" dir="rtl">
                <p className="font-bold text-sm">{station.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isStationOpen(station) ? "🟢 مفتوحة" : "🔴 مغلقة"}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {flyTo && <FlyToStation lat={flyTo.lat} lng={flyTo.lng} />}
        {bounds && !flyTo && <FitBounds bounds={bounds} />}
      </MapContainer>

      {/* Station Detail Card */}
      {selectedStation && (
        <StationCard station={selectedStation} onClose={() => setSelectedStation(null)} />
=======
      {/* Locate Me Button */}
      <div className="absolute bottom-6 left-4 z-[1000]">
        <Button
          variant="secondary"
          size="sm"
          className="shadow-lg gap-1.5"
          onClick={handleLocateMe}
          disabled={locating}
        >
          <LocateFixed className="h-4 w-4" />
          {locating ? "جاري التحديد..." : "موقعي"}
        </Button>
      </div>

      {/* Google Map */}
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ height: "100%", width: "100%" }}
          center={defaultCenter}
          zoom={7}
          options={mapOptions}
          onLoad={(m) => {
            setMap(m);
            if (stations.length > 0) {
              const bounds = new window.google.maps.LatLngBounds();
              stations.forEach((s) => {
                if (s.latitude && s.longitude)
                  bounds.extend({ lat: s.latitude, lng: s.longitude });
              });
              m.fitBounds(bounds, 60);
            }
          }}
          onClick={() => setActiveMarker(null)}
        >
          {/* Station markers */}
          {stations.map((station) => (
            <Marker
              key={station.id}
              position={{ lat: station.latitude!, lng: station.longitude! }}
              onClick={() => handleMarkerClick(station)}
              icon={{
                url: isStationOpen(station)
                  ? "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                  : "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                scaledSize: new window.google.maps.Size(40, 40),
              }}
            >
              {activeMarker === station.id && (
                <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                  <div className="text-center p-1 min-w-[120px]" dir="rtl">
                    <p className="font-bold text-sm text-gray-800">{station.name}</p>
                    <p className="text-xs mt-0.5">
                      {isStationOpen(station) ? "🟢 مفتوحة" : "🔴 مغلقة"}
                    </p>
                    <button
                      onClick={() => setSelectedStation(station)}
                      className="mt-2 text-xs text-blue-600 underline"
                    >
                      عرض التفاصيل والحجز
                    </button>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          ))}

          {/* User location marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                scaledSize: new window.google.maps.Size(40, 40),
              }}
              title="موقعك الحالي"
            />
          )}
        </GoogleMap>
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-muted">
          <p className="text-muted-foreground">جاري تحميل الخريطة...</p>
        </div>
      )}

      {/* Station Detail Card */}
      {selectedStation && (
        <StationCard
          station={selectedStation}
          onClose={() => {
            setSelectedStation(null);
            setActiveMarker(null);
          }}
        />
>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
      )}
    </div>
  );
};

export default StationsMap;
<<<<<<< HEAD
=======

>>>>>>> 8518bccf0be21e2eca783edcfec9608edf9af65b
