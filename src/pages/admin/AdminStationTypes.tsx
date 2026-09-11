import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, Loader2, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppLanguage, type AppLanguage } from "@/lib/language";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type StationType = {
  id: string;
  name: string;
  pin_color: string;
};

const DEFAULT_PIN_COLOR = "#2563eb";
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const texts: Record<AppLanguage, Record<string, string>> = {
  ar: {
    title: "أنواع المحطات",
    subtitle: "أنشئ أنواع محطات ولوّنها لتظهر بألوان مختلفة على الخريطة.",
    add: "إضافة نوع",
    search: "ابحث باسم النوع...",
    name: "اسم النوع",
    pinColor: "لون العلامة",
    id: "المعرف",
    actions: "إجراءات",
    edit: "تعديل",
    delete: "حذف",
    noRows: "لا توجد أنواع محطات حالياً.",
    noMatches: "لا توجد نتائج مطابقة.",
    count: "العدد",
    addTitle: "إضافة نوع محطة",
    editTitle: "تعديل نوع المحطة",
    formDesc: "اختر اسماً ولوناً مميزاً يظهر على علامة المحطة في الخريطة.",
    namePlaceholder: "مثال: غسيل فاخر",
    cancel: "إلغاء",
    save: "حفظ",
    update: "تحديث",
    required: "اسم النوع مطلوب",
    invalidColor: "أدخل لوناً صحيحاً بصيغة HEX (مثال: #2563eb)",
    saveError: "تعذر حفظ نوع المحطة",
    deleteError: "تعذر حذف نوع المحطة",
    loadError: "تعذر تحميل أنواع المحطات",
    added: "تمت إضافة النوع",
    updated: "تم تحديث النوع",
    deleted: "تم حذف النوع",
    confirmTitle: "حذف نوع المحطة؟",
    confirmBody: "المحطات المرتبطة بهذا النوع تبقى دون نوع بعد الحذف.",
    confirmDelete: "حذف",
  },
  en: {
    title: "Station types",
    subtitle: "Create station types and color them so they stand out on the map.",
    add: "Add type",
    search: "Search by type name...",
    name: "Type name",
    pinColor: "Pin color",
    id: "ID",
    actions: "Actions",
    edit: "Edit",
    delete: "Delete",
    noRows: "No station types yet.",
    noMatches: "No matching results.",
    count: "Count",
    addTitle: "Add station type",
    editTitle: "Edit station type",
    formDesc: "Pick a name and a color that will show on the station's map pin.",
    namePlaceholder: "e.g. Premium wash",
    cancel: "Cancel",
    save: "Save",
    update: "Update",
    required: "Type name is required",
    invalidColor: "Enter a valid HEX color (e.g. #2563eb)",
    saveError: "Could not save the station type",
    deleteError: "Could not delete the station type",
    loadError: "Could not load station types",
    added: "Type added",
    updated: "Type updated",
    deleted: "Type deleted",
    confirmTitle: "Delete this station type?",
    confirmBody: "Stations using this type will be left without a type.",
    confirmDelete: "Delete",
  },
  ku: {
    title: "جۆرەکانی وێستگە",
    subtitle: "جۆرەکانی وێستگە دروست بکە و ڕەنگیان بکە تا لەسەر نەخشەکە جیاواز دەربکەون.",
    add: "زیادکردنی جۆر",
    search: "گەڕان بە ناوی جۆر...",
    name: "ناوی جۆر",
    pinColor: "ڕەنگی نیشانە",
    id: "ناسنامە",
    actions: "کردارەکان",
    edit: "دەستکاری",
    delete: "سڕینەوە",
    noRows: "هێشتا هیچ جۆرێکی وێستگە نییە.",
    noMatches: "هیچ ئەنجامێک نەدۆزرایەوە.",
    count: "ژمارە",
    addTitle: "زیادکردنی جۆری وێستگە",
    editTitle: "دەستکاری جۆری وێستگە",
    formDesc: "ناوێک و ڕەنگێک هەڵبژێرە کە لەسەر نیشانەی وێستگەکە لە نەخشەکە دەردەکەوێت.",
    namePlaceholder: "نموونە: شوشتنی VIP",
    cancel: "پاشگەزبوونەوە",
    save: "پاشەکەوتکردن",
    update: "نوێکردنەوە",
    required: "ناوی جۆر پێویستە",
    invalidColor: "ڕەنگێکی دروست بە فۆرماتی HEX بنووسە (نموونە: #2563eb)",
    saveError: "پاشەکەوتکردنی جۆری وێستگە سەرکەوتوو نەبوو",
    deleteError: "سڕینەوەی جۆری وێستگە سەرکەوتوو نەبوو",
    loadError: "بارکردنی جۆرەکانی وێستگە سەرکەوتوو نەبوو",
    added: "جۆرەکە زیادکرا",
    updated: "جۆرەکە نوێکرایەوە",
    deleted: "جۆرەکە سڕایەوە",
    confirmTitle: "ئەم جۆرە بسڕدرێتەوە؟",
    confirmBody: "وێستگە پەیوەستەکان بەم جۆرەوە بێ جۆر دەمێننەوە دوای سڕینەوە.",
    confirmDelete: "سڕینەوە",
  },
  tr: {
    title: "İstasyon türleri",
    subtitle: "İstasyon türleri oluşturun ve haritada öne çıkmaları için renklendirin.",
    add: "Tür ekle",
    search: "Tür adına göre ara...",
    name: "Tür adı",
    pinColor: "Pin rengi",
    id: "Kimlik",
    actions: "İşlemler",
    edit: "Düzenle",
    delete: "Sil",
    noRows: "Henüz istasyon türü yok.",
    noMatches: "Eşleşen sonuç yok.",
    count: "Sayı",
    addTitle: "İstasyon türü ekle",
    editTitle: "İstasyon türünü düzenle",
    formDesc: "İstasyonun harita pininde görünecek bir ad ve renk seçin.",
    namePlaceholder: "örn. Premium yıkama",
    cancel: "İptal",
    save: "Kaydet",
    update: "Güncelle",
    required: "Tür adı gerekli",
    invalidColor: "Geçerli bir HEX renk girin (örn. #2563eb)",
    saveError: "İstasyon türü kaydedilemedi",
    deleteError: "İstasyon türü silinemedi",
    loadError: "İstasyon türleri yüklenemedi",
    added: "Tür eklendi",
    updated: "Tür güncellendi",
    deleted: "Tür silindi",
    confirmTitle: "Bu istasyon türü silinsin mi?",
    confirmBody: "Bu türü kullanan istasyonlar türsüz kalacak.",
    confirmDelete: "Sil",
  },
};

