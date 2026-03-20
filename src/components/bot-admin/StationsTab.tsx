import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface StationForm {
  name: string;
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
}

const defaultForm: StationForm = {
  name: "",
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
};

// Erbil center
const ERBIL_CENTER: [number, number] = [36.191, 44.009];

function LocationPicker({ position, onChange }: { position: [number, number]; onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return <Marker position={position} />;
}

const StationsTab = () => {
  const [stations, setStations] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<StationForm>({ ...defaultForm });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("stations").select("*").order("created_at");
    if (data) setStations(data);
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
    };
    if (editing) {
      await supabase.from("stations").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("stations").insert(payload);
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ ...defaultForm });
    load();
    toast({ title: editing ? "تم التحديث" : "تمت الإضافة" });
  };

  const handleDelete = async (id: string) => {
    await supabase.from("stations").delete().eq("id", id);
    load();
    toast({ title: "تم الحذف" });
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name,
      address: s.address || "",
      detailed_address: s.detailed_address || "",
      working_hours_start: s.working_hours_start,
      working_hours_end: s.working_hours_end,
      slot_duration_minutes: s.slot_duration_minutes,
      scheduling_type: s.scheduling_type,
      is_active: s.is_active,
      latitude: s.latitude || ERBIL_CENTER[0],
      longitude: s.longitude || ERBIL_CENTER[1],
      image_url: s.image_url || null,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ ...defaultForm });
  };

  const schedulingLabels: Record<string, string> = { slots: "فترات ثابتة", instant: "حجز فوري", daily: "يومي" };

  const mapCenter: [number, number] = [form.latitude || ERBIL_CENTER[0], form.longitude || ERBIL_CENTER[1]];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">المحطات</h3>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة محطة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh]">
            <DialogHeader><DialogTitle>{editing ? "تعديل محطة" : "إضافة محطة جديدة"}</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[75vh] pr-4">
              <div className="space-y-4 pb-2">
                <div><Label>اسم المحطة</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="محطة أربيل - عينكاوا" /></div>
                <div><Label>العنوان المختصر</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="عينكاوا، أربيل" /></div>
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
                  <p className="text-xs text-muted-foreground mb-2">انقر على الخريطة لتحديد موقع المحطة</p>
                  <div className="h-64 rounded-lg overflow-hidden border border-border">
                    <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }} key={`${editing?.id || "new"}-${dialogOpen}`}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <LocationPicker
                        position={mapCenter}
                        onChange={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })}
                      />
                    </MapContainer>
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
              <TableCell className="font-medium">{s.name}</TableCell>
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
          {stations.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد محطات بعد</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

export default StationsTab;
