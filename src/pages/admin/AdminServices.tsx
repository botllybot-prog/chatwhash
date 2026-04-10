import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Clock, Banknote, Globe } from "lucide-react";

const emptyForm = { name: "", price: 0, duration_minutes: 30, station_id: null as string | null, is_active: true, sort_order: 0 };

const AdminServices = () => {
  const [services, setServices] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = useCallback(async () => {
    const [{ data: svc }, { data: st }] = await Promise.all([
      supabase.from("services").select("*").order("sort_order"),
      supabase.from("stations").select("id, name").order("created_at"),
    ]);
    if (svc) setServices(svc);
    if (st) setStations(st);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = (stationId: string | null) => {
    setEditing(null);
    setForm({ ...emptyForm, station_id: stationId });
    setDialogOpen(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ name: s.name, price: s.price, duration_minutes: s.duration_minutes, station_id: s.station_id, is_active: s.is_active, sort_order: s.sort_order });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "اسم الخدمة مطلوب", variant: "destructive" }); return; }
    const payload = { ...form, price: Number(form.price), duration_minutes: Number(form.duration_minutes), sort_order: Number(form.sort_order) };
    const wasEditing = editing;
    const { error } = editing
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    if (error) {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
      return;
    }
    closeDialog();
    await load();
    toast({ title: wasEditing ? "تم التحديث" : "تمت الإضافة" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) { toast({ title: "حدث خطأ", description: error.message, variant: "destructive" }); return; }
    await load();
    toast({ title: "تم الحذف" });
  };

  // Group services: null station_id = global, else by station
  const globalServices = services.filter((s) => !s.station_id);
  const stationName = (id: string) => stations.find((s) => s.id === id)?.name ?? id;

  const ServiceCard = ({ svc }: { svc: any }) => (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{svc.name}</span>
            {!svc.is_active && <Badge variant="outline" className="text-xs">معطّلة</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Banknote className="h-3 w-3" />{Number(svc.price).toLocaleString()} د.ع</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{svc.duration_minutes} دقيقة</span>
          </div>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(svc)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(svc.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">الخدمات</h3>
        <Button size="sm" variant="outline" onClick={() => openAdd(null)}>
          <Globe className="h-4 w-4 ml-1" />خدمة عامة لكل المحطات
        </Button>
      </div>

      {/* Global services card */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              خدمات مشتركة لجميع المحطات
              <Badge variant="secondary" className="text-xs">{globalServices.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openAdd(null)}>
              <Plus className="h-3.5 w-3.5 ml-1" />إضافة
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {globalServices.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-3">لا توجد خدمات مشتركة</p>
            : globalServices.map((s) => <ServiceCard key={s.id} svc={s} />)
          }
        </CardContent>
      </Card>

      {/* Per-station cards */}
      {stations.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">لا توجد محطات — أضف محطة أولاً من قسم المحطات</p>
      )}
      {stations.map((station) => {
        const stationServices = services.filter((s) => s.station_id === station.id);
        return (
          <Card key={station.id}>
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  {station.name}
                  <Badge variant="secondary" className="text-xs">{stationServices.length} خدمة</Badge>
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openAdd(station.id)}>
                  <Plus className="h-3.5 w-3.5 ml-1" />إضافة خدمة
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {stationServices.length === 0
                ? <p className="text-xs text-muted-foreground text-center py-3">لا توجد خدمات خاصة بهذه المحطة — تستخدم الخدمات المشتركة</p>
                : stationServices.map((s) => <ServiceCard key={s.id} svc={s} />)
              }
            </CardContent>
          </Card>
        );
      })}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل خدمة" : "إضافة خدمة"}</DialogTitle>
            {form.station_id && (
              <p className="text-sm text-muted-foreground">المحطة: <span className="font-medium text-foreground">{stationName(form.station_id)}</span></p>
            )}
            {!form.station_id && (
              <p className="text-sm text-muted-foreground">مشتركة لجميع المحطات</p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم الخدمة</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="غسيل خارجي" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>السعر (د.ع)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>المدة (دقيقة)</Label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label className="cursor-pointer">تفعيل الخدمة</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">{editing ? "تحديث" : "إضافة"}</Button>
              <Button variant="outline" onClick={closeDialog}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminServices;
