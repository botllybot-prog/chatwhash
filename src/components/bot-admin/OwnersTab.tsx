import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
import { buildOwnerEmail, normalizeOwnerPhone } from "@/lib/ownerAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { CalendarClock, Eye, EyeOff, Loader2, MapPin, Pencil, Plus, Store, Trash2, UserPlus, Wallet, Wrench } from "lucide-react";
import { DEFAULT_STATION_CATEGORY, getVisibleStationCategories, sanitizeStationCategory, type StationCategory } from "@/lib/stationCategories";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const DEFAULT_CENTER = { lat: 33.3152, lng: 44.3661 };

type Owner = {
  id: string;
  user_id: string;
  created_by?: string | null;
  owner_name: string;
  owner_phone: string | null;
  station_id: string;
  is_active: boolean;
  outstanding_debt: number;
  free_requests_quota: number;
  free_requests_used: number;
  created_at: string;
  stations: { name: string } | null;
  assignment_source_label?: string;
  assignment_source_meta?: string;
};

type SchedulingType = "slots" | "instant" | "daily";

type ServiceDraft = {
  name: string;
  price: string;
  duration_minutes: string;
  customer_discount: string;
};

const emptyService = (): ServiceDraft => ({
  name: "",
  price: "",
  duration_minutes: "30",
  customer_discount: "",
});

