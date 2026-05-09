import { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const DEFAULT_CENTER = { lat: 33.3152, lng: 44.3661 };

type Station = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export default function MobileAppMap() {
  const [stations, setStations] = useState<Station[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY });

  useEffect(() => {
    const loadStations = async () => {
      const { data } = await supabase
        .from("stations")
        .select("id,name,latitude,longitude")
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      setStations((data || []) as Station[]);
    };

    void loadStations();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        () => undefined,
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
  }, []);

  const center = useMemo(() => {
    if (userLocation) return userLocation;
    const first = stations.find((station) => station.latitude && station.longitude);
    return first ? { lat: Number(first.latitude), lng: Number(first.longitude) } : DEFAULT_CENTER;
  }, [stations, userLocation]);

  if (!isLoaded) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">جاري تحميل الموقع...</div>;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={userLocation ? 14 : 11}
        options={{
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        }}
      >
        {userLocation ? (
          <Marker
            position={userLocation}
            label={{ text: "أنت", color: "#ffffff", fontWeight: "700" }}
          />
        ) : null}
        {stations.map((station) =>
          station.latitude && station.longitude ? (
            <Marker
              key={station.id}
              position={{ lat: Number(station.latitude), lng: Number(station.longitude) }}
              title={station.name}
            />
          ) : null,
        )}
      </GoogleMap>
    </div>
  );
}
