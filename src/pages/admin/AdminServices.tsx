import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Banknote, Clock, Globe, Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { useAppLanguage } from "@/lib/language";

const emptyForm = {
  name: "",
  price: 0,
  duration_minutes: 30,
  station_id: null as string | null,
  is_active: true,
  sort_order: 0,
  customer_discount: "",
};

const texts = {
  ar: {
    title: "الخدمات",
    globalForAll: "خدمة عامة لكل المحطات",
    sharedServices: "خدمات مشتركة لجميع المحطات",
    add: "إضافة",
    noShared: "لا توجد خدمات مشتركة",
    noStations: "لا توجد محطات. أضف محطة أولاً من قسم المحطات.",
    serviceCount: "خدمة",
    noPrivate: "لا توجد خدمات خاصة بهذه المحطة",
    editService: "تعديل خدمة",
    addService: "إضافة خدمة",
    editServiceDesc: "تعديل بيانات الخدمة",
    addServiceDesc: "إضافة خدمة جديدة",
    station: "المحطة",
    sharedForAll: "مشتركة لجميع المحطات",
    serviceName: "اسم الخدمة",
    price: "السعر (د.ع)",
    duration: "المدة (دقيقة)",
    customerDiscount: "خصم العميل",
    activeService: "تفعيل الخدمة",
    update: "تحديث",
    cancel: "إلغاء",
    serviceRequired: "اسم الخدمة مطلوب",
    error: "حدث خطأ",
    updated: "تم تحديث الخدمة",
    added: "تمت إضافة الخدمة",
    deleted: "تم حذف الخدمة",
    disabled: "معطلة",
    private: "خاصة",
    general: "عامة",
    discountPlaceholder: "مثال: خصم 20% أو 5000 د.ع",
    servicePlaceholder: "غسيل خارجي",
  },
  en: {
    title: "Services",
    globalForAll: "Global service for all stations",
    sharedServices: "Shared services for all stations",
    add: "Add",
    noShared: "No shared services",
    noStations: "No stations available. Add a station first from the stations section.",
    serviceCount: "services",
    noPrivate: "No private services for this station",
    editService: "Edit service",
    addService: "Add service",
    editServiceDesc: "Edit service details",
    addServiceDesc: "Add a new service",
    station: "Station",
    sharedForAll: "Shared for all stations",
    serviceName: "Service name",
    price: "Price (IQD)",
    duration: "Duration (minutes)",
    customerDiscount: "Customer discount",
    activeService: "Enable service",
    update: "Update",
    cancel: "Cancel",
    serviceRequired: "Service name is required",
    error: "An error occurred",
    updated: "Service updated",
    added: "Service added",
    deleted: "Service deleted",
    disabled: "Disabled",
    private: "Private",
    general: "Global",
    discountPlaceholder: "Example: 20% off or 5000 IQD",
    servicePlaceholder: "Exterior wash",
  },
  ku: {
    title: "خزمەتگوزارییەکان",
    globalForAll: "خزمەتگوزاریی گشتی بۆ هەموو وێستگەکان",
    sharedServices: "خزمەتگوزاریی هاوبەش بۆ هەموو وێستگەکان",
    add: "زیادکردن",
    noShared: "هیچ خزمەتگوزاریی هاوبەش نییە",
    noStations: "هیچ وێستگەیەک نییە. سەرەتا وێستگەیەک لە بەشی وێستگەکان زیاد بکە.",
    serviceCount: "خزمەتگوزاری",
    noPrivate: "هیچ خزمەتگوزاریی تایبەت بۆ ئەم وێستگەیە نییە",
    editService: "دەستکاریکردنی خزمەتگوزاری",
    addService: "زیادکردنی خزمەتگوزاری",
    editServiceDesc: "دەستکاریکردنی زانیاریی خزمەتگوزاری",
    addServiceDesc: "زیادکردنی خزمەتگوزاریی نوێ",
    station: "وێستگە",
    sharedForAll: "هاوبەش بۆ هەموو وێستگەکان",
    serviceName: "ناوی خزمەتگوزاری",
    price: "نرخ (د.ع)",
    duration: "ماوە (خولەک)",
    customerDiscount: "داشکاندنی کڕیار",
    activeService: "چالاککردنی خزمەتگوزاری",
    update: "نوێکردنەوە",
    cancel: "هەڵوەشاندنەوە",
    serviceRequired: "ناوی خزمەتگوزاری پێویستە",
    error: "هەڵەیەک ڕوویدا",
    updated: "خزمەتگوزاری نوێکرایەوە",
    added: "خزمەتگوزاری زیادکرا",
    deleted: "خزمەتگوزاری سڕایەوە",
    disabled: "ناچالاک",
    private: "تایبەت",
    general: "گشتی",
    discountPlaceholder: "نمونە: 20% داشکاندن یان 5000 د.ع",
    servicePlaceholder: "شۆردنی دەرەکی",
  },
  tr: {
    title: "Hizmetler",
    globalForAll: "Tüm istasyonlar için genel hizmet",
    sharedServices: "Tüm istasyonlar için ortak hizmetler",
    add: "Ekle",
    noShared: "Ortak hizmet yok",
    noStations: "İstasyon yok. Önce istasyonlar bölümünden bir istasyon ekleyin.",
    serviceCount: "hizmet",
    noPrivate: "Bu istasyon için özel hizmet yok",
    editService: "Hizmeti düzenle",
    addService: "Hizmet ekle",
    editServiceDesc: "Hizmet bilgilerini düzenle",
    addServiceDesc: "Yeni hizmet ekle",
    station: "İstasyon",
    sharedForAll: "Tüm istasyonlar için ortak",
    serviceName: "Hizmet adı",
    price: "Fiyat (IQD)",
    duration: "Süre (dakika)",
    customerDiscount: "Müşteri indirimi",
    activeService: "Hizmeti etkinleştir",
    update: "Güncelle",
    cancel: "İptal",
    serviceRequired: "Hizmet adı gerekli",
    error: "Bir hata oluştu",
    updated: "Hizmet güncellendi",
    added: "Hizmet eklendi",
    deleted: "Hizmet silindi",
    disabled: "Devre dışı",
    private: "Özel",
    general: "Genel",
    discountPlaceholder: "Örnek: %20 indirim veya 5000 IQD",
    servicePlaceholder: "Dış yıkama",
  },
} as const;