const OwnersTab = () => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY });

  const [owners, setOwners] = useState<Owner[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerWhatsapp, setOwnerWhatsapp] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [freeRequestsQuota, setFreeRequestsQuota] = useState("0");
  const [stationName, setStationName] = useState("");
  const [stationCategory, setStationCategory] = useState<StationCategory>(DEFAULT_STATION_CATEGORY);
  const [stationAddress, setStationAddress] = useState("");
  const [detailedAddress, setDetailedAddress] = useState("");
  const [workingHoursStart, setWorkingHoursStart] = useState("08:00");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("22:00");
  const [schedulingType, setSchedulingType] = useState<SchedulingType>("slots");
  const [slotDuration, setSlotDuration] = useState("30");
  const [location, setLocation] = useState(DEFAULT_CENTER);
  const [services, setServices] = useState<ServiceDraft[]>([emptyService()]);
  const [categorySettings, setCategorySettings] = useState<Record<string, string>>({});
  const visibleStationCategories = getVisibleStationCategories(categorySettings);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Owner | null>(null);
  const [editForm, setEditForm] = useState({
    owner_name: "",
    owner_phone: "",
    station_id: "",
    outstanding_debt: "",
    free_requests_quota: "0",
  });
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null);

  const generatedEmail = useMemo(
    () => buildOwnerEmail(ownerWhatsapp, ownerEmail),
    [ownerWhatsapp, ownerEmail],
  );

  const resetCreateForm = () => {
    setOwnerName("");
    setOwnerWhatsapp("");
    setOwnerEmail("");
    setPassword("");
    setFreeRequestsQuota("0");
    setStationName("");
    setStationCategory(DEFAULT_STATION_CATEGORY);
    setStationAddress("");
    setDetailedAddress("");
    setWorkingHoursStart("08:00");
    setWorkingHoursEnd("22:00");
    setSchedulingType("slots");
    setSlotDuration("30");
    setStationCategory(DEFAULT_STATION_CATEGORY);
    setLocation(DEFAULT_CENTER);
    setServices([emptyService()]);
  };

  const load = useCallback(async () => {
    const [{ data: ow }, { data: st }, { data: employees }] = await Promise.all([
      supabase.from("station_owners").select("*, stations(name)").order("created_at", { ascending: false }),
      supabase.from("stations").select("id, name").order("name"),
      supabase.from("employees").select("user_id, name, email"),
    ]);
    if (ow) {
      const employeeMap = new Map(
        ((employees as any[]) || []).map((employee) => [employee.user_id, employee]),
      );

      const mappedOwners = (ow as Owner[]).map((owner) => {
        const creatorId = owner.created_by || null;

        if (!creatorId) {
          return {
            ...owner,
            assignment_source_label: "تسجيل ذاتي",
            assignment_source_meta: "تم إنشاء الحساب من قبل صاحب المحطة نفسه",
          };
        }

        const employee = employeeMap.get(creatorId);
        if (employee) {
          return {
            ...owner,
            assignment_source_label: `الموظف: ${employee.name}`,
            assignment_source_meta: employee.email || creatorId,
          };
        }

        return {
          ...owner,
          assignment_source_label: "الإدارة",
          assignment_source_meta: "تم منحه من قبل الأدمن",
        };
      });

      setOwners(mappedOwners);
    }
    if (st) setStations(st);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const loadCategorySettings = async () => {
      const { data } = await (supabase as any)
        .from("app_settings")
        .select("key, value")
        .like("key", "STATION_CATEGORY_%");
      const map: Record<string, string> = {};
      for (const row of data || []) map[row.key] = row.value;
      setCategorySettings(map);
    };
    loadCategorySettings();
  }, []);

  const addService = () => setServices((current) => [...current, emptyService()]);

  const removeService = (index: number) => {
    setServices((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  const updateService = (index: number, field: keyof ServiceDraft, value: string) => {
    setServices((current) => current.map((service, i) => (i === index ? { ...service, [field]: value } : service)));
  };

  const handleCreate = async () => {
    if (!ownerName.trim() || !ownerWhatsapp.trim() || !password || !stationName.trim()) {
      toast({ title: "اكمل بيانات المالك والمحطة", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "كلمة المرور قصيرة", description: "يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }

    const validServices = services.filter((service) => service.name.trim() && Number(service.price) > 0);
    if (validServices.length === 0) {
      toast({ title: "أضف خدمة واحدة على الأقل", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.functions.invoke("owner-self-register", {
      body: {
        owner_name: ownerName.trim(),
        owner_phone: normalizeOwnerPhone(ownerWhatsapp),
        email: ownerEmail.trim() || null,
        password,
        free_requests_quota: Number(freeRequestsQuota) || 0,
        station: {
          name: stationName.trim(),
          category: sanitizeStationCategory(stationCategory),
          address: stationAddress.trim(),
          detailed_address: detailedAddress.trim(),
          working_hours_start: workingHoursStart,
          working_hours_end: workingHoursEnd,
          scheduling_type: schedulingType,
          slot_duration_minutes: Number(slotDuration) || 30,
          latitude: location.lat,
          longitude: location.lng,
        },
        services: validServices.map((service, index) => ({
          name: service.name.trim(),
          price: Number(service.price),
          duration_minutes: Number(service.duration_minutes) || 30,
          customer_discount: service.customer_discount.trim() || null,
          sort_order: index,
        })),
      },
    });

    setLoading(false);

    if (error || data?.error) {
      toast({
        title: "فشل إنشاء حساب المالك",
        description: data?.error || error?.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "تم إنشاء المالك والمحطة والخدمات بنجاح" });
    setCreateOpen(false);
    resetCreateForm();
    await load();
  };

  const openEdit = (owner: Owner) => {
    setEditTarget(owner);
    setEditForm({
      owner_name: owner.owner_name,
      owner_phone: owner.owner_phone || "",
      station_id: owner.station_id,
      outstanding_debt: String(owner.outstanding_debt ?? 0),
      free_requests_quota: String(owner.free_requests_quota ?? 0),
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editForm.owner_name || !editForm.station_id) {
      toast({ title: "اسم المالك والمحطة مطلوبان", variant: "destructive" });
      return;
    }

    const nextFreeQuota = Math.max(0, parseInt(editForm.free_requests_quota, 10) || 0);
    const quotaChanged = nextFreeQuota !== Number(editTarget.free_requests_quota ?? 0);

    setLoading(true);
    const { error } = await supabase
      .from("station_owners")
      .update({
        owner_name: editForm.owner_name,
        owner_phone: editForm.owner_phone || null,
        station_id: editForm.station_id,
        outstanding_debt: parseFloat(editForm.outstanding_debt) || 0,
        free_requests_quota: nextFreeQuota,
        ...(quotaChanged ? { free_requests_used: 0 } : {}),
      })
      .eq("id", editTarget.id);

    if (!error && nextFreeQuota > 0) {
      await Promise.all([
        supabase.from("station_owners").update({ is_active: true }).eq("id", editTarget.id),
        supabase
          .from("stations")
          .update({
            is_active: true,
            suspension_reason: null,
            suspended_at: null,
          })
          .eq("id", editForm.station_id),
      ]);
    }

    setLoading(false);

    if (error) {
      toast({ title: "فشل التعديل", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: quotaChanged && nextFreeQuota > 0 ? "تم حفظ التعديلات وإعادة تفعيل المحطة فوراً" : "تم تعديل بيانات المالك",
      description: quotaChanged ? "تم تصفير المستخدم من الطلبات المجانية وبدء العد من الرصيد الجديد." : undefined,
    });
    setEditOpen(false);
    setEditTarget(null);
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("delete-station-owner", {
      body: { owner_id: deleteTarget.id },
    });
    setLoading(false);

    if (error || data?.error) {
      toast({ title: "فشل الحذف", description: data?.error || error?.message, variant: "destructive" });
      setDeleteTarget(null);
      return;
    }

    toast({ title: "تم حذف حساب المالك" });
    setDeleteTarget(null);
    await load();
  };

  const handleToggleActive = async (owner: Owner) => {
    const nextActive = !owner.is_active;
    const { error } = await supabase.from("station_owners").update({ is_active: nextActive }).eq("id", owner.id);

    if (error) {
      toast({ title: "فشل تغيير حالة المالك", description: error.message, variant: "destructive" });
      return;
    }

    if (!nextActive && owner.owner_phone) {
      const noticeRes = await supabase.functions.invoke("send-suspension-notice", {
        body: { owner_id: owner.id },
      });
      if (noticeRes.error || (noticeRes.data as any)?.error) {
        toast({
          title: "تم الإيقاف لكن فشل إرسال إشعار واتساب",
          description: (noticeRes.data as any)?.error || noticeRes.error?.message,
          variant: "destructive",
        });
      }
    }

    toast({ title: nextActive ? "تم تفعيل المالك" : "تم إيقاف المالك" });
    await load();
  };

  return (
    <div className="space-y-6 p-1" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">أصحاب المحطات</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            إنشاء حساب المالك والمحطة والخدمات من صفحة واحدة. ستظهر المحطة تلقائياً أيضاً في قسم محطات.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 ml-2" />إضافة مالك من صفحة واحدة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-5xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إنشاء مالك ومحطة وخدمات</DialogTitle>
            </DialogHeader>

            <div className="grid lg:grid-cols-[1.05fr,0.95fr] gap-6">
              <div className="space-y-6">
                <Card>
                  <CardContent className="pt-6 grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 flex items-center gap-2 font-semibold">
                      <UserPlus className="h-4 w-4 text-primary" />
                      بيانات الحساب
                    </div>
                    <div className="space-y-2">
                      <Label>اسم المالك</Label>
                      <Input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="أحمد محمد" />
                    </div>
                    <div className="space-y-2">
                      <Label>رقم الواتساب</Label>
                      <Input dir="ltr" value={ownerWhatsapp} onChange={(event) => setOwnerWhatsapp(event.target.value)} placeholder="0770xxxxxxx" />
                    </div>
                    <div className="space-y-2">
                      <Label>البريد الإلكتروني</Label>
                      <Input dir="ltr" type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="owner@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>كلمة المرور</Label>
                      <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6 أحرف على الأقل" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>عدد الطلبات المجانية الممنوحة</Label>
                      <Input
                        type="number"
                        min="0"
                        value={freeRequestsQuota}
                        onChange={(event) => setFreeRequestsQuota(event.target.value)}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">
                        اتركه صفراً إذا لم يتم منح طلبات مجانية بعد. سيرسل النظام تنبيهاً إلى الإدارة حتى يتم تحديد العدد المناسب لهذه المحطة.
                      </p>
                    </div>
                    <div className="md:col-span-2 rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
                      بريد الدخول الناتج:
                      <div className="mt-2 font-mono text-foreground break-all">{generatedEmail}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-2 font-semibold">
                      <Store className="h-4 w-4 text-primary" />
                      بيانات المحطة
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>اسم المحطة</Label>
                        <Input value={stationName} onChange={(event) => setStationName(event.target.value)} placeholder="محطة المنصور" />
                      </div>
                      <div className="space-y-2">
                        <Label>تصنيف النشاط</Label>
                        <Select value={stationCategory} onValueChange={(value: StationCategory) => setStationCategory(value)}>
                          <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                          <SelectContent>
                            {visibleStationCategories.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>العنوان المختصر</Label>
                        <Input value={stationAddress} onChange={(event) => setStationAddress(event.target.value)} placeholder="المنصور، بغداد" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>العنوان التفصيلي</Label>
                      <Textarea value={detailedAddress} onChange={(event) => setDetailedAddress(event.target.value)} rows={3} placeholder="الشارع، أقرب معلم، تفاصيل الوصول..." />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>وقت الفتح</Label>
                        <Input type="time" value={workingHoursStart} onChange={(event) => setWorkingHoursStart(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>وقت الغلق</Label>
                        <Input type="time" value={workingHoursEnd} onChange={(event) => setWorkingHoursEnd(event.target.value)} />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>نوع المواعيد</Label>
                        <Select value={schedulingType} onValueChange={(value: SchedulingType) => setSchedulingType(value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slots">فترات زمنية ثابتة</SelectItem>
                            <SelectItem value="instant">حجز فوري</SelectItem>
                            <SelectItem value="daily">اختيار اليوم فقط</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {schedulingType === "slots" && (
                        <div className="space-y-2">
                          <Label>مدة الفتحة بالدقائق</Label>
                          <Input type="number" value={slotDuration} onChange={(event) => setSlotDuration(event.target.value)} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        موقع المحطة
                      </Label>
                      <div className="h-72 rounded-2xl overflow-hidden border">
                        {isLoaded ? (
                          <GoogleMap
                            mapContainerStyle={{ width: "100%", height: "100%" }}
                            center={location}
                            zoom={12}
                            onClick={(event) => {
                              if (!event.latLng) return;
                              setLocation({ lat: event.latLng.lat(), lng: event.latLng.lng() });
                            }}
                            options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                          >
                            <Marker
                              position={location}
                              draggable
                              onDragEnd={(event) => {
                                if (!event.latLng) return;
                                setLocation({ lat: event.latLng.lat(), lng: event.latLng.lng() });
                              }}
                            />
                          </GoogleMap>
                        ) : (
                          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                            جاري تحميل الخريطة...
                          </div>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>خط العرض</Label>
                          <Input type="number" step="any" value={location.lat} onChange={(event) => setLocation((current) => ({ ...current, lat: Number(event.target.value) || current.lat }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>خط الطول</Label>
                          <Input type="number" step="any" value={location.lng} onChange={(event) => setLocation((current) => ({ ...current, lng: Number(event.target.value) || current.lng }))} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-2 font-semibold">
                      <Wrench className="h-4 w-4 text-primary" />
                      خدمات المحطة
                    </div>
                    {services.map((service, index) => (
                      <div key={index} className="rounded-2xl border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">الخدمة #{index + 1}</div>
                          {services.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeService(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>اسم الخدمة</Label>
                          <Input value={service.name} onChange={(event) => updateService(index, "name", event.target.value)} placeholder="غسل سطحي" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>السعر</Label>
                            <Input type="number" value={service.price} onChange={(event) => updateService(index, "price", event.target.value)} placeholder="10000" />
                          </div>
                          <div className="space-y-2">
                            <Label>المدة</Label>
                            <Input type="number" value={service.duration_minutes} onChange={(event) => updateService(index, "duration_minutes", event.target.value)} placeholder="30" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-primary" />
                            الخصم الظاهر للعميل
                          </Label>
                          <Input value={service.customer_discount} onChange={(event) => updateService(index, "customer_discount", event.target.value)} placeholder="مثال: خصم 20% أو 5000 د.ع" />
                        </div>
                      </div>
                    ))}

                    <Button type="button" variant="outline" className="w-full" onClick={addService}>
                      <Plus className="h-4 w-4 ml-1" />
                      إضافة خدمة أخرى
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                      عند الحفظ سيتم إنشاء حساب المالك وربطه بالمحطة ثم إدخال الخدمات.
                      ستظهر المحطة الجديدة أيضاً داخل صفحة محطات تلقائياً.
                    </div>
                    <Button onClick={handleCreate} className="w-full h-12" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          جاري الإنشاء...
                        </>
                      ) : (
                        <>
                          <CalendarClock className="h-4 w-4 ml-2" />
                          إنشاء المالك والمحطة والخدمات
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold text-foreground py-3 px-4">المالك</TableHead>
                <TableHead className="font-semibold text-foreground py-3">المحطة</TableHead>
                <TableHead className="font-semibold text-foreground py-3">الهاتف</TableHead>
                <TableHead className="font-semibold text-foreground py-3">الحالة</TableHead>
                <TableHead className="font-semibold text-foreground py-3">الطلبات المجانية</TableHead>
                <TableHead className="font-semibold text-foreground py-3">الذمة (د.ع)</TableHead>
                <TableHead className="font-semibold text-foreground py-3">تاريخ الإنشاء</TableHead>
                <TableHead className="font-semibold text-foreground py-3 text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map((owner) => (
                <TableRow key={owner.id} className={!owner.is_active ? "opacity-50" : ""}>
                                    <TableCell className="px-4 py-3">
                    <div className="font-semibold">{owner.owner_name}</div>
                    {owner.assignment_source_label && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium">أُضيف بواسطة:</span>{" "}
                        {owner.assignment_source_label}
                        {owner.assignment_source_meta ? ` - ${owner.assignment_source_meta}` : ""}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">{owner.stations?.name || "-"}</TableCell>
                  <TableCell className="py-3 font-mono text-sm" dir="ltr">{owner.owner_phone || "-"}</TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant={owner.is_active ? "default" : "secondary"}
                      className={owner.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500"}
                    >
                      {owner.is_active ? "نشط" : "موقوف"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    <div>
                      <span className="font-semibold text-foreground">
                        {owner.free_requests_used ?? 0}
                      </span>
                      <span className="text-muted-foreground"> / {owner.free_requests_quota ?? 0}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      الممنوح للمحطة: {owner.free_requests_quota ?? 0}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-sm font-mono">
                    {owner.outstanding_debt > 0 ? (
                      <span className="text-red-600 font-semibold">{owner.outstanding_debt.toLocaleString("ar-IQ")}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground text-sm">{new Date(owner.created_at).toLocaleDateString("ar-IQ")}</TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50" onClick={() => openEdit(owner)}>
                            <Pencil className="h-3.5 w-3.5 text-blue-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>تعديل</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className={`h-8 w-8 ${owner.is_active ? "hover:bg-yellow-50" : "hover:bg-green-50"}`} onClick={() => handleToggleActive(owner)}>
                            {owner.is_active ? (
                              <EyeOff className="h-3.5 w-3.5 text-yellow-500" />
                            ) : (
                              <Eye className="h-3.5 w-3.5 text-green-500" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{owner.is_active ? "إيقاف مؤقت" : "تفعيل"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50" onClick={() => setDeleteTarget(owner)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>حذف</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {owners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-16">
                    لا توجد حسابات مالكين بعد
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المالك</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم المالك</Label>
              <Input value={editForm.owner_name} onChange={(event) => setEditForm({ ...editForm, owner_name: event.target.value })} />
            </div>
            <div>
              <Label>رقم الهاتف (واتساب)</Label>
              <Input value={editForm.owner_phone} onChange={(event) => setEditForm({ ...editForm, owner_phone: event.target.value })} />
            </div>
            <div>
              <Label>الذمة المالية (د.ع)</Label>
              <Input type="number" min="0" value={editForm.outstanding_debt} onChange={(event) => setEditForm({ ...editForm, outstanding_debt: event.target.value })} />
            </div>
            <div>
              <Label>عدد الطلبات المجانية الممنوحة</Label>
              <Input type="number" min="0" value={editForm.free_requests_quota} onChange={(event) => setEditForm({ ...editForm, free_requests_quota: event.target.value })} />
            </div>
            <div>
              <Label>المحطة</Label>
              <Select value={editForm.station_id} onValueChange={(value) => setEditForm({ ...editForm, station_id: value })}>
                <SelectTrigger><SelectValue placeholder="اختر المحطة" /></SelectTrigger>
                <SelectContent>
                  {stations.map((station) => (
                    <SelectItem key={station.id} value={station.id}>{station.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleEdit} disabled={loading}>{loading ? "جاري الحفظ..." : "حفظ التعديلات"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف حساب <strong>{deleteTarget?.owner_name}</strong>؟
              <br />
              سيتم حذف الحساب نهائياً مع ربطه الحالي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={loading}>
              {loading ? "جاري الحذف..." : "نعم، احذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OwnersTab;
