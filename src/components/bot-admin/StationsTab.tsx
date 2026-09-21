import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, MapPin, LocateFixed } from "lucide-react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { getStationCityOptions } from "@/lib/stationCities";
import { DEFAULT_STATION_CATEGORY, STATION_CATEGORY_OPTIONS, getStationCategoryLabel, sanitizeStationCategory, type StationCategory } from "@/lib/stationCategories";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;

interface StationForm {
  name: string;
  category: StationCategory;
  station_type_id: string | null;
  address: string;
  detailed_address: string;
  working_hours_start: string;
  working_hours_end: string;
  slot_duration_minutes: number;
  scheduling_type: "slots" | "instant" | "daily";
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  is_boosted: boolean;
  boost_priority: number;
}

const defaultForm: StationForm = {
  name: "",
  category: DEFAULT_STATION_CATEGORY,
  station_type_id: null,
  address: "",
  detailed_address: "",
  working_hours_start: "08:00",
  working_hours_end: "22:00",
  slot_duration_minutes: 30,
  scheduling_type: "slots",
  is_active: true,
  latitude: 36.191,
  longitude: 44.009,
  image_url: null,
  is_boosted: false,
  boost_priority: 0,
};

const ERBIL_CENTER = { lat: 36.191, lng: 44.009 };


const NO_STATION_TYPE = "__none";

