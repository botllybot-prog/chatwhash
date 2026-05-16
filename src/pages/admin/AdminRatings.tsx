import { useCallback, useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppLanguage } from "@/lib/language";

const texts = {
  ar: {
    title: "تقييمات الغسل",
    subtitle: "كل تقييم يرسله الزبون بعد تأكيد إتمام الخدمة يظهر هنا.",
    allStations: "جميع المحطات",
    totalRatings: "إجمالي التقييمات",
    averageRating: "معدل التقييم",
    topStation: "أفضل محطة",
    noRatings: "لا توجد تقييمات بعد",
    headers: ["#", "المحطة", "الزبون", "الخدمة", "التقييم", "التاريخ"],
    unknown: "غير محدد",
    locale: "ar-IQ",
  },
  en: {
    title: "Wash Ratings",
    subtitle: "Every customer rating after task completion appears here.",
    allStations: "All stations",
    totalRatings: "Total ratings",
    averageRating: "Average rating",
    topStation: "Top station",
    noRatings: "No ratings yet",
    headers: ["#", "Station", "Customer", "Service", "Rating", "Date"],
    unknown: "Unknown",
    locale: "en-US",
  },
  ku: {
    title: "هەڵسەنگاندنی شۆردن",
    subtitle: "هەر هەڵسەنگاندنێکی کڕیار دوای تەواوبوونی خزمەتگوزاری لێرە دەردەکەوێت.",
    allStations: "هەموو وێستگەکان",
    totalRatings: "کۆی هەڵسەنگاندنەکان",
    averageRating: "ناوەندی هەڵسەنگاندن",
    topStation: "باشترین وێستگە",
    noRatings: "هێشتا هیچ هەڵسەنگاندنێک نییە",
    headers: ["#", "وێستگە", "کڕیار", "خزمەتگوزاری", "هەڵسەنگاندن", "بەروار"],
    unknown: "نادیار",
    locale: "ckb-IQ",
  },
  tr: {
    title: "Yıkama puanları",
    subtitle: "Müşteri hizmet tamamlandıktan sonra puan verdiğinde burada görünür.",
    allStations: "Tüm istasyonlar",
    totalRatings: "Toplam puan",
    averageRating: "Ortalama puan",
    topStation: "En iyi istasyon",
    noRatings: "Henüz puan yok",
    headers: ["#", "İstasyon", "Müşteri", "Hizmet", "Puan", "Tarih"],
    unknown: "Bilinmiyor",
    locale: "tr-TR",
  },
} as const;

const RatingStars = ({ value }: { value: number }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${index < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
      />
    ))}
  </div>
);

const AdminRatings = () => {
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];
  const [ratings, setRatings] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [filterStation, setFilterStation] = useState("all");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [stationsRes, ratingsRes] = await Promise.all([
      supabase
        .from("stations")
        .select("id, name, rating_average, rating_count")
        .order("rating_average", { ascending: false }),
      supabase
        .from("bookings")
        .select("id, booking_number, customer_name, customer_phone, customer_rating, rated_at, stations(id, name), services(name)")
        .not("customer_rating", "is", null)
        .order("rated_at", { ascending: false })
        .limit(300),
    ]);

    setStations(stationsRes.data || []);
    const rows = ratingsRes.data || [];
    setRatings(
      filterStation === "all"
        ? rows
        : rows.filter((row: any) => String(row?.stations?.id || "") === filterStation),
    );
    setLoading(false);
  }, [filterStation]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const values = ratings.map((rating) => Number(rating.customer_rating || 0)).filter((value) => value > 0);
    const average = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
    const top = [...stations]
      .filter((station) => Number(station.rating_count || 0) > 0)
      .sort((a, b) => Number(b.rating_average || 0) - Number(a.rating_average || 0))[0];

    return { total: values.length, average, top };
  }, [ratings, stations]);

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t.title}</h3>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Select value={filterStation} onValueChange={setFilterStation}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder={t.allStations} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allStations}</SelectItem>
            {stations.map((station) => (
              <SelectItem key={station.id} value={station.id}>{station.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t.totalRatings}</div>
            <div className="mt-2 text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t.averageRating}</div>
            <div className="mt-2 flex items-center gap-2 text-2xl font-bold">
              {summary.average.toFixed(1)}
              <RatingStars value={Math.round(summary.average)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t.topStation}</div>
            <div className="mt-2 text-xl font-bold">{summary.top?.name || t.unknown}</div>
            {summary.top && (
              <div className="mt-1 text-sm text-muted-foreground">
                {Number(summary.top.rating_average || 0).toFixed(1)} / 5 ({summary.top.rating_count})
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {t.headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ratings.map((rating) => (
            <TableRow key={rating.id}>
              <TableCell>#{rating.booking_number}</TableCell>
              <TableCell>{rating.stations?.name || t.unknown}</TableCell>
              <TableCell>{rating.customer_name || rating.customer_phone || t.unknown}</TableCell>
              <TableCell>{rating.services?.name || t.unknown}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500 text-white">{rating.customer_rating}/5</Badge>
                  <RatingStars value={Number(rating.customer_rating || 0)} />
                </div>
              </TableCell>
              <TableCell>
                {rating.rated_at
                  ? new Date(rating.rated_at).toLocaleString(t.locale, { dateStyle: "short", timeStyle: "short" })
                  : "-"}
              </TableCell>
            </TableRow>
          ))}
          {ratings.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                {loading ? "..." : t.noRatings}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AdminRatings;
