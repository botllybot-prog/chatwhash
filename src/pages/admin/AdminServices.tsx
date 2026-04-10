import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

const AdminServices = () => {
  const [services, setServices] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: 0, duration_minutes: 30, station_id: "" as string | null, is_active: true, sort_order: 0 });

  const load = useCallback(async () => {
    const [{ data: svc }, { data: st }] = await Promise.all([
      supabase.from("services").select("*, stations(name)").order("sort_order"),
      supabase.from("stations").select("id, name").order("created_at"),
    ]);
    if (svc) setServices(svc);
    if (st) setStations(st);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "الاسم مطلوب", variant: "destructive" }); return; }
    const payload = { ...form, price: Number(form.price), duration_minutes: Number(form.duration_minutes), sort_order: Number(form.sort_order), station_id: form.station_id || null };
    const wasEditing = editing;
    const { error } = editing
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    if (error) {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
      return;
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ name: "", price: 0, duration_minutes: 30, station_id: "", is_active: true, sort_order: 0 });
    await load();
    toast({ title: wasEditing ? "تم التحديث" : "تمت الإضافة" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
      return;
    }
    await load();
    toast({ title: "تم الحذف" });
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ name: s.name, price: s.price, duration_minutes: s.duration_minutes, station_id: s.station_id || "", is_active: s.is_active, sort_order: s.sort_order });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">الخدمات</h3>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm({ name: "", price: 0, duration_minutes: 30, station_id: "", is_active: true, sort_order: 0 }); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة خدمة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>{editing ? "تعديل خدمة" : "إضافة خدمة جديدة"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>اسم الخدمة</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="غسيل خارجي" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>السعر (دينار عراقي)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
                <div><Label>المدة (دقائق)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
              </div>
              <div><Label>المحطة (اتركه فارغاً للكل)</Label>
                <Select value={form.station_id || "all"} onValueChange={(v) => setForm({ ...form, station_id: v === "all" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المحطات</SelectItem>
                    {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>الترتيب</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>مفعّلة</Label>
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? "تحديث" : "إضافة"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>الخدمة</TableHead><TableHead>السعر</TableHead><TableHead>المدة</TableHead><TableHead>المحطة</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
        <TableBody>
          {services.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{s.price} د.ع</TableCell>
              <TableCell>{s.duration_minutes} دقيقة</TableCell>
              <TableCell>{(s as any).stations?.name || "الكل"}</TableCell>
              <TableCell><Badge variant={s.is_active ? "default" : "outline"}>{s.is_active ? "مفعّلة" : "معطلة"}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {services.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد خدمات بعد</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

export default AdminServices;
