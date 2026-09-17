import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Globe, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useAppLanguage } from "@/lib/language";

const emptyForm = {
  name: "",
  price: 0,
  service_type_id: null as string | null,
  station_id: null as string | null,
  is_active: true,
  sort_order: 0,
  customer_discount: "",
  is_boosted: false,
  boost_priority: 0,
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
    serviceType: "نوع الخدمة",
    chooseServiceType: "اختر نوع الخدمة",
    customerDiscount: "خصم العميل",
    activeService: "تفعيل الخدمة",
    boosted: "خدمة مميّزة (Boost)",
    boostPriority: "أولوية الظهور",
    featured: "مميّزة",
    update: "تحديث",
    cancel: "إلغاء",
    serviceRequired: "اسم الخدمة مطلوب",
    serviceTypeRequired: "نوع الخدمة مطلوب",
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
    serviceType: "Service type",
    chooseServiceType: "Choose service type",
    customerDiscount: "Customer discount",
    activeService: "Enable service",
    boosted: "Boosted service",
    boostPriority: "Boost priority",
    featured: "Featured",
    update: "Update",
    cancel: "Cancel",
    serviceRequired: "Service name is required",
    serviceTypeRequired: "Service type is required",
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
    serviceType: "جۆری خزمەتگوزاری",
    chooseServiceType: "جۆری خزمەتگوزاری هەڵبژێرە",
    customerDiscount: "داشکاندنی کڕیار",
    activeService: "چالاککردنی خزمەتگوزاری",
    boosted: "خزمەتگوزاریی تایبەت (Boost)",
    boostPriority: "پێشینەیی دەرکەوتن",
    featured: "تایبەت",
    update: "نوێکردنەوە",
    cancel: "هەڵوەشاندنەوە",
    serviceRequired: "ناوی خزمەتگوزاری پێویستە",
    serviceTypeRequired: "جۆری خزمەتگوزاری پێویستە",
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
    serviceType: "Hizmet türü",
    chooseServiceType: "Hizmet türü seçin",
    customerDiscount: "Müşteri indirimi",
    activeService: "Hizmeti etkinleştir",
    boosted: "Öne çıkan hizmet",
    boostPriority: "Öne çıkarma önceliği",
    featured: "Öne çıkan",
    update: "Güncelle",
    cancel: "İptal",
    serviceRequired: "Hizmet adı gerekli",
    serviceTypeRequired: "Hizmet türü gerekli",
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
  const [serviceTypes, setServiceTypes] = useState<{ id: string; name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const serviceTypeById = new Map(serviceTypes.map((type) => [type.id, type]));

  const load = useCallback(async () => {
    const [svcResult, typesResult] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .is("station_id", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      (supabase as any).from("service_types").select("id, name").order("name"),
    ]);
    if (svcResult.data) setServices(svcResult.data);
    if (typesResult.data) setServiceTypes(typesResult.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, station_id: null, price: 0, customer_discount: "" });
    setDialogOpen(true);
  };

  const openEdit = (service: any) => {
    setEditing(service);
    setForm({
      name: service.name,
      price: 0,
      service_type_id: service.service_type_id || null,
      station_id: null,
      is_active: service.is_active,
      sort_order: service.sort_order,
      customer_discount: "",
      is_boosted: service.is_boosted || false,
      boost_priority: service.boost_priority || 0,
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

    if (!form.service_type_id) {
      toast({ title: t.serviceTypeRequired, variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      station_id: null,
      price: 0,
      service_type_id: form.service_type_id,
      is_active: form.is_active,
      sort_order: Number(form.sort_order),
      customer_discount: null,
      is_boosted: form.is_boosted,
      boost_priority: Number(form.boost_priority) || 0,
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

  const globalServices = services;

  const ServiceCard = ({ service }: { service: any }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="min-w-0 flex items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{service.name}</span>
            {!service.is_active && <Badge variant="outline" className="text-xs">{t.disabled}</Badge>}
            {service.is_boosted && (
              <Badge className="bg-amber-500 text-xs text-white hover:bg-amber-500">{t.featured}</Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{t.sharedForAll}</span>
            {serviceTypeById.get(service.service_type_id) && (
              <span className="flex items-center gap-1"><Tags className="h-3 w-3" />{serviceTypeById.get(service.service_type_id)!.name}</span>
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
        <Button size="sm" variant="outline" onClick={openAdd}>
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
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={openAdd}>
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

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? t.editService : t.addService}</DialogTitle>
            <DialogDescription className="sr-only">{editing ? t.editServiceDesc : t.addServiceDesc}</DialogDescription>
            <p className="text-sm text-muted-foreground">{t.sharedForAll}</p>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t.serviceName}</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t.servicePlaceholder} autoFocus />
            </div>

            <div>
              <Label>{t.serviceType} <span className="text-destructive">*</span></Label>
              <Select
                value={form.service_type_id || undefined}
                onValueChange={(value) => setForm({ ...form, service_type_id: value })}
              >
                <SelectTrigger><SelectValue placeholder={t.chooseServiceType} /></SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label className="cursor-pointer">{t.activeService}</Label>
              <Switch checked={form.is_active} onCheckedChange={(value) => setForm({ ...form, is_active: value })} />
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label className="cursor-pointer">{t.boosted}</Label>
              <Switch checked={form.is_boosted} onCheckedChange={(value) => setForm({ ...form, is_boosted: value })} />
            </div>

            {form.is_boosted && (
              <div>
                <Label>{t.boostPriority}</Label>
                <Input
                  type="number"
                  value={form.boost_priority}
                  onChange={(event) => setForm({ ...form, boost_priority: Number(event.target.value) })}
                />
              </div>
            )}

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
