import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgePercent,
  FileUp,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppLanguage } from "@/lib/language";
import {
  OFFER_CITY_VALUES,
  URL_TYPE_VALUES,
  adminOffersTexts,
  localizeOfferTypeName,
  localizeUrlType,
} from "@/lib/adminOffersTranslations";
import { toast } from "@/hooks/use-toast";
import { deleteOfferMedia, uploadOfferMedia } from "@/lib/offerMedia";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type OfferTypeRow = {
  id: string;
  name: string;
};

type StationRow = {
  id: string;
  name: string;
};

type OfferRow = {
  id: string;
  title: string;
  type: string;
  cities: string;
  offer_types?: { name?: string } | null;
};

type OfferDetailRow = {
  id: string;
  offer_id: string;
  title: string | null;
  body: string | null;
  url_type: "Inside" | "Outside" | "None";
  url: string | null;
  station_id: string | null;
  sort: number;
  media_key: string | null;
  media_url: string | null;
  media_type: string | null;
  media_name: string | null;
};

type DetailForm = {
  id?: string;
  title: string;
  body: string;
  url_type: "Inside" | "Outside" | "None";
  url: string;
  station_id: string | null;
  sort: number;
  file: File | null;
  fileName: string;
  mediaKey: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
};

const DEFAULT_OFFER_TYPE_NAMES = ["Single", "Slider"] as const;

const emptyDetail = (sort = 1): DetailForm => ({
  title: "",
  body: "",
  url_type: "None",
  url: "",
  station_id: null,
  sort,
  file: null,
  fileName: "",
  mediaKey: null,
  mediaUrl: null,
  mediaType: null,
});

const splitCities = (value: string) =>
  value
    .split(",")
    .map((city) => city.trim())
    .filter(Boolean);

const normalizeDetailsSort = (details: DetailForm[]) =>
  details.map((detail, index) => ({
    ...detail,
    sort: index + 1,
  }));

const offerTypeRank = (name: string) => {
  const normalized = name.trim().toLowerCase();
  if (normalized === "single" || normalized.includes("single")) return 0;
  if (normalized === "slider" || normalized.includes("slider")) return 1;
  return 2;
};

const normalizeOfferTypes = (rows: OfferTypeRow[]) =>
  [...rows].sort((a, b) => {
    const rankDiff = offerTypeRank(a.name) - offerTypeRank(b.name);
    return rankDiff || a.name.localeCompare(b.name);
  });