const AdminStationTypes = () => {
  const { language, isRtl } = useAppLanguage();
  const t = texts[language];

  const [rows, setRows] = useState<StationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StationType | null>(null);
  const [name, setName] = useState("");
  const [pinColor, setPinColor] = useState(DEFAULT_PIN_COLOR);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<StationType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("station_types")
      .select("id, name, pin_color")
      .order("name", { ascending: true });
    setLoading(false);

    if (error) {
      toast({ title: t.loadError, description: error.message, variant: "destructive" });
      return;
    }

    setRows((data || []) as StationType[]);
  }, [t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [rows, search]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setPinColor(DEFAULT_PIN_COLOR);
    setDialogOpen(true);
  };

  const openEdit = (row: StationType) => {
    setEditing(row);
    setName(row.name);
    setPinColor(HEX_COLOR_PATTERN.test(row.pin_color) ? row.pin_color : DEFAULT_PIN_COLOR);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditing(null);
    setName("");
    setPinColor(DEFAULT_PIN_COLOR);
  };

  const handleSave = async () => {
    const cleanedName = name.trim();
    if (!cleanedName) {
      toast({ title: t.required, variant: "destructive" });
      return;
    }
    const cleanedColor = pinColor.trim();
    if (!HEX_COLOR_PATTERN.test(cleanedColor)) {
      toast({ title: t.invalidColor, variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = { name: cleanedName, pin_color: cleanedColor };
    const query = editing
      ? (supabase as any).from("station_types").update(payload).eq("id", editing.id)
      : (supabase as any).from("station_types").insert(payload);

    const { error } = await query;
    setSaving(false);

    if (error) {
      toast({ title: t.saveError, description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editing ? t.updated : t.added });
    closeDialog();
    await load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    const targetId = deleting.id;
    const { error } = await (supabase as any).from("station_types").delete().eq("id", targetId);
    setDeleteLoading(false);

    if (error) {
      toast({ title: t.deleteError, description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: t.deleted });
    setDeleting(null);
    setRows((current) => current.filter((row) => row.id !== targetId));
  };

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button onClick={openAdd} className="w-full gap-2 sm:w-auto">
          <Plus className="h-4 w-4" />
          {t.add}
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-5 w-5 text-primary" />
            {t.title}
          </CardTitle>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} className="ps-9" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 text-sm text-muted-foreground">
            {t.count}: <span className="font-medium text-foreground">{filteredRows.length}</span>
          </div>

          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.name}</TableHead>
                  <TableHead>{t.pinColor}</TableHead>
                  <TableHead className="hidden md:table-cell">{t.id}</TableHead>
                  <TableHead className="w-32 text-center">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-72" /></TableCell>
                      <TableCell><Skeleton className="mx-auto h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      {rows.length === 0 ? t.noRows : t.noMatches}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-4 w-4 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: row.pin_color }}
                          />
                          <span className="font-mono text-xs text-muted-foreground" dir="ltr">{row.pin_color}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{row.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">{t.edit}</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleting(row)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">{t.delete}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t.editTitle : t.addTitle}</DialogTitle>
            <DialogDescription>{t.formDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="station-type-name">{t.name}</Label>
              <Input
                id="station-type-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.namePlaceholder}
                disabled={saving}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSave();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="station-type-color">{t.pinColor}</Label>
              <div className="flex items-center gap-2">
                <input
                  id="station-type-color"
                  type="color"
                  value={HEX_COLOR_PATTERN.test(pinColor) ? pinColor : DEFAULT_PIN_COLOR}
                  onChange={(event) => setPinColor(event.target.value)}
                  disabled={saving}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded border border-input bg-background p-1"
                />
                <Input
                  value={pinColor}
                  onChange={(event) => setPinColor(event.target.value)}
                  placeholder={DEFAULT_PIN_COLOR}
                  disabled={saving}
                  dir="ltr"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog} disabled={saving}>
                {t.cancel}
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {editing ? t.update : t.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && !deleteLoading && setDeleting(null)}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.confirmBody}
              {deleting?.name ? <span className="mt-2 block font-medium text-foreground">{deleting.name}</span> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminStationTypes;