const AdminServices = () => {
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];
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

  const openEdit = (service: any) => {
    setEditing(service);
    setForm({
      name: service.name,
      price: service.price,
      duration_minutes: service.duration_minutes,
      station_id: service.station_id,
      is_active: service.is_active,
      sort_order: service.sort_order,
      customer_discount: service.customer_discount || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: t.serviceRequired, variant: "destructive" });
      return;
    }

    const payload = {
      ...form,
      price: Number(form.price),
      duration_minutes: Number(form.duration_minutes),
      sort_order: Number(form.sort_order),
      customer_discount: form.customer_discount.trim() || null,
    };

    const wasEditing = editing;
    const { error } = editing
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);

    if (error) {
      toast({ title: t.error, description: error.message, variant: "destructive" });
      return;
    }

    closeDialog();
    await load();
    toast({ title: wasEditing ? t.updated : t.added });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      toast({ title: t.error, description: error.message, variant: "destructive" });
      return;
    }

    await load();
    toast({ title: t.deleted });
  };

  const globalServices = services.filter((service) => !service.station_id);
  const stationName = (id: string) => stations.find((station) => station.id === id)?.name ?? id;

  const ServiceCard = ({ service }: { service: any }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="min-w-0 flex items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{service.name}</span>
            {!service.is_active && <Badge variant="outline" className="text-xs">{t.disabled}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Banknote className="h-3 w-3" />{Number(service.price).toLocaleString()}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{service.duration_minutes}</span>
            {service.customer_discount && (
              <span className="flex items-center gap-1 text-emerald-600">
                <Percent className="h-3 w-3" />
                {service.customer_discount}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(service)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(service.id)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{t.title}</h3>
        <Button size="sm" variant="outline" onClick={() => openAdd(null)}>
          <Globe className="ml-1 h-4 w-4" />
          {t.globalForAll}
        </Button>
      </div>

      <Card>
        <CardHeader className="px-4 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {t.sharedServices}
              <Badge variant="secondary" className="text-xs">{globalServices.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openAdd(null)}>
              <Plus className="ml-1 h-3.5 w-3.5" />
              {t.add}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          {globalServices.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">{t.noShared}</p>
          ) : (
            globalServices.map((service) => <ServiceCard key={service.id} service={service} />)
          )}
        </CardContent>
      </Card>

      {stations.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">{t.noStations}</p>
      )}

      {stations.map((station) => {
        const stationServices = services.filter((service) => service.station_id === station.id);
        return (
          <Card key={station.id}>
            <CardHeader className="px-4 pb-3 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  {station.name}
                  <Badge variant="secondary" className="text-xs">{stationServices.length} {t.serviceCount}</Badge>
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openAdd(station.id)}>
                  <Plus className="ml-1 h-3.5 w-3.5" />
                  {t.add}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              {stationServices.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">{t.noPrivate}</p>
              ) : (
                stationServices.map((service) => <ServiceCard key={service.id} service={service} />)
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t.editService : t.addService}</DialogTitle>
            <DialogDescription className="sr-only">{editing ? t.editServiceDesc : t.addServiceDesc}</DialogDescription>
            {form.station_id ? (
              <p className="text-sm text-muted-foreground">{t.station}: <span className="font-medium text-foreground">{stationName(form.station_id)}</span></p>
            ) : (
              <p className="text-sm text-muted-foreground">{t.sharedForAll}</p>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t.serviceName}</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t.servicePlaceholder} autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t.price}</Label>
                <Input type="number" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} />
              </div>
              <div>
                <Label>{t.duration}</Label>
                <Input type="number" value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: Number(event.target.value) })} />
              </div>
            </div>

            <div>
              <Label>{t.customerDiscount}</Label>
              <Input value={form.customer_discount} onChange={(event) => setForm({ ...form, customer_discount: event.target.value })} placeholder={t.discountPlaceholder} />
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label className="cursor-pointer">{t.activeService}</Label>
              <Switch checked={form.is_active} onCheckedChange={(value) => setForm({ ...form, is_active: value })} />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">{editing ? t.update : t.add}</Button>
              <Button variant="outline" onClick={closeDialog}>{t.cancel}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminServices;
