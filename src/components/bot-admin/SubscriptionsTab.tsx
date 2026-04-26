import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, CreditCard, TrendingUp, Sparkles, Receipt, InfinityIcon } from "lucide-react";

const PACKAGE_DEFINITIONS = {
  starter_20: {
    code: "starter_20",
    label: "باقة 20 طلب",
    priceUsd: 5,
    requestLimit: 20,
    plan: "basic",
    blurb: "مناسبة للبداية والانطلاق",
  },
  growth_50: {
    code: "growth_50",
    label: "باقة 50 طلب",
    priceUsd: 10,
    requestLimit: 50,
    plan: "pro",
    blurb: "أفضل توازن بين السعر والانتشار",
  },
  scale_110: {
    code: "scale_110",
    label: "باقة 110 طلب",
    priceUsd: 20,
    requestLimit: 110,
    plan: "premium",
    blurb: "خيار مناسب للمحطات النشطة",
  },
  unlimited_30: {
    code: "unlimited_30",
    label: "باقة غير محدودة",
    priceUsd: 50,
    requestLimit: null,
    plan: "premium",
    blurb: "أفضل حل للتشغيل المكثف بدون سقف طلبات",
  },
} as const;

type PackageCode = keyof typeof PACKAGE_DEFINITIONS;

const STATUS_LABELS: Record<string, string> = {
  active: "فعّال",
  expired: "منتهي",
  cancelled: "ملغي",
  trial: "تجريبي",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  trial: "secondary",
  expired: "destructive",
  cancelled: "outline",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "مدفوع",
  pending: "معلق",
  failed: "فاشل",
  refunded: "مسترد",
};

const paymentMethodLabel = (method: string) => {
  if (method === "cash") return "نقدي";
  if (method === "transfer") return "تحويل";
  if (method === "card") return "بطاقة";
  return method;
};

const formatCurrency = (amount: number) => `$${Number(amount || 0).toLocaleString()}`;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const todayIso = () => new Date().toISOString().split("T")[0];

