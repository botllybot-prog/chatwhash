import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Store, Users, Building } from "lucide-react";

const EmployeeDashboard = () => {
  const [employee, setEmployee] = useState<any>(null);
  const [stats, setStats] = useState({ stations: 0, owners: 0 });
  const [stations, setStations] = useState<any[]>([]);
  const [showCreateOwner, setShowCreateOwner] = useState(false);
  const [showCreateStation, setShowCreateStation] = useState(false);
  const [ownerForm, setOwnerForm] = useState({ email: "", password: "", owner_name: "", owner_phone: "", station_id: "" });
  const [stationForm, setStationForm] = useState({ name: "", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: emp }, { data: sts }] = await Promise.all([
        supabase.from("employees").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("stations").select("id, name").order("name"),
      ]);

      if (emp) setEmployee(emp);
      if (sts) setStations(sts);

      const [stRes, owRes] = await Promise.all([
        supabase.from("stations").select("id", { count: "exact", head: true }).eq("created_by", user.id),
        supabase.from("station_owners").select("id", { count: "exact", head: true }).eq("created_by", user.id),
      ]);
      setStats({ stations: stRes.count || 0, owners: owRes.count || 0 });
    };
    load();
  }, []);

  const handleCreateOwner = async () => {
    if (!ownerForm.email || !ownerForm.password || !ownerForm.owner_name || !ownerForm.station_id) {
      toast({ title: "جميع الحقول مطلوبة", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await supabase.functions.invoke("create-station-owner", {
      body: ownerForm,
    });
    setSaving(false);
    if (res.error || res.data?.error) {
      toast({ title: "خطأ", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "تم إنشاء الحساب بنجاح" });
      setShowCreateOwner(false);
      setOwnerForm({ email: "", password: "", owner_name: "", owner_phone: "", station_id: "" });
      setStats((s) => ({ ...s, owners: s.owners + 1 }));
    }
  };

  const handleCreateStation = async () => {
    if (!stationForm.name) {
      toast({ title: "اسم المحطة مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("stations").insert({
      name: stationForm.name,
      address: stationForm.address,
      created_by: user?.id,
      working_hours_start: "08:00",
      working_hours_end: "22:00",
      slot_duration_minutes: 30,
      scheduling_type: "slots",
      is_active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم إنشاء المحطة بنجاح" });
      setShowCreateStation(false);
      setStationForm({ name: "", address: "" });
      // Refresh stations list
      const { data: sts } = await supabase.from("stations").select("id, name").order("name");
      if (sts) setStations(sts);
      setStats((s) => ({ ...s, stations: s.stations + 1 }));
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">مرحباً{employee ? `، ${employee.name}` : ""} 👋</h1>
        <p className="text-muted-foreground mt-1">لوحة تحكم الموظف</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" /> محطات أنشأتها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.stations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> حسابات أنشأتها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.owners}</p>
          </CardContent>
        </Card>
      </div>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">صلاحياتك</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          {employee?.can_create_owners && <Badge className="text-sm py-1 px-3">إنشاء حسابات أصحاب المغاسل</Badge>}
          {employee?.can_create_stations && <Badge className="text-sm py-1 px-3">إنشاء محطات</Badge>}
          {!employee?.can_create_owners && !employee?.can_create_stations && (
            <p className="text-muted-foreground text-sm">لا توجد صلاحيات مفعّلة. تواصل مع الإدارة.</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {employee?.can_create_owners && (
          <Button onClick={() => setShowCreateOwner(true)}>
            <UserPlus className="h-4 w-4 ml-2" /> إنشاء حساب مغسلة
          </Button>
        )}
        {employee?.can_create_stations && (
          <Button variant="outline" onClick={() => setShowCreateStation(true)}>
            <Store className="h-4 w-4 ml-2" /> إضافة محطة
          </Button>
        )}
      </div>

      {/* Create Owner Dialog */}
      <Dialog open={showCreateOwner} onOpenChange={setShowCreateOwner}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء حساب صاحب مغسلة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>الاسم *</Label>
              <Input value={ownerForm.owner_name} onChange={(e) => setOwnerForm({ ...ownerForm, owner_name: e.target.value })} placeholder="اسم الصاحب" />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الهاتف</Label>
              <Input value={ownerForm.owner_phone} onChange={(e) => setOwnerForm({ ...ownerForm, owner_phone: e.target.value })} placeholder="07XXXXXXXXX" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>المحطة *</Label>
              <Select value={ownerForm.station_id} onValueChange={(v) => setOwnerForm({ ...ownerForm, station_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المحطة" /></SelectTrigger>
                <SelectContent>
                  {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني *</Label>
              <Input value={ownerForm.email} onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} placeholder="email@example.com" dir="ltr" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>كلمة المرور *</Label>
              <Input value={ownerForm.password} onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })} type="password" placeholder="••••••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateOwner(false)}>إلغاء</Button>
            <Button onClick={handleCreateOwner} disabled={saving}>{saving ? "جاري الإنشاء..." : "إنشاء"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Station Dialog */}
      <Dialog open={showCreateStation} onOpenChange={setShowCreateStation}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة محطة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>اسم المحطة *</Label>
              <Input value={stationForm.name} onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })} placeholder="اسم المحطة" />
            </div>
            <div className="space-y-1.5">
              <Label>العنوان</Label>
              <Input value={stationForm.address} onChange={(e) => setStationForm({ ...stationForm, address: e.target.value })} placeholder="العنوان" />
            </div>
            <p className="text-xs text-muted-foreground">يمكن للإدارة تعديل بقية تفاصيل المحطة لاحقاً.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateStation(false)}>إلغاء</Button>
            <Button onClick={handleCreateStation} disabled={saving}>{saving ? "جاري الإضافة..." : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeDashboard;