const AdminOffers = () => {
  const { language, isRtl } = useAppLanguage();
  const t = adminOffersTexts[language].offers;
  const cityLabels = adminOffersTexts[language].cities;

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [offerTypes, setOfferTypes] = useState<OfferTypeRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OfferRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const [cities, setCities] = useState<string[]>(["All"]);
  const [details, setDetails] = useState<DetailForm[]>([emptyDetail()]);
  const [saving, setSaving] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const selectedTypeName = offerTypes.find((type) => type.id === typeId)?.name || "";
  const selectedTypeKind = selectedTypeName.toLowerCase().includes("slider") ? "Slider" : "Single";
  const isSlider = selectedTypeKind === "Slider";

  const ensureDefaultOfferTypes = useCallback(async (currentTypes: OfferTypeRow[]) => {
    const lowerNames = new Set(currentTypes.map((type) => type.name.trim().toLowerCase()));
    const missingNames = DEFAULT_OFFER_TYPE_NAMES.filter((name) => !lowerNames.has(name.toLowerCase()));

    if (missingNames.length === 0) return normalizeOfferTypes(currentTypes);

    const { error } = await (supabase as any)
      .from("offer_types")
      .insert(missingNames.map((name) => ({ name })));

    if (error) {
      toast({ title: t.loadError, description: error.message, variant: "destructive" });
      return normalizeOfferTypes(currentTypes);
    }

    const { data, error: reloadError } = await (supabase as any)
      .from("offer_types")
      .select("id, name")
      .order("name", { ascending: true });

    if (reloadError) {
      toast({ title: t.loadError, description: reloadError.message, variant: "destructive" });
      return normalizeOfferTypes(currentTypes);
    }

    return normalizeOfferTypes((data || []) as OfferTypeRow[]);
  }, [t.loadError]);

  const load = useCallback(async () => {
    setLoading(true);
    const [offersResult, typesResult, stationsResult] = await Promise.all([
      (supabase as any)
        .from("offers")
        .select("id, title, type, cities, offer_types(name)")
        .order("title", { ascending: true }),
      (supabase as any).from("offer_types").select("id, name").order("name", { ascending: true }),
      (supabase as any).from("stations").select("id, name").order("name", { ascending: true }),
    ]);
    setLoading(false);

    const firstError = offersResult.error || typesResult.error || stationsResult.error;
    if (firstError) {
      toast({ title: t.loadError, description: firstError.message, variant: "destructive" });
      return;
    }

    const normalizedTypes = await ensureDefaultOfferTypes((typesResult.data || []) as OfferTypeRow[]);
    setOffers((offersResult.data || []) as OfferRow[]);
    setOfferTypes(normalizedTypes);
    setStations((stationsResult.data || []) as StationRow[]);
  }, [ensureDefaultOfferTypes, t.loadError]);

  useEffect(() => {
    if (typeId || offerTypes.length === 0) return;
    const singleType = offerTypes.find((type) => offerTypeRank(type.name) === 0);
    setTypeId(singleType?.id || offerTypes[0].id);
  }, [offerTypes, typeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredOffers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offers;

    return offers.filter((offer) => {
      const typeName = offer.offer_types?.name || "";
      return [offer.title, typeName, offer.cities].some((value) => value.toLowerCase().includes(q));
    });
  }, [offers, search]);

  const citiesText = useMemo(() => {
    if (cities.length === 0) return t.citiesPlaceholder;
    return cities.map((city) => cityLabels[city as keyof typeof cityLabels] || city).join(", ");
  }, [cities, cityLabels, t.citiesPlaceholder]);

  const resetForm = () => {
    setSelectedOfferId(null);
    setTitle("");
    const singleType = offerTypes.find((type) => offerTypeRank(type.name) === 0);
    setTypeId(singleType?.id || offerTypes[0]?.id || "");
    setCities(["All"]);
    setDetails([emptyDetail()]);
  };

  const loadOfferDetails = async (offer: OfferRow) => {
    setSelectedOfferId(offer.id);
    setTitle(offer.title);
    setTypeId(offer.type);
    setCities(splitCities(offer.cities).length ? splitCities(offer.cities) : ["All"]);
    setDetailsLoading(true);

    const { data, error } = await (supabase as any)
      .from("offer_details")
      .select("id, offer_id, title, body, url_type, url, station_id, sort, media_key, media_url, media_type, media_name")
      .eq("offer_id", offer.id)
      .order("sort", { ascending: true });
    setDetailsLoading(false);

    if (error) {
      toast({ title: t.loadError, description: error.message, variant: "destructive" });
      setDetails([emptyDetail()]);
      return;
    }

    const rows = (data || []) as OfferDetailRow[];
    setDetails(
      rows.length
        ? rows.map((row, index) => ({
            id: row.id,
            title: row.title || "",
            body: row.body || "",
            url_type: URL_TYPE_VALUES.includes(row.url_type) ? row.url_type : "None",
            url: row.url || "",
            station_id: row.station_id,
            sort: row.sort || index + 1,
            file: null,
            fileName: row.media_name || "",
            mediaKey: row.media_key,
            mediaUrl: row.media_url,
            mediaType: row.media_type,
          }))
        : [emptyDetail()],
    );
  };

  const handleTypeChange = (nextTypeId: string) => {
    setTypeId(nextTypeId);
    const nextTypeName = offerTypes.find((type) => type.id === nextTypeId)?.name || "";
    if (!nextTypeName.toLowerCase().includes("slider")) {
      setDetails((current) => [current[0] || emptyDetail()]);
    }
  };

  const toggleCity = (city: string) => {
    setCities((current) => {
      if (city === "All") return current.includes("All") ? [] : ["All"];
      const withoutAll = current.filter((item) => item !== "All");
      return withoutAll.includes(city)
        ? withoutAll.filter((item) => item !== city)
        : [...withoutAll, city];
    });
  };

  const updateDetail = (index: number, patch: Partial<DetailForm>) => {
    setDetails((current) =>
      current.map((detail, detailIndex) => (detailIndex === index ? { ...detail, ...patch } : detail)),
    );
  };

  const addDetail = () => {
    if (!isSlider) return;
    setDetails((current) => [...current, emptyDetail(current.length + 1)]);
  };

  const removeDetail = (index: number) => {
    if (!isSlider || details.length <= 1) return;
    setDetails((current) => normalizeDetailsSort(current.filter((_, detailIndex) => detailIndex !== index)));
  };

  const moveDetail = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= details.length) return;
    setDetails((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return normalizeDetailsSort(next);
    });
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast({ title: t.requiredTitle, variant: "destructive" });
      return;
    }
    if (!typeId) {
      toast({ title: t.requiredType, variant: "destructive" });
      return;
    }
    if (cities.length === 0) {
      toast({ title: t.requiredCities, variant: "destructive" });
      return;
    }
    if (details.length === 0) {
      toast({ title: t.requiredDetails, variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = { title: cleanTitle, type: typeId, cities: cities.join(",") };
    const offerResult = selectedOfferId
      ? await (supabase as any).from("offers").update(payload).eq("id", selectedOfferId).select("id").single()
      : await (supabase as any).from("offers").insert(payload).select("id").single();

    if (offerResult.error || !offerResult.data?.id) {
      setSaving(false);
      toast({ title: t.saveError, description: offerResult.error?.message, variant: "destructive" });
      return;
    }

    const offerId = offerResult.data.id as string;
    const existingMediaResult = selectedOfferId
      ? await (supabase as any).from("offer_details").select("id, media_key").eq("offer_id", offerId)
      : { data: [], error: null };

    if (existingMediaResult.error) {
      setSaving(false);
      toast({ title: t.saveError, description: existingMediaResult.error.message, variant: "destructive" });
      return;
    }

    const existingMediaKeys = (existingMediaResult.data || [])
      .map((row: { media_key?: string | null }) => row.media_key)
      .filter((key: string | null | undefined): key is string => Boolean(key));
    const existingDetailIds = (existingMediaResult.data || [])
      .map((row: { id?: string }) => row.id)
      .filter((id: string | undefined): id is string => Boolean(id));

    const normalizedDetails = normalizeDetailsSort(isSlider ? details : [details[0] || emptyDetail()]);
    const uploadedKeys: string[] = [];
    const replacedKeys: string[] = [];
    let detailRows;

    try {
      detailRows = await Promise.all(normalizedDetails.map(async (detail) => {
        let mediaKey = detail.mediaKey;
        let mediaUrl = detail.mediaUrl;
        let mediaType = detail.mediaType;
        let mediaName = detail.fileName || null;

        if (detail.file) {
          const uploaded = await uploadOfferMedia(detail.file);
          uploadedKeys.push(uploaded.key);
          if (detail.mediaKey) replacedKeys.push(detail.mediaKey);
          mediaKey = uploaded.key;
          mediaUrl = uploaded.url;
          mediaType = uploaded.type;
          mediaName = uploaded.name;
        }

        return {
          offer_id: offerId,
          title: detail.title.trim() || null,
          body: detail.body.trim() || null,
          url_type: detail.url_type,
          url: detail.url.trim() || null,
          station_id: detail.station_id || null,
          sort: detail.sort,
          media_key: mediaKey,
          media_url: mediaUrl,
          media_type: mediaType,
          media_name: mediaName,
        };
      }));
    } catch (error) {
      await Promise.allSettled(uploadedKeys.map(deleteOfferMedia));
      if (!selectedOfferId) await (supabase as any).from("offers").delete().eq("id", offerId);
      setSaving(false);
      toast({ title: t.saveError, description: error instanceof Error ? error.message : undefined, variant: "destructive" });
      return;
    }

    const { data: insertedDetails, error: detailsError } = await (supabase as any)
      .from("offer_details")
      .insert(detailRows)
      .select("id");

    if (detailsError) {
      await Promise.allSettled(uploadedKeys.map(deleteOfferMedia));
      if (!selectedOfferId) await (supabase as any).from("offers").delete().eq("id", offerId);
      setSaving(false);
      toast({ title: t.saveError, description: detailsError.message, variant: "destructive" });
      return;
    }

    if (existingDetailIds.length > 0) {
      const { error: deleteError } = await (supabase as any)
        .from("offer_details")
        .delete()
        .in("id", existingDetailIds);

      if (deleteError) {
        const insertedDetailIds = (insertedDetails || []).map((row: { id: string }) => row.id);
        if (insertedDetailIds.length > 0) {
          await (supabase as any).from("offer_details").delete().in("id", insertedDetailIds);
        }
        await Promise.allSettled(uploadedKeys.map(deleteOfferMedia));
        setSaving(false);
        toast({ title: t.saveError, description: deleteError.message, variant: "destructive" });
        return;
      }
    }

    const retainedKeys = new Set(detailRows.map((detail) => detail.media_key).filter(Boolean));
    const removedKeys = existingMediaKeys.filter((key) => !retainedKeys.has(key));
    await Promise.allSettled([...new Set([...replacedKeys, ...removedKeys])].map(deleteOfferMedia));
    setSaving(false);

    toast({ title: t.saved });
    setSelectedOfferId(offerId);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { data: mediaRows } = await (supabase as any)
      .from("offer_details")
      .select("media_key")
      .eq("offer_id", deleteTarget.id);
    const { error } = await (supabase as any).from("offers").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      toast({ title: t.deleteError, description: error.message, variant: "destructive" });
      return;
    }

    await Promise.allSettled(
      (mediaRows || [])
        .map((row: { media_key?: string | null }) => row.media_key)
        .filter((key: string | null | undefined): key is string => Boolean(key))
        .map(deleteOfferMedia),
    );
    toast({ title: t.deleted });
    if (selectedOfferId === deleteTarget.id) resetForm();
    setOffers((current) => current.filter((offer) => offer.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.management}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button onClick={resetForm} variant="outline" className="w-full gap-2 sm:w-auto">
          <Plus className="h-4 w-4" />
          {t.newOffer}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.5fr)]">
        <Card className="h-fit">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgePercent className="h-5 w-5 text-primary" />
              {t.offerList}
            </CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} className="ps-9" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.title}</TableHead>
                    <TableHead>{t.type}</TableHead>
                    <TableHead className="w-24 text-center">{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="mx-auto h-8 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredOffers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        {t.noOffers}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOffers.map((offer) => (
                      <TableRow
                        key={offer.id}
                        className={selectedOfferId === offer.id ? "bg-primary/5" : undefined}
                        onClick={() => void loadOfferDetails(offer)}
                      >
                        <TableCell className="cursor-pointer font-medium">{offer.title}</TableCell>
                        <TableCell className="cursor-pointer text-muted-foreground">
                          {localizeOfferTypeName(offer.offer_types?.name || "", language)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="mx-auto h-8 w-8"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(offer);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">{t.delete}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedOfferId ? t.editOffer : t.createOffer}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_1fr_auto] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor="offer-title">{t.title}</Label>
                <Input
                  id="offer-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t.titlePlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.type}</Label>
                <Select value={typeId} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.typePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {normalizeOfferTypes(offerTypes).map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {localizeOfferTypeName(type.name, language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.cities}</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">{citiesText}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRtl ? "end" : "start"} className="max-h-80 w-64 overflow-auto">
                    {OFFER_CITY_VALUES.map((city) => (
                      <DropdownMenuCheckboxItem
                        key={city}
                        checked={cities.includes(city)}
                        onCheckedChange={() => toggleCity(city)}
                        onSelect={(event) => event.preventDefault()}
                      >
                        {cityLabels[city]}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {isSlider && (
                <Button onClick={addDetail} className="gap-2 lg:min-w-48">
                  <Plus className="h-4 w-4" />
                  {t.addOfferDetails}
                </Button>
              )}
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
              {isSlider ? t.sliderHint : t.singleHint}
            </div>

            <div className="space-y-4 rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">{t.details}</h2>
                {detailsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {details.map((detail, index) => (
                <div key={`${detail.id || "new"}-${index}`} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">
                        {t.details} #{index + 1}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.sortOrder}: {detail.sort}
                      </div>
                    </div>
                    {isSlider && (
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={index === 0} onClick={() => moveDetail(index, -1)}>
                          <ArrowUp className="h-4 w-4" />
                          <span className="sr-only">{t.moveUp}</span>
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={index === details.length - 1} onClick={() => moveDetail(index, 1)}>
                          <ArrowDown className="h-4 w-4" />
                          <span className="sr-only">{t.moveDown}</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={details.length <= 1} onClick={() => removeDetail(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">{t.removeDetail}</span>
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.detailTitle}</Label>
                      <Input
                        value={detail.title}
                        onChange={(event) => updateDetail(index, { title: event.target.value })}
                        placeholder={t.detailTitlePlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.urlType}</Label>
                      <Select value={detail.url_type} onValueChange={(value) => updateDetail(index, { url_type: value as DetailForm["url_type"] })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {URL_TYPE_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {localizeUrlType(value, language)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>{t.body}</Label>
                      <Textarea
                        value={detail.body}
                        onChange={(event) => updateDetail(index, { body: event.target.value })}
                        placeholder={t.bodyPlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.url}</Label>
                      <Input
                        value={detail.url}
                        onChange={(event) => updateDetail(index, { url: event.target.value })}
                        placeholder={t.urlPlaceholder}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.station}</Label>
                      <Select
                        value={detail.station_id || "__none"}
                        onValueChange={(value) => updateDetail(index, { station_id: value === "__none" ? null : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t.stationPlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">{t.none}</SelectItem>
                          {stations.map((station) => (
                            <SelectItem key={station.id} value={station.id}>
                              {station.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.sortOrder}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={detail.sort}
                        onChange={(event) => updateDetail(index, { sort: Number(event.target.value) || index + 1 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.file}</Label>
                      <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted/50">
                        <FileUp className="h-4 w-4" />
                        <span className="truncate">{detail.fileName || t.chooseFile}</span>
                        <input
                          type="file"
                          accept="image/avif,image/gif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            updateDetail(index, { file, fileName: file?.name || "" });
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                {t.cancel}
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t.save}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.confirmDeleteBody}
              {deleteTarget?.title ? <span className="mt-2 block font-medium text-foreground">{deleteTarget.title}</span> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminOffers;
