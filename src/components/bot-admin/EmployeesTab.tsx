import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Download, Eye, EyeOff, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { useAppLanguage } from "@/lib/language";

interface Employee {
  id: string;
  user_id: string;
  name: string;
  email: string;
  can_create_owners: boolean;
  can_create_stations: boolean;
  can_add_service: boolean;
  can_edit_prices: boolean;
  is_active: boolean;
  created_at: string;
  stations_count?: number;
  owners_count?: number;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  can_create_owners: false,
  can_create_stations: false,
  can_add_service: false,
  can_edit_prices: false,
};

const texts = {
  ar: {
    title: "الموظفون",
    add: "إضافة موظف",
    loading: "جاري التحميل...",
    empty: "لا يوجد موظفون. أضف موظفاً جديداً.",
    name: "الاسم",
    email: "البريد الإلكتروني",
    permissions: "الصلاحيات",
    stations: "محطات",
    accounts: "حسابات",
    status: "الحالة",
    actions: "إجراءات",
    createAccounts: "إنشاء حسابات",
    createStations: "إنشاء محطات",
    addService: "إضافة خدمة",
    editPrices: "تعديل الأسعار",
    noPermissions: "لا صلاحيات",
    active: "● نشط",
    inactive: "○ موقوف",
    exportExcel: "تصدير Excel",
    edit: "تعديل",
    pause: "إيقاف مؤقت",
    activate: "تفعيل",
    delete: "حذف",
    createTitle: "إضافة موظف جديد",
    editTitle: "تعديل بيانات الموظف",
    fullFields: "يرجى ملء جميع الحقول المطلوبة",
    genericError: "خطأ",
    created: "تم إنشاء حساب الموظف بنجاح",
    updated: "تم تحديث بيانات الموظف",
    deleted: "تم حذف الموظف",
    createAccount: "إنشاء الحساب",
    creating: "جاري الإنشاء...",
    save: "حفظ التغييرات",
    saving: "جاري الحفظ...",
    cancel: "إلغاء",
    password: "كلمة المرور *",
    employeeName: "اسم الموظف",
    deleteTitle: "تأكيد الحذف",
    deleteDescription: "هل تريد حذف حساب الموظف",
    deletePermanent: "سيتم حذف حساب الدخول نهائياً.",
    ownerAccounts: "إنشاء حسابات أصحاب المغاسل",
    stationCreate: "إنشاء محطات",
    addStationServices: "إضافة خدمات للمحطات",
    modifyPrices: "تعديل أسعار الخدمات",
    stationSheet: "المحطات",
    ownersSheet: "أصحاب المغاسل",
    summarySheet: "الملخص",
    noStations: "لا توجد محطات",
    noAccounts: "لا توجد حسابات",
    stationName: "اسم المحطة",
    addressLabel: "العنوان",
    stateLabel: "الحالة",
    ownerLabel: "صاحب المحطة",
    ownerPhone: "هاتف الصاحب",
    createdAt: "تاريخ الإنشاء",
    ownerName: "اسم صاحب المغسلة",
    phoneNumber: "رقم الهاتف",
    registeredAt: "تاريخ التسجيل",
    item: "البيان",
    value: "القيمة",
    reportDate: "تاريخ التقرير",
    employeeNameLabel: "اسم الموظف",
    emailLabel: "البريد الإلكتروني",
    stationCount: "عدد المحطات المسجلة",
    ownersCount: "عدد أصحاب المغاسل المسجلين",
    activeState: "نشطة",
    suspendedState: "موقوفة",
    exported: "تم تصدير ملف Excel بنجاح",
  },
  en: {
    title: "Employees",
    add: "Add employee",
    loading: "Loading...",
    empty: "No employees yet. Add a new employee.",
    name: "Name",
    email: "Email",
    permissions: "Permissions",
    stations: "Stations",
    accounts: "Accounts",
    status: "Status",
    actions: "Actions",
    createAccounts: "Create accounts",
    createStations: "Create stations",
    addService: "Add service",
    editPrices: "Edit prices",
    noPermissions: "No permissions",
    active: "● Active",
    inactive: "○ Suspended",
    exportExcel: "Export Excel",
    edit: "Edit",
    pause: "Pause",
    activate: "Activate",
    delete: "Delete",
    createTitle: "Add new employee",
    editTitle: "Edit employee",
    fullFields: "Please fill in all required fields",
    genericError: "Error",
    created: "Employee account created successfully",
    updated: "Employee information updated",
    deleted: "Employee deleted",
    createAccount: "Create account",
    creating: "Creating...",
    save: "Save changes",
    saving: "Saving...",
    cancel: "Cancel",
    password: "Password *",
    employeeName: "Employee name",
    deleteTitle: "Confirm deletion",
    deleteDescription: "Do you want to delete the employee account",
    deletePermanent: "The login account will be permanently deleted.",
    ownerAccounts: "Create station-owner accounts",
    stationCreate: "Create stations",
    addStationServices: "Add station services",
    modifyPrices: "Edit service prices",
    stationSheet: "Stations",
    ownersSheet: "Owners",
    summarySheet: "Summary",
    noStations: "No stations",
    noAccounts: "No accounts",
    stationName: "Station name",
    addressLabel: "Address",
    stateLabel: "Status",
    ownerLabel: "Station owner",
    ownerPhone: "Owner phone",
    createdAt: "Created at",
    ownerName: "Owner name",
    phoneNumber: "Phone number",
    registeredAt: "Registration date",
    item: "Item",
    value: "Value",
    reportDate: "Report date",
    employeeNameLabel: "Employee name",
    emailLabel: "Email",
    stationCount: "Created stations",
    ownersCount: "Created owners",
    activeState: "Active",
    suspendedState: "Suspended",
    exported: "Excel file exported successfully",
  },
  ku: {
    title: "کارمەندان",
    add: "زیادکردنی کارمەند",
    loading: "بارکردن...",
    empty: "هیچ کارمەندێک نییە. کارمەندێکی نوێ زیاد بکە.",
    name: "ناو",
    email: "ئیمەیڵ",
    permissions: "دەسەڵاتەکان",
    stations: "وێستگەکان",
    accounts: "هەژمارەکان",
    status: "دۆخ",
    actions: "کردارەکان",
    createAccounts: "دروستکردنی هەژمار",
    createStations: "دروستکردنی وێستگە",
    addService: "زیادکردنی خزمەتگوزاری",
    editPrices: "گۆڕینی نرخەکان",
    noPermissions: "بێ دەسەڵات",
    active: "● چالاک",
    inactive: "○ وەستێنراو",
    exportExcel: "هەناردەی Excel",
    edit: "دەستکاری",
    pause: "ڕاگرتن",
    activate: "چالاککردن",
    delete: "سڕینەوە",
    createTitle: "زیادکردنی کارمەندی نوێ",
    editTitle: "دەستکاری زانیاری کارمەند",
    fullFields: "تکایە هەموو خانە پێویستەکان پڕ بکەرەوە",
    genericError: "هەڵە",
    created: "هەژماری کارمەند بە سەرکەوتوویی دروست کرا",
    updated: "زانیاریی کارمەند نوێ کرایەوە",
    deleted: "کارمەند سڕایەوە",
    createAccount: "دروستکردنی هەژمار",
    creating: "دروست دەکرێت...",
    save: "پاشەکەوتکردنی گۆڕانکارییەکان",
    saving: "پاشەکەوت دەکرێت...",
    cancel: "هەڵوەشاندنەوە",
    password: "وشەی نهێنی *",
    employeeName: "ناوی کارمەند",
    deleteTitle: "دڵنیابوونەوەی سڕینەوە",
    deleteDescription: "دەتەوێت هەژماری کارمەندەکە بسڕیتەوە",
    deletePermanent: "هەژماری چوونەژوورەوە بە تەواوی دەسڕدرێتەوە.",
    ownerAccounts: "دروستکردنی هەژماری خاوەن وێستگە",
    stationCreate: "دروستکردنی وێستگە",
    addStationServices: "زیادکردنی خزمەتگوزاریی وێستگە",
    modifyPrices: "دەستکاریکردنی نرخەکان",
    stationSheet: "وێستگەکان",
    ownersSheet: "خاوەنەکان",
    summarySheet: "پوختە",
    noStations: "هیچ وێستگەیەک نییە",
    noAccounts: "هیچ هەژمارێک نییە",
    stationName: "ناوی وێستگە",
    addressLabel: "ناونیشان",
    stateLabel: "دۆخ",
    ownerLabel: "خاوەنی وێستگە",
    ownerPhone: "ژمارەی خاوەن",
    createdAt: "بەرواری دروستبوون",
    ownerName: "ناوی خاوەن",
    phoneNumber: "ژمارەی مۆبایل",
    registeredAt: "بەرواری تۆماربوون",
    item: "بڕگە",
    value: "بەها",
    reportDate: "بەرواری ڕاپۆرت",
    employeeNameLabel: "ناوی کارمەند",
    emailLabel: "ئیمەیڵ",
    stationCount: "ژمارەی وێستگە تۆمارکراوەکان",
    ownersCount: "ژمارەی خاوەنە تۆمارکراوەکان",
    activeState: "چالاک",
    suspendedState: "وەستێنراو",
    exported: "فایلی Excel بە سەرکەوتوویی هەنێردرا",
  },
  tr: {
    title: "Çalışanlar",
    add: "Çalışan ekle",
    loading: "Yükleniyor...",
    empty: "Henüz çalışan yok. Yeni bir çalışan ekleyin.",
    name: "Ad",
    email: "E-posta",
    permissions: "Yetkiler",
    stations: "İstasyonlar",
    accounts: "Hesaplar",
    status: "Durum",
    actions: "İşlemler",
    createAccounts: "Hesap oluştur",
    createStations: "İstasyon oluştur",
    addService: "Hizmet ekle",
    editPrices: "Fiyat düzenle",
    noPermissions: "Yetki yok",
    active: "● Aktif",
    inactive: "○ Durduruldu",
    exportExcel: "Excel dışa aktar",
    edit: "Düzenle",
    pause: "Durdur",
    activate: "Etkinleştir",
    delete: "Sil",
    createTitle: "Yeni çalışan ekle",
    editTitle: "Çalışan bilgilerini düzenle",
    fullFields: "Lütfen tüm zorunlu alanları doldurun",
    genericError: "Hata",
    created: "Çalışan hesabı başarıyla oluşturuldu",
    updated: "Çalışan bilgileri güncellendi",
    deleted: "Çalışan silindi",
    createAccount: "Hesap oluştur",
    creating: "Oluşturuluyor...",
    save: "Değişiklikleri kaydet",
    saving: "Kaydediliyor...",
    cancel: "İptal",
    password: "Şifre *",
    employeeName: "Çalışan adı",
    deleteTitle: "Silme onayı",
    deleteDescription: "Çalışan hesabını silmek istiyor musunuz",
    deletePermanent: "Giriş hesabı kalıcı olarak silinecek.",
    ownerAccounts: "İstasyon sahibi hesabı oluştur",
    stationCreate: "İstasyon oluştur",
    addStationServices: "İstasyon hizmeti ekle",
    modifyPrices: "Hizmet fiyatlarını düzenle",
    stationSheet: "İstasyonlar",
    ownersSheet: "Sahipler",
    summarySheet: "Özet",
    noStations: "İstasyon yok",
    noAccounts: "Hesap yok",
    stationName: "İstasyon adı",
    addressLabel: "Adres",
    stateLabel: "Durum",
    ownerLabel: "İstasyon sahibi",
    ownerPhone: "Sahip telefonu",
    createdAt: "Oluşturulma tarihi",
    ownerName: "Sahip adı",
    phoneNumber: "Telefon numarası",
    registeredAt: "Kayıt tarihi",
    item: "Kalem",
    value: "Değer",
    reportDate: "Rapor tarihi",
    employeeNameLabel: "Çalışan adı",
    emailLabel: "E-posta",
    stationCount: "Oluşturulan istasyonlar",
    ownersCount: "Oluşturulan sahipler",
    activeState: "Aktif",
    suspendedState: "Durduruldu",
    exported: "Excel dosyası başarıyla dışa aktarıldı",
  },
} as const;

