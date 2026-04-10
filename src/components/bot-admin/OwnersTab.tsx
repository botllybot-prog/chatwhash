import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, UserPlus } from "lucide-react";

const OwnersTab = () => {
  const [owners, setOwners] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", owner_name: "", owner_phone: "", station_id: "" });

  const load = useCallback(async () => {
    const [{ data: ow }, { data: st }] = await Promise.all([
      supabase.from("station_owners").select("*, stations(name)").order("created_at", { ascending: false }),
      supabase.from("stations").select("id, name").order("name"),
    ]);
    if (ow) setOwners(ow);
    if (st) setStations(st);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.owner_name || !form.station_id) {
      toast({ title: "جميع الحقول مطلوبة", variant: "destructive" });
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("create-station-owner", {
      body: {
        email: form.email,
        password: form.password,
        owner_name: form.owner_name,
        owner_phone: form.owner_phone,
        station_id: form.station_id,
      },
    });

    setLoading(false);
    if (error || data?.error) {
      toast({ title: "فشل إنشاء الحساب", description: data?.error || error?.message, variant: "destructive" });
      return;
    }

    toast({ title: "تم إنشاء الحساب بنجاح" });
    setDialogOpen(false);
    setForm({ email: "", password: "", owner_name: "", owner_phone: "", station_id: "" });
    load();
  };

  const handleDelete = async (ownerId: string) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("delete-station-owner", {
      body: { owner_id: ownerId },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "فشل الحذف", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    load();
    toast({ title: "تم حذف الحساب بالكامل" });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">حسابات أصحاب المحطات</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="h-4 w-4 ml-1" />إنشاء حساب</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إنشاء حساب صاحب محطة</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>اسم المالك</Label><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="أحمد محمد" /></div>
              <div><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@example.com" /></div>
              <div><Label>كلمة المرور</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="كلمة مرور قوية" /></div>
              <div><Label>رقم الهاتف (واتساب)</Label><Input value={form.owner_phone} onChange={(e) => setForm({ ...form, owner_phone: e.target.value })} placeholder="964XXXXXXXXX" /></div>
              <div>
                <Label>المحطة</Label>
                <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر المحطة" /></SelectTrigger>
                  <SelectContent>
                    {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={loading}>{loading ? "جاري الإنشاء..." : "إنشاء الحساب"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>المالك</TableHead><TableHead>المحطة</TableHead><TableHead>الهاتف</TableHead><TableHead>تاريخ الإنشاء</TableHead><TableHead>إجراءات</TableHead></TableRow></TableHeader>
        <TableBody>
          {owners.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-medium">{o.owner_name}</TableCell>
              <TableCell>{(o as any).stations?.name || "-"}</TableCell>
              <TableCell>{o.owner_phone || "-"}</TableCell>
              <TableCell>{new Date(o.created_at).toLocaleDateString("ar-IQ")}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {owners.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد حسابات بعد</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

export default OwnersTab;
