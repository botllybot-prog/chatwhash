import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Clock, Navigation, Wrench, CalendarCheck, Car } from "lucide-react";
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

interface Props {
  station: Station | null;
  onClose: () => void;
}

const texts = {
  ar: { open: "??????", closed: "?????", slots: "????? ?????", instant: "??? ????", daily: "??? ????", services: "???????", noServices: "?? ???? ?????", minutes: "?????", availableToday: "???????? ??????? ?????", loading: "???? ???????...", noSlots: "?? ???? ?????? ????? ?????", booking: "?????", instantText: "??? ?????? ???? ????? ?????? — ???? ????? ??? ?????? ????? ????", dailyText: "??? ?????? ???? ????? ?????? — ???? ????? ??? ?????? ??????? ?????" },
  en: { open: "Open", closed: "Closed", slots: "Fixed slots", instant: "Instant booking", daily: "Daily booking", services: "Services", noServices: "No services available", minutes: "min", availableToday: "Available time slots today", loading: "Loading...", noSlots: "No slots available today", booking: "Booking", instantText: "This station accepts instant booking — send a WhatsApp message to book now", dailyText: "This station accepts daily booking — send a WhatsApp message to choose the day" },
  ku: { open: "?????", closed: "???????", slots: "???? ?????????????", instant: "???? ????", daily: "???? ??????", services: "???????????????", noServices: "??? ?????????????? ????", minutes: "?????", availableToday: "?????? ???????????? ?????", loading: "??????? ?? ???????...", noSlots: "??? ???????? ??????? ????", booking: "???", instantText: "??? ???????? ???? ???? ????????? — ?? ??? ????? ?? ?????? ????? ?????", dailyText: "??? ???????? ???? ?????? ????????? — ?? ?????????? ??? ?? ?????? ????? ?????" },
  tr: { open: "Açik", closed: "Kapali", slots: "Sabit saatler", instant: "Anlik rezervasyon", daily: "Günlük rezervasyon", services: "Hizmetler", noServices: "Hizmet yok", minutes: "dk", availableToday: "Bugün uygun saatler", loading: "Yükleniyor...", noSlots: "Bugün uygun saat yok", booking: "Rezervasyon", instantText: "Bu istasyon anlik rezervasyon kabul eder — hemen rezervasyon için WhatsApp mesaji gönderin", dailyText: "Bu istasyon günlük rezervasyon kabul eder — günü seçmek için WhatsApp mesaji gönderin" },
} as const;

const StationDetailSheet = ({ station, onClose }: Props) => {
  const [services, setServices] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];

  useEffect(() => {
    if (!station) return;
    setLoadingSlots(true);
    const load = async () => {
      const { data: svc } = await supabase.from("services").select("*").or(`station_id.eq.${station.id},station_id.is.null`).eq("is_active", true).order("sort_order");
      if (svc) setServices(svc);
      if (station.scheduling_type === "slots") {
        const today = new Date().toISOString().split("T")[0];
        const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);
        const { data: booked } = await supabase.from("bookings").select("booking_time").eq("station_id", station.id).eq("booking_date", today).in("status", ["pending", "confirmed"] as any);
        const bookedSet = new Set((booked || []).map((b: any) => b.booking_time?.substring(0, 5)));
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        setAvailableSlots(allSlots.filter((s) => {
          const [h, m] = s.split(":").map(Number);
          return h * 60 + m > nowMin && !bookedSet.has(s);
        }));
      }
      setLoadingSlots(false);
    };
    load();
  }, [station]);

  if (!station) return null;

  const open = isStationOpen(station);
  const schedulingLabels: Record<string, string> = { slots: t.slots, instant: t.instant, daily: t.daily };

  const openGoogleMaps = () => { if (station.latitude && station.longitude) window.open(`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`, "_blank"); };
  const openWaze = () => { if (station.latitude && station.longitude) window.open(`https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`, "_blank"); };

  return (
    <Sheet open={!!station} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0" dir={isRtl ? "rtl" : "ltr"}>
        <ScrollArea className="h-full">
          <div className="p-5 space-y-4">
            <SheetHeader className="text-right">
              <div className="flex items-center justify-between"><SheetTitle className="text-lg font-bold">{station.name}</SheetTitle><Badge variant={open ? "default" : "destructive"} className="text-xs">{open ? t.open : t.closed}</Badge></div>
            </SheetHeader>

            {station.image_url ? <div className="rounded-2xl overflow-hidden border border-border"><img src={station.image_url} alt={station.name} className="w-full h-44 object-cover" /></div> : <div className="rounded-2xl bg-ocean-100 h-32 flex items-center justify-center"><Car className="h-12 w-12 text-ocean-300" /></div>}

            {station.address && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><MapPin className="h-4 w-4 text-ocean-500 flex-shrink-0" />{station.address}</p>}

            <div className="flex flex-wrap gap-2"><Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{station.working_hours_start.substring(0, 5)} - {station.working_hours_end.substring(0, 5)}</Badge><Badge variant="secondary">{schedulingLabels[station.scheduling_type]}</Badge></div>

            {station.latitude && station.longitude && <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="gap-2" onClick={openGoogleMaps}><Navigation className="h-4 w-4" />Google Maps</Button><Button variant="outline" className="gap-2" onClick={openWaze}><Navigation className="h-4 w-4" />Waze</Button></div>}

            <Card><CardContent className="pt-4 pb-3"><h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3"><Wrench className="h-4 w-4 text-primary" />{t.services}</h3>{services.length === 0 ? <p className="text-sm text-muted-foreground">{t.noServices}</p> : <div className="space-y-2">{services.map((s) => <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0"><span className="text-sm text-foreground">{s.name}</span><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{s.duration_minutes} {t.minutes}</span><Badge variant="secondary" className="text-xs font-bold">{s.price} ?.?</Badge></div></div>)}</div>}</CardContent></Card>

            {station.scheduling_type === "slots" && <Card><CardContent className="pt-4 pb-3"><h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3"><CalendarCheck className="h-4 w-4 text-primary" />{t.availableToday}</h3>{loadingSlots ? <p className="text-sm text-muted-foreground">{t.loading}</p> : availableSlots.length === 0 ? <p className="text-sm text-muted-foreground">{t.noSlots}</p> : <div className="flex flex-wrap gap-2">{availableSlots.map((slot) => <Badge key={slot} variant="outline" className="px-3 py-1.5 text-sm font-mono">{slot}</Badge>)}</div>}</CardContent></Card>}
            {station.scheduling_type === "instant" && <Card><CardContent className="pt-4 pb-3"><h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3"><CalendarCheck className="h-4 w-4 text-primary" />{t.booking}</h3><p className="text-sm text-muted-foreground">{t.instantText}</p></CardContent></Card>}
            {station.scheduling_type === "daily" && <Card><CardContent className="pt-4 pb-3"><h3 className="font-semibold text-foreground flex items-center gap-1.5 mb-3"><CalendarCheck className="h-4 w-4 text-primary" />{t.booking}</h3><p className="text-sm text-muted-foreground">{t.dailyText}</p></CardContent></Card>}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default StationDetailSheet;