export default function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const { language, isRtl, locale } = useAppLanguage();
  const t = texts[language];

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("employees").select("*").order("created_at", { ascending: false });

    if (data) {
      const enriched = await Promise.all(
        data.map(async (emp) => {
          const [stRes, owRes] = await Promise.all([
            supabase.from("stations").select("id", { count: "exact", head: true }).eq("created_by", emp.user_id),
            supabase.from("station_owners").select("id", { count: "exact", head: true }).eq("created_by", emp.user_id),
          ]);
          return { ...emp, stations_count: stRes.count || 0, owners_count: owRes.count || 0 };
        }),
      );
      setEmployees(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast({ title: t.genericError, description: t.fullFields, variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await supabase.functions.invoke("create-employee", {
      body: {
        name: form.name,
        email: form.email,
        password: form.password,
        can_create_owners: form.can_create_owners,
        can_create_stations: form.can_create_stations,
        can_add_service: form.can_add_service,
        can_edit_prices: form.can_edit_prices,
      },
    });
    setSaving(false);
    if (res.error || res.data?.error) {
      toast({ title: t.genericError, description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: t.created });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    const { error } = await supabase
      .from("employees")
      .update({
        name: form.name,
        can_create_owners: form.can_create_owners,
        can_create_stations: form.can_create_stations,
        can_add_service: form.can_add_service,
        can_edit_prices: form.can_edit_prices,
      })
      .eq("id", editTarget.id);
    setSaving(false);
    if (error) {
      toast({ title: t.genericError, description: error.message, variant: "destructive" });
    } else {
      toast({ title: t.updated });
      setShowEdit(false);
      load();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await supabase.functions.invoke("delete-employee", { body: { employee_id: deleteTarget.id } });
    if (res.error || res.data?.error) {
      toast({ title: t.genericError, description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: t.deleted });
      setDeleteTarget(null);
      load();
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    const { error } = await supabase.from("employees").update({ is_active: !emp.is_active }).eq("id", emp.id);
    if (error) {
      toast({ title: t.genericError, description: error.message, variant: "destructive" });
    } else {
      load();
    }
  };

  const handleExportExcel = async (emp: Employee) => {
    const { data: stations } = await supabase
      .from("stations")
      .select("name, address, is_active, created_at, station_owners(owner_name, owner_phone)")
      .eq("created_by", emp.user_id)
      .order("created_at", { ascending: false });

    const { data: owners } = await supabase
      .from("station_owners")
      .select("owner_name, owner_phone, created_at, stations(name)")
      .eq("created_by", emp.user_id)
      .order("created_at", { ascending: false });

    const wb = XLSX.utils.book_new();

    const stationsData = (stations || []).map((s: any) => ({
      [t.stationName]: s.name || "",
      [t.addressLabel]: s.address || "",
      [t.stateLabel]: s.is_active ? t.activeState : t.suspendedState,
      [t.ownerLabel]: s.station_owners?.[0]?.owner_name || "",
      [t.ownerPhone]: s.station_owners?.[0]?.owner_phone || "",
      [t.createdAt]: new Date(s.created_at).toLocaleDateString(locale),
    }));
    const ws1 = XLSX.utils.json_to_sheet(stationsData.length ? stationsData : [{ [t.noStations]: "" }]);
    XLSX.utils.book_append_sheet(wb, ws1, t.stationSheet);

    const ownersData = (owners || []).map((o: any) => ({
      [t.ownerName]: o.owner_name || "",
      [t.phoneNumber]: o.owner_phone || "",
      [t.stationName]: (o.stations as any)?.name || "",
      [t.registeredAt]: new Date(o.created_at).toLocaleDateString(locale),
    }));
    const ws2 = XLSX.utils.json_to_sheet(ownersData.length ? ownersData : [{ [t.noAccounts]: "" }]);
    XLSX.utils.book_append_sheet(wb, ws2, t.ownersSheet);

    const summaryData = [
      { [t.item]: t.employeeNameLabel, [t.value]: emp.name },
      { [t.item]: t.emailLabel, [t.value]: emp.email },
      { [t.item]: t.stationCount, [t.value]: emp.stations_count || 0 },
      { [t.item]: t.ownersCount, [t.value]: emp.owners_count || 0 },
      { [t.item]: t.reportDate, [t.value]: new Date().toLocaleDateString(locale) },
    ];
    const ws3 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws3, t.summarySheet);

    XLSX.writeFile(wb, `employee_${emp.name}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: t.exported });
  };

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setForm({
      name: emp.name,
      email: emp.email,
      password: "",
      can_create_owners: emp.can_create_owners,
      can_create_stations: emp.can_create_stations,
      can_add_service: emp.can_add_service ?? false,
      can_edit_prices: emp.can_edit_prices ?? false,
    });
    setShowEdit(true);
  };

  const permissionBadges = (emp: Employee) =>
    [emp.can_create_owners ? t.createAccounts : null, emp.can_create_stations ? t.createStations : null, emp.can_add_service ? t.addService : null, emp.can_edit_prices ? t.editPrices : null].filter(Boolean) as string[];

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <Badge variant="secondary">{employees.length}</Badge>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }}>
          <Plus className="h-4 w-4 ml-1" /> {t.add}
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">{t.loading}</div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t.empty}</div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-3 py-2 font-medium">{t.name}</th>
                <th className="text-right px-3 py-2 font-medium">{t.email}</th>
                <th className="text-right px-3 py-2 font-medium">{t.permissions}</th>
                <th className="text-center px-3 py-2 font-medium">{t.stations}</th>
                <th className="text-center px-3 py-2 font-medium">{t.accounts}</th>
                <th className="text-center px-3 py-2 font-medium">{t.status}</th>
                <th className="text-center px-3 py-2 font-medium">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const badges = permissionBadges(emp);
                return (
                  <tr key={emp.id} className={`border-t hover:bg-muted/30 transition-opacity ${!emp.is_active ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2 font-medium">{emp.name}</td>
                    <td className="px-3 py-2 text-muted-foreground" dir="ltr">{emp.email}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {badges.length > 0 ? badges.map((badge) => (
                          <Badge key={badge} variant="outline" className="text-[11px]">{badge}</Badge>
                        )) : <span className="text-muted-foreground text-xs">{t.noPermissions}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center"><Badge variant="secondary">{emp.stations_count}</Badge></td>
                    <td className="px-3 py-2 text-center"><Badge variant="secondary">{emp.owners_count}</Badge></td>
                    <td className="px-3 py-2 text-center">{emp.is_active ? <span className="text-green-600 text-xs font-medium">{t.active}</span> : <span className="text-gray-400 text-xs font-medium">{t.inactive}</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title={t.exportExcel} onClick={() => handleExportExcel(emp)}><Download className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title={t.edit} onClick={() => openEdit(emp)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title={emp.is_active ? t.pause : t.activate} onClick={() => handleToggleActive(emp)}>{emp.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title={t.delete} onClick={() => setDeleteTarget(emp)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-md">
          <DialogHeader><DialogTitle>{t.createTitle}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.name} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.employeeName} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.email}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" dir="ltr" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>{t.password}</Label>
              <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>{t.permissions}</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="oc" checked={form.can_create_owners} onCheckedChange={(v) => setForm({ ...form, can_create_owners: !!v })} />
                <label htmlFor="oc" className="text-sm cursor-pointer">{t.ownerAccounts}</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="sc" checked={form.can_create_stations} onCheckedChange={(v) => setForm({ ...form, can_create_stations: !!v })} />
                <label htmlFor="sc" className="text-sm cursor-pointer">{t.stationCreate}</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="as" checked={form.can_add_service} onCheckedChange={(v) => setForm({ ...form, can_add_service: !!v })} />
                <label htmlFor="as" className="text-sm cursor-pointer">{t.addStationServices}</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ep" checked={form.can_edit_prices} onCheckedChange={(v) => setForm({ ...form, can_edit_prices: !!v })} />
                <label htmlFor="ep" className="text-sm cursor-pointer">{t.modifyPrices}</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t.cancel}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? t.creating : t.createAccount}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-md">
          <DialogHeader><DialogTitle>{t.editTitle}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.name}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.email}</Label>
              <Input value={form.email} disabled dir="ltr" className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>{t.permissions}</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="oc2" checked={form.can_create_owners} onCheckedChange={(v) => setForm({ ...form, can_create_owners: !!v })} />
                <label htmlFor="oc2" className="text-sm cursor-pointer">{t.ownerAccounts}</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="sc2" checked={form.can_create_stations} onCheckedChange={(v) => setForm({ ...form, can_create_stations: !!v })} />
                <label htmlFor="sc2" className="text-sm cursor-pointer">{t.stationCreate}</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="as2" checked={form.can_add_service} onCheckedChange={(v) => setForm({ ...form, can_add_service: !!v })} />
                <label htmlFor="as2" className="text-sm cursor-pointer">{t.addStationServices}</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ep2" checked={form.can_edit_prices} onCheckedChange={(v) => setForm({ ...form, can_edit_prices: !!v })} />
                <label htmlFor="ep2" className="text-sm cursor-pointer">{t.modifyPrices}</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>{t.cancel}</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? t.saving : t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDescription} <strong>{deleteTarget?.name}</strong>? {t.deletePermanent}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
