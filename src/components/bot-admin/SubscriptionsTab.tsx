import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, CreditCard, TrendingUp } from "lucide-react";

const planLabels: Record<string, string> = { basic: "أساسي", pro: "متقدم", premium: "مميز" };
const statusLabels: Record<string, string> = { active: "فعّال", expired: "منتهي", cancelled: "ملغي", trial: "تجريبي" };
const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { active: "default", trial: "secondary", expired: "destructive", cancelled: "outline" };
const payStatusLabels: Record<string, string> = { paid: "مدفوع", pending: "معلق", failed: "فاشل", refunded: "مسترد" };

const SubscriptionsTab = () => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ station_id: "", plan: "basic", amount: "50000", end_date: "" });
  const [payForm, setPayForm] = useState({ amount: "", method: "cash", notes: "" });

  // Stats
  const [stats, setStats] = useState({ totalActive: 0, totalRevenue: 0, totalCommissions: 0 });

  const load = useCallback(async () => {
    const [{ data: subs }, { data: st }, { data: pays }, { data: comms }] = await Promise.all([
      supabase.from("subscriptions").select("*, stations(name)").order("created_at", { ascending: false }),
      supabase.from("stations").select("id, name").order("name"),
      supabase.from("payments").select("*, subscriptions(stations(name))").order("created_at", { ascending: false }).limit(50),
      supabase.from("commissions").select("commission_amount"),
    ]);
    if (subs) {
      setSubscriptions(subs);
      setStats(prev => ({ ...prev, totalActive: subs.filter((s: any) => s.status === "active" || s.status === "trial").length }));
    }
    if (st) setStations(st);
    if (pays) {
      setPayments(pays);
      const totalRev = pays.filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      setStats(prev => ({ ...prev, totalRevenue: totalRev }));
    }
    if (comms) {
      const totalComm = comms.reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0);
      setStats(prev => ({ ...prev, totalCommissions: totalComm }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.station_id || !form.end_date) {
      toast({ title: "جميع الحقول مطلوبة", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("subscriptions").insert({
      station_id: form.station_id,
      plan: form.plan as any,
      status: "active" as any,
      amount: Number(form.amount),
      end_date: form.end_date,
    });
    setLoading(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إنشاء الاشتراك" });
    setDialogOpen(false);
    setForm({ station_id: "", plan: "basic", amount: "50000", end_date: "" });
    load();
  };

  const handlePayment = async () => {
    if (!payForm.amount || !selectedSubId) return;
    setLoading(true);
    await supabase.from("payments").insert({
      subscription_id: selectedSubId,
      amount: Number(payForm.amount),
      method: payForm.method,
      notes: payForm.notes || null,
      status: "paid" as any,
    });
    // Extend subscription by 30 days
    const sub = subscriptions.find(s => s.id === selectedSubId);
    if (sub) {
      const newEnd = new Date(sub.end_date);
      newEnd.setDate(newEnd.getDate() + 30);
      await supabase.from("subscriptions").update({
        end_date: newEnd.toISOString().split("T")[0],
        status: "active" as any,
        updated_at: new Date().toISOString(),
      }).eq("id", selectedSubId);
    }
    setLoading(false);
    toast({ title: "تم تسجيل الدفعة وتمديد الاشتراك" });
    setPayDialogOpen(false);
    setPayForm({ amount: "", method: "cash", notes: "" });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("subscriptions").update({ status: status as any, updated_at: new Date().toISOString() }).eq("id", id);
    load();
    toast({ title: "تم تحديث الحالة" });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground">اشتراكات فعّالة</p>
            <p className="text-2xl font-bold text-foreground">{stats.totalActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalRevenue.toLocaleString()} د.ع</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">إجمالي العمولات</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalCommissions.toLocaleString()} د.ع</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">الاشتراكات</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 ml-1" />اشتراك جديد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إنشاء اشتراك</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>المحطة</Label>
                <Select value={form.station_id} onValueChange={(v) => setForm({ ...form, station_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر المحطة" /></SelectTrigger>
                  <SelectContent>
                    {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الخطة</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">أساسي</SelectItem>
                    <SelectItem value="pro">متقدم</SelectItem>
                    <SelectItem value="premium">مميز</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>المبلغ الشهري (د.ع)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>تاريخ الانتهاء</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              <Button onClick={handleCreate} className="w-full" disabled={loading}>{loading ? "جاري..." : "إنشاء"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المحطة</TableHead><TableHead>الخطة</TableHead><TableHead>المبلغ</TableHead>
            <TableHead>البداية</TableHead><TableHead>الانتهاء</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{(s as any).stations?.name || "-"}</TableCell>
              <TableCell>{planLabels[s.plan] || s.plan}</TableCell>
              <TableCell>{Number(s.amount).toLocaleString()} د.ع</TableCell>
              <TableCell>{s.start_date}</TableCell>
              <TableCell>{s.end_date}</TableCell>
              <TableCell><Badge variant={statusColors[s.status]}>{statusLabels[s.status]}</Badge></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedSubId(s.id); setPayForm({ amount: String(s.amount), method: "cash", notes: "" }); setPayDialogOpen(true); }}>
                    <CreditCard className="h-3 w-3 ml-1" />دفعة
                  </Button>
                  {s.status === "active" && (
                    <Button variant="ghost" size="sm" onClick={() => updateStatus(s.id, "cancelled")}>إلغاء</Button>
                  )}
                  {(s.status === "expired" || s.status === "cancelled") && (
                    <Button variant="ghost" size="sm" onClick={() => updateStatus(s.id, "active")}>تفعيل</Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {subscriptions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد اشتراكات</TableCell></TableRow>}
        </TableBody>
      </Table>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تسجيل دفعة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>المبلغ (د.ع)</Label><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
            <div>
              <Label>طريقة الدفع</Label>
              <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="transfer">تحويل</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>ملاحظات</Label><Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="اختياري" /></div>
            <Button onClick={handlePayment} className="w-full" disabled={loading}>{loading ? "جاري..." : "تسجيل الدفعة"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recent Payments */}
      <h3 className="text-lg font-semibold text-foreground">آخر المدفوعات</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المحطة</TableHead><TableHead>المبلغ</TableHead><TableHead>الطريقة</TableHead>
            <TableHead>التاريخ</TableHead><TableHead>الحالة</TableHead><TableHead>ملاحظات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{(p as any).subscriptions?.stations?.name || "-"}</TableCell>
              <TableCell>{Number(p.amount).toLocaleString()} د.ع</TableCell>
              <TableCell>{p.method === "cash" ? "نقدي" : p.method === "transfer" ? "تحويل" : "بطاقة"}</TableCell>
              <TableCell>{p.payment_date}</TableCell>
              <TableCell><Badge variant={p.status === "paid" ? "default" : "destructive"}>{payStatusLabels[p.status]}</Badge></TableCell>
              <TableCell className="text-sm">{p.notes || "-"}</TableCell>
            </TableRow>
          ))}
          {payments.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد مدفوعات</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

export default SubscriptionsTab;
