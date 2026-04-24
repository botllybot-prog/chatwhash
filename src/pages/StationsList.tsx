import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Clock, Car } from "lucide-react";
import StationDetailSheet from "@/components/StationDetailSheet";

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

const StationsList = () => {
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
        (s.detailed_address && s.detailed_address.toLowerCase().includes(q))
    );
  }, [search, stations]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border px-4 pt-6 pb-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-ocean-500 flex items-center justify-center">
            <Car className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-black font-cairo text-foreground">المحطات</h1>
          <Badge variant="secondary" className="mr-auto text-xs">
            {stations.length} محطة
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم أو العنوان..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-background"
          />
        </div>
      </div>

      {/* List */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">لا توجد محطات</p>
          </div>
        ) : (
          filtered.map((station) => {
            const open = isStationOpen(station);
            return (
              <button
                key={station.id}
                onClick={() => setSelectedStation(station)}
                className="w-full text-right bg-card rounded-2xl border border-border overflow-hidden active:scale-[0.98] transition-transform shadow-sm"
              >
                <div className="flex">
                  {/* Image */}
                  <div className="w-24 h-28 bg-ocean-100 flex-shrink-0 overflow-hidden">
                    {station.image_url ? (
                      <img src={station.image_url} alt={station.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Car className="h-8 w-8 text-ocean-300" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-foreground text-sm truncate">{station.name}</h3>
                        <Badge
                          variant={open ? "default" : "destructive"}
                          className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
                        >
                          {open ? "مفتوحة" : "مغلقة"}
                        </Badge>
                      </div>
                      {station.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {station.address}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
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

      {/* Detail Sheet */}
      <StationDetailSheet
        station={selectedStation}
        onClose={() => setSelectedStation(null)}
      />
    </div>
  );
};

export default StationsList;
