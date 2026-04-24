import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MapPin,
  Clock,
  Navigation,
  Wrench,
  CalendarCheck,
  X,
  ChevronLeft,
  Search,
  LocateFixed
} from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const stationIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const WHATSAPP_NUMBER = "9647503132369";

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

// Station Card
const StationCard = ({ station, onClose }: any) => {
  const [services, setServices] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const open = isStationOpen(station);

  useEffect(() => {
    setSelectedService(null);
    setSelectedSlot(null);

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

        const allSlots = generateTimeSlots(
          station.working_hours_start,
          station.working_hours_end,
          station.slot_duration_minutes
        );

        const { data: booked } = await supabase
          .from("bookings")
          .select("booking_time")
          .eq("station_id", station.id)
          .eq("booking_date", today)
          .in("status", ["pending", "confirmed"] as any);

        const bookedSet = new Set(
          (booked || []).map((b: any) => b.booking_time?.substring(0, 5))
        );

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

  const canBook =
    station.scheduling_type === "instant" ||
    station.scheduling_type === "daily" ||
    (station.scheduling_type === "slots" && selectedService && selectedSlot);

  const handleBookWhatsApp = () => {
    const today = new Date().toLocaleDateString("ar-IQ");

    let message = `مرحباً 👋\nأريد حجز في ${station.name}\n`;

    if (selectedService)
      message += `الخدمة: ${selectedService.name}\n`;

    if (selectedSlot)
      message += `الوقت: ${selectedSlot}\n`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");
  };

  return (
    <div className="absolute top-0 left-0 w-full sm:w-[400px] h-full z-[1000] bg-background border-l">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">

          <div className="flex justify-between">
            <Button variant="ghost" onClick={onClose}>
              <X />
            </Button>
            <Badge>{open ? "مفتوحة" : "مغلقة"}</Badge>
          </div>

          <h2 className="text-xl font-bold">{station.name}</h2>

          {/* services */}
          {services.map((s) => (
            <div key={s.id} className="flex justify-between">
              <span>{s.name}</span>
              <Badge>{s.price} د.ع</Badge>
            </div>
          ))}

          {/* slots */}
          {station.scheduling_type === "slots" &&
            availableSlots.map((slot) => (
              <Badge key={slot}>{slot}</Badge>
            ))}

          <Button
            disabled={!canBook}
            onClick={handleBookWhatsApp}
            className="w-full"
          >
            احجز عبر واتساب
          </Button>

        </div>
      </ScrollArea>
    </div>
  );
};

// Main Map
const StationsMap = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [map, setMap] = useState<any>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
  });

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
    setActiveMarker(station.id);

    if (station.latitude && station.longitude && map) {
      map.panTo({ lat: station.latitude, lng: station.longitude });
      map.setZoom(15);
    }
  };

  return (
    <div className="h-[100vh] w-full relative">

      {isLoaded ? (
        <GoogleMap
          onLoad={(m) => setMap(m)}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={{ lat: 33.3, lng: 44.4 }}
          zoom={7}
        >
          {stations.map((s) => (
            <Marker
              key={s.id}
              position={{ lat: s.latitude!, lng: s.longitude! }}
              onClick={() => handleMarkerClick(s)}
            />
          ))}
        </GoogleMap>
      ) : (
        <div>Loading...</div>
      )}

      {selectedStation && (
        <StationCard
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
        />
      )}
    </div>
  );
};

export default StationsMap;
