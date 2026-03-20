import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// Component to fly to a station
const FlyToStation = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 1 });
  }, [lat, lng, map]);
  return null;
};

// Station detail card
const StationCard = ({ station, onClose }: { station: Station; onClose: () => void }) => {
  const [services, setServices] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const open = isStationOpen(station);

  useEffect(() => {
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
        const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);
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

  const schedulingLabels: Record<string, string> = { slots: "فترات ثابتة", instant: "حجز فوري", daily: "حجز يومي" };

  const openGoogleMaps = () => {
    if (station.latitude && station.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`, "_blank");
    }
  };

  const openWaze = () => {
    if (station.latitude && station.longitude) {
      window.open(`https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`, "_blank");
    }
  };

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
                <MapPin className="h-3.5 w-3.5 shrink-0" />{station.address}
              </p>
            )}
            {station.detailed_address && (
              <p className="text-xs text-muted-foreground mt-0.5 mr-5">{station.detailed_address}</p>
            )}
          </div>

          {/* Working Hours & Type */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {station.working_hours_start.substring(0, 5)} - {station.working_hours_end.substring(0, 5)}
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

          {/* Services */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3">
                <Wrench className="h-4 w-4 text-primary" />الخدمات
              </h3>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد خدمات</p>
              ) : (
                <div className="space-y-2">
                  {services.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-sm text-foreground">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{s.duration_minutes} دقيقة</span>
                        <Badge variant="secondary" className="text-xs font-bold">{s.price} د.ع</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Slots */}
          {station.scheduling_type === "slots" && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3">
                  <CalendarCheck className="h-4 w-4 text-primary" />المواعيد المتاحة اليوم
                </h3>
                {loadingSlots ? (
                  <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد مواعيد متاحة اليوم</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableSlots.map((slot) => (
                      <Badge key={slot} variant="outline" className="px-3 py-1.5 text-sm font-mono">
                        {slot}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {station.scheduling_type === "instant" && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3">
                  <CalendarCheck className="h-4 w-4 text-primary" />الحجز
                </h3>
                <p className="text-sm text-muted-foreground">هذه المحطة تقبل الحجز الفوري — أرسل رسالة عبر واتساب للحجز الآن</p>
              </CardContent>
            </Card>
          )}

          {station.scheduling_type === "daily" && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3">
                  <CalendarCheck className="h-4 w-4 text-primary" />الحجز
                </h3>
                <p className="text-sm text-muted-foreground">هذه المحطة تقبل الحجز اليومي — أرسل رسالة عبر واتساب لاختيار اليوم</p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// Main Map Page
const StationsMap = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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
    if (station.latitude && station.longitude) {
      setFlyTo({ lat: station.latitude, lng: station.longitude });
    }
  };

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
    <div className="h-screen w-full relative" dir="rtl">
      {/* Back button */}
      <div className="absolute top-4 right-4 z-[1000]">
        <Button
          variant="secondary"
          className="shadow-lg gap-1"
          onClick={() => window.history.back()}
        >
          <ChevronLeft className="h-4 w-4" />
          رجوع
        </Button>
      </div>

      {/* Station count badge */}
      <div className="absolute top-4 left-4 z-[1000]">
        <Badge variant="secondary" className="shadow-lg text-sm px-3 py-1.5">
          <MapPin className="h-3.5 w-3.5 ml-1" />
          {stations.length} محطة متاحة
        </Badge>
      </div>

      {/* Map */}
      <MapContainer
        center={defaultCenter}
        zoom={6}
        className="h-full w-full"
        zoomControl={false}
        bounds={bounds || undefined}
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
      </MapContainer>

      {/* Station Detail Card */}
      {selectedStation && (
        <StationCard station={selectedStation} onClose={() => setSelectedStation(null)} />
      )}
    </div>
  );
};

export default StationsMap;
