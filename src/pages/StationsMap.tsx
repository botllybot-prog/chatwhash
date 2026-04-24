import { useState, useEffect, useMemo, useRef } from "react";
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Clock, Navigation, Wrench, CalendarCheck, X, Search, LocateFixed } from "lucide-react";

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

const StationsMap = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY });

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
      () => setLocating(false)
    );
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q))
    );
  }, [searchQuery, stations]);

  return (
    <div className="h-screen w-full relative" dir="rtl">

      {/* Search */}
      <div ref={searchRef} className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
        <Input
          placeholder="ابحث..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Map */}
      {isLoaded && (
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={{ lat: 33.3152, lng: 44.3661 }}
          zoom={7}
          onLoad={(m) => setMap(m)}
        >
          {stations.map((station) => (
            <Marker
              key={station.id}
              position={{ lat: station.latitude!, lng: station.longitude! }}
              onClick={() => handleMarkerClick(station)}
            >
              {activeMarker === station.id && (
                <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                  <div>
                    <strong>{station.name}</strong>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          ))}

          {userLocation && (
            <Marker position={userLocation} />
          )}
        </GoogleMap>
      )}
    </div>
  );
};

export default StationsMap;