const SubscriptionsTab = () => {
  const db = supabase as any;
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{ station_id: string; package_code: PackageCode }>({
    station_id: "",
    package_code: "starter_20",
  });
  const [payForm, setPayForm] = useState({ amount: "", method: "cash", notes: "" });
  const [stats, setStats] = useState({ totalActive: 0, totalRevenue: 0, totalCommissions: 0 });

  const load = useCallback(async () => {
    const [{ data: subs }, { data: st }, { data: pays }, { data: comms }] = await Promise.all([
      db.from("subscriptions").select("*, stations(name)").order("created_at", { ascending: false }),
      db.from("stations").select("id, name").order("name"),
      db.from("payments").select("*, subscriptions(stations(name))").order("created_at", { ascending: false }).limit(50),
      db.from("commissions").select("commission_amount"),
    ]);

    setSubscriptions(subs || []);
    setStations(st || []);
    setPayments(pays || []);
    setStats({
      totalActive: (subs || []).filter((s: any) => s.status === "active" || s.status === "trial").length,
      totalRevenue: (pays || []).filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
      totalCommissions: (comms || []).reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0),
    });
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedPackage = PACKAGE_DEFINITIONS[form.package_code];

  const handleCreate = async () => {
    if (!form.station_id) {
      toast({ title: "اختر المحطة أولاً", variant: "destructive" });
      return;
    }

    setLoading(true);
    const today = new Date();
    const end = addDays(today, 30);
    const pkg = PACKAGE_DEFINITIONS[form.package_code];

    const { error } = await db.from("subscriptions").insert({
      station_id: form.station_id,
      plan: pkg.plan,
      package_code: pkg.code,
      request_limit: pkg.requestLimit,
      requests_used: 0,
      warning_sent_at: null,
      exhausted_notified_at: null,
      status: "active",
      amount: pkg.priceUsd,
      start_date: today.toISOString().split("T")[0],
      end_date: end.toISOString().split("T")[0],
      paid_at: today.toISOString(),
    });

    if (!error) {
      await Promise.all([
        db.from("stations").update({
          is_active: true,
          suspension_reason: null,
          suspended_at: null,
        }).eq("id", form.station_id),
        db.from("station_owners").update({
          is_active: true,
          outstanding_debt: 0,
        }).eq("station_id", form.station_id),
      ]);
    }

    setLoading(false);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "تم إنشاء الباقة وتفعيلها لمدة 30 يوماً" });
    setDialogOpen(false);
    setForm({ station_id: "", package_code: "starter_20" });
    await load();
  };

  const handlePayment = async () => {
    if (!payForm.amount || !selectedSubId) return;

    const sub = subscriptions.find((item) => item.id === selectedSubId);
    if (!sub) return;

    const pkg = PACKAGE_DEFINITIONS[(sub.package_code || "starter_20") as PackageCode] ||
      PACKAGE_DEFINITIONS.starter_20;

    setLoading(true);

    const { error: payErr } = await db.from("payments").insert({
      subscription_id: selectedSubId,
      amount: Number(payForm.amount),
      method: payForm.method,
      notes: payForm.notes || null,
      status: "paid",
    });

    if (payErr) {
      setLoading(false);
      toast({ title: "خطأ", description: payErr.message, variant: "destructive" });
      return;
    }

    const today = new Date();
    const end = addDays(today, 30);

    await Promise.all([
      db.from("subscriptions").update({
        plan: pkg.plan,
        package_code: pkg.code,
        request_limit: pkg.requestLimit,
        requests_used: 0,
        warning_sent_at: null,
        exhausted_notified_at: null,
        amount: pkg.priceUsd,
        status: "active",
        start_date: today.toISOString().split("T")[0],
        end_date: end.toISOString().split("T")[0],
        paid_at: today.toISOString(),
        updated_at: today.toISOString(),
      }).eq("id", selectedSubId),
      db.from("stations").update({
        is_active: true,
        suspension_reason: null,
        suspended_at: null,
      }).eq("id", sub.station_id),
      db.from("station_owners").update({
        is_active: true,
        outstanding_debt: 0,
      }).eq("station_id", sub.station_id),
    ]);

    setLoading(false);
    toast({ title: "تم تسجيل الدفعة وتجديد الباقة لمدة 30 يوماً" });
    setPayDialogOpen(false);
    setPayForm({ amount: "", method: "cash", notes: "" });
    await load();
  };

  const updateStatus = async (id: string, status: "cancelled" | "active") => {
    const sub = subscriptions.find((item) => item.id === id);
    const now = new Date().toISOString();

    const updatePayload =
      status === "active"
        ? { status, updated_at: now, exhausted_notified_at: null, warning_sent_at: null }
        : { status, updated_at: now };

    const { error } = await db.from("subscriptions").update(updatePayload).eq("id", id);

    if (!error && sub) {
      if (status === "active") {
        await Promise.all([
          db.from("stations").update({
            is_active: true,
            suspension_reason: null,
            suspended_at: null,
          }).eq("id", sub.station_id),
          db.from("station_owners").update({ is_active: true }).eq("station_id", sub.station_id),
        ]);
      }
    }

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "تم تحديث الحالة" });
    await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground">اشتراكات فعّالة</p>
            <p className="text-2xl font-bold text-foreground">{stats.totalActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="mb-1 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">إجمالي العمولات</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalCommissions.toLocaleString()} د.ع</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">إدارة باقات المحطات</h3>
          <p className="text-sm text-muted-foreground">فعّل أو جدّد الباقات لمدة 30 يوماً من تاريخ الدفع.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="ml-1 h-4 w-4" />
              اشتراك جديد
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إنشاء اشتراك جديد</DialogTitle>
              <DialogDescription className="sr-only">إنشاء اشتراك جديد للمحطة</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>المحطة</Label>
                <Select value={form.station_id} onValueChange={(value) => setForm({ ...form, station_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المحطة" />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map((station) => (
                      <SelectItem key={station.id} value={station.id}>
                        {station.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>الباقة</Label>
                <Select
                  value={form.package_code}
                  onValueChange={(value: PackageCode) => setForm({ ...form, package_code: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PACKAGE_DEFINITIONS).map((pkg) => (
                      <SelectItem key={pkg.code} value={pkg.code}>
                        {pkg.label} - {formatCurrency(pkg.priceUsd)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {selectedPackage.label}
                </div>
                <p className="text-muted-foreground">{selectedPackage.blurb}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-medium text-foreground">السعر</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(selectedPackage.priceUsd)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-medium text-foreground">عدد الطلبات</span>
                  <span className="text-foreground">
                    {selectedPackage.requestLimit === null ? "غير محدود" : `${selectedPackage.requestLimit} طلب`}
                  </span>
                </div>
              </div>

              <Button onClick={handleCreate} className="w-full" disabled={loading}>
                {loading ? "جاري الحفظ..." : "تفعيل الباقة الآن"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {Object.values(PACKAGE_DEFINITIONS).map((pkg) => (
          <Card
            key={pkg.code}
            className={`border transition-all ${pkg.code === "growth_50" ? "border-primary shadow-md" : "border-border"}`}
          >
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-foreground">{pkg.label}</h4>
                {pkg.code === "growth_50" ? (
                  <Badge className="bg-primary text-primary-foreground">الأكثر توازناً</Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{pkg.blurb}</p>
              <div className="text-3xl font-black text-primary">{formatCurrency(pkg.priceUsd)}</div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                {pkg.requestLimit === null ? <InfinityIcon className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                <span>{pkg.requestLimit === null ? "طلبات غير محدودة لمدة 30 يوماً" : `${pkg.requestLimit} طلب لمدة 30 يوماً`}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المحطة</TableHead>
            <TableHead>الباقة</TableHead>
            <TableHead>السعر</TableHead>
            <TableHead>الاستخدام</TableHead>
            <TableHead>البدء</TableHead>
            <TableHead>الانتهاء</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => {
            const pkg = PACKAGE_DEFINITIONS[(sub.package_code || "starter_20") as PackageCode] || PACKAGE_DEFINITIONS.starter_20;
            const remaining =
              sub.request_limit === null
                ? "غير محدود"
                : `${Math.max(0, Number(sub.request_limit || 0) - Number(sub.requests_used || 0))} متبقي`;

            return (
              <TableRow key={sub.id}>
                <TableCell className="font-medium">{sub.stations?.name || "-"}</TableCell>
                <TableCell>{pkg.label}</TableCell>
                <TableCell>{formatCurrency(Number(sub.amount || pkg.priceUsd))}</TableCell>
                <TableCell>
                  {sub.request_limit === null
                    ? "غير محدود"
                    : `${sub.requests_used || 0}/${sub.request_limit} — ${remaining}`}
                </TableCell>
                <TableCell>{sub.start_date || "-"}</TableCell>
                <TableCell>{sub.end_date || "-"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_COLORS[sub.status] || "outline"}>
                    {STATUS_LABELS[sub.status] || sub.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSubId(sub.id);
                        setPayForm({
                          amount: String(sub.amount || pkg.priceUsd),
                          method: "cash",
                          notes: "",
                        });
                        setPayDialogOpen(true);
                      }}
                    >
                      <CreditCard className="ml-1 h-3 w-3" />
                      تجديد
                    </Button>
                    {sub.status === "active" ? (
                      <Button variant="ghost" size="sm" onClick={() => updateStatus(sub.id, "cancelled")}>
                        إلغاء
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => updateStatus(sub.id, "active")}>
                        تفعيل
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {subscriptions.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                لا توجد اشتراكات حالياً
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة وتجديد باقة</DialogTitle>
            <DialogDescription className="sr-only">تسجيل دفعة تجديد اشتراك</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>المبلغ</Label>
              <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>طريقة الدفع</Label>
              <Select value={payForm.method} onValueChange={(value) => setPayForm({ ...payForm, method: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="transfer">تحويل</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="اختياري" />
            </div>
            <Button onClick={handlePayment} className="w-full" disabled={loading}>
              {loading ? "جاري الحفظ..." : "تسجيل الدفعة وتجديد 30 يوماً"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <h3 className="text-lg font-semibold text-foreground">آخر الدفعات</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المحطة</TableHead>
            <TableHead>المبلغ</TableHead>
            <TableHead>الطريقة</TableHead>
            <TableHead>التاريخ</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>ملاحظات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>{payment.subscriptions?.stations?.name || "-"}</TableCell>
              <TableCell>{formatCurrency(Number(payment.amount || 0))}</TableCell>
              <TableCell>{paymentMethodLabel(payment.method)}</TableCell>
              <TableCell>{payment.payment_date}</TableCell>
              <TableCell>
                <Badge variant={payment.status === "paid" ? "default" : "destructive"}>
                  {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{payment.notes || "-"}</TableCell>
            </TableRow>
          ))}
          {payments.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                لا توجد دفعات حتى الآن
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default SubscriptionsTab;