const StationsTab = () => {
  const [stations, setStations] = useState<any[]>([]);
  const [stationTypes, setStationTypes] = useState<{ id: string; name: string; pin_color: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<StationForm>({ ...defaultForm });
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [stationServices, setStationServices] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStationServices = useCallback(async (stationId: string) => {
    const { data } = await supabase
      .from("services")
      .select("id, name, is_active, is_boosted, boost_priority")
      .eq("station_id", stationId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    setStationServices(data || []);
  }, []);

  const toggleServiceBoost = async (serviceId: string, isBoosted: boolean) => {
    const { error } = await supabase.from("services").update({ is_boosted: isBoosted }).eq("id", serviceId);
    if (error) { toast({ title: "فشل التحديث", description: error.message, variant: "destructive" }); return; }
    setStationServices((prev) => prev.map((svc) => (svc.id === serviceId ? { ...svc, is_boosted: isBoosted } : svc)));
  };

  const setServiceBoostPriority = async (serviceId: string, priority: number) => {
    setStationServices((prev) => prev.map((svc) => (svc.id === serviceId ? { ...svc, boost_priority: priority } : svc)));
    const { error } = await supabase.from("services").update({ boost_priority: priority }).eq("id", serviceId);
    if (error) toast({ title: "فشل التحديث", description: error.message, variant: "destructive" });
  };

  const stationTypeById = new Map(stationTypes.map((type) => [type.id, type]));

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY });

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({ title: "المتصفح لا يدعم تحديد الموقع", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setLocating(false);
        toast({ title: "✅ تم تحديد موقعك الحالي" });
      },
      () => {
        setLocating(false);
        toast({ title: "تعذّر تحديد الموقع", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const load = useCallback(async () => {
    const [stationsResult, typesResult] = await Promise.all([
      supabase.from("stations").select("*").order("created_at"),
      (supabase as any).from("station_types").select("id, name, pin_color").order("name"),
    ]);
    if (stationsResult.data) setStations(stationsResult.data);
    if (typesResult.data) setStationTypes(typesResult.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `station-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("station-images").upload(fileName, file, { upsert: true });
    if (error) {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("station-images").getPublicUrl(fileName);
    setForm({ ...form, image_url: urlData.publicUrl });
    setUploading(false);
    toast({ title: "تم رفع الصورة" });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "الاسم مطلوب", variant: "destructive" }); return; }
    const payload = {
      name: form.name,
      category: sanitizeStationCategory(form.category),
      station_type_id: form.station_type_id,
      address: form.address,
      detailed_address: form.detailed_address,
      working_hours_start: form.working_hours_start,
      working_hours_end: form.working_hours_end,
      slot_duration_minutes: Number(form.slot_duration_minutes),
      scheduling_type: form.scheduling_type,
      is_active: form.is_active,
      latitude: form.latitude,
      longitude: form.longitude,
      image_url: form.image_url,
      is_boosted: form.is_boosted,
      boost_priority: Number(form.boost_priority) || 0,
    };
    if (editing) {
      const { error } = await supabase.from("stations").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "فشل التحديث", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("stations").insert(payload);
      if (error) { toast({ title: "فشل الإضافة", description: error.message, variant: "destructive" }); return; }
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ ...defaultForm });
    load();
    toast({ title: editing ? "تم التحديث" : "تمت الإضافة" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("stations").delete().eq("id", id);
    if (error) { toast({ title: "فشل الحذف", description: error.message, variant: "destructive" }); return; }
    load();
    toast({ title: "تم الحذف" });
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name,
      category: sanitizeStationCategory(s.category),
      station_type_id: s.station_type_id || null,
      address: s.address || "",
      detailed_address: s.detailed_address || "",
      working_hours_start: s.working_hours_start,
      working_hours_end: s.working_hours_end,
      slot_duration_minutes: s.slot_duration_minutes,
      scheduling_type: s.scheduling_type,
      is_active: s.is_active,
      latitude: s.latitude || ERBIL_CENTER.lat,
      longitude: s.longitude || ERBIL_CENTER.lng,
      image_url: s.image_url || null,
      is_boosted: s.is_boosted || false,
      boost_priority: s.boost_priority || 0,
    });
    setDialogOpen(true);
    void loadStationServices(s.id);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ ...defaultForm });
    setStationServices([]);
  };

  const schedulingLabels: Record<string, string> = { slots: "فترات ثابتة", instant: "حجز فوري", daily: "يومي" };

  const mapCenter = { lat: form.latitude || ERBIL_CENTER.lat, lng: form.longitude || ERBIL_CENTER.lng };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">المحطات</h3>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة محطة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh]">
        <DialogHeader><DialogTitle>{editing ? "تعديل محطة" : "إضافة محطة جديدة"}</DialogTitle><DialogDescription className="sr-only">{editing ? "تعديل بيانات المحطة" : "إضافة محطة جديدة"}</DialogDescription></DialogHeader>
            <ScrollArea className="max-h-[75vh] pr-4">
              <div className="space-y-4 pb-2">
                <div><Label>اسم المحطة</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="محطة أربيل - عينكاوا" /></div>
                <div><Label>تصنيف النشاط</Label>
                  <Select value={form.category} onValueChange={(v: StationCategory) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                    <SelectContent>
                      {STATION_CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>نوع المحطة</Label>
                  <Select
                    value={form.station_type_id || NO_STATION_TYPE}
                    onValueChange={(v) => setForm({ ...form, station_type_id: v === NO_STATION_TYPE ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="اختر نوع المحطة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_STATION_TYPE}>بدون نوع</SelectItem>
                      {stationTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.pin_color }} />
                            {type.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>العنوان (المدينة)</Label>
                  <Select value={form.address} onValueChange={(v) => setForm({ ...form, address: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                    <SelectContent>
                      {getStationCityOptions("ar", form.address).map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>العنوان المفصّل</Label>
                  <textarea
                    value={form.detailed_address}
                    onChange={(e) => setForm({ ...form, detailed_address: e.target.value })}
                    placeholder="شارع 100 متري، مقابل مول فاميلي، بجانب محطة وقود آسيا - عينكاوا، أربيل، إقليم كردستان العراق"
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <Label>صورة واجهة المحطة</Label>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                  <div className="mt-2">
                    {form.image_url ? (
                      <div className="relative">
                        <img src={form.image_url} alt="واجهة المحطة" className="w-full h-40 object-cover rounded-lg border border-border" />
                        <div className="absolute top-2 left-2 flex gap-1">
                          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                            <Upload className="h-3 w-3 ml-1" />{uploading ? "جاري الرفع..." : "تغيير"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setForm({ ...form, image_url: null })}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full h-32 border-dashed">
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{uploading ? "جاري الرفع..." : "اضغط لرفع صورة واجهة المحطة"}</span>
                        </div>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Map */}
                <div>
                  <Label className="flex items-center gap-1"><MapPin className="h-4 w-4" />الموقع على الخريطة</Label>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">انقر على الخريطة لتحديد موقع المحطة</p>
                    <Button type="button" variant="outline" size="sm" onClick={handleLocateMe} disabled={locating} className="gap-1.5 text-xs h-7">
                      <LocateFixed className="h-3.5 w-3.5" />
                      {locating ? "جاري التحديد..." : "موقعي الحالي"}
                    </Button>
                  </div>
                  <div className="h-64 rounded-lg overflow-hidden border border-border">
                    {isLoaded ? (
                      <GoogleMap
                        mapContainerStyle={{ height: "100%", width: "100%" }}
                        center={mapCenter}
                        zoom={editing ? 15 : 12}
                        onClick={(e) => {
                          if (e.latLng) setForm((f) => ({ ...f, latitude: e.latLng!.lat(), longitude: e.latLng!.lng() }));
                        }}
                        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                      >
                        <Marker
                          position={mapCenter}
                          draggable
                          onDragEnd={(e) => {
                            if (e.latLng) setForm((f) => ({ ...f, latitude: e.latLng!.lat(), longitude: e.latLng!.lng() }));
                          }}
                        />
                      </GoogleMap>
                    ) : (
                      <div className="h-full flex items-center justify-center bg-muted text-sm text-muted-foreground">جاري تحميل الخريطة...</div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div><Label className="text-xs">خط العرض</Label><Input type="number" step="any" value={form.latitude || ""} onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || null })} className="h-8 text-xs" /></div>
                    <div><Label className="text-xs">خط الطول</Label><Input type="number" step="any" value={form.longitude || ""} onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || null })} className="h-8 text-xs" /></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><Label>بداية العمل</Label><Input type="time" value={form.working_hours_start} onChange={(e) => setForm({ ...form, working_hours_start: e.target.value })} /></div>
                  <div><Label>نهاية العمل</Label><Input type="time" value={form.working_hours_end} onChange={(e) => setForm({ ...form, working_hours_end: e.target.value })} /></div>
                </div>
                <div><Label>نوع المواعيد</Label>
                  <Select value={form.scheduling_type} onValueChange={(v: "slots" | "instant" | "daily") => setForm({ ...form, scheduling_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slots">فترات زمنية ثابتة</SelectItem>
                      <SelectItem value="instant">حجز فوري</SelectItem>
                      <SelectItem value="daily">اختيار اليوم فقط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.scheduling_type === "slots" && (
                  <div><Label>مدة الفترة (دقائق)</Label><Input type="number" value={form.slot_duration_minutes} onChange={(e) => setForm({ ...form, slot_duration_minutes: Number(e.target.value) })} /></div>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>مفعّلة</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_boosted} onCheckedChange={(v) => setForm({ ...form, is_boosted: v })} />
                  <Label>تمييز المحطة (لظهورها في "أفضل المحطات")</Label>
                </div>
                {form.is_boosted && (
                  <div><Label>أولوية ظهور المحطة</Label><Input type="number" value={form.boost_priority} onChange={(e) => setForm({ ...form, boost_priority: Number(e.target.value) })} /></div>
                )}

                {editing && (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <Label className="text-sm font-semibold">تمييز خدمات هذه المحطة (Boost)</Label>
                    <p className="text-xs text-muted-foreground">
                      لظهور خدمة في "الأكثر بحثاً" بالأولوية، فعّل التمييز على الخدمة نفسها هنا — لا على المحطة.
                    </p>
                    {stationServices.length === 0 ? (
                      <p className="py-2 text-center text-xs text-muted-foreground">لا توجد خدمات لهذه المحطة</p>
                    ) : (
                      <div className="space-y-2">
                        {stationServices.map((svc) => (
                          <div key={svc.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm">{svc.name}</span>
                                {!svc.is_active && <Badge variant="outline" className="text-[10px]">معطلة</Badge>}
                              </div>
                            </div>
                            {svc.is_boosted && (
                              <Input
                                type="number"
                                value={svc.boost_priority}
                                onChange={(e) => setServiceBoostPriority(svc.id, Number(e.target.value))}
                                className="h-7 w-16 text-xs"
                              />
                            )}
                            <Switch
                              checked={svc.is_boosted}
                              onCheckedChange={(v) => toggleServiceBoost(svc.id, v)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Button onClick={handleSave} className="w-full">{editing ? "تحديث" : "إضافة"}</Button>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الصورة</TableHead>
            <TableHead>المحطة</TableHead>
            <TableHead>التصنيف</TableHead>
            <TableHead>نوع المحطة</TableHead>
            <TableHead>العنوان</TableHead>
            <TableHead>ساعات العمل</TableHead>
            <TableHead>نوع المواعيد</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stations.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                {s.image_url ? (
                  <img src={s.image_url} alt={s.name} className="w-12 h-12 object-cover rounded-md" />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-1.5">
                  {s.name}
                  {s.is_boosted && <Badge className="bg-amber-500 text-white hover:bg-amber-500">مميّزة</Badge>}
                </div>
              </TableCell>
              <TableCell><Badge variant="outline">{getStationCategoryLabel(s.category)}</Badge></TableCell>
              <TableCell>
                {stationTypeById.get(s.station_type_id) ? (
                  <Badge variant="secondary" className="gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: stationTypeById.get(s.station_type_id)!.pin_color }}
                    />
                    {stationTypeById.get(s.station_type_id)!.name}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">بدون نوع</span>
                )}
              </TableCell>
              <TableCell>
                <div className="max-w-48">
                  <span>{s.address || "-"}</span>
                  {s.detailed_address && <p className="text-xs text-muted-foreground truncate">{s.detailed_address}</p>}
                </div>
              </TableCell>
              <TableCell>{s.working_hours_start?.substring(0, 5)} - {s.working_hours_end?.substring(0, 5)}</TableCell>
              <TableCell><Badge variant="secondary">{schedulingLabels[s.scheduling_type] || s.scheduling_type}</Badge></TableCell>
              <TableCell><Badge variant={s.is_active ? "default" : "outline"}>{s.is_active ? "مفعّلة" : "معطلة"}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {stations.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد محطات بعد</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

export default StationsTab;
