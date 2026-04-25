import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Clock, Car } from "lucide-react";
import StationDetailSheet from "@/components/StationDetailSheet";
import { useAppLanguage } from "@/lib/language";

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

const texts = {
  ar: {
    stations: "المحطات",
    stationCount: "محطة",
    search: "ابحث بالاسم أو العنوان...",
    noStations: "لا توجد محطات",
    open: "مفتوحة",
    closed: "مغلقة",
  },
  en: {
    stations: "Stations",
    stationCount: "stations",
    search: "Search by name or address...",
    noStations: "No stations found",
    open: "Open",
    closed: "Closed",
  },
  ku: {
    stations: "وێستگەکان",
    stationCount: "وێستگە",
    search: "بە ناو یان ناونیشان بگەڕێ...",
    noStations: "هیچ وێستگەیەک نییە",
    open: "کراوە",
    closed: "داخراوە",
  },
  tr: {
    stations: "İstasyonlar",
    stationCount: "istasyon",
    search: "İsim veya adrese göre ara...",
    noStations: "İstasyon bulunamadı",
    open: "Açık",
    closed: "Kapalı",
  },
} as const;

const StationsList = () => {
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];
  const [stations, setStations] = useState<Station[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("stations")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setStations(data as Station[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return stations;
    const q = search.trim().toLowerCase();
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.detailed_address && s.detailed_address.toLowerCase().includes(q)),
    );
  }, [search, stations]);

  return (
    <div className="min-h-screen bg-background" dir={isRtl ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 pb-3 pt-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-500">
            <Car className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-black text-foreground">{t.stations}</h1>
          <Badge variant="secondary" className={`${isRtl ? "mr-auto" : "ml-auto"} text-xs`}>
            {stations.length} {t.stationCount}
          </Badge>
        </div>
        <div className="relative">
          <Search className={`${isRtl ? "right-3" : "left-3"} absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground`} />
          <Input
            placeholder={t.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${isRtl ? "pr-9" : "pl-9"} bg-background`}
          />
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <MapPin className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">{t.noStations}</p>
          </div>
        ) : (
          filtered.map((station) => {
            const open = isStationOpen(station);
            return (
              <button
                key={station.id}
                onClick={() => setSelectedStation(station)}
                className={`w-full rounded-2xl border border-border bg-card text-right shadow-sm transition-transform active:scale-[0.98] ${isRtl ? "text-right" : "text-left"}`}
              >
                <div className="flex">
                  <div className="h-28 w-24 flex-shrink-0 overflow-hidden bg-ocean-100">
                    {station.image_url ? (
                      <img src={station.image_url} alt={station.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Car className="h-8 w-8 text-ocean-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-foreground">{station.name}</h3>
                        <Badge variant={open ? "default" : "destructive"} className="h-4 flex-shrink-0 px-1.5 py-0 text-[10px]">
                          {open ? t.open : t.closed}
                        </Badge>
                      </div>
                      {station.address && (
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {station.address}
                        </p>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {station.working_hours_start.substring(0, 5)} - {station.working_hours_end.substring(0, 5)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <StationDetailSheet station={selectedStation} onClose={() => setSelectedStation(null)} />
    </div>
  );
};

export default StationsList;
