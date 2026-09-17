import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MapPin, Sparkles, Car, Droplets } from "lucide-react";
import StationDetailSheet from "@/components/StationDetailSheet";
import { useAppLanguage } from "@/lib/language";

interface TopStation {
  id: string;
  name: string;
  address: string | null;
  detailed_address: string | null;
  category: string;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  working_hours_start: string;
  working_hours_end: string;
  scheduling_type: string;
  slot_duration_minutes: number;
  rating_average: number;
  rating_count: number;
  is_boosted: boolean;
  search_count: number;
}

interface TopService {
  id: string;
  name: string;
  price: number;
  station_id: string | null;
  station_name: string | null;
  is_boosted: boolean;
  search_count: number;
}

const texts = {
  ar: {
    title: "الأكثر بحثاً",
    subtitle: "المحطات والخدمات التي يبحث عنها العملاء أكثر.",
    topStations: "أفضل المحطات",
    topServices: "أفضل الخدمات",
    featured: "مميّزة",
    noData: "لا توجد بيانات كافية بعد",
    loadError: "تعذر تحميل البيانات",
  },
  en: {
    title: "Top Picks",
    subtitle: "The stations and services customers search for the most.",
    topStations: "Top Stations",
    topServices: "Top Services",
    featured: "Featured",
    noData: "Not enough data yet",
    loadError: "Failed to load data",
  },
  ku: {
    title: "زۆرترین گەڕان",
    subtitle: "ئەو وێستگە و خزمەتگوزارییانەی کڕیاران زۆرتر بۆیان دەگەڕێن.",
    topStations: "باشترین وێستگەکان",
    topServices: "باشترین خزمەتگوزارییەکان",
    featured: "تایبەت",
    noData: "هێشتا زانیاری بەس نییە",
    loadError: "بارکردنی زانیاری سەرکەوتوو نەبوو",
  },
  tr: {
    title: "En Çok Aranan",
    subtitle: "Müşterilerin en çok aradığı istasyonlar ve hizmetler.",
    topStations: "En İyi İstasyonlar",
    topServices: "En İyi Hizmetler",
    featured: "Öne Çıkan",
    noData: "Henüz yeterli veri yok",
    loadError: "Veriler yüklenemedi",
  },
} as const;

const TopPicks = () => {
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];

  const [stations, setStations] = useState<TopStation[]>([]);
  const [services, setServices] = useState<TopService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedStation, setSelectedStation] = useState<TopStation | null>(null);

  useEffect(() => {
    fetch("/api/v1/top-picks?limit=10")
      .then((res) => res.json())
      .then((json) => {
        if (!json?.success) {
          setError(true);
          return;
        }
        setStations(json.stations || []);
        setServices(json.services || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background pb-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 pb-3 pt-6 backdrop-blur-xl">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-black text-foreground">{t.title}</h1>
        </div>
        <p className="text-xs text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="space-y-6 px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center text-muted-foreground">{t.loadError}</div>
        ) : (
          <>
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                <Car className="h-4 w-4 text-ocean-500" />
                {t.topStations}
              </h2>
              {stations.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t.noData}</p>
              ) : (
                <div className="space-y-3">
                  {stations.map((station) => (
                    <button
                      key={station.id}
                      onClick={() => setSelectedStation(station)}
                      className={`w-full rounded-2xl border border-border bg-card p-3 shadow-sm transition-transform active:scale-[0.98] ${isRtl ? "text-right" : "text-left"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ocean-100">
                          {station.image_url ? (
                            <img src={station.image_url} alt={station.name} className="h-full w-full object-cover" />
                          ) : (
                            <Car className="h-6 w-6 text-ocean-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-foreground">{station.name}</h3>
                            {station.is_boosted && (
                              <Badge className="h-4 flex-shrink-0 gap-1 bg-amber-500 px-1.5 py-0 text-[10px] text-white hover:bg-amber-500">
                                <Sparkles className="h-2.5 w-2.5" />
                                {t.featured}
                              </Badge>
                            )}
                          </div>
                          {station.address && (
                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {station.address}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                <Droplets className="h-4 w-4 text-ocean-500" />
                {t.topServices}
              </h2>
              {services.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t.noData}</p>
              ) : (
                <div className="space-y-3">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-foreground">{service.name}</h3>
                          {service.is_boosted && (
                            <Badge className="h-4 flex-shrink-0 gap-1 bg-amber-500 px-1.5 py-0 text-[10px] text-white hover:bg-amber-500">
                              <Sparkles className="h-2.5 w-2.5" />
                              {t.featured}
                            </Badge>
                          )}
                        </div>
                        {service.station_name && (
                          <p className="truncate text-xs text-muted-foreground">{service.station_name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <StationDetailSheet
        station={
          selectedStation
            ? {
                id: selectedStation.id,
                name: selectedStation.name,
                address: selectedStation.address,
                detailed_address: selectedStation.detailed_address,
                image_url: selectedStation.image_url,
                latitude: selectedStation.latitude,
                longitude: selectedStation.longitude,
                working_hours_start: selectedStation.working_hours_start,
                working_hours_end: selectedStation.working_hours_end,
                scheduling_type: selectedStation.scheduling_type,
                slot_duration_minutes: selectedStation.slot_duration_minutes,
                is_active: true,
              }
            : null
        }
        onClose={() => setSelectedStation(null)}
      />
    </div>
  );
};

export default TopPicks;
